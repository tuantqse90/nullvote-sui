"""Cross-language Poseidon test vector.

MUST match output of JS (poseidon-lite) and Circom (circomlib) for same input.
If any language produces a different hash, STOP and debug before continuing Day 2+.
Canonical source: circomlib BN254 Poseidon, t=3 (2-input variant).
"""

import pytest

CANONICAL = 0x115CC0F5E7D690413DF64C6B9662E9CF2A3617F2743245519E19607A4417189A


def _load_poseidon():
    """Import whichever circomlib-compatible Python Poseidon library is available.

    Tries a few known package names since the Python ecosystem has several
    BN254-Poseidon implementations with slightly different module paths.
    """
    errs: list[str] = []

    try:
        from circomlibpy.poseidon import poseidon_hash  # type: ignore

        return poseidon_hash, "circomlibpy.poseidon.poseidon_hash"
    except Exception as e:
        errs.append(f"circomlibpy: {e!r}")

    try:
        from circomlib_py import poseidon_hash  # type: ignore

        return poseidon_hash, "circomlib_py.poseidon_hash"
    except Exception as e:
        errs.append(f"circomlib_py: {e!r}")

    try:
        from poseidon_hash import poseidon  # type: ignore

        return poseidon, "poseidon_hash.poseidon"
    except Exception as e:
        errs.append(f"poseidon_hash: {e!r}")

    pytest.skip(
        "No circomlib-compatible Poseidon library installed. "
        "Install with `pip install circomlib-py` (preferred) "
        "or `pip install poseidon-hash`. Attempts:\n  - " + "\n  - ".join(errs)
    )


def test_poseidon_canonical_vector() -> None:
    hash_fn, source = _load_poseidon()

    out = int(hash_fn([1, 2]))

    assert out == CANONICAL, (
        f"Poseidon mismatch via {source}: "
        f"got {hex(out)}, expected {hex(CANONICAL)}"
    )


if __name__ == "__main__":
    hash_fn, source = _load_poseidon()
    out = int(hash_fn([1, 2]))
    print(f"  lib:      {source}")
    print(f"  input:    [1, 2]")
    print(f"  output:   {hex(out).zfill(66)}")
    print(f"  expected: {hex(CANONICAL).zfill(66)}")
    if out != CANONICAL:
        print("\n✗ MISMATCH — Python Poseidon does not match canonical value")
        raise SystemExit(1)
    print("\n✓ Python Poseidon([1, 2]) matches canonical value")
