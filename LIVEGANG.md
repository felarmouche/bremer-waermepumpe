# Livegang-Checkliste — bremer-waermepumpe.de

Verbindliches Arbeitsdokument für den Produktivgang. Reihenfolge: **erst Blocker abarbeiten, dann deployen, dann Smoke-Tests, dann DSGVO, dann Stabilisierung**.

Legende: 🔴 Blocker · 🟠 vor Livegang · 🟡 binnen 30 Tagen

---

## 1. Blocker — vor Deploy zwingend 🔴

- [ ] **Cloudflare Secret** `wrangler secret put SMS_PEPPER` — 32-byte hex (`openssl rand -hex 32`)
- [ ] **Cloudflare Secret** `wrangler secret put BREVO_API_KEY`
- [ ] **Lokal**: `.dev.vars` aus `.dev.vars.example` kopieren und `BREVO_API_KEY` eintragen (sonst keine E-Mails/SMS in `astro dev` / `wrangler dev`)
- [ ] **Brevo SMS aktiv** — Sender-ID `BremerWP` registriert (DE-Pflicht), Guthaben aufgeladen
- [ ] **Brevo E-Mail Auth** — SPF/DKIM für Absender-Domain geprüft; ggf. eigene Domain statt `bremerwaermepumpe@web.de` (Free-Mail-Header-From ist Spam-anfällig)
- [ ] **DNS & HTTPS** — `bremer-waermepumpe.de` zeigt auf Cloudflare Pages, Zertifikat aktiv, `WEBOTP_HOST` = exakt diese Domain
- [ ] **Lead → Fritz Group Prozess dokumentiert** — Kein Code-Pfad sendet Lead-Daten an den Partner. Klären: bekommt Fritz Group den Lead aus der Admin-Mail manuell? SLA für Erstkontakt? AVV (DSGVO-Auftragsverarbeitungsvertrag) unterzeichnet?

---

## 2. Smoke-Tests nach Deploy — manuell durchspielen 🟠

### Funnel-Glücksfall
- [ ] [/check](https://bremer-waermepumpe.de/check) Step 1–9 durchlaufen mit eigener SIM
- [ ] SMS empfangen — auf iPhone: WebOTP-Auto-Fill funktioniert (Domain muss exakt passen)
- [ ] SMS empfangen — auf Android Chrome: Auto-Fill funktioniert
- [ ] Code eingeben → Success-Screen mit Referenz `BWP-2026-XXXXX`
- [ ] Admin-Mail kommt an `ferris.e@gmx.de` und `bremerwaermepumpen@web.de` mit allen Funnel-Antworten

### DB-Verifikation (`wrangler d1 execute anonymous-leads --remote --command "SELECT ..."`)
- [ ] `leads`: Zeile vorhanden, `status='verified'`, `sms_verified_at` gesetzt
- [ ] `lead_consents`: Zeile mit `consent_version='consent-v5-2026-05-29'`, vollem `consent_text`, IP, UA, Partner-Snapshot
- [ ] `sms_verifications`: `verified_at` gesetzt, `brevo_message_id` vorhanden
- [ ] `lead_admin_notified`: Zeile pro Admin-Empfänger mit `send_status='sent'`

### Fehlerfälle
- [ ] Code falsch → „Falscher Code"; nach 6 Fehlversuchen → 429/Sperre
- [ ] 4. Anfrage gleicher Telefonnummer in 24h → 429 mit Hinweis
- [ ] PLZ außerhalb 27xxx/28xxx → 400
- [ ] Step 4 = „Mieter" → Disqualified-Screen, **kein DB-Eintrag**
- [ ] Honeypot-Feld `website` per DevTools setzen + submitten → 204, **kein DB-Eintrag**
- [ ] Veraltete Consent-Version simulieren → 400 mit Reload-Hinweis

### Widerruf — beide Pfade
- [ ] Widerruf via Referenznummer auf [/widerruf](https://bremer-waermepumpe.de/widerruf) → `leads.revoked_at` gesetzt, Admin-Widerruf-Mail kommt an
- [ ] Widerruf via Telefon-SMS-Pfad → revoked + Mail

---

## 3. DSGVO-Verifikation 🟠

- [ ] `lead_consents.consent_text` enthält **vollen** v5-Wortlaut (nicht nur Version-String) — stichprobenartig in D1 prüfen
- [ ] `partners_snapshot` enthält JSON der zum Zeitpunkt gültigen Partner — Beweislast für „wem haben wir's gegeben"
- [ ] [src/pages/datenschutz.astro](src/pages/datenschutz.astro): konkrete **Speicherdauer** + **Drittländer-Hinweis** (Cloudflare-Edges außerhalb EU) explizit benannt
- [ ] **Auskunfts-Workflow Art. 15–21 DSGVO**: Eingangs-Mailbox + Verantwortlicher + 30-Tage-SLA dokumentiert (z. B. in [src/pages/datenschutz.astro](src/pages/datenschutz.astro))
- [ ] **„unabhängiger Ratgeber"-Wording** auf Startseite gegenchecken — Lead-Vermittlung an Fritz Group widerspricht „unabhängig". Wording entschärfen oder Vermittlungs-Status transparent ausweisen.
- [ ] **Notfall-Plan dokumentiert**: bei Datenpanne Meldung an LfDI Bremen binnen 72h, Liste betroffener Refs aus D1 ziehbar

---

## 4. Stabilisierung — binnen 30 Tage nach Livegang 🟡

### Backup & Recovery
- [ ] [scripts/backup-d1.sh](scripts/backup-d1.sh) als **wöchentliche GitHub Action** statt manuell
- [ ] Backup-Ziel: **Off-Site-Storage außerhalb Cloudflare** (z. B. Backblaze B2 / S3 mit Versionierung), niemals ins Git-Repo
- [ ] **Restore-Test einmalig durchgespielt** — Dump in lokale D1 importieren, Zeilenzahl matched
- [ ] Brevo-Logs-Backup ([scripts/backup-brevo-logs.sh](scripts/backup-brevo-logs.sh)) ebenfalls cron-isiert

### Retention / Cleanup
- [ ] **Cleanup-Cron**: unverifizierte Leads (`status='sms_pending'`) älter als 7 Tage → DELETE (Cloudflare Worker Cron Trigger oder GitHub Action)
- [ ] **Retention-Cron**: PII anonymisieren nach gesetzlicher Frist (Default 3 Jahre §195 BGB; 5 Jahre §7a UWG nur wenn Werbe-Einwilligung als Anspruchsabwehr nötig) — Spalten `vorname`, `nachname`, `telefon*`, `strasse`, `hausnummer` auf NULL, `lead_consents.consent_text` behalten
- [ ] **KV-Sessions**: Cloudflare KV hat eigenes TTL — prüfen ob alle `kv.put`-Calls TTL setzen (gelogt in `start.ts`/`widerruf.ts` bereits OK)

### Monitoring & Alerts
- [ ] Cloudflare Observability: Alert auf **5xx-Spike** und Worker-Errors → Mail an Betreiber
- [ ] Alert auf **gehäufte `status='failed'`** in `leads` (Brevo-Ausfall-Indikator)
- [ ] Brevo-Guthaben-Schwellwert-Warnung (SMS-Pumping-Schutz)
- [ ] Wer überwacht die Admin-Mail-Inbox? → Reaktions-SLA pro Lead schriftlich festhalten

### Security-Härtung
- [ ] **Rate-Limit für Referenz-Widerruf** — [src/pages/api/widerruf.ts:261-286](src/pages/api/widerruf.ts#L261-L286): Mode 3 hat kein Rate-Limit, Brute-Force auf `BWP-YYYY-XXXXX` möglich
- [ ] **Origin-Header-Validation** in allen POST-API-Endpoints ([src/pages/api/lead/*](src/pages/api/lead/), [src/pages/api/widerruf.ts](src/pages/api/widerruf.ts))
- [ ] Optional: **Cloudflare Turnstile** vor Funnel-Submit als zweite Bot-Schicht (Honeypot ist Mindestschutz)

---

## Kritische Dateien — Schnellzugriff

| Datei | Zweck |
|---|---|
| [src/data/partners.ts](src/data/partners.ts) | Partner-Stammdaten + Versionierung |
| [src/pages/api/lead/start.ts](src/pages/api/lead/start.ts) | Lead-Erfassung + Rate-Limits |
| [src/pages/api/lead/verify.ts](src/pages/api/lead/verify.ts) | SMS-Code-Verifikation + Admin-Mail |
| [src/pages/api/widerruf.ts](src/pages/api/widerruf.ts) | 3-Modi-Widerruf |
| [src/lib/consent.ts](src/lib/consent.ts) | Consent-Text-Versionen |
| [src/lib/leads.ts](src/lib/leads.ts) | D1-Queries |
| [src/lib/sms.ts](src/lib/sms.ts) / [src/lib/email.ts](src/lib/email.ts) | Brevo-Integration |
| [wrangler.jsonc](wrangler.jsonc) | Bindings + ENV-Vars + Secret-Liste |
| [scripts/d1-schema.sql](scripts/d1-schema.sql) | Schema (Migration) |
| [scripts/backup-d1.sh](scripts/backup-d1.sh) | Backup-Script (manuell) |
