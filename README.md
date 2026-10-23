# Bremer Wärmepumpe

Astro-Website auf Cloudflare Workers. Ziel: relevante Suchsichtbarkeit und qualifizierte
Anfragen aus Bremen und Umgebung. Codex und Claude Code nutzen dieselben Regeln und Daten.

## So arbeiten Entwickler und Agenten

| Entwickler | Agent |
| --- | --- |
| Geschäftsziel, Einzugsgebiet, Umfang und gegebenenfalls API-Budget nennen | Aktuelle Daten prüfen und begründete Chancen priorisieren |
| Eigene Erfahrungen, Projektbelege und fachliche Ansprechpartner liefern | Suchintention, Quellen und bestehenden Seitenbestand untersuchen |
| Fachliche Aussagen und Änderungen prüfen; Veröffentlichung verantworten | Eine nachvollziehbare Verbesserung umsetzen, testen und dokumentieren |
| Lead-Qualität beurteilen und Messung ermöglichen | Nach Veröffentlichung Ergebnisse und Unsicherheit auswerten |

**Arbeitsrhythmus:** regelmäßig Daten sichten, die wichtigste belegte Chance bearbeiten
und veröffentlichte Änderungen später auswerten. Wöchentlich ist ein guter Startpunkt;
Umfang und Wartezeit richten sich nach Datenmenge und Änderungsart. Keine Inhaltsquote.

1. Im Repository-Root starten. Bei Bedarf `npm run seo:doctor`, für frische GSC-Daten
   `npm run seo:sync`; bei vorhandenem Tages-Snapshot `npm run seo:report`.
2. Agent mit Ziel und Spielraum beauftragen, zum Beispiel:

   > Nutze den gemeinsamen SEO-Skill. Prüfe Daten und offene Änderungen. Wähle die
   > wichtigste belegte Chance für qualifizierte Anfragen und setze eine passende
   > Verbesserung um. Nutze zunächst vorhandene Daten; keine bezahlten Calls ohne Budget.
   > Prüfe das Ergebnis und dokumentiere Ausgangslage, Änderung und spätere Messung.
   > Keine Veröffentlichung.

3. Diff, fachliche Belege und Nutzerführung prüfen. Bei größeren oder fachlich sensiblen
   Änderungen einen zweiten Agenten mit unabhängigem Review beauftragen. Codex und Claude
   sind austauschbar; nur ein Agent bearbeitet dieselben Dateien gleichzeitig.
4. Nach Veröffentlichung das tatsächliche Datum im Änderungsjournal festhalten. Später
   mit vergleichbaren Daten auswerten; unklare Ergebnisse dürfen unklar bleiben.

**Erfolg messen:** relevante Impressionen → organische Besuche → erfolgreich abgeschickte
Anfragen → qualifizierte Anfragen. GSC misst Suchperformance; Lead-Erfolg benötigt eine
eigene datenschutzgerechte Zuordnung. Lokale, überregionale und Markenqueries getrennt betrachten.

## Einstieg und Referenzen

```sh
npm ci
npm run dev
```

Node.js ≥22.12. Beide Agenten aus dem Repository-Root öffnen.

- [AGENTS.md](AGENTS.md): kurze gemeinsame Projektregeln; Claude lädt sie über CLAUDE.md.
- [SEO-Skill](.agents/skills/optimize-bremer-waermepumpe-seo/SKILL.md): Entscheidungen und Messung.
- [Werkzeuge](docs/seo-tools.md): MCP/GSC einrichten, Daten speichern, Befehle und Fehlerbehandlung.
- [Wartung](docs/maintenance.md): offene technische Befunde.

Private Arbeitsgrundlage: `seo-data/REPORT.md` für den Datenüberblick und
`seo-data/changes.jsonl` für Hypothesen, Änderungen und Veröffentlichungen. Bei einem
Rechnerwechsel separat sicher übertragen; diese Daten gehören nicht ins öffentliche Git.
