/* © 2026 NorthPoint Tech. All rights reserved.

   Knowing the site is healthy without waiting for someone to complain.

     timing      every API request: how long it took and whether it failed,
                 kept in memory as one bucket per minute for the last hour
     error()     an error the server hit, or one a browser sent back; the
                 same error is one row with a count (table `errors`)
     health()    what /api/health answers: fine, or what's wrong
     summary()   the admin "System" screen

   Nothing here stores who was asking. Browser errors carry the page and the
   script line, never the address or the device code.                    */
import crypto from "node:crypto";

const MINUTE = 60_000;
const KEEP_MINUTES = 60;
const SAMPLES_PER_MINUTE = 500; // durations kept per minute for the percentiles
const MAX_ERROR_ROWS = 300;
const TIDY_LATE = 30 * MINUTE; // housekeeping runs every 10 minutes; 30 means it's stuck

const clip = (s, n) => String(s ?? "").slice(0, n);

export function createMonitor({ db, now, version }) {
  const started = now();
  let lastTidy = null;
  let tidyFailed = null;

  /* ---------- request timing ---------- */

  const minutes = new Map(); // minute number -> { count, failed, slow, samples[], routes: Map }

  function bucket(t) {
    const m = Math.floor(t / MINUTE);
    let b = minutes.get(m);
    if (!b) {
      b = { count: 0, failed: 0, samples: [], routes: new Map() };
      minutes.set(m, b);
      for (const k of minutes.keys()) if (k <= m - KEEP_MINUTES) minutes.delete(k);
    }
    return b;
  }

  function record(route, ms, status) {
    const b = bucket(now());
    b.count += 1;
    if (status >= 500) b.failed += 1;
    // keep a fair sample once a minute gets busy
    if (b.samples.length < SAMPLES_PER_MINUTE) b.samples.push(ms);
    else {
      const i = Math.floor(Math.random() * b.count);
      if (i < SAMPLES_PER_MINUTE) b.samples[i] = ms;
    }
    const r = b.routes.get(route) || { count: 0, total: 0, max: 0 };
    r.count += 1;
    r.total += ms;
    r.max = Math.max(r.max, ms);
    b.routes.set(route, r);
  }

  /* Express middleware for /api. The live streams stay open for hours, so
     they're counted when they start, not timed. */
  function timing(req, res, next) {
    const t0 = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      record(routeName(req), ms, res.statusCode);
    });
    next();
  }

  function routeName(req) {
    const path = req.route ? req.baseUrl + req.route.path : "(unknown address)";
    return req.method + " " + (Array.isArray(path) ? path[0] : path);
  }

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  }

  function traffic(windowMinutes) {
    const from = Math.floor(now() / MINUTE) - windowMinutes + 1;
    let count = 0,
      failed = 0;
    const samples = [];
    const routes = new Map();
    const perMinute = [];
    for (let m = from; m < from + windowMinutes; m++) {
      const b = minutes.get(m);
      perMinute.push(b ? b.count : 0);
      if (!b) continue;
      count += b.count;
      failed += b.failed;
      samples.push(...b.samples);
      for (const [name, r] of b.routes) {
        const all = routes.get(name) || { count: 0, total: 0, max: 0 };
        all.count += r.count;
        all.total += r.total;
        all.max = Math.max(all.max, r.max);
        routes.set(name, all);
      }
    }
    samples.sort((a, b) => a - b);
    const round = (x) => (x == null ? null : Math.round(x * 10) / 10);
    return {
      minutes: windowMinutes,
      requests: count,
      failed,
      p50: round(percentile(samples, 50)),
      p95: round(percentile(samples, 95)),
      perMinute,
      routes: [...routes]
        .map(([name, r]) => ({ name, count: r.count, avg: round(r.total / r.count), max: round(r.max) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
    };
  }

  /* ---------- errors ---------- */

  const upsert = db.prepare(`
    INSERT INTO errors (fingerprint, source, message, place, detail, first_at, last_at, count)
    VALUES (@fingerprint, @source, @message, @place, @detail, @at, @at, 1)
    ON CONFLICT(fingerprint) DO UPDATE SET last_at = excluded.last_at, count = count + 1, detail = excluded.detail`);
  const trim = db.prepare(
    "DELETE FROM errors WHERE fingerprint NOT IN (SELECT fingerprint FROM errors ORDER BY last_at DESC LIMIT ?)",
  );

  function error(source, { message, place = "", detail = "" }) {
    const row = {
      source,
      message: clip(message, 300) || "(no message)",
      place: clip(place, 200),
      detail: clip(detail, 1200) || null,
      at: now(),
    };
    row.fingerprint = crypto
      .createHash("sha1")
      .update(row.source + "\n" + row.message + "\n" + row.place)
      .digest("hex")
      .slice(0, 16);
    try {
      upsert.run(row);
      trim.run(MAX_ERROR_ROWS);
    } catch (e) {
      // the database itself may be what's broken; the log still has it
      console.error("[monitor] couldn't save an error:", e.message);
    }
  }

  // An error object from the server: the message, and the first few stack lines
  function serverError(err, place) {
    const stack = String((err && err.stack) || "")
      .split("\n")
      .slice(1, 6)
      .map((l) => l.trim())
      .join("\n");
    error("server", { message: (err && err.message) || String(err), place, detail: stack });
  }

  function recentErrors(limit = 50) {
    return db
      .prepare(
        "SELECT source, message, place, detail, first_at AS firstAt, last_at AS lastAt, count FROM errors ORDER BY last_at DESC LIMIT ?",
      )
      .all(limit);
  }

  /* ---------- health ---------- */

  function health() {
    const problems = [];
    try {
      db.prepare("SELECT 1").get();
    } catch {
      problems.push("database");
    }
    const t = now();
    if (t - started > TIDY_LATE && (lastTidy == null || t - lastTidy > TIDY_LATE)) problems.push("housekeeping");
    if (tidyFailed) problems.push("housekeeping failed");
    const last5 = traffic(5);
    if (last5.requests >= 20 && last5.failed / last5.requests > 0.05) problems.push("many errors");
    return {
      ok: problems.length === 0,
      problems,
      version,
      uptime: Math.round((t - started) / 1000),
    };
  }

  return {
    timing,
    record,
    error,
    serverError,
    traffic,
    recentErrors,
    health,
    tidied(ok, err) {
      lastTidy = now();
      tidyFailed = ok ? null : String((err && err.message) || err);
    },
    clearErrors() {
      return db.prepare("DELETE FROM errors").run().changes;
    },
    prune() {
      return db.prepare("DELETE FROM errors WHERE last_at < ?").run(now() - 30 * 24 * 3600e3).changes;
    },
    summary(extra = {}) {
      const t = now();
      return {
        ...health(),
        started,
        lastTidy,
        tidyFailed,
        node: process.version,
        memoryMb: Math.round(process.memoryUsage().rss / 1048576),
        lastHour: traffic(60),
        errors: recentErrors(),
        at: t,
        ...extra,
      };
    },
  };
}
