/* © 2026 NorthPoint Tech. All rights reserved. */
/* Privacy: the two lines that depend on the install, who runs the site and
   how to reach them, from OPERATOR_NAME and CONTACT_EMAIL in .env. The rest
   of the page is plain text in strings.js. */
(function () {
  "use strict";
  const EU = window.EU;
  const meta = (name) => {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content").trim() : "";
  };

  function render() {
    const operator = meta("eu-operator");
    const contact = meta("eu-contact");
    document.getElementById("pv-who-text").textContent = operator
      ? EU.t("pv.whoIs", { name: operator })
      : EU.t("pv.whoUnset");

    const out = document.getElementById("pv-contact-text");
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      const link = `<a href="mailto:${EU.esc(contact)}"><bdi dir="ltr">${EU.esc(contact)}</bdi></a>`;
      out.innerHTML = EU.esc(EU.t("pv.contactMail", { email: "\u0000" })).replace("\u0000", link);
    } else out.textContent = EU.t("pv.contactChat");

    // on a phone the table stacks, so each cell carries its column name (as on About)
    const heads = [...document.querySelectorAll(".keep__table thead th")].map((th) => th.textContent);
    document
      .querySelectorAll(".keep__table tbody tr")
      .forEach((tr) => tr.querySelectorAll("td").forEach((td, i) => td.setAttribute("data-label", heads[i + 1] || "")));
  }

  document.addEventListener("DOMContentLoaded", () => {
    render();
    EU.onLang(render);
  });
})();
