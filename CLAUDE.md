# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands are run from `astro-project/`:

```sh
npm install        # Install dependencies
npm run dev        # Start dev server at localhost:4321
npm run build      # Build to ./dist/
npm run preview    # Preview production build locally
npm run astro ...  # Run Astro CLI commands (e.g. astro add, astro check)
```

## Architecture

Astro v6 static site for a German-language heat pump business ("Wärme Guru") targeting the Bremen market. Tailwind CSS v4 is integrated via the `@tailwindcss/vite` plugin (configured in `astro-project/astro.config.mjs`).

- **Language**: All user-facing content is in German (`<html lang="de">`).
- **Routing**: File-based. Files in `src/pages/` map to URL routes.
- **Layout**: Single shared layout at `src/layout/Layout.astro` wraps all pages. It imports the `Head` component (meta/SEO tags) and `NavBar`, and renders a `<slot />` for page content.
- **Components**: `src/components/` — `Head.astro` (meta/OG tags), `NavBar.astro` (site nav).
- **Styling**: Tailwind v4 with a custom design system defined in `src/styles/global.css` via `@theme` block. The file defines semantic color tokens (`background`, `surface`, `surface-alt`, `text`, `text-muted`, `border`, `primary`, `accent`, `highlight`) and reusable component classes (`surface-card`, `btn-accent`, `btn-secondary`, `notice-success`, `input-base`, etc.) in a `@layer components` block. Refer to the comments in that file for usage guidance.
- **Static assets**: `public/` (served at root URL).
- **TypeScript**: Strict mode via `astro/tsconfigs/strict`.

Requires Node >= 22.12.0.

# Project Instructions

## Purpose
This repository contains the website for local SEO and lead generation for Wärmepumpen in Bremen.

## Source of truth for site strategy
Use @.claude/context/waermepumpe-bremen-mvp.md as the source of truth for:
- sitemap
- page purpose
- H1/H2 structure
- conversion logic
- internal linking
- messaging priorities

## Implementation rules
- Prefer implementing the MVP exactly as defined in the strategy doc unless there is a technical conflict.
- Keep the homepage as the main money page for "Wärmepumpe Bremen".
- Do not create duplicate pages targeting the same primary keyword.
- Preserve conversion-first UX on all money pages.