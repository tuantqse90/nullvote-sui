# NullVote — Pitch Deck

Standalone pitch narrative for hackathon submission. 8–10 slides, 5-minute read.
Pair this with `DEMO_SCRIPT.md` for live presentations.

---

## Slide 1 — Title

**NullVote**
Anonymous DAO Voting on SUI

```
█ hackathon 2026 · NullShift Labs
```

- Presenter: Tun — NullShift Labs
- Tagline: *"DAO voting without whale manipulation or voter intimidation."*
- Links: [live demo](https://nullvote.vercel.app) · [github](https://github.com/_/nullvote-sui) · [3-min video](https://youtu.be/_)

---

## Slide 2 — The Problem

**Every DAO vote on-chain today is a surveillance event.**

- **Whale tracking** — large holders monitor small voters, then pressure or retaliate.
- **Voter intimidation** — controversial proposals expose dissenters; public wallets = public positions.
- **Self-censorship** — on-chain history is permanent; voters abstain rather than risk exposure.

Governance quality drops when voting is visible. The chain's transparency — designed for auditability — becomes a surveillance tool.

> "In every DAO we looked at, <5% of wallets cast >80% of votes. Smaller holders either abstain or copy the whales."

---

## Slide 3 — The Solution

**Separate the vote from the voter.**

Zero-knowledge proofs let a voter prove *"I'm in the registered set and I haven't voted yet"* without revealing *who* they are.

- **Votes are public** — anyone can audit the tally.
- **Voters are anonymous** — no one can link a vote to a wallet.
- **Double-voting is cryptographically impossible** — not a policy, a proof.

**Before:** `wallet 0xAB...CD voted YES` → permanent public record.
**After:** `nullifier 0x██...██ voted YES` → unlinkable to any voter.

---

## Slide 4 — How It Works

Three layers, each independently verifiable:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  FRONTEND    │    │   CIRCUIT    │    │   ON-CHAIN   │
│ React + Vite │───▶│ Circom +     │───▶│ SUI Move     │
│ Web Worker   │    │ Groth16/BN254│    │ sui::groth16 │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Three flows:**
1. **Register** — voter signs wallet message → derives `sk` locally → sends commitment `C = Poseidon(pk, r)` to registry.
2. **Prove** — Web Worker generates Groth16 proof of Merkle inclusion + nullifier correctness (~3s).
3. **Vote** — SUI Move module verifies proof natively, records nullifier, increments tally, emits event.

Key insight: **SUI has a native `sui::groth16` verifier** — no custom verifier contract, no gas overhead.

---

## Slide 5 — Live Demo

Screenshots (full flow in 90 seconds):

1. **Home** — "# NULL\*VOTE" hero, active elections list.
2. **Register** — wallet pops up, commitment computed, censored data display: `0x1a2b...████...9f8e`.
3. **Vote + Proof gen** — block-character progress bar: `[██████░░░░] GENERATING PROOF · 2.1s`.
4. **Results** — realtime counter: `YES: 14 → 15` flip animation, live via SUI event subscription.
5. **Double-vote rejected** — same nullifier → `Transaction failed: EDoubleVote`.

Try it yourself: **nullvote.vercel.app** (testnet, ~5 min to register + vote).

---

## Slide 6 — Technical Stack

| Layer | Choice | Why |
|---|---|---|
| Proof system | **Groth16 / BN254** | Native SUI verifier, 200-byte proofs |
| Hash | **Poseidon** | SNARK-friendly, ~100x cheaper than SHA256 in-circuit |
| Circuit | **Circom 2.1.x** + snarkjs | Battle-tested (Semaphore, MACI, Tornado) |
| On-chain | **SUI Move** (testnet) | Shared objects, sub-second finality, native Groth16 |
| Backend | **Python FastAPI** + SQLite | Registration coordinator only |
| Frontend | **React + Vite + TS** | Web Worker proof generation |
| Design | **Payy-inspired** | Black canvas, mint accent, mono display |

**Proof size:** ~200 bytes. **Verification cost on SUI:** ~0.01 SUI per vote. **Proof generation:** 2–4s on a modern laptop, 8–15s on mobile.

---

## Slide 7 — Security Model

We're honest about what we prove and what we don't.

| Guaranteed | Not guaranteed (roadmap) |
|---|---|
| ✅ Voter anonymity | ❌ Receipt-freeness (→ MACI) |
| ✅ Double-vote prevention | ❌ Coercion-resistance (→ TEE/passkey) |
| ✅ Eligibility enforcement | ❌ Permissionless registration (→ zkLogin/PoH) |
| ✅ Tally verifiability | ❌ Post-quantum security (→ STARKs) |
| ✅ No trusted backend at vote time | ❌ Single-party Phase 2 setup (→ multi-party ceremony) |

**Key line:** *"We document what we don't solve."* Full threat model in `THREAT_MODEL.md`.

---

## Slide 8 — SUI-Native Advantages

Why SUI, not Ethereum or Solana?

- **`sui::groth16` built-in** — no custom verifier deployment; saves gas, removes implementation risk.
- **Shared object model** — elections are first-class objects with clean lifecycle (Registration → Voting → Closed).
- **Event subscription** — `client.subscribeEvent` gives realtime tally without an indexer.
- **Sub-second finality** — vote feels instant; critical for demo UX.
- **Move's resource safety** — nullifier table can't be duplicated or corrupted by accident.

On Ethereum: higher gas, custom verifier contract, worse UX, indexer dependency.

---

## Slide 9 — Roadmap

| Milestone | Timing | What ships |
|---|---|---|
| **v0.1 (this hackathon)** | 2026 Q2 | Single-choice voting, admin-gated registration, single-party Phase 2 |
| **v0.2** | 2026 Q3 | MACI-style coordinator → receipt-freeness + coercion-resistance |
| **v0.3** | 2026 Q4 | zkLogin integration → onboard Web2 users without a wallet |
| **v0.4** | 2027 Q1 | Multi-party Phase 2 ceremony (5+ contributors) + 3rd-party security audit |
| **v1.0** | 2027 Q2 | Mainnet launch, weighted voting, delegation, cross-DAO reputation |

We're not trying to replace every voting primitive. **We're building the default anonymous voting layer for SUI-native DAOs.**

---

## Slide 10 — Team & Ask

**Tun** — Builder of NullVote. AI Solution Architect, 10y Python, MS in AI. Deep interest in privacy-preserving computation and cryptographic UX.

**NullShift Labs** — Independent research collective. Focus: Privacy, AI, Blockchain, ZK.

**What we're looking for:**
- **Feedback** from judges and the SUI core team on the Move module design.
- **Collaborators** on MACI integration and the multi-party ceremony (v0.4).
- **Pilot DAOs** willing to run a real governance vote on v0.2 when it ships.

**Contact:**
- `hello@nullshift.sh`
- Twitter: `@_nullshift`
- GitHub: `github.com/<tun>/nullvote-sui`

```
█ Built with care by NullShift.
  Privacy is infrastructure, not a feature.
```

---

## Appendix A — Expected Questions (1-line answers)

- **How is this different from Semaphore?** — Semaphore is a library; NullVote is an end-to-end voting app with SUI-native verification, realtime tally, and admin workflow.
- **Why Groth16?** — SUI has a native verifier; smaller proofs; acceptable trusted-setup tradeoff for MVP.
- **What about coercion?** — Roadmap (MACI). Documented upfront.
- **What if the backend dies?** — Voting works without backend once Merkle root is on-chain.
- **Gas cost per vote?** — ~0.01 SUI including proof verification.
- **Post-quantum?** — Not PQ-safe today; would require STARKs or lattice proofs.
- **Production-ready?** — No. Ceremony + audit + MACI needed. We're clear about that.

Full Q&A preparation in `DEMO_SCRIPT.md §3`.

---

## Appendix B — Slide Design Notes

Render this deck in Payy-inspired aesthetic (see `DESIGN_SYSTEM.md`):

- Pure black background `#000`.
- Accent mint `#00FFB2` for CTAs, live indicators, nullifier highlights.
- JetBrains Mono for display type; Space Grotesk for body.
- Block-character flourishes (`█`) as icon replacements.
- Censored-data display pattern for sensitive values: `0x1a2b...████...9f8e`.
- No gradients, no glassmorphism, no drop shadows.

Export as PDF for submission. Keep under 2MB.

---

*End of PITCH.md*
