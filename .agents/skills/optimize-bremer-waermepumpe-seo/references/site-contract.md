# Bremer Waermepumpe Site Contract

Read this file before optimizing a content page. Confirm the current repository state because URLs and ownership boundaries can evolve.

## Architecture Rules

- Optimize one explicit existing page per thread.
- Preserve the current site architecture unless the user explicitly changes scope.
- Do not add pages, navigation entries, redirects, or shared-component refactors as incidental SEO work.
- Use hubs for concise orientation and spokes for depth.
- Keep `/check/`, `/kontakt/`, and `/fachpartner/` flows transparent.
- Preserve truthful editorial and business attribution.

## Current URL Ownership Map

| URL | Primary ownership |
| --- | --- |
| `/` | Local Bremen heat-pump service overview and main conversion entry |
| `/waermepumpe-foerderung-bremen/` | Local info-first funding hub for Bremen |
| `/kfw-458-waermepumpe/` | KfW 458 calculation, residential units, application details, and special cases |
| `/bafa-foerderung-waermepumpe/` | BAFA heating optimization and iSFP detail |
| `/bab-heizungstausch-bremen/` | Closed BAB heating-replacement program and historical or legacy applications |
| `/waermepumpe-foerderung-2026/` | Nationwide 2026 funding changes |
| `/waermepumpe-kosten-bremen/` | Local Bremen heat-pump cost overview |
| `/waermepumpe-kosten-einfamilienhaus/` | Cost detail for detached houses |
| `/luft-wasser-waermepumpe-kosten/` | Air-to-water heat-pump cost detail |
| `/waermepumpe-altbau-bremen/` | Local suitability and decisions for existing buildings in Bremen |
| `/waermepumpe-altbau-kosten/` | Cost detail for existing buildings |
| `/waermepumpe-oder-gasheizung-bremen/` | Local system comparison and decision support |
| `/waermepumpe-abstand-nachbar-bremen/` | Local distance, neighbor, and placement questions |

If a target page overlaps with this map, retain its owned intent and delegate neighboring details with descriptive internal links.

## Shared Astro Contracts

Inspect these files before changing markup patterns:

| File | Purpose |
| --- | --- |
| `src/components/Head.astro` | Metadata, canonical handling, social tags, and page schema |
| `src/components/FAQSection.astro` | Visible FAQs and synchronized FAQ schema |
| `src/components/Breadcrumb.astro` | Visible breadcrumbs and BreadcrumbList schema |
| target page imports | Existing layout and reusable content patterns |

## Primary Source Starting Points

Use these as starting points and verify their current contents before publishing:

### Google Search

- Helpful content: <https://developers.google.com/search/docs/fundamentals/creating-helpful-content>
- AI features: <https://developers.google.com/search/docs/appearance/ai-features>
- Title links: <https://developers.google.com/search/docs/appearance/title-link>
- Snippets: <https://developers.google.com/search/docs/appearance/snippet>
- Core Web Vitals: <https://developers.google.com/search/docs/appearance/core-web-vitals>
- FAQ markup: <https://developers.google.com/search/docs/appearance/structured-data/faqpage>

### Funding And Bremen

- KfW 458: <https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-%28458%29/>
- BAFA heating optimization: <https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/Sanierung_Wohngebaeude/Heizungsoptimierung/heizungsoptimierung_node.html>
- BAB Bremen news: <https://www.bab-bremen.de/de/page/news/82957>
- Bremen service portal: <https://www.service.bremen.de/dienstleistungen/foerderung-fuer-den-heizungstausch-beantragen-190934>
- Bremen GEG guidance: <https://umwelt.bremen.de/klima/energie/gebaeudeenergiegesetz-geg/anforderungen-an-bestehende-gebaeude-2387269>
- Bremen heat planning: <https://umwelt.bremen.de/klima/waermewende/die-kommunale-waermeplanung-2383791>

Add page-specific primary sources when the target intent requires them. Do not treat this list as a substitute for current-source verification.
