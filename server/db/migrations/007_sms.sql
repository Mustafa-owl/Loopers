-- Alerts by text message or WhatsApp, for phones without push notifications.
-- A number is only used after its owner typed the code we sent to it.
CREATE TABLE sms_subscriptions (
  id            INTEGER PRIMARY KEY,
  phone         TEXT NOT NULL UNIQUE,        -- 07xxxxxxxxx
  channel       TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms', 'whatsapp')),
  areas         TEXT NOT NULL,               -- JSON list of slugs
  services      TEXT NOT NULL,               -- JSON list: electricity, water
  pending_areas    TEXT,                     -- what they asked for, applied once the code is right
  pending_services TEXT,
  lang          TEXT NOT NULL DEFAULT 'en',
  code_hash     TEXT,                        -- the 6 digits, hashed, until confirmed
  code_expires  INTEGER,
  code_tries    INTEGER NOT NULL DEFAULT 0,
  verified_at   INTEGER,
  stop_key      TEXT NOT NULL UNIQUE,        -- for the stop link in every message
  created_at    INTEGER NOT NULL,
  last_sent_at  INTEGER,
  failures      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sms_sent (                      -- how many went to each number today (cost and spam cap)
  phone  TEXT NOT NULL,
  at     INTEGER NOT NULL,
  kind   TEXT NOT NULL
);
CREATE INDEX sms_sent_by_phone ON sms_sent (phone, at);
