# Bremer Wärmepumpe — Architektur & Flow-Dokumentation

> Vollständige Beschreibung der Codebase, der Datenflüsse, der rechtlichen
> Konstruktion und der Operations-Workflows. Stand: 2026-05-25.

---

## Inhalt

1. [Systemüberblick & Stack](#1-systemüberblick--stack)
2. [Datenbank: wo läuft sie und wie inspiziere ich Datensätze](#2-datenbank-wo-läuft-sie-und-wie-inspiziere-ich-datensätze)
3. [Cloudflare-Bindings & Secrets](#3-cloudflare-bindings--secrets)
4. [Pages-Inventar](#4-pages-inventar)
5. [Flow 1 — Hero-Quickstart auf SEO-Seiten](#5-flow-1--hero-quickstart-auf-seo-seiten)
6. [Flow 2 — Funnel /check/ Step für Step](#6-flow-2--funnel-check-step-für-step)
7. [Flow 3 — SMS-Code-Ident-Verfahren (DOI)](#7-flow-3--sms-code-ident-verfahren-doi)
8. [Flow 4 — Admin-Notification + User-Bestätigungs-SMS](#8-flow-4--admin-notification--user-bestätigungs-sms)
9. [Flow 5 — Widerruf (3 Wege)](#9-flow-5--widerruf-3-wege)
10. [Rechtliche Konstruktion (Consent, Empfänger, Logs)](#10-rechtliche-konstruktion-consent-empfänger-logs)
11. [Code-Layout & Konventionen](#11-code-layout--konventionen)
12. [Operations: Build, Deploy, DB-Migration](#12-operations-build-deploy-db-migration)
13. [Bekannte Limitations & offene TODOs](#13-bekannte-limitations--offene-todos)

---

## 1. Systemüberblick & Stack

**Was die Seite ist:** Eine privat betriebene, nicht-gewerbliche
Empfehlungsplattform für Wärmepumpen in Bremen.
Hauptzweck: lokale SEO + Lead-Generierung für genau **einen** namentlich
genannten SHK-Betrieb (Seon Yemane). Der Betreiber (Ferris
El-Armouche) erhält **keine Provision**.

**Stack:**

| Schicht | Technologie |
|---|---|
| Hosting | Cloudflare Pages (Workers + Static Assets) |
| Framework | Astro v6 mit `@astrojs/cloudflare`-Adapter, mode `server` (SSR auf Edge) |
| Styling | Tailwind CSS v4 (über `@tailwindcss/vite`), eigenes Design-System in [src/styles/global.css](src/styles/global.css) |
| Interaktive Komponenten | React 19 mit Hooks (nur an Stellen die JS brauchen — Funnel, Widerruf) |
| Form-Validation | `react-hook-form` + Zod |
| Persistenz | Cloudflare **D1** (SQLite-kompatibel), Binding `DB` (database name `anonymous-leads`) |
| Session/Rate-Limits | Cloudflare **KV**, Binding `SESSION` |
| Transactional Mail | Brevo SMTP API |
| Transactional SMS | Brevo SMS API (Sender-ID `BremerWP`) |
| MDX Content | `astro:content` — Money-Pages als MDX in `src/content/pages/` |

**Sprache:** Komplette Site auf Deutsch (`<html lang="de">`).
**Node-Anforderung:** ≥ 22.12.0.

---

## 2. Datenbank: wo läuft sie und wie inspiziere ich Datensätze

### Wo läuft sie?

**Cloudflare D1**, eine serverless SQLite-Engine, die direkt auf
Cloudflares Edge läuft.

- **Database name:** `anonymous-leads`
- **Database ID:** `fe079ef8-77de-441f-b57f-d1535a7de5df`
- **Binding im Worker:** `DB` (definiert in [wrangler.jsonc:19-25](wrangler.jsonc:19))
- **Schema:** liegt in [scripts/d1-schema.sql](scripts/d1-schema.sql)

Es gibt **drei "Orte"**, an denen die DB existiert:

1. **Remote/Production** — Cloudflare D1 (das, was die Live-Seite nutzt)
2. **Preview** — D1 Preview-Replica (für `wrangler dev --remote`)
3. **Local** — eine lokale SQLite-Datei unter
   `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`,
   die `wrangler dev` ohne `--remote`-Flag automatisch anlegt

### Datensätze anschauen (Production)

**Einzelnen Lead anzeigen:**
```sh
npx wrangler d1 execute anonymous-leads --remote \
  --command "SELECT * FROM leads ORDER BY id DESC LIMIT 5;"
```

**Alle Tabellen sehen:**
```sh
npx wrangler d1 execute anonymous-leads --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table';"
```

**Schema einer Tabelle:**
```sh
npx wrangler d1 execute anonymous-leads --remote \
  --command "PRAGMA table_info(leads);"
```

**Consent-Beweis für eine konkrete Anfrage:**
```sh
npx wrangler d1 execute anonymous-leads --remote --command \
  "SELECT l.reference, c.consent_version, c.consent_timestamp, c.consent_ip, c.consent_text
   FROM leads l JOIN lead_consents c ON c.lead_id = l.id
   WHERE l.reference = 'BWP-2026-00042';"
```

**SMS-Verifikations-Historie eines Leads:**
```sh
npx wrangler d1 execute anonymous-leads --remote --command \
  "SELECT id, sent_at, expires_at, verified_at, attempts, superseded_at, brevo_message_id
   FROM sms_verifications WHERE lead_id = 42 ORDER BY id;"
```

**Welche Admins eine Mail bekommen haben:**
```sh
npx wrangler d1 execute anonymous-leads --remote --command \
  "SELECT lead_id, admin_email, send_status, email_message_id, notified_at
   FROM lead_admin_notified ORDER BY id DESC LIMIT 20;"
```

**Alle Widerrufe der letzten Wochen:**
```sh
npx wrangler d1 execute anonymous-leads --remote --command \
  "SELECT l.reference, r.revocation_channel, r.revoked_at
   FROM revocations r JOIN leads l ON l.id = r.lead_id
   ORDER BY r.revoked_at DESC;"
```

**Live-Datenbank in der Cloudflare-UI:**
Cloudflare Dashboard → Workers & Pages → D1 → `anonymous-leads` →
"Console"-Tab. Erlaubt freie SQL-Queries mit GUI.

### Daten lokal explorieren

Wenn `npm run dev` läuft, hängt es per Default an die **lokale Miniflare-D1**.
Diese Datei kannst du direkt mit jedem SQLite-Client öffnen:

```sh
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite
```

Im SQLite-Prompt z. B. `.tables`, `.schema leads`, `SELECT * FROM leads;`.

### Was steckt in welcher Tabelle?

Schema-Quelle: [scripts/d1-schema.sql](scripts/d1-schema.sql).

| Tabelle | Inhalt |
|---|---|
| `leads` | Pro Anfrage 1 Zeile. Enthält Stammdaten (Name, Anrede, Telefon, Adresse), die Quiz-Antworten aus dem Funnel (`heating_current`, `heating_age`, `building_type`, `is_owner`, `heating_location`, `timeline`), Statusspalten (`status`, `sms_verified_at`, `admin_email_sent_at`, `revoked_at`) und die menschenlesbare Referenz `BWP-2026-NNNNN`. |
| `sms_verifications` | Pro versendetem SMS-Code 1 Zeile. Speichert nicht den Code selbst, sondern `code_hash` = `SHA-256(code + ":" + leadId + ":" + phoneE164 + ":" + SMS_PEPPER)`. Außerdem `sent_at`, `expires_at`, `verified_at`, `attempts`, `ip`, `user_agent`, `brevo_message_id` und `superseded_at` (für resends). |
| `lead_consents` | Der **Einwilligungs-Beweis** nach Art. 7 Abs. 1 DSGVO. Speichert den vollständigen Wortlaut der angeklickten Checkboxen, die Consent-Version (z. B. `consent-v3-2026-05-22`), Timestamp, IP, User-Agent und einen JSON-Snapshot der zum Zeitpunkt der Einwilligung gültigen Empfänger-Liste (`partners_snapshot`). |
| `lead_admin_notified` | Pro versendeter Admin-Mail 1 Zeile (also typischerweise 2 Zeilen pro Lead — eine je Admin-Adresse). Mit `send_status` = `sent` oder `failed:…`. |
| `revocations` | Audit-Trail aller Widerrufe. Spalten: `revocation_channel` (`token` / `phone_verify` / `form_reference`), `revocation_ip`, `revocation_token`. Der `leads.revoked_at` markiert den Lead zusätzlich auf der `leads`-Zeile selbst. |

### Status-Lifecycle eines Leads (Spalte `leads.status`)

```
sms_pending  ─┬─ verify success ─►  sms_verified  ─►  admin_notified
              │                                        │
              │                                        └─ user widerruft ─►  revoked
              │
              ├─ 3× falscher Code  ─►  failed
              ├─ Brevo-SMS-Versand schlägt fehl  ─►  failed
              └─ E-Mail-Versand schlägt fehl  ─►  failed
```

### Aufräumen (Datenminimierung / Speicherdauer-Konzept)

Aktuell läuft **keine** automatische Löschung. Das Datenschutz-Konzept
(vgl. [src/pages/datenschutz.astro](src/pages/datenschutz.astro)) sieht
vor:

- Anfragedaten werden für die Dauer der Beratungs-Anbahnung gespeichert.
- Der **Einwilligungs-Nachweis** (`lead_consents`) bleibt 3 Jahre nach
  Widerruf bzw. letzter Verwendung (§ 195 BGB Verjährungsfrist).

Eine Cron-basierte Lösch-Routine ist als TODO offen (siehe §13).

---

## 3. Cloudflare-Bindings & Secrets

Alle Konfiguration steht in [wrangler.jsonc](wrangler.jsonc).

### Bindings

| Binding | Typ | Zweck |
|---|---|---|
| `ASSETS` | Static Assets | Serviert das Build-Output `./dist/` |
| `SESSION` | KV Namespace | Rate-Limits, Pending-Tokens, Widerruf-Tokens |
| `DB` | D1 | Lead-Persistenz (siehe §2) |

### Public vars (in `wrangler.jsonc` committed)

| Variable | Wert | Genutzt von |
|---|---|---|
| `BREVO_SENDER_EMAIL` | `bremerwaermepumpe@web.de` | From-Adresse der Brevo-Mails |
| `BREVO_SENDER_NAME` | `Bremer Wärmepumpe` | From-Name |
| `BETREIBER_DATENSCHUTZ_EMAIL` | `bremerwaermepumpen@web.de` | Wird im Footer/Datenschutz/Widerruf-Hinweisen angezeigt |
| `BETREIBER_TEL` | `0176 34690188` | Wird in SMS-Bestätigung und auf der Website ausgegeben |
| `SITE_URL` | `https://bremer-waermepumpe.de` | Basis für absolute URLs (Widerruf-Link) |
| `WEBOTP_HOST` | `bremer-waermepumpe.de` | Trailing-Line in SMS für WebOTP / iOS Auto-Fill |
| `ADMIN_NOTIFICATION_EMAILS` | `ferris.e@gmx.de,bremerwaermepumpen@web.de` | Komma-getrennte Empfänger der Admin-Lead-Mail |
| `BREVO_SMS_SENDER` | `BremerWP` | Sender-ID in der SMS |
| `SMS_CODE_TTL_SECONDS` | `600` | Gültigkeit eines SMS-Codes (10 min) |
| `DEV_MODE` | `"true"` | Wenn `"true"`: SMS wird **nicht** wirklich versandt, sondern in der Wrangler-Konsole geloggt |

### Secrets (NICHT in wrangler.jsonc — per `wrangler secret put` setzen)

| Secret | Zweck |
|---|---|
| `BREVO_API_KEY` | API-Key für Brevo (Mail + SMS) |
| `SMS_PEPPER` | 32-byte hex random, fließt in den SHA-256-Hash des SMS-Codes. **Muss** in Production gesetzt sein — sonst greift der unsichere Default `"dev-pepper-only"`. |

Setzen:
```sh
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put SMS_PEPPER
```

---

## 4. Pages-Inventar

### Statische und SSR-Pages unter `src/pages/`

| Route | Datei | Typ | Indexiert |
|---|---|---|---|
| `/` | `index.astro` | Statisch, Hero + viele Sektionen | ✅ |
| `/check/` | `check.astro` | Lädt Funnel client-side | ✅ |
| `/check/danke/` | `check/danke.astro` | Legacy-Erfolg (wird nicht mehr vom Funnel angesprungen — Erfolg läuft via `SuccessScreen` Inline) | `noindex` |
| `/agb/` | `agb.astro` | Nutzungsbedingungen (private Empfehlungsseite) | ✅ |
| `/datenschutz/` | `datenschutz.astro` | DSGVO-konforme Datenschutzerklärung | ✅ |
| `/impressum/` | `impressum.astro` | TDDDG-konformes Impressum (privater Betreiber) | ✅ |
| `/widerruf/` | `widerruf.astro` | 3-Wege-Widerruf (Token, Telefon-Re-Verify, Referenznummer) | ✅ |
| `/fachpartner/` | `fachpartner.astro` | Namentliche Auflistung der Empfänger | ✅ |
| `/kontakt/` | `kontakt.astro` | Kontaktdaten + Hinweis auf Check als Hauptpfad | ✅ |
| `/404` | `404.astro` | Standard 404 | — |

### Dynamische Money-Pages über `[...slug].astro` + MDX-Collection

Datei [src/pages/[...slug].astro](src/pages/[...slug].astro) liest die
`pages`-Collection aus [src/content.config.ts](src/content.config.ts)
und rendert jede MDX-Datei mit [PageTemplate.astro](src/components/PageTemplate.astro).

MDX-Pages unter `src/content/pages/`:

- `waermepumpe-altbau-bremen.mdx`
- `waermepumpe-altbau-kosten.mdx`
- `waermepumpe-foerderung-bremen.mdx`
- `waermepumpe-foerderung-2026.mdx`
- `waermepumpe-kosten-bremen.mdx`
- `waermepumpe-kosten-einfamilienhaus.mdx`
- `bafa-foerderung-waermepumpe.mdx`
- `kfw-458-waermepumpe.mdx`
- `luft-wasser-waermepumpe-kosten.mdx`

Jede MDX-Page hat im Frontmatter (Zod-validiert):

```yaml
title: …
description: …
canonical: …
lastUpdated: …
hero:
  headline: …
  subtext: …
  imageSrc: ./pfad/zum/hero.webp
  primaryCTA: { label, href }
  secondaryCTA: { label, href }
  showQuickstart: true        # default — Heizungs-Quickstart unter dem Hero
  quickstartLabel: …          # optional, Custom-Headline
trustItems: [ { text } ]
breadcrumb: [ { label, href } ]
ctaBlock: { headline, text, variant, primaryCTA, secondaryCTA }
faqs: [ { question, answer } ]
faqHeading: …
schema: { type: Article|HowTo, datePublished, dateModified, howToSteps }
```

### API-Routes (Server-Side, SSR im Worker)

| Route | Datei | Methode | Zweck |
|---|---|---|---|
| `/api/lead/start` | `pages/api/lead/start.ts` | POST | Step 9 des Funnels: Lead anlegen, Consent speichern, SMS senden |
| `/api/lead/resend` | `pages/api/lead/resend.ts` | POST | Step 10 des Funnels: SMS-Code erneut senden |
| `/api/lead/verify` | `pages/api/lead/verify.ts` | POST | Step 10 des Funnels: Code prüfen, Admin-Mail + Bestätigungs-SMS |
| `/api/widerruf` | `pages/api/widerruf.ts` | POST | Multi-Modus Widerruf (Token / Telefon-Re-Verify / Referenz) |

Alle vier Routes setzen `export const prerender = false;` und laufen
deshalb als SSR-Edge-Functions.

---

## 5. Flow 1 — Hero-Quickstart auf SEO-Seiten

**Komponenten:**
[HeroSection.astro](src/components/HeroSection.astro) +
[HeroHeatingQuickstart.astro](src/components/HeroHeatingQuickstart.astro)

**Ziel:** Den Funnel ohne SEO-Verlust direkt im Hero starten lassen.

**Was passiert:**

1. Jede Seite mit `<HeroSection ... />` rendert standardmäßig (Prop
   `showQuickstart = true`) eine kompakte Box unter dem H1/Subtext.
2. Die Box zeigt 4 Buttons: **Gas / Öl / Strom / Anderes**.
3. Klick auf einen Button löst das Inline-Script aus
   ([HeroHeatingQuickstart.astro:55-79](src/components/HeroHeatingQuickstart.astro:55)):
   - Liest existierendes `bremer_funnel_data` aus `localStorage`
   - Setzt `data.heatingCurrent = <wert>` (Gas/Öl/Strom/Anderes)
   - Setzt `bremer_funnel_step = "2"` (falls noch kein höherer Schritt
     gespeichert war)
   - Navigiert nach `/check/`
4. Auf `/check/` mountet `FunnelParent`, liest `localStorage` aus
   ([FunnelParent.tsx:55-69](src/components/FunnelParent.tsx:55)) und
   startet direkt bei Step 2 (Heizungsalter) mit dem gewählten Heizsystem.

**SEO-Schutz:**

- Das Inline-Script läuft client-seitig; der gerenderte H1/Subtext bleibt
  unverändert in den HTML-Quellen → Google sieht weiterhin den
  vollständigen Content.
- Die Trust-Zeile unter den Buttons enthält einen Link zu
  `/fachpartner/` — das ist gleichzeitig die DSGVO-konforme
  Empfänger-Disclosure und ein interner SEO-Link.
- Auf `/check/` selbst gibt es **keinen** HeroSection (und damit keinen
  Quickstart) — dort startet ja schon der volle Funnel.

**Opt-out per Page:** Eine MDX-Page kann im Frontmatter `hero.showQuickstart: false`
setzen, um den Quickstart auszublenden (z. B. wenn der Page-Hero schon
einen eigenen interaktiven Block hätte).

---

## 6. Flow 2 — Funnel /check/ Step für Step

**Hauptkomponente:**
[FunnelParent.tsx](src/components/FunnelParent.tsx) — React-Wizard mit
`localStorage`-Resume, ohne externes State-Management.

**State-Modell:**

```ts
type FunnelData = {
  heatingCurrent?: 'Gas' | 'Öl' | 'Strom' | 'Anderes'
  heatingAge?: string                          // 'Unter 10 Jahre' | '10-15 Jahre' | …
  buildingType?: 'Einfamilienhaus' | 'Mehrfamilienhaus' | 'Reihenhaus' | 'Anderes'
  isOwner?: boolean
  heatingLocation?: 'Keller' | 'Erdgeschoss' | 'Obergeschoss' | 'Dachgeschoss'
  timeline?: string                            // 'Sofort' | 'In 1-3 Monaten' | …
  address?: { zip, city, street, houseNumber }
  personalInfo?: { salutation: 'Herr'|'Frau', name: string }
  phone?: string
}
```

`step`, `formData`, `isDisqualified` werden in `localStorage` persistiert.
`pendingToken`, `phoneMasked`, `reference`, `widerrufUrl` werden NUR
in-memory gehalten — bei Reload nach Step 9/10 startet der User
absichtlich neu, weil ein KV-Token nach 30 min sowieso abläuft und ein
stale Token in der UI sonst zu verwirrenden Fehlermeldungen führt.

### Step-Sequenz

| Step | Komponente | Was wird gefragt | Persistierung |
|---|---|---|---|
| 1 | [Step1Heating](src/components/steps/Step1Heating.tsx) | Aktuelle Heizung | nur `localStorage` |
| 2 | [Step2Age](src/components/steps/Step2Age.tsx) | Alter der Heizung | nur `localStorage` |
| 3 | [Step3Building](src/components/steps/Step3Building.tsx) | Gebäudetyp | nur `localStorage` |
| 4 | [Step4Owner](src/components/steps/Step4Owner.tsx) | Eigentümer ja/nein | nur `localStorage` |
| **(4a)** | [DisqualifiedScreen](src/components/steps/DisqualifiedScreen.tsx) | bei `isOwner = false` | kein API-Call, kein DB-Eintrag |
| 5 | [Step5Location](src/components/steps/Step5Location.tsx) | Aufstellort der Heizung | nur `localStorage` |
| 6 | [Step6Timeline](src/components/steps/Step6Timeline.tsx) | Zeitlicher Horizont | nur `localStorage` |
| 7 | [Step7Address](src/components/steps/Step7Address.tsx) | Adresse (PLZ, Ort, Straße, Hausnr) | nur `localStorage` |
| 8 | [Step8Name](src/components/steps/Step8Name.tsx) | Anrede + Vor- und Nachname | nur `localStorage` |
| **9** | [Step9Phone](src/components/steps/Step9Phone.tsx) | Mobilnummer + 2 Consent-Checkboxen | → POST `/api/lead/start` |
| **10** | [Step10SMSVerify](src/components/steps/Step10SMSVerify.tsx) | 6-stelliger SMS-Code | → POST `/api/lead/verify` |
| 11 | [SuccessScreen](src/components/steps/SuccessScreen.tsx) | Referenz + Widerruf-Hinweis | localStorage wird gecleart |

**Disqualifier-Pfad (4a):** Mieter (`isOwner = false`) werden auf einen
eigenen Screen geleitet, der die Anfrage NIE an die API sendet. Server-Side
ist in [start.ts:179-184](src/pages/api/lead/start.ts:179) zusätzlich ein
defensiver Check, der `is_owner === false`-Submissions ablehnt.

### Detail Step 9 ([Step9Phone.tsx](src/components/steps/Step9Phone.tsx))

Das ist der erste Step mit Server-Side-Wirkung.

**UI:**
- Telefon-Input (`type="tel"`, `inputMode="tel"`, `autoComplete="tel"`)
- Checkbox 1: Datenweitergabe an SHK-Betrieb + Kontaktaufnahme
  (Text aus [src/lib/consent.ts](src/lib/consent.ts), Version `v3`, mit
  HTML-Link zu `/fachpartner/`)
- Checkbox 2: Nutzungsbedingungen + Datenschutz (Links zu `/agb/` und
  `/datenschutz/`)
- Hinweis-Box: SMS-Code-Ident-Verfahren-Info (BGH-Urteil zitiert)

**Validation (Zod):**
```ts
phone: regex(/^(\+49|0)1\d{8,11}$/, ...)
consent_marketing: boolean.refine(v => v === true)
consent_terms: boolean.refine(v => v === true)
```

**Submit-Pfad:**
1. `FunnelParent.handleStartLead(input)` baut den API-Payload aus
   `formData` + `input`. Name wird in `vorname/nachname` gesplittet
   ([FunnelParent.tsx:35-41](src/components/FunnelParent.tsx:35)).
2. `POST /api/lead/start` mit JSON-Body:
   ```json
   {
     "salutation": "Herr",
     "vorname": "Max",
     "nachname": "Mustermann",
     "telefon": "017612345678",
     "strasse": "Musterstraße",
     "hausnummer": "12",
     "plz": "28195",
     "ort": "Bremen",
     "heatingCurrent": "Gas",
     "heatingAge": "10-15 Jahre",
     "buildingType": "Einfamilienhaus",
     "isOwner": true,
     "heatingLocation": "Keller",
     "timeline": "In 3-6 Monaten",
     "consent_marketing": true,
     "consent_terms": true,
     "consent_version": "consent-v3-2026-05-22"
   }
   ```
3. Bei Erfolg: API liefert `pendingToken` + `phoneMasked`. Funnel
   speichert beides, springt zu Step 10.

### Detail Step 10 ([Step10SMSVerify.tsx](src/components/steps/Step10SMSVerify.tsx))

**UI:**
- Großer Code-Input mit `autoComplete="one-time-code"`,
  `inputMode="numeric"`, `pattern="[0-9]{6}"`, `maxLength={6}`
- **WebOTP API**-Hook ([Step10SMSVerify.tsx:60-89](src/components/steps/Step10SMSVerify.tsx:60)):
  Beim Mount wird `navigator.credentials.get({ otp: { transport: ['sms'] }})`
  mit AbortController aufgerufen. Sobald die SMS eintrifft, liest Chrome
  auf Android den Code aus und triggert automatisch den Submit.
- Resend-Button mit 30 s Cooldown
- Hinweis: "Auf Android-Chrome und iOS schlägt Ihr Smartphone den Code
  direkt vor."

**Submit-Pfad:**
1. `POST /api/lead/verify` mit `{ pendingToken, code }`.
2. Bei Erfolg: API liefert `reference` + `widerrufUrl`. Funnel springt
   zu Step 11 (Success).
3. Bei Falsch-Eingabe: Server zählt Versuche; nach 3× falsch → Lead
   wird auf `failed` gesetzt.

### Step 11 — SuccessScreen

Zeigt:
- Referenznummer (z. B. `BWP-2026-00042`)
- Was als Nächstes passiert (Bestätigungs-SMS, Antwort innerhalb 24h)
- Widerruf-Box mit 1-Klick-Token-Link + `/widerruf/`-Link + Telefonnummer
- Empfänger-Hinweis mit Link zu `/fachpartner/`
- `localStorage` wird komplett geleert
  ([FunnelParent.tsx:82-90](src/components/FunnelParent.tsx:82))

---

## 7. Flow 3 — SMS-Code-Ident-Verfahren (DOI)

**Hintergrund:** BGH-Urteil I ZR 164/09 ("Telefonaktion II") — ein
bloßes Single-Opt-In (Häkchen + Telefonnummer) reicht NICHT als Nachweis
einer wirksamen Werbe-/Kontakteinwilligung. Die zuverlässigste Methode
ist das **SMS-Code-Ident-Verfahren**: Der User muss einen Code aus einer
SMS an seine angegebene Nummer eingeben.

### Code-Generierung und -Speicherung

Quelle: [src/lib/sms.ts](src/lib/sms.ts) + [src/pages/api/lead/start.ts](src/pages/api/lead/start.ts).

1. **Crypto-zufälliger 6-Stelliger Code** über
   [sms.ts:46-53](src/lib/sms.ts:46) (`crypto.getRandomValues` →
   `(value % 1_000_000).padStart(6, "0")`).
2. **Hashing** ([sms.ts:56-67](src/lib/sms.ts:56)):
   ```
   code_hash = SHA-256( code + ":" + leadId + ":" + phoneE164 + ":" + SMS_PEPPER )
   ```
   So ist selbst bei DB-Leak nicht klar, welcher Code aktiv war (Pepper
   ist Worker-Secret).
3. **TTL**: 10 Minuten (in `SMS_CODE_TTL_SECONDS` konfigurierbar).
4. **Persistenz**: Hash + Phone + IP + UA + Brevo-Message-ID gehen in
   `sms_verifications`.

### SMS-Versand

Brevo SMS Transactional API:
- Endpoint: `https://api.brevo.com/v3/transactionalSMS/sms`
- Sender: `BremerWP` (Sender-ID)
- Body-Format ([sms.ts:78-80](src/lib/sms.ts:78)):
  ```
  Ihr Bestaetigungscode fuer den Bremer Waermepumpen-Check: 123456 (10 Min. gueltig, nicht weitergeben).

  @bremer-waermepumpe.de #123456
  ```
  Die letzte Zeile (`@<host> #<code>`) ist die Origin-Bindung der WebOTP
  Spec. Sie wird auf Android Chrome vom Browser automatisch erkannt und
  in den Code-Input geschrieben. iOS Safari nutzt sie ebenfalls als
  Hinweis für den Quick-Type-Vorschlag.

### Verifizierung (`/api/lead/verify`)

1. Pending-Token aus KV holen → `leadId`.
2. Per-Lead-Rate-Limit prüfen (max 6 Verifizierungs-Requests in 10 min).
3. Letzten nicht-superseded `sms_verifications`-Eintrag laden.
4. TTL prüfen + `attempts < 3` prüfen.
5. Hash neu berechnen + vergleichen. Falsch → `attempts++`.
6. Erfolg → 4 DB-Updates atomar:
   - `sms_verifications.verified_at = NOW()`
   - `leads.sms_verified_at = NOW()`, `sms_phone_verified = phone`,
     `status = 'sms_verified'`
   - `lead_consents.sms_verification_id = <id>` (verknüpft Consent mit
     SMS-Beweis)
   - Widerruf-Token in KV anlegen (3 Jahre TTL):
     `KV.put("widerruf:<uuid>", leadId, 3y)`
7. Admin-Mail + Bestätigungs-SMS senden (siehe Flow 4).

### Code erneut senden (`/api/lead/resend`)

- Min-Abstand 60 s zwischen zwei Resends pro Token
- Max 2 Resends pro Token
- Max 3 Codes pro Telefonnummer pro 24 h
- Bisheriger Code wird auf `superseded` gesetzt

### Brute-Force-Schutz (mehrschichtig)

| Schicht | Wo | Limit |
|---|---|---|
| Per-IP-Lead-Start | KV `rate:lead:start:<ip>` | 3 Starts / Stunde |
| Per-IP-SMS-Send | KV `sms:rl:ip:<ip>` | 5 SMS / Stunde |
| Per-Phone-SMS-Send | KV `sms:rl:phone:<e164>` | 3 SMS / 24 h |
| Per-Lead-Verify | KV `sms:verify:<leadId>` | 6 Versuche / 10 min |
| Per-SMS-Eintrag | DB `sms_verifications.attempts` | 3 Fehlversuche → Lead `failed` |

---

## 8. Flow 4 — Admin-Notification + User-Bestätigungs-SMS

Tritt direkt nach erfolgreicher SMS-Verifizierung in
[verify.ts:178-264](src/pages/api/lead/verify.ts:178) auf.

### Admin-Mail an Multiple Empfänger

[email.ts:104-159](src/lib/email.ts:104):

- Empfänger-Liste kommt aus env var `ADMIN_NOTIFICATION_EMAILS` (komma-getrennt).
- **Pro Empfänger 1 separater Brevo-Send** (nicht BCC), damit ein
  Delivery-Fehler bei einer Adresse nicht die anderen mit-kippt.
- Jeder Send wird einzeln in `lead_admin_notified` protokolliert mit
  `send_status = 'sent' | 'failed:<error>'`.

**Inhalt der Mail** (text-only, kein HTML — minimiert Spam-Risiko):

```
Neue Anfrage für kostenlose Wärmepumpen-Erstberatung: BWP-2026-00042 [DRINGEND]
Eingegangen: 25.05.2026, 14:23:11 (Europe/Berlin)

Kontakt:
  Herr Max Mustermann
  Telefon: +491761234567 (SMS-verifiziert)
  Anschrift: Musterstraße 12, 28195 Bremen

Angaben aus dem Check (keine automatische Bewertung):
  Aktuelle Heizung      Gas
  Heizungsalter         10-15 Jahre
  Gebäudetyp            Einfamilienhaus
  Eigentumsverhältnis   Eigentümer
  Aufstellort Heizung   Keller
  Zeitlicher Horizont   In 3-6 Monaten

Identitätsnachweis (SMS-Code-Ident, BGH I ZR 164/09 „Telefonaktion II"):
  SMS-Bestätigung erfolgreich an    +491761234567
  Code-Versand                      2026-05-25T14:21:03.044Z UTC
  Code-Bestätigung                  2026-05-25T14:23:11.812Z UTC

Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, Art. 7 Abs. 1 DSGVO):
  Erteilt am:        2026-05-25T14:21:00.123Z UTC
  Version:           consent-v3-2026-05-22
  IP zum Zeitpunkt:  87.123.45.6

  Einwilligungs-Text (Datenweitergabe + Kontaktaufnahme):
  Ich möchte eine kostenlose und unverbindliche Einschätzung des … (volltext)

  Bestätigung Nutzungsbedingungen / Datenschutz:
  Ich habe die Nutzungsbedingungen und die Datenschutzerklärung – insbesondere …

Auftrag an den SHK-Betrieb:
  Kostenlose und unverbindliche Einschätzung zu Eignung, Machbarkeit,
  Kosten und Förderung; ggf. unverbindliches Angebot. Kein Vertrag
  entsteht durch die Anfrage.

Widerruf: Der Nutzer kann seine Einwilligung jederzeit unter
  /widerruf/ widerrufen. Bei Widerruf wird der Lead in D1 als revoked
  markiert; bitte stoppen Sie dann jegliche Kontaktaufnahme.

—
Bremer Wärmepumpe – Ferris El-Armouche
bremerwaermepumpen@web.de | 0176 34690188
```

**Subject:** `Neue Anfrage BWP-2026-00042 [DRINGEND] – PLZ 28195 – Bremer Wärmepumpe`
(`[DRINGEND]` wird gesetzt wenn `timeline === 'Sofort'`).

### User-Bestätigungs-SMS

[sms.ts:104-130](src/lib/sms.ts:104):

```
Bremer Waermepumpe: Anfrage BWP-2026-00042 eingegangen. Antwort innerhalb von 24 Std. Widerruf jederzeit: https://bremer-waermepumpe.de/widerruf/?token=<uuid> oder 0176 34690188.
```

Bewusst kurz gehalten (1 SMS-Segment, ~160 Zeichen), enthält:
- Referenz zum Identifizieren
- Ein-Klick-Widerruf-URL (Art. 7 Abs. 3 DSGVO: "muss so einfach sein wie
  die Erteilung")
- Telefonnummer als Alternative

### Status-Update am Ende

- Wenn mindestens 1 Admin-Mail erfolgreich: `status = 'admin_notified'`,
  `admin_email_sent_at = NOW()`
- Wenn alle Admin-Mails fehlgeschlagen: `status = 'failed'`
- Pending-Token wird aus KV gelöscht

---

## 9. Flow 5 — Widerruf (3 Wege)

UI: [widerruf.astro](src/pages/widerruf.astro). Backend: [api/widerruf.ts](src/pages/api/widerruf.ts).

### Mode 1 — Token (Ein-Klick aus Bestätigungs-SMS)

1. User klickt auf den `https://bremer-waermepumpe.de/widerruf/?token=<uuid>`
   in seiner Bestätigungs-SMS.
2. `widerruf.astro` zeigt den Token-Block oben mit nur einem Button
   "Widerruf jetzt absenden".
3. Klick → `POST /api/widerruf { token: "<uuid>" }`
4. Backend: KV `widerruf:<token>` → `leadId` → `revokeLead()`.
5. Token wird invalidiert (1 s TTL).
6. Admin-Mails werden mit Revocation-Notice informiert.

### Mode 2 — Telefon-Re-Verify (für User ohne Bestätigungs-SMS-Link)

1. User gibt Mobilnummer ein → `POST /api/widerruf { action: "phone_request", telefon }`
2. Backend: lädt **alle** nicht-widerrufenen Leads dieser Nummer aus DB.
   - Wenn keine: Antwortet trotzdem mit Pseudo-Erfolg, um nicht zu
     leaken, welche Nummern in der DB sind.
   - Wenn vorhanden: Erzeugt neuen SMS-Code (gleiche Logik wie Funnel),
     speichert Hash in `sms_verifications`, sendet SMS.
3. Antwort an UI: `{ token, phoneMasked, expiresInSeconds }`
4. UI zeigt jetzt Code-Input.
5. User gibt Code ein → `POST /api/widerruf { action: "phone_confirm", token, code }`
6. Backend: KV `wf:phone:<token>` → Lead-IDs. Validiert Code gegen den
   letzten `sms_verifications`-Eintrag des Primary-Leads. Bei Erfolg
   werden **alle** Leads dieser Nummer in einem Rutsch widerrufen.
7. KV-Token wird gelöscht, Admin-Notice geht raus.

Diese 2-Schritte-Variante stellt sicher, dass niemand fremde Leads
einfach durch Eingabe einer Telefonnummer widerrufen kann.

### Mode 3 — Referenznummer (Fallback)

1. User gibt `BWP-2026-NNNNN` ein → `POST /api/widerruf { reference }`
2. Backend: `getLeadByReference()` → falls vorhanden → `revokeLead()`.
3. **Keine** zusätzliche Verifizierung — der Annahme nach kennt nur der
   Lead-Inhaber seine Referenz (kommt nur per SMS-Bestätigung).

### Admin-Notice nach Widerruf

[email.ts:165-191](src/lib/email.ts:165): Sendet eine kurze E-Mail an
alle `ADMIN_NOTIFICATION_EMAILS` mit der Aufforderung, keine weitere
Kontaktaufnahme vorzunehmen.

### Datenbank-Effekte

- `leads.status = 'revoked'`
- `leads.revoked_at = NOW()`
- Neue Zeile in `revocations` mit `channel`, `ip`, ggf. `token`
- KV-Widerruf-Token wird auf TTL 1s gesetzt

---

## 10. Rechtliche Konstruktion (Consent, Empfänger, Logs)

### Drei Säulen

**Säule 1 — Datenverarbeitungs-Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)**

- Wortlaut, Version, Zeitstempel, IP, User-Agent + Partner-Snapshot
  werden in `lead_consents` gespeichert.
- Aktuell gültige Version: `consent-v3-2026-05-22`
  ([src/lib/consent.ts](src/lib/consent.ts)).
- Frühere Versionen bleiben im Code, sodass alte Einwilligungen
  reproduziert werden können (Beweispflicht Art. 7 Abs. 1).

**Säule 2 — SMS-Code-Ident-Identitätsnachweis (Art. 7 Abs. 1 + BGH I ZR 164/09)**

- Stellt sicher, dass die Person, die einwilligt, tatsächlich die
  angegebene Telefonnummer besitzt.
- Verknüpft mit dem Consent über `lead_consents.sms_verification_id`.

**Säule 3 — Empfängernennung (Art. 13 Abs. 1 lit. e DSGVO)**

- Konkrete Liste der Datenempfänger steht auf `/fachpartner/`.
- Im Consent-Wortlaut wird auf diese Seite explizit verwiesen.
- Im Funnel sind die Checkbox-Labels HTML-fähig und enthalten anklickbare
  Links zu `/fachpartner/`.

### Rolle der "Marketing"-Einwilligung

Trotz Wording im Code (`consent_marketing`, `marketingLabel`) handelt
es sich **inhaltlich** um eine reine Datenverarbeitungs-/
Kontaktaufnahme-Einwilligung. Der Begriff "Marketing" wird im UI
**nicht** gezeigt — dort steht "Einwilligung zur Erstberatung" /
"Datenweitergabe an den SHK-Betrieb".

§ 7 UWG (Telefonwerbung) ist hier formal nicht zwingend, weil die
Kontaktaufnahme vom Nutzer aktiv angefragt wird (kein Cold Call). Die
SMS-DOI-Konstruktion deckt aber auch diesen Fall mit ab.

### Kopplungsverbot (Art. 7 Abs. 4 DSGVO)

Zwei separate Checkboxen, weil:
1. Datenverarbeitungs-Einwilligung
2. AGB-Akzeptanz

nicht zu **einer** Checkbox zusammengelegt werden dürfen. Der User muss
beide aktiv setzen.

### Speicherdauer-Konzept

(Quelle: `src/pages/datenschutz.astro`)

| Datenkategorie | Aufbewahrung |
|---|---|
| Server-Logs (Cloudflare) | 30 Tage automatisch |
| `leads` + `sms_verifications` | Dauer der Beratungs-Anbahnung |
| `lead_consents` (Beweis) | 3 Jahre nach Widerruf / letzter Verwendung (§ 195 BGB) |
| `revocations` | dauerhaft |
| Bei Widerruf | `leads.status = 'revoked'`, Daten bleiben für Beweiszwecke |

---

## 11. Code-Layout & Konventionen

### Verzeichnisstruktur

```
src/
├── actions/            # Astro Actions (aktuell leer — alles über /api/lead/*)
├── assets/             # Bilder (importiert via astro:assets)
├── components/
│   ├── HeroSection.astro
│   ├── HeroHeatingQuickstart.astro
│   ├── NavBar.astro / Footer.astro / Head.astro
│   ├── TrustBar.astro / SectionShell.astro / Breadcrumb.astro
│   ├── CTASection.astro / FAQSection.astro / ProcessSection.astro
│   ├── PageTemplate.astro          # MDX-Wrapper
│   ├── FunnelParent.tsx            # React-Wizard
│   ├── steps/                      # Step1Heating, …, Step10SMSVerify
│   │   ├── DisqualifiedScreen.tsx
│   │   └── SuccessScreen.tsx
│   └── mdx/                        # In MDX-Content nutzbare Komponenten
├── content/
│   ├── content.config.ts           # Zod-Schema der pages-Collection
│   └── pages/                      # MDX Money-Pages
├── data/
│   ├── navigation.ts               # Sitemap für NavBar
│   └── partners.ts                 # Empfänger-Liste (versioniert)
├── images/                         # Hero-Images
├── layout/
│   └── Layout.astro                # HTML-Shell + Head + NavBar + Footer
├── lib/
│   ├── consent.ts                  # Versionierte Consent-Texte
│   ├── email.ts                    # Brevo SMTP — Admin-Notif + Revocation
│   ├── leads.ts                    # D1-Queries (alle Tabellen)
│   ├── lead-flow.ts                # Validierungs- + Rate-Limit-Helpers
│   └── sms.ts                      # Brevo SMS + Code-Generierung + Hashing
├── pages/
│   ├── *.astro                     # Statische + SSR-Pages
│   ├── [...slug].astro             # MDX-Router
│   ├── check/danke.astro           # Legacy
│   └── api/
│       ├── widerruf.ts
│       └── lead/
│           ├── start.ts
│           ├── resend.ts
│           └── verify.ts
└── styles/
    └── global.css                  # Tailwind v4 @theme + @layer components
```

### Wichtige Konventionen

- **Sprache:** UI komplett Deutsch (`<html lang="de">`)
- **Kein automatisches Scoring:** Kein Lead wird vom System bewertet —
  die Einschätzung erfolgt durch den SHK-Betrieb persönlich.
  Diese Selbstverpflichtung steht im Consent-Wortlaut.
- **Versionierung:** Consent-Texte (`consent.ts`) und Partner-Liste
  (`partners.ts`) sind nicht überschreibbar, sondern als Array von
  Versionen. Alte Versionen bleiben referenzierbar.
- **PLZ-Filter:** Nur `27xxx` und `28xxx` werden serverseitig akzeptiert
  ([lead-flow.ts:44](src/lib/lead-flow.ts:44)).
- **Tailwind-Tokens:** Semantische Namen statt Hex (`bg-background`,
  `text-text-muted`, `btn-accent`) — siehe `src/styles/global.css`.

### Funnel-Werte werden 1:1 gespeichert

Die Step-Komponenten geben menschenlesbare Strings ab (`"Gas"`,
`"10-15 Jahre"`, `"Sofort"`). Die API akzeptiert genau diese Werte und
speichert sie unverändert in der DB. Das vermeidet brüchige Code-Lookups
und macht die Mail-Briefings direkt lesbar.

---

## 12. Operations: Build, Deploy, DB-Migration

### Lokale Entwicklung

```sh
npm install
npm run dev          # http://localhost:4321 (Miniflare emuliert D1+KV lokal)
```

In Dev läuft `DEV_MODE=true` (aus wrangler.jsonc) → SMS werden nicht
versendet, sondern in der Konsole geloggt:

```
[DEV-SMS verify] to=+491761234567 sender=BremerWP code=123456
Ihr Bestaetigungscode fuer den Bremer Waermepumpen-Check: 123456 …
```

### Type-Check & Build

```sh
npx astro check      # TypeScript-Validation aller .astro + .tsx + .ts
npm run build        # Produktion-Build in ./dist/
npm run preview      # Lokaler Preview des Builds
```

### Deploy

```sh
npx wrangler deploy
```

…oder via Cloudflare-Pages-Git-Integration (auto-deploy bei Push).

### D1-Migration ausführen

**ACHTUNG:** Das aktuelle `scripts/d1-schema.sql` macht `DROP TABLE` auf
alles und legt das Schema neu an. **Vor jedem Migration-Run produktive
Daten exportieren:**

```sh
# Backup ziehen
npx wrangler d1 export anonymous-leads --remote \
  --output ./backup-$(date +%Y%m%d).sql

# Migration anwenden
npx wrangler d1 execute anonymous-leads --remote \
  --file ./scripts/d1-schema.sql

# Verifizieren
npx wrangler d1 execute anonymous-leads --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table';"
```

Für **inkrementelle** Migrations sollte langfristig ein
`migrations/`-Ordner mit nummerierten SQL-Dateien angelegt werden
(siehe TODO §13).

### Secrets setzen

```sh
npx wrangler secret put BREVO_API_KEY
npx wrangler secret put SMS_PEPPER       # 32-byte hex random
```

Vor Production-Aktivierung:

1. Brevo-Dashboard: SMS aktivieren + Sender-ID `BremerWP` registrieren
2. `SMS_PEPPER` setzen
3. `DEV_MODE` in [wrangler.jsonc:36](wrangler.jsonc:36) auf `"false"` setzen
4. Deploy

---

## 13. Bekannte Limitations & offene TODOs

### Im Code markiert (kurzfristig)

- **Step-Counter veraltet:** Steps 1–8 zeigen weiterhin "Schritt N von 11"
  im UI, obwohl der Flow jetzt 10 Steps hat (Step 11/Preference wurde
  entfernt). Müssen auf "Schritt N von 10" geändert werden:
  Step1Heating, Step2Age, Step3Building, Step4Owner, Step5Location,
  Step6Timeline, Step7Address, Step8Name.
- **Fachpartner-Daten:** [src/data/partners.ts](src/data/partners.ts) hat
  Seon Yemane mit `telefon: "TODO-SEON-TEL"`, `email: "TODO-SEON-MAIL"`
  und `isPlaceholder: true`. Solange diese TODOs offen sind, wird auf
  der `/fachpartner/`-Seite ein Hinweis "Eintrag in Aufbau" angezeigt
  und es geht **keine** Mail an Seon — alle Leads landen nur bei den
  Admin-Adressen.

### Mittel- bis langfristig

- **Inkrementelle Migrations:** Aktuell ist `scripts/d1-schema.sql` ein
  destruktives Full-Reset. Sobald Production-Leads existieren, einen
  `migrations/0001_init.sql`-Folder mit additiven Statements einführen.
- **Automatische Datenlöschung:** Cron-Trigger (oder Cloudflare Workers
  Cron) der `leads`-Zeilen ohne `lead_consents`-Referenz nach
  3 Jahren + 1 Tag löscht.
- **DB-Backup:** Cloudflare D1 hat zwar Point-in-time-Recovery (Workers
  Paid), aber zusätzlich sollte ein periodischer `wrangler d1 export`
  als Job laufen.
- **DSGVO-Auskunftsrecht (Art. 15):** Aktuell nur informell per Mail.
  Langfristig ein eigenes Endpoint analog `/widerruf/`, das einem
  authentifizierten User seine eigenen Daten als JSON zurückgibt.
- **`brevo-api-key.txt`:** Liegt im Repo-Root, ist via `.gitignore`
  ausgeschlossen. Trotzdem prüfen, ob er irgendwann mal gepushed wurde:
  `git log --all -- brevo-api-key.txt`. Für Production sollte der Key
  ausschließlich als `wrangler secret` existieren und die Datei
  gelöscht/gerotated werden.
- **Sentry / Logflare:** Aktuell nur `console.error` in den
  Catch-Blöcken. Cloudflare-Logpush oder Sentry-Integration für
  langfristige Beobachtbarkeit.
- **Brevo Webhooks:** Für E-Mail-Bounces (Soft/Hard) und SMS-Delivery-
  Failures gibt es Brevo-Webhooks, die in `lead_admin_notified.send_status`
  fortgeschrieben werden könnten.
