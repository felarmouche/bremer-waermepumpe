## To Verify

> **Arbeitsdokument für den Livegang:** [LIVEGANG.md](LIVEGANG.md) — dort stehen die konkreten Action-Items, dieses Dokument bleibt als Audit-Spur der ursprünglichen Fragestellung.
>
> Legende: ✓ erfüllt · ⚠️ Lücke vor Livegang · ❌ Blocker

- Datenbank:
    - Werden Daten gespeichert? ✓ (`leads`, `lead_consents`, `sms_verifications`, `lead_admin_notified`, `revocations`)
    - Werden Daten DSGVO konform gespeichert (Speicherdauer, Löschkonzept) ⚠️ — kein Cleanup-/Retention-Job, `revoked_at` setzt nur Marker
    - Backup klappen? ⚠️ — [scripts/backup-d1.sh](scripts/backup-d1.sh) manuell, kein Cron, kein Off-Site-Speicher, kein Restore-Test
    - Muss vor dem LiveGang in Cloudflare noch etwas gemacht werden? ❌ — `DEV_MODE: true` umstellen, `SMS_PEPPER` + `BREVO_API_KEY` als Secrets setzen, DNS+HTTPS, Brevo-SMS aktivieren

- Widerrufsrecht
    - Lässt es sich unkompliziert durchführen? ✓ — 2 Modi (Telefon-SMS, Referenznummer) auf [/widerruf](src/pages/widerruf.astro)
    - Kann ein Optout per Link erfolgen (einfach und unkompliziert)? ❌ entfernt — Ein-Klick-Token-Widerruf wurde komplett rausgebaut; Widerruf erfolgt über die `/widerruf`-Seite mit Telefon-Reverifizierung oder Referenznummer
    - Was muss nach einem Widerruf geschehen? ⚠️ — `revoked_at` gesetzt + Admin-Mail; **keine Bestätigung an Nutzer**, **keine PII-Anonymisierung** (nur Soft-Marker)

- Consents:
    - Können Consent Versionen verwaltet und für frühere Versionen nachgewiesen werden? ✓ — 5 Versionen in [src/lib/consent.ts](src/lib/consent.ts), inkl. Partner-Snapshot
    - Sind Consents verlässlich nachweisbar (Beweislast)? ✓ — Volltext + IP + UA + Timestamp pro Lead in `lead_consents`

- E-Mail:
    - Klappt das Kontaktformular? ⚠️ — kein klassisches Formular; Lead-Funnel ist auf [/check](src/pages/check.astro); [/kontakt](src/pages/kontakt.astro) ist reine Info-Seite. End-to-End-Test nach Deploy nötig.
    - Klappen alle E-Mails (Anfragenden, Fachpartner) ⚠️ — Admin-Mail-Pfad existiert; **keine Mail an Anfragenden** (kein Email-Feld im Funnel); **keine automatische Mail an Fachpartner** — Lead-Weitergabe-Prozess an Fritz Group ist undokumentiert

- SMS:
    - Klappt das Senden der SMS an den Anfragenden? ✓ ([src/lib/sms.ts](src/lib/sms.ts), Brevo), aber nur wenn `DEV_MODE=false` + `BREVO_API_KEY` gesetzt
    - Klappt das Einlösen des SMS Code? ✓ ([src/pages/api/lead/verify.ts](src/pages/api/lead/verify.ts), SHA-256+Pepper, Brute-Force-Schutz)

- Content
    - Ist überall der korrekte Fachpartner aufgeführt? ❌ — [src/data/partners.ts:37-38](src/data/partners.ts#L37-L38): `TODO-FRITZ-TEL` und `TODO-FRITZ-MAIL` sind Platzhalter
    - Nicht irreführend?
        - Unabhängiger Ratgeber korrekt wenn die Daten an Fachpartner weitergeleitet werden? ⚠️ — Wording widerspricht der Vermittlungs-Logik, vor Livegang abklären
    - Impressum, Datenschutzerklärung & Co. korrekt? ✓ vorhanden — aber Datenschutzerklärung: konkrete Speicherdauer + DSGVO-Auskunfts-Workflow (Art. 15–21) ergänzen
    
- Security
    - Bots werden im Formular abgefangen? ❌ — Honeypot ✓, aber **Rate-Limits in [src/pages/api/lead/start.ts:160-166](src/pages/api/lead/start.ts#L160-L166) und [:181-188](src/pages/api/lead/start.ts#L181-L188) sind auskommentiert**
    - Ist die Website & DB sicher vor Angriffen / Manipulation? ⚠️ — Prepared Statements ✓, aber: keine Origin-/Referer-Validation, Referenznummer-Widerruf ohne Rate-Limit (Brute-Force-Risiko)

---

## Zusätzlich vor Livegang zu klären (nicht im Original)

Im Detail siehe [LIVEGANG.md](LIVEGANG.md):

- **Lead-Weitergabe an Partner**: kein Code-Pfad → manueller Prozess + SLA + AVV mit Fritz Group
- **Sender-Reputation**: SPF/DKIM für E-Mail-Absender (`web.de` ist Free-Mail, ggf. eigene Domain)
- **Brevo SMS-Voraussetzungen**: Sender-ID „BremerWP" muss in DE registriert sein, Guthaben aufgeladen
- **WEBOTP_HOST = Produktions-Domain** (sonst keine SMS-Auto-Fill auf iOS/Android)
- **Cleanup-Jobs**: unverifizierte Leads > 7 Tage, alte KV-Sessions, PII-Anonymisierung nach Aufbewahrungsfrist
- **Monitoring**: Alert auf 5xx-Spike, `status=failed`-Häufungen, Brevo-Guthaben-Schwellwert
- **Notfall-/Breach-Plan**: 72h-Meldepflicht an LfDI Bremen dokumentieren
