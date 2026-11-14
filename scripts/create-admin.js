/* © 2026 NorthPoint Tech. All rights reserved.

   Makes an admin account, or gives an existing one a new password.
   Useful if the first admin's password was lost.

     npm run create-admin -- --username rebaz --name "Rebaz Ali"

   Prints a temporary password; they choose their own on first sign-in.  */
import { config } from "../server/config.js";
import { openDatabase } from "../server/db/index.js";
import { hashPassword, readablePassword } from "../server/lib/crypto.js";

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const username = arg("username", "admin").toLowerCase();
const name = arg("name", "Administrator");
if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
  console.error("Usernames are 3–32 letters, numbers, dots, dashes or underscores.");
  process.exit(1);
}

const db = openDatabase(config.dbFile);
const password = readablePassword();
const now = Date.now();
const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);

if (existing) {
  db.prepare(
    `UPDATE users SET role = 'admin', service = NULL, active = 1, password_hash = ?, must_change_password = 1,
    failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?`,
  ).run(hashPassword(password), now, existing.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(existing.id);
  console.log(`"${username}" is an admin again, with a new temporary password.`);
} else {
  db.prepare(
    `INSERT INTO users (username, display_name, role, service, password_hash, must_change_password, created_at, updated_at)
    VALUES (?, ?, 'admin', NULL, ?, 1, ?, ?)`,
  ).run(username, name, hashPassword(password), now, now);
  console.log(`Made the admin account "${username}".`);
}
db.prepare(
  "INSERT INTO audit_log (at, username, action, target_type, detail) VALUES (?, 'command line', 'user.createAdmin', 'user', ?)",
).run(now, JSON.stringify({ username }));
db.close();
console.log(`Temporary password: ${password}`);
