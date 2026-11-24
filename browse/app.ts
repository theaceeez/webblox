// /browse/: a Scramjet 2 browser on the same origin as /blox/, for signing in
// to roblox.com. The controller keeps its cookie jar in IndexedDB
// (__scramjet_controller), which /blox/ reads to get .ROBLOSECURITY. Pressing
// Play on a game here opens /blox/ on it (integrations/scramjet/plugin.ts).
import { bloxUrl, createBloxLaunchPlugin, type ManagedPluginClass } from "../integrations/scramjet/plugin";
import { realUrl, toUrl } from "./url";

type Frame = { id: string; prefix: string; go(url: string): void; back(): void; reload(): void };
type ControllerApi = {
  Controller: new (init: {
    serviceworker: ServiceWorker;
    transport: unknown;
    config: Record<string, string>;
  }) => { wait(): Promise<void>; createFrame(element: HTMLIFrameElement, options: { plugins: unknown[] }): Frame };
  ManagedPlugin: ManagedPluginClass;
};
declare const $scramjetController: ControllerApi;

const START = "https://www.roblox.com/login";
const PREFIX = "/browse/sj/";
// Same server setting as /blox/ (host.js stores ?wisp= under this key).
const WISP_KEY = "blox.wisp";

function setStatus(text: string, error = false): void {
  const status = document.getElementById("status") as HTMLDivElement;
  status.textContent = text;
  status.classList.toggle("error", error);
}

function wispUrl(): string {
  const given = new URL(location.href).searchParams.get("wisp");
  if (given && /^wss?:\/\//i.test(given)) {
    try {
      localStorage.setItem(WISP_KEY, given);
    } catch {}
    return given;
  }
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(WISP_KEY);
  } catch {}
  return stored ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
}

async function serviceWorker(): Promise<ServiceWorker> {
  if (!("serviceWorker" in navigator)) throw new Error("This browser has no service worker support.");
  const registration = await navigator.serviceWorker.register("/browse/sw.js", { scope: "/browse/" });
  await navigator.serviceWorker.ready;
  const worker = registration.active ?? registration.waiting ?? registration.installing;
  if (!worker) throw new Error("The service worker did not start. Reload to try again.");
  return worker;
}

async function main(): Promise<void> {
  const iframe = document.getElementById("frame") as HTMLIFrameElement;
  const input = document.getElementById("url") as HTMLInputElement;
  const worker = await serviceWorker();
  setStatus("Connecting…");
  const epoxyUrl = new URL("/blox/epoxy.mjs", location.href).href;
  const { default: EpoxyTransport } = await import(epoxyUrl);
  const transport = new EpoxyTransport({ wisp: wispUrl() });
  await transport.init?.();

  const { Controller, ManagedPlugin } = $scramjetController;
  const controller = new Controller({
    serviceworker: worker,
    transport,
    config: {
      prefix: PREFIX,
      scramjetPath: "/browse/scramjet/scramjet.js",
      injectPath: "/browse/controller/controller.inject.js",
      wasmPath: "/browse/scramjet/scramjet.wasm",
    },
  });
  await controller.wait();

  const launch = createBloxLaunchPlugin(ManagedPlugin, {
    url: (game) => bloxUrl("/blox/", game),
    notify: (message) => setStatus(message, true),
  });
  const frame = controller.createFrame(iframe, { plugins: [launch] });
  const framePrefix = new URL(frame.prefix, location.href).pathname;

  iframe.addEventListener("load", () => {
    setStatus("");
    try {
      const real = realUrl(iframe.contentWindow!.location.href, framePrefix);
      if (real && document.activeElement !== input) input.value = real;
    } catch {}
  });
  document.getElementById("go")!.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("Loading…");
    frame.go(toUrl(input.value));
    input.blur();
  });
  document.getElementById("back")!.addEventListener("click", () => frame.back());
  document.getElementById("reload")!.addEventListener("click", () => frame.reload());

  const start = new URL(location.href).searchParams.get("url");
  const first = start ? toUrl(start) : START;
  input.value = first;
  setStatus("Loading roblox.com…");
  frame.go(first);
}

main().catch((error: unknown) => {
  console.error(error);
  setStatus(`Couldn't start the browser: ${error instanceof Error ? error.message : String(error)}`, true);
});
