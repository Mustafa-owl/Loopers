/* © 2026 NorthPoint Tech. All rights reserved. */
/* Home page: the story over the 3D street, then the neighbourhood picker,
   the city board, latest reports, Runaki and the assistant. */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);

  let chosen = EU.param("a") && EU.area(EU.param("a")) ? EU.param("a") : EU.myArea();

  function choose(slug) {
    chosen = slug || null;
    EU.setMyArea(chosen);
    renderReadout();
    renderBoard();
    renderHeroMine();
  }

  /* ---- the readout under the picker ---- */

  function serviceBlock(service, s) {
    let body = "";
    if (s.state === "back") {
      body = `<p class="svc__detail">${EU.esc(EU.t("time.last", { time: EU.ago(s.items[0].last) }))}</p>`;
    } else if (s.open.length) {
      body = `<ul class="svc__list">${s.open
        .map(
          (r) => `
        <li>
          <div>
            <span class="svc__problem">${EU.esc(EU.t("p." + r.problem))}</span>
            <span class="svc__meta">${EU.esc(r.confirmed ? EU.t("people", { n: r.people }) : EU.t(r.sentByMe ? "unconfirmed.mine" : "unconfirmed.detail"))}${r.confirmed ? (EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ") : " "}${EU.esc(EU.ago(r.last))}</span>
          </div>
          <span class="svc__actions">${EU.voteButtons(r)}</span>
        </li>`,
        )
        .join("")}</ul>`;
    }
    return `<div class="svc svc--${s.state}">
      <div>
        <div class="svc__name">${EU.esc(EU.t("svc." + service))}</div>
        <div class="svc__state">${EU.esc(EU.stateText(service, s.state))}</div>
      </div>
      ${body}
    </div>`;
  }

  function renderReadout() {
    const box = $("readout");
    if (!chosen) {
      box.innerHTML = "";
      return;
    }
    const st = EU.Store.areaStatus(chosen);
    const name = EU.areaName(chosen);
    const ns = EU.Store.notices(chosen);
    box.innerHTML = `<article class="card">
      <div class="card__head">
        <h3>${EU.esc(name)}</h3>
        <a class="more" href="/area.html?a=${encodeURIComponent(chosen)}">${EU.esc(EU.t("home.details"))}</a>
      </div>
      ${ns.length ? `<ul class="notices notices--inline">${ns.map((n) => EU.noticeItem(n, { showAreas: false })).join("")}</ul>` : ""}
      ${serviceBlock("electricity", st.electricity)}
      ${serviceBlock("water", st.water)}
      <div class="card__foot">
        <a href="/report.html?a=${encodeURIComponent(chosen)}" class="btn">${EU.esc(EU.t("home.reportHere"))}</a>
        <span class="alerts"><button type="button" class="btn btn--quiet" data-alerts="${EU.esc(chosen)}" hidden></button><span class="small muted" data-alerts-note></span></span>
      </div>
    </article>`;
    if (EU.Alerts) EU.Alerts.refresh();
  }

  /* ---- the neighbourhood search (a combobox, like a booking site's) ---- */

  let options = [],
    active = -1;

  function otherName(a) {
    // show the name in a second script so people can recognise it either way
    const second = EU.lang === "en" || EU.lang === "kmr" ? "ckb" : "en";
    return EU.pick(a.name, second);
  }

  function matches(q) {
    const n = EU.normalize(q);
    const list = EU.sortedAreas();
    if (!n) return list;
    const scored = [];
    for (const a of list) {
      const names = Object.values(a.name)
        .concat(a.alt || [])
        .map(EU.normalize);
      let best = -1;
      for (const x of names) {
        if (x.startsWith(n)) best = Math.max(best, 2);
        else if (x.includes(n)) best = Math.max(best, 1);
      }
      if (best >= 0) scored.push([best, a]);
    }
    return scored.sort((x, y) => y[0] - x[0]).map((x) => x[1]);
  }

  function statusWord(a) {
    const st = EU.Store.areaStatus(a.slug);
    if (st.electricity.state === "out") return EU.t("state.out.electricity");
    if (st.water.state === "out") return EU.t("state.out.water");
    if (st.electricity.state === "trouble" || st.water.state === "trouble") return EU.t("state.trouble");
    return otherName(a);
  }

  function openList(q) {
    const list = $("area-list"),
      input = $("area-q");
    options = matches(q);
    active = options.length ? 0 : -1;
    list.innerHTML = options.length
      ? options
          .map(
            (a, i) => `<li role="option" id="opt-${a.slug}" data-slug="${a.slug}" aria-selected="${i === active}">
          <span class="pinbox">${EU.ICON.pin}</span>
          <span><span class="opt-name">${EU.esc(EU.areaName(a))}</span><span class="opt-sub">${EU.esc(statusWord(a))}</span></span>
        </li>`,
          )
          .join("")
      : `<li class="opt-none">${EU.esc(EU.t("home.noMatch"))}</li>`;
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    if (active >= 0) input.setAttribute("aria-activedescendant", "opt-" + options[active].slug);
  }

  function closeList() {
    $("area-list").hidden = true;
    $("area-q").setAttribute("aria-expanded", "false");
    $("area-q").removeAttribute("aria-activedescendant");
  }

  function move(d) {
    if ($("area-list").hidden) {
      openList($("area-q").value);
      return;
    }
    if (!options.length) return;
    active = (active + d + options.length) % options.length;
    $("area-list")
      .querySelectorAll("[role=option]")
      .forEach((li, i) => li.setAttribute("aria-selected", String(i === active)));
    const li = $("opt-" + options[active].slug);
    li.scrollIntoView({ block: "nearest" });
    $("area-q").setAttribute("aria-activedescendant", li.id);
  }

  function pickOption(slug) {
    closeList();
    $("area-q").value = EU.areaName(slug);
    choose(slug);
  }

  function initFinder() {
    const input = $("area-q"),
      list = $("area-list");
    input.addEventListener("focus", () => openList(input.value === EU.areaName(chosen || "") ? "" : input.value));
    input.addEventListener("input", () => openList(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (active >= 0 && options[active]) pickOption(options[active].slug);
      } else if (e.key === "Escape") {
        closeList();
      }
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const li = e.target.closest("[data-slug]");
      if (li) pickOption(li.getAttribute("data-slug"));
    });
    $("area-go").addEventListener("click", () => {
      if (!list.hidden && active >= 0 && options[active]) pickOption(options[active].slug);
      else {
        input.focus();
        openList(input.value);
      }
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#finder")) closeList();
    });
  }

  /* ---- "right now" line under the question ---- */

  function renderNow() {
    const list = EU.Store.all();
    const power = [],
      water = [];
    for (const a of EU.AREAS) {
      const st = EU.Store.areaStatus(a.slug, list);
      if (st.electricity.state === "out") power.push(a.slug);
      if (st.water.state === "out") water.push(a.slug);
    }
    // "Ankawa, Iskan and Shorsh", each name a link to its page
    const AND = { en: " and ", ckb: " و ", kmr: " û ", ar: " و" }[EU.lang] || " and ";
    const COMMA = EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ";
    const names = (slugs) => {
      const links = slugs.map((s) => `<a href="/area.html?a=${encodeURIComponent(s)}">${EU.esc(EU.areaName(s))}</a>`);
      return links.length < 2 ? links.join("") : links.slice(0, -1).join(COMMA) + AND + links[links.length - 1];
    };
    const line = (key, countKey, slugs, extra) =>
      slugs.length <= 3
        ? EU.esc(EU.t(key, Object.assign({ areas: "\u0000" }, extra))).replace("\u0000", names(slugs))
        : `<a href="/map.html">${EU.esc(EU.t(countKey, { n: slugs.length }))}</a>.`;
    // short facts side by side; the outages first
    const parts = [];
    if (power.length) parts.push(["out", line("now.powerIn", "now.power", power)]);
    if (water.length) parts.push(["out", line("now.waterIn", "now.water", water)]);
    EU.Store.notices()
      .filter((n) => n.now)
      .slice(0, 2)
      .forEach((n) => {
        const slugs = n.areas.includes("all") ? [] : n.areas;
        parts.push([
          "planned",
          slugs.length && slugs.length <= 3
            ? line("now.plannedIn", "now.planned", slugs, { time: EU.clock(n.to) })
            : `<a href="#notices-sec">${EU.esc(EU.t("now.planned", { n: 1 }))}</a>.`,
        ]);
      });
    if (!parts.length) parts.push(["calm", EU.esc(EU.t("now.none")) + "."]);
    $("now").innerHTML = parts
      .map(([kind, html]) => `<span class="now__item now__item--${kind}">${html}</span>`)
      .join("");
  }

  /* ---- the city board ---- */

  const RANK = { out: 4, trouble: 3, planned: 2.5, unconfirmed: 2, back: 1, none: 0 };

  function renderBoard() {
    const list = EU.Store.all();
    // The board is Erbil's; another city shows up here only when it's the one you chose
    const rows = EU.sortedAreas()
      .filter((a) => a.city === "erbil" || a.slug === chosen)
      .map((a) => {
        const st = EU.Store.areaStatus(a.slug, list);
        let worst = RANK[st.electricity.state] >= RANK[st.water.state] ? st.electricity.state : st.water.state;
        const planned = EU.Store.notices(a.slug).filter((n) => n.now);
        if (planned.length && RANK[worst] < RANK.trouble) worst = "planned";
        return { a, st, worst, planned };
      });
    // Your neighbourhood first, then places with problems, then A–Z.
    rows.sort((x, y) => (y.a.slug === chosen) - (x.a.slug === chosen) || RANK[y.worst] - RANK[x.worst]);

    const mineLabel = EU.esc(EU.t("hero.mine"));
    $("board").innerHTML = rows
      .map(
        ({ a, st, worst, planned }) => `
      <li class="board__item is-${worst}${a.slug === chosen ? " is-mine" : ""}">
        <a href="/area.html?a=${encodeURIComponent(a.slug)}">
          <span class="board__name"${a.slug === chosen ? ` data-mine="${mineLabel}"` : ""}>${EU.esc(EU.areaName(a))}</span>
          <span class="board__tags">${planned.map((n) => `<span class="tag tag--planned">${EU.esc(EU.t("tag.planned"))}: ${EU.esc(EU.t("svc." + n.service))}</span>`).join("")}${
            worst === "none"
              ? `<span class="board__quiet">${EU.esc(EU.t("state.none"))}</span>`
              : ["electricity", "water"]
                  .filter((k) => st[k].state !== "none")
                  .map((k) => EU.tag(k, st[k].state, true, { named: true }))
                  .join("")
          }</span>
        </a>
      </li>`,
      )
      .join("");

    // the words on each row say what's wrong; no colour key needed
  }

  /* ---- planned cuts announced by the team ---- */

  // The slideshow keeps itself up to date (core/slides.js); this only hides
  // the whole band when there's nothing to show.
  function renderNotices() {
    $("notices-sec").hidden = !EU.Store.upcoming().length && !EU.NEWS.length;
  }

  /* ---- latest reports ---- */

  function renderLatest() {
    const list = EU.Store.all()
      .filter((r) => !r.resolved)
      .slice(0, 6);
    $("latest").innerHTML = list.length
      ? list.map((r) => EU.reportRow(r, { showArea: true, compact: true })).join("")
      : `<li class="empty">${EU.esc(EU.t("state.none"))}</li>`;
  }

  /* ---- Runaki summary ---- */

  function renderRunaki() {
    const groups = ["covered", "switching", "notyet", "unknown"];
    // Erbil's neighbourhoods; the other cities are on the Runaki page
    const erbil = EU.AREAS.filter((a) => a.city === "erbil");
    const total = erbil.length;
    $("runaki-bar").innerHTML = groups
      .map((g) => {
        const n = erbil.filter((a) => a.runaki === g).length;
        return `<span class="c-${g}" style="flex:${n}" title="${EU.esc(EU.t("runaki." + g))}: ${n}/${total}"></span>`;
      })
      .join("");
    const comma = EU.lang === "ar" || EU.lang === "ckb" ? "، " : ", ";
    $("runaki-strip").innerHTML = groups
      .filter((g) => g !== "unknown")
      .map((g) => {
        const areas = EU.sortedAreas().filter((a) => a.runaki === g && a.city === "erbil");
        return `<li>
        <strong><i class="key c-${g}"></i>${EU.esc(EU.t("runaki." + g))}: ${EU.num(areas.length)}</strong>
        <span class="names">${areas.map((a) => EU.esc(EU.areaName(a))).join(comma)}</span>
      </li>`;
      })
      .join("");
  }

  /* ---- location ---- */

  function locate() {
    const msg = $("locate-msg");
    if (!navigator.geolocation) {
      msg.textContent = EU.t("home.locateFail");
      return;
    }
    msg.textContent = EU.t("home.locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const a = EU.nearestArea(pos.coords.latitude, pos.coords.longitude);
        if (a) {
          msg.textContent = "";
          $("area-q").value = EU.areaName(a);
          choose(a.slug);
        } else msg.textContent = EU.t("home.locateFail");
      },
      () => {
        msg.textContent = EU.t("home.locateFail");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  /* ---- the story: the scroll plays the street like a film ----
     Every chapter has a stage (0 to 3). As you scroll, the point in the
     middle of the screen is somewhere between two chapters, so the
     progress is a number in between (1.4 = most of the way from Runaki
     to the cut). The 3D scene follows it continuously. Without the 3D,
     the four still images cross-fade with a slow push-in instead.       */

  let scene = null;
  let progress = 0; // where the scroll is
  let shown = 0; // where the still images are, easing towards it
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function measure() {
    const mid = window.innerHeight / 2;
    const points = [...document.querySelectorAll(".panel[data-stage]")].map((el) => {
      const r = el.getBoundingClientRect();
      return { y: r.top + r.height / 2, stage: Number(el.getAttribute("data-stage")) };
    });
    if (!points.length) return 0;
    if (mid <= points[0].y) return points[0].stage;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i];
      if (mid <= b.y) return a.stage + (b.stage - a.stage) * ((mid - a.y) / Math.max(1, b.y - a.y));
    }
    return points[points.length - 1].stage;
  }

  /* Without the 3D: a film. 25 frames rendered from the same scene along the
     same path (scripts/render-frames.js), drawn on a canvas. Between two
     frames we blend them, so the camera glides instead of stepping. The
     frames nearest to where the reader is load first. */
  const FRAMES = 25;
  let film = null;
  const pad = (n) => String(n).padStart(2, "0");
  const at = () => (shown / 3) * (FRAMES - 1);

  function startFilm() {
    if (film || scene) return;
    const conn = navigator.connection || {};
    if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) {
      stillsOnly();
      return;
    }
    const kind = window.matchMedia("(max-aspect-ratio: 4/5)").matches ? "tall" : "wide";
    const canvas = document.createElement("canvas");
    canvas.className = "stage__film";
    $("stage").appendChild(canvas);
    film = { canvas, ctx: canvas.getContext("2d"), imgs: [], kind, last: "" };
    sizeFilm();
    const here = Math.round(at());
    const order = [...Array(FRAMES).keys()].sort((x, y) => Math.abs(x - here) - Math.abs(y - here));
    let next = 0,
      busy = 0;
    const pump = () => {
      while (busy < 3 && next < order.length) {
        const i = order[next++];
        const img = new Image();
        img.src = `/assets/img/frames/${kind}-${pad(i)}.webp`;
        busy++;
        img
          .decode()
          .then(() => {
            film.imgs[i] = img;
            drawFilm(true);
          })
          .catch(() => {})
          .finally(() => {
            busy--;
            pump();
          });
      }
    };
    pump();
  }

  function sizeFilm() {
    if (!film) return;
    const box = $("stage");
    const r = Math.min(window.devicePixelRatio || 1, 1.5);
    film.canvas.width = Math.round(box.clientWidth * r);
    film.canvas.height = Math.round(box.clientHeight * r);
    film.last = "";
    drawFilm(true);
  }

  // Draw an image to fill the canvas, cropping the edges like object-fit: cover
  function cover(img, alpha) {
    const { ctx, canvas } = film;
    const k = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * k,
      h = img.naturalHeight * k;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  function nearest(i) {
    for (let d = 0; d < FRAMES; d++) {
      if (film.imgs[i - d]) return i - d;
      if (film.imgs[i + d]) return i + d;
    }
    return -1;
  }

  function drawFilm(force) {
    if (!film) return;
    const t = at();
    const lo = Math.floor(t),
      hi = Math.min(FRAMES - 1, lo + 1),
      f = t - lo;
    const a = film.imgs[lo] ? lo : nearest(lo);
    if (a < 0) return;
    const b = film.imgs[hi] && a === lo ? hi : -1;
    const key = a + ":" + b + ":" + (b < 0 ? 0 : f.toFixed(3));
    if (key === film.last && !force) return;
    film.last = key;
    cover(film.imgs[a], 1);
    if (b >= 0 && f > 0.001) cover(film.imgs[b], f);
    film.ctx.globalAlpha = 1;
    film.canvas.classList.add("is-on");
  }

  // Data saver: the four pictures, each fading in once as its chapter arrives
  let layers = null;
  function stillsOnly() {
    const pic = $("poster");
    if (!pic || layers) return;
    layers = [pic];
    for (let n = 1; n <= 3; n++) {
      const layer = pic.cloneNode(true);
      layer.removeAttribute("id");
      layer.classList.add("stage__layer");
      layer.querySelector("source").srcset = `/assets/img/scene-${n}-tall.webp`;
      const img = layer.querySelector("img");
      img.removeAttribute("fetchpriority");
      img.loading = "lazy";
      img.src = `/assets/img/scene-${n}-wide.webp`;
      layer.style.opacity = "0";
      pic.parentNode.appendChild(layer);
      layers.push(layer);
    }
  }

  let easing = false;
  function paint() {
    easing = false;
    if (scene) return;
    shown += (progress - shown) * (reduceMotion ? 1 : 0.16);
    if (Math.abs(progress - shown) < 0.002) shown = progress;
    if (film) drawFilm(false);
    if (layers)
      layers.forEach((layer, n) => {
        if (n) layer.style.opacity = Math.round(shown) >= n ? "1" : "0";
      });
    if (shown !== progress) {
      easing = true;
      requestAnimationFrame(paint);
    }
  }

  let queued = false;
  function onScroll() {
    queued = false;
    progress = measure();
    if (scene) scene.setProgress ? scene.setProgress(progress) : scene.setStage(Math.round(progress));
    else if (!easing) {
      easing = true;
      requestAnimationFrame(paint);
    }
  }

  function watchChapters() {
    const go = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(onScroll);
      }
    };
    window.addEventListener("scroll", go, { passive: true });
    window.addEventListener("resize", () => {
      sizeFilm();
      go();
    });
    progress = shown = measure();
    // the film loads once the page is idle, unless the live 3D street takes over first
    const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
    later(() =>
      setTimeout(() => {
        if (!scene) startFilm();
      }, 600),
    );
  }

  // Load the live 3D scene only when it will run well: WebGL available,
  // the visitor isn't saving data, and the page has finished loading.
  function loadScene() {
    const conn = navigator.connection || {};
    if (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")) return;
    try {
      const c = document.createElement("canvas");
      if (!(c.getContext("webgl2") || c.getContext("webgl"))) return;
    } catch (e) {
      return;
    }
    const s = document.createElement("script");
    s.src = "/assets/js/scene.bundle.js?v=" + EU.version;
    s.async = true;
    s.onload = () => {
      try {
        const box = $("stage");
        // The real car models are about 7 MB, so only big screens on a fast
        // connection get them. Everyone else sees the simple cars (and the
        // still images already show the real ones).
        const fast = !/(^|-)3g$/.test(conn.effectiveType || "");
        scene = window.ErbilScene.mount(box, {
          stage: progress,
          models: window.innerWidth >= 900 && fast ? "/assets/models/" : false,
          onReady: () => {
            box.classList.add("is-live");
            if (film) {
              film.canvas.remove();
              film = null;
            } // the live street takes over
            if (layers) layers.slice(1).forEach((l) => l.remove());
            layers = null;
          },
        });
      } catch (e) {
        scene = null;
      }
    };
    document.body.appendChild(s);
  }

  // The live map on the home page: Leaflet and the map script load only
  // when the map is about to scroll into view.
  function lazyMap() {
    const sec = $("map-sec");
    if (!sec || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "/assets/vendor/leaflet/leaflet.css";
        document.head.appendChild(css);
        const add = (src, next) => {
          const sc = document.createElement("script");
          sc.src = src;
          sc.onload = next;
          document.body.appendChild(sc);
        };
        add("/assets/vendor/leaflet/leaflet.js", () => add("/assets/js/pages/map.js?v=" + EU.version));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(sec);
  }

  function renderHeroMine() {
    const el = $("hero-mine");
    if (!el) return;
    if (!chosen) {
      el.hidden = true;
      return;
    }
    const st = EU.Store.areaStatus(chosen);
    el.hidden = false;
    el.innerHTML = `<span>${EU.esc(EU.areaName(chosen))}</span>${EU.tag("electricity", st.electricity.state, true)}${EU.tag("water", st.water.state, true)}`;
  }

  function renderSteps() {
    document.querySelectorAll(".chapter__step").forEach((el) => {
      el.textContent = EU.t("story.step", { n: Number(el.getAttribute("data-step")), total: 4 });
    });
  }

  // The header is dark over the story and turns light after it.
  function watchHeader() {
    const story = $("story");
    let ticking = false;
    const update = () => {
      ticking = false;
      document.body.classList.toggle("is-past-story", story.getBoundingClientRect().bottom <= 90);
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true },
    );
    update();
  }

  function renderAll() {
    if (chosen && document.activeElement !== $("area-q")) $("area-q").value = EU.areaName(chosen);
    renderNow();
    renderReadout();
    renderBoard();
    renderNotices();
    renderLatest();
    renderRunaki();
    renderHeroMine();
    renderSteps();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initFinder();
    watchHeader();
    lazyMap();
    $("locate").addEventListener("click", locate);
    $("ask-inline").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = $("ask-q").value.trim();
      if (q && EU.Assistant) {
        EU.Assistant.open(q);
        $("ask-q").value = "";
      }
    });
    document.querySelectorAll("[data-ask-q]").forEach((b) => {
      b.addEventListener("click", () => EU.Assistant && EU.Assistant.open(b.textContent));
    });
    EU.Slides.mount($("slides"));
    renderAll();
    watchChapters();
    EU.onLang(renderAll);
    EU.Store.onChange(() => {
      renderNow();
      renderReadout();
      renderNotices();
      renderBoard();
      renderLatest();
      renderHeroMine();
    });
    if (document.readyState === "complete") loadScene();
    else window.addEventListener("load", loadScene, { once: true });
  });
})();
