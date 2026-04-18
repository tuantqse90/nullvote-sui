pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Public key derivation: pk = Poseidon(sk). One-input Poseidon.
// sk is a private field element; pk is revealed only inside the circuit.
template PubKey() {
    signal input sk;
    signal output pk;

    component h = Poseidon(1);
    h.inputs[0] <== sk;
    pk <== h.out;
}

// Voter commitment: C = Poseidon(pk, r).
// r is a random salt owned by the voter — hiding for the commitment.
template Commitment() {
    signal input pk;
    signal input r;
    signal output commitment;

    component h = Poseidon(2);
    h.inputs[0] <== pk;
    h.inputs[1] <== r;
    commitment <== h.out;
}

// Nullifier: N = Poseidon(sk, election_id). Deterministic per voter per election,
// unlinkable to commitment (different hash domain via different inputs).
template Nullifier() {
    signal input sk;
    signal input election_id;
    signal output nullifier;

    component h = Poseidon(2);
    h.inputs[0] <== sk;
    h.inputs[1] <== election_id;
    nullifier <== h.out;
}
