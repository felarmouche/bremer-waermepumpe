#!/usr/bin/env node
/**
 * Holt Search-Console-Daten per Service Account und legt sie als datierten
 * Snapshot unter seo-data/gsc/YYYY-MM-DD/ ab. Zusätzlich wird die Live-Sitemap
 * gezogen, damit build-report.mjs Seiten ohne Impressionen erkennen kann.
 *
 * Nutzung:
 *   npm run seo:gsc                                  Performance-Snapshot
 *   npm run seo:inspect -- <url> [url …]             Indexierungsstatus einzelner URLs
 *
 * Voraussetzung: .secrets/gsc-service-account.json, Service Account ist in der
 * Search Console als Nutzer der Property freigegeben.
 */
import { createSign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const KEY_FILE = join(ROOT, '.secrets', 'gsc-service-account.json');
const DOMAIN = 'bremer-waermepumpe.de';
const API = 'https://www.googleapis.com/webmasters/v3';
const ROW_LIMIT = 25000;
const MAX_PAGES = 4; // Sicherheitsdeckel: max. 100k Zeilen pro Schnitt

const fail = (msg) => {
  console.error(`FEHLER: ${msg}`);
  process.exit(1);
};

async function getAccessToken() {
  let sa;
  try {
    sa = JSON.parse(readFileSync(KEY_FILE, 'utf8'));
  } catch {
    fail(`Service-Account-Key nicht lesbar: ${KEY_FILE}`);
  }
  const now = Math.floor(Date.now() / 1000);
  const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) fail(`Token-Austausch fehlgeschlagen: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function gsc(token, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) fail(`GSC ${path}: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

async function findProperty(token) {
  const { siteEntry = [] } = await gsc(token, '/sites');
  const mine = siteEntry.filter((s) => s.siteUrl.includes(DOMAIN));
  if (mine.length === 0) {
    fail(
      `Service Account hat keinen Zugriff auf ${DOMAIN}. ` +
        'In der Search Console unter Einstellungen → Nutzer und Berechtigungen freigeben.'
    );
  }
  const domainProp = mine.find((s) => s.siteUrl.startsWith('sc-domain:'));
  return (domainProp ?? mine[0]).siteUrl;
}

async function queryAll(token, siteUrl, body) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await gsc(token, `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      ...body,
      rowLimit: ROW_LIMIT,
      startRow: page * ROW_LIMIT,
    });
    const batch = data.rows ?? [];
    rows.push(...batch);
    if (batch.length < ROW_LIMIT) break;
  }
  return rows;
}

async function inspectUrls(token, siteUrl, urls) {
  for (const url of urls) {
    const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: url, siteUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error(`${url}\n  FEHLER: ${JSON.stringify(data.error ?? data)}`);
      continue;
    }
    const r = data.inspectionResult?.indexStatusResult ?? {};
    console.log(
      `${url}\n  Verdict: ${r.verdict ?? '?'} | ${r.coverageState ?? '?'}\n` +
        `  Zuletzt gecrawlt: ${r.lastCrawlTime ?? '–'} | Google-Kanonisch: ${r.googleCanonical ?? '–'}`
    );
  }
}

async function fetchSitemap(origin) {
  const locs = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return [...(await res.text()).matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
  };
  for (const entry of [`${origin}/sitemap-index.xml`, `${origin}/sitemap.xml`]) {
    try {
      let urls = await locs(entry);
      const subs = urls.filter((u) => u.endsWith('.xml'));
      if (subs.length) urls = (await Promise.all(subs.map(locs))).flat();
      return urls.filter((u) => !u.endsWith('.xml'));
    } catch (e) {
      console.warn(`Sitemap ${entry} nicht ladbar (${e.message})`);
    }
  }
  return [];
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (d) => d.toISOString().slice(0, 10);

const token = await getAccessToken();
const siteUrl = await findProperty(token);
console.log(`Property: ${siteUrl}`);

const inspectFlag = process.argv.indexOf('--inspect');
if (inspectFlag !== -1) {
  const urls = process.argv.slice(inspectFlag + 1).filter((a) => a.startsWith('http'));
  if (!urls.length) fail('Nutzung: npm run seo:inspect -- <url> [url …]');
  await inspectUrls(token, siteUrl, urls);
  process.exit(0);
}

// GSC-Daten laufen ~3 Tage nach; Fenster enden deshalb 3 Tage vor heute.
const end = new Date(Date.now() - 3 * DAY);
const start = new Date(end - 89 * DAY);
const prevEnd = new Date(start - 1 * DAY);
const prevStart = new Date(prevEnd - 89 * DAY);
const windows = {
  current: [iso(start), iso(end)],
  previous: [iso(prevStart), iso(prevEnd)],
};

const outDir = join(ROOT, 'seo-data', 'gsc', iso(new Date()));
mkdirSync(outDir, { recursive: true });

const cuts = { query: ['query'], page: ['page'], 'query-page': ['query', 'page'] };
let pageRows = [];
for (const [cutName, dimensions] of Object.entries(cuts)) {
  for (const [winName, [startDate, endDate]] of Object.entries(windows)) {
    const rows = await queryAll(token, siteUrl, { startDate, endDate, dimensions });
    if (cutName === 'page' && winName === 'current') pageRows = rows;
    writeFileSync(join(outDir, `${cutName}-${winName}.json`), JSON.stringify(rows));
    console.log(`${cutName}-${winName}: ${rows.length} Zeilen`);
  }
}

const trend = await queryAll(token, siteUrl, {
  startDate: windows.current[0],
  endDate: windows.current[1],
  dimensions: ['page', 'date'],
});
writeFileSync(join(outDir, 'page-date-current.json'), JSON.stringify(trend));
console.log(`page-date-current: ${trend.length} Zeilen`);

// Häufigsten Origin aus den Seiten-URLs ableiten (Domain-Property kann www +
// non-www mischen), Fallback auf www.
const originCounts = new Map();
for (const row of pageRows) {
  try {
    const o = new URL(row.keys[0]).origin;
    originCounts.set(o, (originCounts.get(o) ?? 0) + 1);
  } catch {}
}
const origin =
  [...originCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? `https://www.${DOMAIN}`;
const sitemapUrls = await fetchSitemap(origin);
writeFileSync(join(outDir, 'sitemap.json'), JSON.stringify(sitemapUrls, null, 1));
console.log(`sitemap: ${sitemapUrls.length} URLs (${origin})`);

writeFileSync(
  join(outDir, 'meta.json'),
  JSON.stringify({ property: siteUrl, origin, windows, fetchedAt: new Date().toISOString() }, null, 2)
);
console.log(`Snapshot: ${outDir}`);
