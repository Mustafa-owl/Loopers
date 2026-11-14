-- A pop-up message from the admins, shown on the public site for a while.
-- Texts are JSON per language ({"en": "…", "ckb": "…"}).
CREATE TABLE popups (
  id          INTEGER PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'urgent')),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  starts_at   INTEGER NOT NULL,
  ends_at     INTEGER NOT NULL,
  ended_at    INTEGER,                 -- taken down early
  ended_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pushed      INTEGER,                 -- how many phones it was sent to, if it was
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX popups_live ON popups (starts_at, ends_at);
