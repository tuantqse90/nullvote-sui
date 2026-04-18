"""SQLite-backed voter registry (commitments per election).

Intentionally minimal: one table, no separate Election record. Canonical election
state lives on-chain — backend is a coordinator for off-chain commitment
collection during the Registration phase, plus a Merkle-proof lookup service
during Voting.

Commitments are stored as lowercase `0x…` hex strings (Poseidon output, fits in
32 bytes). Wallet address is Sui-format 32-byte hex.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import UniqueConstraint, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Commitment(Base):
    __tablename__ = "commitments"

    election_id: Mapped[str] = mapped_column(primary_key=True)
    wallet_addr: Mapped[str] = mapped_column(primary_key=True)
    commitment: Mapped[str]
    registered_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("election_id", "commitment", name="uq_election_commitment"),
    )


class Registry:
    """Async handle over an aiosqlite-backed store."""

    def __init__(self, db_url: str) -> None:
        self._engine = create_async_engine(db_url, future=True)
        self._Session: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self._engine, expire_on_commit=False
        )

    async def create_all(self) -> None:
        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def close(self) -> None:
        await self._engine.dispose()

    async def add_commitment(
        self, election_id: str, wallet_addr: str, commitment: str
    ) -> None:
        async with self._Session() as session:
            session.add(
                Commitment(
                    election_id=election_id,
                    wallet_addr=wallet_addr,
                    commitment=commitment,
                )
            )
            await session.commit()

    async def list_commitments(self, election_id: str) -> list[str]:
        """Returns commitments in registration order (Merkle leaf ordering)."""
        async with self._Session() as session:
            stmt = (
                select(Commitment.commitment)
                .where(Commitment.election_id == election_id)
                .order_by(Commitment.registered_at, Commitment.wallet_addr)
            )
            result = await session.execute(stmt)
            return [row[0] for row in result.all()]

    async def count(self, election_id: str) -> int:
        async with self._Session() as session:
            stmt = select(Commitment).where(Commitment.election_id == election_id)
            result = await session.execute(stmt)
            return len(result.all())

    async def find_by_commitment(
        self, election_id: str, commitment: str
    ) -> Optional[Commitment]:
        async with self._Session() as session:
            stmt = select(Commitment).where(
                Commitment.election_id == election_id,
                Commitment.commitment == commitment,
            )
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
