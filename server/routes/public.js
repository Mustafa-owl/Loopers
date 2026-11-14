/* © 2026 NorthPoint Tech. All rights reserved.

   The API residents' phones talk to. No accounts.

     GET  /api/state                 reports, planned cuts and team news
     GET  /api/mine                  what this phone sent or tapped
     POST /api/reports               send a report (or join one already open)
     POST /api/reports/:id/photos    add a photo (JPEG body, up to 1.5 MB)
     POST /api/votes                 "Me too" / "Fine here" (tap again to undo)
     POST /api/requests              a private request for one or a few houses
     GET  /api/requests/:ref?phone=  check on a private request (last 4 digits)
     GET  /api/areas/:slug/history   the last 7 days in one neighbourhood
     GET  /api/areas/:slug/months    the last 6 months there, with the city average
     GET  /api/cuts.ics              planned cuts as a calendar (?area= &service= &lang=)
     GET  /api/cuts/:id.ics          one planned cut
     GET  /api/news?offset=          older team news, 30 at a time
     GET  /api/summary?month=        one month in the whole city
     GET  /api/sms/info              whether text / WhatsApp alerts are on, and which
     POST /api/sms/start             { phone, channel, areas, services, lang } texts a code
     POST /api/sms/confirm           { phone, code } turns the alerts on
     POST /api/sms/stop              { key } from the link in every message
     POST /api/generators/mine       { key } the owner's own generator, from their private link
     POST /api/generators/update     { key, status, hours, price, note } the owner says what it's doing
     POST /api/generators/check      { id, said: on | off } a neighbour says whether it's on at their place
     POST /api/words/mine            { link } a native speaker's language and what they've checked
     POST /api/words/review          { link, item: { key, verdict: ok | change, suggestion, note, seen, undo } }
     GET  /api/live                  live updates (Server-Sent Events)
     GET  /api/push/key              key for turning on alerts
     POST /api/push/subscribe        alerts for some neighbourhoods
     POST /api/push/unsubscribe
     POST /api/push/status           which areas this phone gets alerts for
     POST /api/errors                a script error on a resident's page
     GET  /api/health                for uptime checks: 200 when fine, 503 and
                                     what's wrong when not                   */
import zlib from "node:zlib";
import express from "express";
import { PHOTO_RULES } from "../services/photos.js";
import { isArea, isService, areaName, covers } from "../lib/places.js";
import { cutsCalendar } from "../lib/ics.js";
import { LANGS } from "../lib/text.js";
import { intParam, tooMany } from "../lib/http.js";

export function publicRoutes(s) {
  const r = express.Router();

  /* The state every page needs, rebuilt at most once a second. A busy
     evening can bring thousands of visitors; they all get the same answer. */
  let cached = null;
  let cachedAt = 0;
  const state = () => {
    const t = s.now();
    if (!cached || t - cachedAt > 1000 || t < cachedAt) {
      cached = {
        ok: true,
        now: t,
        reports: s.reports.listPublic(),
        notices: s.content.publicNotices(),
        news: s.content.publicNews(),
        newsTotal: s.content.newsCount(),
        popup: s.popups.current(),
        generators: s.generators.listPublic(),
        generatorPrices: s.generators.officialPrices(),
      };
      cachedAt = t;
    }
    return cached;
  };
  // Any change empties the cache straight away
  const forget = () => {
    cached = null;
  };
  /* The same answer as text, and squeezed, made once per rebuild rather
     than once per visitor: after a change every open page asks at once. */
  let body = null;
  const stateBody = () => {
    const st = state();
    if (!body || body.of !== st) {
      const json = JSON.stringify(st);
      body = { of: st, json, gzip: zlib.gzipSync(json) };
    }
    return body;
  };
  s.onChange(forget);

  // Older team news, a page at a time: /api/news?offset=30
  r.get("/news", (req, res) => {
    res.set("cache-control", "no-store").json({
      ok: true,
      ...s.content.newsPage({ offset: intParam(req.query.offset, { min: 0, max: 100000, fallback: 0 }), limit: 30 }),
    });
  });

  /* Planned cuts for a calendar: /api/cuts.ics?area=ankawa&service=water&lang=ckb
     (both filters optional), or one cut: /api/cuts/<id>.ics. Phones that
     subscribe to the first ask again every hour. */
  const calLang = (req) => (LANGS.includes(req.query.lang) ? req.query.lang : "en");
  r.get("/cuts.ics", (req, res) => {
    const area = isArea(req.query.area) ? req.query.area : null;
    const service = isService(req.query.service) ? req.query.service : null;
    const lang = calLang(req);
    const list = s.content
      .publicNotices()
      .filter((n) => (!service || n.service === service) && (!area || covers(n.areas, area)));
    const name = "Erbil Utilities – " + (area ? areaName(area, lang) : "Erbil");
    res
      .set("content-type", "text/calendar; charset=utf-8")
      .set("cache-control", "public, max-age=900")
      .set("content-disposition", `inline; filename="planned-cuts${area ? "-" + area : ""}.ics"`)
      .send(
        cutsCalendar(list, {
          lang,
          name,
          url: s.publicUrl ? s.publicUrl + (area ? "/area.html?a=" + area : "/") : null,
          now: s.now(),
        }),
      );
  });
  r.get("/cuts/:id.ics", (req, res) => {
    const n = s.content.publicNotices().find((x) => x.id === req.params.id);
    if (!n) return res.status(404).json({ ok: false, reason: "notFound" });
    const lang = calLang(req);
    res
      .set("content-type", "text/calendar; charset=utf-8")
      .set("content-disposition", `attachment; filename="planned-cut-${n.id}.ics"`)
      .send(cutsCalendar([n], { lang, name: "Erbil Utilities", now: s.now() }));
  });

  r.get("/state", (req, res) => {
    const b = stateBody();
    res.set({
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      vary: "Accept-Encoding",
    });
    // with content-encoding set, the compression middleware leaves it alone
    if (/\bgzip\b/.test(req.get("accept-encoding") || "")) res.set("content-encoding", "gzip").send(b.gzip);
    else res.send(b.json);
  });

  r.get("/mine", (req, res) => {
    res.json({ ok: true, ...s.reports.mine(req.who.device) });
  });

  r.post("/reports", (req, res) => {
    // A filled-in hidden field means a bot. Pretend it worked, keep nothing.
    if (req.body.website) return res.json({ ok: true, id: "r_0", merged: false });
    res.json({ ok: true, ...s.reports.create(req.body, req.who) });
  });

  r.post("/reports/:id/photos", express.raw({ type: ["image/jpeg"], limit: PHOTO_RULES.maxBytes }), (req, res) => {
    const report = s.reports.get(req.params.id);
    const photo = s.photos.add(report, Buffer.isBuffer(req.body) ? req.body : null, req.who);
    s.live.publish("photos", { service: report.service, id: photo.id }, { teamOnly: true });
    res.status(201).json({ ok: true, photo });
  });

  r.post("/votes", (req, res) => {
    res.json({ ok: true, ...s.reports.vote(req.body, req.who) });
  });

  r.post("/requests", (req, res) => {
    if (req.body.website) return res.json({ ok: true, ref: "EU-000000" });
    res.status(201).json({ ok: true, ...s.requests.create(req.body, req.who) });
  });

  r.get("/requests/:ref", (req, res) => {
    res.json({ ok: true, request: s.requests.status(req.params.ref, req.query.phone, req.who) });
  });

  r.get("/summary", (req, res) => {
    res
      .set("cache-control", "public, max-age=300")
      .json({ ok: true, summary: s.stats.citySummary(String(req.query.month || "")) });
  });
  r.get("/areas/:slug/months", (req, res) => {
    if (!isArea(req.params.slug)) return res.status(404).json({ ok: false, reason: "notFound" });
    res.set("cache-control", "public, max-age=300").json({ ok: true, ...s.stats.areaMonths(req.params.slug, 6) });
  });
  r.get("/areas/:slug/history", (req, res) => {
    if (!isArea(req.params.slug)) return res.status(404).json({ ok: false, reason: "notFound" });
    res.set("cache-control", "public, max-age=60").json({ ok: true, history: s.stats.areaHistory(req.params.slug, 7) });
  });

  /* ---------------- a generator owner's private link ----------------
     The key travels in the body, never the address, so it isn't kept in
     any log. A wrong key is 404, and tries are counted per address (generously: many phones share one address on mobile networks, and a key is far too long to guess).     */
  const ownerKey = (req) => {
    const who = "addr:" + req.who.ip;
    if (s.limits.count("genkey", who, 3600e3) >= 300) throw tooMany("wait");
    s.limits.record("genkey", who);
    return String((req.body && req.body.key) || "").slice(0, 100);
  };
  r.post("/generators/mine", (req, res) => {
    res.json({ ok: true, ...s.generators.forOwner(ownerKey(req)) });
  });
  r.post("/generators/check", (req, res) => {
    res.json({ ok: true, ...s.generators.check(req.body || {}, req.who) });
  });
  r.post("/generators/update", (req, res) => {
    res.json({ ok: true, generator: s.generators.ownerUpdate(ownerKey(req), req.body || {}) });
  });

  /* ---------------- native speakers checking the words ----------------
     The reviewer's link key travels in the body, like a generator owner's. */
  const reviewerKey = (req) => {
    const who = "addr:" + req.who.ip;
    if (s.limits.count("wordkey", who, 3600e3) >= 1200) throw tooMany("wait");
    s.limits.record("wordkey", who);
    return String((req.body && req.body.link) || "").slice(0, 100);
  };
  r.post("/words/mine", (req, res) => res.json({ ok: true, ...s.words.mine(reviewerKey(req)) }));
  r.post("/words/review", (req, res) =>
    res.json({ ok: true, ...s.words.review(reviewerKey(req), (req.body && req.body.item) || {}) }),
  );

  /* ---------------- alerts by text / WhatsApp ---------------- */
  r.get("/sms/info", (_req, res) => res.json({ ok: true, ...s.sms.info() }));
  r.post("/sms/start", async (req, res, next) => {
    try {
      if (req.body.website) return res.json({ ok: true, sent: true });
      res.json({ ok: true, ...(await s.sms.start(req.body, req.who)) });
    } catch (err) {
      next(err);
    }
  });
  r.post("/sms/confirm", async (req, res, next) => {
    try {
      res.json({ ok: true, ...(await s.sms.confirm(req.body)) });
    } catch (err) {
      next(err);
    }
  });
  r.post("/sms/stop", (req, res) => res.json({ ok: true, ...s.sms.stop(req.body.key) }));

  r.get("/live", (req, res) => s.live.connect(req, res));

  r.get("/push/key", (_req, res) => res.json({ ok: true, key: s.push.publicKey }));

  // A phone subscribes once; 60 an hour from one address leaves room for a shared mobile address
  r.post("/push/subscribe", (req, res) => {
    if (s.limits.count("push:ip", req.who.ip, 3600e3) >= 60) throw tooMany("wait");
    s.limits.record("push:ip", req.who.ip);
    const { isNew, ...saved } = s.push.subscribe(req.body);
    if (isNew) s.push.welcome(req.body.subscription.endpoint).catch(() => {});
    res.json({ ok: true, ...saved });
  });

  r.post("/push/unsubscribe", (req, res) => {
    s.push.unsubscribe(req.body.endpoint);
    res.json({ ok: true });
  });

  r.post("/push/status", (req, res) => {
    res.json({ ok: true, subscription: s.push.find(req.body.endpoint) });
  });

  /* Script errors from residents' pages, so the team hears about a broken
     page before a resident has to say so. Only the message, the page and
     the script line are kept; at most 10 an hour from one browser. */
  r.post("/errors", (req, res) => {
    const b = req.body || {};
    const who = req.who.device;
    if (s.limits.count("jserr", who, 3600e3) >= 10) return res.status(204).end();
    s.limits.record("jserr", who);
    const page = String(b.page || "").replace(/[?#].*$/, "");
    const at = b.file
      ? `${String(b.file)
          .replace(/^https?:\/\/[^/]+/, "")
          .replace(/\?.*$/, "")}:${Number(b.line) || 0}`
      : "";
    s.monitor.error("browser", {
      message: b.message,
      place: [page, at].filter(Boolean).join(" "),
      detail: [b.stack, b.agent].filter(Boolean).join("\n"),
    });
    res.status(204).end();
  });

  r.get("/health", (_req, res) => {
    const h = s.monitor.health();
    res.status(h.ok ? 200 : 503).json({ ...h, live: s.live.size });
  });

  return r;
}
