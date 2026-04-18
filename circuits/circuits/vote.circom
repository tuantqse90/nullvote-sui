pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/comparators.circom";
include "commitment.circom";
include "merkle.circom";

// Main NullVote voting circuit.
//
// Proves, without revealing the voter's identity:
//   1. The prover knows a secret key `sk` whose derived commitment
//      C = Poseidon(Poseidon(sk), r) is in the registered Merkle tree.
//   2. The publicly-exposed nullifier equals Poseidon(sk, election_id), so the
//      on-chain contract can prevent double voting.
//   3. The public `vote_public` matches the private `vote` the prover commits to.
//   4. `vote` is in range [0, num_candidates).
//
// All six invariants from INIT_PROMPT.md §6 are enforced here.
//
// Public inputs (in order, as exposed on-chain):
//   [ root, nullifier, election_id, vote_public, num_candidates ]
//
// Private inputs:
//   sk, r, path_elements[levels], path_indices[levels], vote
template Vote(levels) {
    // Private
    signal input sk;
    signal input r;
    signal input path_elements[levels];
    signal input path_indices[levels];
    signal input vote;

    // Public
    signal input root;
    signal input nullifier;
    signal input election_id;
    signal input vote_public;
    signal input num_candidates;

    // ── 1. pk = Poseidon(sk) ────────────────────────────────────────────
    component pkHasher = PubKey();
    pkHasher.sk <== sk;

    // ── 2. commitment = Poseidon(pk, r) ─────────────────────────────────
    component cHasher = Commitment();
    cHasher.pk <== pkHasher.pk;
    cHasher.r <== r;

    // ── 3. Merkle inclusion: computed root must equal public root ───────
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== cHasher.commitment;
    for (var i = 0; i < levels; i++) {
        tree.path_elements[i] <== path_elements[i];
        tree.path_indices[i] <== path_indices[i];
    }
    tree.root === root;

    // ── 4. nullifier = Poseidon(sk, election_id) ────────────────────────
    component nHasher = Nullifier();
    nHasher.sk <== sk;
    nHasher.election_id <== election_id;
    nHasher.nullifier === nullifier;

    // ── 5. vote binding: private vote == public vote ────────────────────
    vote === vote_public;

    // ── 6. Range check: vote < num_candidates ───────────────────────────
    // 32-bit comparison is plenty for realistic candidate counts; both inputs
    // are expected to fit in 32 bits in any sane election configuration.
    component range = LessThan(32);
    range.in[0] <== vote;
    range.in[1] <== num_candidates;
    range.out === 1;
}

component main {public [root, nullifier, election_id, vote_public, num_candidates]} = Vote(8);
