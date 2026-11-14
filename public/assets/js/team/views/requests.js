/* © 2026 NorthPoint Tech. All rights reserved.

   The inbox of private requests (one house, or a few). Pick one on the
   left, deal with it on the right: call or message the resident, set a
   visit, hand it to a colleague, leave a note, close it.

   Opening a request is written to the activity log, because it shows a
   name and a phone number.                                                */
import { get, patch } from "../api.js";
import { esc, t, toast, errorText, toInput, fromInput, comma } from "../util.js";

const EU = window.EU;
let filter = "active";
let more = [],
  moreFor = null; // pages after the first 100, for this filter
let openId = null;
let list = [];

const STATUSES = ["new", "contacted", "scheduled", "done", "cancelled"];

function waLink(phone) {
  return "https://wa.me/964" + phone.replace(/^0/, "");
}

function item(r) {
  return `<li><button type="button" class="tm-inbox__item${r.id === openId ? " is-open" : ""}${r.status === "new" ? " is-new" : ""}" data-open="${esc(r.id)}">
    <span class="tm-inbox__top"><strong>${esc(EU.areaName(r.area))}</strong><span>${esc(EU.ago(r.createdAt))}</span></span>
    <span>${esc(t("p." + r.problem))}${comma()}${esc(t(r.scope === "home" ? "who.home" : "who.few"))}</span>
    <span class="tm-inbox__status">${esc(t("tm.rq." + r.status))}${r.assignedName ? (EU.isRtl() ? "، " : ", ") + esc(r.assignedName) : ""}${r.visitAt ? (EU.isRtl() ? "، " : ", ") + esc(EU.dayAndTime(r.visitAt)) : ""}</span>
  </button></li>`;
}

function detail(r, ctx) {
  const colleagues = ctx.data.colleagues || [];
  return `<article class="tm-req" aria-labelledby="req-h">
    <header class="tm-req__head">
      <h2 id="req-h">${esc(EU.areaName(r.area))} <span class="muted" dir="ltr">${esc(r.ref)}</span></h2>
      <p>${esc(t("svc." + r.service))}${comma()}${esc(t("p." + r.problem))}${comma()}${esc(t(r.scope === "home" ? "who.home" : "who.few"))}</p>
    </header>

    <dl class="tm-dl">
      <div><dt>${esc(t("tm.name"))}</dt><dd dir="auto">${esc(r.name || "–")}</dd></div>
      <div><dt>${esc(t("private.phone"))}</dt><dd><a href="tel:${esc(r.phone)}" dir="ltr">${esc(r.phone.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3"))}</a>
        ${EU.isRtl() ? "، " : ", "}<a href="${esc(waLink(r.phone))}" target="_blank" rel="noopener">WhatsApp</a></dd></div>
      <div><dt>${esc(t("tm.rq.prefers"))}</dt><dd>${esc(t(r.via === "call" ? "private.call" : "private.message"))}${comma()}${esc(t("when." + r.when))}</dd></div>
      <div><dt>${esc(t("private.place"))}</dt><dd dir="auto">${esc(r.place || "–")}</dd></div>
      ${r.meter ? `<div><dt>${esc(t("private.meter"))}</dt><dd dir="ltr"><bdi>${esc(r.meter)}</bdi></dd></div>` : ""}
      ${r.note ? `<div class="wide"><dt>${esc(t("tm.rq.theySaid"))}</dt><dd dir="auto">${esc(r.note)}</dd></div>` : ""}
      <div><dt>${esc(t("tm.rq.sent"))}</dt><dd>${esc(EU.dayAndTime(r.createdAt))}</dd></div>
      <div><dt>${esc(t("tm.rq.lang"))}</dt><dd>${esc({ en: "English", ckb: "کوردی", kmr: "Kurmancî", ar: "العربية" }[r.lang] || r.lang)}</dd></div>
    </dl>

    <form class="tm-req__form" id="req-form">
      <fieldset class="field">
        <legend>${esc(t("track.status"))}</legend>
        <div class="choice choice--wrap">${STATUSES.map((s) => `<input type="radio" name="status" id="st-${s}" value="${s}"${s === r.status ? " checked" : ""}><label for="st-${s}">${esc(t("tm.rq." + s))}</label>`).join("")}</div>
      </fieldset>
      <div class="tm-row">
        <div class="field"><label for="req-visit">${esc(t("tm.rq.visit"))}</label>
          <input class="input" type="datetime-local" id="req-visit" value="${r.visitAt ? toInput(r.visitAt) : ""}"></div>
        <div class="field"><label for="req-who">${esc(t("tm.rq.assigned"))}</label>
          <div class="select-wrap"><select class="select" id="req-who"><option value="">${esc(t("tm.rq.nobody"))}</option>
            ${colleagues.map((c) => `<option value="${c.id}"${c.id === r.assignedTo ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div></div>
      </div>
      <div class="field"><label for="req-note">${esc(t("tm.rq.addNote"))}</label>
        <textarea class="input" id="req-note" rows="2" maxlength="500" dir="auto" placeholder="${esc(t("tm.rq.notePh"))}"></textarea></div>
      <p class="form__error" id="req-error" role="alert"></p>
      <button class="btn" type="submit">${esc(t("ad.save"))}</button>
    </form>

    <section class="tm-req__notes">
      <h3>${esc(t("tm.rq.notes"))}</h3>
      ${r.notes.length ? `<ol>${r.notes.map((n) => `<li><p dir="auto">${esc(n.body)}</p><p class="small muted">${esc(n.by || "–")}${EU.isRtl() ? "، " : ", "}${esc(EU.dayAndTime(n.at))}</p></li>`).join("")}</ol>` : `<p class="muted">${esc(t("tm.rq.noNotes"))}</p>`}
    </section>
  </article>`;
}

export default {
  async render(root, ctx) {
    const page = await get("/requests" + ctx.query({ status: filter }));
    if (moreFor !== filter) {
      more = [];
      moreFor = filter;
    }
    list = [...page.requests, ...more.filter((r) => !page.requests.some((x) => x.id === r.id))];
    const left = page.total - list.length;
    const current = openId
      ? await get("/requests/" + encodeURIComponent(openId))
          .then((x) => x.request)
          .catch(() => null)
      : null;
    if (!current) openId = null;
    if (ctx.view !== "requests") return; // they moved on while this was loading

    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("tm.nav.requests"))}</h1><p class="muted">${esc(t("tm.requestsLead"))}</p></div>
        ${ctx.can("supervisor") ? `<a class="btn btn--quiet btn--small" href="/api/team/export/requests${ctx.query({ days: 30 })}" download>${esc(t("tm.export"))}</a>` : ""}</div>
      <div class="filter" role="group">
        ${["active", "new", "scheduled", "closed"].map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(t("tm.rqf." + k))}</button>`).join("")}
      </div>
      <div class="tm-inbox">
        <ul class="tm-inbox__list">${list.length ? list.map(item).join("") : `<li class="tm-empty">${esc(t("tm.rq.empty"))}</li>`}${left > 0 ? `<li><button type="button" class="btn btn--small btn--quiet tm-more" data-more>${esc(t("tm.showMore", { n: left }))}</button></li>` : ""}</ul>
        <div class="tm-inbox__detail">${current ? detail(current, ctx) : `<p class="tm-empty">${esc(t(list.length ? "tm.rq.pick" : "tm.rq.empty"))}</p>`}</div>
      </div>`;

    const moreBtn = root.querySelector("[data-more]");
    if (moreBtn)
      moreBtn.addEventListener("click", async () => {
        moreBtn.disabled = true;
        try {
          more.push(...(await get("/requests" + ctx.query({ status: filter, offset: list.length }))).requests);
          this.render(root, ctx);
        } catch (e) {
          moreBtn.disabled = false;
        }
      });
    root.querySelector(".filter").addEventListener("click", (e) => {
      const b = e.target.closest("[data-f]");
      if (b) {
        filter = b.getAttribute("data-f");
        openId = null;
        this.render(root, ctx, { fresh: true });
      }
    });
    root.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => {
        openId = b.getAttribute("data-open");
        this.render(root, ctx).then(() => {
          const d = root.querySelector(".tm-req");
          if (d) d.scrollIntoView({ block: "nearest" });
        });
      }),
    );

    const form = root.querySelector("#req-form");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      const status = form.querySelector('input[name="status"]:checked').value;
      if (status !== current.status) body.status = status;
      const visit = form.querySelector("#req-visit").value;
      const visitAt = visit ? fromInput(visit) : null;
      if (visitAt !== (current.visitAt || null)) body.visitAt = visitAt;
      const who = form.querySelector("#req-who").value;
      const assignedTo = who ? Number(who) : null;
      if (assignedTo !== (current.assignedTo || null)) body.assignedTo = assignedTo;
      const note = form.querySelector("#req-note").value.trim();
      if (note) body.note = note;
      if (!Object.keys(body).length) return;
      try {
        await patch("/requests/" + encodeURIComponent(current.id), body);
        toast(t("ad.saved"));
        await ctx.reload();
      } catch (err) {
        form.querySelector("#req-error").textContent = errorText(err);
      }
    });
  },
};
