-- Errors the server hit and errors residents' browsers sent back, for the
-- admin "System" screen. The same error is one row with a count, so a bug
-- that hits everyone at once doesn't fill the database.
CREATE TABLE errors (
  fingerprint TEXT PRIMARY KEY,           -- short hash of source + message + where
  source      TEXT NOT NULL,              -- 'server' or 'browser'
  message     TEXT NOT NULL,
  place       TEXT NOT NULL DEFAULT '',   -- the route, or the page and script line
  detail      TEXT,                       -- first lines of the stack
  first_at    INTEGER NOT NULL,
  last_at     INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX errors_last ON errors (last_at);
