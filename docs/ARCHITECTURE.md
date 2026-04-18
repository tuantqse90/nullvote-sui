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

## 3. Proof Format on SUI

SUI's `sui::groth16` expects proofs in specific byte layout. Conversion:

**snarkjs output:**
```json
{
  "pi_a": ["0x...", "0x..."],
  "pi_b": [["0x...", "0x..."], ["0x...", "0x..."]],
  "pi_c": ["0x...", "0x..."],
  "protocol": "groth16",
  "curve": "bn128"
}
```

**SUI format (256 bytes):**
```
[ A.x (32) | A.y (32) | B.x.c1 (32) | B.x.c0 (32) | B.y.c1 (32) | B.y.c0 (32) | C.x (32) | C.y (32) ]
```

Note the **c1/c0 ordering is swapped** for Fq2 points (B coordinates). This is a common bug source. Test carefully on Day 3.

**Public inputs format:**
```
[ root (32) | nullifier (32) | election_id (32) | vote_public (32) | num_candidates (32) ]
```

Use `scripts/export_vk.ts` to convert verification key to SUI-compatible bytes once, then commit the output to `move/sources/vk.move` as constants.

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

## 5. Performance Targets

| Operation | Target | Hard limit |
|---|---|---|
| Witness generation (browser) | <1s | 3s |
| Proof generation (browser) | <3s | 8s |
| SUI `cast_vote` tx | <2s | 5s |
| Event subscription latency | <500ms | 2s |
| Page load (first paint) | <1s | 2s |
| Merkle proof API response | <100ms | 500ms |

If proof generation exceeds 8s on target hardware, reduce Merkle depth 8 → 4 (16 voters max).

---

## 6. Deployment Topology

```
Vercel (frontend)
    │
    │ HTTPS
    ▼
Backend (Railway / Fly.io)
    │
    │ RPC calls
    ▼
SUI testnet (fullnode.testnet.sui.io)
```

**Frontend static assets:**
- `vote.wasm` (~1MB) — bundled with frontend
- `vote_final.zkey` (~20MB) — served from `/public/circuit/` or CDN
- `verification_key.json` — bundled, public

**Secrets management:**
- Admin SUI private key: backend env var only
- No frontend secrets (everything public, that's the ZK property)

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
