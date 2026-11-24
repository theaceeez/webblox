// Standalone webblox: /blox/ (host page + engine, cross-origin isolated) and a
// Wisp server at /wisp/ that only reaches Roblox. Run with Bun after
// `bun run fetch:webblox`; to embed in your own server instead, mount
// createBloxHandler (server/blox.ts) the same way.
import { createServer } from "node:http";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { logging, server as wisp } from "@mercuryworkshop/wisp-js/server";
import { BLOX_PREFIX, createBloxHandler } from "./server/blox";

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "127.0.0.1";

// The page's epoxy client opens TLS to Roblox through this; nothing else is
// reachable, so the server is not an open proxy.
wisp.options.hostname_whitelist = [/(^|\.)(roblox\.com|rbxcdn\.com|robloxlabs\.com)$/i];
wisp.options.port_whitelist = [443];
logging.set_level(logging.WARN);

const handleBlox = createBloxHandler({
  host: resolve(import.meta.dir, "webblox"),
  engine: resolve(import.meta.dir, "vendor", "webblox", "engine"),
  epoxy: Bun.resolveSync("@mercuryworkshop/epoxy-transport", import.meta.dir),
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  let response: Response;
  if (url.pathname === "/" || url.pathname === BLOX_PREFIX.slice(0, -1)) {
    response = new Response(null, { status: 308, headers: { location: `${BLOX_PREFIX}${url.search}` } });
  } else if (url.pathname.startsWith(BLOX_PREFIX)) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(name, value);
    const abort = new AbortController();
    res.on("close", () => abort.abort());
    response = await handleBlox(new Request(url, { method: req.method, headers, signal: abort.signal }), url.pathname);
  } else {
    response = new Response("Not found", { status: 404 });
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) Readable.fromWeb(response.body as never).pipe(res);
  else res.end();
});

server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
  else socket.destroy();
});

server.listen(PORT, HOST, () => console.log(`[webblox] http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}/blox/`));
