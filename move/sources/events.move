/// Events emitted by the NullVote election module. Indexers (frontend subscribe,
/// off-chain analytics) listen to these rather than reading shared-object state
/// directly, so the shapes here are public API.
module nullvote::events {
    use std::string::String;
    use sui::event;

    public struct ElectionCreated has copy, drop {
        election_id: ID,
        admin: address,
        /// Admin-assigned election identifier (matches circuit nullifier input).
        circuit_election_id: u64,
        title: String,
        candidates: vector<String>,
        end_time_ms: u64,
    }

    public struct RegistrationClosed has copy, drop {
        election_id: ID,
        merkle_root: vector<u8>,
    }

    public struct VoteCast has copy, drop {
        election_id: ID,
        nullifier: vector<u8>,
        vote_index: u64,
        timestamp_ms: u64,
    }

    public struct ElectionClosed has copy, drop {
        election_id: ID,
        final_tally: vector<u64>,
    }

    public(package) fun emit_created(
        election_id: ID,
        admin: address,
        circuit_election_id: u64,
        title: String,
        candidates: vector<String>,
        end_time_ms: u64,
    ) {
        event::emit(ElectionCreated { election_id, admin, circuit_election_id, title, candidates, end_time_ms });
    }

    public(package) fun emit_registration_closed(election_id: ID, merkle_root: vector<u8>) {
        event::emit(RegistrationClosed { election_id, merkle_root });
    }

    public(package) fun emit_vote_cast(
        election_id: ID,
        nullifier: vector<u8>,
        vote_index: u64,
        timestamp_ms: u64,
    ) {
        event::emit(VoteCast { election_id, nullifier, vote_index, timestamp_ms });
    }

    public(package) fun emit_closed(election_id: ID, final_tally: vector<u64>) {
        event::emit(ElectionClosed { election_id, final_tally });
    }
}
