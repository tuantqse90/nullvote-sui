# Threat Model — NullVote

Honest documentation of security properties and limitations. Written to preempt judge questions and demonstrate technical depth.

---

## 1. Security Properties (What We Guarantee)

### 1.1 Voter Anonymity
**Property:** Observer cannot link a cast vote to a specific registered voter.

**Mechanism:** Zero-knowledge proof reveals only that voter is in registered set, not which member. Nullifier derived via `Poseidon(sk, election_id)` is unlinkable to commitment `Poseidon(pk, r)` — both use `sk` but through different functions.

**Assumption:** Poseidon hash function is one-way and collision-resistant. Voter's `sk` remains on device.

### 1.2 Double-vote Prevention
**Property:** Each registered voter can vote at most once per election.

**Mechanism:** Nullifier `N = Poseidon(sk, election_id)` is deterministic. First vote inserts N into on-chain set. Second vote with same N is rejected by Move contract.

### 1.3 Eligibility
**Property:** Only registered voters can cast valid votes.

**Mechanism:** Circuit requires Merkle inclusion proof against on-chain root. Non-registered users cannot produce valid proof.

### 1.4 Vote Integrity
**Property:** A cast vote cannot be changed or redirected to another candidate.

**Mechanism:** Circuit binds private `vote` to public `vote_public`. On-chain increment uses `vote_public` directly.

### 1.5 Tally Verifiability
**Property:** Anyone can verify the final tally matches the votes cast.

**Mechanism:** All votes are public on-chain events. Tally counter is a shared object readable by anyone. Tally = count of events, trivially verifiable.

---

## 2. Known Limitations (What We Don't Guarantee)

### 2.1 Not Receipt-Free
**Limitation:** A voter can prove to a third party how they voted.

**Scenario:** Coercer says "vote Yes or I'll fire you. Show me your vote." Voter can replay proof generation with same inputs, producing identical output. Coercer verifies on-chain that this proof was accepted.

**Mitigation (future):** MACI (Minimal Anti-Collusion Infrastructure) pattern — add a coordinator that re-randomizes vote messages. Voters can override previous votes; last vote before deadline counts. Coercer can't verify "final" vote until after deadline.

**Why not in MVP:** Adds coordinator trust assumption, +3 days implementation. Acceptable tradeoff for DAO governance where coercion risk is low.

### 2.2 Not Coercion-Resistant
**Limitation:** Coercer could force voter to hand over `sk` before election, cast vote themselves.

**Scenario:** Voter signs the wallet message in front of coercer, hands over the derived `sk`.

**Mitigation (future):** Requires secure hardware (TEE, passkey) + time-locked vote commitments. Out of scope for MVP.

### 2.3 Admin Censorship
**Limitation:** Admin can refuse to register specific voters.

**Scenario:** Admin doesn't insert a voter's commitment into Merkle tree. Voter can't prove inclusion, can't vote.

**Mitigation:** Public API exposes commitment list. Censorship is detectable. Social accountability.

**Mitigation (future):** Permissionless registration with anti-sybil (stake, PoH, zkLogin). Out of scope for MVP.

### 2.4 Single-Party Trusted Setup (Phase 2)
**Limitation:** MVP uses single-party trusted setup for the proving key. If the setup operator retains toxic waste, they could forge proofs.

**Mitigation:** Phase 1 uses Hermez's public Powers of Tau ceremony (thousands of participants). Only Phase 2 is single-party. Attack window is circuit-specific, not universal.

**Mitigation (future):** Multi-party Phase 2 ceremony with 5+ contributors before mainnet deployment.

### 2.5 Key Recovery
**Limitation:** If voter loses wallet access, their vote for that election is lost.

**Mitigation:** `sk` is deterministically derived from wallet signature. Recovering wallet → recovers `sk`. Users are instructed to back up wallet as they would for any SUI asset.

### 2.6 Registration Timing Attack
**Limitation:** Observer sees timing of registrations. If wallets are known to correspond to people, order of registration leaks.

**Mitigation:** Backend API accepts registrations in any order. Merkle tree built after registration window closes, randomizing leaf positions.

**Caveat:** DB timestamps exist server-side. Could be scrubbed in prod.

### 2.7 Side-Channel Attacks
**Limitation:** Proof generation time varies with inputs. Observer with precise timing could leak information.

**Mitigation:** Web Worker isolation. Constant-time Poseidon implementation. Not foolproof.

### 2.8 DoS on Backend
**Limitation:** Centralized backend is a single point of failure.

**Mitigation:** Backend is only needed during registration and for proof generation helpers. Once `merkle_root` is on-chain, voting works without backend (user needs Merkle proof, which they can compute locally if they have commitment list).

---

## 3. Trust Assumptions

### We Assume:
1. SUI validators are honest (standard blockchain assumption).
2. Groth16 is secure (BN254 curve, ~100-bit classical security).
3. Poseidon is preimage-resistant and collision-resistant.
4. `sui::groth16` module is correctly implemented.
5. Voter's device is not compromised when signing.
6. TLS/HTTPS protects registration from network attackers.
7. circomlib + snarkjs + poseidon-lite are correctly implemented.

### We Do NOT Assume:
1. Admin is honest (only semi-trusted for liveness).
2. Other voters are honest (no collusion assumption).
3. Observer is passive (active attackers considered).

---

## 4. Out-of-Scope

**Explicitly not addressed in MVP:**
- Post-quantum security (Groth16 on BN254 is not PQ-safe)
- Weighted voting (quadratic, token-weighted)
- Vote delegation / liquid democracy
- Multiple concurrent encrypted elections with shared registry
- Identity verification beyond wallet signature
- Legal compliance (varies by jurisdiction)
- Accessibility for users without crypto wallets
- Mobile-native app (web-only)

---

## 5. Comparison with Related Systems

| System | Anonymity | Coercion-resistance | Trust model | On-chain |
|---|---|---|---|---|
| **NullVote (MVP)** | ✅ via ZK | ❌ | Semi-trusted admin | Full |
| Semaphore v4 | ✅ via ZK | ❌ | Group manager | Partial |
| MACI | ✅ via ZK | ✅ via coordinator | Trusted coordinator | Partial |
| Vocdoni | ✅ via ZK | Partial | Decentralized | Full |
| Snapshot (off-chain) | ❌ | ❌ | Off-chain | No |
| Traditional ballot | ✅ | ✅ | Election commission | N/A |

**Positioning:** NullVote prioritizes **simplicity + on-chain-first** for DAO governance. Comparable to Semaphore in security model, with SUI-native integration and realtime UX.

---

## 6. Responsible Disclosure

If you discover a vulnerability:
- Email: [tbd]
- Please do not file public GitHub issues for security bugs
- We'll acknowledge within 48h

---

## 7. Roadmap to Production

Before this system is safe for real-world DAO governance beyond small-scale experiments:

1. **Multi-party Phase 2 trusted setup ceremony** (minimum 5 contributors)
2. **Third-party security audit** (Least Authority, Trail of Bits, or equivalent)
3. **Formal verification** of Move module critical functions
4. **MACI-style coordinator** for coercion resistance (if needed by use case)
5. **Permissionless registration** with anti-sybil (zkLogin, PoH, or staking)
6. **Long-term monitoring** — public transparency reports on elections run
7. **Bug bounty program** before mainnet deployment

---

*End of THREAT_MODEL.md*
