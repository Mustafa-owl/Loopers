/* © 2026 NorthPoint Tech. All rights reserved.
   Runs the site's browser scripts in Node, with just enough of a fake page
   for them to load. Used to test the assistant without a browser. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const JS = path.resolve("public/assets/js");
const FILES = ["core/strings.js", "core/i18n.js", "core/data.js", "core/ui.js", "core/store.js", "assistant.js"];

function fakeElement() {
  const el = {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    getAttribute: () => null,
    removeAttribute() {},
    appendChild: (c) => c,
    append() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {},
    innerHTML: "",
    textContent: "",
    hidden: false,
  };
  return el;
}

export function loadAssistant({ lang = "en" } = {}) {
  const store = new Map();
  const document = {
    documentElement: fakeElement(),
    head: fakeElement(),
    body: fakeElement(),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: fakeElement,
    addEventListener() {},
    dispatchEvent() {},
    readyState: "complete",
    title: "",
  };
  const ctx = {
    document,
    navigator: { languages: [lang], language: lang, onLine: true },
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    location: { href: "http://localhost/", pathname: "/", search: "", hash: "", origin: "http://localhost" },
    fetch: async () => ({ ok: false, status: 0, json: async () => ({ ok: false }) }),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    console,
    Intl,
    Date,
    Math,
    JSON,
    URL,
    URLSearchParams,
    TextEncoder,
    encodeURIComponent,
    decodeURIComponent,
    crypto: globalThis.crypto,
    AbortController,
    Headers,
    structuredClone,
    queueMicrotask,
    performance,
    requestAnimationFrame: () => 0,
    CustomEvent: class {
      constructor(type, o = {}) {
        this.type = type;
        this.detail = o.detail;
      }
    },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(JS, f), "utf8"), ctx, { filename: f });
  return ctx.EU;
}
