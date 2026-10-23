# SEO-Werkzeuge: Einrichtung und Betrieb

Bei Einrichtung, Datenabruf oder Fehlersuche lesen. Der Arbeitsablauf steht im gemeinsamen SEO-Skill.

## Einrichtung


Node.js **22.12 oder neuer**, npm und der gewünschte Agenten-Client werden benötigt.
Im Repository-Root:

```sh
npm ci
npm run seo:doctor
```

Für DataForSEO `.env.example` als Vorlage für die gitignorierte `.env.local` verwenden.
Eine vorhandene Datei ergänzen, nicht überschreiben. API-Login und API-Passwort aus dem
DataForSEO-Konto lokal eintragen; keine Zugangsdaten in Chats oder Git speichern.

Codex lädt `.codex/config.toml` für vertrauenswürdige Projekte; Claude Code lädt `.mcp.json`
nach der projektspezifischen MCP-Freigabe. Beide Clients im **Repository-Root** öffnen.
Beide starten den exakt versionierten offiziellen Server automatisch per STDIO.
Kein manuell laufender Server, Docker oder Deployment ist nötig.

```sh
npm run seo:mcp:check
codex mcp get dataforseo
```

In Claude Code `/mcp` öffnen. Nach Einrichtung eine neue Agentensitzung starten.
`seo:mcp:check` prüft beide Konfigurationen per MCP-SDK ohne bezahlte API-Abfragen; das ist
kein Nachweis, dass beide Client-Apps installiert oder dort bereits freigegeben sind.
`seo:doctor` meldet fehlende Clients, Schlüssel und private Pfade ohne Secrets auszugeben.

Offizielle Quellen: [DataForSEO MCP](https://github.com/dataforseo/mcp-server-typescript),
[Codex MCP](https://developers.openai.com/codex/mcp),
[Claude Code MCP](https://code.claude.com/docs/en/mcp).

## Befehle


| Befehl | Zweck | API-Kosten |
|---|---|---|
| `npm run dev` | lokale Website | keine |
| `npm run check` | Astro-/TypeScript-Prüfung | keine |
| `npm run build` | Produktionsbuild, ohne Deployment | keine |
| `npm run seo:doctor` | lokale Einrichtung prüfen | keine |
| `npm run seo:mcp:check` | MCP-Handshake für beide Konfigurationen | keine |
| `npm run seo:test` | isolierte Tests mit Testdaten | keine |
| `npm run seo:check` | gebauten Inhalt unter dist/client prüfen | keine |
| `npm run seo:report` | Report aus vorhandenen Daten | keine |
| `npm run seo:request -- <request.json> --execute` | über offiziellen MCP abrufen und vollständig speichern | **ja** |
| `npm run seo:import -- <envelope.json>` | vorhandene vollständige Antwort importieren | keine |
| `npm run seo:sync` | GSC-Snapshot und Report | keine API-Gebühr |
| `npm run seo:inspect -- <url>` | GSC-Indexstatus, kein Indexierungsantrag | keine API-Gebühr |
| `npm run seo:dfs -- ranked <domain>` | bestehender direkter API-Fallback | **ja** |

Weitere alte DFS-Befehle: `competitors`, `volume "kw1, kw2"`, `serp "kw1, kw2"`.
Diese bleiben kompatibel, MCP ist der bevorzugte Recherchezugang. Keine zwei bezahlten
Abrufwege für dieselbe Frage gleichzeitig starten. CI ruft keine SEO-APIs auf.

## Vollständige MCP-Daten speichern

Aktueller MCP-Katalog: `docs_index`, `docs_list_sections`, `docs_search`, `api_request`.
Mit Dokumentationswerkzeugen den passenden Endpunkt prüfen. `api_request` nutzt für
Snapshots **`noAiMode:true`**, damit das normale API-Schema einschließlich Task-IDs und
Kosten erhalten bleibt. Kein Field-Filtering für archivierte Antworten verwenden.

Für große Ergebnisse speichert `seo:request` direkt aus dem MCP-Transport, vor Kürzung
im Chat. Eine Request-Datei unter dem privaten `seo-data/requests/` sieht so aus:

```json
{
  "method": "POST",
  "path": "/v3/dataforseo_labs/google/ranked_keywords/live",
  "data": [{
    "target": "bremer-waermepumpe.de",
    "location_code": 2276,
    "language_code": "de",
    "limit": 100
  }]
}
```

**Der Aufruf kostet Geld.** Vor `--execute` Preis und bewilligtes Restbudget prüfen.
Der Helfer ist kein Budget-Proxy und erzwingt kein Kontolimit. Bei Timeouts nicht blind
wiederholen. Nach einem Importfehler die Originalantwort in `seo-data/pending/` verwenden.

Für bereits vollständig vorliegende MCP-Antworten unterstützt `seo:import` dieses Format:

```json
{
  "schemaVersion": 1,
  "complete": true,
  "source": "dataforseo-mcp",
  "fetchedAt": "2026-10-20T12:00:00Z",
  "endpoint": "/v3/dataforseo_labs/google/ranked_keywords/live",
  "request": [{"target": "bremer-waermepumpe.de", "location_code": 2276, "language_code": "de", "limit": 100}],
  "response": {}
}
```

`response` durch die **vollständige originale API-Antwort** ersetzen; das leere Beispiel
ist absichtlich nicht importierbar. JSON-, Task- und Ergebniszähler sowie Kosten werden
validiert. `complete:true` nur für ungekürzte Antworten setzen. Die Prüfung kann nicht
beweisen, dass nachträglich manipulierte Daten vollständig sind.

Importe erhalten unveränderliche Dateien, identische Task-IDs zählen nur einmal.
Legacy-Snapshots werden weiter gelesen. Der alte Kostenlog ohne Task-IDs wird separat
angezeigt und nicht addiert; der Report ist kein vollständiger DataForSEO-Kontoauszug.
Der Report nimmt pro Abfrage den neuesten gültigen Snapshot, kennzeichnet ältere Quellen
und berichtet leere Ergebnisse anders als fehlende oder kaputte Daten.

## Google Search Console ergänzen

GSC ist optional. Ohne Verbindung sind eigene Klicks, CTR und Indexstatus unbekannt.

1. Search Console API im Google-Cloud-Projekt aktivieren und einen Service Account anlegen.
2. Dessen E-Mail Zugriff auf die passende Search-Console-Property geben.
3. JSON-Schlüssel lokal unter `.secrets/gsc-service-account.json` ablegen; alternativ
   `GSC_SERVICE_ACCOUNT_FILE` oder `GOOGLE_APPLICATION_CREDENTIALS` auf einen lokalen Pfad setzen.
4. Optional `GSC_PROPERTY=sc-domain:bremer-waermepumpe.de` in `.env.local` festlegen.
5. `npm run seo:doctor`, danach `npm run seo:sync` ausführen.

Der Zugriff nutzt `webmasters.readonly`. Snapshots sind datiert; bestehende Tagesstände
werden nicht überschrieben. Bei einem abgebrochenen Lauf die unvollständigen Dateien
prüfen/sichern, statt einen vorhandenen gültigen Snapshot zu löschen.

Referenz: [Search Console API](https://developers.google.com/webmaster-tools/v1/prereqs).

## Prüfungen


```sh
npm run seo:test
npm run check
npm run build
npm run seo:check
git diff --check
```

Der Checker prüft Canonicals, Metadaten, H1, interne Links/Fragmente, Bilder, JSON-LD und
Sitemap-Konsistenz. Er prüft keine externen Links, tatsächliche Google-Indexierung oder
Core Web Vitals. Geschützte dynamische Bereiche werden nicht als Content-Seiten gecrawlt.
Bei sichtbaren Layoutänderungen zusätzlich die betroffene Seite im Browser prüfen.

`npm run deploy` veröffentlicht auf Cloudflare und ist ein separater Auftrag.
Keine Lead-Daten, Zugangsdaten, privaten Reports oder Backups committen. Reale Nutzer-
und Einwilligungsdaten gehören nicht in SEO-Recherche oder Tests.

