"""POST /api/elections/{election_id}/close-registration

Returns the Merkle root + the exact `sui client call` command an admin needs to
run to publish the root on-chain (module-level `finalize_registration`). We
deliberately do NOT execute the call server-side by default: that would
require the backend to hold a signing key, which violates INIT_PROMPT.md's
"no admin keys in server" directive.

Set `execute=true` and configure `PACKAGE_ID` + an authenticated `sui` CLI on
the same host to have the server dispatch the transaction itself. The admin
key is picked up from the local `sui client` config.
"""

from __future__ import annotations

import json
import os
import subprocess

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from ..merkle import build_merkle_tree
from ..registry import Registry
from ..sui_client import build_finalize_command

router = APIRouter(tags=["admin"])


def _hex_to_int(h: str) -> int:
    h = h.removeprefix("0x").removeprefix("0X")
    return int(h, 16) if h else 0


def _int_to_hex32(n: int) -> str:
    return f"0x{n:064x}"


class CloseRegistrationResponse(BaseModel):
    election_id: str
    election_object: str
    package_id: str
    merkle_root: str
    voter_count: int
    cli_command: str
    executed: bool = False
    tx_digest: str | None = None


@router.post(
    "/elections/{election_id}/close-registration",
    response_model=CloseRegistrationResponse,
    summary="Compute the Merkle root and (optionally) publish it on-chain via sui CLI.",
)
async def close_registration(
    election_id: str,
    request: Request,
    election_object: str = Query(
        ..., description="Sui object ID of the shared Election created on-chain"
    ),
    execute: bool = Query(
        False, description="If true, run `sui client call` locally. Requires PACKAGE_ID env + authenticated sui CLI."
    ),
) -> CloseRegistrationResponse:
    registry: Registry = request.app.state.registry
    commits = await registry.list_commitments(election_id)
    if not commits:
        raise HTTPException(400, "no commitments registered for this election")

    leaves = [_hex_to_int(c) for c in commits]
    tree = build_merkle_tree(leaves)
    root_hex = _int_to_hex32(tree.root)

    package_id = os.getenv("PACKAGE_ID", "<PACKAGE_ID not set>")
    cmd = build_finalize_command(package_id, election_object, root_hex)

    response = CloseRegistrationResponse(
        election_id=election_id,
        election_object=election_object,
        package_id=package_id,
        merkle_root=root_hex,
        voter_count=len(commits),
        cli_command=cmd.shell(),
    )

    if execute:
        if package_id.startswith("<"):
            raise HTTPException(500, "PACKAGE_ID env var not set — cannot execute")
        result = subprocess.run(
            cmd.cmd, capture_output=True, text=True, check=False
        )
        if result.returncode != 0:
            raise HTTPException(
                500, f"sui client call failed: {result.stderr.strip()[:400]}"
            )
        try:
            parsed = json.loads(result.stdout)
            response.tx_digest = parsed.get("digest")
        except json.JSONDecodeError:
            pass
        response.executed = True

    return response
