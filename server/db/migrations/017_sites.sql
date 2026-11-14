-- The utilities' own places, added by the team: substations, water plants,
-- pumping stations, reservoirs and offices. Shown on the maps.
CREATE TABLE sites (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('substation', 'plant', 'pumping', 'reservoir', 'office')),
  service     TEXT NOT NULL CHECK (service IN ('electricity', 'water')),
  name        TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
