# Deploy — Hostinger VPS

One-shot script that puts NullVote live at `https://nullvote.nullshift.sh` on
the shared Hostinger VPS (`76.13.183.138`).

## Architecture

```
Cloudflare DNS (A record, proxied)
    ↓
Caddy on 76.13.183.138
    ↓
┌───────────────────────────────────┐
│ nullvote.nullshift.sh             │
│ ├─ /api/*        → 8600 (backend) │
│ ├─ /docs*        → 8600 (backend) │
│ ├─ /openapi.json → 8600 (backend) │
│ ├─ /health       → 8600 (backend) │
│ └─ everything else →              │
│      /opt/nullvote/frontend-dist  │
│      (static files, Caddy-served) │
└───────────────────────────────────┘
    ↓ (only backend uses Docker)
Docker container `nullvote-backend` (FastAPI, Python 3.12, SQLite volume)
```

Ports 3600/8600 are reserved for NullVote in the shared-VPS port map.
`8600` is the backend binding (127.0.0.1-only, Caddy fronts it).
`3600` is currently unused — the frontend is static, served directly by Caddy.

## Prerequisites (local machine)

- `sshpass`, `rsync`, `jq`, `curl` — `brew install sshpass jq`
- Node + npm for the frontend build
- An env file at `infra/secrets/vps.env` containing at minimum:

```bash
HOSTINGER_VPS_IP=76.13.183.138
HOSTINGER_VPS_PASSWORD=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...     # zone id for nullshift.sh
```

This file is gitignored — see the root `.gitignore`. Keep it out of git.

## Run

```bash
cd infra/deploy
./deploy.sh
```

The script will:

1. Build `frontend/dist/` with `VITE_BACKEND_URL=""` so the SPA hits `/api/*`
   on the same origin (Caddy routes it to the backend).
2. Upsert a Cloudflare A record `nullvote.nullshift.sh → 76.13.183.138`
   (proxied, so Cloudflare terminates TLS in front of Caddy's own TLS too —
   that's intentional: Hostinger's free TLS via Caddy + Cloudflare orange
   cloud gives you end-to-end encryption without managing a cert).
3. `rsync` the backend source, the built frontend, and the compose files to
   `/opt/nullvote/` on the VPS.
4. `docker compose up -d --build` to start the backend container (binds
   `127.0.0.1:8600`).
5. Append the Caddy vhost block if absent and `systemctl reload caddy`.
6. Smoke-test `/health` and `/circuit/verification_key.json`.

Idempotent — safe to re-run for redeploys.

## Manual rollback

```bash
sshpass -p "$PASSWORD" ssh root@76.13.183.138
cd /opt/nullvote/deploy
docker compose down
# remove the `nullvote.nullshift.sh { ... }` block from /etc/caddy/Caddyfile
systemctl reload caddy
```
