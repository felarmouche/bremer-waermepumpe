# Offene Wartung

Datierte Befunde vor der Bearbeitung erneut prüfen; keine automatisch auszuführenden Aufträge.

### Offener Dependency-Audit (20. Oktober 2026)

`npm audit` meldet nach der Einrichtung 21 Befunde (2 mittel, 18 hoch, 1 kritisch),
gegenüber 17 im ursprünglichen Lockfile. Vier zusätzliche Paketbefunde betreffen
`dataforseo-mcp-server`, `agents` und deren transitive MCP-SDK/Client-Abhängigkeiten
(OAuth-Credential-Weitergabe). Der hier verwendete lokale STDIO-Start nutzt kein OAuth;
das beseitigt die Paketbefunde nicht. Der direkte SDK-Testclient ist auf 1.32.1 fixiert.
Ein automatisches Downgrade des offiziellen Servers auf 3.0.1 wurde nicht vorgenommen.
Der bereits vorhandene kritische Astro-Befund betrifft AVIF-Bildoptimierung
(behoben laut Audit ab 7.2.8). Ein separates, getestetes Dependency-Update ist offen;
diese Einrichtung ist kein bestandener Security-Audit.
