#!/bin/bash
# End-to-end smoke test on the currently-active Sui environment.
# Requires the circuit to have been compiled + a sample proof generated:
#
#   bash circuits/scripts/compile.sh
#   bash circuits/scripts/setup.sh
#   node circuits/scripts/gen_sample_input.js
#   (cd circuits && npx snarkjs groth16 fullprove inputs/sample_input.json \
#       build/vote_js/vote.wasm build/vote_final.zkey build/proof.json build/public.json)
#   circuits/scripts/export_vk_rs/target/release/nullvote-export-vk circuits/build
#
# Uses ELECTION_ID = 0x1234567890abcdef (must match gen_sample_input.js).
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MOVE_DIR="$SCRIPT_DIR/.."
REPO_ROOT="$MOVE_DIR/.."
BUILD_DIR="$REPO_ROOT/circuits/build"

ENV=$(sui client active-env)
PACKAGE_ID=$(node -e "const d=JSON.parse(require('fs').readFileSync('$MOVE_DIR/deployments.json','utf8'));console.log(d['$ENV'].package_id)")

echo "█ Env:     $ENV"
echo "█ Package: $PACKAGE_ID"

ELECTION_ID=1311768467294899695   # 0x1234567890abcdef
END_TIME=$(node -e "console.log(Date.now() + 24*3600*1000)")
CLOCK=0x6   # Sui's shared Clock object

# ── 1. Create election ──────────────────────────────────────────────
echo ""
echo "█ create_election..."
CREATE_JSON=$(mktemp)
sui client call \
  --package "$PACKAGE_ID" \
  --module election \
  --function create_election \
  --args "$ELECTION_ID" "Treasury Proposal" '["No","Yes"]' "$END_TIME" \
  --gas-budget 50000000 \
  --json > "$CREATE_JSON"

ELECTION=$(node -e "const j=JSON.parse(require('fs').readFileSync('$CREATE_JSON','utf8'));const c=(j.objectChanges||[]).find(x=>x.type==='created'&&x.objectType&&x.objectType.endsWith('::election::Election'));console.log(c.objectId)")
echo "  election: $ELECTION"

# ── 2. Finalize registration with root from sample input ────────────
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

# ── 3. Cast vote ─────────────────────────────────────────────────────
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

# ── 4. Replay — expect EDoubleVote (abort 4) ─────────────────────────
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

# ── 5. Verify tally ──────────────────────────────────────────────────
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
