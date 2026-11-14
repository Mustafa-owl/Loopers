-- Neighbours saying whether a generator is actually on at their place.
-- One row per phone and generator (tapping again changes or takes it back);
-- `ip_hash` so several phone codes from one address count once. Rows older
-- than a day are deleted in housekeeping.
CREATE TABLE generator_checks (
  generator_id TEXT NOT NULL REFERENCES generators(id) ON DELETE CASCADE,
  device       TEXT NOT NULL,
  ip_hash      TEXT,
  said         TEXT NOT NULL CHECK (said IN ('on', 'off')),
  at           INTEGER NOT NULL,
  PRIMARY KEY (generator_id, device)
);
CREATE INDEX generator_checks_recent ON generator_checks (generator_id, at);

-- When the generator's status last changed: neighbours' taps before that
-- were about the old state, so they stop counting.
ALTER TABLE generators ADD COLUMN status_at INTEGER;
UPDATE generators SET status_at = updated_at;
