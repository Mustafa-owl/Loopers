/* © 2026 NorthPoint Tech. All rights reserved.
   The link at the end of every text alert. Nothing happens until the
   button is pressed, so a link preview can't stop someone's alerts. */
(function () {
  "use strict";
  const EU = window.EU;
  document.addEventListener("DOMContentLoaded", () => {
    const key = EU.param("k");
    const btn = document.getElementById("stop-btn");
    const text = document.getElementById("stop-text");
    if (!key) {
      btn.hidden = true;
      text.textContent = EU.t("sms.stopBadLink");
      return;
    }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        const r = await EU.Store.api("/api/sms/stop", { method: "POST", body: { key } });
        text.removeAttribute("data-i18n");
        text.textContent = EU.t(r.ok && r.stopped ? "sms.stopped" : "sms.stopAlready");
        btn.hidden = true;
      } catch (e) {
        btn.disabled = false;
        EU.toast(EU.t("report.busy"));
      }
    });
  });
})();
