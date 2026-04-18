pragma circom 2.1.4;

// Cross-language Poseidon test vector circuit.
//
// Compile + run witness generation with input {"a": 1, "b": 2}. The resulting
// signal `out` must equal the canonical value:
//   0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a
// which is also produced by poseidon-lite (JS) and circomlib-py (Python).
//
// If the Circom output differs, cross-language consistency is broken — do NOT
// proceed to Day 2+ until this is resolved.

include "../node_modules/circomlib/circuits/poseidon.circom";

template PoseidonTest() {
    signal input a;
    signal input b;
    signal output out;

    component h = Poseidon(2);
    h.inputs[0] <== a;
    h.inputs[1] <== b;
    out <== h.out;
}

component main = PoseidonTest();
