#!/bin/bash
# End-to-end smoke test: optionally exercises the FastAPI backend (if it's
# running on http://localhost:8000), then runs the full on-chain create →
# finalize → cast → double-vote-replay → tally flow against the currently
# active Sui environment.
#
# Requires the Day 2 circuit pipeline to have produced:
#   circuits/build/verification_key.json, proof.json, public.json
#   circuits/build/{vote_js/vote.wasm, vote_final.zkey}
#   circuits/build/{proof_points.bin, public_inputs.bin}
#   circuits/inputs/sample_voters.json
#
# Uses ELECTION_ID = 0x1234567890abcdef (must match gen_sample_input.js).
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MOVE_DIR="$SCRIPT_DIR/.."
REPO_ROOT="$MOVE_DIR/.."
BUILD_DIR="$REPO_ROOT/circuits/build"
VOTERS_FILE="$REPO_ROOT/circuits/inputs/sample_voters.json"

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
ELECTION_ID_INT=1311768467294899695   # 0x1234567890abcdef
END_TIME=$(node -e "console.log(Date.now() + 24*3600*1000)")
CLOCK=0x6

ENV=$(sui client active-env)
PACKAGE_ID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$MOVE_DIR/deployments.json','utf8'));console.log(d['$ENV'].package_id)")

echo "█ Env:     $ENV"
echo "█ Package: $PACKAGE_ID"

# ── 0. Backend smoke (optional) ────────────────────────────────────────
BACKEND_AVAILABLE=0
if curl -sf --max-time 2 "$BACKEND_URL/health" >/dev/null 2>&1; then
    BACKEND_AVAILABLE=1
    echo "█ Backend reachable at $BACKEND_URL"
else
    echo "█ Backend not reachable at $BACKEND_URL — skipping backend portion"
fi

# ── 1. Create election ─────────────────────────────────────────────────
echo ""
echo "█ create_election..."
CREATE_JSON=$(mktemp)
sui client call \
    --package "$PACKAGE_ID" \
    --module election \
    --function create_election \
    --args "$ELECTION_ID_INT" "Treasury Proposal" '["No","Yes"]' "$END_TIME" \
    --gas-budget 50000000 \
    --json > "$CREATE_JSON"

ELECTION=$(node -e "const j=JSON.parse(require('fs').readFileSync('$CREATE_JSON','utf8'));const c=(j.objectChanges||[]).find(x=>x.type==='created'&&x.objectType&&x.objectType.endsWith('::election::Election'));console.log(c.objectId)")
echo "  election: $ELECTION"

# ── 1.5. Backend: register + verify Merkle root ────────────────────────
if [ "$BACKEND_AVAILABLE" = 1 ]; then
    [ -f "$VOTERS_FILE" ] || { echo "✗ Missing $VOTERS_FILE — run gen_sample_input.js first"; exit 1; }
    COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$VOTERS_FILE','utf8')).length)")
    echo ""
    echo "█ Registering $COUNT sample voters via backend API..."
    node -e "
      const list = JSON.parse(require('fs').readFileSync('$VOTERS_FILE', 'utf8'));
      (async () => {
        for (const v of list) {
          const res = await fetch('$BACKEND_URL/api/elections/$ELECTION/register', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(v),
          });
          if (!res.ok) { console.error('register failed:', await res.text()); process.exit(1); }
        }
      })();
    "
    BACKEND_ROOT=$(curl -sf --max-time 5 "$BACKEND_URL/api/elections/$ELECTION/merkle-tree" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.root)")
    CIRCUIT_ROOT_HEX="0x$(head -c 32 "$BUILD_DIR/public_inputs.bin" | xxd -p -c 64)"
    if [ "$BACKEND_ROOT" != "$CIRCUIT_ROOT_HEX" ]; then
        echo "  ✗ Merkle root mismatch:"
        echo "    backend:  $BACKEND_ROOT"
        echo "    circuit:  $CIRCUIT_ROOT_HEX"
        exit 1
    fi
    echo "  ✓ Python Merkle root matches JS circuit root ($BACKEND_ROOT)"
fi

# ── 2. Finalize registration (root from sample input) ──────────────────
ROOT_HEX=$(head -c 32 "$BUILD_DIR/public_inputs.bin" | xxd -p -c 64)
echo ""
echo "█ finalize_registration..."
sui client call \
    --package "$PACKAGE_ID" \
    --module election \
    --function finalize_registration \
    --args "$ELECTION" "0x$ROOT_HEX" \
    --gas-budget 50000000 \
    --json > /dev/null
echo "  merkle_root: 0x${ROOT_HEX:0:16}…"

# ── 3. Cast vote ────────────────────────────────────────────────────────
PROOF_HEX=$(xxd -p -c 1000 "$BUILD_DIR/proof_points.bin")
PUBLIC_HEX=$(xxd -p -c 1000 "$BUILD_DIR/public_inputs.bin")
echo ""
echo "█ cast_vote (expect success)..."
VOTE_JSON=$(mktemp)
sui client call \
    --package "$PACKAGE_ID" \
    --module election \
    --function cast_vote \
    --args "$ELECTION" "0x$PROOF_HEX" "0x$PUBLIC_HEX" "$CLOCK" \
    --gas-budget 100000000 \
    --json > "$VOTE_JSON"
node -e "const j=JSON.parse(require('fs').readFileSync('$VOTE_JSON','utf8'));console.log('  status:', j.effects.status.status, '  gas:', j.effects.gasUsed.storageCost, 'MIST storage');if(j.events)for(const e of j.events)if(e.type.endsWith('::VoteCast'))console.log('  VoteCast → vote_index =', e.parsedJson.vote_index);"

# ── 4. Replay — expect EDoubleVote (abort 4) ───────────────────────────
echo ""
echo "█ cast_vote replay (expect abort 4 = EDoubleVote)..."
if sui client call \
        --package "$PACKAGE_ID" \
        --module election \
        --function cast_vote \
        --args "$ELECTION" "0x$PROOF_HEX" "0x$PUBLIC_HEX" "$CLOCK" \
        --gas-budget 100000000 \
        --json > /dev/null 2>&1; then
    echo "  ✗ replay SUCCEEDED — nullifier table failed to reject"
    exit 1
else
    echo "  ✓ replay rejected"
fi

# ── 5. Verify tally ─────────────────────────────────────────────────────
echo ""
echo "█ Reading Election state..."
sui client object "$ELECTION" --json | node -e "
const s=require('fs').readFileSync(0,'utf8');
const j=JSON.parse(s);
const c=j.content;
console.log('  phase:        ', c.phase, '(1=Voting)');
console.log('  tally:        ', JSON.stringify(c.tally));
console.log('  nullifier.size:', c.nullifiers.size);
"

echo ""
echo "█ E2E complete. Package ID: $PACKAGE_ID  Election: $ELECTION"
