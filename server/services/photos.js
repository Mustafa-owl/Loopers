/* © 2026 NorthPoint Tech. All rights reserved.

   Photos on reports (a fallen cable, a burst pipe).

   • The phone shrinks the photo before sending it (assets/js/core/photo.js)
     so it's small on mobile data. We only accept JPEG.
   • Everything hidden inside a JPEG besides the picture itself, including
     the GPS position many phones add, is removed before it's saved.
   • Only the phone that sent or joined the report can add photos, up to 3
     per report, within an hour of reporting.
   • Nobody else sees a photo until someone on the team approves it.      */
import fs from "node:fs";
import path from "node:path";
import { newId } from "../lib/crypto.js";
import { badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { HOUR, DAY } from "../lib/time.js";

export const PHOTO_RULES = { maxBytes: 1_500_000, perReport: 3, window: HOUR, perDevicePerDay: 10 };

/* Rebuild a JPEG keeping only the segments needed to show it. Drops APP1–APP15
   except APP14 (Exif, GPS, XMP, maker notes…) and comments. Throws if it
   isn't a JPEG. */
export function stripJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw badRequest("notJpeg");
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw badRequest("notJpeg");
    const marker = buf[i + 1];
    if (marker === 0xd9) {
      parts.push(buf.subarray(i, i + 2));
      break;
    } // end of image
    if (marker === 0xda) {
      parts.push(buf.subarray(i));
      break;
    } // start of scan: the picture itself
    if (marker >= 0xd0 && marker <= 0xd7) {
      i += 2;
      continue;
    } // restart markers have no length
    if (i + 4 > buf.length) throw badRequest("notJpeg");
    const len = buf.readUInt16BE(i + 2);
    // APP14 (0xEE, "Adobe") only says how colours are stored, so it stays
    const keep = !(marker >= 0xe1 && marker <= 0xef && marker !== 0xee) && marker !== 0xfe;
    if (keep) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return Buffer.concat(parts);
}

export function createPhotos({ db, config, limits, now }) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const fileFor = (name) => path.join(config.uploadsDir, path.basename(name));

  const approved = db
    .prepare("SELECT id FROM photos WHERE report_id = ? AND status = 'approved' ORDER BY created_at")
    .pluck();
  const all = db.prepare("SELECT id, status, created_at FROM photos WHERE report_id = ? ORDER BY created_at");

  return {
    approvedFor: (reportId) => approved.all(reportId).map((id) => `/photos/${id}.jpg`),
    allFor: (reportId) =>
      all.all(reportId).map((p) => ({ id: p.id, status: p.status, at: p.created_at, url: `/api/team/photos/${p.id}` })),

    add(report, buffer, who) {
      if (!report || report.status === "hidden") throw notFound("gone");
      const t = now();
      const joined = db
        .prepare("SELECT created_at FROM votes WHERE report_id = ? AND device = ? AND kind = 'metoo'")
        .pluck()
        .get(report.id, who.device);
      const mineSince = report.created_by === who.device ? report.started_at : joined;
      if (!mineSince) throw forbidden("notYourReport");
      if (t - mineSince > PHOTO_RULES.window) throw forbidden("tooLate");
      if (!buffer || !buffer.length) throw badRequest("noPhoto");
      if (buffer.length > PHOTO_RULES.maxBytes) throw badRequest("tooBig");
      const count = db
        .prepare("SELECT COUNT(*) FROM photos WHERE report_id = ? AND status != 'rejected'")
        .pluck()
        .get(report.id);
      if (count >= PHOTO_RULES.perReport) throw tooMany("enoughPhotos");
      if (limits.count("photo", who.device, DAY) >= PHOTO_RULES.perDevicePerDay) throw tooMany();

      const clean = stripJpeg(buffer);
      const id = newId("p");
      const file = id + ".jpg";
      fs.writeFileSync(fileFor(file), clean);
      db.prepare(
        "INSERT INTO photos (id, report_id, file, bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(id, report.id, file, clean.length, who.device, t);
      limits.record("photo", who.device);
      return { id, status: "pending" };
    },

    get: (id) => db.prepare("SELECT * FROM photos WHERE id = ?").get(String(id)) || null,
    path: (photo) => fileFor(photo.file),

    review(photo, status, user) {
      db.prepare("UPDATE photos SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(
        status,
        user.id,
        now(),
        photo.id,
      );
      if (status === "rejected") fs.rm(fileFor(photo.file), { force: true }, () => {});
    },

    pending(service) {
      const sql = `SELECT p.id, p.report_id, p.created_at, r.area, r.service, r.problem FROM photos p
        JOIN reports r ON r.id = p.report_id WHERE p.status = 'pending' ${service ? "AND r.service = ?" : ""} ORDER BY p.created_at`;
      return (service ? db.prepare(sql).all(service) : db.prepare(sql).all()).map((p) => ({
        id: p.id,
        reportId: p.report_id,
        at: p.created_at,
        area: p.area,
        service: p.service,
        problem: p.problem,
        url: `/api/team/photos/${p.id}`,
      }));
    },

    // Files whose report was deleted, or that were rejected
    prune() {
      const keep = new Set(db.prepare("SELECT file FROM photos WHERE status != 'rejected'").pluck().all());
      let removed = 0;
      for (const name of fs.readdirSync(config.uploadsDir)) {
        if (!keep.has(name)) {
          fs.rmSync(fileFor(name), { force: true });
          removed += 1;
        }
      }
      db.prepare("DELETE FROM photos WHERE status = 'rejected' AND reviewed_at < ?").run(now() - 7 * DAY);
      return removed;
    },
  };
}
