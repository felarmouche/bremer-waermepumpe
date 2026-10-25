-- Migration 2026-10-25: Herkunftsseite des Checks für die Auswertung im Dashboard.
-- Additiv — keine bestehenden Daten betroffen. Bestehende Leads bleiben NULL.
-- Lokal:  wrangler d1 execute anonymous-leads --local  --file scripts/d1-migration-2026-10-25-source-page.sql
-- Remote: wrangler d1 execute anonymous-leads --remote --file scripts/d1-migration-2026-10-25-source-page.sql

ALTER TABLE leads ADD COLUMN source_page TEXT;
