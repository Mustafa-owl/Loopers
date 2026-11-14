/* © 2026 NorthPoint Tech. All rights reserved.

   A copy of the database you can keep somewhere safe:

     npm run backup        → data/backups/erbil-utilities-2026-10-17-0930.db

   Safe to run while the site is up (SQLite's VACUUM INTO makes a
   consistent copy). Keeps the newest 14 and deletes older ones. The
   uploaded photos are in data/uploads; copy that folder too.

   On a server, run it every night from cron:
     15 3 * * *  cd /srv/erbil-utilities && /usr/bin/npm run backup >> data/backup.log 2>&1   */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../server/config.js";

const KEEP = 14;
fs.mkdirSync(config.backupsDir, { recursive: true });
const stamp = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const target = path.join(config.backupsDir, `erbil-utilities-${stamp}.db`);

const db = new Database(config.dbFile, { readonly: true, fileMustExist: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
console.log(`backup: wrote ${target} (${Math.round(fs.statSync(target).size / 1024)} KB)`);

const old = fs
  .readdirSync(config.backupsDir)
  .filter((f) => /^erbil-utilities-.*\.db$/.test(f))
  .sort()
  .reverse()
  .slice(KEEP);
for (const f of old) fs.rmSync(path.join(config.backupsDir, f));
if (old.length) console.log(`backup: removed ${old.length} older backup(s)`);
