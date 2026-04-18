# Demo Script & Pitch Outline

Narrative scaffolding for demo video and live pitch. 3-minute demo, 5-minute pitch.

---

## 1. Demo Video Script (3:00 target)

### [0:00 - 0:15] Hook
**Visual:** Black screen. Text fades in letter by letter (Payy-style).

**Voiceover (or text overlay):**
> "Every DAO vote on-chain today is a permanent data leak.
>  Whales see small holders voting. Attackers identify dissenters.
>  Voters self-censor."

**Cut to:** NullVote hero screen — "# NULL*VOTE" repeated.

### [0:15 - 0:30] Solution
**Visual:** Architecture diagram fades in. Three layers highlighted in sequence (circuit → on-chain → frontend).

**VO:**
> "NullVote: anonymous DAO governance on SUI.
>  Zero-knowledge proofs verify eligibility without revealing identity.
>  Votes are public. Voters are anonymous."

### [0:30 - 2:30] Live Demo (2 minutes, the meat)

**[0:30-0:45] Setup**
- Show admin dashboard
- Create election: "Should DAO treasury fund Project X with $10k?"
- Options: Yes, No
- Duration: 24 hours
- Click "Create Election"
- Show SUI explorer link → confirms transaction

**[0:45-1:15] Registration**
- Switch to Voter 1 wallet (different browser/window)
- Navigate to `/elections/:id/register`
- Connect Sui Wallet
- Click "Register to Vote"
- Wallet popup → sign message "NullVote register: 0xabc..."
- Success: "Registered. Your identity is committed."
- Show cryptographic detail panel:
  ```
  Commitment: 0x1a2b...████████...9f8e
  Merkle position: [pending registration close]
  ```

Repeat briefly for Voter 2 and Voter 3 (fast cuts).

**[1:15-1:30] Close registration**
- Back to admin
- Click "Close Registration"
- Show Merkle root computed + published on-chain
- Show SUI explorer: `merkle_root = 0x...` on the Election object
- Transition: election phase = Voting

**[1:30-2:10] Voting (main event)**
- Voter 1 navigates to `/elections/:id/vote`
- UI shows: "Should DAO treasury fund Project X?"
- Select "YES"
- Click "Generate Proof & Cast Vote"
- **Show proof generation animation:**
  ```
  [█░░░░░░░░░] GENERATING PROOF · 0.8s
  [██████░░░░] GENERATING PROOF · 2.1s
  [██████████] PROOF COMPLETE · 3.4s
  ```
- Wallet popup → approve transaction
- Transaction confirmed
- **CRITICAL MOMENT:** switch to Results page
- Tally updates in realtime: `YES: 0 → 1`
- Show VoteCast event in SUI explorer
- Nullifier visible: `0x██████...`
- Commitment: **not visible anywhere on chain**

**[2:10-2:20] Double-vote attempt**
- Voter 1 tries to vote again
- Frontend: "You have already voted in this election"
- Or try via CLI with same nullifier → "Transaction failed: EDoubleVote"

**[2:20-2:30] Multi-voter**
- Fast cuts: Voter 2 votes NO, Voter 3 votes YES
- Tally: `YES: 2, NO: 1`
- Realtime updates visible

### [2:30 - 2:50] Technical highlight
**Visual:** Code snippet showing circuit constraints (key lines only).

**VO:**
> "Built on SUI's native Groth16 verifier.
>  Custom Circom circuit with Poseidon hashing.
>  Merkle inclusion proves voter set membership.
>  Nullifier prevents double voting.
>  All proof generation happens client-side in a Web Worker —
>  your secret key never leaves your device."

### [2:50 - 3:00] Roadmap + CTA
**Visual:** Roadmap bullets fade in.

**VO:**
> "Next up: MACI for coercion resistance.
>  zkLogin for mainstream UX.
>  Multi-party trusted setup for mainnet.
>  
>  Try it live: nullvote.vercel.app
>  Built by NullShift."

---

## 2. Pitch Deck Outline (8-10 slides)

### Slide 1: Title
- **NullVote**
- "Anonymous DAO Voting on SUI"
- Tun · NullShift Labs
- Hackathon 2026

### Slide 2: Problem
**Title:** "Every DAO vote is a surveillance event."

Three bullet points:
- Whale voters track small holders' votes → manipulation
- Controversial votes expose dissenters → voter intimidation
- On-chain history = permanent record → self-censorship

**Data point:** [if available, citation to DAO voting study]

### Slide 3: Solution
**Title:** "Separate the vote from the voter."

Explain in one line:
> "Cryptographic proofs show you're eligible without showing who you are."

Visual: before/after. Before: vote linked to wallet. After: vote linked to anonymous nullifier.

### Slide 4: How it works
Architecture diagram (3 layers: Circuit, On-chain, Frontend).

Key flows:
1. Register → commit
2. Prove → verify
3. Vote → tally

### Slide 5: Demo screenshots
4 screenshots: Home, Register, Vote (with proof gen), Results (with realtime tally).

### Slide 6: Technical stack
Logos/names:
- Circom 2.1.x + snarkjs
- SUI Move (native Groth16)
- React + Vite + TypeScript
- Python FastAPI
- Payy-inspired design system

### Slide 7: Security model
Two columns: **Guaranteed** | **Known limitations**

- Guaranteed: anonymity, no double-vote, eligibility, tally verifiability
- Limitations: receipt-free (MACI roadmap), admin censorship (decentralized registry roadmap), single-party setup (ceremony roadmap)

**Key line:** "We document what we don't solve."

### Slide 8: SUI-native advantages
- `sui::groth16` module = no verifier contract deployment
- Shared object model = clean election lifecycle
- Event subscription = realtime tally without indexer
- Sub-second finality = smooth UX

### Slide 9: Roadmap
- **Q3 2026:** MACI coordinator for coercion resistance
- **Q4 2026:** zkLogin integration for mainstream UX
- **Q1 2027:** Multi-party Phase 2 ceremony
- **Q2 2027:** Security audit + mainnet launch
- **Future:** Weighted voting, delegation, cross-chain

### Slide 10: Team + Contact
- Tun — AI Solution Architect, Master's in AI, 10y Python
- NullShift Labs — Privacy, AI, Blockchain, ZK
- Links: GitHub, Vercel demo, Twitter, nullshift.sh

---

## 3. Q&A Preparation

### Expected judge questions + prepared answers

**Q1: "How is this different from Semaphore?"**
> "Semaphore is a general-purpose anonymous signaling library. NullVote is an end-to-end voting application: custom Circom circuits with election-specific constraints (vote range, binding), SUI-native on-chain verification, realtime tally UX, and an admin workflow. We share cryptographic primitives (Merkle + Poseidon + nullifier pattern) but NullVote is a product, not a library."

**Q2: "What about coercion resistance?"**
> "MVP is not receipt-free — a voter could prove their vote to a coercer by replaying the proof generation. We explicitly document this in our threat model. The roadmap solution is MACI's coordinator pattern, which lets voters override previous votes before the deadline. We didn't implement it because it adds trust assumptions and 3 days of development. For DAO governance where coercion risk is low, our current model is acceptable."

**Q3: "Who trusts the admin?"**
> "The admin has limited power. They can censor registrations (refuse to include a voter), but they can't forge proofs or vote for someone. Censorship is detectable — our public commitment API lets anyone audit the Merkle tree. Full permissionless registration is roadmap, requires anti-sybil which is a hard problem on its own."

**Q4: "Why Groth16 not PLONK?"**
> "SUI has a native Groth16 verifier in `sui::groth16`. PLONK would require us to deploy our own verifier contract, which is ~5x more gas and adds implementation risk. Groth16's proof size (200 bytes) is also ideal for on-chain storage. The downside — per-circuit trusted setup — is acceptable for MVP."

**Q5: "What's the gas cost per vote?"**
> "[Measured during Day 3 testing, insert actual number — expected ~0.01 SUI including proof verification. Well within acceptable range for DAO voting.]"

**Q6: "How do you prevent sybil attacks?"**
> "In the MVP, admin gates registration. For permissionless elections, you'd combine this system with sybil-resistance primitives: proof-of-humanity, Worldcoin ID, staked tokens, or zkLogin with OAuth. We intentionally decoupled sybil resistance from vote privacy — different problem, different toolbox."

**Q7: "Post-quantum security?"**
> "BN254 Groth16 is not post-quantum safe. This is a fundamental limitation of the pairing-based cryptography we use. For PQ-safe voting, we'd need to switch to STARKs or lattice-based proofs. Roadmap, not MVP."

**Q8: "Why SUI and not Ethereum?"**
> "Three reasons: (1) native Groth16 verifier, (2) object-based model fits election lifecycle cleanly, (3) sub-second finality for realtime UX. On Ethereum, you'd pay higher gas, write a custom verifier contract, and have worse UX. Plus SUI's growing ecosystem presents opportunity for being the ZK voting standard here."

**Q9: "What if the backend goes down?"**
> "Backend is only needed during registration window. Once the Merkle root is published on-chain, voting works independently — a voter just needs their commitment list to compute a Merkle proof locally. We could also mirror the commitment list to IPFS for true backend-independence, which is our Day 7 stretch goal."

**Q10: "Is this production-ready?"**
> "No, and we're clear about that. Production needs: multi-party trusted setup ceremony, security audit, formal verification of Move code, and MACI coordinator if coercion resistance matters for the use case. The MVP demonstrates feasibility and UX quality; hardening is roadmap."

---

## 4. Narrative Framing Tips

**Do:**
- Lead with the problem, not the tech
- Show, don't tell — demo > slides
- Acknowledge limitations upfront (builds trust)
- Use concrete examples (specific DAO proposal, specific dollar amount)
- Match pitch pace to audience (crypto-native vs general)

**Don't:**
- Jargon-dump ("trustless zk-SNARK rollup-agnostic") without unpacking
- Over-promise ("production ready")
- Hide behind complexity (judges will probe)
- Compare negatively to competitors (stay positive)
- Run over time (3 min demo means 3 min, not 4)

---

*End of DEMO_SCRIPT.md*
