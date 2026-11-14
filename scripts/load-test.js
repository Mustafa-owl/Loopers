/* © 2026 NorthPoint Tech. All rights reserved.

   A citywide outage on a test server: what happens when a whole city opens
   the site at once.

     npm run load-test                  the full run (about 2 minutes)
     npm run load-test -- --quick       a small run, for CI (about 20 seconds)
     npm run load-test -- --url https://staging.example   against a running server
                                         (never production: it sends real reports)

   Without --url it starts its own server on a fresh database in a temporary
   folder, with the news feed off, and stops it at the end.

   What it does, all at the same time:
     1. opens many live connections (every open page has one), and checks
        each of them hears about the new reports
     2. many residents, each with their own phone code, load a page, read
        /api/state and their neighbourhood's history, and some send a
        report or tap "Me too"
   Residents come from a limited set of internet addresses, as they do on
   mobile networks, where thousands of phones share an address (CGNAT).

   At the end it prints how long each kind of request took (median, 95th
   and 99th percentile), how many failed, and how many were turned away by
   the limits (429). It exits with 1 if a goal below is missed.           */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name) => args.includes("--" + name);
const option = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const QUICK = flag("quick");
const PLAN = {
  liveConnections: Number(option("live", QUICK ? 300 : 3000)),
  residents: Number(option("residents", QUICK ? 40 : 300)), // browsing at the same moment
  seconds: Number(option("seconds", QUICK ? 15 : 90)),
  addresses: Number(option("addresses", QUICK ? 20 : 60)), // shared internet addresses
  reportShare: 0.08, // of page visits, how many send a report
  tapShare: 0.25, // how many tap "Me too" on one
};
// Goals: a page and the state must feel instant even on a bad evening
const GOALS = {
  "GET /api/state": { p95: 300 },
  "GET /api/state (after a change)": { p95: 500 },
  "GET page": { p95: 300 },
  "POST /api/reports": { p95: 500 },
  "POST /api/votes": { p95: 500 },
  "GET /api/areas/:slug/history": { p95: 500 },
  failedShare: 0.01, // 5xx and network errors, not 429
  liveHeard: 0.99, // live connections that heard about a report
};

const AREAS = [
  "ankawa",
  "city-centre",
  "iskan",
  "brayati",
  "shorsh",
  "ronaki",
  "zanko",
  "mamostayan",
  "gulan",
  "nishtiman",
];
const PAGES = ["/", "/map.html", "/areas.html", "/area.html?a=ankawa", "/report.html"];
const PROBLEMS = { electricity: ["no_power", "weak_voltage"], water: ["no_water", "low_pressure"] };

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- the server ---------- */

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eu-load-"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOST: "127.0.0.1",
      DATA_DIR: dir,
      NEWS_FEED: "off",
      TRUST_PROXY: "1", // so each simulated address counts as its own
      PUBLIC_URL: "",
      ADMIN_PASSWORD: "load-test-admin-password",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    try {
      if ((await fetch(base + "/api/health")).ok) break;
    } catch {
      /* not up yet */
    }
    if (i === 99) throw new Error("the server didn't start:\n" + log);
  }
  return {
    base,
    log: () => log,
    stop() {
      child.kill("SIGTERM");
      setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 500);
    },
  };
}

/* ---------- measuring ---------- */

const results = new Map(); // kind -> { times: [], failed, limited }
const turnedAway = new Map(); // "POST /api/reports: wait" -> count, why the limits said no
function note(kind, ms, status) {
  const r = results.get(kind) || { times: [], failed: 0, limited: 0 };
  if (status === 429) r.limited += 1;
  else if (!status || status >= 500) r.failed += 1;
  else r.times.push(ms);
  results.set(kind, r);
}

async function timed(kind, url, init = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    note(kind, performance.now() - t0, res.status);
    if (res.status === 429) {
      let reason = "?";
      try {
        reason = JSON.parse(body).reason;
      } catch {
        /* not JSON */
      }
      const k = `${kind}: ${reason}`;
      turnedAway.set(k, (turnedAway.get(k) || 0) + 1);
    }
    return { status: res.status, body };
  } catch {
    note(kind, performance.now() - t0, 0);
    return { status: 0, body: "" };
  }
}

const pct = (sorted, p) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : NaN;

/* ---------- live connections ----------
   Each one is an open page, and does what the page does (core/store.js):
   when it hears about a change it waits 0.3 to 2 seconds, then asks for
   the state again. That rush after every change is the hard part.     */

function openLive(base, n) {
  const conns = [];
  for (let i = 0; i < n; i++) {
    const c = { heard: 0, open: false, failed: false, ctrl: new AbortController(), soon: null };
    const headers = { "x-forwarded-for": `10.${Math.floor(Math.random() * PLAN.addresses)}.1.1` };
    conns.push(c);
    fetch(base + "/api/live", { signal: c.ctrl.signal, headers })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        c.open = true;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!dec.decode(value).includes("event: change")) continue;
          c.heard += 1;
          clearTimeout(c.soon);
          c.soon = setTimeout(
            () => timed("GET /api/state (after a change)", base + "/api/state", { headers }),
            300 + Math.random() * 1700,
          );
        }
      })
      .catch((e) => {
        if (e.name !== "AbortError") c.failed = true;
      });
  }
  return conns;
}

/* ---------- one resident ---------- */

async function resident(base, until, state) {
  const device = "load-" + Math.random().toString(36).slice(2);
  const ip = `10.${Math.floor(Math.random() * PLAN.addresses)}.0.1`;
  const headers = { "x-device": device, "x-forwarded-for": ip };
  const json = { ...headers, "content-type": "application/json" };
  let sent = false;
  while (performance.now() < until) {
    await timed("GET page", base + pick(PAGES), { headers });
    const st = await timed("GET /api/state", base + "/api/state", { headers });
    const area = pick(AREAS);
    await timed("GET /api/areas/:slug/history", `${base}/api/areas/${area}/history`, { headers });

    const roll = Math.random();
    if (roll < PLAN.reportShare && !sent) {
      sent = true; // a person reports their problem once
      const service = pick(["electricity", "water"]);
      const r = await timed("POST /api/reports", base + "/api/reports", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ area, service, problem: pick(PROBLEMS[service]) }),
      });
      if (r.status === 200) state.reportsSent += 1;
    } else if (roll < PLAN.reportShare + PLAN.tapShare && st.status === 200) {
      let reports = [];
      try {
        reports = JSON.parse(st.body).reports || [];
      } catch {
        /* a failed state was already counted */
      }
      const open = reports.filter((x) => !x.resolved);
      if (open.length)
        await timed("POST /api/votes", base + "/api/votes", {
          method: "POST",
          headers: json,
          body: JSON.stringify({ id: pick(open).id, kind: "metoo" }),
        });
    }
    // a person reads for a few seconds before doing anything else
    await sleep(1000 + Math.random() * 3000);
  }
}

/* ---------- the run ---------- */

async function main() {
  const url = option("url", "");
  const server = url ? null : await startServer();
  const base = url ? url.replace(/\/+$/, "") : server.base;
  console.log(`Load test against ${base}`);
  console.log(
    `  ${PLAN.liveConnections} open pages, ${PLAN.residents} residents browsing at once from ${PLAN.addresses} shared addresses, for ${PLAN.seconds} s\n`,
  );

  const live = openLive(base, PLAN.liveConnections);
  await sleep(Math.min(5000, 500 + PLAN.liveConnections)); // let them connect
  const state = { reportsSent: 0 };
  const start = performance.now();
  const until = start + PLAN.seconds * 1000;
  const ramp = (PLAN.seconds * 1000) / 6; // people arrive over the first sixth
  await Promise.all(
    Array.from({ length: PLAN.residents }, (_, i) =>
      sleep((i / PLAN.residents) * ramp).then(() => resident(base, until, state)),
    ),
  );
  const seconds = (performance.now() - start) / 1000;
  await sleep(1500); // the last live messages
  let health = null;
  try {
    health = await (await fetch(base + "/api/health")).json();
  } catch {
    /* reported below */
  }
  live.forEach((c) => {
    clearTimeout(c.soon);
    c.ctrl.abort();
  });

  /* ---------- the answer ---------- */
  let ok = true;
  let total = 0,
    failed = 0;
  const rows = [];
  for (const [kind, r] of [...results].sort()) {
    const sorted = r.times.slice().sort((a, b) => a - b);
    const p95 = pct(sorted, 95);
    const goal = GOALS[kind];
    const miss = goal && p95 > goal.p95;
    if (miss) ok = false;
    total += sorted.length + r.failed + r.limited;
    failed += r.failed;
    rows.push(
      [
        kind.padEnd(30),
        String(sorted.length + r.failed + r.limited).padStart(7),
        pct(sorted, 50).toFixed(0).padStart(6),
        p95.toFixed(0).padStart(6),
        pct(sorted, 99).toFixed(0).padStart(6),
        String(r.failed).padStart(7),
        String(r.limited).padStart(7),
        goal ? `  ${miss ? "MISSED" : "ok"} (p95 < ${goal.p95} ms)` : "",
      ].join(""),
    );
  }
  console.log(
    "request".padEnd(30) +
      "count".padStart(7) +
      "p50".padStart(6) +
      "p95".padStart(6) +
      "p99".padStart(6) +
      "failed".padStart(7) +
      "429".padStart(7) +
      "   (times in ms)",
  );
  rows.forEach((r) => console.log(r));

  if (turnedAway.size) {
    console.log("\nturned away by the limits (429), and why:");
    for (const [k, n] of [...turnedAway].sort()) console.log(`  ${k.padEnd(40)} ${n}`);
  }

  const opened = live.filter((c) => c.open).length;
  const heard = live.filter((c) => c.heard > 0).length;
  const failedShare = total ? failed / total : 0;
  const heardShare = PLAN.liveConnections ? heard / PLAN.liveConnections : 1;
  if (failedShare > GOALS.failedShare) ok = false;
  if (state.reportsSent && heardShare < GOALS.liveHeard) ok = false;
  console.log(
    `\n${total} requests in ${seconds.toFixed(0)} s (${(total / seconds).toFixed(0)} a second), ${failed} failed (${(failedShare * 100).toFixed(2)} %, goal under ${GOALS.failedShare * 100} %)`,
  );
  console.log(
    `${opened} of ${PLAN.liveConnections} live connections opened; ${heard} heard about the ${state.reportsSent} new reports (${(heardShare * 100).toFixed(1)} %, goal ${GOALS.liveHeard * 100} %)`,
  );
  console.log(`health afterwards: ${health ? JSON.stringify(health) : "no answer"}`);
  if (health && !health.ok) ok = false;
  console.log(ok ? "\nAll goals met." : "\nSome goals were missed (above).");
  if (server) {
    server.stop();
    if (!ok) console.log("\nServer log:\n" + server.log().slice(-3000));
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
