-- Migration 2026-10-31: Herkunfts-Website je Lead (gemeinsame DB für bremer- und
-- duesseldorfer-waermepumpe.de). Additiv: bestehende Leads erhalten über den DEFAULT
-- automatisch 'bremen', ebenso Inserts aus noch nicht aktualisiertem Bremer Code.
--
-- REIHENFOLGE: zuerst diese Migration, DANACH den Code mit origin_site-Filter deployen.
-- Umgekehrt scheitern alle Lead-Abfragen mit "no such column: origin_site".
--
-- Vorher sichern:  npm run db:backup   (bzw. bash scripts/backup-d1.sh)
-- Lokal:  npx wrangler d1 execute anonymous-leads --local  --file scripts/d1-migration-2026-10-31-origin-site.sql
-- Remote: npx wrangler d1 execute anonymous-leads --remote --file scripts/d1-migration-2026-10-31-origin-site.sql
-- Prüfen: npx wrangler d1 execute anonymous-leads --remote --command "SELECT origin_site, COUNT(*) FROM leads GROUP BY origin_site"

ALTER TABLE leads ADD COLUMN origin_site TEXT NOT NULL DEFAULT 'bremen';
CREATE INDEX IF NOT EXISTS idx_leads_origin_site ON leads(origin_site, id DESC);
