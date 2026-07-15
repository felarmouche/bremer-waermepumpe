---
name: optimize-bremer-waermepumpe-seo
description: Optimize exactly one existing Astro content page of bremer-waermepumpe.de for sustainable Google search visibility, driven by the local GSC and DataForSEO snapshots in seo-data/, while preserving the site architecture and preventing keyword cannibalization. Use when asked to improve, audit, rewrite, or maximize SEO for one page of this project, especially for local Bremen search intent, data-driven content updates, E-E-A-T signals, metadata, internal links, structured data, CTR opportunities, current funding or regulatory facts, and post-build SEO validation.
---

# Bremer Waermepumpe SEO

Optimize one page end to end. Improve relevance, clarity, trust, CTR potential, and technical correctness without promising rankings or expanding the site architecture.

All page text and visible edits must be in plain German unless the user explicitly requests otherwise. Technical notes to the reviewer may remain in English.

Scope guard: the deliverable is a patch containing only page-scoped content and metadata edits. Do not redesign navigation, add pages, change URLs, or refactor shared components. If a narrow shared-component fix is unavoidable, document the proposed change and get user approval before committing it.

## Phase 1: Read The Data

`seo-data/REPORT.md` is the entry point for every optimization. It condenses the latest Search Console and DataForSEO snapshots into ranked findings (winners/losers, striking distance, CTR gaps, cannibalization, zero-impression pages, volume opportunities, keyword gap).

| Command | Purpose | Cost |
| --- | --- | --- |
| `npm run seo:sync` | Fresh GSC snapshot + rebuild REPORT.md | free |
| `npm run seo:report` | Rebuild REPORT.md from existing snapshots | free |
| `npm run seo:dfs -- serp "kw1, kw2"` | Live SERP for specific keywords | cents |
| `npm run seo:inspect -- <full-url>` | Google index status of a URL | free |

Rules:
- If the newest snapshot under `seo-data/gsc/` is older than 7 days, run `npm run seo:sync` first.
- Raw data lives in `seo-data/gsc/<date>/` (GSC: query, page, query-page, page-date, sitemap) and `seo-data/dfs/<date>/` (DataForSEO: ranked keywords with volumes, competitors, SERPs). Consult raw files when the report's top-N tables are not enough — `query-page-current.json` holds the full query set per page.
- Dated snapshots are the measurement baseline. Never delete them; comparing the post-deploy snapshot against the pre-deploy snapshot is how success is judged.
- DataForSEO calls cost money and are logged to `seo-data/dfs-costs.log`. Run `serp` only when the edit depends on knowing the live SERP (who ranks, which formats). Monthly `ranked`/`competitors` refreshes are routine maintenance, not part of a page optimization.

## Phase 2: Select The Target Page

Exactly one existing URL per run.

- If the user names a page, use it.
- If not, propose candidates from REPORT.md section "Nächste Schritte" and let the user pick.
- If the requested target is ambiguous (multiple matching URLs) or the file is not writable, stop, list the candidates, and ask.

The data determines the intervention type. Apply **one intervention per page per cycle**, so the next report can attribute the effect:

| Finding in REPORT.md | Intervention |
| --- | --- |
| CTR gap (good position, weak CTR) | Sharpen title and meta description; align snippet with dominant query wording |
| Striking distance (position 4–15) | Extend content: add a section/H2 that answers the specific query |
| Loser / decay | Refresh facts, dates, sources; check live SERP for new competitor formats |
| Cannibalization | Sharpen intent boundaries between the affected pages; fix titles/H1s that compete |
| Zero impressions | Check index status via `npm run seo:inspect` before touching content |

## Phase 3: Gather Context

1. Read [references/site-contract.md](references/site-contract.md) — architecture rules, URL ownership map, shared Astro contracts, primary sources.
2. Inspect `git status --short --branch`; work on a feature branch `seo/<target-path>-<short-desc>`, commit messages prefixed `seo:`.
3. Read the complete target page before editing.
4. Read the neighboring pages from the ownership map that must stay differentiated.
5. Inspect shared components (`Head.astro`, `FAQSection.astro`, `Breadcrumb.astro`) only enough to use their existing metadata, breadcrumb, FAQ, and schema contracts.

## Phase 4: Establish The Page Contract

Write down the working contract before editing:

| Field | Required decision |
| --- | --- |
| Target URL | Exactly one existing URL |
| Primary intent | The single user problem this page must answer best |
| Primary query cluster | One coherent keyword theme from the GSC data, not a list of unrelated terms |
| Local modifier | Bremen intent, or explicitly none (de-localized cost spokes) |
| Neighboring URLs | Pages that must remain differentiated |
| Delegated details | Topics to summarize briefly and link to a dedicated spoke |
| Freshness-sensitive claims | Facts that require current primary-source verification |
| Success signals | Target queries and expected movement (CTR, position, clicks) checkable in the next report |

Ground the contract in the target's actual query set from `query-page-current.json`: which queries drive impressions, at which positions, with which CTR. Do not optimize around noisy queries that do not match the page's intended user journey, and do not treat impressions from unrelated countries as local demand.

## Phase 5: Verify Current Facts

Browse before changing unstable claims. Prefer current official primary sources (starting points in the site contract):

1. Official Google Search documentation for SEO guidance.
2. KfW, BAFA, BAB Bremen, Bremen service portals, Bremen environmental authorities, and laws for funding and regulatory facts.
3. Record the verification date visibly on pages with time-sensitive funding, regulatory, or eligibility claims.
4. Link visible primary sources near the relevant content or in a clearly labeled source block.
5. Distinguish planned, announced, closed, and currently applicable programs precisely.

Never invent expert review, partner approval, eligibility guarantees, funding guarantees, or legal certainty. Mark informational content as non-binding when appropriate.

## Phase 6: Design The Optimization

Prefer an answer-first structure:

1. Provide a concise direct answer immediately after the hero.
2. Keep the introduction focused on the actual search intent.
3. Organize the page around the smallest useful set of choices, steps, or comparisons.
4. Summarize spoke topics and delegate detail with descriptive internal links.
5. Add Bremen-specific value only where it changes the user's understanding or next action — and never on the de-localized cost spokes (see site contract).
6. Use plain German, short paragraphs, descriptive headings, lists, and tables where they improve scanning.

For time-sensitive pages include: a visible checked/updated date, editorial responsibility linked to `/kontakt/`, visible source status, a non-binding information notice, and transparent CTA wording. For lead-generation CTAs, state that the first classification happens in the browser and that contact data is forwarded to the business named under `/fachpartner/` only after explicit consent.

Cannibalization protection:

1. One primary intent per URL; preserve the ownership boundaries in the site contract.
2. Do not copy the full detail scope of a spoke into a hub.
3. Link hubs to spokes with descriptive anchor text; link spokes back to a hub only when it helps orientation.
4. Avoid titles and H1s that make two pages compete for the same dominant query — REPORT.md section "Kannibalisierung" shows current overlaps; check whether the target is involved before and after the edit.

## Phase 7: Implement In Astro

Keep edits page-scoped and consistent with existing patterns.

Metadata:
- One clear title with the primary intent near the front; a specific, honest meta description that improves click relevance.
- Exactly one visible `h1`; HTTPS self-canonical through the existing layout contract.
- Update `dateModified` when the page materially changes. Add a visible human-readable update date only on pages with time-sensitive claims; omit it on evergreen pages.

Social and Article image — generate the OG image explicitly so the rendered URL points to a real build artifact:

```astro
import { getImage } from "astro:assets";

const ogImage = await getImage({
  src: heroImage,
  width: 1200,
  height: 630,
  fit: "cover",
  format: "jpg",
});
```

Pass `ogImage={ogImage.src}` to the layout. After building, verify the rendered OG URL resolves to a file under `dist/client` and that Article schema uses the same image.

Structured data:
- Preserve valid existing `Article` and `BreadcrumbList` markup; keep visible content and schema synchronized.
- Use `FAQPage` markup only with genuinely helpful visible FAQs; do not promise FAQ rich results.
- No speculative schema layers without a real supported purpose.

E-E-A-T (quality framework, not a ranking factor): show editorial responsibility, cite authoritative sources, use precise dates for changing facts, distinguish information from binding advice, disclose lead handling, avoid unsupported superlatives.

## Phase 8: Validate Before Reporting Completion

```powershell
npx astro check
npm run build
git diff --check
git status --short --branch
```

Inspect the generated HTML for the target route: exactly one `h1`; expected title and description; HTTPS self-canonical; OG image URL resolves to an artifact in `dist/client`; Article image matches; current `dateModified`; visible sources and editorial responsibility where required; JSON-LD parses; no stale claim remains.

If the build or OG generation fails, do not commit content changes — present the error and remediation steps instead. Do not claim local edits are live before deployment.

## Phase 9: Deployment & Measurement

After deployment:

1. Re-check live title, description, canonical, OG image, schema, and sources on the live URL.
2. Verify index status: `npm run seo:inspect -- <live-url>`; request indexing manually in the GSC UI (the API cannot request indexing).
3. Run Google's Rich Results Test for Article and Breadcrumb eligibility.
4. After 14–28 days, run `npm run seo:sync` and compare the new REPORT.md and snapshot against the pre-deploy snapshot: CTR, position, clicks for the target queries, and the query-to-URL distribution (cannibalization section).
5. Core Web Vitals with field data where available: LCP < 2.5 s, INP < 200 ms, CLS < 0.1.

## Report Concisely

State: which single page changed, how its intent was sharpened, how cannibalization was prevented, which facts and sources were verified, which validations passed, and which actions still require deployment or the GSC UI. Name the concrete success signals to check in the next report.

Never guarantee traffic or ranking gains. The work improves relevance, CTR potential, freshness, trust, and technical clarity.
