---
name: optimize-bremer-waermepumpe-seo
description: Optimize exactly one existing Astro content page of bremer-waermepumpe.de for sustainable Google search visibility while preserving the site's architecture and preventing keyword cannibalization. Use when an AI coding agent is asked in a new thread to improve, audit, rewrite, or maximize SEO for one page of the Bremer Waermepumpe project, especially for local Bremen search intent, GSC-driven content updates, E-E-A-T signals, metadata, internal links, structured data, CTR opportunities, current funding or regulatory facts, and post-build SEO validation.
---

# Bremer Waermepumpe SEO

Optimize one page end to end. Improve relevance, clarity, trust, CTR potential, and technical correctness without promising rankings or expanding the site architecture.

All page text and visible edits must be in plain German unless the user explicitly requests otherwise. Technical notes to the reviewer may remain in English.

## Phase 1: Gather & Decide

Required:
1. Confirm the primary role: content & SEO editor. Deliverable: a patch that contains only page-scoped content and metadata edits. If a shared component fix is required, document the proposed narrow change and do not commit it without user approval.
2. Read [references/site-contract.md](references/site-contract.md).
3. Locate the repository root and inspect `git status --short --branch`.
4. Identify the target URL unambiguously from the repository, the ownership map, provided GSC data, or direct user confirmation.
5. Read the complete target page before editing.
6. Read the most relevant sibling pages from the URL ownership map.
7. Inspect shared components used by the target page only enough to understand existing head metadata, layout, breadcrumbs, FAQ rendering, and schema generation.

Optional:
8. If the user supplies additional SEO artifacts (for example: a keyword research CSV, brand style guide, or local-schema template), incorporate them; otherwise proceed using only the repository, GSC (if provided), and the guidance below.
9. If no GSC data is provided, use repository content, site search analytics if available, and a 14-day baseline inferred from current SERP intent. State explicitly in the report that GSC data was unavailable and that recommendations are based on repository and public SERP signals only.
10. Use entity SEO guidance only when entity recognition is materially relevant.

Version control:
- Create a feature branch named `seo/<target-path>-<short-desc>` and commit with a message prefixed `seo:`.
- Include a PR summary that lists the established page contract fields and the validation checklist.

If the target URL cannot be unambiguously identified from the repo, the ownership map, or provided GSC data, stop and ask the user. Do not proceed if more than one candidate URL matches the requested scope or if you lack write access to the target file. If multiple candidate URLs match, respond with the candidate list and ask the user to select one.

Do not redesign navigation, add pages, or refactor shared components unless the user explicitly expands the scope or the target page cannot be fixed correctly without a narrowly scoped shared fix.

## Establish The Page Contract

Before editing, write down the working contract:

| Field | Required decision |
| --- | --- |
| Target URL | Exactly one existing URL |
| Primary intent | The single user problem this page must answer best |
| Primary query cluster | One coherent keyword theme, not a list of unrelated terms |
| Local modifier | Bremen or another explicit local intent, if applicable |
| Neighboring URLs | Pages that must remain differentiated |
| Delegated details | Topics to summarize briefly and link to a dedicated spoke |
| Freshness-sensitive claims | Facts that require current primary-source verification |
| Success signals | Relevant GSC and technical metrics |

If the requested target page cannot be identified unambiguously from the repository, ownership map, or provided GSC data, stop and ask the user. Otherwise infer the contract from the repository, GSC data, and current search intent.

## Analyze Search Data

When the user supplies Google Search Console exports or GSC access is available:

- If GSC exports are malformed or incomplete, report the parsing error and proceed with repository-only analysis, marking the missing GSC-derived metrics as "not available".
- If no GSC data is provided, use repository content, site search analytics if available, and a 14-day baseline inferred from current SERP intent. State explicitly in the report that GSC data was unavailable and that recommendations are based on repository and public SERP signals only.

1. Read the query, page, country, device, appearance, filter, and time-series data that exist.
2. Isolate the target URL before drawing conclusions.
3. Prefer `country = Germany` and `search type = Web` for the primary local assessment.
4. Report clicks, impressions, CTR, and average position for the target URL and its main query cluster.
5. Identify high-impression low-CTR opportunities, striking country anomalies, and query-to-URL overlap.
6. Compare the target query cluster against sibling URLs to detect cannibalization.
7. Preserve a concise pre-deploy baseline for 14-day and 28-day measurement.

Do not treat raw impressions from unrelated countries as evidence of local demand. Do not optimize around noisy queries that do not match the page's intended user journey.

## Verify Current Facts

Browse before changing unstable claims. Prefer current official primary sources:

1. Use official Google Search documentation for current SEO guidance.
2. Use KfW, BAFA, BAB Bremen, Bremen service portals, Bremen environmental authorities, laws, or other authoritative institutions for funding and regulatory facts.
3. Record the verification date visibly on pages that contain time-sensitive funding, regulatory, or program eligibility claims.
4. Link visible primary sources near the relevant content or in a clearly labeled source block.
5. Phrase announced but unavailable programs precisely: distinguish planned, announced, closed, and currently applicable offers.

Never invent expert review, partner approval, eligibility guarantees, funding guarantees, or legal certainty. Mark informational content as non-binding when appropriate.

## Design The Optimization

Prefer an answer-first structure:

1. Provide a concise direct answer immediately after the hero.
2. Keep the introduction focused on the actual search intent.
3. Reduce generic market commentary unless it directly helps the user decide.
4. Organize the page around the smallest useful set of choices, steps, or comparisons.
5. Summarize spoke topics and delegate detail with descriptive internal links.
6. Add Bremen-specific value only where it changes the user's understanding or next action.
7. Use plain German, short paragraphs, descriptive headings, lists, and tables where they improve scanning.

For important time-sensitive pages, include:

- a visible checked or updated date
- editorial responsibility linked to `/kontakt/`
- a visible source status
- a non-binding information notice
- transparent CTA wording

For lead-generation CTAs, state that the first classification happens in the browser and that contact data is forwarded to the business named under `/fachpartner/` only after explicit consent.

## Protect Against Cannibalization

Apply these rules:

1. Keep one primary intent per URL.
2. Preserve the ownership boundaries in [references/site-contract.md](references/site-contract.md).
3. Do not copy the full detail scope of a spoke into a hub.
4. Link hubs to spokes with descriptive anchor text.
5. Link spokes back to a relevant hub only when it helps orientation.
6. Avoid titles and H1 headings that make two pages compete for the same dominant query.
7. Re-check query-to-URL distribution after deployment.

## Implement In Astro

Keep edits page-scoped and consistent with existing patterns.

### Metadata

- Use one clear title with the primary intent near the front.
- Write a specific, honest meta description that improves click relevance.
- Keep exactly one visible `h1`.
- Preserve or add an HTTPS self-canonical through the existing layout contract.
- Update `dateModified` whenever visible factual or verification-date changes are added, or otherwise when the page materially changes.
- Add a visible human-readable update date only on pages that contain time-sensitive claims such as funding, regulatory status, or program eligibility. For evergreen technical or informational pages, omit a visible update date.

### Social And Article Image

Use a relevant page-specific hero image for Open Graph and Article schema. When the project uses Astro assets, explicitly generate the social image so the rendered URL points to a real build artifact:

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

Pass `ogImage={ogImage.src}` to the existing layout. After building, resolve the rendered OG URL against `dist/client` and verify that the file exists. Also verify that Article schema uses the same image.

### Structured Data

- Preserve valid existing `Article` and `BreadcrumbList` markup.
- Use visible FAQ content and matching `FAQPage` markup only when FAQs genuinely help the page.
- Keep visible content and schema synchronized.
- Do not add speculative AI schema or schema layers without a real supported purpose.
- Treat schema as machine-readable clarification, not as a ranking shortcut.
- Do not promise FAQ rich results; Google restricts their display substantially.

### E-E-A-T And Trust

Treat E-E-A-T as a quality framework, not a direct ranking factor:

- show editorial responsibility
- cite authoritative sources
- use precise dates for changing facts
- distinguish information from binding advice
- disclose lead handling
- avoid unsupported superlatives and unverifiable claims
- retain HTTPS, canonical clarity, and accessible semantic HTML

## Validate Before Reporting Completion

Run:

```powershell
npx astro check
npm run build
git diff --check
git status --short --branch
```

Inspect the generated HTML for the target route and verify:

- exactly one `h1`
- expected title and meta description
- HTTPS self-canonical
- relevant OG image URL
- OG image artifact exists in `dist/client`
- Article image matches the OG image
- current `dateModified`
- visible primary sources
- visible editorial responsibility where required
- no stale or misleading claim remains
- JSON-LD parses successfully
- existing Article, Breadcrumb, and visible FAQ markup remain synchronized

If OG image generation or `npm run build` fails, do not commit content changes. Record the error, attempt one automated retry, then abort and present the build logs and recommended remediation steps to the user.

When a live site exists, distinguish local validation from deployment state. Check:

- HTTP root redirects to HTTPS
- an HTTP inner route redirects to HTTPS
- live HTTPS target returns `200`
- live canonical is HTTPS
- affected legacy redirects still work

Do not claim that local edits are live before deployment.

## Deployment Handoff

After deployment:

1. Re-check live title, description, canonical, OG image, schema, and sources.
2. Run Google's Rich Results Test for Article and Breadcrumb eligibility.
3. Request indexing for the target URL in GSC.
4. Review GSC after 14 and 28 days with `page = target URL`, `country = Germany`, and `search type = Web`.
5. Compare CTR, impressions, position, and query-to-URL distribution against the saved baseline.
6. Review Core Web Vitals with field data where available: LCP under `2.5 s`, INP under `200 ms`, CLS under `0.1`.

## Report Concisely

State:

1. which single page changed
2. how its intent was sharpened
3. how cannibalization was prevented
4. which current facts and sources were verified
5. which validations passed
6. which actions still require deployment or external dashboard access

Never guarantee traffic or ranking gains. Explain that the work improves relevance, CTR potential, freshness, trust, and technical clarity.
