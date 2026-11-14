-- Where things are, more exactly than the neighbourhood.
--
-- A resident who taps "Use my location" can let the team see the spot they
-- reported from. One row per person and report (reports from neighbours
-- merge into one), only the team sees it, and it's deleted after 7 days
-- with everything else that links a report to a phone.
CREATE TABLE report_spots (
  report_id TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  device    TEXT NOT NULL,
  lat       REAL NOT NULL,
  lng       REAL NOT NULL,
  accuracy  INTEGER,            -- metres, as the phone said
  at        INTEGER NOT NULL,
  PRIMARY KEY (report_id, device)
);

-- A generator's own spot: set by the owner standing next to it, or by the team.
ALTER TABLE generators ADD COLUMN lat REAL;
ALTER TABLE generators ADD COLUMN lng REAL;
