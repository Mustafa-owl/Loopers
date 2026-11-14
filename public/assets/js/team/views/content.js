/* © 2026 NorthPoint Tech. All rights reserved.
   Planned cuts and news: the two things a team publishes. Both show on
   the home page slideshow as soon as they're saved, and people who follow
   a neighbourhood get an alert about a cut there (12 hours ahead, or
   straight away if it's sooner). */
import { get, post, put, patch, del } from "../api.js";
import {
  esc,
  t,
  toast,
  errorText,
  twoTaps,
  langFields,
  readLangs,
  toInput,
  fromInput,
  todayErbil,
  svcName,
} from "../util.js";

const EU = window.EU;
const HOUR = 36e5;
let editingCut = null; // the id being changed, "new", or null
let editingNews = null;
let showFound = "new";
let foundMore = [],
  foundMoreFor = null,
  foundLeft = 0; // suggestions after the first 40
let newsMore = []; // team news after the first 60
const day = (d) => {
  if (!d) return "";
  const [y, m, dd] = d.split("-");
  return EU.num(Number(dd)) + " " + EU.monthName(y + "-" + m);
}; // which suggestions: new | published | dismissed

function serviceField(ctx, current) {
  if (ctx.user.role !== "admin") return "";
  const pick = current || ctx.service || "electricity";
  return `<fieldset class="field"><legend>${esc(t("tm.forService"))}</legend><div class="choice">
    ${["electricity", "water"].map((s) => `<input type="radio" name="service" id="svc-${s}" value="${s}"${s === pick ? " checked" : ""}${current ? " disabled" : ""}><label for="svc-${s}">${esc(t("svc." + s))}</label>`).join("")}
  </div></fieldset>`;
}
const chosenService = (form) => {
  const el = form.querySelector('input[name="service"]:checked');
  return el ? el.value : undefined;
};

/* ---------------- planned cuts ---------------- */

function cutForm(n, ctx) {
  const areas = n ? n.areas : [];
  const start = n ? n.from : Math.ceil(Date.now() / HOUR) * HOUR;
  return `<form class="tm-form" id="cut-form">
    <h2>${esc(t(n ? "ad.editCut" : "ad.addCut"))}</h2>
    ${serviceField(ctx, n && n.service)}
    <fieldset class="field"><legend>${esc(t("ad.where"))}</legend>
      <label class="tm-check tm-check--all"><input type="checkbox" id="cut-all"${areas.includes("all") ? " checked" : ""}><span>${esc(t("ad.wholeCity"))}</span></label>
      <div class="tm-areas${areas.includes("all") ? " is-off" : ""}" id="cut-areas">${EU.sortedAreas()
        .map(
          (a) =>
            `<label class="tm-check"><input type="checkbox" value="${a.slug}"${areas.includes(a.slug) ? " checked" : ""}><span>${esc(EU.areaName(a))}</span></label>`,
        )
        .join("")}</div>
    </fieldset>
    <div class="tm-row">
      <div class="field"><label for="cut-from">${esc(t("ad.starts"))}</label><input class="input" type="datetime-local" id="cut-from" value="${toInput(start)}"></div>
      <div class="field"><label for="cut-to">${esc(t("ad.ends"))}</label><input class="input" type="datetime-local" id="cut-to" value="${toInput(n ? n.to : start + 4 * HOUR)}"></div>
    </div>
    <fieldset class="field"><legend>${esc(t("ad.reason"))}</legend><p class="hint">${esc(t("ad.langHint"))}</p>${langFields("reason", n && n.reason, 240)}</fieldset>
    <div class="field"><label for="cut-src">${esc(t("ad.source"))}</label><input class="input" id="cut-src" maxlength="80" dir="auto" value="${esc(n && n.source ? EU.pick(n.source) : "")}" placeholder="${esc(t("ad.sourcePh." + ((n && n.service) || ctx.user.service || "electricity")))}"></div>
    <p class="form__error" id="cut-err" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">${esc(t("ad.save"))}</button><button class="btn btn--quiet" type="button" data-cancel>${esc(t("ad.cancel"))}</button></div>
  </form>`;
}

export const cuts = {
  render(root, ctx) {
    const list = ctx.data.notices.slice().sort((a, b) => a.from - b.from);
    const now = Date.now();
    const current = editingCut && editingCut !== "new" ? list.find((n) => n.id === editingCut) : null;
    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("notice.title"))}</h1><p class="muted">${esc(t("tm.cutsLead"))}</p></div>
        ${editingCut ? "" : `<button type="button" class="btn" id="cut-new">${esc(t("ad.addCut"))}</button>`}</div>
      ${editingCut ? cutForm(current, ctx) : ""}
      ${
        list.length
          ? `<table class="tm-table tm-table--rows"><thead><tr><th scope="col">${esc(t("ad.where"))}</th><th scope="col">${esc(t("tm.when"))}</th><th scope="col">${esc(t("ad.reason"))}</th><th scope="col"><span class="sr-only">${esc(t("tm.actionsCol"))}</span></th></tr></thead><tbody>
        ${list
          .map((n) => {
            const shown = { ...n, now: n.from <= now && n.to > now };
            const state = n.to <= now ? t("ad.ended") : EU.noticeWhen(shown);
            return `<tr class="${n.to <= now ? "is-past" : ""}">
            <td><strong>${esc(EU.noticeAreas(n))}</strong>${ctx.user.role === "admin" ? `<span class="tm-r__svc">${esc(svcName(n.service))}</span>` : ""}</td>
            <td>${shown.now && n.to > now ? `<span class="tm-on">${esc(t("tm.onNow"))}</span>, ` : ""}${esc(state)}${n.alertedAt ? `<br><span class="small muted">${esc(t("tm.alerted"))}</span>` : ""}</td>
            <td>${esc(n.reason ? EU.pick(n.reason) : "")}<br><span class="small muted">${esc(n.source ? EU.pick(n.source) : "")}</span></td>
            <td><div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-edit="${esc(n.id)}">${esc(t("ad.edit"))}</button>
              <button type="button" class="btn btn--small btn--danger" data-del="${esc(n.id)}">${esc(t("ad.delete"))}</button></div></td></tr>`;
          })
          .join("")}</tbody></table>`
          : `<p class="tm-empty">${esc(t("ad.noCuts"))}</p>`
      }`;

    const again = () => this.render(root, ctx);
    const newBtn = root.querySelector("#cut-new");
    if (newBtn)
      newBtn.addEventListener("click", () => {
        editingCut = "new";
        again();
        root.querySelector("#cut-form input:not([disabled])").focus();
      });
    root.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        editingCut = b.getAttribute("data-edit");
        again();
        window.scrollTo({ top: 0 });
      }),
    );
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () =>
        twoTaps(b, async () => {
          try {
            await del("/notices/" + encodeURIComponent(b.getAttribute("data-del")));
            toast(t("tm.deleted"));
            await ctx.reload();
          } catch (err) {
            toast(errorText(err));
          }
        }),
      ),
    );

    const form = root.querySelector("#cut-form");
    if (!form) return;
    form.querySelector("[data-cancel]").addEventListener("click", () => {
      editingCut = null;
      again();
    });
    form
      .querySelector("#cut-all")
      .addEventListener("change", (e) => form.querySelector("#cut-areas").classList.toggle("is-off", e.target.checked));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = (k) => {
        form.querySelector("#cut-err").textContent = k;
      };
      const all = form.querySelector("#cut-all").checked;
      const areas = all ? ["all"] : [...form.querySelectorAll("#cut-areas input:checked")].map((i) => i.value);
      const from = fromInput(form.querySelector("#cut-from").value),
        to = fromInput(form.querySelector("#cut-to").value);
      const reason = readLangs(form);
      if (!areas.length) return err(t("ad.err.needAreas"));
      if (!(to > from)) return err(t("ad.err.badTime"));
      if (to - from > 14 * 24 * HOUR) return err(t("ad.err.tooLong"));
      if (!reason) return err(t("ad.err.needReason"));
      const src = form.querySelector("#cut-src").value.trim();
      const notice = { areas, from, to, reason, source: src ? { any: src } : null };
      try {
        if (current) await put("/notices/" + encodeURIComponent(current.id), { notice });
        else await post("/notices", { notice, service: chosenService(form) });
        editingCut = null;
        toast(t("ad.saved"));
        await ctx.reload();
      } catch (e2) {
        err(errorText(e2));
      }
    });
  },
};

/* ---------------- news ---------------- */

function newsForm(n, ctx) {
  return `<form class="tm-form" id="news-form">
    <h2>${esc(t(n ? "ad.editNews" : "ad.addNews"))}</h2>
    ${serviceField(ctx, n && n.service)}
    <div class="tm-row">
      <div class="field"><label for="news-title">${esc(t("ad.headline"))}</label><input class="input" id="news-title" maxlength="200" dir="auto" value="${esc(n ? n.title : "")}"></div>
      <div class="field"><label for="news-lang">${esc(t("tm.nw.lang"))}</label><select class="input" id="news-lang">${["en", "ckb", "kmr", "ar"].map((l) => `<option value="${l}"${(n ? n.lang || "en" : "en") === l ? " selected" : ""}>${esc(t("news.in." + l))}</option>`).join("")}</select></div>
    </div>
    <fieldset class="field" id="news-heads"><legend>${esc(t("tm.nw.heads"))}</legend><p class="hint">${esc(t("tm.nw.headsHint"))}</p>${langFields("head", n && n.head, 200)}</fieldset>
    <div class="tm-row">
      <div class="field"><label for="news-outlet">${esc(t("ad.outlet"))}</label><input class="input" id="news-outlet" maxlength="80" dir="auto" value="${esc(n ? n.outlet : "")}"></div>
      <div class="field"><label for="news-date">${esc(t("ad.date"))}</label><input class="input" type="date" id="news-date" value="${esc(n ? n.date : todayErbil())}"></div>
    </div>
    <div class="field"><label for="news-url">${esc(t("ad.link"))}</label><input class="input" id="news-url" type="url" dir="ltr" placeholder="https://" value="${esc(n ? n.url : "")}"></div>
    <fieldset class="field" id="news-sums"><legend>${esc(t("ad.summary"))}</legend><p class="hint">${esc(t("ad.langHint"))}</p>${langFields("sum", n && n.sum, 300)}</fieldset>
    <p class="form__error" id="news-err" role="alert"></p>
    <div class="actions"><button class="btn" type="submit">${esc(t("ad.save"))}</button><button class="btn btn--quiet" type="button" data-cancel>${esc(t("ad.cancel"))}</button></div>
  </form>`;
}

export const news = {
  render(root, ctx) {
    const list = [...ctx.data.news, ...newsMore.filter((n) => !ctx.data.news.some((x) => x.id === n.id))];
    const newsLeft = (ctx.data.newsTotal || list.length) - list.length;
    const current = editingNews && editingNews !== "new" ? list.find((n) => n.id === editingNews) : null;
    root.innerHTML = `
      <div class="tm-head tm-head--row"><div><h1>${esc(t("ad.news"))}</h1><p class="muted">${esc(t("tm.newsLead"))}</p></div>
        ${editingNews ? "" : `<button type="button" class="btn" id="news-new">${esc(t("ad.addNews"))}</button>`}</div>
      ${editingNews ? newsForm(current, ctx) : ""}
      <section class="tm-found" id="news-found" aria-busy="true"></section>
      <h2 class="tm-sub">${esc(t("tm.nf.published"))}</h2>
      ${
        list.length
          ? `<ol class="tm-list">${list
              .map(
                (n) => `<li>
        <div><p class="small muted">${esc([day(n.date), n.outlet, ctx.user.role === "admin" ? svcName(n.service) : ""].filter(Boolean).join(", "))}</p>
          <p><strong dir="auto">${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.title)}</a>` : esc(n.title)}</strong></p>
          ${n.sum ? `<p class="muted">${esc(EU.pick(n.sum))}</p>` : ""}</div>
        <div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-edit="${esc(n.id)}">${esc(t("ad.edit"))}</button>
          <button type="button" class="btn btn--small btn--danger" data-del="${esc(n.id)}">${esc(t("ad.delete"))}</button></div>
      </li>`,
              )
              .join("")}</ol>`
          : `<p class="tm-empty">${esc(t("ad.noNews"))}</p>`
      }
      ${newsLeft > 0 ? `<p class="list-more"><button type="button" class="btn btn--small btn--quiet" data-news-more>${esc(t("tm.showMore", { n: newsLeft }))}</button></p>` : ""}`;

    const again = () => this.render(root, ctx);
    found(root.querySelector("#news-found"), ctx);
    const nm = root.querySelector("[data-news-more]");
    if (nm)
      nm.addEventListener("click", async () => {
        nm.disabled = true;
        try {
          newsMore.push(...(await get("/news" + ctx.query({ offset: list.length }))).items);
          again();
        } catch (e) {
          nm.disabled = false;
        }
      });
    const newBtn = root.querySelector("#news-new");
    if (newBtn)
      newBtn.addEventListener("click", () => {
        editingNews = "new";
        again();
        root.querySelector("#news-title").focus();
      });
    root.querySelectorAll("[data-edit]").forEach((b) =>
      b.addEventListener("click", () => {
        editingNews = b.getAttribute("data-edit");
        again();
      }),
    );
    root.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () =>
        twoTaps(b, async () => {
          try {
            await del("/news/" + encodeURIComponent(b.getAttribute("data-del")));
            toast(t("tm.deleted"));
            await ctx.reload();
          } catch (err) {
            toast(errorText(err));
          }
        }),
      ),
    );

    const form = root.querySelector("#news-form");
    if (!form) return;
    form.querySelector("[data-cancel]").addEventListener("click", () => {
      editingNews = null;
      again();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = (k) => {
        form.querySelector("#news-err").textContent = k;
      };
      const title = form.querySelector("#news-title").value.trim();
      const url = form.querySelector("#news-url").value.trim();
      if (!title) return err(t("ad.err.needTitle"));
      if (url && !/^https:\/\/\S+$/i.test(url)) return err(t("ad.err.badUrl"));
      const item = {
        title,
        url,
        outlet: form.querySelector("#news-outlet").value.trim(),
        date: form.querySelector("#news-date").value,
        lang: form.querySelector("#news-lang").value,
        head: readLangs(form.querySelector("#news-heads")),
        sum: readLangs(form.querySelector("#news-sums")),
      };
      try {
        if (current) await put("/news/" + encodeURIComponent(current.id), { item });
        else await post("/news", { item, service: chosenService(form) });
        editingNews = null;
        toast(t("ad.saved"));
        await ctx.reload();
      } catch (e2) {
        err(errorText(e2));
      }
    });
  },
};

/* ---------------- found on the news sites ----------------

   Every 30 minutes the server reads Rudaw, Kurdistan24, Shafaq, 964media,
   the Ministry of Electricity and Runaki, and keeps the stories about power
   or water here. A person decides: publish, or not for us. Admins also see
   the list of sites (with any that stopped working) and can let the
   clearest stories publish by themselves. */

function foundItem(x, ctx) {
  const meta = [x.outlet, day(x.date), ctx.user.role === "admin" && x.status === "new" ? "" : svcName(x.service)]
    .filter(Boolean)
    .join(", ");
  const acts =
    x.status !== "new"
      ? `<p class="small muted">${esc(t(x.status === "published" ? "tm.nf.wasPublished" : "tm.nf.wasDismissed"))}</p>`
      : `
    <div class="tm-row-acts tm-row-acts--start">
      ${
        ctx.user.role === "admin"
          ? `<label class="sr-only" for="nf-svc-${x.id}">${esc(t("tm.forService"))}</label>
        <select class="input input--small" id="nf-svc-${x.id}" data-svc>${["electricity", "water"].map((v) => `<option value="${v}"${v === x.service ? " selected" : ""}>${esc(t("svc." + v))}</option>`).join("")}</select>`
          : ""
      }
      <button type="button" class="btn btn--small" data-publish="${x.id}">${esc(t("tm.nf.publish"))}</button>
      <button type="button" class="btn btn--small btn--quiet" data-dismiss="${x.id}">${esc(t("tm.nf.dismiss"))}</button>
    </div>`;
  return `<li class="tm-found__item" data-id="${x.id}">
    <p class="small muted">${esc(meta)}</p>
    <p class="tm-found__title"><a href="${esc(x.url)}" target="_blank" rel="noopener" dir="auto">${esc(x.title)}</a></p>
    ${x.summary ? `<p class="tm-found__sum" dir="auto">${esc(x.summary)}</p>` : ""}
    ${x.why.length ? `<p class="small muted">${esc(t("tm.nf.because", { words: x.why.join(", ") }))}</p>` : ""}
    ${acts}
  </li>`;
}

function sourcesPanel(sources, auto) {
  const state = (x) =>
    !x.active
      ? t("tm.nf.off")
      : x.lastError
        ? t("tm.nf.broken", { why: x.lastError })
        : x.lastOkAt
          ? t("tm.nf.ok", { time: EU.ago(x.lastOkAt), n: EU.num(x.found) })
          : t("tm.nf.notYet");
  return `<details class="tm-found__sites">
    <summary>${esc(t("tm.nf.sites"))}${sources.some((x) => x.active && x.lastError) ? ` <span class="tm-found__warn">${esc(t("tm.nf.someBroken"))}</span>` : ""}</summary>
    <label class="tm-check"><input type="checkbox" id="nf-auto"${auto ? " checked" : ""}><span>${esc(t("tm.nf.auto"))}</span></label>
    <p class="hint">${esc(t("tm.nf.autoHint"))}</p>
    <table class="tm-table"><thead><tr><th>${esc(t("tm.nf.site"))}</th><th>${esc(t("tm.nf.state"))}</th><th><span class="sr-only">${esc(t("tm.nf.actions"))}</span></th></tr></thead><tbody>
      ${sources
        .map(
          (x) => `<tr${x.active ? "" : ' class="is-off"'}>
        <td><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a>${x.trusted ? `<br><span class="small muted">${esc(t("tm.nf.official"))}</span>` : ""}</td>
        <td class="small">${esc(state(x))}</td>
        <td><div class="tm-row-acts"><button type="button" class="btn btn--small btn--quiet" data-toggle="${x.id}" data-on="${x.active ? 0 : 1}">${esc(t(x.active ? "tm.nf.pause" : "tm.nf.resume"))}</button>
          <button type="button" class="btn btn--small btn--quiet btn--danger" data-remove="${x.id}">${esc(t("tm.nf.remove"))}</button></div></td>
      </tr>`,
        )
        .join("")}
    </tbody></table>
    <form class="tm-form tm-form--inline" id="nf-add">
      <h3>${esc(t("tm.nf.add"))}</h3>
      <div class="tm-row">
        <div class="field"><label for="nf-name">${esc(t("tm.nf.name"))}</label><input class="input" id="nf-name" maxlength="60" dir="auto"></div>
        <div class="field"><label for="nf-kind">${esc(t("tm.nf.kind"))}</label><select class="input" id="nf-kind"><option value="page">${esc(t("tm.nf.kindPage"))}</option><option value="feed">${esc(t("tm.nf.kindFeed"))}</option></select></div>
      </div>
      <div class="field"><label for="nf-url">${esc(t("tm.nf.url"))}</label><input class="input" id="nf-url" type="url" dir="ltr" placeholder="https://"></div>
      <div class="field" id="nf-pattern-field"><label for="nf-pattern">${esc(t("tm.nf.pattern"))}</label><input class="input" id="nf-pattern" dir="ltr" placeholder="^https://www\\.example\\.com/news/\\d+">
        <p class="hint">${esc(t("tm.nf.patternHint"))}</p></div>
      <label class="tm-check"><input type="checkbox" id="nf-trusted"><span>${esc(t("tm.nf.trusted"))}</span></label>
      <p class="form__error" id="nf-err" role="alert"></p>
      <div class="actions"><button class="btn btn--small" type="submit">${esc(t("tm.nf.addBtn"))}</button></div>
    </form>
  </details>`;
}

async function found(box, ctx) {
  if (!box) return;
  const admin = ctx.user.role === "admin";
  let list,
    sources = null,
    auto = false;
  try {
    const r = await get("/news/suggestions" + ctx.query({ status: showFound }));
    if (foundMoreFor !== showFound) {
      foundMore = [];
      foundMoreFor = showFound;
    }
    list = [...r.suggestions, ...foundMore.filter((x) => !r.suggestions.some((y) => y.id === x.id))];
    auto = r.auto;
    foundLeft = r.total - list.length;
    if (admin) sources = (await get("/news/sources")).sources;
  } catch (err) {
    box.innerHTML = `<p class="tm-empty">${esc(errorText(err))}</p>`;
    return;
  }
  if (!box.isConnected) return;
  const canCheck = ctx.user.role !== "staff";
  box.removeAttribute("aria-busy");
  box.innerHTML = `
    <div class="tm-head tm-head--row"><div><h2>${esc(t("tm.nf.title"))}</h2><p class="muted">${esc(t("tm.nf.lead"))}</p></div>
      ${canCheck ? `<button type="button" class="btn btn--small btn--quiet" id="nf-check">${esc(t("tm.nf.check"))}</button>` : ""}</div>
    <div class="filter" role="group">${["new", "published", "dismissed"].map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === showFound}">${esc(t("tm.nf.f." + k))}</button>`).join("")}</div>
    ${list.length ? `<ol class="tm-found__list">${list.map((x) => foundItem(x, ctx)).join("")}</ol>` : `<p class="tm-empty">${esc(t(showFound === "new" ? "tm.nf.none" : "tm.nf.noneHere"))}</p>`}
    ${foundLeft > 0 ? `<p class="list-more"><button type="button" class="btn btn--small btn--quiet" data-found-more>${esc(t("tm.showMore", { n: foundLeft }))}</button></p>` : ""}
    ${sources ? sourcesPanel(sources, auto) : ""}`;

  const again = () => found(box, ctx);
  const fm = box.querySelector("[data-found-more]");
  if (fm)
    fm.addEventListener("click", async () => {
      fm.disabled = true;
      try {
        foundMore.push(
          ...(await get("/news/suggestions" + ctx.query({ status: showFound, offset: list.length }))).suggestions,
        );
        again();
      } catch (e) {
        fm.disabled = false;
      }
    });
  box.querySelector(".filter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (b) {
      showFound = b.getAttribute("data-f");
      again();
    }
  });
  const check = box.querySelector("#nf-check");
  if (check)
    check.addEventListener("click", async () => {
      check.disabled = true;
      check.textContent = t("tm.nf.checking");
      try {
        const { result } = await post("/news/check", {});
        toast(result.found ? t("tm.nf.foundSome", { n: EU.num(result.found) }) : t("tm.nf.foundNone"));
        await ctx.reload();
      } catch (err) {
        toast(errorText(err));
        check.disabled = false;
        check.textContent = t("tm.nf.check");
      }
    });
  const decide = async (id, body) => {
    try {
      await post("/news/suggestions/" + id, body);
      return true;
    } catch (err) {
      toast(errorText(err));
      return false;
    }
  };
  box.querySelectorAll("[data-publish]").forEach((b) =>
    b.addEventListener("click", async () => {
      const row = b.closest("[data-id]");
      const svc = row.querySelector("[data-svc]");
      b.disabled = true;
      if (await decide(b.getAttribute("data-publish"), { action: "publish", service: svc ? svc.value : undefined })) {
        toast(t("tm.nf.published"));
        await ctx.reload();
      } else b.disabled = false;
    }),
  );
  box.querySelectorAll("[data-dismiss]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (await decide(b.getAttribute("data-dismiss"), { action: "dismiss" })) again();
    }),
  );

  if (!sources) return;
  box.querySelector("#nf-auto").addEventListener("change", async (e) => {
    try {
      await post("/news/auto", { on: e.target.checked });
      toast(t(e.target.checked ? "tm.nf.autoOn" : "tm.nf.autoOff"));
    } catch (err) {
      e.target.checked = !e.target.checked;
      toast(errorText(err));
    }
  });
  box.querySelectorAll("[data-toggle]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await patch("/news/sources/" + b.getAttribute("data-toggle"), { active: b.getAttribute("data-on") === "1" });
        again();
      } catch (err) {
        toast(errorText(err));
      }
    }),
  );
  box.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () =>
      twoTaps(b, async () => {
        try {
          await del("/news/sources/" + b.getAttribute("data-remove"));
          again();
        } catch (err) {
          toast(errorText(err));
        }
      }),
    ),
  );
  const form = box.querySelector("#nf-add");
  const kind = form.querySelector("#nf-kind");
  kind.addEventListener("change", () => {
    form.querySelector("#nf-pattern-field").hidden = kind.value === "feed";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const source = {
      name: form.querySelector("#nf-name").value.trim(),
      url: form.querySelector("#nf-url").value.trim(),
      kind: kind.value,
      pattern: form.querySelector("#nf-pattern").value.trim(),
      trusted: form.querySelector("#nf-trusted").checked,
    };
    try {
      await post("/news/sources", { source });
      toast(t("ad.saved"));
      again();
    } catch (err) {
      form.querySelector("#nf-err").textContent = errorText(err);
    }
  });
}
