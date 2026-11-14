/* © 2026 NorthPoint Tech. All rights reserved.
   A whole app on a throwaway database, with a clock the tests can move. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config as baseConfig } from "../server/config.js";
import { createApp } from "../server/app.js";

export const MIN = 60_000;
export const HOUR = 60 * MIN;

export async function startTestApp({ fetch: fakeFetch, sms = undefined } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eu-test-"));
  const clock = { t: Date.parse("2026-10-16T18:00:00+03:00") };
  const pushed = [];
  const texted = [];
  const config = {
    ...baseConfig,
    isProduction: false,
    publicUrl: "",
    dbFile: ":memory:",
    uploadsDir: path.join(dir, "uploads"),
    secretKey: "test-secret",
    vapid: { ...baseConfig.vapid, hosts: [...baseConfig.vapid.hosts, "push.example.com"] },
    fetch: fakeFetch,
    ...(sms ? { sms } : {}),
  };
  const built = createApp(config, {
    now: () => clock.t,
    pushSend: async (sub, payload) => {
      pushed.push({ sub, payload: JSON.parse(payload) });
    },
    smsSend: async (m) => {
      texted.push(m);
    },
  });
  const server = await new Promise((resolve) => {
    const s = built.app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  // A tiny client: remembers its cookie and sends a device code
  function client(device = "phone-" + Math.random().toString(36).slice(2)) {
    let cookie = "";
    async function call(method, url, body, headers = {}) {
      const res = await fetch(base + url, {
        method,
        headers: {
          "x-device": device,
          "x-requested-with": "fetch",
          ...(body !== undefined && !(body instanceof Buffer) ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : body instanceof Buffer ? body : JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
      const type = res.headers.get("content-type") || "";
      return {
        status: res.status,
        body: type.includes("json") ? await res.json() : await res.arrayBuffer(),
        headers: res.headers,
      };
    }
    return {
      device,
      get: (url, headers) => call("GET", url, undefined, headers),
      post: (url, body, headers) => call("POST", url, body ?? {}, headers),
      put: (url, body) => call("PUT", url, body ?? {}),
      patch: (url, body) => call("PATCH", url, body ?? {}),
      del: (url) => call("DELETE", url, {}),
    };
  }

  // Sign in as the first admin and set a real password
  let admins = 0;
  async function admin() {
    const username = "boss" + ++admins;
    const temp = built.services.users.createFirstAdmin({ username, name: "Boss" });
    const c = client();
    await c.post("/api/team/login", { username, password: temp });
    await c.post("/api/team/password", { current: temp, next: "a-long-admin-password" });
    c.username = username;
    return c;
  }

  async function member(adminClient, { username, role = "staff", service = "electricity" }) {
    const made = await adminClient.post("/api/team/users", { username, name: username, role, service });
    const c = client();
    await c.post("/api/team/login", { username, password: made.body.password });
    await c.post("/api/team/password", { current: made.body.password, next: "another-long-password" });
    return { c, id: made.body.user.id };
  }

  return {
    base,
    clock,
    pushed,
    texted,
    client,
    admin,
    member,
    services: built.services,
    db: built.db,
    advance(ms) {
      clock.t += ms;
    },
    async stop() {
      await new Promise((r) => server.close(r));
      built.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
