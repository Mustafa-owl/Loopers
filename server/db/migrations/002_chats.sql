-- Live chats between a resident and their service's team. The assistant
-- offers one when something is dangerous, has gone on for days, or the
-- person is stuck. The resident's browser holds a random key in a cookie;
-- we keep only its hash, the same way as team sessions.

CREATE TABLE chats (
  id                 INTEGER PRIMARY KEY,
  ref                TEXT NOT NULL UNIQUE,
  key_hash           TEXT NOT NULL UNIQUE,
  service            TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  area               TEXT,
  reason             TEXT NOT NULL CHECK (reason IN ('danger', 'long', 'stuck', 'asked')),
  lang               TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'open', 'closed')),
  assigned_to        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  device_hash        TEXT,
  ip_hash            TEXT,
  created_at         INTEGER NOT NULL,
  last_message_at    INTEGER NOT NULL,
  first_response_at  INTEGER,
  team_seen_at       INTEGER,
  closed_at          INTEGER,
  closed_by          TEXT                 -- 'resident', 'team' or 'idle'
);
CREATE INDEX chats_service_status ON chats (service, status, last_message_at);

CREATE TABLE chat_messages (
  id        INTEGER PRIMARY KEY,
  chat_id   INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  at        INTEGER NOT NULL,
  sender    TEXT NOT NULL CHECK (sender IN ('resident', 'team', 'note')),
  user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body      TEXT NOT NULL
);
CREATE INDEX chat_messages_chat ON chat_messages (chat_id, id);
