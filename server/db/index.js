/* © 2026 NorthPoint Tech. All rights reserved.

   Opens the SQLite database and brings it up to date.

   Migrations are plain .sql files in ./migrations, run in name order, each
   exactly once. To change the schema, add a new file (002_something.sql);
   never edit one that has already run on a live server.                  */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { paths } from "../config.js";

export function openDatabase(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // readers don't wait for writers
  db.pragma("synchronous = NORMAL"); // safe with WAL, much faster
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, ran_at INTEGER NOT NULL)");
  const done = new Set(db.prepare("SELECT name FROM schema_migrations").pluck().all());
  const files = fs
    .readdirSync(paths.migrations)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const name of files) {
    if (done.has(name)) continue;
    const sql = fs.readFileSync(path.join(paths.migrations, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name, ran_at) VALUES (?, ?)").run(name, Date.now());
    })();
    console.log(`[db] ran migration ${name}`);
  }
}

/* Small key/value store for things the app makes once and keeps, like the
   secret key and the push notification keys. */
export function getSetting(db, key) {
  return db.prepare("SELECT value FROM settings WHERE key = ?").pluck().get(key) ?? null;
}

export function setSetting(db, key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, String(value));
}

/* JSON columns: parse safely, never throw on a bad row. */
export function fromJson(text, fallback = null) {
  if (text == null || text === "") return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
