import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { realUrl, toUrl } from "../browse/url";
import { browsePaths, createBrowseHandler } from "./browse";

const root = resolve(import.meta.dir, "..");
const handle = createBrowseHandler(browsePaths(resolve(root, "browse"), root));
const get = (path: string) => handle(new Request(`http://webblox.test${path}`), path);

describe("/browse/", () => {
  test("serves the page without cross-origin isolation", async () => {
    const res = await get("/browse/");
    expect(res.status).toBe(200);
    expect(res.headers.get("cross-origin-embedder-policy")).toBeNull();
    expect(await res.text()).toContain('id="frame"');
  });

  test("serves Scramjet and the controller", async () => {
    for (const path of ["scramjet/scramjet.js", "scramjet/scramjet.wasm", "controller/controller.api.js", "controller/controller.inject.js", "controller/controller.sw.js", "sw.js"]) {
      expect((await get(`/browse/${path}`)).status).toBe(200);
    }
  });

  test("bundles app.js with the launch plugin", async () => {
    const res = await get("/browse/app.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("webblox-launch");
  });

  test("refuses anything else", async () => {
    expect((await get("/browse/../server.ts")).status).toBe(404);
    expect((await get("/browse/app.ts")).status).toBe(404);
    expect((await handle(new Request("http://webblox.test/browse/", { method: "POST" }), "/browse/")).status).toBe(405);
  });
});

describe("address bar", () => {
  test("toUrl", () => {
    expect(toUrl("roblox.com/games/1")).toBe("https://roblox.com/games/1");
    expect(toUrl("https://www.roblox.com/login")).toBe("https://www.roblox.com/login");
    expect(toUrl("blox fruits")).toBe("https://www.roblox.com/discover/?Keyword=blox%20fruits");
  });

  test("realUrl", () => {
    const href = `https://site.test/browse/sj/abc/def/${encodeURIComponent("https://www.roblox.com/home")}`;
    expect(realUrl(href, "/browse/sj/abc/def/")).toBe("https://www.roblox.com/home");
    expect(realUrl("https://site.test/blox/", "/browse/sj/abc/def/")).toBeNull();
  });
});
