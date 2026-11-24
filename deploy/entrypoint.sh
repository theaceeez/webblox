#!/bin/sh
# Fetch the engine only if there is no complete copy yet. Set WEBBLOX_UPDATE=1
# to pull the latest Roblox version on this boot.
set -e
V=vendor/webblox/engine/version.json
if [ "$WEBBLOX_UPDATE" = "1" ] || ! grep -q '"complete": true' "$V" 2>/dev/null; then
  echo "[deploy] fetching Roblox engine ${WEBBLOX_VERSION:-latest}"
  node scripts/fetch-webblox.mjs $WEBBLOX_VERSION
fi
exec bun server.ts
