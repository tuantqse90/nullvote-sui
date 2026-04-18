# NullVote — Working Plan

Actionable day-by-day checklist derived from [`TIMELINE.md`](./TIMELINE.md). Tick boxes as you go. If a checkpoint fails, trigger the matching fallback in [`INIT_PROMPT.md §8`](../INIT_PROMPT.md).

**Start date:** _TBD — fill in when Day 1 starts_
**Hard floor:** working ZK proof + on-chain verification + tally by end of Day 6.

See also: [`CLAUDE.md`](../CLAUDE.md) for conventions · [`INIT_PROMPT.md`](../INIT_PROMPT.md) for spec · [`ARCHITECTURE.md`](./ARCHITECTURE.md) for data flows.

---

## Day 1 — Foundation & Cross-language Crypto

**North star:** Poseidon(`[1, 2]`) matches `0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a` in Circom, JS, and Python. If it doesn't match — STOP, debug, don't proceed.

- [ ] Repo skeleton exists (already done via `scaffold.sh` — verify dirs: `circuits/ move/ backend/ frontend/ docs/`)
- [ ] `git init && git add . && git commit -m 'chore: initial scaffold'`
- [ ] `cd circuits && npm install` — pulls circomlib, snarkjs 0.7.x, poseidon-lite, ts-node
- [ ] Install circom 2.1.x: `cargo install --git https://github.com/iden3/circom.git`
- [ ] Write `circuits/scripts/test_vectors.ts` — JS Poseidon test
- [ ] Write `backend/tests/test_poseidon.py` — Python Poseidon test (`pip install circomlib-py`)
- [ ] Write `circuits/tests/poseidon_test.circom` — minimal Circom test
- [ ] Download ptau: `wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau -O circuits/build/pot12.ptau`
- [ ] All three hashes match canonical value → green
- [ ] Commit: `git commit -am 'test: poseidon cross-lang vectors'`

**Checkpoint (EOD):** `npm test` green in `circuits/`, `pytest` green in `backend/`, canonical hash matches in all 3 langs.
**Fallback:** Poseidon mismatch → STOP, debug before Day 2. This is foundational.

**Key refs:** [`CLAUDE.md` Poseidon parameters](../CLAUDE.md) · [`INIT_PROMPT.md §6.1`](../INIT_PROMPT.md)

---

## Day 2 — Circuit Implementation

**North star:** `snarkjs groth16 verify verification_key.json public.json proof.json` returns `OK` for a valid vote proof.

- [ ] Implement `circuits/circuits/merkle.circom` — `MerkleTreeChecker(8)` template
- [ ] Implement `circuits/circuits/vote.circom` — all 6 constraints from [`INIT_PROMPT.md §5`](../INIT_PROMPT.md)
  - [ ] `pk == Poseidon(sk)`
  - [ ] `C == Poseidon(pk, r)`
  - [ ] `merkle_verify(C, path, indices) == root`
  - [ ] `nullifier == Poseidon(sk, election_id)`
  - [ ] `vote === vote_public`
  - [ ] `vote < num_candidates`
- [ ] `bash scripts/compile.sh` — r1cs + wasm + sym generated
- [ ] `bash scripts/setup.sh` — Phase 2 contribution → `vote_final.zkey`
- [ ] Export `verification_key.json`
- [ ] Write `circuits/inputs/sample_input.json` with valid test vector
- [ ] `snarkjs groth16 fullprove ...` → generates proof in <5s
- [ ] `snarkjs groth16 verify ...` → returns OK
- [ ] Commit: `git commit -am 'feat(circuit): vote + merkle circuits with Phase 2 setup'`

**Checkpoint (EOD):** circuit compiles warning-free, sample proof <5s, verify green.
**Fallback:** broken by EOD → switch to Semaphore v4 fork, update `THREAT_MODEL.md §2.1`.

**Key refs:** [`ARCHITECTURE.md §1.1`](./ARCHITECTURE.md) · [`INIT_PROMPT.md §5, §6, §7`](../INIT_PROMPT.md)

---

## Day 3 — SUI Move Module

**North star:** cast valid proof on testnet → success; cast same nullifier twice → `EDoubleVote` error.

- [ ] Write `move/sources/vk.move` — vk bytes as constants (from Day 2 `verification_key.json`)
- [ ] Write `scripts/export_vk.ts` — snarkjs vk.json → SUI BCS bytes (mind Fq2 c1/c0 swap — see [`ARCHITECTURE.md §3`](./ARCHITECTURE.md))
- [ ] Write `move/sources/election.move`:
  - [ ] `Election` shared struct with `merkle_root`, `nullifiers: Table`, `tally`, `phase`, `end_time`, `vk_bytes`
  - [ ] `create_election`, `finalize_registration`, `cast_vote`, `get_tally`
  - [ ] Errors: `EInvalidProof`, `EDoubleVote`, `EVotingEnded`, `ENotAdmin`, `EWrongPhase`
- [ ] Write `move/sources/events.move` — `ElectionCreated`, `RegistrationClosed`, `VoteCast`, `ElectionClosed`
- [ ] Write `move/tests/election_tests.move` — valid-proof test, double-vote test, expired-election test
- [ ] `sui move test` → green
- [ ] `sui move build` → green
- [ ] `sui client publish --gas-budget 100000000` — note package ID, save to `.env.example`
- [ ] CLI test: create election → cast valid proof → verify tally incremented
- [ ] CLI test: replay same nullifier → `EDoubleVote`
- [ ] Commit: `git commit -am 'feat(move): election module with groth16 verification'`

**Checkpoint (EOD):** Move tests green, testnet package ID recorded, CLI E2E for valid + invalid paths works.
**Risk flag:** Fq2 c0/c1 ordering for B coords — budget 1–2 h debugging.

**Key refs:** [`ARCHITECTURE.md §3 (Proof Format on SUI)`](./ARCHITECTURE.md) · [`INIT_PROMPT.md §5 (on-chain flow)`](../INIT_PROMPT.md)

---

## Day 4 — Backend API

**North star:** register 10 voters via curl → close registration → Merkle root published on-chain via `finalize_registration`.

- [ ] FastAPI skeleton: `backend/src/main.py` with routers wired
- [ ] `backend/src/merkle.py` — `build_merkle_tree`, `get_proof` (uses circomlib-py Poseidon)
- [ ] `backend/src/registry.py` — SQLAlchemy + aiosqlite, schema per [`ARCHITECTURE.md §1.3`](./ARCHITECTURE.md)
- [ ] `backend/src/sui_client.py` — pysui client, `publish_merkle_root(election_id, root)`
- [ ] Endpoints:
  - [ ] `POST /api/elections/:id/register`
  - [ ] `GET  /api/elections/:id/commitments`
  - [ ] `GET  /api/elections/:id/merkle-tree`
  - [ ] `GET  /api/elections/:id/merkle-proof?commitment=<hex>`
  - [ ] `POST /api/elections/:id/close-registration` (admin auth)
- [ ] Integration test: register 10 voters → build tree → verify Merkle proof locally via poseidon-lite
- [ ] Deploy backend (Railway / Fly.io) OR document local-run plan for demo
- [ ] Commit: `git commit -am 'feat(backend): registration API + merkle builder'`

**Checkpoint (EOD):** 10-voter E2E via curl works, API p95 <500 ms, root on-chain.

**Key refs:** [`ARCHITECTURE.md §1.3, §2.1`](./ARCHITECTURE.md) · [`INIT_PROMPT.md §5 Phase 2`](../INIT_PROMPT.md)

---

## Day 5 — Frontend Core: Register + Vote

**North star:** in the browser, user connects wallet → registers → (admin closes via CLI) → votes → tally increments on explorer.

- [ ] Vite + React + TS + Tailwind + shadcn/ui initialized
- [ ] Configure design tokens per [`DESIGN_SYSTEM.md §2, §3`](./DESIGN_SYSTEM.md) in `src/styles/globals.css`
- [ ] Install fonts: `@fontsource/jetbrains-mono`, `@fontsource/space-grotesk`
- [ ] `@mysten/wallet-kit` provider + `<WalletGate>` in `App.tsx`
- [ ] `src/lib/crypto.ts`:
  - [ ] `deriveSk(signature)`, `computeCommitment(sk, r)`, `computeNullifier(sk, electionId)`
- [ ] `src/workers/prover.worker.ts` — snarkjs fullProve, Fq2 swap to SUI format
- [ ] `src/lib/prover.ts` — typed Web Worker wrapper `generateProof(inputs): Promise<SuiProof>`
- [ ] `src/lib/sui.ts` — SuiClient + MoveCall helpers
- [ ] `src/pages/Register.tsx` — wallet sign → `POST /register`
- [ ] `src/pages/Vote.tsx` — fetch Merkle proof → worker → MoveCall `cast_vote`
- [ ] E2E in browser: register → (CLI close) → vote → nullifier on explorer
- [ ] Commit: `git commit -am 'feat(frontend): register + vote flow with web worker prover'`

**Checkpoint (EOD):** browser E2E works, proof gen <5 s on laptop, Move call succeeds, nullifier appears on Sui explorer.
**Fallback:** wallet integration broken → mock wallet with hardcoded signature for demo (document in `THREAT_MODEL.md`).

**Key refs:** [`ARCHITECTURE.md §1.4, §2.2`](./ARCHITECTURE.md) · [`CLAUDE.md §Don't do`](../CLAUDE.md) (Web Worker requirement, no `console.log(proof)`)

---

## Day 6 — Realtime Tally + Admin + Polish

**North star:** open Results page in one tab, cast vote in another — tally animates within 2 s. Vercel URL live.

- [ ] `src/lib/subscribe.ts` — `subscribeToVotes(electionId, onVote)` via `client.subscribeEvent`
- [ ] `src/pages/Results.tsx` — initial state from `getObject`, live updates, animated flip counter per [`DESIGN_SYSTEM.md §7`](./DESIGN_SYSTEM.md)
- [ ] `src/pages/Admin.tsx` — create election form, close registration button, active elections table
- [ ] `src/pages/Home.tsx` — hero with "# NULL\*VOTE" repeated-with-decreasing-opacity effect
- [ ] `<ProofProgress>` — block-character progress bar during proof gen
- [ ] `<LiveTally>`, `<WalletGate>`, error/empty/loading states
- [ ] Responsive pass (mobile + tablet)
- [ ] Deploy to Vercel, set `VITE_PACKAGE_ID`, `VITE_BACKEND_URL` env vars
- [ ] Practice demo run end-to-end per [`DEMO_SCRIPT.md §1`](./DEMO_SCRIPT.md)
- [ ] Commit: `git commit -am 'feat(frontend): realtime tally + admin UI + polish'`

**Checkpoint (EOD):** Vercel URL green, realtime tally works, admin flow works, no console errors, design on-brand.
**Fallback:** event sub unreliable → 2 s polling, note in README.

**Hard floor:** if this day ends with no working Vercel demo — cut admin UI (use CLI) and ship whatever's green.

---

## Day 7 — Demo Video, Pitch, Submission

**North star:** submission form filled, no code commits needed.

- [ ] Record 3-minute demo video per [`DEMO_SCRIPT.md §1`](./DEMO_SCRIPT.md). Upload to YouTube (unlisted) or Vercel.
- [ ] Finalize pitch deck from [`PITCH.md`](./PITCH.md). Export to PDF, keep <2 MB.
- [ ] Polish `README.md`: hero banner, quickstart verified from scratch, architecture diagram, tech badges, video embed, license.
- [ ] Finalize `THREAT_MODEL.md`: every limitation, every assumption, every out-of-scope item.
- [ ] Pre-submit checks:
  - [ ] `grep -ri "privkey\|API_KEY\|secret" --exclude-dir=node_modules .` → no hits
  - [ ] All `.env` gitignored, `.env.example` present for backend + frontend
  - [ ] CI green on `main`
  - [ ] README renders correctly on GitHub
  - [ ] Vercel URL live, backend URL live, package ID in README matches testnet
  - [ ] Quickstart takes <5 min for a stranger to replicate
- [ ] Fill submission form: GitHub URL, Vercel URL, demo video URL, pitch PDF
- [ ] Commit: `git commit -am 'docs: submission-ready'`

**Checkpoint (EOD):** submission submitted. Sleep.

---

## Buffer Strategy (if behind)

Trigger in this order if any day slips >50 %:

| Cut | Saves | Impact |
|---|---|---|
| Skip Admin UI (use CLI) | 0.5 d | Demo narrative weaker |
| Skip realtime events (polling) | 0.5 d | Demo less impressive |
| Reduce Merkle depth 8 → 4 | 0.25 d | 16 voter cap (fine for demo) |
| Semaphore v4 fork instead of custom circuit | 2 d | Pitch must be adjusted |
| Skip Vercel (local demo only) | 0.5 d | Judge can't self-verify |

**Never cut:** ZK proof generation · nullifier uniqueness check · at least one working E2E path.

---

## Daily Rituals

**Morning (15 min):**
1. Re-read today's section in this file.
2. Pick 3 must-do tasks for the day.
3. Set 90-minute focused work blocks.

**Evening (15 min):**
1. Tick completed boxes above.
2. `git commit && git push`.
3. If behind: decide cut from Buffer Strategy *tonight*, not tomorrow morning.

---

*End of PLAN.md — go build.*
