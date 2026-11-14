-- "A crew is working on it": set by the team on an open report, so residents
-- can see someone is on it, and followers get one alert when it's set.
ALTER TABLE reports ADD COLUMN fixing_at INTEGER;
ALTER TABLE reports ADD COLUMN fixing_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
