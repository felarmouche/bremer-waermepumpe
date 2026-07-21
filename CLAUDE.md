# bremer-waermepumpe.de

Astro-Site auf Cloudflare Workers. Flache URLs, Hub/Spoke-Struktur — **keine URL-Änderungen, keine Konsolidierungen** (SEO-Entscheidung, siehe unten).

## Lead-Dashboard (`/dashboard`)

Interne Lead-Verwaltung, **nicht verlinkt und nicht indexiert** (noindex-Meta + `X-Robots-Tag`, aus der Sitemap gefiltert in `astro.config.mjs`). Bewusst **nicht** in `robots.txt` eingetragen: das ist öffentlich lesbar und würde den Pfad verraten — und ein `Disallow` verhindert, dass Google das `noindex` überhaupt sieht.

- Login: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (PBKDF2-SHA256, Format `pbkdf2:<iter>:<salt-hex>:<hash-hex>`), Hash erzeugen mit `node scripts/hash-admin-password.mjs`.
- Sessions: 32-Byte-Token in KV (`admin:sess:*`), 7 Tage, Cookie `__Host-bwp_admin` (HttpOnly/Secure/SameSite=Strict). Logout löscht die Session serverseitig.
- Schutz: Rate-Limit 5 Logins/15 min pro IP (bei Erfolg zurückgesetzt) + 30/h global, Origin-Check gegen CSRF, strenge CSP.
- Bearbeitungsstatus (`crm_status`) liegt getrennt vom Funnel-`status` in `leads` — Werte in `CRM_STATUSES` (`src/lib/leads.ts`), Änderung nur über `/api/admin/lead-update`.
- Die Admin-Mail bei neuen Leads enthält einen Deep-Link `/dashboard?lead=<Referenz>`; das Dashboard filtert und öffnet den Lead automatisch.

**DSGVO-Aktionen im Dashboard** (Logik folgt der Datenschutzerklärung, Ziff. 5/5a/11 — bei Änderungen dort auch hier nachziehen):
- `/api/admin/lead-revoke` — Widerruf erfassen (formfrei eingegangene Widerrufe); sperrt sofort, sendet Partner-Info-Mail, wenn die Lead-Mail schon raus war.
- `/api/admin/lead-delete` — zwei Modi: `anonymize` (Regelfall Art. 17: leert alle PII in `leads` inkl. `sms_phone_verified`, setzt `status='deleted'`; `lead_consents`/`sms_verifications` bleiben 5 Jahre als Nachweis, § 7a Abs. 2 UWG) und `full` (restlos inkl. Nachweise — serverseitig gesperrt für Leads mit `sms_verified_at`).
- `/api/admin/lead-data?id=` — vollständiger Text-Datenauszug als Grundlage für Art.-15-Auskünfte.
- Widerrufene/unverifizierte Leads: kein Anruf-Button, Kategorie „Achtung", nie „Aktiv". Der ausklappbare DSGVO-Leitfaden in der Seite fasst die Betreiber-Pflichten zusammen.

Schema-Änderungen additiv als datierte Migration in `scripts/` (`d1-schema.sql` ist die Referenz mit `DROP TABLE` — **niemals `--remote` ausführen**).

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

## Keyword-Eigentum (gegen Kannibalisierung)

Belegt durch DataForSEO 2026-07-21: das **lokale Bremen-Keyworduniversum umfasst nur ~400 Suchen/Monat** über sechs Keywords (`wärmepumpe bremen` 260, `förderung wärmepumpe bremen` 70, `bremen förderung wärmepumpe` 30, `wärmepumpe abstand nachbar bremen` 20, `wärmepumpe in bremen` 10, `bremen wärmepumpe` 10). `wärmepumpe kosten bremen` hat **null** Volumen. Deshalb gilt:

**Der Bremen-Bezug in Title, H1, H2 und FAQ-Fragen gehört ausschliesslich diesen Seiten:**

| Seite | Primärkeyword | Vol./Mon |
|---|---|---|
| `/` | wärmepumpe bremen | 260 |
| `/waermepumpe-foerderung-bremen/` | förderung wärmepumpe bremen | 100 |
| `/waermepumpe-abstand-nachbar-bremen/` | wärmepumpe abstand nachbar bremen | 20 |
| `/waermepumpe-kosten-bremen/` | swb wärmepumpentarif (lokal, kein „kosten bremen") | – |
| `/bab-heizungstausch-bremen/` | bab heizungstausch (Programmname) | 40 |

**Alle übrigen Seiten sind de-lokalisiert** und zielen auf das bundesweite Volumen, wo die Nachfrage tatsächlich liegt: `/waermepumpe-foerderung-2026/` → förderung wärmepumpe 2026 (9.900) · `/kfw-458-waermepumpe/` → kfw 458 (8.100) · `/bafa-foerderung-waermepumpe/` → bafa förderung wärmepumpe (2.400) · `/luft-wasser-waermepumpe-kosten/` → luft wasser wärmepumpe kosten (1.300) · `/waermepumpe-altbau-kosten/` → was kostet eine wärmepumpe für altbau (480).

Konkret heisst das beim Bearbeiten einer Seite:
- **Keine H2 und keine FAQ-Frage darf das Primärkeyword einer anderen Seite wörtlich enthalten.** Das war die Hauptursache der Kannibalisierung (Startseite trug „Wärmepumpe Förderung Bremen" als H2, `/waermepumpe-kosten-bremen/` die FAQ „Wie viel Förderung gibt es für eine Wärmepumpe in Bremen?").
- Fremde Themen nur anreissen (2–3 Sätze) und mit dem Ankertext **„Wärmepumpe Förderung Bremen"** bzw. dem Titel der Zielseite verlinken, statt sie erneut auszubreiten.
- `/check/` und `/kontakt/` sind Funnel- und Vertrauensseiten: sie sollen für **keine** inhaltliche Query ranken.
