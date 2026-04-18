# NullVote Design System

**Authoritative reference.** Tokens extracted directly from [payy.network](https://payy.network/) (Framer build, fetched 2026-04-18) via their compiled CSS. This file is the single source of truth for visual identity — when in doubt, copy Payy.

> **Important correction vs. earlier drafts:** accent is **electric lime `#e0ff32`**, not mint. Payy uses a rounded radius scale (18–48px), not sharp corners. Display typeface is **Steradian**, body is **Inter**. Previous drafts had these wrong.

NullVote-specific additions (block characters, censored-data display, ZK-specific states) layer on top of Payy's foundation — see §6.

---

## 1. Design DNA

**Mood:** Privacy-first cryptographic product. Large confident typography, generous dark canvas, a single electric-lime accent doing all the work.

**Feel:** Swiss grid + fintech clarity + ZK mystique. Big numbers. Tight tracking. Rounded containers. One loud colour.

**Anti-patterns (what Payy does NOT do):**
- ❌ Gradient backgrounds
- ❌ Glassmorphism / blur effects
- ❌ Drop shadows on dark surfaces
- ❌ Multiple competing accent colours
- ❌ Tiny timid display type — Payy goes huge (100–220px)
- ❌ Loose tracking on big type — always negative
- ❌ Emoji-heavy UI
- ❌ Stock illustrations

What Payy DOES do that earlier NullVote drafts missed:
- ✅ **Rounded corners everywhere** — cards, buttons, pills
- ✅ **Sans-serif display**, not monospace, for main brand voice
- ✅ **Electric lime accent**, used on CTAs, highlights, and live indicators

---

## 2. Color Tokens

Extracted from payy.network compiled CSS. Five tiers of neutrals + one accent.

```css
:root {
  /* ── Surfaces (dark canvas, four tiers) ──────────── */
  --bg:              #000000;   /* Page background — pure black */
  --bg-elevated:     #161616;   /* Cards, sections */
  --bg-raised:       #242424;   /* Hover states, nested cards */
  --bg-high:         #363636;   /* Active states, inputs focused */

  /* ── Text (light tiers on dark) ──────────────────── */
  --text-primary:    #FFFFFF;   /* Headings, critical UI */
  --text-secondary:  #E9E9E9;   /* Body on dark */
  --text-tertiary:   #D9D9D9;   /* Supporting copy, hints */
  --text-muted:      #8A8A8A;   /* Derived — metadata, captions */

  /* ── Dark-on-light (when accent blocks used) ─────── */
  --on-accent:       #000000;   /* Text on lime surfaces */
  --text-on-light:   #161616;   /* Body text on white */

  /* ── Accent (electric lime — THE brand colour) ───── */
  --accent:          #E0FF32;   /* rgb(224, 255, 50) — primary CTAs */
  --accent-warm:     #E0F029;   /* Secondary lime (Payy uses both) */
  --accent-subtle:   rgba(224, 255, 50, 0.15);
  --accent-glow:     rgba(224, 255, 50, 0.35);

  /* ── Semantic (NullVote extensions) ──────────────── */
  --success:         #E0FF32;   /* = accent (valid proof) */
  --danger:          #FF3B3B;
  --warning:         #FFB800;
  --info:            #4A9EFF;

  /* ── ZK-specific states ──────────────────────────── */
  --proof-pending:   #FFB800;   /* Amber while generating */
  --proof-valid:     #E0FF32;   /* Lime on success */
  --proof-invalid:   #FF3B3B;
}
```

**Accent discipline.** Electric lime is loud — use it sparingly:

- Primary CTA buttons (one per screen)
- Live dot / "LIVE N votes" indicator
- Vote counter on increment
- Valid-proof confirmation
- "Current step" marker in flows

**Never** use lime for body text, long surfaces, or decorative fills.

---

## 3. Typography

### 3.1 Font stack

Payy uses **Steradian** (proprietary display) + **Inter** (body, weights 400 & 700). Steradian is not free; use Inter everywhere (variable font) — it covers both roles when you vary weight and tracking aggressively. If you need a Steradian-adjacent free alt, use **Geist** (Vercel) or **General Sans** (Fontshare).

```css
--font-display: 'Geist', 'Steradian', 'Inter', 'Inter Placeholder', -apple-system, sans-serif;
--font-body:    'Inter', 'Inter Placeholder', -apple-system, sans-serif;
--font-mono:    'JetBrains Mono', 'SF Mono', ui-monospace, monospace;  /* hashes, addresses only */
```

**Installation:** `@fontsource-variable/inter`, `@fontsource-variable/geist` (or `@fontsource/geist`).

### 3.2 Scale (from Payy's production CSS)

Payy goes big — display sizes up to 220px. Respect that.

```css
--text-hero:      clamp(100px, 18vw, 220px);   /* 100 → 220 */
--text-display:   clamp(72px,  12vw, 180px);   /* 72 → 180 */
--text-h1:        clamp(56px,  8vw,  132px);   /* 56 → 132 */
--text-h2:        clamp(40px,  5vw,  100px);   /* 40 → 100 */
--text-h3:        56px;
--text-h4:        40px;
--text-h5:        24px;
--text-body-lg:   22px;
--text-body:      18px;    /* Default body */
--text-small:     16px;
--text-caption:   14px;
--text-micro:     12px;
--text-tiny:      10px;
```

### 3.3 Tracking (letter-spacing) — the Payy signature

**Big type gets tight.** This is THE visual signature:

```css
/* Apply by display tier */
--tracking-hero:      -0.08em;   /* ≥ 180px */
--tracking-display:   -0.06em;   /* 100–160px */
--tracking-h1:        -0.04em;   /* 56–100px */
--tracking-h2:        -0.03em;   /* 40–56px */
--tracking-h3:        -0.02em;   /* 24–40px */
--tracking-body:      -0.01em;   /* 16–22px */
--tracking-micro:     0;         /* ≤ 14px stays neutral */
```

Payy's production CSS literally uses values like `letter-spacing: -24.04px` on ~220px text (= −0.11em!) — don't be shy.

### 3.4 Line-height

Payy uses near-1 for display, 1.3–1.5 for body:

```css
--leading-hero:    0.8;    /* Hero, tight blocks */
--leading-display: 0.9;
--leading-heading: 1.0;    /* 100% for h1–h3 */
--leading-body:    1.5;    /* Body copy */
--leading-caption: 1.3;
```

### 3.5 Weights

Payy uses **400, 500, 700**. Use Inter variable to hit all three without loading 3 weights.

### 3.6 Treatment rules

- **Display:** huge, Inter/Geist, tight negative tracking, line-height 0.8–1.0.
- **Body:** Inter 400, 18px default, 1.5 leading, max-width 68ch.
- **UI labels / buttons:** Inter 500, 14–16px, `letter-spacing: 0.02em`, **not** uppercase by default (Payy doesn't force caps).
- **Mono:** JetBrains Mono — only for hashes, addresses, nullifiers, code. Never for UI labels.

---

## 4. Layout

### 4.1 Spacing scale

Payy's production padding set reveals their rhythm: 16, 20, 24, 40, 56, 120, 124, 140, 237 px (section padding). Multiples of 4 with a few "loud" gaps.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-14: 56px;
--space-20: 80px;
--space-30: 120px;
--space-35: 140px;   /* Signature section spacing */
--space-60: 240px;   /* Hero breathing room */
```

### 4.2 Container

- Max width: 1440px outer, 1200px content
- Reading max: 680px (~68ch)
- Mobile gutter: 16px
- Tablet gutter: 24px
- Desktop gutter: 40–56px (Payy uses 56px on hero sections)

### 4.3 Gaps (flex/grid)

Payy uses distinct gap scales:
- Tight: 12, 16, 24, 32
- Comfortable: 40, 48
- Dramatic: 113, 200, 220 (between hero and first section)

### 4.4 Whitespace philosophy

- Payy never crowds. Generous padding is the first design rule.
- Hero takes full viewport height on desktop; don't try to cram below-fold content in.
- Between paragraphs: `--space-8`. Between sections: `--space-30` to `--space-35`.

---

## 5. Radius

**Corrected — Payy is NOT sharp-cornered.** Radius is a defining characteristic.

```css
--radius-xs:    2px;     /* Inputs, dividers */
--radius-sm:    8px;     /* Small tags */
--radius-md:    18px;    /* Buttons (Payy's base button radius) */
--radius-lg:    24px;    /* Cards */
--radius-xl:    36px;    /* Large feature cards */
--radius-2xl:   48px;    /* Hero cards, modals */
--radius-pill:  999px;   /* Fully rounded (Payy uses 573px–745px) */
```

Pair radius with padding — a 48px radius card needs 32–40px interior padding to feel right.

---

## 6. NullVote Signature Patterns

These layer on top of Payy's foundation — NullVote-specific flourishes that reinforce "cryptographic / ZK".

### 6.1 Block character flourishes

Use `█` (U+2588) for:
- Live indicators (`█ LIVE`)
- Phase markers (`█ PHASE 01 — REGISTRATION`)
- Progress bars (see 6.4)
- Icon replacement where appropriate

### 6.2 Censored data display

Show enough to verify, hide enough to protect:

```
Voter:       0x1a2b...████████...9f8e
Nullifier:   ████████████████████████████████
Commitment:  0x3c5d...████...7a12
```

Treat `█` runs as type, not images. Use `--font-mono`, `--text-tertiary`.

### 6.3 Hash/address display

Middle-truncated, monospace, 14–16px:

```html
<span class="hash">0x1a2b...9f8e</span>
```
```css
.hash {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}
```

### 6.4 Proof-generation progress bar

Block-character ASCII bar, monospace, mint lime when complete:

```
[█░░░░░░░░░] GENERATING PROOF · 1.2s
[██████░░░░] GENERATING PROOF · 2.8s
[██████████] PROOF COMPLETE · 3.4s
```

While generating: colour = `--proof-pending` (`#FFB800`). On complete: colour = `--proof-valid` (`#E0FF32`).

### 6.5 Live tally counter

Electric lime on increment, flip animation (see §8.2):

```
TALLY · YES:  14 → 15
        NO:    8
```

### 6.6 Hero block

Big display text, repeated with decreasing opacity (classic Payy trick adapted):

```
# NULL*VOTE          opacity 100%
# NULL*VOTE          opacity  50%
# NULL*VOTE          opacity  20%
```

Font-size = `--text-hero`, tracking `--tracking-hero`, leading `--leading-hero`.

---

## 7. Components

### 7.1 Button

```css
.btn-primary {
  background: var(--accent);
  color: var(--on-accent);
  padding: 16px 28px;
  border-radius: var(--radius-md);   /* 18px — Payy default */
  border: none;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: background 150ms ease-out, transform 150ms ease-out;
}
.btn-primary:hover   { background: #EEFF5A; }
.btn-primary:active  { transform: translateY(1px); }

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  padding: 16px 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--bg-high);
  /* …same typography… */
}
.btn-secondary:hover { background: var(--bg-raised); }
```

**No uppercase.** Payy doesn't force caps on buttons — leave case natural.

### 7.2 Card

```css
.card {
  background: var(--bg-elevated);
  border-radius: var(--radius-lg);   /* 24px */
  padding: 32px;
  /* No shadow, no border by default */
}

.card--feature {
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);   /* 36px for big hero-ish cards */
  padding: 40px;
}
```

### 7.3 Input

```css
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-raised);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-body);
  padding: 14px 18px;
  font-size: 16px;
  width: 100%;
}
.input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-raised);
}
```

### 7.4 Live badge

```html
<span class="live-badge">
  <span class="live-dot">█</span>
  LIVE · 142 votes
</span>
```
```css
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 14px;
  font-weight: 500;
}
.live-dot { animation: pulse 1500ms ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
```

### 7.5 Phase marker

```
█ PHASE 01 — REGISTRATION
```
Block + code + em-dash + caps title. Mono font, `--text-secondary` colour.

---

## 8. Motion

### 8.1 Principles

- **Fast:** 150ms default, max 300ms for UI; 400ms for hero transitions.
- **Functional:** motion clarifies state, never decorates.
- **Ease:** `ease-out` or custom `cubic-bezier(0.2, 0.8, 0.2, 1)` — never `spring`, never bounce.

```css
--transition-fast:   150ms ease-out;     /* Hover, focus */
--transition-medium: 250ms ease-out;     /* Modals */
--transition-slow:   400ms cubic-bezier(0.2, 0.8, 0.2, 1);
```

### 8.2 Signature animations

**Vote counter flip** (400ms): number scrolls vertically — old value slides out top, new slides in from bottom. Green flash at peak.

**Proof generation glitch** (600ms): text rapidly cycles through random hex characters before settling. Use on nullifier reveal + proof completion only.

**Live pulse** (1500ms loop): `█` opacity `1 → 0.3 → 1`.

**Hero reveal** (800ms, page load): three copies of "# NULL\*VOTE" fade in at 0, 120, 240ms, with upward 8px translate.

---

## 9. Iconography

**Library:** [Lucide React](https://lucide.dev/) — stroke 1.5px, rounded joins, matches Payy's friendly-yet-technical feel.

**Key icons:**
- `Lock` — privacy
- `Check` — verified proof
- `X` — rejected
- `Zap` — realtime
- `Shield` — security
- `Eye` / `EyeOff` — reveal / hide
- `ArrowRight` — CTAs
- `ExternalLink` — explorer links

**Custom:** `█` block character replaces icon where the meaning is "data redacted" or "live".

---

## 10. Page Templates

### 10.1 Home (election list)

```
┌─ Header · wallet connect ─────────────────┐
│                                           │
│       # NULL*VOTE                         │
│       # NULL*VOTE                         │
│       # NULL*VOTE                         │
│       Anonymous DAO voting on SUI.        │
│       Zero-knowledge proofs.              │
│                                           │
│       [ Vote now → ]  [ Read docs ]       │
│                                           │
│  ┌─ Active elections ─────────────────┐  │
│  │ █ LIVE                             │  │
│  │ Treasury Proposal #12              │  │
│  │ Ends in 4h 23m · 47 voters         │  │
│  │ [ Vote → ]                         │  │
│  └────────────────────────────────────┘  │
└───────────────────────────────────────────┘
```

### 10.2 Vote page

```
┌───────────────────────────────────────────┐
│                                           │
│  █ PHASE 02 — VOTING                      │
│                                           │
│  Should DAO treasury fund Project X?      │
│                                           │
│  ( ) YES                                  │
│  ( ) NO                                   │
│                                           │
│  [ Generate proof & cast vote → ]         │
│                                           │
│  [██████░░░░] GENERATING PROOF · 2.1s     │
│                                           │
│  Nullifier: 0x██████████...               │
└───────────────────────────────────────────┘
```

### 10.3 Results page

```
┌───────────────────────────────────────────┐
│                                           │
│  █ LIVE · 47 votes                        │
│                                           │
│  TREASURY PROPOSAL #12                    │
│                                           │
│  YES  ██████████████████░░   38  · 80 %   │
│  NO   ████░░░░░░░░░░░░░░░░    9  · 20 %   │
│                                           │
│  ── Recent votes ──                       │
│  0x1a2b...████ voted · 2s ago             │
│  0x9f8e...████ voted · 14s ago            │
└───────────────────────────────────────────┘
```

---

## 11. Implementation Checklist

- [ ] Install `@fontsource-variable/inter`, `@fontsource-variable/geist`, `@fontsource/jetbrains-mono`
- [ ] Install `lucide-react`
- [ ] Create `src/styles/globals.css` with all CSS variables from §2, §3, §4, §5
- [ ] Wire tokens into `tailwind.config.ts` so Tailwind utilities consume them
- [ ] Build primitives: `<Button>`, `<Card>`, `<Input>`, `<LiveBadge>`, `<Hash>`, `<PhaseMarker>`
- [ ] Build signatures: `<Hero>` (repeated text), `<ProofProgress>`, `<AnimatedCounter>`, `<CensoredHash>`
- [ ] QA on mobile (hero must scale down gracefully via `clamp()`)
- [ ] Dark is default; **no light mode for MVP**
- [ ] Verify accent discipline — grep for `var(--accent)`: should be < 10 hits total

---

## 12. References

- **Payy Network** — [payy.network](https://payy.network/) (primary reference, tokens extracted 2026-04-18)
- **Inter** — [rsms.me/inter](https://rsms.me/inter/) (body + fallback display)
- **Geist** — [vercel.com/font](https://vercel.com/font) (free Steradian-adjacent display)
- **JetBrains Mono** — [jetbrains.com/lp/mono](https://www.jetbrains.com/lp/mono/) (mono)
- **Lucide** — [lucide.dev](https://lucide.dev/) (icons)

**Anti-references (do not imitate):**
- Uniswap — too colourful
- OpenSea — too crowded
- Default shadcn — we want distinctive, not generic

---

*End of DESIGN_SYSTEM.md — Payy is the standard. When in doubt, open [payy.network](https://payy.network/) in a tab and copy.*
