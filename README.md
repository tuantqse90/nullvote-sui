# NullVote

> Anonymous DAO governance voting on SUI via zero-knowledge proofs.

```
█ STATUS: Hackathon MVP · 2026
```

## What is this?

NullVote lets DAOs run on-chain votes where **voter identity is cryptographically hidden**, but vote counts remain publicly verifiable. Voters prove they're in the registered set using Groth16 zero-knowledge proofs over a Merkle tree. Nullifiers prevent double-voting. All verification happens natively on SUI via the `sui::groth16` module.

**Why:** Every DAO vote on-chain today is a permanent data leak. Whales track small voters. Controversial proposals expose dissenters. NullVote separates the vote from the voter.

## Demo

- **Live app:** [nullvote.nullshift.sh](https://nullvote.nullshift.sh) (testnet, deployed on Hostinger VPS)
- **Video:** [3-min demo](https://youtube.com/...) _(recording pending Day 7)_
- **Explorer:** [SUI testnet package](https://suiscan.xyz/testnet/object/0x669ec8fee063206af29be9407865b5e2698f0f8f604b568c97c4e296acdb63be)

## Quickstart (local)

### Prereqs

- Node 20+
- Python 3.12+
- Sui CLI (`brew install sui` or [install docs](https://docs.sui.io/guides/developer/getting-started/sui-install))
- Circom 2.1.x (`cargo install --git https://github.com/iden3/circom.git`)

### Setup

```bash
git clone https://github.com/<you>/nullvote-sui
cd nullvote-sui

# 1. Circuit
cd circuits
npm install
bash scripts/compile.sh       # ~2 min
bash scripts/setup.sh          # ~5 min (Phase 2 trusted setup)

# 2. Move module
cd ../move
sui move build
sui client publish --gas-budget 100000000   # testnet
# Save the package ID, update backend/.env and frontend/.env

# 3. Backend
cd ../backend
pip install -e .
cp .env.example .env           # fill in SUI_ADMIN_PRIVKEY, PACKAGE_ID
uvicorn src.main:app --reload

# 4. Frontend (new terminal)
cd ../frontend
npm install
cp .env.example .env           # fill in VITE_PACKAGE_ID, VITE_BACKEND_URL
npm run dev
```

Visit `http://localhost:5173`.

### Test E2E

```bash
# Run full test suite
cd circuits && npm test
cd ../move && sui move test
cd ../backend && pytest
cd ../frontend && npm run test
```

## Architecture

Three layers:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   FRONTEND      │      │  CIRCUIT LAYER  │      │  ON-CHAIN (SUI) │
│  React + Vite   │─────▶│ Circom + snarkjs│─────▶│ Move + Groth16  │
│  Web Worker     │      │ BN254 + Poseidon│      │ Shared objects  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for detailed flow diagrams.

## Key design choices

- **Circom over Noir** — more battle-tested for voting circuits (Semaphore, MACI precedent)
- **Groth16 over PLONK** — native SUI verifier, smaller proofs (200 bytes)
- **Wallet-derived identity** — `sk = Poseidon(wallet.sign("NullVote:<election_id>"))`, no extra key management
- **Web Worker proofs** — client-side, non-blocking UI
- **Realtime tally** — SUI event subscription, no indexer needed
- **Public vote, anonymous voter** — simpler than encrypted votes, privacy property preserved via nullifier

## Security & limitations

We're explicit about what we do and don't guarantee. See [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).

**Guaranteed:** voter anonymity, double-vote prevention, eligibility, tally verifiability.

**Not guaranteed (roadmap):** receipt-freeness, coercion-resistance, censorship-resistance, post-quantum security.

## Tech stack

| Layer | Choice |
|---|---|
| Circuit | Circom 2.1.x + snarkjs + circomlib |
| Proof | Groth16 on BN254 |
| Hash | Poseidon |
| On-chain | SUI Move, testnet |
| Backend | Python FastAPI + SQLite |
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Wallet | @mysten/wallet-kit |
| Design | Payy-inspired (black + mint green + JetBrains Mono) |

## Project structure

```
nullvote-sui/
├── circuits/        # Circom circuits + proving/verifying keys
├── move/            # SUI Move module
├── backend/         # Python FastAPI admin service
├── frontend/        # React app
├── docs/            # ARCHITECTURE, THREAT_MODEL, TIMELINE, DESIGN_SYSTEM
├── CLAUDE.md        # Project memory for Claude Code CLI
└── README.md
```

## Roadmap

- **v0.1 (hackathon):** Single-choice voting, admin-managed registration, single-party trusted setup
- **v0.2:** MACI coordinator for receipt-freeness
- **v0.3:** zkLogin integration for Web2-grade UX
- **v0.4:** Multi-party trusted setup ceremony + security audit
- **v1.0:** Mainnet launch, weighted voting, delegation

## Credits

- Built by [Tun](https://nullshift.sh) at NullShift Labs
- Inspired by [Semaphore](https://docs.semaphore.pse.dev/), [MACI](https://privacy-scaling-explorations.github.io/maci/), and [Vocdoni](https://vocdoni.io/)
- Design language inspired by [Payy Network](https://payy.network/)
- Built on [SUI](https://sui.io/) with its native Groth16 verifier

## License

MIT — see [LICENSE](./LICENSE).

## Contact

- Twitter: [@_nullshift](https://twitter.com/_nullshift) (TBD)
- Email: hello@nullshift.sh (TBD)
- GitHub Issues for bugs & feature requests

---

*Built with █ by NullShift.*
