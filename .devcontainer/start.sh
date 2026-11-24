#!/usr/bin/env bash
# Runs on every Codespace start. Starts the server right away and downloads the
# Roblox engine beside it; /blox/ falls back
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

# Make port 8080 public so other devices can open it without a GitHub login.
# devcontainer.json has no setting for this, and setting it before the port is
# forwarded doesn't stick, so keep trying until GitHub reports it public.
# Log: /tmp/webblox-port.log
if [ -n "$CODESPACE_NAME" ]; then
  setsid nohup bash -c '
    for i in $(seq 1 60); do
      gh codespace ports visibility 8080:public -c "$CODESPACE_NAME" >/dev/null 2>&1
      v=$(gh codespace ports -c "$CODESPACE_NAME" --json sourcePort,visibility \
          -q ".[] | select(.sourcePort == 8080) | .visibility" 2>/dev/null)
      echo "try $i: ${v:-not forwarded yet}"
      [ "$v" = "public" ] && { echo "port 8080 is public"; exit 0; }
      sleep 5
    done
    echo "could not make 8080 public; set it in the Ports tab"' > /tmp/webblox-port.log 2>&1 < /dev/null &
fi
echo "[webblox] server starting on :8080, engine download log: /tmp/webblox-fetch.log"
