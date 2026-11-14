/* © 2026 NorthPoint Tech. All rights reserved.

   Native speakers checking the site's words.

   Every word residents and teams read is in Sorani, Kurmanji and Arabic as
   well as English (public/assets/js/core/strings.js, team/strings.js, and the
   alert texts in server/lib/messages.js). Machines and non-native writers
   wrote many of them, so people who grew up with each language check them.

   • An admin makes a reviewer: a name and one language. The reviewer gets a
     private link (no account, no password), the same way generator owners do.
   • On /words.html the reviewer sees each string in English next to the
     current translation, and taps "Correct" or writes a better one.
   • Admins see each language's progress and every suggested change, and can
     download them. `npm run words:apply -- file.json` writes accepted ones
     into the string files, so they go through the tests and a release like
     any other change.

   Nothing a reviewer writes reaches the site by itself.                   */
import { randomToken, sha256 } from "../lib/crypto.js";
import { clip } from "../lib/text.js";
import { badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { HOUR } from "../lib/time.js";
import { MESSAGES } from "../lib/messages.js";

export const REVIEW_LANGS = ["ckb", "kmr", "ar"];
const KEY = /^[\w.:-]{1,80}$/;

export function createWords({ db, limits, audit, now }) {
  const byKey = db.prepare("SELECT * FROM word_reviewers WHERE key_hash = ? AND active = 1");
  const get = db.prepare("SELECT * FROM word_reviewers WHERE id = ?");

  const adminOnly = (user) => {
    if (user.role !== "admin") throw forbidden("notAllowed");
  };

  function reviewerFor(key) {
    const r = key ? byKey.get(sha256(String(key))) : null;
    if (!r) throw notFound("badLink");
    return r;
  }

  const reviewsOf = (id) =>
    db.prepare("SELECT key, seen, verdict, suggestion, note, at FROM word_reviews WHERE reviewer_id = ?").all(id);

  return {
    /* ---- the reviewer's link ---- */

    mine(key) {
      const r = reviewerFor(key);
      // the alert texts live on the server; the page has the rest
      const alerts = Object.fromEntries(
        Object.entries(MESSAGES).map(([k, v]) => ["alert." + k, { en: v.en, [r.lang]: v[r.lang] || "" }]),
      );
      return { reviewer: { name: r.name, lang: r.lang }, reviews: reviewsOf(r.id), alerts };
    },

    review(key, input) {
      const r = reviewerFor(key);
      if (limits.count("words", String(r.id), HOUR) >= 600) throw tooMany("wait");
      const k = String(input.key || "");
      if (!KEY.test(k)) throw badRequest("badKey");
      // "undo": take the verdict back
      if (input.undo) {
        db.prepare("DELETE FROM word_reviews WHERE reviewer_id = ? AND key = ?").run(r.id, k);
        return { key: k, removed: true };
      }
      const verdict = input.verdict === "change" ? "change" : input.verdict === "ok" ? "ok" : null;
      if (!verdict) throw badRequest("badVerdict");
      const suggestion = verdict === "change" ? clip(input.suggestion, 600) : "";
      if (verdict === "change" && !suggestion) throw badRequest("needSuggestion");
      limits.record("words", String(r.id));
      db.prepare(
        `INSERT INTO word_reviews (reviewer_id, key, seen, verdict, suggestion, note, at) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(reviewer_id, key) DO UPDATE SET seen = excluded.seen, verdict = excluded.verdict,
          suggestion = excluded.suggestion, note = excluded.note, at = excluded.at`,
      ).run(r.id, k, clip(input.seen, 600), verdict, suggestion, clip(input.note, 300), now());
      return { key: k, verdict, suggestion };
    },

    /* ---- admins ---- */

    teamView(user) {
      adminOnly(user);
      const reviewers = db
        .prepare(
          `SELECT r.id, r.name, r.lang, r.active, r.key_hash IS NOT NULL AS hasLink, r.created_at AS createdAt,
            COUNT(w.key) AS checked, SUM(w.verdict = 'change') AS changes, MAX(w.at) AS lastAt
          FROM word_reviewers r LEFT JOIN word_reviews w ON w.reviewer_id = r.id
          GROUP BY r.id ORDER BY r.lang, r.name`,
        )
        .all()
        .map((r) => ({ ...r, active: !!r.active, hasLink: !!r.hasLink, changes: r.changes || 0 }));
      const suggestions = db
        .prepare(
          `SELECT w.key, r.lang, r.name AS reviewer, w.seen, w.suggestion, w.note, w.at
          FROM word_reviews w JOIN word_reviewers r ON r.id = w.reviewer_id
          WHERE w.verdict = 'change' ORDER BY r.lang, w.key`,
        )
        .all();
      // keys each language has had confirmed by at least one reviewer, and the text they saw
      const confirmed = db
        .prepare(
          `SELECT w.key, r.lang, w.seen FROM word_reviews w JOIN word_reviewers r ON r.id = w.reviewer_id WHERE w.verdict = 'ok'`,
        )
        .all();
      // the alert texts as they are now; the team page has the others
      const alerts = Object.fromEntries(Object.entries(MESSAGES).map(([k, v]) => ["alert." + k, v]));
      return { reviewers, suggestions, confirmed, alerts };
    },

    addReviewer(user, input) {
      adminOnly(user);
      const name = clip(input.name, 60);
      if (!name) throw badRequest("needName");
      if (!REVIEW_LANGS.includes(input.lang)) throw badRequest("badLang");
      const key = randomToken(24);
      const id = db
        .prepare("INSERT INTO word_reviewers (name, lang, key_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(name, input.lang, sha256(key), user.id, now()).lastInsertRowid;
      audit.log(user, "words.reviewer", { targetType: "reviewer", targetId: id, detail: { name, lang: input.lang } });
      return { id: Number(id), key };
    },

    newLink(user, id) {
      adminOnly(user);
      if (!get.get(id)) throw notFound();
      const key = randomToken(24);
      db.prepare("UPDATE word_reviewers SET key_hash = ?, active = 1 WHERE id = ?").run(sha256(key), id);
      audit.log(user, "words.link", { targetType: "reviewer", targetId: id });
      return { key };
    },

    endReviewer(user, id) {
      adminOnly(user);
      db.prepare("UPDATE word_reviewers SET key_hash = NULL, active = 0 WHERE id = ?").run(id);
      audit.log(user, "words.end", { targetType: "reviewer", targetId: id });
    },
  };
}
