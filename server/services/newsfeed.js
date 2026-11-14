/* © 2026 NorthPoint Tech. All rights reserved.

   News found automatically.

   Every 30 minutes the server looks at a list of news sites (Rudaw,
   Kurdistan24, Shafaq, 964media, the KRG Ministry of Electricity, Runaki;
   admins can change the list). For each site it reads the latest-news
   page, or its feed if it has one, and picks out the article links. A
   headline that might be about power or water gets its article page
   opened once, for the real title, summary and date from the page's own
   preview data (og:title, og:description, article:published_time).

   Then a filter decides. It needs a topic (electricity, Runaki, a power
   cut, water, drought, wells, the Great Zab…) and a place (Erbil, the
   Kurdistan Region…) in four languages; official sources need only the
   topic. Phrases like "superpower" or "political power" don't count. What
   passes goes to the team as a suggestion, with the words that matched,
   and only a person publishes it, unless an admin has switched on
   automatic publishing for the clearest ones.

   It's polite: one look per site per run, at most 10 article pages per
   site, a 15-second timeout, nothing over 2 MB, nothing older than 30
   days, and every link is only ever fetched once.                       */
import { clip } from "../lib/text.js";
import { erbilDay } from "../lib/time.js";
import { badRequest, notFound, forbidden } from "../lib/http.js";
import { getSetting, setSetting } from "../db/index.js";

const PER_SOURCE = 10;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT = 15_000;
const MAX_AGE_DAYS = 30;
const CLEAR = 8; // a score this high is "clearly about it"

/* ---------------- what counts as power and water news ---------------- */

const POWER = [
  "electricity",
  "electric",
  "power cut",
  "power cuts",
  "power outage",
  "power outages",
  "power plant",
  "power plants",
  "power station",
  "power supply",
  "power grid",
  "national grid",
  "the grid",
  "megawatt",
  "megawatts",
  "kilowatt",
  "kwh",
  "runaki",
  "blackout",
  "blackouts",
  "generator",
  "generators",
  "substation",
  "substations",
  "transformer",
  "ministry of electricity",
  "24-hour power",
  "24-hour electricity",
  "electricity bill",
  "electricity tariff",
  "kehreb",
  "kehreba",
  "kehrebê",
  "elektrîk",
  "runakî",
  "کارەبا",
  "کارەبای",
  "ڕووناکی",
  "مۆلیدە",
  "وێستگەی کارەبا",
  "مێگاوات",
  "كهرباء",
  "الكهرباء",
  "روناكي",
  "رووناكي",
  "مولدات",
  "المولدات",
  "ميغاواط",
  "محطة كهرباء",
  "محطات الكهرباء",
  "الطاقة الكهربائية",
];
const WATER = [
  "water",
  "drinking water",
  "water supply",
  "water project",
  "water shortage",
  "water shortages",
  "water crisis",
  "drought",
  "groundwater",
  "wells",
  "well water",
  "great zab",
  "zab river",
  "little zab",
  "dam",
  "dams",
  "reservoir",
  "tanker",
  "tankers",
  "sewage",
  "rainfall",
  "av",
  "avê",
  "ziwabûn",
  "bîr",
  "ئاو",
  "ئاوی",
  "وشکەساڵی",
  "بەنداو",
  "زێی گەورە",
  "کەمئاوی",
  "ماء",
  "المياه",
  "مياه",
  "شح المياه",
  "الجفاف",
  "جفاف",
  "آبار",
  "الآبار",
  "الزاب",
  "سد",
  "السد",
  "الأمطار",
];
const PLACE = [
  "erbil",
  "hewler",
  "hawler",
  "hewlêr",
  "kurdistan",
  "kurdistan region",
  "krg",
  "kri",
  "duhok",
  "sulaimani",
  "sulaymaniyah",
  "slemani",
  "halabja",
  "soran",
  "koya",
  "هەولێر",
  "کوردستان",
  "هەرێمی کوردستان",
  "دهۆک",
  "سلێمانی",
  "أربيل",
  "اربيل",
  "كوردستان",
  "كردستان",
  "إقليم كوردستان",
  "اقليم كوردستان",
  "دهوك",
  "السليمانية",
];
// Not about power or water at all
const NOT = [
  "superpower",
  "superpowers",
  "political power",
  "power struggle",
  "power-sharing",
  "power sharing",
  "in power",
  "seize power",
  "balance of power",
  "water cannon",
  "water polo",
  "powerful",
  "manpower",
  "firepower",
  "soft power",
  "hard power",
  "horsepower",
];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // Arabic marks and tatweel
    .replace(/[إأآ]/g, "ا")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ى/g, "ی")
    .replace(/\s+/g, " ");
}
const N = (list) => list.map(norm);
const W = { power: N(POWER), water: N(WATER), place: N(PLACE), not: N(NOT) };

// Whole words or whole phrases only, so "av" doesn't match "travel"
function hits(text, words) {
  const found = [];
  for (const w of words) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u");
    if (re.test(text)) found.push(w);
  }
  return found;
}

/* Score a story. The title counts double. Returns null when it isn't
   about power or water in the region. */
export function judge({ title, summary = "" }, { trusted = false } = {}) {
  let t = norm(title),
    s = norm(summary);
  for (const bad of W.not) {
    t = t.split(bad).join(" ");
    s = s.split(bad).join(" ");
  }
  const tp = hits(t, W.power),
    tw = hits(t, W.water),
    tl = hits(t, W.place);
  const sp = hits(s, W.power),
    sw = hits(s, W.water),
    sl = hits(s, W.place);
  const power = tp.length * 4 + sp.length * 2;
  const water = tw.length * 4 + sw.length * 2;
  const place = tl.length * 2 + sl.length;
  if (!power && !water) return null;
  if (!place && !trusted) return null;
  const score = Math.max(power, water) + Math.min(place, 4) + (trusted ? 3 : 0);
  const why = [...new Set([...tp, ...tw, ...tl, ...sp, ...sw, ...sl])].slice(0, 8);
  return { score, service: water > power ? "water" : "electricity", why, clear: score >= CLEAR };
}

/* ---------------- reading pages and feeds ---------------- */

const ENT = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};
export function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function canonical(href, base) {
  try {
    const u = new URL(href, base);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch (e) {
    return null;
  }
}

// A news page: every link that looks like an article, with its text
export function linksFrom(html, base, pattern) {
  const re = new RegExp(pattern);
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = canonical(m[1], base);
    if (!url || !re.test(url)) continue;
    const text = decode(m[2]);
    if (text.length < 12) {
      if (!out.has(url)) out.set(url, "");
      continue;
    } // an image link; the headline link may come later
    if (!out.get(url) || text.length > out.get(url).length) out.set(url, text);
  }
  return [...out].map(([url, title]) => ({ url, title }));
}

// RSS 2.0 or Atom
export function itemsFrom(xml, base) {
  const items = [];
  for (const m of xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)) {
    const x = m[0];
    const tag = (name) => {
      const r = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(x);
      return r ? decode(r[1]) : "";
    };
    const href = (/<link\b[^>]*href=["']([^"']+)["']/i.exec(x) || [])[1] || tag("link");
    const url = canonical(href, base);
    if (!url) continue;
    items.push({
      url,
      title: tag("title"),
      summary: tag("description") || tag("summary"),
      date: tag("pubDate") || tag("published") || tag("updated"),
    });
  }
  return items;
}

// The article itself: its own preview data is the most reliable title, summary and date
export function articleFrom(html) {
  const meta = (key) => {
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i").exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i").exec(html);
    return decode((a || b || [])[1] || "");
  };
  const title = meta("og:title") || decode((/<title>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "");
  const summary = meta("og:description") || meta("description");
  const date = meta("article:published_time") || (/<time[^>]+datetime=["']([^"']+)["']/i.exec(html) || [])[1] || "";
  const lang = ((/<html[^>]+lang=["']([a-z-]+)["']/i.exec(html) || [])[1] || "").slice(0, 3).toLowerCase();
  return { title, summary, date, lang };
}

function dayOf(value, fallback) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d) ? erbilDay(d.getTime()) : fallback;
}

function langOf(url, pageLang) {
  if (/\/(arabic|ar)\//.test(url) || pageLang === "ar") return "ar";
  if (/\/(sorani|ckb)\//.test(url) || pageLang === "ckb" || pageLang === "ku") return "ckb";
  if (/\/(kurmanci|kurmanji|kmr)\//.test(url) || pageLang === "kmr") return "kmr";
  return "en";
}

// Headlines on a news page are short; a site name alone, or "Read more", isn't one
const looksLikeHeadline = (t) => t.length >= 12 && t.split(" ").length >= 3;
// A cheap first look at the link text, before opening the article
const mightBe = (t) => /[\p{L}]/u.test(t) && (hits(norm(t), W.power).length || hits(norm(t), W.water).length);

/* ---------------- the service ---------------- */

export function createNewsfeed({
  db,
  content,
  live,
  audit,
  now,
  fetch: fetchImpl = globalThis.fetch,
  agent = "ErbilUtilitiesNews/1.0",
}) {
  const seen = db.prepare("SELECT 1 FROM news_suggestions WHERE url = ?").pluck();
  const sameTitle = db.prepare("SELECT 1 FROM news_suggestions WHERE outlet = ? AND lower(title) = lower(?)").pluck();

  async function get(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: {
          "user-agent": agent,
          accept: "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new Error("too big");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  const sourceOut = (r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    kind: r.kind,
    pattern: r.link_pattern,
    trusted: !!r.trusted,
    active: !!r.active,
    lastCheckedAt: r.last_checked_at,
    lastOkAt: r.last_ok_at,
    lastError: r.last_error,
    found: r.found_total,
  });
  const suggestionOut = (r) => ({
    id: r.id,
    outlet: r.outlet,
    url: r.url,
    title: r.title,
    summary: r.summary,
    lang: r.lang,
    date: r.published,
    service: r.service,
    score: r.score,
    why: r.why ? r.why.split("|") : [],
    status: r.status,
    foundAt: r.found_at,
    newsId: r.news_id,
  });

  function save(src, item, verdict) {
    const t = now();
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO news_suggestions (source_id, outlet, url, title, summary, lang, published, service, score, why, found_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        src.id,
        src.name,
        item.url,
        clip(item.title, 200),
        clip(item.summary, 400) || null,
        item.lang,
        item.date,
        verdict.service,
        verdict.score,
        verdict.why.join("|"),
        t,
      );
    db.prepare("UPDATE news_sources SET found_total = found_total + 1 WHERE id = ?").run(src.id);
    return lastInsertRowid;
  }

  function publish(id, user, service) {
    const s = db.prepare("SELECT * FROM news_suggestions WHERE id = ?").get(id);
    if (!s) throw notFound();
    if (s.status !== "new") throw badRequest("alreadyDecided");
    const svc = service === "water" || service === "electricity" ? service : s.service || "electricity";
    const news = content.createNews(user || { id: null, username: null }, svc, {
      title: s.title,
      lang: s.lang || "en",
      url: s.url,
      outlet: s.outlet,
      date: s.published,
      sum: s.summary ? { [s.lang || "en"]: s.summary } : undefined,
    });
    db.prepare(
      "UPDATE news_suggestions SET status = 'published', service = ?, decided_by = ?, decided_at = ?, news_id = ? WHERE id = ?",
    ).run(svc, user ? user.id : null, now(), news.id, s.id);
    return news;
  }

  async function checkSource(src, stats) {
    const t = now();
    const oldest = erbilDay(t - MAX_AGE_DAYS * 86400e3);
    try {
      const body = await get(src.url);
      const list =
        src.kind === "feed" ? itemsFrom(body, src.url) : linksFrom(body, src.url, src.link_pattern || "^https?://");
      let opened = 0;
      for (const item of list) {
        if (seen.get(item.url)) continue;
        // On a page, open only the links whose headline might be ours (or that have no text to judge)
        if (src.kind === "page" && item.title && looksLikeHeadline(item.title) && !mightBe(item.title)) continue;
        if (opened >= PER_SOURCE) break;
        let story = { url: item.url, title: item.title, summary: item.summary || "", date: item.date, lang: "en" };
        if (src.kind === "page" || !story.summary) {
          opened++;
          try {
            const a = articleFrom(await get(item.url));
            story = {
              ...story,
              title: a.title || story.title,
              summary: a.summary || story.summary,
              date: a.date || story.date,
              lang: langOf(item.url, a.lang),
            };
          } catch (e) {
            continue;
          } // can't open it: try again next time
        }
        story.date = dayOf(story.date, erbilDay(t));
        if (!story.title || story.date < oldest) continue;
        if (sameTitle.get(src.name, clip(story.title, 200))) continue;
        stats.looked++;
        const verdict = judge(story, { trusted: !!src.trusted });
        if (!verdict) continue;
        const id = save(src, story, verdict);
        stats.found++;
        if (verdict.clear && getSetting(db, "news_autopublish") === "1") {
          publish(id, null, verdict.service);
          audit.log(null, "news.auto", {
            targetType: "news",
            service: verdict.service,
            detail: { title: story.title, outlet: src.name },
          });
          stats.published++;
        }
      }
      db.prepare("UPDATE news_sources SET last_checked_at = ?, last_ok_at = ?, last_error = NULL WHERE id = ?").run(
        t,
        t,
        src.id,
      );
    } catch (e) {
      db.prepare("UPDATE news_sources SET last_checked_at = ?, last_error = ? WHERE id = ?").run(
        t,
        clip(e.name === "AbortError" ? "timed out" : e.message, 160),
        src.id,
      );
      stats.failed++;
    }
  }

  let running = null;
  return {
    judge,

    // Look at every active source once. Safe to call while a run is going: it waits for it.
    run() {
      if (running) return running;
      running = (async () => {
        const stats = { looked: 0, found: 0, published: 0, failed: 0 };
        for (const src of db.prepare("SELECT * FROM news_sources WHERE active = 1 ORDER BY id").all())
          await checkSource(src, stats);
        if (stats.found) live.publish("news-suggestions", {}, { teamOnly: true });
        return stats;
      })().finally(() => {
        running = null;
      });
      return running;
    },

    // Staff see their own service's; admins see both, or one. 40 at a time.
    suggestionsPage(user, { status = "new", service = null, offset = 0 } = {}) {
      if (user.role !== "admin") service = user.service;
      if (!["new", "published", "dismissed"].includes(status)) status = "new";
      const w = `status = ? ${service ? "AND service = ?" : ""}`,
        args = service ? [status, service] : [status];
      const rows = db
        .prepare(`SELECT * FROM news_suggestions WHERE ${w} ORDER BY published DESC, score DESC LIMIT 40 OFFSET ?`)
        .all(...args, offset);
      return {
        suggestions: rows.map(suggestionOut),
        total: db
          .prepare(`SELECT COUNT(*) FROM news_suggestions WHERE ${w}`)
          .pluck()
          .get(...args),
      };
    },
    suggestions(user, opts) {
      return this.suggestionsPage(user, opts).suggestions;
    },

    decide(user, id, { action, service } = {}) {
      const s = db.prepare("SELECT * FROM news_suggestions WHERE id = ?").get(Number(id));
      if (!s) throw notFound();
      if (user.role !== "admin" && s.service !== user.service) throw forbidden("otherService");
      if (action === "publish") return { news: publish(s.id, user, user.role === "admin" ? service : user.service) };
      if (action === "dismiss") {
        if (s.status !== "new") throw badRequest("alreadyDecided");
        db.prepare("UPDATE news_suggestions SET status = 'dismissed', decided_by = ?, decided_at = ? WHERE id = ?").run(
          user.id,
          now(),
          s.id,
        );
        audit.log(user, "news.dismiss", {
          targetType: "news",
          service: s.service,
          detail: { title: s.title, outlet: s.outlet },
        });
        return { dismissed: true };
      }
      throw badRequest("badAction");
    },

    /* ---- the list of sources (admins) ---- */
    sources: () => db.prepare("SELECT * FROM news_sources ORDER BY id").all().map(sourceOut),

    addSource(user, input) {
      const name = clip(input.name, 60);
      const url = clip(input.url, 300);
      if (!name) throw badRequest("needSiteName");
      if (!/^https:\/\//.test(url)) throw badRequest("badUrl");
      const kind = input.kind === "feed" ? "feed" : "page";
      const pattern = clip(input.pattern, 200) || null;
      if (kind === "page") {
        if (!pattern) throw badRequest("needPattern");
        try {
          new RegExp(pattern);
        } catch (e) {
          throw badRequest("badPattern");
        }
      }
      const { lastInsertRowid } = db
        .prepare("INSERT INTO news_sources (name, url, kind, link_pattern, trusted) VALUES (?, ?, ?, ?, ?)")
        .run(name, url, kind, pattern, input.trusted ? 1 : 0);
      audit.log(user, "newsSource.add", { targetType: "newsSource", targetId: lastInsertRowid, detail: { name, url } });
      return sourceOut(db.prepare("SELECT * FROM news_sources WHERE id = ?").get(lastInsertRowid));
    },

    updateSource(user, id, input) {
      const src = db.prepare("SELECT * FROM news_sources WHERE id = ?").get(Number(id));
      if (!src) throw notFound();
      const active = input.active === undefined ? src.active : input.active ? 1 : 0;
      const trusted = input.trusted === undefined ? src.trusted : input.trusted ? 1 : 0;
      db.prepare("UPDATE news_sources SET active = ?, trusted = ? WHERE id = ?").run(active, trusted, src.id);
      audit.log(user, "newsSource.update", {
        targetType: "newsSource",
        targetId: src.id,
        detail: { name: src.name, active: !!active, trusted: !!trusted },
      });
      return sourceOut(db.prepare("SELECT * FROM news_sources WHERE id = ?").get(src.id));
    },

    removeSource(user, id) {
      const src = db.prepare("SELECT * FROM news_sources WHERE id = ?").get(Number(id));
      if (!src) throw notFound();
      db.prepare("DELETE FROM news_sources WHERE id = ?").run(src.id);
      audit.log(user, "newsSource.remove", { targetType: "newsSource", targetId: src.id, detail: { name: src.name } });
      return { removed: true };
    },

    autopublish: () => getSetting(db, "news_autopublish") === "1",
    setAutopublish(user, on) {
      setSetting(db, "news_autopublish", on ? "1" : "0");
      audit.log(user, "news.autopublish", { detail: { on: !!on } });
      return { on: !!on };
    },

    // Dismissed suggestions are forgotten after 60 days (the link stays known, so it isn't suggested again)
    prune() {
      return db
        .prepare("UPDATE news_suggestions SET title = '', summary = NULL WHERE status = 'dismissed' AND decided_at < ?")
        .run(now() - 60 * 86400e3).changes;
    },
  };
}
