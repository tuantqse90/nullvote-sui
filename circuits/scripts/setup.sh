#!/bin/bash
# Phase 2 trusted setup + export verification key.
# Phase 1 = Hermez Powers of Tau (pre-downloaded to build/pot14.ptau, ~thousands of participants).
# Phase 2 is single-party here — MVP only. Mainnet requires a multi-party ceremony.
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

PTAU=build/pot14.ptau
R1CS=build/vote.r1cs

[ -f "$PTAU" ] || { echo "✗ Missing $PTAU. Download it first:"; echo "  curl -sL -o $PTAU https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"; exit 1; }
[ -f "$R1CS" ] || { echo "✗ Missing $R1CS. Run scripts/compile.sh first."; exit 1; }

ENTROPY="nullvote-hackathon-$(date +%s%N)-$RANDOM"

echo "█ Phase 2 initial zkey..."
npx snarkjs groth16 setup "$R1CS" "$PTAU" build/vote_0000.zkey

echo ""
echo "█ Phase 2 contribution (single party)..."
npx snarkjs zkey contribute build/vote_0000.zkey build/vote_final.zkey \
    --name="NullVote hackathon contribution" \
    -e="$ENTROPY"

echo ""
echo "█ Exporting verification key..."
npx snarkjs zkey export verificationkey build/vote_final.zkey build/verification_key.json

echo ""
echo "█ Setup complete:"
ls -lh build/vote_final.zkey build/verification_key.json
