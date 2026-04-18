#!/bin/bash
# NullVote repo skeleton generator
# Run this after `mkdir nullvote-sui && cd nullvote-sui` to scaffold the full folder structure.
# Then feed INIT_PROMPT.md + CLAUDE.md to `claude -p` to start implementation.

set -e

echo "█ NULLVOTE · Bootstrapping repo skeleton..."

# --- Top-level docs ---
mkdir -p docs
touch docs/ARCHITECTURE.md
touch docs/THREAT_MODEL.md
touch docs/TIMELINE.md
touch docs/DESIGN_SYSTEM.md
touch docs/DEMO_SCRIPT.md
touch docs/PITCH.md

# --- Circuits ---
mkdir -p circuits/circuits circuits/scripts circuits/inputs circuits/tests circuits/build
cat > circuits/package.json <<'EOF'
{
  "name": "nullvote-circuits",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "compile": "bash scripts/compile.sh",
    "setup": "bash scripts/setup.sh",
    "test": "ts-node scripts/test_vectors.ts",
    "prove": "bash scripts/test_proof.sh"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "circomlib": "^2.0.5",
    "poseidon-lite": "^0.2.0",
    "snarkjs": "^0.7.3",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.0"
  }
}
EOF
touch circuits/circuits/vote.circom
touch circuits/circuits/merkle.circom
touch circuits/circuits/commitment.circom
touch circuits/scripts/compile.sh
touch circuits/scripts/setup.sh
touch circuits/scripts/export_vk.ts
touch circuits/scripts/test_vectors.ts
touch circuits/inputs/sample_input.json
touch circuits/tests/poseidon_test.circom
echo "build/" > circuits/.gitignore
echo "node_modules/" >> circuits/.gitignore
echo "*.zkey" >> circuits/.gitignore
echo "*.ptau" >> circuits/.gitignore

# --- Move ---
mkdir -p move/sources move/tests move/scripts
cat > move/Move.toml <<'EOF'
[package]
name = "nullvote"
version = "0.1.0"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
nullvote = "0x0"
EOF
touch move/sources/election.move
touch move/sources/vk.move
touch move/sources/events.move
touch move/tests/election_tests.move
touch move/scripts/deploy.sh
touch move/scripts/publish_vk.sh

# --- Backend ---
mkdir -p backend/src/api backend/tests backend/data
cat > backend/pyproject.toml <<'EOF'
[project]
name = "nullvote-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.110",
  "uvicorn[standard]>=0.27",
  "pydantic>=2.6",
  "sqlalchemy>=2.0",
  "aiosqlite>=0.20",
  "pysui>=0.60",
  "circomlib-py>=0.1",
  "python-dotenv>=1.0"
]

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-asyncio>=0.23", "httpx>=0.27", "black", "ruff"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"
EOF
touch backend/src/main.py
touch backend/src/merkle.py
touch backend/src/registry.py
touch backend/src/sui_client.py
touch backend/src/api/commitments.py
touch backend/src/api/tree.py
touch backend/src/api/register.py
touch backend/tests/test_merkle.py
touch backend/tests/test_poseidon.py
touch backend/.env.example
echo "__pycache__/" > backend/.gitignore
echo "*.db" >> backend/.gitignore
echo ".env" >> backend/.gitignore
echo ".venv/" >> backend/.gitignore

# --- Frontend ---
mkdir -p frontend/src/pages frontend/src/lib frontend/src/workers frontend/src/components/ui frontend/src/styles frontend/public/circuit
cat > frontend/package.json <<'EOF'
{
  "name": "nullvote-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx"
  },
  "dependencies": {
    "@fontsource/jetbrains-mono": "^5.0.0",
    "@fontsource/space-grotesk": "^5.0.0",
    "@mysten/sui": "^1.0.0",
    "@mysten/wallet-kit": "^0.8.0",
    "lucide-react": "^0.363.0",
    "poseidon-lite": "^0.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "snarkjs": "^0.7.3"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
EOF
touch frontend/src/main.tsx
touch frontend/src/App.tsx
touch frontend/src/pages/Home.tsx
touch frontend/src/pages/Register.tsx
touch frontend/src/pages/Vote.tsx
touch frontend/src/pages/Results.tsx
touch frontend/src/pages/Admin.tsx
touch frontend/src/lib/crypto.ts
touch frontend/src/lib/prover.ts
touch frontend/src/lib/merkle.ts
touch frontend/src/lib/sui.ts
touch frontend/src/lib/subscribe.ts
touch frontend/src/workers/prover.worker.ts
touch frontend/src/components/WalletGate.tsx
touch frontend/src/components/ProofProgress.tsx
touch frontend/src/components/LiveTally.tsx
touch frontend/src/styles/globals.css
touch frontend/vite.config.ts
touch frontend/tailwind.config.ts
touch frontend/tsconfig.json
touch frontend/.env.example
echo "node_modules/" > frontend/.gitignore
echo "dist/" >> frontend/.gitignore
echo ".env" >> frontend/.gitignore

# --- CI ---
mkdir -p .github/workflows
touch .github/workflows/ci.yml

# --- Root files ---
cat > .gitignore <<'EOF'
# Dependencies
node_modules/
__pycache__/
.venv/

# Build outputs
dist/
build/
*.zkey
*.ptau

# Env
.env
.env.local

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
EOF

cat > LICENSE <<'EOF'
MIT License

Copyright (c) 2026 NullShift Labs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
EOF

touch CLAUDE.md
touch README.md
touch INIT_PROMPT.md

echo ""
echo "█ Done. Repo skeleton created."
echo ""
echo "Next steps:"
echo "  1. Copy INIT_PROMPT.md, CLAUDE.md, and docs/ from the init prompt package"
echo "  2. git init && git add . && git commit -m 'chore: initial scaffold'"
echo "  3. Start Day 1 tasks — see docs/TIMELINE.md"
echo ""
echo "To bootstrap with Claude Code:"
echo "  cd nullvote-sui"
echo "  claude -p 'Read INIT_PROMPT.md and CLAUDE.md. Start Day 1 per TIMELINE.md.'"
