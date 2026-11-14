-- "Important messages": the admins' pop-ups sent to phones. Everyone who
-- already gets alerts gets them too; a phone can also sign up for these
-- alone, without following a neighbourhood.
ALTER TABLE push_subscriptions ADD COLUMN general INTEGER NOT NULL DEFAULT 1;
