-- A headline can be shown in the reader's language: the original title stays
-- in `title` (in `lang`), and `heads` holds the same headline in the other
-- languages as JSON, e.g. {"ckb": "…", "ar": "…"}.
ALTER TABLE news ADD COLUMN lang TEXT NOT NULL DEFAULT 'en';
ALTER TABLE news ADD COLUMN heads TEXT;
