# NullVote — ZK Private Voting on SUI

> **Init prompt for Claude Code CLI.** Feed this into `claude -p` to bootstrap the repo.
> Project lead: Tun (NullShift). Hackathon build, 7-day timeline.

---

## 1. Mission Statement

Build **NullVote**, an anonymous DAO governance voting system on SUI blockchain. Voters prove eligibility via Groth16 zero-knowledge proofs over a Merkle tree of registered commitments, while nullifiers prevent double-voting. Votes are public; identities are cryptographically hidden.

**One-liner pitch:** "DAO voting without whale manipulation or voter intimidation — on SUI, with ZK proofs."

**Scope boundary:** This is a **hackathon MVP**. Prioritize working demo over production hardening. Document limitations honestly in `THREAT_MODEL.md`.

---

## 2. System Overview

Three layers, each independently testable:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   FRONTEND      │      │  CIRCUIT LAYER  │      │  ON-CHAIN (SUI) │
│                 │      │                 │      │                 │
│ React + Vite    │─────▶│ Circom 2.1.x    │─────▶│ Move module     │
│ @mysten/sui     │      │ → Groth16 proof │      │ sui::groth16    │
│ Sui Wallet Kit  │      │ (BN254 curve)   │      │ Shared object   │
│ snarkjs WASM    │      │ + Poseidon      │      │ Nullifier table │
│ (Web Worker)    │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         ▲                                                 ▲
         │                                                 │
         │           ┌─────────────────┐                  │
         └──────────▶│  ADMIN SERVICE  │──────────────────┘
                     │                 │
                     │ Python FastAPI  │
                     │ Merkle builder  │
                     │ Registry API    │
                     └─────────────────┘
```

---

## 3. Locked Decisions

All major decisions are locked. **Do not re-litigate these during implementation.**

### Cryptographic primitives
- **Curve:** BN254 (SUI native Groth16 support)
- **Hash:** Poseidon (Circom `circomlib/poseidon.circom`, JS `poseidon-lite`, Python `circomlib-py`)
- **Proof system:** Groth16 (small proof size ~200 bytes, SUI has `sui::groth16` module)
- **Merkle depth:** 8 (supports 256 voters for demo, ~3s proof gen)
- **Trusted setup:** Hermez Powers of Tau (phase 1) + local single-party phase 2

### Identity scheme
- **sk derivation:** `sk = Poseidon(wallet.signPersonalMessage("NullVote:<election_id>"))`
- **pk:** `pk = Poseidon(sk)`
- **commitment:** `C = Poseidon(pk, r)` where `r` is random salt
- **nullifier:** `N = Poseidon(sk, election_id)` — deterministic per user per election

### Architecture
- **Proof generation:** client-side, Web Worker
- **Tally reading:** SUI event subscription (realtime WebSocket)
- **Election lifecycle:** admin creates, auto-closes on timestamp, auto-tally
- **Voter registry:** off-chain Merkle tree construction, root published on-chain, commitments exposed via public API

### Stack
- **Circuit:** Circom 2.1.x + snarkjs 0.7.x + circomlib
- **On-chain:** SUI Move, testnet deployment
- **Backend:** Python 3.12 + FastAPI + SQLite + poseidon-python
- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui + @mysten/sui.js
- **Design:** Payy-inspired (see `DESIGN_SYSTEM.md`)
- **Language:** English (UI, docs, code comments)

---

## 4. Repo Structure

```
nullvote-sui/
├── circuits/                    # Circom layer
│   ├── package.json             # snarkjs, circomlib deps
│   ├── circuits/
│   │   ├── vote.circom          # Main voting circuit
│   │   ├── merkle.circom        # Merkle tree verifier (depth 8)
│   │   └── commitment.circom    # Commitment scheme helpers
│   ├── scripts/
│   │   ├── compile.sh           # circom compile + witness gen
│   │   ├── setup.sh             # Phase 2 trusted setup
│   │   ├── export_vk.ts         # Export vk in SUI-compatible BCS format
│   │   └── test_vectors.ts      # Cross-language Poseidon test
│   ├── inputs/
│   │   └── sample_input.json    # Example proof input
│   ├── build/                   # Compiled artifacts (gitignored)
│   └── README.md
│
├── move/                        # SUI Move module
│   ├── Move.toml
│   ├── sources/
│   │   ├── election.move        # Main: create, vote, close, get_tally
│   │   ├── vk.move              # Verification key constants
│   │   └── events.move          # Event definitions for indexer
│   ├── tests/
│   │   └── election_tests.move
│   └── scripts/
│       ├── deploy.sh
│       └── publish_vk.sh
│
├── backend/                     # Admin/issuer service
│   ├── pyproject.toml
│   ├── src/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── merkle.py            # Poseidon Merkle tree builder
│   │   ├── registry.py          # Voter commitment DB
│   │   ├── sui_client.py        # Publish Merkle root on-chain
│   │   └── api/
│   │       ├── commitments.py   # GET /api/elections/:id/commitments
│   │       ├── tree.py          # GET /api/elections/:id/merkle-tree
│   │       └── register.py      # POST /api/elections/:id/register
│   ├── tests/
│   │   └── test_merkle.py
│   ├── data/
│   │   └── voters.db            # SQLite
│   └── README.md
│
├── frontend/                    # React app
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── public/
│   │   └── circuit/             # vote.wasm, vote_final.zkey, vk.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages/
│       │   ├── Home.tsx         # Election list
│       │   ├── Register.tsx     # Voter registration
│       │   ├── Vote.tsx         # Proof gen + vote cast
│       │   ├── Results.tsx      # Realtime tally
│       │   └── Admin.tsx        # Create/close election
│       ├── lib/
│       │   ├── crypto.ts        # Poseidon, key derivation
│       │   ├── prover.ts        # snarkjs Web Worker wrapper
│       │   ├── merkle.ts        # Client-side Merkle proof generation
│       │   ├── sui.ts           # SUI client + wallet adapter
│       │   └── subscribe.ts     # Event subscription (realtime tally)
│       ├── workers/
│       │   └── prover.worker.ts # snarkjs proof generation
│       ├── components/
│       │   ├── WalletGate.tsx
│       │   ├── ProofProgress.tsx  # Glitchy animation during proof gen
│       │   ├── LiveTally.tsx
│       │   └── ui/                # shadcn/ui primitives
│       └── styles/
│           └── globals.css      # Payy-inspired tokens
│
├── docs/
│   ├── ARCHITECTURE.md          # Technical deep-dive
│   ├── THREAT_MODEL.md          # Honest limitations
│   ├── TIMELINE.md              # 7-day plan
│   ├── DESIGN_SYSTEM.md         # Payy-inspired tokens
│   ├── DEMO_SCRIPT.md           # Live demo narrative
│   └── PITCH.md                 # Pitch deck outline
│
├── .github/
│   └── workflows/
│       └── ci.yml               # Lint + test on push
│
├── CLAUDE.md                    # Project memory for Claude Code
├── README.md                    # Public-facing
├── LICENSE                      # MIT
└── .gitignore
```

---

## 5. Cryptographic Flow (Authoritative Spec)

### Phase 1: Election Creation (Admin)

```
Admin → move::election::create_election(
  title: "Should DAO treasury fund Project X?",
  candidates: ["Yes", "No"],
  end_time: now + 24h,
  vk: <verification_key_bytes>,
) → Election { id, merkle_root: EMPTY, ... }
```

Election starts in `Registration` phase. `merkle_root` is empty until registration closes.

### Phase 2: Voter Registration

```
Voter                           Backend                      SUI Chain
  │                               │                             │
  │ 1. Connect SUI wallet         │                             │
  │ 2. sign "NullVote:<eid>"      │                             │
  │    → sig_bytes                │                             │
  │ 3. sk = Poseidon(sig_bytes)   │                             │
  │    pk = Poseidon(sk)          │                             │
  │    r  = random(Field)         │                             │
  │    C  = Poseidon(pk, r)       │                             │
  │ 4. localStorage.save(sk, r)   │                             │
  │    ─── POST /register(C) ────▶│                             │
  │                               │ 5. DB insert (addr, C)      │
  │ ◀────── { ok: true } ─────────│                             │
```

When admin closes registration:
```
Admin → backend.build_tree() → { root, leaves, proofs }
Admin → move::election::finalize_registration(election, root)
        → Election.merkle_root = root, phase = Voting
```

### Phase 3: Voting (ZK magic)

**Circuit inputs (vote.circom):**

| Type | Variable | Description |
|---|---|---|
| Private | `sk` | Secret key |
| Private | `r` | Commitment salt |
| Private | `path_elements[8]` | Merkle sibling hashes |
| Private | `path_indices[8]` | Left/right at each level |
| Private | `vote` | Candidate index (0..N-1) |
| Public | `root` | Merkle root (from chain) |
| Public | `nullifier` | Poseidon(sk, election_id) |
| Public | `election_id` | Election object ID |
| Public | `vote_public` | = `vote` (binding public to private) |
| Public | `num_candidates` | Upper bound for range check |

**Circuit constraints:**
1. `pk == Poseidon(sk)`
2. `C == Poseidon(pk, r)`
3. `merkle_verify(C, path_elements, path_indices) == root`
4. `nullifier == Poseidon(sk, election_id)`
5. `vote == vote_public`
6. `vote < num_candidates`

**On-chain flow:**
```
User → prover.worker.ts → generate proof (2-4s)
     → SUI tx: move::election::cast_vote(
         election,
         proof_bytes,
         [root, nullifier, election_id, vote_public, num_candidates],
         clock,
       )
     → Contract:
       ├─ assert clock.now < election.end_time
       ├─ groth16::verify_groth16_proof(vk, public_inputs, proof) == true
       ├─ assert !table::contains(nullifiers, N)
       ├─ table::add(nullifiers, N, true)
       ├─ tally[vote_public] += 1
       └─ emit VoteCast { nullifier, vote_public, timestamp }
```

### Phase 4: Tally (Public)

- After `end_time`, anyone calls `get_results(election, clock)` → returns tally vector
- Frontend subscribes to `VoteCast` events for realtime counter updates
- Final result read from shared object state

---

## 6. Critical Invariants (DO NOT VIOLATE)

These are must-haves. Breaking any of these breaks the security model.

1. **Poseidon consistency across languages.** Circom, JS (`poseidon-lite`), and Python (`circomlib-py`) MUST produce identical hashes for identical inputs. Write cross-language test vectors on Day 1.

2. **Nullifier never depends on `pk`.** Use `Poseidon(sk, election_id)`, not `Poseidon(pk, election_id)`. Using pk would let anyone with public key list correlate votes.

3. **`sk` never leaves client device.** No logging, no analytics, no server-side derivation.

4. **Vote public input must match vote private input.** Enforce `vote === vote_public` in circuit. Otherwise voter can prove a vote for X but cast for Y.

5. **Range check `vote < num_candidates`.** Without this, attacker can submit vote index 999 and corrupt tally array.

6. **Merkle root on-chain is source of truth.** Frontend uses backend API for commitment list, but proof verification checks root from chain.

7. **Nullifier uniqueness enforced on-chain.** Never rely on frontend checks.

8. **BN254 scalar field.** All field arithmetic modulo `r = 21888242871839275222246405745257275088548364400416034343698204186575808495617`.

---

## 7. Anti-patterns (DO NOT DO)

- ❌ Server-side proof generation (breaks trustlessness)
- ❌ Storing `sk` in backend DB
- ❌ Logging signature bytes anywhere
- ❌ Skipping Poseidon cross-language tests (silent bugs = catastrophic)
- ❌ Hard-coding voter count (use configurable Merkle depth)
- ❌ Using SHA256 instead of Poseidon (non-SNARK-friendly, circuit will explode)
- ❌ Writing verifier contract from scratch (use `sui::groth16`)
- ❌ Committing `vote_final.zkey` to git (too large, use GitHub LFS or external storage)
- ❌ Using `localStorage` for `sk` without backup flow (single point of failure)
- ❌ Admin ceremony keys in repo (use env vars)

---

## 8. Fallback Plan

If custom circuit fails or time runs short:

| Checkpoint | Trigger | Action |
|---|---|---|
| End of Day 2 | Circuit doesn't compile, or proof gen fails | Switch to Semaphore v4 fork, adapt for SUI |
| End of Day 4 | Proof gen > 8s on laptop | Reduce Merkle depth 8 → 4 (16 voters max) |
| End of Day 5 | Frontend wallet integration broken | Fallback to mock wallet (skip signature derivation, use random sk for demo) |
| End of Day 6 | Realtime events don't work | Fallback to 2s polling |

**Hard floor:** Must ship working ZK proof + on-chain verification + tally by end of Day 6. Don't compromise on ZK — pitch collapses without it.

---

## 9. First Actions for Claude Code

When bootstrapping, execute in this order:

1. **Create repo skeleton** matching section 4 structure (empty files + READMEs)
2. **Initialize `circuits/`** with `package.json`, install circom + snarkjs + circomlib
3. **Write `scripts/test_vectors.ts`** — Poseidon cross-language check:
   - Hash `[1, 2]` in JS, assert matches known value `0x115cc0f5...`
   - Same for Python (write `backend/tests/test_poseidon.py`)
   - Same for Circom (write minimal test circuit)
4. **Implement `circuits/merkle.circom`** — Merkle inclusion proof template (depth 8)
5. **Implement `circuits/vote.circom`** — main circuit per spec section 5
6. **Compile, run Phase 2 setup, verify proof locally** (CLI first, browser later)
7. **Only after circuit works:** move to Move module, then backend, then frontend

**Day 1 success criteria:** Poseidon test vectors pass in all 3 languages. Circuit compiles. Sample proof generates and verifies via snarkjs CLI.

---

## 10. Reference Links

- SUI Groth16 docs: https://docs.sui.io/references/framework/sui-framework/groth16
- Circom docs: https://docs.circom.io/
- snarkjs: https://github.com/iden3/snarkjs
- Semaphore v4 (reference): https://docs.semaphore.pse.dev/
- Hermez Powers of Tau: https://github.com/iden3/snarkjs#7-prepare-phase-2
- Poseidon hash (circomlib): https://github.com/iden3/circomlib

---

## 11. Success Criteria for Submission

- [ ] GitHub public repo with MIT license
- [ ] Frontend deployed on Vercel (live URL)
- [ ] SUI Move module deployed on testnet (package ID in README)
- [ ] Demo video (3 min max) showing: register → close registration → 3 voters vote → realtime tally → double-vote rejected
- [ ] `README.md` with quickstart (5 min for judge to replicate locally)
- [ ] `THREAT_MODEL.md` documenting known limitations
- [ ] Pitch deck (PDF, 8-10 slides)

---

*End of init prompt. Next: read `CLAUDE.md` for daily conventions, `ARCHITECTURE.md` for deep technical detail, `TIMELINE.md` for day-by-day tasks.*
