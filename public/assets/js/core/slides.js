/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: announcements from the teams
  ---------------------------------------------
  The "From the teams" feature on the home page: one large card for the
  announcement being shown, and beside it the list of all of them. The
  item playing has a line that fills up until the next one.

    planned cuts  come first (running now, then the next ones). The card
                  shows a 24-hour timeline of Erbil time with the cut marked
                  on it and a "now" line, so people see at a glance how
                  long it lasts.
    news          the teams' own news, then the stories built into data.js,
                  over a still of the 3D street.

  • Moves on every 9 seconds. Stops for good once someone picks an item,
    swipes or uses the arrows, and holds still while the pointer or the
    keyboard focus is on it. Never moves for people who ask their phone
    for less motion.
  • Swipe on phones; arrow keys when it has focus. In Sorani and Arabic the
    direction follows the page.
  • Rebuilt when the Store changes, so a cut a team adds appears a second
    later. The item being read stays put.

  Usage: EU.Slides.mount(document.getElementById("slides"))
         EU.Slides.mount(el, { only: "news" })     just the news (News page)
*/
(function () {
  "use strict";
  // "Rudaw, 3 May 2026": commas, with the Arabic-script comma in Sorani and Arabic
  const list = (parts) => parts.filter(Boolean).join(EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ");
  const EU = window.EU;
  const DELAY = 9000;
  const MAX = 8;
  const HOUR = 36e5;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  let H = 3; // heading level of a slide's title: 3 under the home page's section heading, 2 on the News page
  const STILLS = ["scene-1", "scene-0", "scene-3", "scene-2"]; // public/assets/img/scene-N-wide.webp

  function items(only) {
    const cuts =
      only === "news"
        ? []
        : EU.Store.upcoming()
            .slice(0, 5)
            .map((n) => ({ kind: "cut", id: "n:" + n.id, n }));
    const news = EU.NEWS.slice(0, MAX - cuts.length).map((w, i) => ({
      kind: "news",
      id: "w:" + (w.id || w.url || i),
      w,
    }));
    return cuts.concat(news);
  }

  function dateText(day) {
    const [y, m, d] = day.split("-");
    return EU.num(Number(d)) + " " + EU.monthName(y + "-" + m);
  }

  // Hours as "4 h" or "1 h 30 min"
  function length(ms) {
    const mins = Math.round(ms / 6e4);
    const h = Math.floor(mins / 60),
      m = mins % 60;
    return [h ? EU.t("slides.hours", { n: h }) : "", m ? EU.t("slides.minutes", { n: m }) : ""]
      .filter(Boolean)
      .join(" ");
  }

  /* A day in Erbil time, 00:00 to 24:00, with the cut drawn on it. Cuts
     that run past midnight continue to the edge; longer ones say so. */
  function timeline(n) {
    const dayStart = Date.parse(EU.erbilDay(n.from) + "T00:00:00+03:00");
    const pos = (t) => Math.max(0, Math.min(100, ((t - dayStart) / (24 * HOUR)) * 100));
    const from = pos(n.from),
      to = pos(n.to);
    const now = Date.now();
    const nowPos = now >= dayStart && now <= dayStart + 24 * HOUR ? pos(now) : null;
    const ticks = [0, 6, 12, 18, 24]
      .map(
        (h) =>
          `<span style="inset-inline-start:${(h / 24) * 100}%">${EU.isRtl() ? EU.num(h) : String(h).padStart(2, "0")}</span>`,
      )
      .join("");
    return `<div class="tl" aria-hidden="true">
      <div class="tl__track"><i class="tl__cut" style="inset-inline-start:${from}%;width:${Math.max(1.5, to - from)}%"></i>
        ${nowPos != null ? `<i class="tl__now" style="inset-inline-start:${nowPos}%"></i>` : ""}</div>
      <div class="tl__ticks">${ticks}</div>
    </div>`;
  }

  function cutCard(n) {
    const source = (typeof n.source === "object" ? EU.pick(n.source) : n.source) || EU.t("slides.team." + n.service);
    const first = n.areas.includes("all") ? null : n.areas[0];
    const endsToday = EU.erbilDay(n.to) === EU.erbilDay(Date.now());
    const left = n.now
      ? EU.t("slides.endsIn", { time: length(n.to - Date.now()) })
      : EU.t("slides.lasts", { time: length(n.to - n.from) });
    return `<div class="feat__body">
      <p class="feat__kicker"><span>${EU.esc(EU.t("notice.kind." + n.service))}</span>${n.now ? `<span class="feat__now">${EU.esc(EU.t("notice.live"))}</span>` : ""}</p>
      <h${H} class="feat__title">${EU.esc(EU.noticeAreas(n))}</h${H}>
      <p class="feat__when"><strong>${EU.esc(n.now ? EU.t("notice.nowUntil", { time: endsToday ? EU.clock(n.to) : EU.dayAndTime(n.to) }) : EU.dayAndTime(n.from) + " – " + EU.clock(n.to))}</strong><span>${EU.esc(left)}</span></p>
      ${timeline(n)}
      ${n.reason ? `<p class="feat__text">${EU.esc(EU.pick(n.reason))}</p>` : ""}
      <p class="feat__src">${EU.esc(EU.t("notice.by", { source }))}</p>
      ${first ? `<p class="feat__foot"><a href="/area.html?a=${encodeURIComponent(first)}">${EU.esc(EU.t("slides.more"))}</a></p>` : ""}
    </div>`;
  }

  function newsCard(w) {
    return `<div class="feat__body">
      <p class="feat__kicker"><span>${EU.esc(EU.t(w.service ? "slides.teamNews." + w.service : "slides.news"))}</span><span class="feat__meta" dir="auto">${EU.esc(list([w.outlet, w.date ? dateText(w.date) : "", EU.headline(w).original ? EU.t("news.in." + EU.headline(w).original) : ""]))}</span></p>
      ${(() => {
        const h = EU.headline(w);
        return `<h${H} class="feat__title feat__title--news" lang="${h.lang}" dir="auto">${EU.esc(h.text)}</h${H}>`;
      })()}
      ${w.sum ? `<p class="feat__text">${EU.esc(EU.pick(w.sum))}</p>` : ""}
      ${w.url ? `<p class="feat__foot"><a href="${EU.esc(w.url)}" target="_blank" rel="noopener">${EU.esc(EU.t("slides.read"))}</a></p>` : ""}
    </div>`;
  }

  function card(item, i, total) {
    const still = STILLS[i % STILLS.length];
    const label = EU.esc(EU.t("slides.position", { n: i + 1, total }));
    return `<div class="feat feat--${item.kind}${item.kind === "cut" && item.n.now ? " is-now" : ""}" role="group" aria-roledescription="${EU.esc(EU.t("slides.slide"))}" aria-label="${label}">
      <picture class="feat__pic" aria-hidden="true"><source media="(max-aspect-ratio: 4/5)" srcset="/assets/img/${still}-tall.webp"><img src="/assets/img/${still}-wide.webp" alt="" loading="lazy" decoding="async"></picture>
      ${item.kind === "cut" ? cutCard(item.n) : newsCard(item.w)}
    </div>`;
  }

  function listItem(item, i) {
    const kicker =
      item.kind === "cut"
        ? list([EU.t("notice.kind." + item.n.service), item.n.now ? EU.t("notice.live") : EU.dayAndTime(item.n.from)])
        : list([item.w.outlet || EU.t("slides.news"), item.w.date ? dateText(item.w.date) : ""]);
    const h = item.kind === "cut" ? { text: EU.noticeAreas(item.n), lang: EU.lang } : EU.headline(item.w);
    return `<li><button type="button" class="feats__item" data-go-to="${i}">
      <span class="feats__kicker">${EU.esc(kicker)}</span>
      <span class="feats__title" lang="${h.lang}" dir="auto">${EU.esc(h.text)}</span>
      <span class="feats__line" aria-hidden="true"><i></i></span>
    </button></li>`;
  }

  function mount(root, { only = null, level = 3 } = {}) {
    if (!root) return;
    H = level;
    let list = [];
    let index = 0;
    let timer = null;
    let stopped = calm.matches;
    let paused = false;
    let lastHtml = "";

    root.classList.add("feats");
    root.setAttribute("aria-roledescription", EU.t("slides.carousel"));
    root.innerHTML = `
      <div class="feats__stage">
        <div class="feats__viewport" tabindex="0"><div class="feats__track" aria-live="off"></div></div>
        <div class="feats__nav">
          <button type="button" class="feats__btn" data-move="-1"><span class="sr-only"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
          <span class="feats__count" aria-hidden="true"></span>
          <button type="button" class="feats__btn" data-move="1"><span class="sr-only"></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
          <button type="button" class="feats__pause"></button>
        </div>
      </div>
      <ol class="feats__list"></ol>`;
    const viewport = root.querySelector(".feats__viewport");
    const track = root.querySelector(".feats__track");
    const listEl = root.querySelector(".feats__list");
    const count = root.querySelector(".feats__count");
    const pauseBtn = root.querySelector(".feats__pause");

    function labels() {
      const [prev, next] = root.querySelectorAll(".feats__btn .sr-only");
      prev.textContent = EU.t("slides.prev");
      next.textContent = EU.t("slides.next");
      pauseBtn.textContent = EU.t(stopped ? "slides.play" : "slides.pause");
      pauseBtn.hidden = calm.matches || list.length < 2;
      viewport.setAttribute("aria-label", EU.t("slides.title"));
    }

    function show(i, { user = false } = {}) {
      if (!list.length) return;
      index = (i + list.length) % list.length;
      track.style.transform = `translateX(${(EU.isRtl() ? 1 : -1) * index * 100}%)`;
      track.querySelectorAll(".feat").forEach((s, n) => {
        s.setAttribute("aria-hidden", String(n !== index));
        s.querySelectorAll("a").forEach((a) => {
          a.tabIndex = n === index ? 0 : -1;
        });
      });
      listEl.querySelectorAll(".feats__item").forEach((b, n) => b.setAttribute("aria-current", String(n === index)));
      keepInView(listEl.querySelector(`[data-go-to="${index}"]`));
      count.textContent = EU.num(index + 1) + " / " + EU.num(list.length);
      if (user) {
        stopped = true;
        track.setAttribute("aria-live", "polite");
      }
      restart();
      labels();
    }

    /* The playing story stays visible in the list beside it. Only the list
       moves, never the page: the reader keeps their place while the
       slides change by themselves. On phones the list isn't a scroller,
       so nothing moves at all. */
    function keepInView(item) {
      if (!item || listEl.scrollHeight <= listEl.clientHeight + 1) return;
      const li = item.parentElement;
      const top = li.offsetTop,
        bottom = top + li.offsetHeight; // the list is positioned, so this is inside it
      let to = null;
      if (top < listEl.scrollTop) to = top - 6;
      else if (bottom > listEl.scrollTop + listEl.clientHeight) to = bottom - listEl.clientHeight + 6;
      if (to != null) listEl.scrollTo({ top: to, behavior: calm.matches ? "auto" : "smooth" });
    }

    // the line under the playing item fills up until the next one
    function restart() {
      clearTimeout(timer);
      listEl.querySelectorAll(".feats__line i").forEach((bar) => {
        bar.style.transition = "none";
        bar.style.width = "0";
      });
      const bar = listEl.querySelector(`[data-go-to="${index}"] .feats__line i`);
      if (stopped || paused || list.length < 2 || document.hidden) {
        if (bar) bar.style.width = "100%";
        return;
      }
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!bar) return;
          bar.style.transition = `width ${DELAY}ms linear`;
          bar.style.width = "100%";
        }),
      );
      timer = setTimeout(() => show(index + 1), DELAY);
    }

    function render() {
      const next = items(only);
      const reading = list[index] && list[index].id;
      list = next;
      root.hidden = !list.length;
      if (!list.length) return;
      const cards = list.map((item, i) => card(item, i, list.length)).join("");
      const rows = list.map(listItem).join("");
      if (cards + rows + EU.lang === lastHtml) return; // nothing new: don't disturb the reader
      lastHtml = cards + rows + EU.lang;
      track.innerHTML = cards;
      listEl.innerHTML = rows;
      root.querySelector(".feats__nav").hidden = list.length < 2;
      const keep = list.findIndex((x) => x.id === reading);
      show(keep >= 0 ? keep : 0);
    }

    root.addEventListener("click", (e) => {
      const step = e.target.closest("[data-move]");
      const pick = e.target.closest("[data-go-to]");
      if (step) show(index + Number(step.getAttribute("data-move")), { user: true });
      if (pick) show(Number(pick.getAttribute("data-go-to")), { user: true });
    });
    // up and down move through the list of stories
    listEl.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...listEl.querySelectorAll(".feats__item")];
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    });
    pauseBtn.addEventListener("click", () => {
      stopped = !stopped;
      if (!stopped) paused = false;
      restart();
      labels();
    });

    viewport.addEventListener("keydown", (e) => {
      const forward = EU.isRtl() ? "ArrowLeft" : "ArrowRight";
      const back = EU.isRtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) {
        e.preventDefault();
        show(index + 1, { user: true });
      }
      if (e.key === back) {
        e.preventDefault();
        show(index - 1, { user: true });
      }
    });

    const hold = (on) => {
      paused = on;
      restart();
      labels();
    };
    root.addEventListener("mouseenter", () => hold(true));
    root.addEventListener("mouseleave", () => hold(false));
    root.addEventListener("focusin", () => hold(true));
    root.addEventListener("focusout", (e) => {
      if (!root.contains(e.relatedTarget)) hold(false);
    });
    document.addEventListener("visibilitychange", restart);

    let startX = null,
      startY = null;
    viewport.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") {
        startX = e.clientX;
        startY = e.clientY;
      }
    });
    viewport.addEventListener("pointerup", (e) => {
      if (startX == null) return;
      const dx = e.clientX - startX,
        dy = e.clientY - startY;
      startX = null;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
      show(index + ((EU.isRtl() ? dx > 0 : dx < 0) ? 1 : -1), { user: true });
    });
    viewport.addEventListener("pointercancel", () => {
      startX = null;
    });

    EU.Store.onChange(render);
    EU.onLang(render);
    render();
    // keep "ends in 2 h" and the "now" line true without a reload
    setInterval(() => {
      if (!document.hidden) {
        lastHtml = "";
        render();
      }
    }, 60e3);
  }

  EU.Slides = { mount };
})();
