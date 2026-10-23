# Dashboard und Datenschutz

Bei Änderungen an Dashboard, Lead-Verarbeitung oder Datenschutz lesen.


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
