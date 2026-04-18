"""POST /api/elections/{election_id}/register — voter registration endpoint."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..registry import Registry

router = APIRouter(tags=["registration"])

SUI_ADDR = r"^0x[0-9a-fA-F]{64}$"
HEX_FIELD = r"^0x[0-9a-fA-F]{1,64}$"


class RegisterRequest(BaseModel):
    wallet_addr: str = Field(pattern=SUI_ADDR)
    commitment: str = Field(pattern=HEX_FIELD)


class RegisterResponse(BaseModel):
    ok: bool
    election_id: str
    commitment: str


@router.post(
    "/elections/{election_id}/register",
    response_model=RegisterResponse,
    summary="Register a commitment for a voter in the given election",
)
async def register_voter(
    election_id: str, req: RegisterRequest, request: Request
) -> RegisterResponse:
    registry: Registry = request.app.state.registry
    commitment = req.commitment.lower()
    wallet = req.wallet_addr.lower()

    existing = await registry.find_by_commitment(election_id, commitment)
    if existing is not None:
        raise HTTPException(
            409, "commitment already registered for this election"
        )

    try:
        await registry.add_commitment(election_id, wallet, commitment)
    except Exception as e:  # SQLAlchemy raises IntegrityError for duplicate (election, wallet)
        raise HTTPException(409, f"registration failed: {e.__class__.__name__}")

    return RegisterResponse(ok=True, election_id=election_id, commitment=commitment)
