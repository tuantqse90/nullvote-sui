pragma circom 2.1.4;

include "../node_modules/circomlib/circuits/poseidon.circom";

// Hash a pair of siblings into their parent node. Poseidon(2) over BN254.
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component h = Poseidon(2);
    h.inputs[0] <== left;
    h.inputs[1] <== right;
    hash <== h.out;
}

// Two-input multiplexer used to place (cur, sibling) in the correct (left, right)
// order based on a single path-index bit.
//   s = 0 → out = [cur, sibling]
//   s = 1 → out = [sibling, cur]
// Enforces s ∈ {0, 1} as a constraint to prevent malicious provers from supplying
// a non-bit value.
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;

    out[0] <== (in[1] - in[0]) * s + in[0];
    out[1] <== (in[0] - in[1]) * s + in[1];
}

// Merkle tree inclusion check.
// Given a leaf and a `levels`-length authentication path (siblings + index bits),
// computes the root of a Poseidon binary Merkle tree and exposes it as output.
// The caller is expected to enforce `root === expectedRoot` externally.
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input path_elements[levels];
    signal input path_indices[levels];
    signal output root;

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        if (i == 0) {
            selectors[i].in[0] <== leaf;
        } else {
            selectors[i].in[0] <== hashers[i - 1].hash;
        }
        selectors[i].in[1] <== path_elements[i];
        selectors[i].s <== path_indices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    root <== hashers[levels - 1].hash;
}
