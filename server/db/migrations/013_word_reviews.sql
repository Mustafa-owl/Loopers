-- Native speakers checking the site's words. Each reviewer has a private
-- link (like a generator owner) for one language; only its hash is kept.
CREATE TABLE word_reviewers (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  lang        TEXT NOT NULL CHECK (lang IN ('ckb', 'kmr', 'ar')),
  key_hash    TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX word_reviewers_key ON word_reviewers (key_hash) WHERE key_hash IS NOT NULL;

-- One reviewer's verdict on one string. `seen` is the text they were shown,
-- so a string changed since then shows as needing a new look.
CREATE TABLE word_reviews (
  reviewer_id INTEGER NOT NULL REFERENCES word_reviewers(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  seen        TEXT NOT NULL,
  verdict     TEXT NOT NULL CHECK (verdict IN ('ok', 'change')),
  suggestion  TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  at          INTEGER NOT NULL,
  PRIMARY KEY (reviewer_id, key)
);
