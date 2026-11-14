/* © 2026 NorthPoint Tech. All rights reserved.

   Alerts on residents' phones (Web Push). A resident picks their
   neighbourhood on the site and allows notifications; their browser gives
   us a subscription, which we keep here with the areas they care about.

   We send an alert when
     • a team adds a planned cut in one of their areas, and
     • no power / no water there becomes confirmed (2+ people or the team).
   The same alert for the same area goes out at most once every 3 hours.

   Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env, or made on first
   start and kept in the settings table.                                   */
import webpush from "web-push";
import { getSetting, setSetting, fromJson } from "../db/index.js";
import { isArea, isService, SERVICES, covers } from "../lib/places.js";
import { message, areasText, timeRange, pickLang } from "../lib/messages.js";
import { LANGS } from "../lib/text.js";
import { HOUR } from "../lib/time.js";
import { badRequest } from "../lib/http.js";

const SAME_ALERT_GAP = 3 * HOUR;
const MAX_FAILURES = 3;

export function createPush({ db, config, now, send = null }) {
  let publicKey = config.vapid.publicKey || getSetting(db, "vapid_public_key");
  let privateKey = config.vapid.privateKey || getSetting(db, "vapid_private_key");
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    setSetting(db, "vapid_public_key", publicKey);
    setSetting(db, "vapid_private_key", privateKey);
    console.log("[push] made new notification keys and saved them in the database");
  }
  webpush.setVapidDetails(config.vapid.subject, publicKey, privateKey);
  // Tests pass their own `send` so nothing leaves the machine.
  const deliver =
    send || ((sub, payload) => webpush.sendNotification(sub, payload, { TTL: 6 * 3600, urgency: "high" }));

  const upsert =
    db.prepare(`INSERT INTO push_subscriptions (endpoint, p256dh, auth, areas, services, lang, general, created_at)
    VALUES (@endpoint, @p256dh, @auth, @areas, @services, @lang, @general, @at)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
      areas = excluded.areas, services = excluded.services, lang = excluded.lang, general = excluded.general, failures = 0`);

  // Only the browsers' own push services (config.vapid.hosts; "*." covers subdomains)
  const hosts = (config.vapid && config.vapid.hosts) || [];
  function knownHost(endpoint) {
    let host;
    try {
      const u = new URL(endpoint);
      if (u.protocol !== "https:" || u.port || u.username) return false;
      host = u.hostname.toLowerCase();
    } catch (e) {
      return false;
    }
    return hosts.some((h) =>
      h.startsWith("*.") ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h,
    );
  }

  function subscribe(body) {
    const sub = body && body.subscription;
    const endpoint = sub && String(sub.endpoint || "");
    const keys = (sub && sub.keys) || {};
    if (!/^https:\/\/\S{10,600}$/.test(endpoint) || !keys.p256dh || !keys.auth) throw badRequest("badSubscription");
    if (!knownHost(endpoint)) throw badRequest("badSubscription");
    const areas = [...new Set((body.areas || []).filter(isArea))].slice(0, 5);
    const services = [...new Set((body.services || SERVICES).filter(isService))];
    // important messages from the admins: on unless they turned them off
    const general = body.general === false ? 0 : 1;
    // a phone can follow neighbourhoods, or only want the important messages, but not nothing
    if ((!areas.length || !services.length) && !general) throw badRequest("needAreas");
    const lang = LANGS.includes(body.lang) ? body.lang : "en";
    const isNew = !db.prepare("SELECT 1 FROM push_subscriptions WHERE endpoint = ?").get(endpoint);
    upsert.run({
      endpoint,
      p256dh: String(keys.p256dh).slice(0, 200),
      auth: String(keys.auth).slice(0, 100),
      areas: JSON.stringify(areas),
      services: JSON.stringify(services.length ? services : SERVICES),
      lang,
      general,
      at: now(),
    });
    return { areas, services: services.length ? services : SERVICES, lang, general: !!general, isNew };
  }

  function unsubscribe(endpoint) {
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(String(endpoint || ""));
  }

  function find(endpoint) {
    const row = db
      .prepare("SELECT areas, services, lang, general FROM push_subscriptions WHERE endpoint = ?")
      .get(String(endpoint || ""));
    return row
      ? { areas: fromJson(row.areas, []), services: fromJson(row.services, []), lang: row.lang, general: !!row.general }
      : null;
  }

  // Everyone who follows any of these areas for this service
  function audience(service, areas) {
    return db
      .prepare("SELECT * FROM push_subscriptions")
      .all()
      .filter((s) => {
        const theirs = fromJson(s.areas, []);
        return fromJson(s.services, []).includes(service) && theirs.some((a) => covers(areas, a));
      });
  }

  async function sendTo(subs, build) {
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        const payload = JSON.stringify(build(s));
        try {
          await deliver({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          db.prepare("UPDATE push_subscriptions SET last_sent_at = ?, failures = 0 WHERE endpoint = ?").run(
            now(),
            s.endpoint,
          );
          sent += 1;
        } catch (err) {
          // 404/410: the phone unsubscribed or the browser was reset
          if (err && (err.statusCode === 404 || err.statusCode === 410)) unsubscribe(s.endpoint);
          else db.prepare("UPDATE push_subscriptions SET failures = failures + 1 WHERE endpoint = ?").run(s.endpoint);
        }
      }),
    );
    db.prepare("DELETE FROM push_subscriptions WHERE failures >= ?").run(MAX_FAILURES);
    return sent;
  }

  // true the first time in SAME_ALERT_GAP for this key, false after that
  function claim(key) {
    const t = now();
    const prev = db.prepare("SELECT sent_at FROM alerts_sent WHERE key = ?").pluck().get(key);
    if (prev && t - prev < SAME_ALERT_GAP) return false;
    db.prepare(
      "INSERT INTO alerts_sent (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at",
    ).run(key, t);
    return true;
  }

  const link = (path) => (config.publicUrl || "") + path;

  return {
    publicKey,
    subscribe,
    unsubscribe,
    find,

    async outage(report) {
      if (!claim(`out:${report.service}:${report.area}`)) return 0;
      const subs = audience(report.service, [report.area]);
      return sendTo(subs, (s) => ({
        title: message("out." + report.service, s.lang, { area: areasText([report.area], s.lang) }),
        body: message("out.body", s.lang, { n: report.people }),
        url: link(`/area.html?a=${encodeURIComponent(report.area)}`),
        tag: `out-${report.service}-${report.area}`,
      }));
    },

    // The team says a crew is on it. Once per report, to the same people the
    // outage alert went to.
    async fixing(report) {
      if (!claim(`fix:${report.id}`)) return 0;
      const subs = audience(report.service, [report.area]);
      return sendTo(subs, (s) => ({
        title: message("fix.title", s.lang, { area: areasText([report.area], s.lang) }),
        body: message("fix." + report.service, s.lang),
        url: link(`/area.html?a=${encodeURIComponent(report.area)}`),
        tag: `out-${report.service}-${report.area}`,
      }));
    },

    async plannedCut(notice) {
      if (!claim(`cut:${notice.id}`)) return 0;
      const subs = audience(notice.service, notice.areas);
      return sendTo(subs, (s) => {
        const mine = notice.areas.includes("all")
          ? ["all"]
          : notice.areas.filter((a) => fromJson(s.areas, []).includes(a));
        return {
          title: message("cut." + notice.service, s.lang, { area: areasText(mine, s.lang) }),
          body: message("cut.body", s.lang, {
            when: timeRange(notice.from, notice.to, s.lang),
            reason: pickLang(notice.reason, s.lang),
          }),
          url: link(mine[0] && mine[0] !== "all" ? `/area.html?a=${encodeURIComponent(mine[0])}` : "/#notices-sec"),
          tag: `cut-${notice.id}`,
        };
      });
    },

    // A generator in a followed area has started running
    async generator(gen) {
      if (!claim(`gen:${gen.id}`)) return 0;
      const subs = audience("electricity", [gen.area]);
      return sendTo(subs, (s) => {
        // "16:00–01:00, 05:00–08:00", with the Arabic comma in Sorani and Arabic
        const hours = gen.hours.map((h) => `${h.from}–${h.to}`).join(s.lang === "ckb" || s.lang === "ar" ? "، " : ", ");
        return {
          title: message("gen.title", s.lang, { area: areasText([gen.area], s.lang) }),
          body: message("gen.body", s.lang, {
            name: gen.name,
            hours: hours ? message("gen.hours", s.lang, { hours }) : "",
          }),
          url: link(`/area.html?a=${encodeURIComponent(gen.area)}#generators`),
          tag: `gen-${gen.id}`,
        };
      });
    },

    // A pop-up message from the admins, to every phone that gets alerts,
    // in that phone's language (or the first one written)
    async broadcast(popup) {
      const subs = db.prepare("SELECT * FROM push_subscriptions WHERE general = 1").all();
      const pick = (o, lang) => (o ? o[lang] || o.en || o.any || Object.values(o)[0] : "");
      return sendTo(subs, (s) => ({
        title: (popup.kind === "urgent" ? message("urgent", s.lang) + ": " : "") + pick(popup.title, s.lang),
        body: pick(popup.body, s.lang),
        // a tap only ever opens our own pages; a link to another site opens the home page, where the message is showing
        url: link(popup.link && popup.link.startsWith("/") ? popup.link : "/"),
        tag: `popup-${popup.id}`,
        ...(popup.kind === "urgent" ? { urgent: true } : {}),
      }));
    },

    // Sent right after someone subscribes, so they know it works
    async welcome(endpoint) {
      const s = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?").get(endpoint);
      if (!s) return 0;
      return sendTo([s], () => ({
        title: message("test.title", s.lang),
        body: fromJson(s.areas, []).length
          ? message("test.body", s.lang, { area: areasText(fromJson(s.areas, []), s.lang) })
          : message("test.general", s.lang),
        url: link("/"),
        tag: "welcome",
      }));
    },

    count: () => db.prepare("SELECT COUNT(*) FROM push_subscriptions").pluck().get(),
    generalCount: () => db.prepare("SELECT COUNT(*) FROM push_subscriptions WHERE general = 1").pluck().get(),
  };
}
