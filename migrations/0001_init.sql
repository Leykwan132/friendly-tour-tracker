CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  played_at TEXT NOT NULL,
  winner_side TEXT NOT NULL CHECK (winner_side IN ('radiant', 'dire')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE match_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('radiant', 'dire')),
  hero TEXT NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  UNIQUE(match_id, player_id)
);

CREATE INDEX idx_participants_match ON match_participants(match_id);
CREATE INDEX idx_participants_player ON match_participants(player_id);
CREATE INDEX idx_matches_played_at ON matches(played_at DESC);
