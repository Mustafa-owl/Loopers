/* © 2026 NorthPoint Tech. All rights reserved.

   Alerts by text message or WhatsApp, for people whose phones can't take
   push notifications (older phones, iPhones without the site on the Home
   Screen, people who just prefer a text).

   How it works for the resident: they give a number and the
   neighbourhoods to follow, we text a 6-digit code, they type it in, and
   from then on they get the same alerts as push: no power or no water
   confirmed there, and planned cuts. Every message ends with a link that
   stops them in one tap. At most 4 messages a day go to one number.

   Sending goes through a provider set in .env (see .env.example):
     SMS_PROVIDER=webhook   POST { to, channel, text } to SMS_WEBHOOK_URL,
                            for any local gateway (Korek, Asiacell, Zain
                            resellers, or your own)
     SMS_PROVIDER=twilio    Twilio's API, SMS and/or WhatsApp
   With no provider the feature is off and the option isn't shown.     */
import { randomInt } from "node:crypto";
import { randomToken, sha256 } from "../lib/crypto.js";
import { cleanPhone, LANGS } from "../lib/text.js";
import { isArea, isService, covers } from "../lib/places.js";
import { message, areasText, timeRange, pickLang } from "../lib/messages.js";
import { badRequest, notFound, tooMany } from "../lib/http.js";
import { fromJson } from "../db/index.js";
import { MINUTE, HOUR, DAY } from "../lib/time.js";

export const SMS_RULES = {
  perDay: 4,
  codeMinutes: 15,
  codeTries: 5,
  startsPerHour: 3,
  startsPerNumberPerDay: 3,
  maxAreas: 5,
};

const TEXT = {
  code: {
    en: "Erbil Utilities: your code is {code}. It works for 15 minutes.",
    ckb: "خزمەتگوزارییەکانی هەولێر: کۆدەکەت: {code}. بۆ ١٥ خولەک کار دەکات.",
    kmr: "Karûbarên Hewlêrê: koda te {code} e. 15 deqîqeyan derbasdar e.",
    ar: "خدمات أربيل: رمزك {code}. صالح لمدة ١٥ دقيقة.",
  },
  on: {
    en: "Erbil Utilities: alerts for {area} are on. You can stop them any time with the link below.",
    ckb: "خزمەتگوزارییەکانی هەولێر: ئاگادارکردنەوەی {area} چالاک کرا. هەر کاتێک بتەوێت بە بەستەرەکەی خوارەوە ڕایبگرە.",
    kmr: "Karûbarên Hewlêrê: hişyariyên {area} vekirî ne. Kengê bixwazî bi girêdana li jêr rawestîne.",
    ar: "خدمات أربيل: تنبيهات {area} مفعّلة. يمكنك إيقافها متى شئت بالرابط أدناه.",
  },
  stop: { en: "Stop: {stop}", ckb: "ڕاگرتن: {stop}", kmr: "Rawestîne: {stop}", ar: "إيقاف: {stop}" },
};
const say = (key, lang, params) => (TEXT[key][lang] || TEXT[key].en).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");

export function createSms({ db, config, limits, now, send = null }) {
  const cfg = config.sms || {};
  const provider = cfg.provider || "";
  const channels =
    provider === "twilio"
      ? [cfg.twilioFrom && "sms", cfg.twilioWhatsapp && "whatsapp"].filter(Boolean)
      : provider === "webhook"
        ? cfg.webhookChannels || ["sms"]
        : [];
  const enabled = () => channels.length > 0;
  const base = (config.publicUrl || "").replace(/\/+$/, "");
  const stopLink = (key) => `${base}/stop.html?k=${key}`;
  const e164 = (phone) => "+964" + phone.slice(1);

  // The one place a message leaves the server
  async function deliver(phone, channel, text) {
    if (send) return send({ to: e164(phone), channel, text });
    if (provider === "webhook") {
      const res = await fetch(cfg.webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(cfg.webhookToken ? { authorization: "Bearer " + cfg.webhookToken } : {}),
        },
        body: JSON.stringify({ to: e164(phone), channel, text }),
      });
      if (!res.ok) throw new Error("gateway " + res.status);
      return;
    }
    if (provider === "twilio") {
      const from = channel === "whatsapp" ? "whatsapp:" + cfg.twilioWhatsapp : cfg.twilioFrom;
      const to = channel === "whatsapp" ? "whatsapp:" + e164(phone) : e164(phone);
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.twilioSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: "Basic " + Buffer.from(cfg.twilioSid + ":" + cfg.twilioToken).toString("base64"),
          },
          body: new URLSearchParams({ From: from, To: to, Body: text }),
        },
      );
      if (!res.ok) throw new Error("twilio " + res.status);
      return;
    }
    throw new Error("no provider");
  }

  const sentToday = (phone) =>
    db
      .prepare("SELECT COUNT(*) FROM sms_sent WHERE phone = ? AND at > ?")
      .pluck()
      .get(phone, now() - DAY);
  async function alert(sub, text, kind) {
    if (sentToday(sub.phone) >= SMS_RULES.perDay) return false;
    try {
      await deliver(sub.phone, sub.channel, text + "\n" + say("stop", sub.lang, { stop: stopLink(sub.stop_key) }));
      db.prepare("INSERT INTO sms_sent (phone, at, kind) VALUES (?, ?, ?)").run(sub.phone, now(), kind);
      db.prepare("UPDATE sms_subscriptions SET last_sent_at = ?, failures = 0 WHERE id = ?").run(now(), sub.id);
      return true;
    } catch (e) {
      db.prepare("UPDATE sms_subscriptions SET failures = failures + 1 WHERE id = ?").run(sub.id);
      return false;
    }
  }
  function audience(service, areas) {
    return db
      .prepare("SELECT * FROM sms_subscriptions WHERE verified_at IS NOT NULL AND failures < 5")
      .all()
      .filter((s) => fromJson(s.services, []).includes(service) && fromJson(s.areas, []).some((a) => covers(areas, a)));
  }
  // the same alert goes out once in 3 hours, like push
  function claim(key) {
    const t = now();
    const prev = db.prepare("SELECT sent_at FROM alerts_sent WHERE key = ?").pluck().get(key);
    if (prev && t - prev < 3 * HOUR) return false;
    db.prepare(
      "INSERT INTO alerts_sent (key, sent_at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET sent_at = excluded.sent_at",
    ).run(key, t);
    return true;
  }

  return {
    info: () => ({ enabled: enabled(), channels }),
    count: () => db.prepare("SELECT COUNT(*) FROM sms_subscriptions WHERE verified_at IS NOT NULL").pluck().get(),

    // Step 1: a number and what to follow; we text a code
    async start(input, who) {
      if (!enabled()) throw notFound("smsOff");
      const phone = cleanPhone(input.phone);
      if (!phone) throw badRequest("needPhone");
      const areas = (Array.isArray(input.areas) ? input.areas : []).filter(isArea).slice(0, SMS_RULES.maxAreas);
      const services = (Array.isArray(input.services) ? input.services : []).filter(isService);
      if (!areas.length) throw badRequest("needArea");
      if (!services.length) throw badRequest("needService");
      const channel = channels.includes(input.channel) ? input.channel : channels[0];
      const lang = LANGS.includes(input.lang) ? input.lang : "en";
      if (
        limits.count("sms:start", who.device, HOUR) >= SMS_RULES.startsPerHour ||
        limits.count("sms:start:ip", who.ip, HOUR) >= SMS_RULES.startsPerHour * 5 ||
        limits.count("sms:number", phone, DAY) >= SMS_RULES.startsPerNumberPerDay
      )
        throw tooMany("slowDown");
      const code = String(randomInt(100000, 1000000));
      const t = now();
      const row = db.prepare("SELECT * FROM sms_subscriptions WHERE phone = ?").get(phone);
      if (row) {
        // what to follow changes only once the code proves the number is theirs
        db.prepare(
          "UPDATE sms_subscriptions SET code_hash = ?, code_expires = ?, code_tries = 0, channel = ?, lang = ?, pending_areas = ?, pending_services = ? WHERE id = ?",
        ).run(
          sha256(phone + ":" + code),
          t + SMS_RULES.codeMinutes * MINUTE,
          channel,
          lang,
          JSON.stringify(areas),
          JSON.stringify(services),
          row.id,
        );
      } else {
        db.prepare(
          `INSERT INTO sms_subscriptions (phone, channel, areas, services, pending_areas, pending_services, lang, code_hash, code_expires, stop_key, created_at)
          VALUES (?, ?, '[]', '[]', ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          phone,
          channel,
          JSON.stringify(areas),
          JSON.stringify(services),
          lang,
          sha256(phone + ":" + code),
          t + SMS_RULES.codeMinutes * MINUTE,
          randomToken(16),
          t,
        );
      }
      limits.record("sms:start", who.device);
      limits.record("sms:start:ip", who.ip);
      limits.record("sms:number", phone);
      await deliver(phone, channel, say("code", lang, { code }));
      return { sent: true, channel };
    },

    // Step 2: the code proves it's their number
    async confirm(input) {
      if (!enabled()) throw notFound("smsOff");
      const phone = cleanPhone(input.phone);
      const row = phone && db.prepare("SELECT * FROM sms_subscriptions WHERE phone = ?").get(phone);
      if (!row || !row.code_hash) throw badRequest("badCode");
      if (row.code_expires < now()) throw badRequest("codeExpired");
      if (row.code_tries >= SMS_RULES.codeTries) throw tooMany("slowDown");
      const code = String(input.code || "")
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
        .replace(/\D/g, "");
      if (sha256(phone + ":" + code) !== row.code_hash) {
        db.prepare("UPDATE sms_subscriptions SET code_tries = code_tries + 1 WHERE id = ?").run(row.id);
        throw badRequest("badCode");
      }
      const wanted = {
        areas: fromJson(row.pending_areas, null) || fromJson(row.areas, []),
        services: fromJson(row.pending_services, null) || fromJson(row.services, []),
      };
      db.prepare(
        `UPDATE sms_subscriptions SET verified_at = COALESCE(verified_at, ?), code_hash = NULL, code_expires = NULL, code_tries = 0,
        areas = ?, services = ?, pending_areas = NULL, pending_services = NULL, failures = 0 WHERE id = ?`,
      ).run(now(), JSON.stringify(wanted.areas), JSON.stringify(wanted.services), row.id);
      const sub = db.prepare("SELECT * FROM sms_subscriptions WHERE id = ?").get(row.id);
      await alert(sub, say("on", sub.lang, { area: areasText(wanted.areas, sub.lang) }), "welcome").catch(() => {});
      return { on: true, areas: wanted.areas, services: wanted.services };
    },

    // The stop link: the number is forgotten completely
    stop(key) {
      const n = db.prepare("DELETE FROM sms_subscriptions WHERE stop_key = ?").run(String(key || "")).changes;
      return { stopped: n > 0 };
    },

    async outage(report) {
      if (!enabled() || !claim(`sms:out:${report.service}:${report.area}`)) return 0;
      let n = 0;
      for (const s of audience(report.service, [report.area])) {
        const text =
          message("out." + report.service, s.lang, { area: areasText([report.area], s.lang) }) +
          ". " +
          message("out.body", s.lang, { n: report.people }).split(".")[0] +
          ".";
        if (await alert(s, text, "outage")) n += 1;
      }
      return n;
    },

    async plannedCut(notice) {
      if (!enabled() || !claim(`sms:cut:${notice.id}`)) return 0;
      let n = 0;
      for (const s of audience(notice.service, notice.areas)) {
        const mine = notice.areas.includes("all")
          ? ["all"]
          : notice.areas.filter((a) => fromJson(s.areas, []).includes(a));
        const text =
          message("cut." + notice.service, s.lang, { area: areasText(mine, s.lang) }) +
          ". " +
          timeRange(notice.from, notice.to, s.lang) +
          ". " +
          pickLang(notice.reason, s.lang);
        if (await alert(s, text.trim(), "cut")) n += 1;
      }
      return n;
    },

    // An admin's pop-up, if they chose to text it too
    async broadcast(popup) {
      if (!enabled()) return 0;
      let n = 0;
      for (const s of db
        .prepare("SELECT * FROM sms_subscriptions WHERE verified_at IS NOT NULL AND failures < 5")
        .all()) {
        const t =
          (popup.title[s.lang] || popup.title.en || Object.values(popup.title)[0]) +
          (popup.body ? ". " + (popup.body[s.lang] || popup.body.en || Object.values(popup.body)[0]) : "");
        if (await alert(s, t, "popup")) n += 1;
      }
      return n;
    },

    prune() {
      const t = now();
      db.prepare("DELETE FROM sms_sent WHERE at < ?").run(t - 2 * DAY);
      // a number that never typed its code is forgotten after a day
      return db.prepare("DELETE FROM sms_subscriptions WHERE verified_at IS NULL AND created_at < ?").run(t - DAY)
        .changes;
    },
  };
}
