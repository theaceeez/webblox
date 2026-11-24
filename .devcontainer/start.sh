#!/usr/bin/env bash
# Runs on every Codespace start. Starts the server right away (so /browse/ works
# for signing in) and downloads the Roblox engine beside it; /blox/ falls back
# to Roblox's CDN for any engine file that isn't on disk yet. Both run detached,
# so they keep going whether or not the editor is open.
# Logs: /tmp/webblox-server.log and /tmp/webblox-fetch.log
cd "$(dirname "$0")/.."
export PATH="$(npm prefix -g)/bin:$HOME/.bun/bin:$PATH" HOST=0.0.0.0 PORT=8080

command -v bun >/dev/null || npm install -g bun
[ -d node_modules ] || bun install

pkill -f "bun server.ts" 2>/dev/null || true
setsid nohup bun server.ts > /tmp/webblox-server.log 2>&1 < /dev/null &

if ! grep -q '"complete": true' vendor/webblox/engine/version.json 2>/dev/null; then
  setsid nohup node scripts/fetch-webblox.mjs > /tmp/webblox-fetch.log 2>&1 < /dev/null &
fi

# Make the port reachable without a GitHub login in the tab (best effort).
if [ -n "$CODESPACE_NAME" ]; then
  (sleep 5; gh codespace ports visibility 8080:public -c "$CODESPACE_NAME" >/dev/null 2>&1) &
fi
echo "[webblox] server starting on :8080, engine download log: /tmp/webblox-fetch.log"
