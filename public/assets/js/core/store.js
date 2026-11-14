/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: talking to the server
  --------------------------------------
  Store keeps the live picture (reports, planned cuts, team news) and sends
  what the visitor does: reports, "Me too" / "Fine here", private requests,
  photos.

  • On open it loads /api/state, then listens on /api/live. When the server
    says something changed, it reloads (a few hundred ms later, so a burst
    of changes is one reload). If the live line drops it falls back to
    checking every 45 seconds.
  • The last good state is kept on the phone. During a power cut the
    connection is often the first thing to go, so the site still shows
    what it last knew, with the time it was saved (see Store.status).
  • The server has the final say on every rule (server/services/*.js).
    The checks here only exist so people get an answer straight away.

  Pages subscribe with Store.onChange(fn).
*/

(function () {
  "use strict";
  const EU = window.EU;
  const MIN = 60e3;
  const HOUR = 60 * MIN;

  // The same timings as the server, for deciding what's still worth showing
  const LIMITS = { unconfirmedFor: 6 * HOUR, confirmedFor: 24 * HOUR };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode: fine */
    }
  }

  /* This browser's own random code, so the server can tell "the same phone"
     apart for the limits without knowing anything about the person. */
  let device = read("eu.device", "");
  if (!device) {
    device = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    write("eu.device", device);
  }

  const server = { reports: [], notices: [], news: [], popup: null, generators: [], generatorPrices: {}, at: 0 };
  let sent = read("eu.sent", []); // ids of reports this phone sent
  let votes = read("eu.votes", {}); // { [reportId]: "metoo" | "fine" }
  let status = "loading"; // loading | live | offline
  const listeners = [];
  const BUILT_IN_NEWS = EU.NEWS.slice();

  /* ---------------- requests to the server ---------------- */

  function api(path, { method = "GET", body, raw, type, timeout = 10000 } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { "x-device": device };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (raw) headers["content-type"] = type;
    return fetch(path, {
      method,
      headers,
      cache: "no-store",
      signal: ctrl.signal,
      body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
    })
      .then(async (res) => {
        const json = (res.headers.get("content-type") || "").includes("json") ? await res.json() : null;
        if (!json) throw new Error("noApi");
        return json;
      })
      .finally(() => clearTimeout(timer));
  }

  /* ---------------- the live picture ---------------- */

  /* The phone's clock can be wrong by hours. Reports are aged against the
     server's clock instead: we keep how far the phone is off.            */
  let skew = read("eu.skew", 0);
  const serverNow = () => Date.now() + skew;

  function useState(st, fresh = false) {
    if (fresh && st.now) {
      skew = st.now - Date.now();
      write("eu.skew", skew);
    }
    server.reports = st.reports || [];
    server.notices = st.notices || [];
    server.news = st.news || [];
    server.popup = st.popup || null;
    server.generators = st.generators || [];
    server.generatorPrices = st.generatorPrices || {};
    server.newsTotal = st.newsTotal || server.news.length;
    server.at = st.now || Date.now();
    // team news first, newest first, then the stories built into the site
    EU.NEWS.length = 0;
    EU.NEWS.push(...server.news, ...BUILT_IN_NEWS);
    // forget taps on reports that have gone (only from a fresh answer: a
    // saved copy may be older than the tap)
    if (!fresh) return;
    const ids = new Set(server.reports.map((r) => r.id));
    let changed = false;
    for (const id of Object.keys(votes))
      if (!ids.has(id)) {
        delete votes[id];
        changed = true;
      }
    if (changed) write("eu.votes", votes);
  }

  const saved = read("eu.state", null);
  if (saved && saved.reports) useState(saved);

  function setStatus(next) {
    if (next === status) return;
    status = next;
    document.dispatchEvent(new CustomEvent("eu:status", { detail: next }));
  }

  let loading = null;
  function refresh() {
    if (loading) return loading;
    loading = api("/api/state")
      .then((st) => {
        if (!st.ok) throw new Error("bad");
        useState(st, true);
        write("eu.state", st);
        setStatus("live");
        emit();
      })
      .catch(() => {
        setStatus("offline");
        emit();
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  /* Live updates. EventSource reconnects by itself; while it's down we
     fall back to asking every 45 seconds. */
  let source = null;
  let soon = null;
  function listen() {
    if (!("EventSource" in window) || source) return;
    source = new EventSource("/api/live");
    source.addEventListener("change", (e) => {
      let info = {};
      try {
        info = JSON.parse(e.data);
      } catch (err) {
        /* still reload */
      }
      /* Not every open page at the same moment: a city of phones hears
         this together, so each waits its own short while before asking. */
      clearTimeout(soon);
      soon = setTimeout(refresh, 300 + Math.random() * 1700);
      document.dispatchEvent(new CustomEvent("eu:change", { detail: info }));
    });
    source.addEventListener("hello", () => {
      if (status !== "live") refresh();
    });
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        source = null;
        setTimeout(listen, 10000);
      }
    };
  }

  setInterval(() => {
    if (document.hidden) return;
    if (!source || source.readyState !== EventSource.OPEN) refresh();
    else emit(); // keeps "12 min ago" true while the page is open
  }, 45e3);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("online", refresh);
  window.addEventListener("offline", () => setStatus("offline"));

  /* ---------------- reading it ---------------- */

  function all() {
    const now = serverNow();
    return server.reports
      .map((r) => Object.assign({}, r, { sentByMe: sent.includes(r.id), myVote: votes[r.id] || null }))
      .filter((r) => now - r.last < (r.confirmed ? LIMITS.confirmedFor : LIMITS.unconfirmedFor))
      .sort((a, b) => b.last - a.last);
  }

  function isOut(r) {
    const p = EU.PROBLEMS[r.service].find((x) => x.key === r.problem);
    return !!(p && p.out);
  }

  /* State of one service in one neighbourhood:
       out          confirmed reports of no power / no water
       trouble      confirmed reports of other problems
       unconfirmed  only one-person reports so far
       back         today's reports were closed as fine
       none         nothing in the last day                                */
  function serviceState(slug, service, list) {
    const items = (list || all()).filter((r) => r.area === slug && r.service === service);
    const open = items.filter((r) => !r.resolved);
    const confirmed = open.filter((r) => r.confirmed);
    let state = "none";
    if (confirmed.some(isOut)) state = "out";
    else if (confirmed.length) state = "trouble";
    else if (open.length) state = "unconfirmed";
    else if (items.length) state = "back";
    const people = open.reduce((s, r) => s + r.people, 0);
    return { state, open, items, people, last: open.length ? open[0].last : null };
  }

  function areaStatus(slug, list) {
    list = list || all();
    return { electricity: serviceState(slug, "electricity", list), water: serviceState(slug, "water", list) };
  }

  // The open report a new one would join, if there is one
  function findOpen(area, service, problem) {
    // all() already holds only reports still open; the server merges into any of them
    return all().find((r) => r.area === area && r.service === service && r.problem === problem && !r.resolved) || null;
  }

  // Planned cuts that matter now: running, or starting in the next 24 hours
  function notices(slug, service) {
    const now = Date.now();
    return (
      server.notices
        .filter((n) => n.to > now && n.from < now + 24 * HOUR)
        // "all" is every neighbourhood of Erbil, never the other cities
        .filter(
          (n) => !slug || n.areas.includes(slug) || (n.areas.includes("all") && (EU.area(slug) || {}).city === "erbil"),
        )
        .filter((n) => !service || n.service === service)
        .map((n) => Object.assign({}, n, { now: n.from <= now }))
        .sort((a, b) => a.from - b.from)
    );
  }

  // Everything still to come, for the announcements on the home page
  function upcoming() {
    const now = Date.now();
    return server.notices
      .filter((n) => n.to > now)
      .map((n) => Object.assign({}, n, { now: n.from <= now }))
      .sort((a, b) => a.from - b.from);
  }

  /* ---------------- sending ---------------- */

  const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|iq|krd|me|io|ly|link)\b|t\.me\/|wa\.me\/)/i;

  // Send a report. Resolves to { ok, id, merged } or { ok: false, reason, wait }.
  function add({ area, service, problem, note, website, spot }) {
    if (note && LINK_RE.test(note)) return Promise.resolve({ ok: false, reason: "noLinks" });
    return api("/api/reports", { method: "POST", body: { area, service, problem, note, website, spot } })
      .then((res) => {
        if (!res.ok) {
          if (res.reason === "already" && res.id) {
            votes[res.id] = votes[res.id] || "metoo";
            write("eu.votes", votes);
          }
          return res;
        }
        if (res.merged) {
          votes[res.id] = "metoo";
          write("eu.votes", votes);
        } else {
          sent = sent.concat(res.id).slice(-50);
          write("eu.sent", sent);
        }
        replace(res.report);
        emit();
        return res;
      })
      .catch(() => {
        // No connection: keep it on the phone and send it when the connection is back
        if (navigator.onLine === false || status === "offline") return keep({ area, service, problem, note, spot });
        return { ok: false, reason: "busy" };
      });
  }

  /* ---------------- reports made offline ----------------
     A report that couldn't be sent waits here (at most 3, for 12 hours:
     after that an outage report is no use to anyone). They go out one at
     a time when the connection comes back, a minute apart because the
     server takes one report a minute from each phone. Private requests
     are never kept here, because they hold a name and a phone number. */
  const QUEUE = "eu.queue";
  const KEEP_FOR = 12 * 36e5;
  let flushing = false;
  function waiting() {
    return read(QUEUE, []).filter((q) => Date.now() - q.at < KEEP_FOR);
  }
  function keep(report) {
    const list = waiting();
    if (list.length >= 3) return { ok: false, reason: "queueFull" };
    if (!list.some((q) => q.area === report.area && q.service === report.service && q.problem === report.problem)) {
      list.push({ ...report, at: Date.now() });
      write(QUEUE, list);
    }
    document.dispatchEvent(new CustomEvent("eu:queue", { detail: { count: list.length } }));
    return { ok: false, reason: "queued", waiting: list.length };
  }
  async function flush() {
    if (flushing || navigator.onLine === false) return;
    let list = waiting();
    write(QUEUE, list);
    if (!list.length) return;
    flushing = true;
    try {
      while (list.length) {
        const q = list[0];
        let res;
        try {
          res = await api("/api/reports", {
            method: "POST",
            body: { area: q.area, service: q.service, problem: q.problem, note: q.note, spot: q.spot },
          });
        } catch (e) {
          break;
        } // still offline: try again later
        if (res.ok || res.reason !== "wait") {
          // sent, or refused for good (already reported, bad input)
          list = waiting().filter((x) => x.at !== q.at);
          write(QUEUE, list);
          if (res.ok) {
            if (res.merged) votes[res.id] = "metoo";
            else sent = sent.concat(res.id).slice(-50);
            write("eu.votes", votes);
            write("eu.sent", sent);
            replace(res.report);
            emit();
          }
          document.dispatchEvent(
            new CustomEvent("eu:queue", { detail: { count: list.length, sent: res.ok ? q : null } }),
          );
        }
        if (list.length) await new Promise((r) => setTimeout(r, ((res && res.wait) || 61) * 1000));
      }
    } finally {
      flushing = false;
    }
  }
  window.addEventListener("online", () => setTimeout(flush, 1500));
  setTimeout(flush, 3000);

  function replace(rep) {
    if (!rep) return;
    const i = server.reports.findIndex((x) => x.id === rep.id);
    if (i >= 0) server.reports[i] = rep;
    else server.reports.unshift(rep);
  }

  /* "Me too" / "Fine here". Shown straight away, put back if the server
     says no. Tapping the same one again takes it back. */
  function vote(id, kind) {
    const r = server.reports.find((x) => x.id === id);
    if (!r) return { ok: false };
    if (kind === "metoo" && sent.includes(id)) return { ok: false, reason: "own" };
    const before = votes[id] || null;
    const after = before === kind ? null : kind;
    const snapshot = Object.assign({}, r);
    if (before === "metoo") r.people -= 1;
    if (before === "fine") r.fine -= 1;
    if (after === "metoo") r.people += 1;
    if (after === "fine") r.fine += 1;
    r.confirmed = r.people >= 2 || r.teamConfirmed;
    if (after) votes[id] = after;
    else delete votes[id];
    write("eu.votes", votes);
    emit();

    api("/api/votes", { method: "POST", body: { id, kind } })
      .then((res) => {
        if (!res.ok) throw Object.assign(new Error(res.reason), { reason: res.reason });
        if (res.myVote) votes[id] = res.myVote;
        else delete votes[id];
        write("eu.votes", votes);
        replace(res.report);
        emit();
      })
      .catch((err) => {
        Object.assign(r, snapshot);
        if (before) votes[id] = before;
        else delete votes[id];
        write("eu.votes", votes);
        emit();
        if (EU.toast) EU.toast(EU.t("report." + (err.reason === "tooMany" ? "tooMany" : "busy")));
      });
    return { ok: true };
  }

  /* A neighbour says whether a generator is on at their place. The same
     again takes it back. Kept on the phone so the button shows pressed. */
  let genChecks = read("eu.genChecks", {}); // { [id]: { said, at } } in server time
  const CHECK_WINDOW = 2 * 3600e3;
  function myGenCheck(g) {
    const c = genChecks[g.id];
    return c && c.at > serverNow() - CHECK_WINDOW && c.at >= (g.statusAt || 0) ? c.said : null;
  }
  function genCheck(id, said) {
    return api("/api/generators/check", { method: "POST", body: { id, said } }).then((res) => {
      if (!res.ok) return res;
      if (res.mine) genChecks[id] = { said: res.mine, at: serverNow() };
      else delete genChecks[id];
      // forget old taps
      for (const k of Object.keys(genChecks)) if (genChecks[k].at < serverNow() - CHECK_WINDOW) delete genChecks[k];
      write("eu.genChecks", genChecks);
      const i = server.generators.findIndex((g) => g.id === id);
      if (i >= 0) server.generators[i] = res.generator;
      emit();
      return res;
    });
  }

  // A private request (one house, or a few) for the team's inbox
  function sendRequest(req) {
    return api("/api/requests", { method: "POST", body: Object.assign({ lang: EU.lang }, req) })
      .then((res) => {
        if (res.ok) {
          const mine = read("eu.requests", []);
          mine.unshift({
            ref: res.ref,
            last4: res.phone.slice(-4),
            at: Date.now(),
            service: req.service,
            area: req.area,
          });
          write("eu.requests", mine.slice(0, 5));
        }
        return res;
      })
      .catch(() => ({ ok: false, reason: "busy" }));
  }

  function requestStatus(ref, last4) {
    return api("/api/requests/" + encodeURIComponent(ref) + "?phone=" + encodeURIComponent(last4)).catch(() => ({
      ok: false,
      reason: "busy",
    }));
  }

  // The requests this phone sent recently, so people don't need to write the reference down
  function myRequests() {
    return read("eu.requests", []);
  }

  // A photo for a report this phone sent or joined. `blob` is a JPEG.
  function addPhoto(reportId, blob) {
    return api("/api/reports/" + encodeURIComponent(reportId) + "/photos", {
      method: "POST",
      raw: blob,
      type: "image/jpeg",
      timeout: 30000,
    }).catch(() => ({ ok: false, reason: "busy" }));
  }

  function onChange(fn) {
    listeners.push(fn);
  }
  function emit() {
    listeners.forEach((fn) => fn());
  }

  // keep tabs in sync
  window.addEventListener("storage", (e) => {
    if (e.key === "eu.votes") votes = read("eu.votes", {});
    if (e.key === "eu.sent") sent = read("eu.sent", []);
    if (e.key === "eu.votes" || e.key === "eu.sent") emit();
  });

  refresh().then(listen);

  EU.Store = {
    all,
    areaStatus,
    serviceState,
    isOut,
    findOpen,
    notices,
    upcoming,
    add,
    vote,
    onChange,
    refresh,
    popup: () => server.popup,
    // neighbourhood generators, in one area or everywhere, and the committee's price in a city
    generators: (slug) => server.generators.filter((g) => !slug || g.area === slug),
    generatorPrice: (city) => server.generatorPrices[city] || null,
    genCheck,
    myGenCheck,
    waiting,
    flush,
    // team news on the server in all, and how many came with the live state
    newsTotal: () => server.newsTotal || 0,
    newsLoaded: () => server.news.length,
    sendRequest,
    requestStatus,
    myRequests,
    addPhoto,
    api,
    LIMITS,
    get status() {
      return status;
    },
    get savedAt() {
      return server.at;
    },
    get device() {
      return device;
    },
  };
})();
