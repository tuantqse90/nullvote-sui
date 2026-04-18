"""Pure-Python port of circomlib's Poseidon hash (BN254 scalar field).

Constants come from circomlibjs/src/poseidon_constants.json via the exporter at
circuits/scripts/export_poseidon_constants.js — run that script whenever
circomlibjs is upgraded. The algorithm mirrors circomlibjs's non-optimized
`buildPoseidonReference()` so that output is bit-identical to:

  - Circom `Poseidon(n)` component (circomlib/circuits/poseidon.circom)
  - JS `poseidon-lite` (poseidon2, poseidon3, ...)
  - JS `circomlibjs.buildPoseidon()` / `buildPoseidonReference()`

Canonical test vector (t=3 / nInputs=2):
  Poseidon([1, 2]) = 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a

If you change anything here, run `pytest backend/tests/test_poseidon.py` —
a silent mismatch ruins the entire voting system.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Sequence

BN254_SCALAR_FIELD = (
    21888242871839275222246405745257275088548364400416034343698204186575808495617
)

_CONSTANTS_PATH = Path(__file__).with_name("poseidon_constants.json")


def _parse_field(x: str | int) -> int:
    if isinstance(x, int):
        return x
    if x.startswith("0x") or x.startswith("0X"):
        return int(x, 16)
    return int(x)


@lru_cache(maxsize=1)
def _load_constants() -> dict:
    with _CONSTANTS_PATH.open() as f:
        raw = json.load(f)

    prime = _parse_field(raw["prime"])
    if prime != BN254_SCALAR_FIELD:
        raise ValueError(
            f"poseidon_constants.json prime {prime} != BN254_SCALAR_FIELD"
        )

    per_t: dict[int, dict] = {}
    for t_str, bundle in raw["per_t"].items():
        t = int(t_str)
        per_t[t] = {
            "C": [_parse_field(v) for v in bundle["C"]],
            "M": [[_parse_field(v) for v in row] for row in bundle["M"]],
        }

    return {
        "prime": prime,
        "n_rounds_f": int(raw["n_rounds_f"]),
        "n_rounds_p": [int(x) for x in raw["n_rounds_p"]],
        "per_t": per_t,
    }


def _pow5(x: int, p: int) -> int:
    return pow(x, 5, p)


def poseidon_hash(inputs: Sequence[int]) -> int:
    """Circomlib-compatible Poseidon hash over BN254 scalar field.

    Accepts 1..16 field elements (ints). Returns a single field element.
    """
    n = len(inputs)
    if n < 1 or n > 16:
        raise ValueError(f"Poseidon supports 1..16 inputs, got {n}")

    cfg = _load_constants()
    p = cfg["prime"]
    t = n + 1
    n_f = cfg["n_rounds_f"]
    n_p = cfg["n_rounds_p"][t - 2]
    C = cfg["per_t"][t]["C"]
    M = cfg["per_t"][t]["M"]

    # state[0] is the capacity (always 0), followed by the inputs.
    state = [0] + [x % p for x in inputs]

    half_f = n_f // 2
    total_rounds = n_f + n_p

    for r in range(total_rounds):
        # Add round constants.
        state = [(state[j] + C[r * t + j]) % p for j in range(t)]

        # S-box.
        is_full = r < half_f or r >= half_f + n_p
        if is_full:
            state = [_pow5(s, p) for s in state]
        else:
            state[0] = _pow5(state[0], p)

        # MDS multiplication. Mirrors circomlibjs reference (poseidon_reference.js:70):
        #   new_state[i] = Σ_j M[i][j] * state[j]
        # Row-major — the transposed form is a common silent-bug source.
        new_state = [0] * t
        for i in range(t):
            acc = 0
            for j in range(t):
                acc = (acc + M[i][j] * state[j]) % p
            new_state[i] = acc
        state = new_state

    return state[0]
