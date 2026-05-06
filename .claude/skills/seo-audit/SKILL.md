---
description: Führt einen vollständigen SEO-Audit für eine Astro-Website durch. Nutze diesen Skill bei Fragen zu Rankings, Indexierung, Meta Tags, Content, lokaler SEO oder technischer SEO.
allowed-tools: Read, Grep, Glob, Bash(npm run build), Bash(npm run astro check)
---

## Aufgabe

Analysiere diese Astro-Website für SEO mit Fokus auf Deutschland und Bremen.

Prüfe:

1. Technische SEO
   - Title Tags
   - Meta Descriptions
   - Canonical URLs
   - robots.txt
   - sitemap.xml
   - Statuscodes
   - hreflang, falls mehrsprachig
   - index/noindex
   - saubere HTML-Struktur

2. Astro-spezifisch
   - `astro.config.*`
   - `src/layouts`
   - `src/pages`
   - globale SEO-Komponenten
   - statische Generierung
   - fehlerhafte client-side-only Inhalte

3. Lokale SEO
   - Bremen-Bezug
   - NAP-Daten: Name, Adresse, Telefonnummer
   - LocalBusiness Schema
   - Standortseiten
   - Dienstleistung + Ort Keywords
   - lokale Trust-Signale

4. Content
   - Suchintention
   - Keyword-Kannibalisierung
   - fehlende Landingpages
   - Überschriftenstruktur
   - FAQ-Potenzial
   - interne Verlinkung

5. Performance
   - Bilder
   - Fonts
   - JavaScript
   - Core Web Vitals Risiken

Gib das Ergebnis als priorisierte Tabelle aus:

| Priorität | Problem | Datei | Warum wichtig | Lösung |