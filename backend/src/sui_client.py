"""Thin helper to publish the Merkle root on-chain.

We shell out to the `sui` CLI rather than depend on pysui for one call — gives
the admin explicit gas/signer control and keeps the backend free of key
material at rest. Admin is expected to run `sui client switch` to the
intended account before hitting the close-registration endpoint (or just
invoke the CLI themselves with the bytes we return).

This module exposes:
  - `build_finalize_command(package_id, election_object, root_hex)` — shows
    exactly what `sui client call` to run.
  - `publish_merkle_root_via_cli(...)` — actually execute it. Optional;
    prefer offline signing in production.
"""

from __future__ import annotations

import os
import shlex
import subprocess
from dataclasses import dataclass
from typing import Optional


@dataclass
class FinalizeCommand:
    cmd: list[str]

    def shell(self) -> str:
        return " ".join(shlex.quote(c) for c in self.cmd)


def build_finalize_command(
    package_id: str,
    election_object: str,
    root_hex: str,
    gas_budget: int = 50_000_000,
) -> FinalizeCommand:
    if not root_hex.startswith("0x"):
        root_hex = "0x" + root_hex
    cmd = [
        "sui",
        "client",
        "call",
        "--package",
        package_id,
        "--module",
        "election",
        "--function",
        "finalize_registration",
        "--args",
        election_object,
        root_hex,
        "--gas-budget",
        str(gas_budget),
        "--json",
    ]
    return FinalizeCommand(cmd)


def publish_merkle_root_via_cli(
    package_id: str,
    election_object: str,
    root_hex: str,
    gas_budget: int = 50_000_000,
    check: bool = True,
) -> subprocess.CompletedProcess:
    """Runs `sui client call finalize_registration`. Raises CalledProcessError
    on failure when check=True. Returns CompletedProcess with stdout = JSON."""
    fc = build_finalize_command(package_id, election_object, root_hex, gas_budget)
    return subprocess.run(
        fc.cmd, capture_output=True, text=True, check=check
    )


def package_id_from_env() -> Optional[str]:
    return os.getenv("PACKAGE_ID")
