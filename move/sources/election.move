/// NullVote on-chain election module.
///
/// Flow:
///   1. Admin calls `create_election` → shared Election object in Registration phase.
///   2. Voters register off-chain (backend collects Poseidon commitments).
///   3. Admin calls `finalize_registration(root)` → phase becomes Voting, Merkle root frozen.
///   4. Any voter with a valid Groth16 proof calls `cast_vote` → nullifier consumed, tally++.
///   5. `get_tally` readable once voting ends (clock.now ≥ end_time) or admin calls `close`.
///
/// Security invariants (mirror INIT_PROMPT.md §6):
///   - Groth16 verification happens natively via `sui::groth16` — no custom crypto here.
///   - Nullifier uniqueness enforced via a Table — replay attempts abort with EDoubleVote.
///   - Merkle root on-chain is the source of truth; circuit must prove against it.
///   - Vote range enforced in-circuit (vote < num_candidates); extra defense on-chain too.
module nullvote::election {
    use std::string::{Self, String};
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::groth16;
    use nullvote::vk;
    use nullvote::events;

    // ── Phase constants ─────────────────────────────────────────────────
    const PhaseRegistration: u8 = 0;
    const PhaseVoting: u8 = 1;
    const PhaseClosed: u8 = 2;

    // ── Error codes ─────────────────────────────────────────────────────
    const ENotAdmin: u64 = 0;
    const EWrongPhase: u64 = 1;
    const EVotingEnded: u64 = 2;
    const EInvalidProof: u64 = 3;
    const EDoubleVote: u64 = 4;
    const EBadMerkleRoot: u64 = 5;
    const EBadPublicInputs: u64 = 6;
    const EBadElectionId: u64 = 7;
    const EBadVoteIndex: u64 = 8;
    const ETooFewCandidates: u64 = 9;
    const ETooManyCandidates: u64 = 10;
    const EVotingNotEnded: u64 = 11;

    const FIELD_BYTES: u64 = 32;
    const NUM_PUBLIC_INPUTS: u64 = 5;
    const PUBLIC_INPUTS_LEN: u64 = FIELD_BYTES * NUM_PUBLIC_INPUTS;

    // Public input offsets in the concatenated bytes (each 32 bytes LE):
    //   [0..32)    root
    //   [32..64)   nullifier
    //   [64..96)   election_id
    //   [96..128)  vote_public
    //   [128..160) num_candidates
    const OFF_ROOT: u64 = 0;
    const OFF_NULLIFIER: u64 = 32;
    const OFF_ELECTION_ID: u64 = 64;
    const OFF_VOTE: u64 = 96;

    public struct Election has key {
        id: UID,
        admin: address,
        /// Admin-assigned election identifier. Feeds into the circuit's nullifier
        /// so the same voter in two elections produces two different nullifiers —
        /// admins MUST pick a fresh value per election. Chosen as `u64` to fit
        /// the low 8 bytes of a 32-byte field-element public input, with the
        /// remaining 24 bytes constrained to zero on-chain.
        election_id: u64,
        title: String,
        candidates: vector<String>,
        /// Poseidon Merkle root (32 bytes). Empty during Registration.
        merkle_root: vector<u8>,
        /// 32-byte Poseidon nullifier → true. Presence means already-voted.
        nullifiers: Table<vector<u8>, bool>,
        /// tally[i] = votes for candidates[i].
        tally: vector<u64>,
        end_time_ms: u64,
        phase: u8,
    }

    // ── Entry points ────────────────────────────────────────────────────

    /// Create a new election. Any address may call this; they become the admin.
    /// `election_id` is the unique identifier fed into the circuit's nullifier
    /// function; admins MUST choose a fresh value per election (conventionally
    /// a random u64 or `tx_context::epoch_timestamp_ms`).
    public fun create_election(
        election_id: u64,
        title_bytes: vector<u8>,
        candidate_bytes: vector<vector<u8>>,
        end_time_ms: u64,
        ctx: &mut TxContext,
    ) {
        let n = vector::length(&candidate_bytes);
        assert!(n >= 2, ETooFewCandidates);
        // 32-bit range check in circuit easily handles this but cap to keep
        // tally-vector reads cheap.
        assert!(n <= 255, ETooManyCandidates);

        let mut candidates = vector::empty<String>();
        let mut tally = vector::empty<u64>();
        let mut i = 0;
        while (i < n) {
            vector::push_back(&mut candidates, string::utf8(*vector::borrow(&candidate_bytes, i)));
            vector::push_back(&mut tally, 0);
            i = i + 1;
        };

        let title = string::utf8(title_bytes);
        let admin = tx_context::sender(ctx);

        let election = Election {
            id: object::new(ctx),
            admin,
            election_id,
            title,
            candidates,
            merkle_root: vector::empty(),
            nullifiers: table::new(ctx),
            tally,
            end_time_ms,
            phase: PhaseRegistration,
        };

        events::emit_created(
            object::uid_to_inner(&election.id),
            admin,
            election_id,
            election.title,
            election.candidates,
            end_time_ms,
        );

        transfer::share_object(election);
    }

    /// Admin freezes the voter set by publishing the backend-computed Merkle root.
    /// Transitions Registration → Voting. Cannot be called twice.
    public fun finalize_registration(
        election: &mut Election,
        merkle_root: vector<u8>,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == election.admin, ENotAdmin);
        assert!(election.phase == PhaseRegistration, EWrongPhase);
        assert!(vector::length(&merkle_root) == FIELD_BYTES, EBadMerkleRoot);

        election.merkle_root = merkle_root;
        election.phase = PhaseVoting;

        events::emit_registration_closed(
            object::uid_to_inner(&election.id),
            election.merkle_root,
        );
    }

    /// Verify a zero-knowledge voting proof and record the vote if valid.
    /// Anyone may call this — the proof + on-chain nullifier table provide the
    /// access control.
    public fun cast_vote(
        election: &mut Election,
        proof_bytes: vector<u8>,
        public_inputs_bytes: vector<u8>,
        clock: &Clock,
    ) {
        assert!(election.phase == PhaseVoting, EWrongPhase);
        let now = clock::timestamp_ms(clock);
        assert!(now < election.end_time_ms, EVotingEnded);
        assert!(vector::length(&public_inputs_bytes) == PUBLIC_INPUTS_LEN, EBadPublicInputs);

        // 1. Sanity-check public inputs against on-chain state BEFORE expensive pairing.
        let claimed_root = slice(&public_inputs_bytes, OFF_ROOT, FIELD_BYTES);
        assert!(claimed_root == election.merkle_root, EBadMerkleRoot);

        let claimed_election_id = slice(&public_inputs_bytes, OFF_ELECTION_ID, FIELD_BYTES);
        assert!(field_bytes_to_u64(&claimed_election_id) == election.election_id, EBadElectionId);
        assert!(high_24_bytes_zero(&claimed_election_id), EBadElectionId);

        let vote_bytes = slice(&public_inputs_bytes, OFF_VOTE, FIELD_BYTES);
        let vote_index = field_bytes_to_u64(&vote_bytes);
        let n_cand = vector::length(&election.candidates) as u64;
        assert!(vote_index < n_cand, EBadVoteIndex);

        let nullifier = slice(&public_inputs_bytes, OFF_NULLIFIER, FIELD_BYTES);
        assert!(!table::contains(&election.nullifiers, nullifier), EDoubleVote);

        // 2. Groth16 verification via the native Sui framework module.
        let curve = groth16::bn254();
        let vk_bytes = vk::bytes();
        let pvk = groth16::prepare_verifying_key(&curve, &vk_bytes);
        let pi = groth16::public_proof_inputs_from_bytes(public_inputs_bytes);
        let proof = groth16::proof_points_from_bytes(proof_bytes);
        assert!(groth16::verify_groth16_proof(&curve, &pvk, &pi, &proof), EInvalidProof);

        // 3. Commit state changes.
        table::add(&mut election.nullifiers, nullifier, true);
        let slot = vector::borrow_mut(&mut election.tally, vote_index);
        *slot = *slot + 1;

        events::emit_vote_cast(
            object::uid_to_inner(&election.id),
            slice(&public_inputs_bytes, OFF_NULLIFIER, FIELD_BYTES),
            vote_index,
            now,
        );
    }

    /// Admin-triggered early close. Emits final tally. No more votes accepted.
    public fun close_election(
        election: &mut Election,
        ctx: &TxContext,
    ) {
        assert!(tx_context::sender(ctx) == election.admin, ENotAdmin);
        assert!(election.phase == PhaseVoting, EWrongPhase);
        election.phase = PhaseClosed;
        events::emit_closed(object::uid_to_inner(&election.id), election.tally);
    }

    /// Read the current tally. Callable anytime during voting for frontend display,
    /// but the "final" read should happen after end_time_ms.
    public fun tally(election: &Election): vector<u64> {
        election.tally
    }

    public fun phase(election: &Election): u8 {
        election.phase
    }

    public fun merkle_root(election: &Election): vector<u8> {
        election.merkle_root
    }

    public fun end_time_ms(election: &Election): u64 {
        election.end_time_ms
    }

    public fun candidates(election: &Election): vector<String> {
        election.candidates
    }

    public fun admin(election: &Election): address {
        election.admin
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    /// Extract `len` bytes starting at `start` from `v`.
    fun slice(v: &vector<u8>, start: u64, len: u64): vector<u8> {
        let mut out = vector::empty<u8>();
        let end = start + len;
        let mut i = start;
        while (i < end) {
            vector::push_back(&mut out, *vector::borrow(v, i));
            i = i + 1;
        };
        out
    }

    /// Interpret the low 8 bytes of a 32-byte LE field element as a u64.
    /// High bytes are expected to be 0 for vote-index / election-id encodings.
    fun field_bytes_to_u64(bytes: &vector<u8>): u64 {
        let mut v: u64 = 0;
        let mut i: u64 = 0;
        while (i < 8) {
            let b = *vector::borrow(bytes, i) as u64;
            v = v | (b << ((i as u8) * 8));
            i = i + 1;
        };
        v
    }

    /// Verify that bytes [8..32) of a 32-byte LE field-element encoding are
    /// all zero, confirming the public input fits in u64.
    fun high_24_bytes_zero(bytes: &vector<u8>): bool {
        let mut i: u64 = 8;
        while (i < FIELD_BYTES) {
            if (*vector::borrow(bytes, i) != 0) return false;
            i = i + 1;
        };
        true
    }

    public fun election_id(election: &Election): u64 {
        election.election_id
    }
}
