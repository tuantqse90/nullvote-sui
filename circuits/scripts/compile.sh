#!/bin/bash
# Compile circuits/vote.circom → R1CS + witness generator + symbol table.
# Requires: circom 2.1.x+ in PATH.
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# circom is installed via cargo — ensure $HOME/.cargo/bin is on PATH.
if ! command -v circom >/dev/null 2>&1 && [ -f "$HOME/.cargo/env" ]; then
    . "$HOME/.cargo/env"
fi
command -v circom >/dev/null 2>&1 || { echo "✗ circom not found. Install: cargo install --git https://github.com/iden3/circom.git"; exit 1; }

mkdir -p build

echo "█ Compiling circuits/vote.circom..."
circom circuits/vote.circom --r1cs --wasm --sym -o build/

echo ""
echo "█ Artifacts:"
ls -lh build/vote.r1cs build/vote.sym build/vote_js/vote.wasm
