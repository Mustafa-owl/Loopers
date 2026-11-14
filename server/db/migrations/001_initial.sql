-- © 2026 NorthPoint Tech. All rights reserved.
-- First version of the database. Times are milliseconds since 1970 (UTC),
-- the same numbers JavaScript's Date.now() gives.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- People on the electricity and water teams. Admins see both services.
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY,
  username              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name          TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'staff')),
  service               TEXT CHECK (service IN ('electricity', 'water')),
  password_hash         TEXT NOT NULL,
  must_change_password  INTEGER NOT NULL DEFAULT 1,
  active                INTEGER NOT NULL DEFAULT 1,
  failed_logins         INTEGER NOT NULL DEFAULT 0,
  locked_until          INTEGER,
  last_login_at         INTEGER,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL,
  CHECK (role = 'admin' OR service IS NOT NULL)
);

-- One row per signed-in browser. The cookie holds a random token; only its
-- hash is stored, so a copy of the database can't be used to sign in.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  user_agent    TEXT
);
CREATE INDEX sessions_by_user ON sessions(user_id);

-- Public reports from residents.
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  area              TEXT NOT NULL,
  service           TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  problem           TEXT NOT NULL,
  note              TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'hidden')),
  people            INTEGER NOT NULL DEFAULT 1,
  fine              INTEGER NOT NULL DEFAULT 0,
  team_confirmed    INTEGER NOT NULL DEFAULT 0,
  team_note         TEXT,
  created_by        TEXT NOT NULL,          -- scrambled device code
  ip_hash           TEXT,
  started_at        INTEGER NOT NULL,
  last_activity_at  INTEGER NOT NULL,
  confirmed_at      INTEGER,
  resolved_at       INTEGER,                -- residents said it's fixed
  closed_at         INTEGER,                -- the team closed it
  closed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX reports_by_activity ON reports(last_activity_at);
CREATE INDEX reports_by_place ON reports(area, service, problem);

-- "Me too" and "Fine here" taps. One per device per report.
CREATE TABLE votes (
  report_id   TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device      TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('metoo', 'fine')),
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (report_id, device)
);

-- Photos on reports. Nobody else sees one until the team approves it.
CREATE TABLE photos (
  id           TEXT PRIMARY KEY,
  report_id    TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file         TEXT NOT NULL,
  bytes        INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  uploaded_by  TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at  INTEGER
);
CREATE INDEX photos_by_report ON photos(report_id);

-- Planned cuts announced by a team.
CREATE TABLE notices (
  id           TEXT PRIMARY KEY,
  service      TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  areas        TEXT NOT NULL,              -- JSON list of slugs, or ["all"]
  starts_at    INTEGER NOT NULL,
  ends_at      INTEGER NOT NULL,
  reason       TEXT,                       -- JSON { en, ckb, kmr, ar }
  source       TEXT,                       -- JSON { any } or per language
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  alerted_at   INTEGER                     -- when push alerts went out
);
CREATE INDEX notices_by_end ON notices(ends_at);

-- Headlines a team adds for the Runaki page and the assistant.
CREATE TABLE news (
  id          TEXT PRIMARY KEY,
  service     TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  date        TEXT NOT NULL,               -- YYYY-MM-DD
  outlet      TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  title       TEXT NOT NULL,
  summary     TEXT,                        -- JSON per language
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Private requests: one house or a few. These hold a name and phone
-- number, so only the matching team sees them and they're deleted 30 days
-- after they're finished.
CREATE TABLE requests (
  id                 TEXT PRIMARY KEY,
  ref                TEXT NOT NULL UNIQUE,
  service            TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  area               TEXT NOT NULL,
  problem            TEXT NOT NULL,
  scope              TEXT NOT NULL CHECK (scope IN ('home', 'few')),
  name               TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL,
  place              TEXT NOT NULL DEFAULT '',
  preferred_time     TEXT NOT NULL DEFAULT 'any',
  contact_via        TEXT NOT NULL DEFAULT 'whatsapp',
  note               TEXT NOT NULL DEFAULT '',
  lang               TEXT NOT NULL DEFAULT 'en',
  status             TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'contacted', 'scheduled', 'done', 'cancelled')),
  visit_at           INTEGER,
  assigned_to        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  device             TEXT NOT NULL,
  ip_hash            TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  first_response_at  INTEGER,
  closed_at          INTEGER
);
CREATE INDEX requests_by_status ON requests(service, status);

CREATE TABLE request_notes (
  id          INTEGER PRIMARY KEY,
  request_id  TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Phones that asked for alerts about their neighbourhood.
CREATE TABLE push_subscriptions (
  endpoint      TEXT PRIMARY KEY,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  areas         TEXT NOT NULL,             -- JSON list of slugs
  services      TEXT NOT NULL,             -- JSON list: electricity, water
  lang          TEXT NOT NULL DEFAULT 'en',
  created_at    INTEGER NOT NULL,
  last_sent_at  INTEGER,
  failures      INTEGER NOT NULL DEFAULT 0
);

-- Remembers which alerts went out, so a busy evening doesn't send the same
-- "no power in Ankawa" ten times.
CREATE TABLE alerts_sent (
  key      TEXT PRIMARY KEY,
  sent_at  INTEGER NOT NULL
);

-- Everything the teams do, with who did it.
CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY,
  at           INTEGER NOT NULL,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username     TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  service      TEXT,
  detail       TEXT                        -- JSON
);
CREATE INDEX audit_by_time ON audit_log(at);

-- Rate limits: one row per counted action, pruned every hour.
CREATE TABLE rate_events (
  bucket  TEXT NOT NULL,
  who     TEXT NOT NULL,
  at      INTEGER NOT NULL,
  extra   TEXT
);
CREATE INDEX rate_events_lookup ON rate_events(bucket, who, at);
