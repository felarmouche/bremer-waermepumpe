# bremer-waermepumpe.de

Astro-Site auf Cloudflare Workers. Flache URLs, Hub/Spoke-Struktur — **keine URL-Änderungen, keine Konsolidierungen** (SEO-Entscheidung, siehe unten).

## SEO-Workflow (GSC + DataForSEO)

Datenbasis liegt in `seo-data/` (gitignored — Repo ist öffentlich!). Einstiegspunkt für jede SEO-Session ist **`seo-data/REPORT.md`** — erst lesen, dann handeln. Rohdaten (`seo-data/gsc/`, `seo-data/dfs/`, datierte Snapshots) nur bei Bedarf nachschlagen.

| Befehl | Zweck | Kadenz |
|---|---|---|
| `npm run seo:sync` | GSC-Snapshot + Report neu bauen (kostenlos) | wöchentlich |
| `npm run seo:dfs` | DataForSEO ranked_keywords eigene Domain (Cents) | monatlich |
| `npm run seo:dfs -- competitors` | Wettbewerber-Domains | monatlich |
| `npm run seo:dfs -- ranked <domain>` | Wettbewerber-Keywords für Gap-Analyse | bei Bedarf |
| `npm run seo:dfs -- serp "kw1, kw2"` | Live-SERP-Check einzelner Keywords | bei Bedarf |
| `npm run seo:inspect -- <url>` | Indexierungsstatus einzelner URLs | bei Bedarf |

DataForSEO-Kosten werden je Call geloggt (`seo-data/dfs-costs.log`) und im Report ausgewiesen.

**Regeln:**
- **Eine Maßnahme pro Seite pro Zyklus**, Umsetzung über das Skill `/optimize-bremer-waermepumpe-seo`. Wirkung erst nach 2–4 Wochen bewerten (GSC-Snapshots sind datiert, Vorher/Nachher-Vergleich steckt im Report).
- Der Report liefert Kandidaten; Art des Eingriffs folgt dem Befund: CTR-Lücke → Title/Description, Striking Distance → Inhalt erweitern, Keyword-Gap → neuer Spoke, Decay → Inhalt aktualisieren.
- Generische Cost-Spokes bleiben de-lokalisiert; lokale Seiten tragen den Bremen-Bezug.

**Credentials (nie committen):** `.secrets/gsc-service-account.json` (GSC, Service Account) und `.env.local` (`DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD`). Beides ist gitignored.
