// /browse/: the Scramjet 2 browser used to sign in to roblox.com. Served
// without cross-origin isolation (proxied sites would not load under COEP),
// on the same origin as /blox/ so the player can read the controller's
// cookie jar.
import { dirname, resolve } from "node:path";

export const BROWSE_PREFIX = "/browse/";

export type BrowsePaths = {
  /** browse/: index.html, sw.js, app.ts. */
  page: string;
  /** @mercuryworkshop/scramjet's dist/ folder. */
  scramjet: string;
  /** @mercuryworkshop/scramjet-controller's dist/ folder. */
  controller: string;
};

/** dist/ folders of the installed Scramjet packages, found from their entry points. */
export function browsePaths(page: string, from: string): BrowsePaths {
  return {
    page,
    scramjet: dirname(Bun.resolveSync("@mercuryworkshop/scramjet", from)),
    controller: dirname(Bun.resolveSync("@mercuryworkshop/scramjet-controller", from)),
  };
}

const JS = "text/javascript; charset=utf-8";

function headers(type: string, extra: Record<string, string> = {}): Headers {
  return new Headers({
    "content-type": type,
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    ...extra,
  });
}

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: headers("text/plain; charset=utf-8") });
}

export function createBrowseHandler(paths: BrowsePaths) {
  const files: Record<string, { path: string; type: string; extra?: Record<string, string> }> = {
    "": { path: resolve(paths.page, "index.html"), type: "text/html; charset=utf-8" },
    "index.html": { path: resolve(paths.page, "index.html"), type: "text/html; charset=utf-8" },
    "sw.js": { path: resolve(paths.page, "sw.js"), type: JS, extra: { "service-worker-allowed": BROWSE_PREFIX } },
    "scramjet/scramjet.js": { path: resolve(paths.scramjet, "scramjet.js"), type: JS },
    "scramjet/scramjet.wasm": { path: resolve(paths.scramjet, "scramjet.wasm"), type: "application/wasm" },
    "controller/controller.api.js": { path: resolve(paths.controller, "controller.api.js"), type: JS },
    "controller/controller.inject.js": { path: resolve(paths.controller, "controller.inject.js"), type: JS },
    "controller/controller.sw.js": { path: resolve(paths.controller, "controller.sw.js"), type: JS },
  };

  // app.ts (and the launch plugin it imports) bundled once, on first request.
  let app: Promise<string> | null = null;
  function buildApp(): Promise<string> {
    app ??= Bun.build({ entrypoints: [resolve(paths.page, "app.ts")], target: "browser", format: "esm" }).then(
      async (result) => {
        if (!result.success || !result.outputs[0]) {
          app = null;
          throw new Error(result.logs.map(String).join("\n") || "build failed");
        }
        return result.outputs[0].text();
      },
    );
    return app;
  }

  return async function handleBrowse(req: Request, pathname: string): Promise<Response> {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: headers("text/plain", { allow: "GET, HEAD" }) });
    }
    const relative = pathname.slice(BROWSE_PREFIX.length);
    if (relative === "app.js") {
      try {
        const code = await buildApp();
        return new Response(req.method === "HEAD" ? null : code, { headers: headers(JS) });
      } catch (error) {
        console.error("[browse] app build failed:", error);
        return new Response("Build failed", { status: 500, headers: headers("text/plain") });
      }
    }
    // Requests under the frame prefix belong to the service worker; reaching
    // the server means it was not running yet, so send the page back to start it.
    if (relative.startsWith("sj/")) return Response.redirect(new URL(BROWSE_PREFIX, req.url).href, 302);
    const entry = Object.hasOwn(files, relative) ? files[relative] : undefined;
    if (!entry) return notFound();
    const file = Bun.file(entry.path);
    if (!(await file.exists())) return notFound();
    return new Response(req.method === "HEAD" ? null : file, { headers: headers(entry.type, entry.extra) });
  };
}
