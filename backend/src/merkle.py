"""Poseidon Merkle tree construction + inclusion proof generation.

Matches the on-chain Merkle verification enforced by `circuits/vote.circom`:
  - binary tree, Poseidon(left, right) per internal node
  - fixed depth (default 8 → 256-leaf capacity)
  - empty slots padded with 0

Outputs are compatible with the circuit's `path_elements` + `path_indices`
private inputs (see INIT_PROMPT.md §5 and ARCHITECTURE.md §2.2).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from .crypto.poseidon import poseidon_hash

DEFAULT_DEPTH = 8  # must match Vote(8) in circuits/vote.circom


@dataclass(frozen=True)
class MerkleProof:
    """Inclusion proof for one leaf.

    `path_elements[i]` is the sibling hash at level i (0 = leaf level).
    `path_indices[i]` is 1 if the current node is the right child at that level,
    0 if it's the left child. Matches circomlib's conventional encoding.
    """

    path_elements: list[int]
    path_indices: list[int]
    root: int


@dataclass
class MerkleTree:
    depth: int
    leaves: list[int]
    layers: list[list[int]]  # layers[0] = leaves (padded), layers[depth] = [root]

    @property
    def root(self) -> int:
        return self.layers[self.depth][0]

    def get_proof(self, leaf_index: int) -> MerkleProof:
        capacity = 1 << self.depth
        if not 0 <= leaf_index < capacity:
            raise IndexError(
                f"leaf_index {leaf_index} out of range for depth {self.depth}"
            )

        path_elements: list[int] = []
        path_indices: list[int] = []
        idx = leaf_index
        for level in range(self.depth):
            is_right = idx & 1
            sibling_idx = idx - 1 if is_right else idx + 1
            path_elements.append(self.layers[level][sibling_idx])
            path_indices.append(is_right)
            idx >>= 1
        return MerkleProof(path_elements, path_indices, self.root)


def build_merkle_tree(
    leaves: Sequence[int], depth: int = DEFAULT_DEPTH
) -> MerkleTree:
    """Build a full binary Poseidon Merkle tree, padding unused slots with 0."""
    capacity = 1 << depth
    if len(leaves) > capacity:
        raise ValueError(
            f"{len(leaves)} leaves exceeds depth-{depth} capacity {capacity}"
        )

    padded: list[int] = list(leaves) + [0] * (capacity - len(leaves))
    layers: list[list[int]] = [padded]
    for _ in range(depth):
        prev = layers[-1]
        nxt = [poseidon_hash([prev[i], prev[i + 1]]) for i in range(0, len(prev), 2)]
        layers.append(nxt)

    return MerkleTree(depth=depth, leaves=list(leaves), layers=layers)


def verify_proof(leaf: int, proof: MerkleProof, expected_root: int) -> bool:
    """Recompute the root from leaf + sibling path; compare against expected_root."""
    node = leaf
    for sibling, is_right in zip(proof.path_elements, proof.path_indices):
        if is_right:
            node = poseidon_hash([sibling, node])
        else:
            node = poseidon_hash([node, sibling])
    return node == expected_root
