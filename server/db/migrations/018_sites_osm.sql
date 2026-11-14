-- Utility sites brought in from OpenStreetMap keep their OSM id
-- ("node/123", "way/456"), so bringing them in again never adds twice.
ALTER TABLE sites ADD COLUMN osm TEXT;
CREATE UNIQUE INDEX sites_osm ON sites (osm) WHERE osm IS NOT NULL;
