-- Neighbourhood generators: the private ones people still pay for by the
-- ampere, and the ones kept as backup where Runaki has arrived. Public:
-- everything except key_hash. The owner's phone is the business's own number,
-- shown only when the team has the owner's agreement to show it.
CREATE TABLE generators (
  id          TEXT PRIMARY KEY,
  area        TEXT NOT NULL,
  name        TEXT NOT NULL,              -- what people call it: "Abu Karwan's generator", "Street 40 generator"
  owner       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  covers      TEXT NOT NULL DEFAULT '',   -- which streets or blocks it feeds, in the owner's words
  kind        TEXT NOT NULL DEFAULT 'neighbourhood' CHECK (kind IN ('neighbourhood', 'compound', 'backup')),
  status      TEXT NOT NULL DEFAULT 'off' CHECK (status IN ('running', 'standby', 'off', 'removed')),
  hours       TEXT NOT NULL DEFAULT '[]', -- today's hours, JSON: [{"from":"16:00","to":"01:00"}]
  price       INTEGER,                    -- dinars per ampere this month, if the owner says
  note        TEXT NOT NULL DEFAULT '',   -- a short message from the owner: "Running until the grid is back"
  key_hash    TEXT,                       -- SHA-256 of the owner's private update link
  updated_at  INTEGER NOT NULL,
  updated_via TEXT NOT NULL DEFAULT 'team' CHECK (updated_via IN ('team', 'owner')),
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX generators_area ON generators (area);
CREATE UNIQUE INDEX generators_key ON generators (key_hash) WHERE key_hash IS NOT NULL;

-- The price per ampere and the planned hours the governorate's
-- private-generator committee announces each month. One row per city and month.
CREATE TABLE generator_prices (
  city        TEXT NOT NULL,
  month       TEXT NOT NULL,              -- "2026-10"
  price       INTEGER NOT NULL,           -- dinars per ampere
  hours       INTEGER,                    -- hours of supply the price is for, if announced
  source      TEXT NOT NULL DEFAULT '',   -- where it was announced (a link, or "Erbil governorate, 2 October")
  set_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  set_at      INTEGER NOT NULL,
  PRIMARY KEY (city, month)
);
