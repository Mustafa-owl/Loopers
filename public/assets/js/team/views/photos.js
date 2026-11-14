/* © 2026 NorthPoint Tech. All rights reserved.
   Photos waiting to be checked. Approve what helps; reject anything that
   shows a face, a house number, a car plate or isn't about the problem. */
import { post } from "../api.js";
import { esc, t, toast, errorText } from "../util.js";

const EU = window.EU;

export default {
  render(root, ctx) {
    const list = ctx.data.photos;
    root.innerHTML = `
      <div class="tm-head"><h1>${esc(t("tm.nav.photos"))}</h1><p class="muted">${esc(t("tm.photosLead"))}</p></div>
      ${
        list.length
          ? `<ul class="tm-photos">${list
              .map(
                (p) => `<li>
        <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="${esc(t("photo.alt", { problem: t("p." + p.problem) }))}" loading="lazy"></a>
        <p><strong>${esc(EU.areaName(p.area))}</strong>${EU.isRtl() ? "، " : ", "}${esc(t("p." + p.problem))}</p>
        <p class="small muted">${esc(EU.ago(p.at))}</p>
        <div class="actions"><button type="button" class="btn btn--small" data-photo="${esc(p.id)}" data-act="approve">${esc(t("tm.approve"))}</button>
          <button type="button" class="btn btn--small btn--danger" data-photo="${esc(p.id)}" data-act="reject">${esc(t("tm.reject"))}</button></div>
      </li>`,
              )
              .join("")}</ul>`
          : `<p class="tm-empty">${esc(t("tm.noPhotos"))}</p>`
      }`;

    root.querySelectorAll("[data-photo]").forEach((b) =>
      b.addEventListener("click", async () => {
        b.disabled = true;
        try {
          await post("/photos/" + encodeURIComponent(b.getAttribute("data-photo")), {
            action: b.getAttribute("data-act"),
          });
          toast(t(b.getAttribute("data-act") === "approve" ? "tm.approved" : "tm.rejected"));
          await ctx.reload();
        } catch (err) {
          b.disabled = false;
          toast(errorText(err));
        }
      }),
    );
  },
};
