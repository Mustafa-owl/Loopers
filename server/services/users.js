/* © 2026 NorthPoint Tech. All rights reserved.

   Team accounts and signing in.

   Roles
     staff       works on their own service: confirms and closes reports,
                 handles private requests, posts planned cuts and news,
                 approves photos
     supervisor  everything staff can do, plus hiding fake reports,
                 deleting anyone's cuts or news, and reading the activity log
                 for their service
     admin       both services, team accounts, and the full activity log

   Sessions: the browser gets a random token in an httpOnly cookie; we keep
   only its SHA-256. A session ends after SESSION_HOURS, after 2 hours
   without use, on sign-out, or when the account is changed or disabled.

   After 5 wrong passwords an account waits 15 minutes; one internet
   address gets 20 tries per 15 minutes across all accounts.

   Admin tools that touch someone else's access (a new password, ending
   their sessions, removing an account, signing everyone out) ask the admin
   for their own password again first, so a laptop left signed in can't be
   used to take over the other accounts. Nobody can read a password: only a
   scrambled hash is kept, so an admin can replace one but never see it.   */
import { hashPassword, verifyPassword, randomToken, sha256, readablePassword, DUMMY_HASH } from "../lib/crypto.js";
import { clip } from "../lib/text.js";
import { isService } from "../lib/places.js";
import { HttpError, badRequest, notFound, forbidden, tooMany } from "../lib/http.js";
import { MINUTE, HOUR } from "../lib/time.js";

export const ROLES = ["staff", "supervisor", "admin"];
const LOCK_AFTER = 5;
const LOCK_FOR = 15 * MINUTE;
const IP_TRIES = 20;
const IDLE_LIMIT = 2 * HOUR;
const MIN_PASSWORD = 10;
const CONFIRM_TRIES = 5; // wrong "your own password" answers per 15 minutes

export function createUsers({ db, config, limits, audit, now }) {
  const byId = db.prepare("SELECT * FROM users WHERE id = ?");
  const byName = db.prepare("SELECT * FROM users WHERE username = ?");

  const toPublic = (u) =>
    u && {
      id: u.id,
      username: u.username,
      name: u.display_name,
      role: u.role,
      service: u.service,
      active: !!u.active,
      mustChangePassword: !!u.must_change_password,
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at,
    };

  function checkPassword(password) {
    if (typeof password !== "string" || password.length < MIN_PASSWORD) throw badRequest("shortPassword");
    if (password.length > 200) throw badRequest("longPassword");
  }

  function readAccount(input, { partial = false } = {}) {
    const out = {};
    if (!partial || input.username !== undefined) {
      const username = String(input.username || "")
        .trim()
        .toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw badRequest("badUsername");
      out.username = username;
    }
    if (!partial || input.name !== undefined) {
      const name = clip(input.name, 60);
      if (!name) throw badRequest("needName");
      out.display_name = name;
    }
    if (!partial || input.role !== undefined) {
      if (!ROLES.includes(input.role)) throw badRequest("badRole");
      out.role = input.role;
    }
    if (!partial || input.service !== undefined || input.role !== undefined) {
      const role = out.role;
      if (role === "admin") out.service = isService(input.service) ? input.service : null;
      else if (role || input.service !== undefined) {
        if (!isService(input.service)) throw badRequest("needService");
        out.service = input.service;
      }
    }
    return out;
  }

  function endSessions(userId, exceptId = null) {
    return db.prepare("DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?").run(userId, exceptId).changes;
  }

  // The admin types their own password again before a sensitive change
  function confirmAdmin(admin, password) {
    if (limits.count("confirm:user", String(admin.id), LOCK_FOR) >= CONFIRM_TRIES) throw tooMany("slowDown");
    const me = byId.get(admin.id);
    if (!me || !verifyPassword(String(password || ""), me.password_hash)) {
      limits.record("confirm:user", String(admin.id));
      audit.log(admin, "admin.confirmFailed", { targetType: "user", targetId: admin.id });
      throw new HttpError(401, "wrongConfirm");
    }
  }

  function account(id) {
    const u = byId.get(Number(id));
    if (!u) throw notFound();
    return u;
  }

  // The last active admin can't be removed, switched off or demoted
  function keepAnAdmin(u) {
    if (u.role !== "admin" || !u.active) return;
    const admins = db.prepare("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1").pluck().get();
    if (admins <= 1) throw forbidden("lastAdmin");
  }

  // "Chrome on Windows" from a user-agent string; good enough to recognise a device
  function device(ua) {
    ua = String(ua || "");
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Chrome\//.test(ua)
              ? "Chrome"
              : /Safari\//.test(ua)
                ? "Safari"
                : "";
    const os = /iPhone|iPad/.test(ua)
      ? "iPhone or iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
    return [browser, os].filter(Boolean).join(", ") || null;
  }

  return {
    toPublic,
    count: () => db.prepare("SELECT COUNT(*) FROM users").pluck().get(),

    /* ---------------- signing in ---------------- */

    login({ username, password }, who, userAgent) {
      const t = now();
      if (limits.count("login:ip", who.ip, LOCK_FOR) >= IP_TRIES) throw tooMany("slowDown");
      const name = String(username || "")
        .trim()
        .toLowerCase();
      const u = name ? byName.get(name) : null;

      // Always do the slow check, so a missing account takes as long as a wrong password
      const ok = verifyPassword(String(password || ""), u ? u.password_hash : DUMMY_HASH) && !!u;

      if (u && u.locked_until && u.locked_until > t)
        throw tooMany("locked", { wait: Math.ceil((u.locked_until - t) / MINUTE) });
      if (!ok || !u.active) {
        limits.record("login:ip", who.ip);
        if (u) {
          const fails = u.failed_logins + 1;
          db.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").run(
            fails >= LOCK_AFTER ? 0 : fails,
            fails >= LOCK_AFTER ? t + LOCK_FOR : null,
            u.id,
          );
          audit.log(u, fails >= LOCK_AFTER ? "login.locked" : "login.failed", { targetType: "user", targetId: u.id });
        }
        throw new HttpError(401, "wrong");
      }

      const token = randomToken();
      db.prepare(
        "INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(sha256(token), u.id, t, t, t + config.sessionHours * HOUR, clip(userAgent, 200));
      db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").run(
        t,
        u.id,
      );
      audit.log(u, "login", { targetType: "user", targetId: u.id });
      return { token, user: toPublic(byId.get(u.id)), expires: t + config.sessionHours * HOUR };
    },

    // The signed-in user for a cookie token, or null. Also keeps the session warm.
    fromToken(token) {
      if (!token) return null;
      const id = sha256(token);
      const s = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
      const t = now();
      if (!s || s.expires_at < t || t - s.last_seen_at > IDLE_LIMIT) {
        if (s) db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
        return null;
      }
      const u = byId.get(s.user_id);
      if (!u || !u.active) return null;
      if (t - s.last_seen_at > MINUTE) db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(t, id);
      return { ...u, sessionId: id };
    },

    logout(token) {
      if (token) db.prepare("DELETE FROM sessions WHERE id = ?").run(sha256(token));
    },

    changePassword(user, { current, next }) {
      const u = byId.get(user.id);
      if (!verifyPassword(String(current || ""), u.password_hash)) throw new HttpError(401, "wrongCurrent");
      checkPassword(next);
      if (next === current) throw badRequest("samePassword");
      db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?").run(
        hashPassword(next),
        now(),
        u.id,
      );
      endSessions(u.id, user.sessionId); // sign out every other browser
      audit.log(user, "password.change", { targetType: "user", targetId: u.id });
      return toPublic(byId.get(u.id));
    },

    /* ---------------- managing accounts (admins) ---------------- */

    list() {
      return db.prepare("SELECT * FROM users ORDER BY active DESC, role DESC, display_name").all().map(toPublic);
    },

    // People who can be given a private request for this service
    assignable(service) {
      return db
        .prepare(
          "SELECT id, display_name FROM users WHERE active = 1 AND (role = 'admin' OR service = ?) ORDER BY display_name",
        )
        .all(service)
        .map((u) => ({ id: u.id, name: u.display_name }));
    },

    create(admin, input) {
      const a = readAccount(input);
      if (byName.get(a.username)) throw new HttpError(409, "usernameTaken");
      const password = readablePassword();
      const t = now();
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO users (username, display_name, role, service, password_hash, must_change_password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        )
        .run(a.username, a.display_name, a.role, a.service, hashPassword(password), t, t);
      audit.log(admin, "user.create", {
        targetType: "user",
        targetId: lastInsertRowid,
        service: a.service,
        detail: { username: a.username, role: a.role },
      });
      return { user: toPublic(byId.get(lastInsertRowid)), password };
    },

    update(admin, id, input) {
      const u = byId.get(Number(id));
      if (!u) throw notFound();
      const merged = { username: u.username, name: u.display_name, role: u.role, service: u.service, ...input };
      const a = readAccount(merged);
      if (a.username !== u.username && byName.get(a.username)) throw new HttpError(409, "usernameTaken");
      const active = input.active === undefined ? u.active : input.active ? 1 : 0;
      if (u.id === admin.id && (a.role !== "admin" || !active)) throw forbidden("notYourself");
      if (a.role !== "admin" || !active) keepAnAdmin(u);
      db.prepare(
        "UPDATE users SET username = ?, display_name = ?, role = ?, service = ?, active = ?, updated_at = ? WHERE id = ?",
      ).run(a.username, a.display_name, a.role, a.service, active, now(), u.id);
      // A change of role, service or access takes effect straight away
      if (a.role !== u.role || a.service !== u.service || active !== u.active) endSessions(u.id);
      audit.log(admin, "user.update", {
        targetType: "user",
        targetId: u.id,
        service: a.service,
        detail: { username: a.username, role: a.role, service: a.service, active: !!active },
      });
      return toPublic(byId.get(u.id));
    },

    /* Everything an admin needs to look after one account. Sessions are
       listed by their row number; the stored hash never leaves the server. */
    detail(admin, id) {
      const u = account(id);
      const t = now();
      const sessions = db
        .prepare(
          `SELECT rowid AS n, id, created_at, last_seen_at, expires_at, user_agent FROM sessions
        WHERE user_id = ? AND expires_at > ? AND last_seen_at > ? ORDER BY last_seen_at DESC`,
        )
        .all(u.id, t, t - IDLE_LIMIT)
        .map((x) => ({
          id: x.n,
          device: device(x.user_agent),
          since: x.created_at,
          lastSeen: x.last_seen_at,
          current: x.id === admin.sessionId,
        }));
      const since = t - 30 * 24 * HOUR;
      const work = Object.fromEntries(
        db
          .prepare(
            `SELECT substr(action, 1, instr(action, '.') - 1) AS kind, COUNT(*) AS n FROM audit_log
        WHERE user_id = ? AND at > ? AND action LIKE '%.%' GROUP BY kind`,
          )
          .all(u.id, since)
          .map((r) => [r.kind, r.n]),
      );
      return {
        user: toPublic(u),
        locked: u.locked_until && u.locked_until > t ? { until: u.locked_until } : null,
        failedLogins: u.failed_logins,
        sessions,
        work: {
          reports: work.report || 0,
          requests: work.request || 0,
          photos: work.photo || 0,
          notices: work.notice || 0,
          news: work.news || 0,
        },
        canRemove: !u.last_login_at && u.id !== admin.id,
      };
    },

    // A temporary password made up for them, shown to the admin once
    resetPassword(admin, id, { confirm } = {}) {
      confirmAdmin(admin, confirm);
      const u = account(id);
      const password = readablePassword();
      db.prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 1, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
      ).run(hashPassword(password), now(), u.id);
      endSessions(u.id, u.id === admin.id ? admin.sessionId : null);
      audit.log(admin, "user.resetPassword", {
        targetType: "user",
        targetId: u.id,
        service: u.service,
        detail: { username: u.username },
      });
      return { user: toPublic(byId.get(u.id)), password };
    },

    /* A password the admin chose, for example one agreed on the phone.
       By default they still have to pick their own at the next sign-in. */
    setPassword(admin, id, { password, mustChange = true, confirm } = {}) {
      confirmAdmin(admin, confirm);
      const u = account(id);
      checkPassword(password);
      const must = u.id === admin.id ? 0 : mustChange === false ? 0 : 1;
      db.prepare(
        "UPDATE users SET password_hash = ?, must_change_password = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?",
      ).run(hashPassword(password), must, now(), u.id);
      endSessions(u.id, u.id === admin.id ? admin.sessionId : null);
      audit.log(admin, "user.setPassword", {
        targetType: "user",
        targetId: u.id,
        service: u.service,
        detail: { username: u.username, mustChange: !!must },
      });
      return toPublic(byId.get(u.id));
    },

    // Sign them out of one browser, or of all of them
    endSession(admin, id, sessionNo, { confirm } = {}) {
      confirmAdmin(admin, confirm);
      const u = account(id);
      let ended;
      if (sessionNo == null) ended = endSessions(u.id, u.id === admin.id ? admin.sessionId : null);
      else {
        const row = db.prepare("SELECT id FROM sessions WHERE rowid = ? AND user_id = ?").get(Number(sessionNo), u.id);
        if (!row) throw notFound();
        if (row.id === admin.sessionId) throw forbidden("thisBrowser");
        ended = db.prepare("DELETE FROM sessions WHERE id = ?").run(row.id).changes;
      }
      audit.log(admin, "user.signOut", {
        targetType: "user",
        targetId: u.id,
        service: u.service,
        detail: { username: u.username, sessions: ended },
      });
      return { ended };
    },

    // Let them try again straight away after too many wrong passwords
    unlock(admin, id) {
      const u = account(id);
      db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?").run(
        now(),
        u.id,
      );
      audit.log(admin, "user.unlock", {
        targetType: "user",
        targetId: u.id,
        service: u.service,
        detail: { username: u.username },
      });
      return toPublic(byId.get(u.id));
    },

    /* Only an account that has never been used can be removed, for example
       one made with a typo. Anyone who has worked keeps their account
       (switched off), so the activity log still says who did what.       */
    remove(admin, id, { confirm } = {}) {
      confirmAdmin(admin, confirm);
      const u = account(id);
      if (u.id === admin.id) throw forbidden("notYourself");
      if (u.last_login_at) throw forbidden("hasHistory");
      keepAnAdmin(u);
      db.prepare("DELETE FROM users WHERE id = ?").run(u.id);
      audit.log(admin, "user.remove", {
        targetType: "user",
        targetId: u.id,
        service: u.service,
        detail: { username: u.username },
      });
      return { removed: true };
    },

    // For a lost phone or a password that got out: everyone but this browser
    signOutEveryone(admin, { confirm } = {}) {
      confirmAdmin(admin, confirm);
      const ended = db.prepare("DELETE FROM sessions WHERE id IS NOT ?").run(admin.sessionId).changes;
      audit.log(admin, "admin.signOutEveryone", { detail: { sessions: ended } });
      return { ended };
    },

    /* The very first account. Used by `npm run create-admin` and on first
       start when the database has no users. */
    createFirstAdmin({ username = "admin", name = "Administrator", password = null } = {}) {
      const pass = password || readablePassword();
      if (password) checkPassword(password);
      const t = now();
      db.prepare(
        `INSERT INTO users (username, display_name, role, service, password_hash, must_change_password, created_at, updated_at)
        VALUES (?, ?, 'admin', NULL, ?, ?, ?, ?)`,
      ).run(username.toLowerCase(), name, hashPassword(pass), password ? 0 : 1, t, t);
      return pass;
    },

    pruneSessions() {
      const t = now();
      return db.prepare("DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?").run(t, t - IDLE_LIMIT).changes;
    },
  };
}
