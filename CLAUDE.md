# CLAUDE.md — NullVote Project Memory

Project context for Claude Code CLI. Read this before every session.

---

## Docs index

Read in this order when onboarding or resuming work:

1. [`INIT_PROMPT.md`](./INIT_PROMPT.md) — authoritative spec: mission, locked decisions, invariants, anti-patterns, crypto flow
2. [`README.md`](./README.md) — public-facing overview, quickstart, demo links
3. [`docs/PLAN.md`](./docs/PLAN.md) — **working plan** — actionable daily checklist, always check current day first
4. [`docs/TIMELINE.md`](./docs/TIMELINE.md) — 7-day build plan with checkpoints and fallback triggers
5. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — technical deep-dive, data flows, proof byte layout
6. [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) — security properties and honest limitations
7. [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) — **authoritative design reference**, tokens extracted from [payy.network](https://payy.network/); Payy is the visual standard
8. [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) — demo video narrative and judge Q&A prep
9. [`docs/PITCH.md`](./docs/PITCH.md) — pitch deck outline (8–10 slides)

**Quick lookup:** stuck on crypto → `INIT_PROMPT.md §6` + `ARCHITECTURE.md §3`; stuck on schedule → `PLAN.md`; stuck on visual → `DESIGN_SYSTEM.md`.

---

## Project identity

- **Name:** NullVote
- **Owner:** Tun (NullShift Labs)
- **Type:** Hackathon MVP, 7-day build
- **Tagline:** "Anonymous DAO voting on SUI via ZK proofs"
- **License:** MIT
- **Repo:** https://github.com/tuantqse90/nullvote-sui

---

## Stack summary

| Layer | Tech | Version |
|---|---|---|
| Circuit | Circom + snarkjs + circomlib | 2.1.x / 0.7.x / latest |
| Proof system | Groth16 | BN254 curve |
| On-chain | SUI Move | testnet |
| Backend | Python FastAPI | 3.12 |
| Frontend | React + Vite + TS | 18 / 5 / 5 |
| Styling | Tailwind + shadcn/ui | latest |
| Wallet | @mysten/wallet-standard, Sui Wallet Kit | latest |

---

## Naming conventions

- **Private inputs:** `snake_case` (`sk`, `r`, `merkle_path`)
- **Public inputs in TS:** `camelCase` (`electionId`, `merkleRoot`)
- **Public inputs in Move:** `snake_case` (`election_id`, `merkle_root`)
- **Public inputs in circuit:** `snake_case` (Circom convention)
- **Hex strings:** always `0x`-prefixed, lowercase, padded to 32 bytes for field elements
- **Nullifiers:** 32-byte hex string in all APIs

---

## Critical invariants (from INIT_PROMPT.md §6)

1. Poseidon hashes MUST match across Circom / JS / Python
2. Nullifier uses `sk`, NEVER `pk`
3. `sk` never leaves client device
4. Circuit enforces `vote === vote_public`
5. Circuit enforces `vote < num_candidates`
6. On-chain root is source of truth
7. Nullifier uniqueness enforced on-chain
8. All field ops mod BN254 scalar prime

**Field prime constant (memorize):**
`r = 21888242871839275222246405745257275088548364400416034343698204186575808495617`

---

## Poseidon parameters (authoritative)

- Curve: BN254 scalar field
- Variant: `poseidon()` from circomlib (NOT poseidon2-permutation or poseidon-bls)
- t (state width): `nInputs + 1`; capacity element is always 0
- Rounds: `N_ROUNDS_F = 8` (4 full + 4 full), `N_ROUNDS_P[t-2]` partial (for t=3: 57)
- **JS:** `poseidon-lite` — `poseidon2([a,b])`, `poseidon3([a,b,c])`, …
- **Circom:** `include "circomlib/circuits/poseidon.circom"` → `component h = Poseidon(n);`
- **Python:** native port in `backend/src/crypto/poseidon.py` — `poseidon_hash([a, b])`.
  - Constants source: `circomlibjs/src/poseidon_constants.json`
  - Exported via `node circuits/scripts/export_poseidon_constants.js` → writes `backend/src/crypto/poseidon_constants.json`
  - **Regenerate whenever `circomlibjs` is upgraded.** No pip package matches — do NOT add `circomlib-py` back to `pyproject.toml`.
- **Canonical test vectors (all 3 langs must match):**
  - `Poseidon([1, 2])    == 0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a`
  - `Poseidon([3, 4])    == 0x20a3af0435914ccd84b806164531b0cd36e37d4efb93efab76913a93e1f30996`
  - `Poseidon([1, 2, 3]) == 0x0e7732d89e6939c0ff03d5e58dab6302f3230e269dc5b968f725df34ab36d732`

**Validation commands:**
- JS: `cd circuits && npm test`
- Python: `cd backend && source .venv/bin/activate && pytest tests/test_poseidon.py`
- Circom: `cd circuits && circom tests/poseidon_test.circom --r1cs --wasm --sym -o build/ && node build/poseidon_test_js/generate_witness.js build/poseidon_test_js/poseidon_test.wasm <input.json> build/poseidon_test.wtns`

If any mismatch on these canonical values, STOP immediately — commitments, nullifiers, and Merkle inclusion proofs all break silently when hashes diverge.

**Known bug source:** MDS matrix indexing in the port is `M[i][j] * state[j]` (row-major), NOT `M[j][i]`. Transposing silently produces wrong hashes that still look plausible.

---

## File conventions

- All doc files: Markdown, UTF-8, LF line endings
- Code: Prettier default (2 spaces, single quotes in TS, no semicolons in TS)
- Python: Black default (4 spaces, double quotes)
- Move: Sui Move style guide (4 spaces, `snake_case`)
- Circom: 4 spaces, template names `PascalCase`, signals `snake_case`

---

## Commit message style

Conventional commits:
- `feat(circuit): add merkle verifier`
- `fix(move): nullifier collision check`
- `chore: update deps`
- `docs: threat model`
- `test: poseidon cross-lang vectors`

Scope tags: `circuit`, `move`, `backend`, `frontend`, `docs`, `ci`.

---

## Deployment topology

Live at [nullvote.nullshift.sh](https://nullvote.nullshift.sh) (testnet).

Shared Hostinger VPS `76.13.183.138` (also hosts football-predict, tasco-drive, etc.). One Caddy reverse-proxy fronts every subdomain:

- `nullvote.nullshift.sh/api/*`, `/docs*`, `/openapi.json`, `/health` → `localhost:8600` (backend Docker container `nullvote-backend`)
- everything else → static file server on `/opt/nullvote/frontend-dist/` (Caddy-served, no container)

Port reservation on the shared VPS:
- 8600 = backend (bound to 127.0.0.1)
- 3600 = reserved for NullVote, currently unused (frontend is static)

Deploy with `bash infra/deploy/deploy.sh` — script is idempotent, does Cloudflare DNS upsert, rsync, `docker compose up`, Caddyfile merge, smoke tests. Secrets live in `infra/secrets/vps.env` (gitignored).

## Environment variables

Backend:
- `SUI_RPC_URL` — testnet RPC
- `SUI_ADMIN_PRIVKEY` — admin Ed25519 key (NEVER commit)
- `PACKAGE_ID` — deployed Move package ID
- `DATABASE_URL` — SQLite path

Frontend:
- `VITE_SUI_NETWORK=testnet`
- `VITE_PACKAGE_ID=<from deploy>`
- `VITE_BACKEND_URL=http://localhost:8000`

Use `.env.example` for templates. `.env` in `.gitignore`.

---

## Testing commands

```bash
# Circuit
cd circuits && npm test                    # Poseidon + circuit tests
cd circuits && bash scripts/test_proof.sh  # E2E proof gen + verify

# Move
cd move && sui move test                   # Unit tests
cd move && sui move build                  # Compile check

# Backend
cd backend && pytest                       # All tests
cd backend && pytest tests/test_merkle.py  # Specific

# Frontend
cd frontend && npm run typecheck
cd frontend && npm run build
cd frontend && npm run dev                 # Local dev server

# Full E2E (manual)
# 1. Start backend: uvicorn src.main:app --reload
# 2. Deploy Move: bash move/scripts/deploy.sh
# 3. Start frontend: npm run dev
# 4. Open localhost:5173, test register → vote → tally
```

---

## Don't do (project-specific)

- Don't commit `vote_final.zkey` (too large — gitignore, host externally)
- Don't commit `.env` files
- Don't hardcode `PACKAGE_ID` — always env var
- Don't log signature bytes (`wallet.sign()` output)
- Don't log `sk` values even in dev
- Don't use `console.log(proof)` in frontend — could leak timing info
- Don't skip Poseidon cross-lang tests
- Don't use `any` type in TS
- Don't bypass wallet signature for "dev mode" shortcuts — always use real derivation
- Don't deploy to mainnet (testnet only for MVP)

---

## Do (project-specific)

- Do write docstrings for every circuit template
- Do write Move test for every public function
- Do use `sui::object::id_address` for election_id derivation
- Do keep circuit file size small (one template per file)
- Do commit proving key SHA256 hash in README for reproducibility
- Do add `.gitattributes` for LFS on `.zkey` and `.wasm` if needed
- Do use Web Worker for ALL proof operations (never main thread)
- Do show loading state for every async operation (proof gen especially)
- Do validate all backend inputs with Pydantic
- Do use SUI event subscription (`client.subscribeEvent`) for live tally

---

## Style-specific (Payy is the visual standard)

[`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) is the single source of truth — tokens extracted directly from [payy.network](https://payy.network/) CSS (2026-04-18). When designing anything, open Payy in a tab and copy.

Quick reference (corrected — earlier drafts had these wrong):

- Background: pure black `#000` · elevated `#161616` · raised `#242424` · high `#363636`
- Text: white `#FFF` · secondary `#E9E9E9` · tertiary `#D9D9D9`
- **Accent: electric lime `#E0FF32`** (rgb 224 255 50) — NOT mint green. Text on lime is **always `#000`** (see Tasco Drive precedent)
- **Display font: Geist** (free Steradian alt) or Inter variable — sans-serif, NOT monospace
- **Body font: Inter** variable (400/500/700)
- Mono (`JetBrains Mono`) reserved for hashes/addresses/nullifiers only
- Hero: `clamp(100px, 18vw, 220px)`, `letter-spacing: -0.08em`, `line-height: 0.8`
- Radius: **rounded** — buttons 18px, cards 24px, feature cards 36–48px. NOT sharp corners.
- Block character `█` for live indicators, phase markers, progress bars
- Censored data: `0x1a2b...████...5f6e` (middle redacted, monospace)

**Accent discipline:** `var(--accent)` should appear <10 times across the whole app. One CTA per screen, live dots, counter increments. Never for body text or large surfaces.

---

## When stuck

1. Check `INIT_PROMPT.md` §6 (invariants) and §7 (anti-patterns)
2. Check `ARCHITECTURE.md` for flow details
3. Check Semaphore v4 docs as reference (our scheme is similar)
4. Check SUI examples: https://github.com/MystenLabs/sui/tree/main/examples
5. Ask in NullShift Discord (if exists)

---

## Fallback triggers (from INIT_PROMPT.md §8)

Monitor at end of each day:
- Day 2: Circuit compiles? → if no, switch to Semaphore fork
- Day 4: Proof gen < 5s? → if no, reduce depth 8 → 4
- Day 5: Wallet works? → if no, mock wallet for demo
- Day 6: Events fire? → if no, polling fallback

**Don't panic, switch.** Hackathon ships > perfect architecture.
