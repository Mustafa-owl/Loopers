/* © 2026 NorthPoint Tech. All rights reserved.

   Home, map first:

     the map              the real street map, every place coloured by what's wrong,
                          the Runaki cities above it to move it there
     beside it            three numbers for right now, and what needs you
     below                the period (confirmed, fixed), by service, each day,
                          then each place and each hour                      */
import { get } from "../api.js";
import { esc, t, duration } from "../util.js";
import * as charts from "../charts.js";
import { drawMap, goToCity, stopFlat } from "../map.js";
import { can3D, draw3D, goToCity3D, stop3D } from "../map3d.js";
import { showPlace } from "./reports.js";

const EU = window.EU;
let days = 7;

const OUT = ["no_power", "no_water"];
const sep = () => (EU.isRtl() ? "، " : ", ");
// "Ankawa" for a neighbourhood of Erbil, "Duhok" for another city
const where = (slug) => {
  const a = EU.area(slug);
  return a && a.city === "erbil" ? EU.areaName(a) : EU.placeName(slug);
};

// open reports for the service being looked at
function live(data, service) {
  return (data.reports || []).filter(
    (r) => r.alive && r.status === "open" && !r.resolved && (!service || r.service === service),
  );
}

/* What's wrong in each place right now */
function states(open) {
  const out = {};
  for (const a of EU.sortedAreas()) {
    const here = open.filter((r) => r.area === a.slug);
    const confirmed = here.filter((r) => r.confirmed);
    const cut = [...new Set(confirmed.filter((r) => OUT.includes(r.problem)).map((r) => r.problem))];
    const people = confirmed.reduce((s, r) => s + r.people, 0);
    const since = confirmed.length ? Math.min(...confirmed.map((r) => r.started)) : null;
    if (cut.length) out[a.slug] = { kind: "out", label: cut.map((p) => t("tm.board." + p)).join(sep()), people, since };
    else if (confirmed.length) {
      const top = confirmed.slice().sort((x, y) => y.people - x.people)[0];
      out[a.slug] = { kind: "trouble", label: EU.t("p." + top.problem), people, since };
    } else if (here.length) out[a.slug] = { kind: "unconfirmed", label: EU.t("state.unconfirmed") };
    else out[a.slug] = { kind: "quiet", label: "" };
  }
  return out;
}

/* The cities above the map: tapping one moves the map there */
function strip(st) {
  return `<div class="tm-strip" role="group" aria-label="${esc(t("tm.strip"))}">${EU.CITIES.map((c) => {
    const kinds = EU.sortedAreas()
      .filter((a) => a.city === c.slug)
      .map((a) => (st[a.slug] || {}).kind || "quiet");
    const n = kinds.filter((k) => k !== "quiet").length;
    const kind = kinds.includes("out") ? "out" : n ? "open" : "quiet";
    return `<button type="button" class="tm-strip__c is-${kind}" data-city="${esc(c.slug)}" aria-pressed="${c.slug === "erbil"}">
        <span>${esc(EU.cityName(c.slug))}</span>${n ? `<b>${EU.num(n)}</b>` : ""}</button>`;
  }).join("")}</div>`;
}

// an outage open for more than 4 hours is late, and shown in red
const long = (since) => since && Date.now() - since > 4 * 3600e3;

/* The crews out now: who, where, since when, and when they expect it back */
function crews(open) {
  const out = open.filter((r) => r.fixing).sort((x, y) => x.fixing - y.fixing);
  if (!out.length) return `<p class="tm-places__none">${esc(t("tm.crews.none"))}</p>`;
  return `<table class="tm-places tm-crews"><caption class="sr-only">${esc(t("tm.crews"))}</caption><tbody>${out
    .map((r) => {
      const late = r.etr && r.etr < Date.now();
      return `<tr>
        <th scope="row">${esc(r.crew || t("tm.crews.unnamed"))}</th>
        <td><a href="#reports" data-place="${esc(r.area)}">${esc(where(r.area))}</a><br><small>${esc(t("p." + r.problem))}</small></td>
        <td class="num">${esc(t("tm.crews.since", { time: EU.clock(r.fixing) }))}${r.etr ? `<br><small class="${late ? "is-long" : ""}">${esc(t(late ? "tm.crews.late" : "tm.backBy", { time: EU.clock(r.etr) }))}</small>` : ""}</td>
      </tr>`;
    })
    .join("")}</tbody></table>`;
}

/* Under the map: the places with something confirmed, worst first */
function places(st) {
  const rank = { out: 0, trouble: 1 };
  const list = EU.sortedAreas()
    .filter((a) => st[a.slug] && rank[st[a.slug].kind] != null)
    .sort(
      (x, y) => rank[st[x.slug].kind] - rank[st[y.slug].kind] || (st[y.slug].people || 0) - (st[x.slug].people || 0),
    );
  if (!list.length) return `<p class="tm-places__none">${esc(t("tm.map.calm"))}</p>`;
  return `<table class="tm-places"><caption class="sr-only">${esc(t("tm.places"))}</caption><tbody>${list
    .map((a) => {
      const s = st[a.slug];
      return `<tr class="is-${s.kind}">
        <th scope="row"><a href="#reports" data-place="${esc(a.slug)}">${esc(where(a.slug))}</a></th>
        <td class="tm-places__what">${esc(s.label)}</td>
        <td class="num${long(s.since) ? " is-long" : ""}">${s.since ? esc(t("tm.forTime", { time: duration(Math.round((Date.now() - s.since) / 60000)) })) : ""}</td>
        <td class="num">${s.people ? esc(t("tm.peopleN", { n: s.people })) : ""}</td>
      </tr>`;
    })
    .join("")}</tbody></table>`;
}

/* What needs someone, most urgent first */
function queue(data, open) {
  const items = [];
  const outAreas = [...new Set(open.filter((r) => r.confirmed && OUT.includes(r.problem)).map((r) => r.area))];
  if (outAreas.length)
    items.push({
      n: outAreas.length,
      out: true,
      title: t("tm.q.out"),
      sub: outAreas.map(where).join(sep()),
      go: "#reports",
      act: "tm.act.see",
    });
  const chats = (data.chats && data.chats.waiting) || 0;
  if (chats) items.push({ n: chats, title: t("tm.q.chats"), go: "#chats", act: "tm.act.answer" });
  const unconfirmed = open.filter((r) => !r.confirmed).sort((x, y) => x.started - y.started);
  if (unconfirmed.length)
    items.push({
      n: unconfirmed.length,
      title: t("tm.q.unconfirmed"),
      sub: t("tm.q.oldest", { area: where(unconfirmed[0].area), ago: EU.ago(unconfirmed[0].started) }),
      go: "#reports",
      act: "tm.act.check",
    });
  const requests = (data.requests && data.requests.new) || 0;
  if (requests) items.push({ n: requests, title: t("tm.q.requests"), go: "#requests", act: "tm.act.answer" });
  const photos = (data.photos || []).length;
  if (photos) items.push({ n: photos, title: t("tm.q.photos"), go: "#photos", act: "tm.act.check" });

  if (!items.length)
    return `<p class="tm-calm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/></svg>${esc(t("tm.needs.none"))}</p>`;
  return `<ol class="tm-queue">${items
    .map(
      (x) => `<li${x.out ? ' class="is-out"' : ""}>
        <span class="tm-queue__n">${EU.num(x.n)}</span>
        <p>${esc(x.title)}${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</p>
        <a class="btn btn--small${x.out ? "" : " btn--quiet"}" href="${x.go}">${esc(t(x.act))}</a>
      </li>`,
    )
    .join("")}</ol>`;
}

/* A half-circle gauge: how much of the period's reports got somewhere */
function gauge(part, whole, label, kind) {
  const pct = whole ? Math.round((part / whole) * 100) : 0;
  const len = Math.PI * 80; // the arc's length at r = 80
  return `<figure class="tm-gauge is-${kind}">
    <svg viewBox="0 0 200 110" aria-hidden="true">
      <path class="tm-gauge__track" d="M20 100a80 80 0 0 1 160 0"/>
      <path class="tm-gauge__fill" d="M20 100a80 80 0 0 1 160 0" stroke-dasharray="${((len * pct) / 100).toFixed(1)} ${len.toFixed(1)}"/>
    </svg>
    <figcaption><b>${EU.num(pct)}<small>%</small></b><span>${esc(label)}</span><small>${esc(t("tm.ofN", { n: EU.num(part), total: EU.num(whole) }))}</small></figcaption>
  </figure>`;
}

/* Electricity and water, with a bar for each problem */
function services(stats, service) {
  const keys = service ? [service] : ["electricity", "water"];
  return `<div class="tm-svcs">${keys
    .map((k) => {
      const list = stats.problems.filter((p) => p.service === k).slice(0, 4);
      const total = stats.perDay.reduce((s, d) => s + (d[k] || 0), 0);
      const max = Math.max(1, ...list.map((p) => p.count));
      return `<div class="tm-svc is-${k}">
        <p class="tm-svc__head"><span>${esc(t("svc." + k))}</span><b>${EU.num(total)}</b> <small>${esc(t("tm.reportsWord"))}</small></p>
        <ul class="tm-bars">${
          list.length
            ? list
                .map(
                  (p) =>
                    `<li><span class="tm-bars__bar" style="--h:${Math.max(10, Math.round((p.count / max) * 100))}"><b>${EU.num(p.count)}</b></span><span class="tm-bars__name">${esc(t("p." + p.problem))}</span></li>`,
                )
                .join("")
            : `<li class="tm-bars__none">${esc(t("tm.nothingYet"))}</li>`
        }</ul>
      </div>`;
    })
    .join("")}</div>`;
}

export default {
  async render(root, ctx) {
    const [{ stats }, gensRes, sitesRes] = await Promise.all([
      get("/stats" + ctx.query({ days })),
      get("/generators").catch(() => ({ generators: [] })),
      get("/sites").catch(() => ({ sites: [] })),
    ]);
    if (ctx.view !== "overview") return; // they moved on while this was loading
    const service = ctx.user.role === "admin" ? ctx.service : ctx.user.service;
    const data = ctx.data || {};
    const open = live(data, service);
    const st = states(open);
    const T = stats.totals,
      M = stats.medians;
    const time = (m) => (m == null ? "–" : duration(m));
    const lit = EU.sortedAreas().filter((a) => a.city === "erbil" && st[a.slug].kind === "out").length;

    const waiting =
      ((data.requests && data.requests.new) || 0) +
      ((data.chats && data.chats.waiting) || 0) +
      (data.photos || []).length;
    const kpi = (n, label, cls = "") =>
      `<div class="tm-kpi ${cls}"><b>${EU.num(n)}</b><span>${esc(label)}</span></div>`;

    root.innerHTML = `
      <div class="tm-head">
        <h1>${esc(t("tm.nav.overview"))}</h1>
        <p>${esc(t("tm.home.when", { time: EU.dayAndTime(Date.now()) }))}</p>
      </div>

      <div class="tm-dash">
        <section class="tm-panel tm-panel--map" aria-labelledby="m-h">
          <div class="tm-panel__head"><h2 id="m-h">${esc(t("tm.map.title"))}</h2>${strip(st)}
            <button type="button" class="btn btn--small btn--quiet tm-3d" id="tm-3d" aria-pressed="false" hidden>${esc(t("tm.map.3d"))}</button></div>
          <div class="tm-mapbox" id="tm-map" role="region" aria-label="${esc(t("tm.map.aria"))}"></div>
          ${places(st)}
          <p class="tm-map__key">
            <span class="is-out">${esc(t("tm.key.out"))}</span>
            <span class="is-trouble">${esc(t("tm.key.trouble"))}</span>
            <span class="is-unconfirmed">${esc(t("tm.key.unconfirmed"))}</span>
            <span class="is-quiet">${esc(t("tm.key.quiet"))}</span>
            <span class="is-spot">${esc(t("tm.key.spot"))}</span>
            <span class="is-gen">${esc(t("tm.key.gen"))}</span>
            <span class="is-site">${esc(t("tm.key.site"))}</span>
          </p>
        </section>

        <div class="tm-dash__side">
          <div class="tm-kpis">
            ${kpi(lit, t("tm.kpi.out"), lit ? "is-out" : "")}
            ${kpi(open.length, t("tm.kpi.open"))}
            ${kpi(waiting, t("tm.kpi.waiting"))}
          </div>
          <section class="tm-panel" aria-labelledby="q-h">
            <div class="tm-panel__head"><h2 id="q-h">${esc(t("tm.needs"))}</h2></div>
            ${queue(data, open)}
          </section>
          <section class="tm-panel" aria-labelledby="c-h">
            <div class="tm-panel__head"><h2 id="c-h">${esc(t("tm.crews"))}</h2></div>
            ${crews(open)}
          </section>
        </div>
      </div>

      <div class="tm-row3">
        <section class="tm-panel" aria-labelledby="g-h">
          <div class="tm-panel__head">
            <h2 id="g-h">${esc(t("tm.home.period", { n: days }))}</h2>
            <div class="filter" role="group" aria-labelledby="g-h">
              ${[7, 30, 90].map((d) => `<button type="button" data-days="${d}" aria-pressed="${d === days}">${esc(t("tm.days", { n: d }))}</button>`).join("")}
            </div>
          </div>
          <div class="tm-gauges">
            ${gauge(T.confirmed, T.reports, t("tm.fig.confirmed"), "confirmed")}
            ${gauge(T.fixed || 0, T.reports, t("tm.fig.fixed"), "fixed")}
          </div>
          <dl class="tm-figs tm-figs--two">
            <div><dt>${esc(t("tm.fig.toConfirm"))}</dt><dd>${esc(time(M.minutesToConfirm))}</dd></div>
            <div><dt>${esc(t("tm.fig.toFix"))}</dt><dd>${esc(time(M.minutesToFix))}</dd></div>
            <div><dt>${esc(t("tm.fig.people"))}</dt><dd>${esc(EU.num(T.people))}</dd></div>
            <div><dt>${esc(t("tm.fig.reply"))}</dt><dd>${esc(T.requests ? time(M.minutesToFirstResponse) : "–")}</dd></div>
          </dl>
        </section>
        <section class="tm-panel" aria-labelledby="s-h">
          <div class="tm-panel__head"><h2 id="s-h">${esc(t("tm.byService"))}</h2></div>
          ${services(stats, service)}
        </section>
        <section class="tm-panel">${charts.perDay(stats.perDay, service)}</section>
      </div>

      <div class="tm-home__pair">
        <section class="tm-panel" aria-label="${esc(t("tm.chart.areas"))}">${charts.areas(stats.areas)}</section>
        <section class="tm-panel">${charts.perHour(stats.perHour)}
          ${stats.activity.length ? `<h3 class="tm-sub">${esc(t("tm.whoDid"))}</h3><table class="tm-table"><tbody>${stats.activity.map((a) => `<tr><th scope="row">${esc(a.username)}</th><td class="num">${esc(t("tm.actions", { n: a.actions }))}</td></tr>`).join("")}</tbody></table>` : ""}
        </section>
      </div>
      <p class="small muted tm-foot-note">${esc(t("tm.statsNote"))}</p>`;

    // the map: a point opens Reports for that place. Flat at first; 3D on a
    // computer when the map file is on the server and the 3D button is on.
    const onPlace = (slug) => {
      showPlace(slug);
      location.hash = "#reports";
    };
    // the exact spots people shared, and generators that have their own spot
    const kindOf = (r) => (!r.confirmed ? "unconfirmed" : OUT.includes(r.problem) ? "out" : "trouble");
    const extra = {
      spots: open.flatMap((r) =>
        (r.spots || []).map((p) => ({
          lat: p.lat,
          lng: p.lng,
          kind: kindOf(r),
          area: r.area,
          label: `${where(r.area)}: ${EU.t("p." + r.problem)}`,
        })),
      ),
      gens: (gensRes.generators || [])
        .filter((g) => g.lat != null && g.status !== "removed")
        .map((g) => ({
          lat: g.lat,
          lng: g.lng,
          name: g.name,
          status: g.status,
          hours: (g.hours || []).map((h) => `${h.from}–${h.to}`).join(", "),
        })),
      sites: sitesRes.sites || [],
    };
    const box = () => root.querySelector("#tm-map");
    stop3D();
    drawMap(box(), st, onPlace, extra);
    can3D().then((ok) => {
      const btn = root.querySelector("#tm-3d");
      if (!ok || !btn) return;
      btn.hidden = false;
      const fresh = () => {
        const el = box().cloneNode(false);
        box().replaceWith(el);
        return el;
      };
      const show = (on) => {
        btn.setAttribute("aria-pressed", String(on));
        try {
          localStorage.setItem("tm.map3d", on ? "on" : "off");
        } catch (e) {
          /* remembered for this visit only */
        }
        if (on) {
          stopFlat();
          // if our map file can't be read, the flat map comes back (the choice stays)
          const flat = () => {
            stop3D();
            btn.hidden = true;
            drawMap(fresh(), st, onPlace, extra);
          };
          draw3D(fresh(), st, onPlace, flat, extra).catch(flat);
        } else {
          stop3D();
          drawMap(fresh(), st, onPlace, extra);
        }
      };
      btn.addEventListener("click", () => show(btn.getAttribute("aria-pressed") !== "true"));
      let saved = null;
      try {
        saved = localStorage.getItem("tm.map3d");
      } catch (e) {
        /* nothing saved */
      }
      if (saved !== "off") show(true);
    });
    root
      .querySelectorAll("[data-place]")
      .forEach((a) => a.addEventListener("click", () => showPlace(a.getAttribute("data-place"))));
    root.querySelectorAll("[data-city]").forEach((b) =>
      b.addEventListener("click", () => {
        root.querySelectorAll("[data-city]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        goToCity(b.getAttribute("data-city"));
        goToCity3D(b.getAttribute("data-city"));
      }),
    );
    root.querySelectorAll("[data-days]").forEach((b) =>
      b.addEventListener("click", () => {
        days = Number(b.getAttribute("data-days"));
        this.render(root, ctx);
      }),
    );
  },
};
