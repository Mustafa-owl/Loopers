-- The outage desk: a number people can say on the phone (OUT-1142), the
-- crew sent, when they expect power or water back (shown to residents
-- too), and what caused it.
ALTER TABLE reports ADD COLUMN no INTEGER;
UPDATE reports SET no = rowid;
CREATE UNIQUE INDEX reports_no ON reports (no);
ALTER TABLE reports ADD COLUMN crew TEXT;
ALTER TABLE reports ADD COLUMN etr_at INTEGER;
ALTER TABLE reports ADD COLUMN cause TEXT;
