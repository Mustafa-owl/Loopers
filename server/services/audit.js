/* © 2026 NorthPoint Tech. All rights reserved.
   A record of everything the teams change, and who changed it. */
import { fromJson } from "../db/index.js";

export function createAudit({ db, now }) {
  const insert =
    db.prepare(`INSERT INTO audit_log (at, user_id, username, action, target_type, target_id, service, detail)
    VALUES (@at, @userId, @username, @action, @targetType, @targetId, @service, @detail)`);

  return {
    log(user, action, { targetType = null, targetId = null, service = null, detail = null } = {}) {
      insert.run({
        at: now(),
        userId: user ? user.id : null,
        username: user ? user.username : null,
        action,
        targetType,
        targetId: targetId == null ? null : String(targetId),
        service,
        detail: detail == null ? null : JSON.stringify(detail),
      });
    },

    /* Newest first. Supervisors only see their own service; admins see
       everything, including sign-ins and changes to accounts. */
    list({ service = null, before = null, limit = 50, userId = null } = {}) {
      const where = [];
      const args = {};
      if (service) {
        where.push(
          "(service = @service OR (service IS NULL AND user_id IN (SELECT id FROM users WHERE service = @service)))",
        );
        args.service = service;
      }
      if (before) {
        where.push("id < @before");
        args.before = before;
      }
      if (userId) {
        where.push("user_id = @userId");
        args.userId = userId;
      }
      const rows = db
        .prepare(
          `SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY id DESC LIMIT ${Math.min(200, Math.max(1, limit))}`,
        )
        .all(args);
      return rows.map((r) => ({
        id: r.id,
        at: r.at,
        userId: r.user_id,
        username: r.username,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        service: r.service,
        detail: fromJson(r.detail),
      }));
    },

    prune(olderThanMs) {
      return db.prepare("DELETE FROM audit_log WHERE at < ?").run(now() - olderThanMs).changes;
    },
  };
}
