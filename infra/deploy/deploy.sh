#!/usr/bin/env bash
# Deploy NullVote to the Hostinger VPS.
#
# Reads VPS credentials from an env file (default ../secrets/vps.env — gitignored).
# Prerequisites:
#   - sshpass (brew install sshpass)
#   - rsync, jq, curl
#   - Local build tools: node/npm (for frontend), docker already on VPS.
#
# Flow:
#   1. Build the frontend (Vite) with production env.
#   2. Ensure a Cloudflare A record for nullvote.nullshift.sh → VPS_IP.
#   3. rsync source + built frontend to /opt/nullvote/ on the VPS.
#   4. `docker compose up -d --build` the backend on the VPS.
#   5. Merge Caddyfile snippet if absent, reload Caddy.
#   6. Smoke-test https://nullvote.nullshift.sh/health.
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
ENV_FILE="${VPS_ENV_FILE:-$REPO_ROOT/infra/secrets/vps.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "✗ Missing env file at $ENV_FILE"
    echo "  Create it with the variables listed in infra/deploy/README.md."
    exit 1
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

: "${HOSTINGER_VPS_IP:?set HOSTINGER_VPS_IP}"
: "${HOSTINGER_VPS_PASSWORD:?set HOSTINGER_VPS_PASSWORD}"
: "${CLOUDFLARE_API_TOKEN:?set CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ZONE_ID:?set CLOUDFLARE_ZONE_ID}"

SUBDOMAIN="${SUBDOMAIN:-nullvote.nullshift.sh}"
BACKEND_PORT_HOST="${BACKEND_PORT_HOST:-8600}"
APP_DIR_REMOTE="/opt/nullvote"
SSH_PORT="${HOSTINGER_VPS_SSH_PORT:-22}"
SSH="sshpass -p $HOSTINGER_VPS_PASSWORD ssh -o StrictHostKeyChecking=no -p $SSH_PORT"
RSYNC_SSH="sshpass -p $HOSTINGER_VPS_PASSWORD ssh -o StrictHostKeyChecking=no -p $SSH_PORT"

echo "█ Target: $SUBDOMAIN → $HOSTINGER_VPS_IP:$BACKEND_PORT_HOST"

# ── 1. Build frontend ────────────────────────────────────────────────
echo ""
echo "█ Building frontend (VITE_BACKEND_URL='' → same-origin /api)..."
(
    cd "$REPO_ROOT/frontend"
    VITE_BACKEND_URL="" \
    VITE_PACKAGE_ID="0x669ec8fee063206af29be9407865b5e2698f0f8f604b568c97c4e296acdb63be" \
    VITE_SUI_NETWORK="testnet" \
    npm run build >/dev/null
)

# ── 2. Cloudflare DNS ────────────────────────────────────────────────
echo ""
echo "█ Ensuring Cloudflare A record $SUBDOMAIN → $HOSTINGER_VPS_IP (proxied)..."
RECORD_JSON=$(curl -sf \
    "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records?type=A&name=$SUBDOMAIN" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")
EXISTING_ID=$(echo "$RECORD_JSON" | jq -r '.result[0].id // empty')
PAYLOAD=$(jq -n --arg name "$SUBDOMAIN" --arg ip "$HOSTINGER_VPS_IP" \
    '{type:"A", name:$name, content:$ip, ttl:1, proxied:true}')
if [ -n "$EXISTING_ID" ]; then
    echo "  updating existing record $EXISTING_ID"
    curl -sf -X PUT \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records/$EXISTING_ID" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$PAYLOAD" >/dev/null
else
    echo "  creating new record"
    curl -sf -X POST \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$PAYLOAD" >/dev/null
fi

# ── 3. Rsync code + built frontend to VPS ────────────────────────────
echo ""
echo "█ rsync → $APP_DIR_REMOTE (excluding node_modules, venv, target, build)..."
$SSH root@"$HOSTINGER_VPS_IP" "mkdir -p $APP_DIR_REMOTE/frontend-dist"

rsync -az --delete \
    --exclude 'node_modules' \
    --exclude '.venv' \
    --exclude '__pycache__' \
    --exclude '*.egg-info' \
    --exclude 'target' \
    --exclude 'dist' \
    --exclude 'build' \
    --exclude '.git' \
    --exclude 'data' \
    -e "$RSYNC_SSH" \
    "$REPO_ROOT/backend/" "root@$HOSTINGER_VPS_IP:$APP_DIR_REMOTE/backend/"

rsync -az -e "$RSYNC_SSH" \
    "$REPO_ROOT/infra/deploy/" "root@$HOSTINGER_VPS_IP:$APP_DIR_REMOTE/deploy/"

rsync -az --delete -e "$RSYNC_SSH" \
    "$REPO_ROOT/frontend/dist/" "root@$HOSTINGER_VPS_IP:$APP_DIR_REMOTE/frontend-dist/"

# ── 4. Docker compose up backend ─────────────────────────────────────
echo ""
echo "█ Starting backend container on VPS..."
$SSH root@"$HOSTINGER_VPS_IP" <<REMOTE
set -euo pipefail
cd $APP_DIR_REMOTE/deploy
docker compose up -d --build
docker compose ps
REMOTE

# ── 5. Ensure Caddy routing is in place ──────────────────────────────
echo ""
echo "█ Ensuring Caddyfile has $SUBDOMAIN block..."
$SSH root@"$HOSTINGER_VPS_IP" <<REMOTE
set -euo pipefail
if grep -q "^$SUBDOMAIN {" /etc/caddy/Caddyfile; then
    echo "  existing block found, leaving alone"
else
    echo "" >> /etc/caddy/Caddyfile
    cat $APP_DIR_REMOTE/deploy/Caddyfile.snippet >> /etc/caddy/Caddyfile
fi
caddy validate --config /etc/caddy/Caddyfile >/dev/null
systemctl reload caddy
REMOTE

# ── 6. Smoke tests ───────────────────────────────────────────────────
echo ""
echo "█ Smoke tests..."
# /health might take a moment for the backend to warm up.
for i in 1 2 3 4 5 6 7 8; do
    if curl -sf --max-time 5 "https://$SUBDOMAIN/health" >/dev/null; then
        echo "  ✓ https://$SUBDOMAIN/health"
        break
    fi
    echo "  … waiting for /health (attempt $i/8)"
    sleep 3
done

if curl -sf --max-time 5 "https://$SUBDOMAIN/circuit/verification_key.json" >/dev/null; then
    echo "  ✓ https://$SUBDOMAIN/circuit/verification_key.json"
fi

echo ""
echo "█ Done. NullVote is live at https://$SUBDOMAIN"
