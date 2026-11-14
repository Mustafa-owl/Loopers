-- The scrambled internet address behind each "Me too", like the one already
-- kept on the report itself. The team sees how many different addresses the
-- people on a report came from. Deleted with the vote after 7 days.
ALTER TABLE votes ADD COLUMN ip_hash TEXT;
