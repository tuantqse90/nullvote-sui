# NullVote Architecture

Technical deep-dive for engineers. Complements `INIT_PROMPT.md` with diagrams and data-flow detail.

---

## 1. System Components

### 1.1 Circuit Layer (Circom)

**Purpose:** Generate zero-knowledge proofs that (a) a voter is in the registered set and (b) their nullifier is correctly derived, without revealing identity.

**Files:**
- `circuits/vote.circom` — main proving circuit
- `circuits/merkle.circom` — Merkle inclusion verifier template
- `circuits/commitment.circom` — commitment scheme helpers

**Outputs (after compilation + setup):**
- `vote.r1cs` — R1CS constraint system
- `vote_js/vote.wasm` — witness generator (runs in browser)
- `vote_final.zkey` — proving key (~20MB)
- `verification_key.json` — verifying key (few KB, goes on-chain)

### 1.2 On-chain Layer (SUI Move)

**Purpose:** Store elections as shared objects, verify proofs natively, track nullifiers, increment tally, emit events.

**Shared object:**
```move
struct Election has key {
    id: UID,
    title: String,
    candidates: vector<String>,
    merkle_root: vector<u8>,       // BN254 field element, 32 bytes
    nullifiers: Table<vector<u8>, bool>,
    tally: vector<u64>,
    vk_bytes: vector<u8>,
    end_time: u64,                  // ms since epoch
    phase: u8,                      // 0=Registration, 1=Voting, 2=Closed
}
```

**Public entry functions:**
- `create_election(title, candidates, end_time, vk, ctx)` — admin only
- `finalize_registration(election, merkle_root)` — admin, transitions to Voting
- `cast_vote(election, proof, public_inputs, clock)` — anyone with valid proof
- `get_tally(election, clock)` — read-only, requires phase=Closed

**Events:**
- `ElectionCreated { id, title, end_time }`
- `RegistrationClosed { id, merkle_root, voter_count }`
- `VoteCast { election_id, nullifier, vote_index, timestamp }`
- `ElectionClosed { id, final_tally }`

### 1.3 Backend Service (Python FastAPI)

**Purpose:** Act as registration coordinator. Collect voter commitments, build Merkle tree, expose commitments via public API for verification.

**Endpoints:**
```
POST   /api/elections/:id/register
       Body: { wallet_addr, commitment }
       → 200 { ok: true }

GET    /api/elections/:id/commitments
       → 200 { commitments: [hex, hex, ...], count: N }

GET    /api/elections/:id/merkle-tree
       → 200 { root, leaves, depth: 8 }

GET    /api/elections/:id/merkle-proof?commitment=<hex>
       → 200 { path_elements, path_indices, root }

POST   /api/elections/:id/close-registration
       (admin auth required)
       → 200 { merkle_root, tx_digest }
```

**Data model (SQLite):**
```sql
CREATE TABLE elections (
    id TEXT PRIMARY KEY,              -- SUI object ID
    title TEXT,
    phase TEXT,                        -- registration|voting|closed
    merkle_root TEXT,
    created_at TIMESTAMP
);

CREATE TABLE commitments (
    election_id TEXT,
    wallet_addr TEXT,
    commitment TEXT,                   -- hex-encoded Poseidon output
    registered_at TIMESTAMP,
    PRIMARY KEY (election_id, wallet_addr)
);
```

### 1.4 Frontend (React + Vite)

**Pages:**
- `/` — list of active elections
- `/elections/:id/register` — wallet connect + commitment submission
- `/elections/:id/vote` — proof gen + vote cast
- `/elections/:id/results` — realtime tally
- `/admin` — create/close election (protected route)

**Critical component: Web Worker**

Proof generation is expensive (2-4s on modern laptop, 8-15s on phone). It MUST run in a Web Worker to avoid freezing the UI.

```
Main thread                    Worker thread
   │                              │
   ├─ user clicks "Vote"          │
   ├─ build inputs obj            │
   ├─ worker.postMessage(inputs) ▶│
   │                              ├─ import snarkjs
   │                              ├─ generate witness (wasm)
   │                              ├─ generate proof (zkey)
   │                              ├─ format for SUI BCS
   ◀─ worker.onmessage(proof)     │
   ├─ build SUI tx                │
   ├─ wallet.signAndExecute()     │
```

---

## 2. Data Flow Sequences

### 2.1 Registration sequence

```
User              Frontend         Wallet           Backend         SUI Chain
 │                  │                │                │                │
 │ click Register   │                │                │                │
 ├─────────────────▶│                │                │                │
 │                  │ signMessage    │                │                │
 │                  │ "NullVote:eid" │                │                │
 │                  ├───────────────▶│                │                │
 │                  │                │ prompt user    │                │
 │                  │                │ (approve)      │                │
 │                  │ ◀──sig_bytes───┤                │                │
 │                  │ sk = Poseidon(sig)              │                │
 │                  │ pk = Poseidon(sk)               │                │
 │                  │ r = random()                    │                │
 │                  │ C = Poseidon(pk, r)             │                │
 │                  │ localStorage.save(sk, r)        │                │
 │                  │                 POST /register  │                │
 │                  │                 { addr, C }     │                │
 │                  ├────────────────────────────────▶│                │
 │                  │                                 │ insert DB      │
 │                  │                                 │                │
 │                  │ ◀──{ok: true}──────────────────┤                │
 │ "Registered ✓"   │                                 │                │
 │ ◀────────────────┤                                 │                │
```

### 2.2 Voting sequence

```
User      Frontend        Worker          Wallet         SUI Chain       Backend
 │          │               │                │              │               │
 │ choose   │               │                │              │               │
 │  Yes     │               │                │              │               │
 ├─────────▶│               │                │              │               │
 │          │ getProof(C)   │                │              │               │
 │          ├─────────────────────────────────────────────────────────────▶│
 │          │ ◀──{ path_elements, path_indices } (Merkle proof)─────────────┤
 │          │               │                │              │               │
 │          │ postMessage({sk, r, path, vote, root, eid})                    │
 │          ├──────────────▶│                │              │               │
 │          │               │ generate witness              │               │
 │          │               │ generate proof (~3s)          │               │
 │          │               │ format to SUI bytes           │               │
 │          │ ◀─proof_bytes─┤                │              │               │
 │          │                                │              │               │
 │          │ build MoveCall(cast_vote, ...)                │               │
 │          ├───────────────────────────────▶│              │               │
 │          │                                │ signAndExec  │               │
 │          │                                ├─────────────▶│               │
 │          │                                │              │ verify proof  │
 │          │                                │              │ check nullif. │
 │          │                                │              │ insert nullif.│
 │          │                                │              │ tally[vote]++ │
 │          │                                │              │ emit event    │
 │          │                                │ ◀─tx_digest──┤               │
 │          │ ◀──────────success─────────────┤              │               │
 │ "✓ Vote  │                                │              │               │
 │  cast"   │                                │              │               │
 │ ◀────────┤                                │              │               │
```

### 2.3 Realtime tally sequence

```
Results page opens
  │
  ├─ fetch initial state from shared object
  │   client.getObject(election_id) → { tally: [4, 2] }
  │
  ├─ subscribe to VoteCast events
  │   client.subscribeEvent({
  │     filter: { MoveEventType: "VoteCast", Package: PKG_ID }
  │   }, (event) => {
  │     tally[event.vote_index] += 1
  │     animateCounter()
  │   })
  │
  └─ render <LiveTally> component
```

---

## 3. Proof / VK / Public-Input Byte Layout (as-built)

`sui::groth16` (BN254 flavour) consumes **arkworks canonical compressed**
serialization — not a Sui-specific layout. The early draft of this doc warned
about a c1/c0 swap for Fq2 points; **that swap is not needed for BN254** when
you go through arkworks end-to-end. snarkjs stores Fp2 as `[c0, c1]`, and
arkworks serializes x.c0 first, x.c1 second with the y-sign flag on the high
bits of byte 63 — both conventions line up.

**snarkjs → arkworks compressed, 128 bytes total for a Groth16 proof:**

| Offset | Field | Bytes | Encoding |
|---|---|---|---|
| 0..32  | A  (G1) | 32 | x LE with `SWFlags` in byte[31] top-2 bits |
| 32..96 | B  (G2) | 64 | x.c0 LE ‖ x.c1 LE with `SWFlags` in byte[63] top-2 bits |
| 96..128 | C (G1) | 32 | same as A |

`SWFlags` convention (arkworks 0.4):
- bit 7 (`0x80`): y is "positive" — i.e., `y > (q − 1) / 2` for G1, lex-large
  over (c1, c0) for G2.
- bit 6 (`0x40`): point at infinity.

**Public-inputs layout (160 bytes, 5 × 32 LE scalars):**

```
[ root (32) | nullifier (32) | election_id (32) | vote_public (32) | num_candidates (32) ]
```

Each field element is the Fr scalar in **little-endian 32 bytes**, matching
`sui::groth16::public_proof_inputs_from_bytes`.

**VK layout (424 bytes for our 5-public-input circuit):**

```
α_G1 (32) ‖ β_G2 (64) ‖ γ_G2 (64) ‖ δ_G2 (64) ‖ ICₗₑₙ u64-LE (8) ‖ IC₀..ICₙ each (32)
```

`ICₗₑₙ = nPublic + 1` (6 for NullVote). VK is identical across proofs and is
baked into the Move package as a constant (`move/sources/vk.move`).

**Conversion pipeline (two implementations, both verified byte-equivalent):**

1. **Rust**, server-side / during build — `circuits/scripts/export_vk_rs`
   reads `verification_key.json`, `proof.json`, `public.json` and emits
   `vk.bin`, `proof_points.bin`, `public_inputs.bin`. This is what feeds
   `move/sources/vk.move` + the Move integration tests.
2. **TypeScript**, in-browser — `frontend/src/lib/groth16_bytes.ts` runs
   inside the Web Worker after `snarkjs.groth16.fullProve` finishes. The
   CI job `frontend/scripts/verify_groth16_bytes.mjs` asserts the JS output
   is byte-identical to the Rust reference on the sample input.

> **Pitfall log (keep these in mind):**
>
> - **Poseidon MDS indexing is row-major.** Our pure-Python port at
>   `backend/src/crypto/poseidon.py` uses `M[i][j] * state[j]`. Transposing
>   to `M[j][i] * state[j]` produces plausible-but-wrong hashes that don't
>   collide with the canonical `Poseidon([1,2])` constant. CLAUDE.md
>   documents the canonical vectors; verify before touching the matmul.
> - **Powers-of-Tau size.** Our circuit has ≈5600 constraints, so the
>   Phase-2 setup needs **pot14** (`2^14`), not the pot12 the scaffold
>   downloaded. `setup.sh` already points at `pot14.ptau`.

---

## 4. Security Model

### 4.1 Threat actors

| Actor | Capability | Defense |
|---|---|---|
| Passive observer | Reads all chain data | Nullifier unlinkable to commitment |
| Malicious voter | Tries double-vote | Nullifier uniqueness enforced |
| Malicious admin | Builds tree incorrectly | Public commitment API, anyone can rebuild |
| Network attacker | MITM during registration | HTTPS + wallet signature binding |
| Post-election attacker | Tries to link votes | Forward-secure due to Poseidon one-wayness |

### 4.2 Trust assumptions

- **SUI validators** honest (standard blockchain assumption)
- **Admin** semi-trusted for liveness (can censor registrations, but can't forge)
- **Voter's device** not compromised (sk stays local)
- **Trusted setup** — single-party for MVP (documented limitation)
- **Poseidon** resistant to preimage attacks (well-studied)

### 4.3 Known limitations (see THREAT_MODEL.md)

- Not receipt-free (voter can prove their vote to a coercer)
- Not coercion-resistant
- Admin can censor registrations
- Single-party trusted setup
- No threshold decryption (votes are public, voter is anonymous)

---

## 5. Performance (actuals)

| Operation | Target | Hard limit | Measured |
|---|---|---|---|
| Witness + proof generation (CLI, M-series laptop) | <3 s | 8 s | **≈1.04 s** |
| `cast_vote` on testnet | <2 s | 5 s | ~1.5 s wall (0.003 SUI gas) |
| `VoteCast` → tally repaint | <500 ms | 2 s | 2 s (polling cadence) |
| Backend `/api/.../register` (p95, local SQLite) | <500 ms | — | **5.3 ms** |
| Merkle proof build + fetch | <100 ms | 500 ms | ~10 ms for 10 voters |
| Frontend first load (gzip) | — | — | ~200 KB after code-split |

The one limit that's still a live concern is **in-browser proof generation on
low-end phones** — snarkjs WASM + 2.5 MB zkey is heavy on Android mid-range.
The fallback from TIMELINE.md — reduce Merkle depth from 8 → 4 — remains the
lever if that's ever an issue.

---

## 6. Deployment Topology (as-built)

Live at https://nullvote.nullshift.sh on a shared Hostinger VPS
(`76.13.183.138`) — **not** Vercel / Railway / Fly. The same VPS hosts
football-predict, tasco-drive, ai-hub, etc.; Caddy multiplexes subdomains.

```
Cloudflare DNS (A record, proxied) ─ terminates edge TLS
    │
    ▼
Caddy on 76.13.183.138:443 ─ terminates origin TLS
    │
    ▼
┌──────────────────────────────────────────────────────────────┐
│ nullvote.nullshift.sh                                        │
│  /api/*         → 127.0.0.1:8600  (FastAPI in Docker)        │
│  /docs*         → 127.0.0.1:8600                             │
│  /openapi.json  → 127.0.0.1:8600                             │
│  /health        → 127.0.0.1:8600                             │
│  /              → /opt/nullvote/frontend-dist  (Caddy static)│
│  /circuit/*     → same, with 1-year immutable cache headers  │
└──────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                       SUI testnet fullnode (public RPC)
```

**Port map on the shared VPS (see also `project_football_predict_deploy`):**
- `8600` — NullVote backend (127.0.0.1 bound; Caddy fronts).
- `3600` — reserved for NullVote; currently unused because the frontend is
  static and served directly by Caddy.

**Frontend static assets (served from `/opt/nullvote/frontend-dist/`):**
- `vote.wasm` (~2 MB)
- `vote_final.zkey` (~2.5 MB)
- `verification_key.json`
- Code-split JS chunks (~200 KB gzip on initial page load).

**Deploy:** `infra/deploy/deploy.sh` is idempotent — it rebuilds the frontend
with `VITE_BACKEND_URL=""` (so the SPA talks to `/api/*` on the same origin),
upserts the Cloudflare A record, rsyncs code, `docker compose up -d --build`,
merges the Caddy block if absent, reloads Caddy, and smoke-tests `/health`.

**Secrets management:**
- VPS + Cloudflare credentials live in `infra/secrets/vps.env`, gitignored.
  Rsync'd into place by the deploy script; not baked into images.
- Admin's SUI private key is **not** on the server — the backend emits the
  `sui client call` command for `finalize_registration` and the admin signs
  it locally (via the Admin page in the UI or directly from their terminal).
- No frontend secrets (the whole point of the ZK design: anything the client
  needs to see can be public).

**CI** (`.github/workflows/ci.yml`) runs on push / PR: JS Poseidon canonical
vectors, Python pytest (Poseidon + Merkle), frontend typecheck+build,
JS-vs-Rust byte equivalence, Rust exporter build. Move tests run locally
only — adding a GitHub action that installs `sui` is deferred.

---

## 7. Open Design Questions (for Day 7+)

These are **not blockers** for MVP but worth thinking about:

1. **Proving key distribution:** Should zkey be Merkle-proved for integrity? (Overkill for MVP)
2. **Commitment pinning on IPFS:** Stretch goal for trustlessness
3. **Encrypted votes:** Future work for coercion resistance
4. **Multi-election support:** Currently supports concurrent elections, but no cross-election reputation
5. **zkLogin integration:** Skip for MVP, but would be killer UX for v2
6. **Vote delegation:** Requires re-randomizable proofs — research project

---

*End of ARCHITECTURE.md*
