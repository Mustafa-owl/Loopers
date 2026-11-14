/* © 2026 NorthPoint Tech. All rights reserved.

   The dashboard's charts: columns in plain HTML, ranked bars for places.

   Electricity is amber and water is blue everywhere on the team page
   (--c-power, --c-water in team.css; both checked for colour-blind readers
   in light and dark). Every chart has a title that says what it shows, the
   totals beside it, a tooltip on each column, and a "Show as table" switch with the same numbers. */
import { esc, t } from "./util.js";

const EU = window.EU;
// An hour as 18:00 in the page's own digits, both halves
const two = (n) => EU.num(Math.floor(n / 10)) + EU.num(n % 10);
const clock = (h, m) => two(h) + ":" + two(m);

function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
}

// One tooltip element for the whole page, placed next to the mark
let tip;
function tooltip() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tm-tip";
    tip.setAttribute("role", "status");
    document.body.appendChild(tip);
  }
  return tip;
}
function showTip(target, html) {
  const el = tooltip();
  el.innerHTML = html;
  el.hidden = false;
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  el.style.top = r.top + window.scrollY - el.offsetHeight - 8 + "px";
}
function hideTip() {
  if (tip) tip.hidden = true;
}

function frame(title, body, table, summary = "") {
  const id = "c" + Math.random().toString(36).slice(2, 8);
  return `<figure class="tm-chart">
    <figcaption>
      <div class="tm-chart__title"><span>${esc(title)}</span>${summary}</div>
      <button type="button" class="tm-chart__switch" data-table="${id}">${esc(t("tm.asTable"))}</button>
    </figcaption>
    <div class="tm-chart__plot">${body}</div>
    <div class="tm-chart__table" id="${id}" hidden>${table}</div>
  </figure>`;
}

function table(headers, rows) {
  return `<table class="tm-table"><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join("")}</tr>`).join("")}</tbody></table>`;
}

/* Columns drawn with plain HTML, so they keep the same height on a wide
   screen and a phone and the text never gets stretched. Each column is
   { label, tip, parts: [{ key, value }] }, with the first part at the bottom. */
function columns(cols, { height = 200, labelEvery = 1 } = {}) {
  const max = niceMax(Math.max(1, ...cols.map((c) => c.parts.reduce((s, p) => s + p.value, 0))));
  const steps = [max, max / 2, 0];
  const lines = steps.map((v) => `<i style="--at:${v / max}"></i>`).join("");
  const nums = steps.map((v) => `<span style="--at:${v / max}">${EU.num(v)}</span>`).join("");
  const bars = cols
    .map((c, i) => {
      const parts = c.parts
        .filter((p) => p.value)
        .reverse()
        .map((p) => `<i class="s-${p.key}" style="height:${(p.value / max) * 100}%"></i>`)
        .join("");
      const label = i % labelEvery === 0 ? esc(c.label) : "";
      return `<div class="tm-col" tabindex="0" data-tip="${esc(c.tip)}"><div class="tm-col__stack">${parts}</div><span class="tm-col__day">${label}</span></div>`;
    })
    .join("");
  return `<div class="tm-cols" style="--h:${height}px"><div class="tm-cols__nums" aria-hidden="true">${nums}</div><div class="tm-cols__grid" aria-hidden="true">${lines}</div><div class="tm-cols__bars">${bars}</div></div>`;
}

function dayLabel(day) {
  return EU.num(Number(day.slice(8))) + " " + EU.monthName(day.slice(0, 7)).split(" ")[0];
}

/* Reports each day, electricity under water. `days` is
   [{ day: "2026-10-16", electricity: 3, water: 1 }]. */
export function perDay(days, service) {
  const keys = service ? [service] : ["electricity", "water"];
  const totals = Object.fromEntries(keys.map((k) => [k, days.reduce((s, d) => s + d[k], 0)]));
  const all = keys.reduce((s, k) => s + totals[k], 0);
  const cols = days.map((d, i) => ({
    label: i === 0 || d.day.endsWith("-01") ? dayLabel(d.day) : EU.num(Number(d.day.slice(8))),
    tip: `<strong>${esc(dayLabel(d.day))}</strong>${keys.map((k) => `<br>${esc(t("svc." + k))}: ${EU.num(d[k])}`).join("")}`,
    parts: keys.map((k) => ({ key: k, value: d[k] })),
  }));
  const summary = `<p class="tm-chart__sum"><b>${esc(t("tm.reportsN", { n: all }))}</b>${
    keys.length > 1
      ? keys
          .map((k) => `<span class="tm-key"><i class="s-${k}"></i>${esc(t("svc." + k))} ${EU.num(totals[k])}</span>`)
          .join("")
      : ""
  }</p>`;
  const body = `<div role="img" aria-label="${esc(t("tm.chart.perDay"))}">${columns(cols, { labelEvery: days.length > 14 ? Math.ceil(days.length / 10) : 1 })}</div>`;
  const rows = days.map((d) => [d.day, ...keys.map((k) => EU.num(d[k]))]);
  return frame(t("tm.chart.perDay"), body, table([t("ad.date"), ...keys.map((k) => t("svc." + k))], rows), summary);
}

/* When in the day problems get reported, 0–23 Erbil time */
export function perHour(hours) {
  const cols = hours.map((h) => ({
    label: EU.num(h.hour),
    tip: `<strong><bdi>${clock(h.hour, 0)}–${clock(h.hour, 59)}</bdi></strong><br>${esc(t("tm.reportsN", { n: h.count }))}`,
    parts: [{ key: "all", value: h.count }],
  }));
  const busiest = hours.reduce((b, h) => (h.count > b.count ? h : b), hours[0] || { hour: 0, count: 0 });
  const summary = busiest.count
    ? `<p class="tm-chart__sum"><b><bdi>${clock(busiest.hour, 0)}</bdi></b> ${esc(t("tm.busiest"))}</p>`
    : "";
  return frame(
    t("tm.chart.perHour"),
    `<div role="img" aria-label="${esc(t("tm.chart.perHour"))}">${columns(cols, { height: 150, labelEvery: 3 })}</div>`,
    table(
      [t("tm.hour"), t("ad.reports")],
      hours.map((h) => [clock(h.hour, 0), EU.num(h.count)]),
    ),
    summary,
  );
}

/* Neighbourhoods with the most reports, as a ranked list with bars */
export function areas(list) {
  const top = list.slice(0, 10);
  const max = Math.max(1, ...top.map((a) => a.reports));
  const rows = top
    .map(
      (a) => `<li>
      <span class="tm-rank__name">${esc(EU.areaName(a.area))}</span>
      <span class="tm-rank__bar"><i style="width:${(a.reports / max) * 100}%"></i></span>
      <span class="tm-rank__n">${EU.num(a.reports)}</span>
    </li>`,
    )
    .join("");
  return frame(
    t("tm.chart.areas"),
    top.length ? `<ol class="tm-rank">${rows}</ol>` : `<p class="muted">${esc(t("tm.nothingYet"))}</p>`,
    table(
      [t("report.where"), t("ad.reports"), t("tm.people"), t("tm.outages")],
      top.map((a) => [EU.areaName(a.area), EU.num(a.reports), EU.num(a.people), EU.num(a.outages)]),
    ),
  );
}

// Tooltips and the table switches, once for the page
export function wire(root) {
  root.addEventListener("pointerover", (e) => {
    const g = e.target.closest("[data-tip]");
    if (g) showTip(g, g.getAttribute("data-tip"));
  });
  root.addEventListener("pointerout", (e) => {
    if (e.target.closest("[data-tip]")) hideTip();
  });
  root.addEventListener("focusin", (e) => {
    const g = e.target.closest("[data-tip]");
    if (g) showTip(g, g.getAttribute("data-tip"));
  });
  root.addEventListener("focusout", hideTip);
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-table]");
    if (!b) return;
    const box = document.getElementById(b.getAttribute("data-table"));
    box.hidden = !box.hidden;
    box.previousElementSibling.hidden = !box.hidden;
    b.textContent = t(box.hidden ? "tm.asTable" : "tm.asChart");
    b.setAttribute("aria-pressed", String(!box.hidden));
  });
}
