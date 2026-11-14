/* © 2026 NorthPoint Tech. All rights reserved. */
/* Report form.

   First question: who is affected?
   - Only my house, or 2–3 houses: usually a fault at the house or the
     nearest pole, not a neighbourhood cut. It goes privately into the
     team's inbox with a phone number, and someone calls back to agree a
     time. It never appears on the map.
   - The whole street or more: a public report on the map, so neighbours
     can confirm it. A photo can go with it.

   Spam checks here (the server repeats all of them and has the last word):
   - a hidden "website" field people never see; bots fill it in
   - a form sent less than 4 seconds after it appeared is asked to check again
   - if the same problem is already open in that neighbourhood, the form
     offers "Me too" instead of a duplicate                                   */
(function () {
  "use strict";
  const EU = window.EU;
  const $ = (id) => document.getElementById(id);
  const MIN_FILL_MS = 4000;
  let shownAt = Date.now();
  let lastArea = null;
  let photo = null; // a resized JPEG Blob, ready to send
  let sending = false;

  const service = () => document.querySelector('input[name="service"]:checked').value;
  const problem = () => (document.querySelector('input[name="problem"]:checked') || {}).value || "";
  const who = () => (document.querySelector('input[name="who"]:checked') || {}).value || "";
  const isPrivate = () => who() === "home" || who() === "few";

  function renderProblems() {
    const picked = problem();
    $("problems").innerHTML = EU.PROBLEMS[service()]
      .map(
        (p) => `
      <label><input type="radio" name="problem" value="${p.key}"${p.key === picked ? " checked" : ""}><span>${EU.esc(EU.t("p." + p.key))}</span></label>
    `,
      )
      .join("");
  }

  function renderAreas() {
    const current = $("area").value || EU.param("a") || lastArea || EU.myArea();
    EU.fillAreaSelect($("area"), current);
  }

  // The private part only shows for one house or a few; photos only for public reports
  function renderWho() {
    const priv = isPrivate();
    $("private").hidden = !priv;
    $("photo-field").hidden = priv;
    $("note-hint").textContent = EU.t(priv ? "private.noteHint" : "report.noteHint");
    $("send").textContent = EU.t(priv ? "private.send" : "report.send");
    $("note").placeholder = EU.t(priv ? "private.notePh" : "report.notePh");
    renderExisting();
  }

  // "Already reported in Ankawa: 18 people. [Me too]", or a planned cut
  function renderExisting() {
    const box = $("existing");
    const area = $("area").value;
    const p = problem();
    const open = !isPrivate() && area && p ? EU.Store.findOpen(area, service(), p) : null;
    const planned = area ? EU.Store.notices(area, service()) : [];
    const comma = EU.isRtl() ? "، " : ", ";
    box.classList.remove("existing--planned");
    if (!open && !planned.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    if (!open) {
      const n = planned[0];
      box.hidden = false;
      box.classList.add("existing--planned");
      box.innerHTML = `
        <p class="existing__title">${EU.esc(EU.t("notice.kind." + n.service))}${comma}${EU.esc(EU.areaName(area))}</p>
        <p>${n.now ? EU.esc(EU.t("notice.live")) + comma : ""}${EU.esc(EU.noticeWhen(n))}</p>${n.reason ? `<p>${EU.esc(EU.pick(n.reason))}</p>` : ""}
        <p class="muted">${EU.esc(EU.t("notice.reportHint", { time: EU.clock(n.to) }))}</p>`;
      return;
    }
    const mine = open.sentByMe || open.myVote === "metoo";
    box.hidden = false;
    box.innerHTML = `
      <p class="existing__title">${EU.esc(EU.t("report.existingTitle", { area: EU.areaName(area) }))}</p>
      <p>${EU.esc(open.confirmed ? EU.t("people", { n: open.people }) : EU.t("state.unconfirmed"))}, ${EU.esc(EU.ago(open.last))}</p>
      <p class="muted">${EU.esc(EU.t(mine ? "report.existingMine" : "report.existingBody"))}</p>
      ${mine ? "" : `<button type="button" class="btn" id="join">${EU.esc(EU.t("btn.metoo"))}</button>`}`;
    const join = $("join");
    if (join) join.addEventListener("click", () => submit(null, true));
  }

  function showError(key, params) {
    $("form-error").textContent = key ? EU.t(key, params) : "";
  }

  function busy(on) {
    sending = on;
    $("send").disabled = on;
    $("send").textContent = EU.t(on ? "report.sending" : isPrivate() ? "private.send" : "report.send");
  }

  // Iraqi mobile numbers: 07xx xxx xxxx, +964 7xx…, 00964…, Eastern Arabic digits too
  function cleanPhone(raw) {
    let d = EU.normalize(raw).replace(/[^\d+]/g, "");
    if (d.startsWith("00")) d = "+" + d.slice(2);
    if (d.startsWith("+964")) d = "0" + d.slice(4);
    else if (d.startsWith("964")) d = "0" + d.slice(3);
    if (/^7\d{9}$/.test(d)) d = "0" + d;
    return /^07[3-9]\d{8}$/.test(d) ? d : null;
  }

  function failed(res) {
    if (res.reason === "wait") showError("report.wait", { n: res.wait || 60 });
    else if (res.reason === "noLinks") {
      showError("report.noLinks");
      $("note").focus();
    } else if (res.reason === "queueFull") showError("report.queueFull");
    else if (["already", "tooMany", "tooManyAreas", "tooManyPrivate", "needPhone"].includes(res.reason)) {
      showError(
        res.reason === "tooManyPrivate"
          ? "private.tooMany"
          : res.reason === "needPhone"
            ? "private.needPhone"
            : "report." + res.reason,
      );
    } else showError("report.busy");
  }

  async function submit(e, joining) {
    if (e) e.preventDefault();
    if (sending) return;
    const p = problem();
    const area = $("area").value;
    if (!who()) {
      showError("report.needWho");
      document.querySelector('input[name="who"]').focus();
      return;
    }
    if (!p) {
      showError("report.needProblem");
      $("problems").querySelector("input").focus();
      return;
    }
    if (!area) {
      showError("report.needArea");
      $("area").focus();
      return;
    }

    let phone = null;
    if (isPrivate()) {
      phone = cleanPhone($("p-phone").value);
      if (!phone) {
        showError("private.needPhone");
        $("p-phone").focus();
        return;
      }
    }
    if (!joining && Date.now() - shownAt < MIN_FILL_MS && !$("website").value) {
      showError("report.tooFast");
      shownAt = 0;
      return;
    }

    showError(null);
    busy(true);
    try {
      if (isPrivate()) {
        const res = await EU.Store.sendRequest({
          service: service(),
          area,
          problem: p,
          scope: who(),
          name: $("p-name").value,
          phone,
          place: $("p-place").value,
          meter: $("p-meter").value,
          when: $("p-when").value,
          via: document.querySelector('input[name="via"]:checked').value,
          note: $("note").value,
          website: $("website").value,
        });
        if (!res.ok) return failed(res);
        rememberArea(area);
        donePrivate(res.ref);
        return;
      }
      const res = await EU.Store.add({
        spot: area === $("area").value ? sharedSpot() : undefined,
        area,
        service: service(),
        problem: p,
        note: $("note").value,
        website: $("website").value,
      });
      if (res.reason === "queued") {
        rememberArea(area);
        return doneOffline(area);
      }
      if (!res.ok) return failed(res);
      rememberArea(area);
      done(area, res.merged, res.id);
    } finally {
      busy(false);
    }
  }

  // No connection: the report waits on this phone and goes out by itself
  function doneOffline(area) {
    $("done-body").textContent = EU.t("report.queued", { area: EU.areaName(area) });
    $("done-area").textContent = EU.t("report.view", { area: EU.areaName(area) });
    $("done-area").href = "/area.html?a=" + encodeURIComponent(area);
    $("done-photo").hidden = true;
    $("report-form").hidden = true;
    $("done").hidden = false;
    $("done").focus();
    window.scrollTo({ top: 0 });
  }

  function rememberArea(area) {
    lastArea = area;
    EU.setMyArea(area);
  }

  function done(area, merged, id) {
    const name = EU.areaName(area);
    $("done-body").textContent = EU.t(merged ? "report.merged" : "report.sentBody", { area: name });
    $("done-area").textContent = EU.t("report.view", { area: name });
    $("done-area").href = "/area.html?a=" + encodeURIComponent(area);
    $("done-photo").hidden = true;
    $("report-form").hidden = true;
    $("done").hidden = false;
    $("done").focus();
    window.scrollTo({ top: 0 });
    if (photo && id && id !== "r_0") sendPhoto(id);
  }

  async function sendPhoto(id) {
    const line = $("done-photo");
    line.hidden = false;
    line.textContent = EU.t("photo.sending");
    const res = await EU.Store.addPhoto(id, photo);
    line.textContent = EU.t(
      res.ok
        ? "photo.sent"
        : "photo.failed." +
            (["tooBig", "notJpeg", "enoughPhotos", "tooLate"].includes(res.reason) ? res.reason : "other"),
    );
    if (res.ok) clearPhoto();
  }

  function donePrivate(ref) {
    const T = (EU.TEAM && EU.TEAM[service()]) || {};
    $("p-title").textContent = EU.t("private.sentTitle." + service());
    $("p-ref").textContent = ref;
    $("p-call").hidden = !T.phone;
    if (T.phone) $("p-call").href = "tel:" + T.phone.replace(/[^\d+]/g, "");
    $("report-form").hidden = true;
    $("done-private").hidden = false;
    $("done-private").focus();
    $("track-ref").value = ref;
    renderMine();
    window.scrollTo({ top: 0 });
  }

  function again() {
    $("report-form").reset();
    clearPhoto();
    renderProblems();
    renderAreas();
    renderWho();
    $("done").hidden = true;
    $("done-private").hidden = true;
    $("report-form").hidden = false;
    shownAt = Date.now();
    $("who-home").focus();
  }

  /* ---------------- photo ---------------- */

  /* Shrinks the photo on the phone before it's sent: at most 1600 px on the
     long side, as a JPEG. Drawing it onto a canvas also drops everything
     hidden in the original file, including where it was taken. */
  async function shrink(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    const source =
      bitmap ||
      (await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      }));
    const w = source.width,
      h = source.height;
    for (const [max, quality] of [
      [1600, 0.82],
      [1280, 0.72],
      [1024, 0.65],
    ]) {
      const scale = Math.min(1, max / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= 1_400_000) return blob;
    }
    throw new Error("tooBig");
  }

  async function pickPhoto() {
    const file = $("photo").files[0];
    if (!file) return;
    try {
      photo = await shrink(file);
      $("photo-img").src = URL.createObjectURL(photo);
      $("photo-preview").hidden = false;
    } catch (e) {
      clearPhoto();
      showError("photo.failed.notJpeg");
    }
  }

  function clearPhoto() {
    photo = null;
    $("photo").value = "";
    $("photo-preview").hidden = true;
    $("photo-img").removeAttribute("src");
  }

  /* ---------------- checking on a private request ---------------- */

  function renderMine() {
    const list = EU.Store.myRequests();
    $("track-mine").hidden = !list.length;
    $("track-mine").innerHTML = list
      .map(
        (r) => `
      <li><button type="button" class="link-btn" data-ref="${EU.esc(r.ref)}" data-last4="${EU.esc(r.last4)}">
        <bdi dir="ltr">${EU.esc(r.ref)}</bdi></button>
        <span class="muted">${EU.esc(EU.t("svc." + r.service))}, ${EU.esc(EU.areaName(r.area))}, ${EU.esc(EU.ago(r.at))}</span></li>`,
      )
      .join("");
  }

  async function track(e) {
    if (e) e.preventDefault();
    const out = $("track-result");
    const ref = $("track-ref").value.trim().toUpperCase();
    const last4 = EU.normalize($("track-phone").value).replace(/\D/g, "");
    if (!/^EU-[A-Z0-9]{4,8}$/.test(ref) || last4.length !== 4) {
      out.innerHTML = `<p class="form__error">${EU.esc(EU.t("track.needBoth"))}</p>`;
      return;
    }
    out.innerHTML = `<p class="muted">${EU.esc(EU.t("track.looking"))}</p>`;
    const res = await EU.Store.requestStatus(ref, last4);
    if (!res.ok) {
      out.innerHTML = `<p class="form__error">${EU.esc(EU.t(res.reason === "noRequest" ? "track.notFound" : res.reason === "tooMany" ? "report.tooMany" : "report.busy"))}</p>`;
      return;
    }
    const r = res.request;
    const visit = r.visitAt ? EU.t("track.visit", { when: EU.dayAndTime(r.visitAt) }) : "";
    out.innerHTML = `
      <dl class="facts">
        <div><dt>${EU.esc(EU.t("track.status"))}</dt><dd><strong>${EU.esc(EU.t("rq.status." + r.status))}</strong></dd></div>
        <div><dt>${EU.esc(EU.t("track.about"))}</dt><dd>${EU.esc(EU.t("svc." + r.service))}, ${EU.esc(EU.areaName(r.area))}</dd></div>
        <div><dt>${EU.esc(EU.t("track.updated"))}</dt><dd>${EU.esc(EU.ago(r.updatedAt))}</dd></div>
      </dl>
      <p>${EU.esc(EU.t("rq.explain." + r.status))}${visit ? " " + EU.esc(visit) : ""}</p>`;
  }

  /* ---------------- location ---------------- */

  // the exact spot, kept only if the person ticks the box to share it with the team
  let spot = null;
  const sharedSpot = () => (spot && $("share-spot").checked ? spot : undefined);

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
          spot = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          $("spot-box").hidden = false;
          $("area").value = a.slug;
          msg.textContent = "";
          renderExisting();
        } else msg.textContent = EU.t("home.locateFail");
      },
      () => {
        msg.textContent = EU.t("home.locateFail");
      },
      { timeout: 10000 },
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (EU.param("s") === "water") $("svc-w").checked = true;
    if (EU.param("ref")) $("track-ref").value = EU.param("ref");
    renderProblems();
    renderAreas();
    renderWho();
    renderMine();
    shownAt = Date.now();
    document.querySelectorAll('input[name="who"]').forEach((r) =>
      r.addEventListener("change", () => {
        showError(null);
        renderWho();
      }),
    );
    document.querySelectorAll('input[name="service"]').forEach((r) =>
      r.addEventListener("change", () => {
        renderProblems();
        renderExisting();
        showError(null);
      }),
    );
    $("problems").addEventListener("change", () => {
      showError(null);
      renderExisting();
    });
    $("area").addEventListener("change", () => {
      showError(null);
      renderExisting();
    });
    $("report-form").addEventListener("submit", submit);
    $("again").addEventListener("click", again);
    $("again-private").addEventListener("click", again);
    $("locate").addEventListener("click", locate);
    $("photo").addEventListener("change", pickPhoto);
    $("photo-remove").addEventListener("click", clearPhoto);
    $("track-form").addEventListener("submit", track);
    $("track-mine").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ref]");
      if (!b) return;
      $("track-ref").value = b.getAttribute("data-ref");
      $("track-phone").value = b.getAttribute("data-last4");
      track();
    });
    EU.onLang(() => {
      renderProblems();
      renderAreas();
      renderWho();
      renderMine();
      if ($("form-error").textContent) showError(null);
    });
    EU.Store.onChange(renderExisting);
  });
})();
