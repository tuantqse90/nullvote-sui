"""FastAPI entrypoint for the NullVote backend.

Run (dev):
    uvicorn src.main:app --reload

Configuration via env (see `.env.example`):
    DATABASE_URL          default: sqlite+aiosqlite:///./data/voters.db
    HOST / PORT / LOG_LEVEL
    PACKAGE_ID / SUI_RPC_URL (consumed by src.sui_client)
"""

from __future__ import annotations

import os
import pathlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import close, commitments, register, tree
from .registry import Registry


def _default_db_url() -> str:
    data_dir = pathlib.Path(__file__).resolve().parent.parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{data_dir / 'voters.db'}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_db_url())


@asynccontextmanager
async def lifespan(app: FastAPI):
    registry = Registry(DATABASE_URL)
    await registry.create_all()
    app.state.registry = registry
    try:
        yield
    finally:
        await registry.close()


app = FastAPI(
    title="NullVote Backend",
    description="Voter registration coordinator + Merkle proof service.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register.router, prefix="/api")
app.include_router(commitments.router, prefix="/api")
app.include_router(tree.router, prefix="/api")
app.include_router(close.router, prefix="/api")


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "nullvote-backend"}
