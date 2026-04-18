"""GET /api/elections/{election_id}/commitments — public commitment list."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..registry import Registry

router = APIRouter(tags=["commitments"])


class CommitmentsResponse(BaseModel):
    election_id: str
    count: int
    commitments: list[str]


@router.get(
    "/elections/{election_id}/commitments",
    response_model=CommitmentsResponse,
    summary="List all commitments registered in an election (for auditing/rebuilding the Merkle tree)",
)
async def list_commitments(election_id: str, request: Request) -> CommitmentsResponse:
    registry: Registry = request.app.state.registry
    commits = await registry.list_commitments(election_id)
    return CommitmentsResponse(
        election_id=election_id, count=len(commits), commitments=commits
    )
