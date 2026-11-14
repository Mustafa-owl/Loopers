/* © 2026 NorthPoint Tech. All rights reserved.

   The admin page: every team account, one at a time.

   On the left, everyone (search, and a filter for switched-off accounts).
   On the right, the person you picked: their details, a new password,
   the browsers they're signed in on, what they did in the last 30 days,
   and whether they can sign in at all.

   Anything that changes someone's access asks for the admin's own password
   first (the server checks it too). Passwords are never shown: a temporary
   one appears once, right after it's made, so it can be read out on the
   phone, and is gone when you leave the page.                            */
import { get, post, patch } from "../api.js";
import { esc, t, toast, errorText, twoTaps } from "../util.js";
import { describe } from "./log.js";

const EU = window.EU;

let openId = null; // a user id, "new" for the add form, or null
let filter = "active"; // active | off | all
let search = "";
let shown = null; // { id, username, password }, shown once
let jump = false; // on a phone, scroll to the person after picking them

/* ---------------- small pieces ---------------- */

function roleField(id, value, disabled = false) {
  return `<div class="select-wrap"><select class="select" id="${id}"${disabled ? " disabled" : ""}>${[
    "staff",
    "supervisor",
    "admin",
  ]
    .map((r) => `<option value="${r}"${r === value ? " selected" : ""}>${esc(t("tm.role." + r))}</option>`)
    .join("")}</select></div>`;
}
function serviceField(id, value) {
  return `<div class="select-wrap"><select class="select" id="${id}"><option value="">${esc(t("tm.both"))}</option>${[
    "electricity",
    "water",
  ]
    .map((s) => `<option value="${s}"${s === value ? " selected" : ""}>${esc(t("svc." + s))}</option>`)
    .join("")}</select></div>`;
}
const roleLine = (u) => t("tm.role." + u.role) + (u.service ? (EU.isRtl() ? "، " : ", ") + t("svc." + u.service) : "");

function statusOf(u) {
  if (!u.active) return t("tm.off");
  if (u.locked) return t("tm.st.locked");
  if (u.mustChangePassword && u.lastLoginAt) return t("tm.st.mustChange");
  return u.lastLoginAt ? t("tm.st.lastIn", { time: EU.ago(u.lastLoginAt) }) : t("tm.st.neverIn");
}

const matches = (u) =>
  (filter === "all" || (filter === "off" ? !u.active : u.active)) &&
  (!search || (u.name + " " + u.username).toLowerCase().includes(search));

/* Ask the admin for their own password in a small dialog. Resolves with
   the password, or null if they cancel. */
function askPassword() {
  return new Promise((resolve) => {
    const d = document.createElement("dialog");
    d.className = "tm-dialog";
    d.innerHTML = `<form method="dialog">
      <h2>${esc(t("tm.confirmTitle"))}</h2>
      <p class="muted">${esc(t("tm.confirmLead"))}</p>
      <div class="field"><label for="cf-pass">${esc(t("tm.password"))}</label>
        <input class="input" id="cf-pass" type="password" autocomplete="current-password" dir="ltr" required></div>
      <div class="tm-dialog__acts">
        <button class="btn btn--quiet" value="cancel" formnovalidate>${esc(t("ad.cancel"))}</button>
        <button class="btn" value="ok">${esc(t("tm.confirmBtn"))}</button>
      </div></form>`;
    document.body.appendChild(d);
    d.addEventListener("close", () => {
      const value = d.returnValue === "ok" ? d.querySelector("#cf-pass").value : null;
      d.remove();
      resolve(value || null);
    });
    d.showModal();
  });
}

/* ---------------- the person on the right ---------------- */

function detailHtml(d, ctx) {
  const u = d.user;
  const self = u.id === ctx.user.id;
  const temp =
    shown && shown.id === u.id
      ? `<div class="tm-notice" role="status">
      <p>${esc(t("tm.tempPass", { username: shown.username }))}</p>
      <p class="tm-pass" dir="ltr"><span id="temp-pass">${esc(shown.password)}</span> <button type="button" class="btn btn--small btn--quiet" data-copy>${esc(t("tm.copy"))}</button></p>
      <p class="small muted">${esc(t("tm.tempPassNote"))}</p></div>`
      : "";

  const sessions = d.sessions.length
    ? `<ul class="tm-sessions">${d.sessions
        .map(
          (x, i) => `<li${i >= 3 && !x.current ? " data-extra hidden" : ""}>
      <div><strong>${esc(x.device || t("tm.unknownDevice"))}</strong>${x.current ? ` <span class="muted">(${esc(t("tm.thisBrowser"))})</span>` : ""}
        <span class="tm-sessions__when">${esc(t("tm.sessionTimes", { since: EU.dayAndTime(x.since), seen: EU.ago(x.lastSeen) }))}</span></div>
      ${x.current ? "" : `<button type="button" class="btn btn--small btn--quiet" data-end="${x.id}">${esc(t("tm.signOutOne"))}</button>`}
    </li>`,
        )
        .join("")}</ul>
    ${d.sessions.length > 3 ? `<p><button type="button" class="link-btn" data-more-sessions>${esc(t("tm.moreSessions", { n: d.sessions.length - 3 }))}</button></p>` : ""}
    ${d.sessions.some((x) => !x.current) ? `<p><button type="button" class="btn btn--small btn--quiet" data-end-all>${esc(t("tm.signOutAll"))}</button></p>` : ""}`
    : `<p class="muted">${esc(t("tm.noSessions"))}</p>`;

  const work = [
    ["ad.reports", d.work.reports],
    ["tm.nav.requests", d.work.requests],
    ["tm.nav.photos", d.work.photos],
    ["notice.title", d.work.notices],
    ["ad.news", d.work.news],
  ];

  return `${temp}
    <header class="tm-adm__head">
      <h2>${esc(u.name)}${self ? ` <span class="muted">(${esc(t("tm.you"))})</span>` : ""}</h2>
      <p><span dir="ltr">${esc(u.username)}</span>${EU.isRtl() ? "، " : ", "}${esc(roleLine(u))}</p>
      <p class="muted">${esc(statusOf({ ...u, locked: d.locked }))}</p>
    </header>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.details"))}</h3>
      <form id="details-form" class="tm-adm__form">
        <div class="tm-row">
          <div class="field"><label for="ed-name">${esc(t("tm.name"))}</label><input class="input" id="ed-name" maxlength="60" dir="auto" value="${esc(u.name)}"></div>
          <div class="field"><label for="ed-user">${esc(t("tm.username"))}</label><input class="input" id="ed-user" maxlength="32" dir="ltr" autocapitalize="off" spellcheck="false" value="${esc(u.username)}"></div>
        </div>
        <div class="tm-row">
          <div class="field"><label for="ed-role">${esc(t("tm.roleCol"))}</label>${roleField("ed-role", u.role, self)}</div>
          <div class="field"><label for="ed-svc">${esc(t("tm.serviceCol"))}</label>${serviceField("ed-svc", u.service)}</div>
        </div>
        <p class="form__error" id="ed-err" role="alert"></p>
        <button class="btn btn--small" type="submit">${esc(t("ad.save"))}</button>
      </form>
    </section>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.password"))}</h3>
      ${
        self
          ? `<p class="muted">${esc(t("tm.passSelf"))}</p>`
          : `
      <p class="muted">${esc(t("tm.passNobody"))}</p>
      <div class="tm-seg" role="radiogroup" aria-label="${esc(t("tm.sec.password"))}">
        <label><input type="radio" name="pw-how" value="temp" checked> ${esc(t("tm.passTemp"))}</label>
        <label><input type="radio" name="pw-how" value="own"> ${esc(t("tm.passOwn"))}</label>
      </div>
      <form id="pw-form" class="tm-adm__form">
        <p class="small muted" data-how="temp">${esc(t("tm.passTempNote"))}</p>
        <div data-how="own" hidden>
          <div class="field"><label for="pw-new">${esc(t("tm.passNew"))}</label>
            <div class="tm-secret"><input class="input" id="pw-new" type="password" autocomplete="new-password" dir="ltr" minlength="10">
            <button type="button" class="tm-secret__show" data-show-pw aria-pressed="false">${esc(t("tm.showPass"))}</button></div>
            <p class="hint">${esc(t("tm.newPassLead"))}</p></div>
          <label class="tm-check"><input type="checkbox" id="pw-must" checked> ${esc(t("tm.passMust"))}</label>
        </div>
        <p class="form__error" id="pw-err" role="alert"></p>
        <button class="btn btn--small" type="submit">${esc(t("tm.passSave"))}</button>
      </form>`
      }
    </section>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.sessions"))}</h3>
      ${sessions}
    </section>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.work"))}</h3>
      <dl class="tm-work">${work.map(([k, n]) => `<div><dt>${esc(t(k))}</dt><dd>${EU.num(n)}</dd></div>`).join("")}</dl>
      <p class="small muted">${esc(t("tm.workNote"))}</p>
    </section>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.activity"))}</h3>
      ${
        d.activity.length
          ? `<ol class="tm-feed">${d.activity.map((e) => `<li><time datetime="${new Date(e.at).toISOString()}" title="${esc(EU.dayAndTime(e.at))}">${esc(EU.ago(e.at))}</time><span>${esc(describe(e))}</span></li>`).join("")}</ol>`
          : `<p class="muted">${esc(t("tm.noActivity"))}</p>`
      }
    </section>

    <section class="tm-adm__sec">
      <h3>${esc(t("tm.sec.access"))}</h3>
      <p>${esc(t(u.active ? "tm.accessOn" : "tm.accessOff"))}</p>
      ${d.locked ? `<p>${esc(t("tm.lockedUntil", { time: EU.dayAndTime(d.locked.until) }))}</p>` : ""}
      <div class="tm-row-acts tm-row-acts--start">
        ${d.locked ? `<button type="button" class="btn btn--small btn--quiet" data-unlock>${esc(t("tm.unlock"))}</button>` : ""}
        ${self ? "" : `<button type="button" class="btn btn--small ${u.active ? "btn--danger" : "btn--quiet"}" data-active="${u.active ? 0 : 1}">${esc(t(u.active ? "tm.switchOff" : "tm.switchOn"))}</button>`}
        ${d.canRemove ? `<button type="button" class="btn btn--small btn--danger" data-remove>${esc(t("tm.remove"))}</button>` : ""}
      </div>
      ${d.canRemove ? `<p class="small muted">${esc(t("tm.removeNote"))}</p>` : ""}
    </section>`;
}

function addHtml(ctx) {
  return `<form class="tm-adm__form" id="add-form">
      <header class="tm-adm__head"><h2>${esc(t("tm.addPerson"))}</h2></header>
      <div class="tm-row">
        <div class="field"><label for="add-name">${esc(t("tm.name"))}</label><input class="input" id="add-name" maxlength="60" dir="auto"></div>
        <div class="field"><label for="add-user">${esc(t("tm.username"))}</label><input class="input" id="add-user" maxlength="32" dir="ltr" autocapitalize="off" spellcheck="false" placeholder="karwan.o"></div>
      </div>
      <div class="tm-row">
        <div class="field"><label for="add-role">${esc(t("tm.roleCol"))}</label>${roleField("add-role", "staff")}</div>
        <div class="field"><label for="add-svc">${esc(t("tm.serviceCol"))}</label>${serviceField("add-svc", ctx.service || "electricity")}</div>
      </div>
      <p class="hint">${esc(t("tm.rolesHint"))}</p>
      <p class="form__error" id="add-err" role="alert"></p>
      <div class="tm-row-acts tm-row-acts--start">
        <button class="btn btn--small" type="submit">${esc(t("tm.addPerson"))}</button>
        <button class="btn btn--small btn--quiet" type="button" data-cancel-add>${esc(t("ad.cancel"))}</button>
      </div>
    </form>`;
}

/* ---------------- the page ---------------- */

export default {
  async render(root, ctx) {
    const { users } = await get("/users");
    if (ctx.view !== "admin") return;
    if (openId !== "new" && !users.some((u) => u.id === openId))
      openId = (users.find((u) => u.id === ctx.user.id) || users[0] || {}).id ?? null;
    let detail = null;
    if (openId && openId !== "new") {
      try {
        detail = await get("/users/" + openId);
      } catch (err) {
        if (err.status !== 404) throw err;
        openId = null;
      }
      if (ctx.view !== "admin") return;
    }
    const counts = {
      active: users.filter((u) => u.active).length,
      off: users.filter((u) => !u.active).length,
      all: users.length,
    };

    root.innerHTML = `
      <div class="tm-head tm-head--row">
        <div><h1>${esc(t("tm.nav.admin"))}</h1><p class="muted">${esc(t("tm.adminLead"))}</p></div>
        <button type="button" class="btn btn--small" data-add>${esc(t("tm.addPerson"))}</button>
      </div>
      <div class="tm-inbox tm-adm">
        <div class="tm-adm__side">
          <input class="input tm-adm__search" type="search" id="adm-search" placeholder="${esc(t("tm.search"))}" aria-label="${esc(t("tm.search"))}" value="${esc(search)}">
          <div class="filter" role="group" aria-label="${esc(t("tm.nav.admin"))}">
            ${["active", "off", "all"].map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(t(k === "off" ? "tm.off" : "tm.f." + k))} <span class="muted">${EU.num(counts[k])}</span></button>`).join("")}
          </div>
          <ul class="tm-inbox__list" id="adm-list">
            ${users
              .map(
                (
                  u,
                ) => `<li data-match="${matches(u) ? 1 : 0}"${matches(u) ? "" : " hidden"} data-text="${esc((u.name + " " + u.username).toLowerCase())}" data-active="${u.active ? 1 : 0}">
              <button type="button" class="tm-inbox__item${u.id === openId ? " is-open" : ""}" data-open="${u.id}" aria-current="${u.id === openId}">
                <span class="tm-inbox__top"><strong>${esc(u.name)}</strong><span dir="ltr">${esc(u.username)}</span></span>
                <span class="tm-inbox__status">${esc(roleLine(u))}</span>
                <span class="tm-inbox__status">${esc(statusOf(u))}</span>
              </button></li>`,
              )
              .join("")}
            <li class="tm-adm__none muted" hidden>${esc(t("tm.noOne"))}</li>
          </ul>
          <div class="tm-adm__everyone">
            <h2>${esc(t("tm.everyone"))}</h2>
            <p class="small muted">${esc(t("tm.signOutEveryoneNote"))}</p>
            <button type="button" class="btn btn--small btn--quiet" data-everyone>${esc(t("tm.signOutEveryone"))}</button>
          </div>
        </div>
        <div class="tm-inbox__detail tm-adm__detail" id="adm-detail">
          ${openId === "new" ? addHtml(ctx) : detail ? detailHtml(detail, ctx) : `<p class="tm-empty">${esc(t("tm.pickSomeone"))}</p>`}
        </div>
      </div>`;
    shown = null; // a temporary password is shown once only
    if (jump && window.matchMedia("(max-width: 900px)").matches)
      root.querySelector("#adm-detail").scrollIntoView({ behavior: "smooth", block: "start" });
    jump = false;

    const again = () => this.render(root, ctx);
    const run = async (fn, errBox) => {
      try {
        await fn();
      } catch (err) {
        if (errBox) errBox.textContent = errorText(err);
        else toast(errorText(err));
      }
    };
    // Things that change someone's access: ask for the admin's own password first
    const guarded = async (fn) => {
      const confirm = await askPassword();
      if (confirm) await run(() => fn(confirm));
    };

    /* the list */
    const list = root.querySelector("#adm-list");
    const refilter = () => {
      let any = false;
      list.querySelectorAll("li[data-text]").forEach((li) => {
        const on = li.getAttribute("data-active") === "1";
        const ok =
          (filter === "all" || (filter === "off" ? !on : on)) &&
          (!search || li.getAttribute("data-text").includes(search));
        li.hidden = !ok;
        any = any || ok;
      });
      list.querySelector(".tm-adm__none").hidden = any;
    };
    refilter();
    root.querySelector("#adm-search").addEventListener("input", (e) => {
      search = e.target.value.trim().toLowerCase();
      refilter();
    });
    root.querySelectorAll("[data-f]").forEach((b) =>
      b.addEventListener("click", () => {
        filter = b.getAttribute("data-f");
        root.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        refilter();
      }),
    );
    list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-open]");
      if (b) {
        openId = Number(b.getAttribute("data-open"));
        jump = true;
        again();
      }
    });
    root.querySelector("[data-add]").addEventListener("click", () => {
      openId = "new";
      again();
    });
    root.querySelector("[data-everyone]").addEventListener("click", () =>
      guarded(async (confirm) => {
        const res = await post("/signout-everyone", { confirm });
        toast(t("tm.signedOutN", { n: EU.num(res.ended) }));
        again();
      }),
    );

    /* adding someone */
    const add = root.querySelector("#add-form");
    if (add) {
      add.querySelector("[data-cancel-add]").addEventListener("click", () => {
        openId = null;
        again();
      });
      add.addEventListener("submit", (e) => {
        e.preventDefault();
        run(async () => {
          const res = await post("/users", {
            name: add.querySelector("#add-name").value,
            username: add.querySelector("#add-user").value,
            role: add.querySelector("#add-role").value,
            service: add.querySelector("#add-svc").value || null,
          });
          openId = res.user.id;
          shown = { id: res.user.id, username: res.user.username, password: res.password };
          again();
        }, add.querySelector("#add-err"));
      });
      add.querySelector("#add-name").focus();
    }
    if (!detail) return;

    /* one person */
    const id = detail.user.id;
    const box = root.querySelector("#adm-detail");
    const copy = box.querySelector("[data-copy]");
    if (copy)
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(box.querySelector("#temp-pass").textContent);
          copy.textContent = t("tm.copied");
        } catch (err) {
          /* select it by hand */
        }
      });

    const details = box.querySelector("#details-form");
    details.addEventListener("submit", (e) => {
      e.preventDefault();
      run(async () => {
        await patch("/users/" + id, {
          name: details.querySelector("#ed-name").value,
          username: details.querySelector("#ed-user").value,
          role: details.querySelector("#ed-role").value,
          service: details.querySelector("#ed-svc").value || null,
        });
        toast(t("ad.saved"));
        again();
      }, details.querySelector("#ed-err"));
    });

    const pw = box.querySelector("#pw-form");
    if (pw) {
      const how = () => box.querySelector('input[name="pw-how"]:checked').value;
      box.querySelectorAll('input[name="pw-how"]').forEach((r) =>
        r.addEventListener("change", () => {
          pw.querySelectorAll("[data-how]").forEach((el) => {
            el.hidden = el.getAttribute("data-how") !== how();
          });
          if (how() === "own") pw.querySelector("#pw-new").focus();
        }),
      );
      const show = pw.querySelector("[data-show-pw]");
      show.addEventListener("click", () => {
        const input = pw.querySelector("#pw-new");
        const showing = input.type === "password";
        input.type = showing ? "text" : "password";
        show.setAttribute("aria-pressed", String(showing));
        show.textContent = t(showing ? "tm.hidePass" : "tm.showPass");
      });
      pw.addEventListener("submit", (e) => {
        e.preventDefault();
        const err = pw.querySelector("#pw-err");
        err.textContent = "";
        const password = pw.querySelector("#pw-new").value;
        if (how() === "own" && password.length < 10) {
          err.textContent = errorText({ reason: "shortPassword" });
          return;
        }
        guarded(async (confirm) => {
          if (how() === "temp") {
            const res = await post(`/users/${id}/reset`, { confirm });
            shown = { id, username: res.user.username, password: res.password };
          } else {
            await post(`/users/${id}/password`, {
              password,
              mustChange: pw.querySelector("#pw-must").checked,
              confirm,
            });
            toast(t("tm.passDone"));
          }
          again();
        });
      });
    }

    box.querySelectorAll("[data-end]").forEach((b) =>
      b.addEventListener("click", () =>
        guarded(async (confirm) => {
          await post(`/users/${id}/signout`, { session: Number(b.getAttribute("data-end")), confirm });
          toast(t("tm.signedOut"));
          again();
        }),
      ),
    );
    const moreS = box.querySelector("[data-more-sessions]");
    if (moreS)
      moreS.addEventListener("click", () => {
        box.querySelectorAll("[data-extra]").forEach((li) => (li.hidden = false));
        moreS.parentElement.remove();
      });
    const endAll = box.querySelector("[data-end-all]");
    if (endAll)
      endAll.addEventListener("click", () =>
        guarded(async (confirm) => {
          const res = await post(`/users/${id}/signout`, { confirm });
          toast(t("tm.signedOutN", { n: EU.num(res.ended) }));
          again();
        }),
      );

    const unlock = box.querySelector("[data-unlock]");
    if (unlock)
      unlock.addEventListener("click", () =>
        run(async () => {
          await post(`/users/${id}/unlock`);
          toast(t("ad.saved"));
          again();
        }),
      );

    const active = box.querySelector("[data-active]");
    if (active)
      active.addEventListener("click", () => {
        const go = () =>
          run(async () => {
            await patch("/users/" + id, { active: active.getAttribute("data-active") === "1" });
            toast(t("ad.saved"));
            again();
          });
        if (active.getAttribute("data-active") === "0") twoTaps(active, go);
        else go(); // switching off: tap twice
      });

    const remove = box.querySelector("[data-remove]");
    if (remove)
      remove.addEventListener("click", () =>
        guarded(async (confirm) => {
          await post(`/users/${id}/remove`, { confirm });
          openId = null;
          toast(t("tm.removed"));
          again();
        }),
      );
  },
};
