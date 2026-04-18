"""Merkle tree + inclusion-proof endpoints.

  GET /api/elections/{id}/merkle-tree                      → root + leaves
  GET /api/elections/{id}/merkle-proof?commitment=0x…      → circuit-shaped proof
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..merkle import build_merkle_tree
from ..registry import Registry

router = APIRouter(tags=["merkle"])

HEX_FIELD = r"^0x[0-9a-fA-F]{1,64}$"


def _hex_to_int(h: str) -> int:
    h = h.removeprefix("0x").removeprefix("0X")
    return int(h, 16) if h else 0


def _int_to_hex32(n: int) -> str:
    return f"0x{n:064x}"


class TreeResponse(BaseModel):
    election_id: str
    depth: int
    root: str
    leaf_count: int
    leaves: list[str]


@router.get(
    "/elections/{election_id}/merkle-tree",
    response_model=TreeResponse,
    summary="Return the current Merkle tree snapshot (root + leaves).",
)
async def get_tree(election_id: str, request: Request) -> TreeResponse:
    registry: Registry = request.app.state.registry
    commits = await registry.list_commitments(election_id)
    leaves_int = [_hex_to_int(c) for c in commits]
    tree = build_merkle_tree(leaves_int)
    return TreeResponse(
        election_id=election_id,
        depth=tree.depth,
        root=_int_to_hex32(tree.root),
        leaf_count=len(tree.leaves),
        leaves=[_int_to_hex32(x) for x in tree.leaves],
    )


class MerkleProofResponse(BaseModel):
    election_id: str
    commitment: str
    root: str
    path_elements: list[str] = Field(description="Sibling hashes level-by-level")
    path_indices: list[int] = Field(description="0 = left child, 1 = right child, per level")


@router.get(
    "/elections/{election_id}/merkle-proof",
    response_model=MerkleProofResponse,
    summary="Authentication path for a specific commitment.",
)
async def get_proof(
    election_id: str,
    request: Request,
    commitment: str = Query(..., pattern=HEX_FIELD),
) -> MerkleProofResponse:
    registry: Registry = request.app.state.registry
    commits = await registry.list_commitments(election_id)
    leaves_int = [_hex_to_int(c) for c in commits]
    target = _hex_to_int(commitment)
    try:
        idx = leaves_int.index(target)
    except ValueError:
        raise HTTPException(404, "commitment not registered for this election")

    tree = build_merkle_tree(leaves_int)
    proof = tree.get_proof(idx)
    return MerkleProofResponse(
        election_id=election_id,
        commitment=_int_to_hex32(target),
        root=_int_to_hex32(proof.root),
        path_elements=[_int_to_hex32(x) for x in proof.path_elements],
        path_indices=proof.path_indices,
    )
