#!/bin/bash
# Deploy NullVote Move package to the currently-active Sui environment.
# Prints the resulting package ID + UpgradeCap; updates `deployments.json`.
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

ENV=$(sui client active-env)
echo "█ Deploying to env: $ENV"

# Clear stale publish marker if present — we don't use upgrade flows yet.
rm -f Published.toml

OUT=$(mktemp)
sui client publish --gas-budget 100000000 --json > "$OUT"

PACKAGE_ID=$(node -e "const j=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const p=(j.objectChanges||[]).find(c=>c.type==='published');if(!p){process.exit(1)};console.log(p.packageId)")
UPGRADE_CAP=$(node -e "const j=JSON.parse(require('fs').readFileSync('$OUT','utf8'));const c=(j.objectChanges||[]).find(x=>x.type==='created'&&x.objectType&&x.objectType.includes('UpgradeCap'));if(!c){process.exit(1)};console.log(c.objectId)")

echo ""
echo "█ Deployed:"
echo "  package_id:  $PACKAGE_ID"
echo "  upgrade_cap: $UPGRADE_CAP"
echo "  env:         $ENV"

# Record deployment. One entry per environment; overwrite on redeploy.
DEPLOYMENTS="$SCRIPT_DIR/../deployments.json"
node -e "
const fs = require('fs');
const path = '$DEPLOYMENTS';
let data = {};
try { data = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}
data['$ENV'] = {
  package_id: '$PACKAGE_ID',
  upgrade_cap: '$UPGRADE_CAP',
  deployed_at: new Date().toISOString(),
};
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('  → wrote', path);
"
