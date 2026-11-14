/* © 2026 NorthPoint Tech. All rights reserved.

   Pop-up messages (admins). Write a short message, see exactly how it will
   look, pick when it runs, and show it. It appears in a corner of every
   public page until it ends, someone takes it down, or a visitor closes
   it. It can also go to every phone that gets alerts, once.            */
import { get, post } from "../api.js";
import { esc, t, toast, errorText, langFields, readLangs, toInput, fromInput, when } from "../util.js";

const EU = window.EU;
const HOUR = 36e5;
let older = []; // pages loaded with "Show older"

function row(p) {
  const title = EU.pick(p.title);
  const range = `${when(p.from)} – ${when(p.to)}`;
  return `<li class="tm-pop__row" data-id="${p.id}">
    <div>
      <p class="small muted">${esc(t("tm.pop.state." + p.state))}${p.kind === "urgent" ? (EU.isRtl() ? "، " : ", ") + esc(t("tm.pop.urgent")) : ""}${p.pushed != null ? (EU.isRtl() ? "، " : ", ") + esc(t("tm.pop.pushedN", { n: p.pushed })) : ""}</p>
      <p class="tm-pop__title" dir="auto">${esc(title)}</p>
      <p class="small muted"><bdi>${esc(range)}</bdi></p>
    </div>
    ${p.state === "on" || p.state === "waiting" ? `<button type="button" class="btn btn--small btn--quiet btn--danger" data-end="${p.id}">${esc(t("tm.pop.end"))}</button>` : ""}
  </li>`;
}

function preview(form) {
  const title = readLangs(form.querySelector("#pop-title")) || {};
  const body = readLangs(form.querySelector("#pop-body")) || {};
  const urgent = form.querySelector('input[name="pop-kind"]:checked').value === "urgent";
  const link = form.querySelector("#pop-link").value.trim();
  const box = form.querySelector("#pop-preview");
  const T = EU.pick(title) || t("tm.pop.previewTitle");
  const B = EU.pick(body);
  box.className = "popup popup--preview" + (urgent ? " popup--urgent" : "");
  // how it shows on a phone, when it's sent there
  const push = form.querySelector("#pop-push");
  form.querySelector("#pop-phone-look").hidden = !(push && push.checked);
  form.querySelector("#pop-notif").innerHTML =
    `<img src="/assets/img/icon-192.png" alt="" width="32" height="32"><div><p class="tm-notif__app">${esc(t("brand"))}</p>
    <p class="tm-notif__title" dir="auto">${esc((urgent ? EU.t("popup.urgent") + ": " : "") + T)}</p>${B ? `<p class="tm-notif__body" dir="auto">${esc(B)}</p>` : ""}</div>`;
  box.innerHTML = `${urgent ? `<p class="popup__kind">${esc(EU.t("popup.urgent"))}</p>` : ""}
    <p class="popup__title" dir="auto">${esc(T)}</p>${B ? `<p class="popup__body" dir="auto">${esc(B)}</p>` : ""}
    <div class="popup__acts">${link ? `<span class="btn btn--small">${esc(EU.t("popup.more"))}</span>` : ""}<span class="btn btn--small btn--quiet">${esc(EU.t("popup.close"))}</span></div>`;
}

export default {
  async render(root, ctx) {
    if (ctx.user.role !== "admin") {
      root.innerHTML = `<p class="tm-empty">${esc(t("tm.err.notAllowed"))}</p>`;
      return;
    }
    const data = await get("/popups");
    if (ctx.view !== "popups") return;
    const list = [...data.popups, ...older];
    const start = Math.ceil(Date.now() / HOUR) * HOUR - HOUR;

    root.innerHTML = `
      <div class="tm-head"><h1>${esc(t("tm.nav.popups"))}</h1><p class="muted">${esc(t("tm.pop.lead"))}</p></div>
      <form class="tm-form tm-pop" id="pop-form" novalidate>
        <div class="tm-pop__write">
          <fieldset class="field"><legend>${esc(t("tm.pop.kind"))}</legend><div class="choice">
            <input type="radio" name="pop-kind" id="pop-k-info" value="info" checked><label for="pop-k-info">${esc(t("tm.pop.info"))}</label>
            <input type="radio" name="pop-kind" id="pop-k-urgent" value="urgent"><label for="pop-k-urgent">${esc(t("tm.pop.urgent"))}</label>
          </div></fieldset>
          <fieldset class="field" id="pop-title"><legend>${esc(t("tm.pop.title"))}</legend><p class="hint">${esc(t("tm.pop.langHint"))}</p>${langFields("pt", null, 90)}</fieldset>
          <fieldset class="field" id="pop-body"><legend>${esc(t("tm.pop.body"))} <span class="muted">${esc(t("report.optional"))}</span></legend>${langFields("pb", null, 280)}</fieldset>
          <div class="field"><label for="pop-link">${esc(t("tm.pop.link"))} <span class="muted">${esc(t("report.optional"))}</span></label>
            <input class="input" id="pop-link" type="text" dir="ltr" placeholder="https:// or /map.html"></div>
          <div class="tm-row">
            <div class="field"><label for="pop-from">${esc(t("ad.starts"))}</label><input class="input" type="datetime-local" id="pop-from" value="${toInput(Date.now())}"></div>
            <div class="field"><label for="pop-to">${esc(t("ad.ends"))}</label><input class="input" type="datetime-local" id="pop-to" value="${toInput(start + 3 * 24 * HOUR)}"></div>
          </div>
          <fieldset class="field tm-pop__send"><legend>${esc(t("tm.pop.sendTitle"))}</legend>
            <label class="tm-check"><input type="checkbox" checked disabled><span>${esc(t("tm.pop.onSite"))}</span></label>
            <label class="tm-check"><input type="checkbox" id="pop-push"${data.phones ? "" : " disabled"}><span>${esc(t("tm.pop.push", { n: EU.num(data.phones) }))}</span></label>
          </fieldset>
          ${data.texts != null ? `<label class="tm-check"><input type="checkbox" id="pop-sms"><span>${esc(t("tm.pop.sms", { n: EU.num(data.texts) }))}</span></label>` : ""}
          <p class="hint">${esc(t("tm.pop.pushHint"))}</p>
          <p class="form__error" id="pop-err" role="alert"></p>
          <div class="actions"><button class="btn" type="submit">${esc(t("tm.pop.show"))}</button></div>
        </div>
        <div class="tm-pop__look"><p class="small muted">${esc(t("tm.pop.preview"))}</p><div id="pop-preview"></div>
          <div id="pop-phone-look" hidden><p class="small muted tm-pop__phoneh">${esc(t("tm.pop.phoneLook"))}</p><div class="tm-notif" id="pop-notif"></div></div></div>
      </form>
      <h2 class="tm-sub">${esc(t("tm.pop.all", { n: EU.num(data.total) }))}</h2>
      ${list.length ? `<ol class="tm-pop__list">${list.map(row).join("")}</ol>` : `<p class="tm-empty">${esc(t("tm.pop.none"))}</p>`}
      ${data.more || (older.length && older.length + data.popups.length < data.total) ? `<p><button type="button" class="btn btn--small btn--quiet" id="pop-older">${esc(t("tm.showOlder"))}</button></p>` : ""}`;

    const form = root.querySelector("#pop-form");
    const again = () => this.render(root, ctx);
    // urgent ones go to phones too unless someone unticks it
    form.querySelectorAll('input[name="pop-kind"]').forEach((r) =>
      r.addEventListener("change", () => {
        const push = form.querySelector("#pop-push");
        if (!push.disabled) push.checked = r.value === "urgent" && r.checked ? true : push.checked;
      }),
    );
    preview(form);
    form.addEventListener("input", () => preview(form));
    form.addEventListener("change", () => preview(form));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = form.querySelector("#pop-err");
      err.textContent = "";
      const popup = {
        kind: form.querySelector('input[name="pop-kind"]:checked').value,
        title: readLangs(form.querySelector("#pop-title")),
        body: readLangs(form.querySelector("#pop-body")),
        link: form.querySelector("#pop-link").value.trim(),
        from: fromInput(form.querySelector("#pop-from").value),
        to: fromInput(form.querySelector("#pop-to").value),
        push: form.querySelector("#pop-push").checked,
        sms: !!(form.querySelector("#pop-sms") && form.querySelector("#pop-sms").checked),
      };
      if (!popup.title) {
        err.textContent = errorText({ reason: "needTitle" });
        form.querySelector("#pop-title textarea").focus();
        return;
      }
      if (!(popup.to > popup.from)) {
        err.textContent = errorText({ reason: "endsBeforeStart" });
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const r = await post("/popups", { popup });
        toast(
          (r.popup.state === "on" ? t("tm.pop.isOn") : t("tm.pop.isWaiting")) +
            (r.popup.pushed != null ? (EU.isRtl() ? "، " : ", ") + t("tm.pop.pushedN", { n: r.popup.pushed }) : ""),
        );
        older = [];
        again();
      } catch (e2) {
        err.textContent = errorText(e2);
        btn.disabled = false;
      }
    });
    root.querySelectorAll("[data-end]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await post(`/popups/${b.getAttribute("data-end")}/end`, {});
          toast(t("tm.pop.ended"));
          again();
        } catch (e) {
          toast(errorText(e));
        }
      }),
    );
    const more = root.querySelector("#pop-older");
    if (more)
      more.addEventListener("click", async () => {
        const last = list[list.length - 1];
        const r = await get("/popups?before=" + last.id);
        older.push(...r.popups);
        again();
      });
  },
};
