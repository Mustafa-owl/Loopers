-- The Runaki account or meter number from the bill, so a team can find the
-- right house and check its account. Optional; seen by that team only and
-- deleted with the request.
ALTER TABLE requests ADD COLUMN meter TEXT NOT NULL DEFAULT '';
