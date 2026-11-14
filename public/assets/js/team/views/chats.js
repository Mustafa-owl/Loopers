/* © 2026 NorthPoint Tech. All rights reserved.

   Live chats with residents. The assistant puts someone through when
   something is dangerous, has gone on for days, or it couldn't help.

   On the left, the chats for this service (waiting ones first). On the
   right, the conversation: what they asked the assistant, the messages,
   and a reply box. The first reply makes the chat yours. New messages
   arrive by themselves, and never wipe out a reply you're typing.        */
import { get, post } from "../api.js";
import { esc, t, toast, errorText } from "../util.js";

const EU = window.EU;
let filter = "active";
let openId = null;
let drafts = {};
let more = [],
  moreFor = null; // pages after the first 50, for this filter       // a half-written reply per chat survives redraws

// Each language in its own name, so it reads right on any page language
const LANG_NAMES = { en: "English", ckb: "کوردی (سۆرانی)", kmr: "Kurdî (Kurmancî)", ar: "عربي" };

// Ready-made first lines, written in the resident's own language
const QUICK = ["tm.cq.onIt", "tm.cq.onlyYou", "tm.cq.stayAway", "tm.cq.call"];

function when(c) {
  if (c.status === "closed") return t("tm.ch.closed");
  if (c.status === "waiting") return t("tm.ch.waiting", { time: EU.ago(c.createdAt) });
  return t("tm.ch.answeredBy", { name: c.assignedName || "" });
}

function item(c) {
  const preview = c.last ? (c.last.from === "team" ? t("tm.ch.you") + ": " : "") + c.last.body : "";
  return `<li><button type="button" class="tm-inbox__item${c.id === openId ? " is-open" : ""}${c.status === "waiting" ? " is-new" : ""}" data-open="${c.id}">
    <span class="tm-inbox__top"><strong>${esc(c.area ? EU.areaName(c.area) : t("svc." + c.service))}</strong><span>${esc(EU.ago(c.lastAt))}</span></span>
    <span class="tm-ch__preview" dir="auto">${esc(preview)}</span>
    <span class="tm-inbox__status">${esc(when(c))}${c.unread ? `${EU.isRtl() ? "، " : ", "}<b>${esc(t("tm.ch.unread", { n: EU.num(c.unread) }))}</b>` : ""}</span>
  </button></li>`;
}

function thread(c) {
  return c.messages
    .map((m) => {
      if (m.from === "note")
        return `<li class="tm-ch__note"><span>${esc(t("tm.ch.asked"))}</span><p dir="auto">${esc(m.body)}</p></li>`;
      const who = m.from === "team" ? m.name || t("tm.ch.team") : t("tm.ch.resident");
      return `<li class="tm-ch__msg tm-ch__msg--${m.from}"><span class="tm-ch__who">${esc(who)} <time>${esc(EU.clock(m.at))}</time></span><p dir="auto">${esc(m.body)}</p></li>`;
    })
    .join("");
}

function detail(c, ctx) {
  const mine = c.assignedTo === ctx.user.id;
  const lang = EU.LANGS.includes(c.lang) ? c.lang : "en";
  return `<div class="tm-ch">
    <header class="tm-req__head">
      <h2>${esc(c.area ? EU.areaName(c.area) : t("svc." + c.service))} <span class="muted">${esc(c.ref)}</span></h2>
      <p>${esc(t("svc." + c.service))}${EU.isRtl() ? "، " : ", "}${esc(t("tm.ch.reason." + c.reason))}${EU.isRtl() ? "، " : ", "}${esc(t("tm.ch.writesIn", { lang: LANG_NAMES[lang] }))}</p>
      <p class="muted">${esc(when(c))}${c.firstResponseAt ? (EU.isRtl() ? "، " : ", ") + esc(t("tm.ch.firstReply", { time: EU.ago(c.firstResponseAt) })) : ""}</p>
    </header>
    <ol class="tm-ch__thread" id="ch-thread" aria-live="polite">${thread(c)}</ol>
    ${
      c.status === "closed"
        ? `<p class="tm-empty">${esc(t("tm.ch.closedBy." + (c.closedBy || "team")))}</p>`
        : `
    <form class="tm-ch__reply" id="ch-form" data-quiet>
      <div class="tm-ch__quick">${QUICK.map((k) => `<button type="button" class="btn btn--small btn--quiet" data-quick="${k}" lang="${lang}" dir="auto">${esc(EU.tIn(lang, k))}</button>`).join("")}</div>
      <label class="sr-only" for="ch-text">${esc(t("tm.ch.reply"))}</label>
      <textarea class="input" id="ch-text" rows="3" maxlength="1000" dir="auto" placeholder="${esc(t("tm.ch.replyPh"))}">${esc(drafts[c.id] || "")}</textarea>
      <p class="hint">${esc(t("tm.ch.replyHint"))}</p>
      <div class="tm-row-acts tm-row-acts--start">
        <button class="btn btn--small" type="submit">${esc(t("tm.ch.send"))}</button>
        ${c.assignedTo && !mine ? `<button type="button" class="btn btn--small btn--quiet" data-take>${esc(t("tm.ch.take"))}</button>` : ""}
        <button type="button" class="btn btn--small btn--quiet" data-close>${esc(t("tm.ch.close"))}</button>
      </div>
    </form>`
    }
  </div>`;
}

export default {
  async render(root, ctx) {
    const page = await get("/chats" + ctx.query({ status: filter }));
    if (moreFor !== filter) {
      more = [];
      moreFor = filter;
    }
    const chats = [...page.chats, ...more.filter((c) => !page.chats.some((x) => x.id === c.id))];
    const left = page.total - chats.length;
    let current = null;
    if (openId)
      current = await get("/chats/" + openId)
        .then((x) => x.chat)
        .catch(() => null);
    if (!current) openId = null;
    if (ctx.view !== "chats") return;

    root.innerHTML = `
      <div class="tm-head"><h1>${esc(t("tm.nav.chats"))}</h1><p class="muted">${esc(t("tm.chatsLead"))}</p></div>
      <div class="filter" role="group">
        ${["active", "closed"].map((k) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${esc(t("tm.chf." + k))}</button>`).join("")}
      </div>
      <div class="tm-inbox">
        ${chats.length ? `<ul class="tm-inbox__list">${chats.map(item).join("")}${left > 0 ? `<li><button type="button" class="btn btn--small btn--quiet tm-more" data-more>${esc(t("tm.showMore", { n: left }))}</button></li>` : ""}</ul>` : `<p class="tm-empty">${esc(t(filter === "closed" ? "tm.ch.noneClosed" : "tm.ch.none"))}</p>`}
        <div class="tm-inbox__detail">${current ? detail(current, ctx) : chats.length ? `<p class="tm-empty">${esc(t("tm.ch.pick"))}</p>` : ""}</div>
      </div>`;

    const moreBtn = root.querySelector("[data-more]");
    if (moreBtn)
      moreBtn.addEventListener("click", async () => {
        moreBtn.disabled = true;
        try {
          more.push(...(await get("/chats" + ctx.query({ status: filter, offset: chats.length }))).chats);
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
        this.render(root, ctx);
      }
    });
    root.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => {
        openId = Number(b.getAttribute("data-open"));
        this.render(root, ctx).then(() => {
          const d = root.querySelector(".tm-ch");
          if (d && window.matchMedia("(max-width: 900px)").matches)
            d.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }),
    );
    const box = root.querySelector("#ch-thread");
    if (box) box.scrollTop = box.scrollHeight;

    const form = root.querySelector("#ch-form");
    if (!form) return;
    const text = form.querySelector("#ch-text");
    text.addEventListener("input", () => {
      drafts[current.id] = text.value;
    });
    // Enter sends, Shift+Enter makes a new line
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    form.querySelectorAll("[data-quick]").forEach((b) =>
      b.addEventListener("click", () => {
        text.value = (text.value ? text.value.trimEnd() + " " : "") + b.textContent;
        drafts[current.id] = text.value;
        text.focus();
      }),
    );
    const act = async (body) => {
      try {
        await post("/chats/" + current.id, body);
        return true;
      } catch (err) {
        toast(errorText(err));
        return false;
      }
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!text.value.trim()) return;
      if (await act({ action: "say", body: text.value })) {
        delete drafts[current.id];
        text.blur();
        this.render(root, ctx);
      }
    });
    const take = form.querySelector("[data-take]");
    if (take)
      take.addEventListener("click", async () => {
        if (await act({ action: "take" })) this.render(root, ctx);
      });
    form.querySelector("[data-close]").addEventListener("click", async () => {
      if (await act({ action: "close" })) {
        toast(t("tm.ch.closedToast"));
        this.render(root, ctx);
      }
    });
  },

  /* A live update about a chat: if it's the open one, add the new messages
     without touching the reply box. Returns true when it handled it. */
  async onLive(root, ctx, info) {
    if (info.topic !== "chat" || info.chat !== openId) return false;
    const typing = document.activeElement && document.activeElement.id === "ch-text";
    if (!typing) return false; // nothing to protect: a normal redraw is fine
    try {
      const c = (await get("/chats/" + openId)).chat;
      const box = root.querySelector("#ch-thread");
      if (box) {
        box.innerHTML = thread(c);
        box.scrollTop = box.scrollHeight;
      }
    } catch (err) {
      /* the next redraw will catch up */
    }
    return true;
  },
};
