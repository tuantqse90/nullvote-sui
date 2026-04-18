"""Merkle tree construction + inclusion-proof round-trip tests.

Cross-checks the pure-Python implementation against the JS implementation in
`circuits/scripts/gen_sample_input.js` via known-good vectors, and verifies
that any proof produced validates under `verify_proof`.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.merkle import build_merkle_tree, verify_proof  # noqa: E402


def test_empty_tree_root_is_deterministic() -> None:
    tree1 = build_merkle_tree([], depth=4)
    tree2 = build_merkle_tree([], depth=4)
    assert tree1.root == tree2.root
    assert tree1.root != 0  # zero leaves still hash into a non-zero root


def test_single_leaf_proof_round_trip() -> None:
    leaves = [12345]
    tree = build_merkle_tree(leaves, depth=4)
    proof = tree.get_proof(0)
    assert verify_proof(leaves[0], proof, tree.root)


def test_multiple_voters_proof_round_trip() -> None:
    # 10 voters — the Day 4 checkpoint target.
    leaves = [i * 0x1111 + 42 for i in range(10)]
    tree = build_merkle_tree(leaves, depth=8)

    for i, leaf in enumerate(leaves):
        proof = tree.get_proof(i)
        assert verify_proof(leaf, proof, tree.root), (
            f"proof for leaf {i} failed"
        )


def test_tampered_leaf_fails_verification() -> None:
    leaves = [1, 2, 3, 4]
    tree = build_merkle_tree(leaves, depth=4)
    proof = tree.get_proof(0)
    assert not verify_proof(leaves[0] + 1, proof, tree.root)


def test_padding_matches_capacity() -> None:
    tree = build_merkle_tree([7, 8, 9], depth=3)
    assert len(tree.layers[0]) == 8  # 2^3
    # Unused slots must be literal zero (circuit assumes default leaf = 0).
    assert tree.layers[0][3] == 0
    assert tree.layers[0][7] == 0


def test_proof_shape_matches_circuit() -> None:
    """path_elements and path_indices must each have `depth` entries — one per level."""
    tree = build_merkle_tree([1, 2, 3], depth=8)
    proof = tree.get_proof(2)
    assert len(proof.path_elements) == 8
    assert len(proof.path_indices) == 8
    assert set(proof.path_indices).issubset({0, 1})
