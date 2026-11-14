-- News found automatically on news sites, waiting for the team to publish
-- or dismiss it. The sources are a list the admin can change, because
-- sites move their pages around.

CREATE TABLE news_sources (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  url              TEXT NOT NULL UNIQUE,
  kind             TEXT NOT NULL CHECK (kind IN ('feed', 'page')),
  link_pattern     TEXT,                 -- for a page: what an article link looks like (a regular expression)
  trusted          INTEGER NOT NULL DEFAULT 0,  -- an official source: the topic alone is enough
  active           INTEGER NOT NULL DEFAULT 1,
  last_checked_at  INTEGER,
  last_ok_at       INTEGER,
  last_error       TEXT,
  found_total      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE news_suggestions (
  id           INTEGER PRIMARY KEY,
  source_id    INTEGER REFERENCES news_sources(id) ON DELETE SET NULL,
  outlet       TEXT NOT NULL,
  url          TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  summary      TEXT,
  lang         TEXT,
  published    TEXT,                    -- YYYY-MM-DD
  service      TEXT CHECK (service IN ('electricity', 'water')),
  score        INTEGER NOT NULL,
  why          TEXT,                    -- the words that matched, for the team to see
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'published', 'dismissed')),
  found_at     INTEGER NOT NULL,
  decided_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  decided_at   INTEGER,
  news_id      TEXT
);
CREATE INDEX news_suggestions_status ON news_suggestions (status, found_at);

INSERT INTO news_sources (name, url, kind, link_pattern, trusted) VALUES
  ('Rudaw', 'https://www.rudaw.net/english/kurdistan', 'page', '^https://www\.rudaw\.net/english/kurdistan/\d+', 0),
  ('Kurdistan24', 'https://www.kurdistan24.net/en/rss', 'page', '^https://www\.kurdistan24\.net/en/story/\d+', 0),
  ('Shafaq News', 'https://shafaq.com/en/Kurdistan', 'page', '^https://shafaq\.com/en/Kurdistan/.+', 0),
  ('964media', 'https://en.964media.com/', 'page', '^https://en\.964media\.com/\d+/?$', 0),
  ('KRG Ministry of Electricity', 'https://gov.krd/moel-en/activities/categories/news/', 'page', '^https://gov\.krd/moel-en/activities/news-and-press-releases/\d{4}/.+', 1),
  ('Runaki', 'https://runaki.gov.krd/en/resources/', 'page', '^https://runaki\.gov\.krd/en/resources/.+', 1);
