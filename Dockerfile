# webblox: Bun server + Wisp. The Roblox engine is fetched on first boot into
# /app/vendor (mount a volume there so it survives restarts and redeploys).
FROM oven/bun:1.3 AS base
RUN apt-get update && apt-get install -y --no-install-recommends nodejs ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
ENTRYPOINT ["sh", "deploy/entrypoint.sh"]
