-- Migration 2026-05-24: Funnel-Felder + email nullable + Adress-Felder
DROP TABLE IF EXISTS lead_partners_notified;
DROP TABLE IF EXISTS lead_admin_notified;
DROP TABLE IF EXISTS lead_consents;
DROP TABLE IF EXISTS revocations;
DROP TABLE IF EXISTS sms_verifications;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS check_eintraege;

CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  salutation TEXT NOT NULL,
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT NOT NULL,
  telefon_raw TEXT NOT NULL,

  strasse TEXT NOT NULL,
  hausnummer TEXT NOT NULL,
  plz TEXT NOT NULL,
  ort TEXT NOT NULL,

  heating_current TEXT,
  heating_age TEXT,
  building_type TEXT,
  is_owner INTEGER,
  heating_location TEXT,
  timeline TEXT,

  sms_verified_at TEXT,
  sms_phone_verified TEXT,

  admin_email_sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'sms_pending',
  revoked_at TEXT
);

CREATE TABLE sms_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  phone_e164 TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  brevo_message_id TEXT,
  superseded_at TEXT
);

CREATE TABLE lead_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  consent_version TEXT NOT NULL,
  consent_text TEXT NOT NULL,
  consent_timestamp TEXT NOT NULL,
  consent_ip TEXT NOT NULL,
  consent_user_agent TEXT,
  partners_version TEXT NOT NULL,
  partners_snapshot TEXT NOT NULL,
  sms_verification_id INTEGER REFERENCES sms_verifications(id)
);

CREATE TABLE lead_admin_notified (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  admin_email TEXT NOT NULL,
  notified_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_message_id TEXT,
  send_status TEXT NOT NULL
);

CREATE TABLE revocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  revoked_at TEXT NOT NULL DEFAULT (datetime('now')),
  revocation_channel TEXT,
  revocation_ip TEXT,
  revocation_token TEXT,
  notes TEXT
);

CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_telefon ON leads(telefon);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_consents_lead_id ON lead_consents(lead_id);
CREATE INDEX idx_revocations_token ON revocations(revocation_token);
CREATE INDEX idx_sms_lead_id ON sms_verifications(lead_id);
CREATE INDEX idx_sms_phone ON sms_verifications(phone_e164);
CREATE INDEX idx_admin_notified_lead_id ON lead_admin_notified(lead_id);
