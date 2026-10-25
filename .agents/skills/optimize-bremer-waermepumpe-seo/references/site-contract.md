# URL-Zuordnung und Komponenten

Vor Seitenänderungen lesen und mit dem aktuellen Bestand abgleichen. Die Zuordnung
beschreibt die beabsichtigte Suchintention, keine unveränderliche SEO-Strategie.

Hubs orientieren, Detailseiten vertiefen. Die überregionalen Kostenseiten bleiben ohne
künstlichen Bremen-Zusatz. Andere Themen über beschreibende interne Links erschließen.

## Zuständigkeit bestehender Seiten


| URL | Suchintention |
| --- | --- |
| `/` | Local Bremen heat-pump service overview and main conversion entry |
| `/waermepumpe-foerderung-bremen/` | Local info-first funding hub for Bremen |
| `/kfw-458-waermepumpe/` | KfW 458 calculation, residential units, application details, and special cases |
| `/bafa-foerderung-waermepumpe/` | BAFA heating optimization and iSFP detail |
| `/bab-heizungstausch-bremen/` | Closed BAB heating-replacement program and historical or legacy applications |
| `/waermepumpe-foerderung-2026/` | Nationwide 2026 funding changes |
| `/waermepumpe-kosten-bremen/` | Local Bremen heat-pump cost overview, focus swb heat-pump tariff |
| `/waermepumpe-kosten-einfamilienhaus/` | Cost detail for detached houses |
| `/luft-wasser-waermepumpe-kosten/` | Air-to-water heat-pump cost detail |
| `/waermepumpe-altbau-bremen/` | Local suitability and decisions for existing buildings in Bremen |
| `/waermepumpe-altbau-kosten/` | Cost detail for existing buildings |
| `/waermepumpe-oder-gasheizung-bremen/` | Local system comparison and decision support |
| `/waermepumpe-abstand-nachbar-bremen/` | Local distance, neighbor, and placement questions |
| `/waermepumpe-abstand-nachbar/` | Bundesweite Grenzabstände und Unterschiede zwischen Bundesländern |
| `/waermepumpe-lautstaerke-nachbar/` | Lärm, Schallpegel und Schallschutz; keine lokale Abstandsseite |
| `/waermepumpe-genehmigung-bremen/` | Bremer Genehmigung, Anmeldung und Sonderfälle |
| `/gasheizung-umruesten-auf-waermepumpe-kosten/` | Kosten und Planung des Umstiegs von Gas; keine allgemeine Kosten-Hub-Seite |
| `/waermeplanung-bremen/` | Bremer Wärmeplan, Gebietsarten, Fernwärme oder Wärmepumpe fürs eigene Haus |

Support-/Conversion-Seiten: `/check/` = Eignungscheck, `/kontakt/` = Redaktion/Kontakt, `/fachpartner/` = transparente Partnerzuordnung. Rechtliche Seiten sind keine Keyword-Landingpages. `/check/danke/`, `/404.html` und `/dashboard/` bleiben noindex.

Überschneidungen anhand der tatsächlichen Suchintention prüfen, bevor Seiten zusammengelegt werden.

## Bremen-Bezug und Kannibalisierung

Das lokale Bremen-Volumen ist klein (DataForSEO 2026-07-21: ~400 Suchen/Monat über sechs
Keywords; `wärmepumpe kosten bremen` ohne messbares Volumen). Bremen in Title, H1, H2 und
FAQ-Fragen nur auf `/`, `/waermepumpe-foerderung-bremen/`, `/waermepumpe-abstand-nachbar-bremen/`,
`/waermepumpe-kosten-bremen/` (Fokus swb-Wärmepumpentarif) und `/bab-heizungstausch-bremen/`;
ebenso auf `/waermepumpe-altbau-bremen/`, `/waermepumpe-oder-gasheizung-bremen/` und
`/waermepumpe-genehmigung-bremen/` und `/waermeplanung-bremen/` passend zu deren Intention. Förder- und Kostenspokes
(2026, KfW 458, BAFA, Luft-Wasser, Altbau-Kosten) bleiben bundesweit.

- Keine H2 oder FAQ-Frage enthält wörtlich das Primärkeyword einer anderen Seite. Ursache
  der Kannibalisierung im Juli 2026: H2 „Wärmepumpe Förderung Bremen“ auf `/` und eine
  Bremen-Förder-FAQ auf `/waermepumpe-kosten-bremen/`.
- Fremde Themen in 2–3 Sätzen anreißen und mit dem Titel der Zielseite als Ankertext verlinken.
- `InternalLinkCard` rendert den Titel als `<p>`, nicht als Überschrift.
- `/check/` und `/kontakt/` sollen für keine inhaltliche Query ranken.

Legacy URLs: `/waermepumpe-kosten-foerderung/` no longer exists and 301-redirects to `/waermepumpe-foerderung-bremen/`. It can still appear in GSC data (including cannibalization tables) until Google consolidates the redirect — treat such rows as redirect artifacts, not content problems.

## Gemeinsame Astro-Komponenten

Bei Änderungen an den entsprechenden Mustern prüfen:

| File | Purpose |
| --- | --- |
| `src/components/Head.astro` | Metadata, canonical handling, social tags, and page schema |
| `src/components/FAQSection.astro` | Visible FAQs and synchronized FAQ schema |
| `src/components/Breadcrumb.astro` | Visible breadcrumbs and BreadcrumbList schema |
| target page imports | Existing layout and reusable content patterns |
