/* © 2026 NorthPoint Tech. All rights reserved.

   Light or dark. Loaded at the very top of every page, before anything is
   drawn, so the page never flashes the wrong colours.

   With no choice saved, the site follows the phone or computer (light or
   dark). Pressing the moon/sun button saves a choice in this browser
   ("eu.theme"), and it holds on every page and every later visit. */
(function () {
  var KEY = "eu.theme";
  var root = document.documentElement;
  var system = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var saved = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch (e) {
    /* private mode: follow the system */
  }
  if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);

  function current() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return system && system.matches ? "dark" : "light";
  }
  function paintBar() {
    // the phone's address bar follows the page
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    var colour = current() === "dark" ? "#0d1117" : "#ffffff";
    for (var i = 0; i < metas.length; i++) {
      metas[i].setAttribute("content", colour);
      metas[i].removeAttribute("media");
    }
  }
  function set(t) {
    root.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch (e) {
      /* still works for this page */
    }
    paintBar();
    document.dispatchEvent(new CustomEvent("eu:theme", { detail: t }));
  }
  if (system && system.addEventListener)
    system.addEventListener("change", function () {
      if (!root.getAttribute("data-theme")) {
        paintBar();
        document.dispatchEvent(new CustomEvent("eu:theme", { detail: current() }));
      }
    });
  document.addEventListener("DOMContentLoaded", paintBar);
  window.EUTheme = {
    current: current,
    set: set,
    toggle: function () {
      set(current() === "dark" ? "light" : "dark");
    },
  };
})();
