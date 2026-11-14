/* © 2026 NorthPoint Tech. All rights reserved. */
/* About: one power cut in Ankawa, step by step, from the first report to the
   day it's deleted. The words on each step are the same strings the real
   report uses, so the story can't drift from what the site says. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const AREA = "ankawa";

  // The story happens this evening, Erbil time (UTC+3)
  function at(h, m) {
    const d = new Date(Date.now() + 3 * 3600e3);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 3, m);
  }
  const T = { sent: at(20, 10), metoo: at(20, 25), crew: at(21, 5), fine: at(23, 40) };

  // What the report and the map look like after each step
  const STEPS = [
    { key: "s1", time: T.sent, map: "unconfirmed", r: { people: 1, confirmed: false } },
    { key: "s2", time: T.metoo, map: "out", r: { people: 2, confirmed: true } },
    { key: "s3", time: T.crew, map: "out", r: { people: 2, confirmed: true, fixing: T.crew } },
    { key: "s4", time: T.fine, map: "back", r: { people: 2, confirmed: true, fine: 1, resolved: true } },
    { key: "s5", map: "none", kept: true },
    { key: "s6", map: "none", gone: true },
  ];
  let step = 0;

  // The report as plain lines: where, what, what the team says, who reported it
  function screen(s) {
    if (s.gone) return `<p class="life__gone">${EU.esc(EU.t("about.gone"))}</p>`;
    const r = s.r || {};
    const lines = [];
    if (s.kept) {
      lines.push(`<p class="life__label">${EU.esc(EU.t("about.kept"))}</p>`);
      lines.push(`<p class="life__where">${EU.esc(EU.areaName(AREA))}</p>`);
      lines.push(`<p class="life__what">${EU.esc(EU.t("p.no_power"))}</p>`);
      lines.push(
        `<p class="life__who"><bdi>${EU.esc(EU.clock(T.sent))}–${EU.esc(EU.clock(T.fine))}</bdi>, ${EU.esc(EU.t("people", { n: EU.num(2) }))}</p>`,
      );
      return lines.join("");
    }
    lines.push(`<p class="life__where">${EU.esc(EU.areaName(AREA))}</p>`);
    lines.push(`<p class="life__what">${EU.esc(EU.t("p.no_power"))}</p>`);
    if (r.fixing && !r.resolved)
      lines.push(`<p class="life__crew">${EU.esc(EU.t("report.fixing", { time: EU.clock(r.fixing) }))}</p>`);
    const who = r.resolved
      ? EU.t("area.resolved")
      : r.confirmed
        ? EU.t("people", { n: EU.num(r.people) })
        : EU.t("state.unconfirmed");
    lines.push(`<p class="life__who">${EU.esc(who)}</p>`);
    lines.push(
      `<p class="life__map">${EU.esc(EU.t("about.onMap", { area: EU.areaName(AREA) }))}: <b>${EU.esc(EU.stateText("electricity", s.map))}</b></p>`,
    );
    return lines.join("");
  }

  function render() {
    const s = STEPS[step];
    $("life-steps").innerHTML = STEPS.map(
      (x, i) => `<li class="${i <= step ? "is-lit" : ""}${i === step ? " is-now" : ""}">
      <button type="button" data-step="${i}"${i === step ? ' aria-current="step"' : ""}>
        ${x.time ? `<span class="life__clock"><bdi>${EU.esc(EU.clock(x.time))}</bdi></span>` : ""}
        <span class="life__title">${EU.esc(EU.t("about." + x.key))}</span>
      </button></li>`,
    ).join("");
    $("life-screen").innerHTML = screen(s);
    $("life-now").textContent = EU.t("about." + s.key);
    $("life-text").textContent = EU.t("about." + s.key + "b");
    $("life-back").disabled = step === 0;
    $("life-next").textContent = EU.t(step === STEPS.length - 1 ? "about.again" : "about.next");
    // on a phone the ledger stacks, so each cell carries its column name
    const heads = [...document.querySelectorAll(".keep__table thead th")].map((th) => th.textContent);
    document
      .querySelectorAll(".keep__table tbody tr")
      .forEach((tr) => tr.querySelectorAll("td").forEach((td, i) => td.setAttribute("data-label", heads[i + 1] || "")));
    $("life-count").textContent = EU.t("about.stepOf", { n: EU.num(step + 1), total: EU.num(STEPS.length) });
  }

  function go(i, focus) {
    step = (i + STEPS.length) % STEPS.length;
    render();
    if (focus) {
      const b = document.querySelector(`[data-step="${step}"]`);
      if (b) b.focus();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("life-steps").addEventListener("click", (e) => {
      const b = e.target.closest("[data-step]");
      if (b) go(Number(b.getAttribute("data-step")), true);
    });
    // up / down (and left / right) move along the wire
    $("life-steps").addEventListener("keydown", (e) => {
      const fwd = e.key === "ArrowDown" || e.key === (EU.isRtl() ? "ArrowLeft" : "ArrowRight");
      const back = e.key === "ArrowUp" || e.key === (EU.isRtl() ? "ArrowRight" : "ArrowLeft");
      if (!fwd && !back) return;
      e.preventDefault();
      go(Math.min(Math.max(step + (fwd ? 1 : -1), 0), STEPS.length - 1), true);
    });
    $("life-next").addEventListener("click", () => go(step + 1));
    $("life-back").addEventListener("click", () => go(step - 1));
    render();
    EU.onLang(render);
  });
})();
