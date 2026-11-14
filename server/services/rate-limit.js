/* © 2026 NorthPoint Tech. All rights reserved.

   Counting actions for the limits. Each counted action is a row in
   rate_events; checking a limit is a COUNT over a time window. Kept in the
   database (not memory) so a restart doesn't reset anyone's limits.      */

export function createRateLimiter({ db, now }) {
  const insert = db.prepare("INSERT INTO rate_events (bucket, who, at, extra) VALUES (?, ?, ?, ?)");
  const count = db.prepare("SELECT COUNT(*) FROM rate_events WHERE bucket = ? AND who = ? AND at > ?").pluck();
  const last = db.prepare("SELECT MAX(at) FROM rate_events WHERE bucket = ? AND who = ?").pluck();
  const distinctExtra = db
    .prepare("SELECT DISTINCT extra FROM rate_events WHERE bucket = ? AND who = ? AND at > ?")
    .pluck();
  const clear = db.prepare("DELETE FROM rate_events WHERE bucket = ? AND who = ?");

  return {
    record(bucket, who, extra = null) {
      insert.run(bucket, who, now(), extra);
    },
    // How many times in the last `windowMs`
    count(bucket, who, windowMs) {
      return count.get(bucket, who, now() - windowMs);
    },
    // Milliseconds since the last time, or Infinity
    sinceLast(bucket, who) {
      const at = last.get(bucket, who);
      return at == null ? Infinity : now() - at;
    },
    // The different `extra` values in a window (used for "neighbourhoods today")
    distinct(bucket, who, windowMs) {
      return distinctExtra.all(bucket, who, now() - windowMs);
    },
    reset(bucket, who) {
      clear.run(bucket, who);
    },
    prune(olderThanMs) {
      return db.prepare("DELETE FROM rate_events WHERE at < ?").run(now() - olderThanMs).changes;
    },
  };
}
