-- Migration 2026-07-16: CRM-Felder für das Lead-Dashboard (/dashboard).
-- Additiv — keine bestehenden Daten betroffen.
-- Lokal:  wrangler d1 execute anonymous-leads --local  --file scripts/d1-migration-2026-07-16-crm.sql
-- Remote: wrangler d1 execute anonymous-leads --remote --file scripts/d1-migration-2026-07-16-crm.sql

ALTER TABLE leads ADD COLUMN crm_status TEXT NOT NULL DEFAULT 'neu';
ALTER TABLE leads ADD COLUMN crm_notes TEXT;
ALTER TABLE leads ADD COLUMN crm_updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_crm_status ON leads(crm_status);
