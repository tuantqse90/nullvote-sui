# NullVote — 7-Day Timeline

Day-by-day build plan with hard checkpoints. If a day's deliverable isn't green, trigger fallback per §8 of `INIT_PROMPT.md`.

**Assumption:** 8-10 focused hours per day. Adjust if you have less.

---

## Day 1 — Foundation & Cross-language Crypto

**Goal:** Poseidon works identically in Circom / JS / Python. Repo scaffolded.

**Tasks:**
1. Create repo structure per INIT_PROMPT.md §4
2. Initialize `circuits/`, `move/`, `backend/`, `frontend/` subprojects
3. Install dependencies (circom 2.1.x, snarkjs 0.7.x, circomlib)
4. Write `circuits/scripts/test_vectors.ts`:
   - Hash `[1, 2]` with `poseidon-lite` → assert matches canonical value
5. Write `backend/tests/test_poseidon.py`:
   - Hash `[1, 2]` with `circomlib-py` → assert matches same value
6. Write minimal `circuits/circuits/poseidon_test.circom`:
   - Single Poseidon(2) → compile → witness generation → compare output
7. Download Hermez Powers of Tau (`powersOfTau28_hez_final_12.ptau`)
8. Set up `.gitignore`, `.env.example`, README skeleton

**Checkpoint (end of day):**
- [ ] Cross-language Poseidon test vectors all match
- [ ] Repo pushes to GitHub without errors
- [ ] `npm test` green in `circuits/`
- [ ] `pytest` green in `backend/`

**Fallback trigger:** If Poseidon mismatch by end of Day 1 → STOP. Debug before proceeding. This is foundational.

---

## Day 2 — Circuit Implementation

**Goal:** Custom voting circuit compiles, proof generates and verifies via CLI.

**Tasks:**
1. Implement `circuits/circuits/merkle.circom`:
   - `MerkleTreeChecker(levels)` template
   - Verifies inclusion given leaf, path elements, path indices, root
2. Implement `circuits/circuits/vote.circom`:
   - Per spec §5 of INIT_PROMPT.md
   - Public inputs: `root, nullifier, election_id, vote_public, num_candidates`
   - All 6 constraints from §5
3. Compile: `circom vote.circom --r1cs --wasm --sym`
4. Phase 2 trusted setup:
   ```bash
   snarkjs groth16 setup vote.r1cs ptau_12.ptau vote_0000.zkey
   snarkjs zkey contribute vote_0000.zkey vote_final.zkey
   snarkjs zkey export verificationkey vote_final.zkey verification_key.json
   ```
5. Write `circuits/inputs/sample_input.json` with valid test data
6. Generate + verify proof via CLI:
   ```bash
   snarkjs groth16 fullprove sample_input.json vote_js/vote.wasm vote_final.zkey proof.json public.json
   snarkjs groth16 verify verification_key.json public.json proof.json
   ```

**Checkpoint:**
- [ ] Circuit compiles without warnings
- [ ] Phase 2 setup produces `vote_final.zkey`
- [ ] Sample proof generates in <5s
- [ ] Proof verifies via snarkjs CLI

**Fallback trigger:** If circuit doesn't compile or proof fails by end of Day 2 → switch to **Semaphore v4 fork**. Document in `THREAT_MODEL.md`.

---

## Day 3 — SUI Move Module

**Goal:** Move module deployed on testnet, accepts valid proofs, rejects invalid.

**Tasks:**
1. Write `move/sources/election.move`:
   - `Election` shared object
   - `create_election`, `finalize_registration`, `cast_vote`, `get_tally` entry functions
   - Error codes: `EInvalidProof`, `EDoubleVote`, `EVotingEnded`, `ENotAdmin`, `EWrongPhase`
2. Write `move/sources/vk.move`:
   - Verification key as `vector<u8>` constants (from Day 2's verification_key.json)
3. Write `scripts/export_vk.ts`:
   - Convert snarkjs vk.json → SUI BCS-compatible bytes
4. Write `move/tests/election_tests.move`:
   - Test valid proof path
   - Test double-vote rejection
   - Test expired election
5. `sui move test` → green
6. `sui move build` → green
7. Deploy to testnet:
   ```bash
   sui client publish --gas-budget 100000000
   ```
8. Write test script: create election + cast vote from CLI (no frontend yet)

**Checkpoint:**
- [ ] Move unit tests pass
- [ ] Package deployed to testnet (note package ID)
- [ ] CLI test: create election + cast valid proof → success
- [ ] CLI test: cast same nullifier twice → rejected

**Risk flag:** Proof byte format (pi_a, pi_b, pi_c) has tricky Fq2 c0/c1 ordering. Expect 1-2 hours debugging.

---

## Day 4 — Backend API

**Goal:** Voter registration works end-to-end via curl. Merkle tree builds correctly.

**Tasks:**
1. Set up FastAPI skeleton in `backend/src/main.py`
2. Implement `backend/src/merkle.py`:
   - `build_merkle_tree(leaves, depth) -> { root, tree }`
   - `get_proof(leaf, tree) -> { path_elements, path_indices }`
   - Uses `circomlib-py` Poseidon
3. Implement `backend/src/registry.py`:
   - SQLite schema
   - CRUD operations
4. Implement API endpoints:
   - `POST /api/elections/:id/register`
   - `GET /api/elections/:id/commitments`
   - `GET /api/elections/:id/merkle-tree`
   - `GET /api/elections/:id/merkle-proof?commitment=<hex>`
   - `POST /api/elections/:id/close-registration` (admin only)
5. Implement `backend/src/sui_client.py`:
   - `publish_merkle_root(election_id, root)` — calls Move `finalize_registration`
6. Write integration test: register 10 voters → build tree → merkle proof verifies locally
7. Deploy backend (Railway or Fly.io) OR run locally for demo

**Checkpoint:**
- [ ] Can register 10 voters via curl
- [ ] Can fetch merkle proof for any registered commitment
- [ ] Can close registration → root published on-chain
- [ ] API response time <500ms

---

## Day 5 — Frontend Core: Register + Vote

**Goal:** End-to-end flow works in browser. User can register, vote, see result.

**Tasks:**
1. Vite + React + TS + Tailwind + shadcn/ui setup
2. Configure Payy-inspired design tokens (`docs/DESIGN_SYSTEM.md`)
3. Wallet integration:
   - `@mysten/wallet-kit` provider
   - `<WalletGate>` component
4. Implement `src/lib/crypto.ts`:
   - `deriveSk(signature: string): bigint`
   - `computeCommitment(sk, r): bigint`
   - `computeNullifier(sk, electionId): bigint`
5. Implement `src/lib/prover.ts`:
   - Web Worker wrapper for snarkjs
   - `generateProof(inputs): Promise<SuiProof>`
6. Implement `src/workers/prover.worker.ts`:
   - Import snarkjs, load wasm + zkey
   - `groth16.fullProve(inputs, wasm, zkey)`
   - Format output for SUI (swap Fq2 coords)
7. Implement pages:
   - `Register.tsx`: wallet sign → commitment → POST backend
   - `Vote.tsx`: fetch merkle proof → generate ZK proof → Move call
8. Test full flow: register → (admin close via CLI) → vote → see tally via getObject

**Checkpoint:**
- [ ] User can register via browser
- [ ] User can vote via browser
- [ ] Proof generation completes in <5s
- [ ] Move call succeeds
- [ ] Nullifier appears on explorer

**Fallback trigger:** If wallet integration broken → use mock wallet with hardcoded signature for demo. Not ideal but acceptable.

---

## Day 6 — Realtime Tally + Admin UI + Polish

**Goal:** Demo-ready app. Realtime updates. Admin dashboard. Design polished.

**Tasks:**
1. Implement `src/lib/subscribe.ts`:
   - `subscribeToVotes(electionId, onVote)` using `SuiClient.subscribeEvent`
2. Implement `Results.tsx`:
   - Initial state from `getObject`
   - Live updates via event subscription
   - Animated counter (flip effect on vote increment)
3. Implement `Admin.tsx`:
   - Form: title, candidates, end_time
   - Button: Create Election (calls `create_election`)
   - Button: Close Registration (calls `finalize_registration`)
   - Table: list of active elections
4. Design polish:
   - Hero section on Home page ("# NULL\*VOTE" Payy-style)
   - Proof generation loading state (glitch animation)
   - Empty states, error states
   - Wallet disconnected state
5. Responsive check (mobile/tablet)
6. Deploy to Vercel
7. Record demo script practice run

**Checkpoint:**
- [ ] Realtime tally updates when vote cast
- [ ] Admin can create + close elections via UI
- [ ] Frontend deployed on Vercel with public URL
- [ ] Design feels polished, on-brand
- [ ] No console errors

**Fallback trigger:** If event subscription unreliable → polling every 2s. Document in README.

---

## Day 7 — Demo Video, Pitch, Submission

**Goal:** Submission packet complete. Nothing left to build.

**Tasks:**
1. **Record demo video (3 min max):**
   - 0:00-0:20 — Problem statement (whale manipulation, voter intimidation)
   - 0:20-0:40 — Solution overview (ZK proofs on SUI)
   - 0:40-2:30 — Live demo:
     - Admin creates election
     - 3 voters register with wallets
     - Admin closes registration
     - Voter 1 votes Yes → realtime tally updates
     - Voter 1 tries to vote again → rejected
     - Voter 2, Voter 3 vote
   - 2:30-3:00 — Roadmap (MACI, zkLogin, threshold decryption)
2. **Finalize `PITCH.md` / pitch deck (8-10 slides):**
   - Title
   - Problem
   - Solution
   - How it works (architecture diagram)
   - Demo screenshots
   - Tech stack
   - Security model + honest limitations
   - Roadmap
   - Team
   - Contact
3. **Polish `README.md`:**
   - Hero banner
   - Quickstart (5-min replication)
   - Architecture diagram
   - Tech stack badges
   - Demo video embed
   - License
4. **Complete `THREAT_MODEL.md`:**
   - All known limitations
   - Trust assumptions
   - Out-of-scope items
5. **Submit to hackathon platform** with:
   - GitHub URL
   - Vercel URL
   - Demo video URL
   - Pitch deck PDF
6. **Final checks:**
   - No secrets in repo (grep for "privkey", "API_KEY", etc.)
   - All tests pass in CI
   - README renders correctly on GitHub
   - Vercel deployment live

**Checkpoint:**
- [ ] Demo video uploaded (YouTube unlisted or Vercel)
- [ ] Pitch deck exported to PDF
- [ ] Submission form filled
- [ ] Friends / team members can replicate locally from README

---

## Buffer Strategy

If any day slips by >50%, trigger these in order:

| Scope cut | Saves | Impact |
|---|---|---|
| Skip Admin UI (use CLI) | 0.5 day | Demo narrative weaker |
| Skip realtime events (polling) | 0.5 day | Demo less impressive |
| Reduce Merkle depth 8 → 4 | 0.25 day | 16 voter cap (fine for demo) |
| Skip custom circuit (Semaphore fork) | 2 days | Pitch must be adjusted |
| Skip Vercel deploy (local only) | 0.5 day | Judge can't self-verify |

**Do NOT cut:**
- ZK proof generation (that's the whole point)
- Nullifier check (security foundation)
- At least 1 end-to-end demo path

---

## Daily Rituals

**Morning (15 min):**
- Review yesterday's checkpoint status
- Identify today's 3 must-do tasks
- Set 90-minute focused work blocks

**Evening (15 min):**
- Update checkpoint status in this doc
- Commit + push
- Note any blockers in GitHub Issues
- If behind schedule, consider fallback triggers

**Weekly:**
- This is a 7-day sprint. No weekly ritual. Ship.

---

*End of TIMELINE.md*
