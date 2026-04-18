"""Cross-language Poseidon test vectors.

Validates the pure-Python port in backend/src/crypto/poseidon.py against known
canonical values produced by circomlibjs's reference implementation and
poseidon-lite (JS) — the same hash the Circom voting circuit uses.

If any vector mismatches, the entire voting system breaks silently (commitments,
nullifiers, Merkle tree all depend on consistent hashing across languages).
Do NOT proceed with Day 2+ work until these are all green.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.crypto.poseidon import BN254_SCALAR_FIELD, poseidon_hash  # noqa: E402


# Vectors produced by circomlibjs.buildPoseidonReference() — see
# `node -e` snippet in the Day 1 session log. These are the ground truth.
CANONICAL_VECTORS: list[tuple[list[int], int]] = [
    (
        [1, 2],
        0x115CC0F5E7D690413DF64C6B9662E9CF2A3617F2743245519E19607A4417189A,
    ),
    (
        [3, 4],
        0x20A3AF0435914CCD84B806164531B0CD36E37D4EFB93EFAB76913A93E1F30996,
    ),
    (
        [1, 2, 3],
        0x0E7732D89E6939C0FF03D5E58DAB6302F3230E269DC5B968F725DF34AB36D732,
    ),
]


def test_bn254_prime_is_correct() -> None:
    assert (
        BN254_SCALAR_FIELD
        == 21888242871839275222246405745257275088548364400416034343698204186575808495617
    )


def test_canonical_vectors() -> None:
    mismatches: list[str] = []
    for inputs, expected in CANONICAL_VECTORS:
        got = poseidon_hash(inputs)
        if got != expected:
            mismatches.append(
                f"Poseidon({inputs}): got={hex(got)}, expected={hex(expected)}"
            )
    assert not mismatches, "\n".join(mismatches)


def test_output_is_field_element() -> None:
    # A few random-ish inputs; just ensure output is always < field prime.
    for inputs in ([0, 0], [BN254_SCALAR_FIELD - 1, 1], [42, 1337]):
        got = poseidon_hash(inputs)
        assert 0 <= got < BN254_SCALAR_FIELD


def test_input_count_bounds() -> None:
    import pytest

    with pytest.raises(ValueError):
        poseidon_hash([])
    with pytest.raises(ValueError):
        poseidon_hash([0] * 17)


if __name__ == "__main__":
    # Manual smoke-test: `python backend/tests/test_poseidon.py`
    ok = True
    for inputs, expected in CANONICAL_VECTORS:
        got = poseidon_hash(inputs)
        ok &= got == expected
        mark = "✓" if got == expected else "✗"
        print(
            f"  {mark} Poseidon({inputs})",
            f"\n    got:      0x{got:064x}",
            f"\n    expected: 0x{expected:064x}",
        )
    if not ok:
        print("\nMISMATCH — Poseidon port is broken.")
        raise SystemExit(1)
    print("\n✓ All canonical vectors match.")
