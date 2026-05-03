CREATE TABLE IF NOT EXISTS check_eintraege (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  gebaeudetyp TEXT,
  baujahr TEXT,
  flaeche TEXT,
  heizung TEXT,
  heizungsalter TEXT,
  waermeabgabe TEXT,
  daemmung TEXT,
  eigentum TEXT,
  einkommen TEXT,
  antrag TEXT,
  eignung_level TEXT,
  foerder_level TEXT,
  foerder_summe INTEGER
);

CREATE INDEX IF NOT EXISTS idx_check_eintraege_created_at
  ON check_eintraege (created_at DESC);
