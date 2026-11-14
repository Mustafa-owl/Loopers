/* © 2026 NorthPoint Tech. All rights reserved. */
/* Script errors on this page go back to the server (POST /api/errors), so
   the team sees a broken page on the System screen before anyone has to
   tell them. Loaded first, before the other scripts.

   Sent: the message, the page path, the script and line, the first stack
   lines and the browser's name. Not sent: anything typed on the page.
   Errors from browser extensions and other sites are left out, and one
   page sends at most 5. */
(function () {
  "use strict";
  let left = 5;
  const seen = new Set();

  function device() {
    try {
      return localStorage.getItem("eu.device") ? JSON.parse(localStorage.getItem("eu.device")) : "";
    } catch (e) {
      return "";
    }
  }

  function send(message, file, line, stack) {
    if (left <= 0 || !message) return;
    // only our own scripts; extensions and injected code aren't ours to fix
    if (file && file.indexOf(location.origin) !== 0) return;
    const key = message + "|" + file + "|" + line;
    if (seen.has(key)) return;
    seen.add(key);
    left -= 1;
    try {
      fetch("/api/errors", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json", "x-device": device() },
        body: JSON.stringify({
          message: String(message).slice(0, 300),
          page: location.pathname,
          file: file || "",
          line: line || 0,
          stack: String(stack || "")
            .split("\n")
            .slice(0, 5)
            .join("\n")
            .slice(0, 1000),
          agent: navigator.userAgent.slice(0, 200),
        }),
      }).catch(function () {
        /* offline: nothing to do */
      });
    } catch (e) {
      /* never let the reporter itself break the page */
    }
  }

  window.addEventListener("error", function (e) {
    // a picture or script that didn't load also fires "error", without a message
    if (!e.message) return;
    send(e.message, e.filename, e.lineno, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    const r = e.reason;
    // a fetch that failed because the phone is offline isn't a bug
    if (r && (r.name === "AbortError" || r.message === "Failed to fetch" || r.message === "noApi")) return;
    send(r && r.message ? r.message : String(r), location.href, 0, r && r.stack);
  });
})();
