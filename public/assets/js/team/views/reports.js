/* © 2026 NorthPoint Tech. All rights reserved.
   Public reports for the team's service: open first, worst first. */
import { post } from "../api.js";
import { esc, t, toast, errorText, twoTaps, comma } from "../util.js";

const EU = window.EU;
let filter = "open";
let place = "";

// Home's map and cities strip open this screen on one place
export function showPlace(slug) {
  filter = "open";
  place = slug || "";
}

function bucket(r) {
  if (r.status === "hidden") return "hidden";
  if (r.status === "closed" || r.resolved) return "closed";
  return r.alive ? "open" : "closed";
}

/* One report: where and what on the left, how many and when in the middle,
   and on the right the one next step, with everything else under More. */
const CAUSES = ["fault", "overload", "planned", "weather", "damage", "supply", "unknown"];
const hhmm = (ms) => EU.clock(ms);

// Reported → Confirmed → Crew dispatched → Restored
function steps(r) {
  const restored = r.status === "closed" || r.resolved;
  const at = restored ? 3 : r.fixing ? 2 : r.confirmed ? 1 : 0;
  return `<ol class="tm-steps" aria-label="${esc(t("tm.stage"))}">${["reported", "confirmed", "dispatched", "restored"]
    .map(
      (k, i) =>
        `<li class="${i < at ? "is-done" : i === at ? "is-now" : ""}"${i === at ? ' aria-current="step"' : ""}>${esc(t("tm.st." + k))}</li>`,
    )
    .join("")}</ol>`;
}

// the crew, when they expect it back, and the cause
function details(r) {
  const parts = [];
  if (r.crew) parts.push(esc(r.crew));
  if (r.etr) parts.push(esc(t("tm.backBy", { time: hhmm(r.etr) })));
  if (r.cause) parts.push(esc(t("tm.cause." + r.cause)));
  return parts.length ? `<p class="tm-ri__crew">${parts.join(comma())}</p>` : "";
}

function row(r, ctx) {
  const flags = [];
  if (r.teamConfirmed) flags.push(t("ad.st.confirmed"));
  if (r.status === "closed") flags.push(t("ad.st.closed"));
  else if (r.resolved) flags.push(t("ad.st.fixed"));
  if (r.status === "hidden") flags.push(t("ad.st.hidden"));
  if (r.fixing) flags.push(t("tm.fixingSince", { time: EU.clock(r.fixing) }));
  const b = (act, key, cls = "btn btn--small btn--quiet") =>
    `<button type="button" class="${cls}" data-act="${act}" data-id="${esc(r.id)}">${esc(t(key))}</button>`;
  const item = (act, key) =>
    `<button type="button" role="menuitem" data-act="${act}" data-id="${esc(r.id)}">${esc(t(key))}</button>`;
  let main = "";
  const extra = [];
  if (r.status === "hidden") {
    if (ctx.can("supervisor")) main = b("unhide", "ad.act.unhide");
  } else if (r.status === "closed" || r.resolved) {
    main = b("reopen", "ad.act.reopen");
  } else {
    // the next step for this report
    if (!r.teamConfirmed) main = b("confirm", "ad.act.confirm", "btn btn--small");
    else if (!r.fixing) main = b("fixing", "tm.act.fixing", "btn btn--small");
    else main = b("close", "ad.act.close", "btn btn--small");
    if (r.teamConfirmed) extra.push(item("confirm", "ad.act.unconfirm"));
    if (r.fixing) extra.push(item("fixing", "tm.act.notFixing"));
    else if (r.teamConfirmed) extra.push(item("close", "ad.act.close"));
    if (!r.teamConfirmed) extra.push(item("close", "ad.act.close"));
  }
  if (bucket(r) === "open")
    extra.unshift(
      `<button type="button" role="menuitem" data-details-open="${esc(r.id)}">${esc(t("tm.crewDetails"))}</button>`,
    );
  if (r.status !== "hidden") {
    extra.push(
      `<button type="button" role="menuitem" data-note-open="${esc(r.id)}">${esc(t(r.teamNote ? "tm.editResidentNote" : "tm.addResidentNote"))}</button>`,
    );
    if (ctx.can("supervisor")) extra.push(item("hide", "ad.act.hide"));
  }
  const more = extra.length
    ? `<details class="tm-menu"><summary class="btn btn--small btn--quiet" aria-label="${esc(t("tm.moreActions"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/></svg></summary><div class="tm-menu__list" role="menu">${extra.join("")}</div></details>`
    : "";

  const out = r.confirmed && (r.problem === "no_power" || r.problem === "no_water") && bucket(r) === "open";
  const who = r.confirmed ? t("people", { n: r.people }) : t("state.unconfirmed");
  const photos = (r.photos || []).filter((p) => p.status !== "rejected");
  return `<li class="tm-ri${out ? " is-out" : ""}${r.confirmed ? "" : " is-unconfirmed"}">
    <div class="tm-ri__what">
      <p class="tm-ri__title">${r.no ? `<bdi dir="ltr" class="tm-ri__no">OUT-${esc(String(r.no))}</bdi> ` : ""}<strong>${esc(EU.areaName(r.area))}</strong> <span class="tm-ri__svc">${esc(t("svc." + r.service))}</span></p>
      <p class="tm-ri__problem">${esc(t("p." + r.problem))}</p>
      ${r.note ? `<p class="tm-r__note" dir="auto">${esc(EU.pick(r.note))}</p>` : ""}
      ${photos.length ? `<p class="tm-r__photos">${photos.map((p) => `<a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" width="64" height="48" loading="lazy">${p.status === "pending" ? `<span>${esc(t("tm.pending"))}</span>` : ""}</a>`).join("")}</p>` : ""}
      ${details(r)}
      ${r.status !== "hidden" ? steps(r) : ""}
      ${r.teamNote ? `<p class="tm-ri__teamnote"><span>${esc(t("tm.residentsSee"))}</span> <span dir="auto">${esc(r.teamNote)}</span></p>` : ""}
    </div>
    <div class="tm-ri__meta">
      <p><b>${esc(who)}</b>${r.fine ? `<br>${esc(t("people.fine", { n: r.fine }))}` : ""}</p>
      ${r.people >= 2 && r.addresses === 1 ? `<p class="tm-oneplace">${esc(t("tm.oneAddress", { n: r.people }))}</p>` : ""}
      <p><span title="${esc(EU.dayAndTime(r.started))}">${esc(EU.ago(r.last))}</span>${flags.length ? `<br>${esc(flags.join(comma()))}` : ""}</p>
    </div>
    <div class="tm-ri__acts">${main}${more}</div>
    ${
      bucket(r) === "open"
        ? `<form class="tm-note tm-details" data-id="${esc(r.id)}" data-quiet hidden>
      <label>${esc(t("tm.crew"))}<input class="input" name="crew" maxlength="40" dir="auto" value="${esc(r.crew || "")}" placeholder="${esc(t("tm.crewPh"))}"></label>
      <label>${esc(t("tm.etr"))}<input class="input input--time" name="etr" inputmode="numeric" maxlength="5" dir="ltr" placeholder="18:30" value="${r.etr ? esc(hhmm(r.etr)) : ""}"></label>
      <label>${esc(t("tm.causeLabel"))}<select class="input" name="cause"><option value="">–</option>${CAUSES.map((c) => `<option value="${c}"${r.cause === c ? " selected" : ""}>${esc(t("tm.cause." + c))}</option>`).join("")}</select></label>
      <button type="submit" class="btn btn--small">${esc(t("ad.save"))}</button>
      <button type="button" class="btn btn--small btn--quiet" data-note-cancel>${esc(t("ad.cancel"))}</button></form>`
        : ""
    }
    ${
      r.status !== "hidden"
        ? `<form class="tm-note" data-id="${esc(r.id)}" data-quiet hidden>
      <label class="sr-only" for="note-${esc(r.id)}">${esc(t("ad.act.note"))}</label>
      <input class="input" id="note-${esc(r.id)}" maxlength="200" dir="auto" value="${esc(r.teamNote || "")}" placeholder="${esc(t("ad.notePh"))}">
      <button type="submit" class="btn btn--small">${esc(t("ad.save"))}</button>
      <button type="button" class="btn btn--small btn--quiet" data-note-cancel>${esc(t("ad.cancel"))}</button></form>`
        : ""
    }
  </li>`;
}

export default {
  render(root, ctx) {
    const all = ctx.data.reports;
    const inBucket = all.filter((r) => bucket(r) === filter);
    // the places that have something in this list, for the place filter
    const places = [...new Set(inBucket.map((r) => r.area))].sort((a, b) =>
      EU.areaName(a).localeCompare(EU.areaName(b)),
    );
    if (place && !places.includes(place)) place = "";
    const list = inBucket
      .filter((r) => !place || r.area === place)
      .sort((a, b) =>
        filter === "open" ? b.confirmed - a.confirmed || b.people - a.people || b.last - a.last : b.last - a.last,
      );
    const n = (k) => all.filter((r) => bucket(r) === k).length;

    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("ad.reports"))}</h1><p>${esc(t("tm.reportsLead"))}</p></div>
        <a class="btn btn--quiet btn--small" href="/api/team/export/reports${ctx.query({ days: 30 })}" download>${esc(t("tm.export"))}</a></div>
      <section class="tm-panel tm-panel--list">
        <div class="tm-bar">
          <div class="filter" role="group" aria-label="${esc(t("ad.reports"))}">
            ${["open", "closed", "hidden"].map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(t("ad.f." + k))} <span class="muted">${EU.num(n(k))}</span></button>`).join("")}
          </div>
          ${
            places.length > 1
              ? `<label class="tm-bar__pick"><span class="sr-only">${esc(t("tm.area"))}</span><select class="input" id="r-place">
            <option value="">${esc(t("tm.allPlaces"))}</option>
            ${places.map((a) => `<option value="${esc(a)}"${a === place ? " selected" : ""}>${esc(EU.areaName(a))}</option>`).join("")}</select></label>`
              : ""
          }
        </div>
        ${
          list.length
            ? `<ul class="tm-rlist">${list.map((r) => row(r, ctx)).join("")}</ul>`
            : `<p class="tm-empty">${esc(t(filter === "open" ? "ad.none" : "ad.empty"))}</p>`
        }
      </section>`;

    const pick = root.querySelector("#r-place");
    if (pick)
      pick.addEventListener("change", () => {
        place = pick.value;
        this.render(root, ctx);
      });
    root.querySelector(".filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (b) {
        filter = b.getAttribute("data-f");
        this.render(root, ctx);
      }
    });

    const act = async (id, action, extra = {}) => {
      try {
        const res = await post("/reports/" + encodeURIComponent(id), { action, ...extra });
        const i = ctx.data.reports.findIndex((r) => r.id === id);
        if (i >= 0) ctx.data.reports[i] = res.report;
        toast(t("ad.saved"));
        this.render(root, ctx);
      } catch (err) {
        toast(errorText(err));
      }
    };
    root.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const run = () => act(b.getAttribute("data-id"), b.getAttribute("data-act"));
        if (b.getAttribute("data-act") === "hide") twoTaps(b, run);
        else run();
      }),
    );
    root.querySelectorAll("[data-note-open]").forEach((b) =>
      b.addEventListener("click", () => {
        const li = b.closest(".tm-ri");
        li.querySelector("details").open = false;
        const f = li.querySelector(".tm-note:not(.tm-details)");
        f.hidden = false;
        f.querySelector("input").focus();
      }),
    );
    root
      .querySelectorAll("[data-note-cancel]")
      .forEach((b) => b.addEventListener("click", () => (b.closest(".tm-note").hidden = true)));
    root.querySelectorAll("[data-details-open]").forEach((b) =>
      b.addEventListener("click", () => {
        const li = b.closest(".tm-ri");
        li.querySelector("details").open = false;
        const f = li.querySelector(".tm-details");
        f.hidden = false;
        f.querySelector("input").focus();
      }),
    );
    root.querySelectorAll(".tm-details").forEach((f) =>
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = (n) => f.elements[n].value.trim();
        act(f.getAttribute("data-id"), "details", { crew: v("crew"), etr: v("etr"), cause: v("cause") });
      }),
    );
    root.querySelectorAll(".tm-note:not(.tm-details)").forEach((f) =>
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        act(f.getAttribute("data-id"), "note", { note: f.querySelector("input").value });
      }),
    );
  },
};
