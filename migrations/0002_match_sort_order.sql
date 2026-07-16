ALTER TABLE matches ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE matches_order_tmp AS
SELECT id, ROW_NUMBER() OVER (ORDER BY played_at DESC, id DESC) AS sort_order
FROM matches;

UPDATE matches
SET sort_order = (
  SELECT sort_order FROM matches_order_tmp WHERE matches_order_tmp.id = matches.id
);

DROP TABLE matches_order_tmp;

CREATE INDEX idx_matches_sort_order ON matches(sort_order ASC);
