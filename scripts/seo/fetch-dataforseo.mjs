#!/usr/bin/env node
/**
 * DataForSEO-Abfragen; Snapshots landen unter seo-data/dfs/YYYY-MM-DD/.
 * Jeder Call kostet Geld (Cents) — die tatsächlichen Kosten stehen in der
 * API-Antwort und werden nach seo-data/dfs-costs.log protokolliert.
 *
 * Nutzung (Credentials via .env.local, npm-Script lädt sie automatisch):
 *   npm run seo:dfs                        ranked_keywords eigene Domain
 *   npm run seo:dfs -- ranked <domain>     ranked_keywords Wettbewerber (Gap-Basis)
 *   npm run seo:dfs -- competitors         Wettbewerber-Domains
 *   npm run seo:dfs -- volume "kw1, kw2"   Suchvolumen/CPC/Difficulty einzelner Keywords
 *   npm run seo:dfs -- serp "kw1, kw2"     Live-SERPs für einzelne Keywords
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OWN_DOMAIN = 'bremer-waermepumpe.de';
const LOCATION = 2276; // Deutschland
const LANGUAGE = 'de';
const COST_LOG = join(ROOT, 'seo-data', 'dfs-costs.log');

const fail = (msg) => {
  console.error(`FEHLER: ${msg}`);
  process.exit(1);
};

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;
if (!LOGIN || !PASSWORD) {
  fail('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD fehlen. In .env.local im Projekt-Root eintragen.');
}
const AUTH = `Basic ${Buffer.from(`${LOGIN}:${PASSWORD}`).toString('base64')}`;

function logCost(label, cost) {
  mkdirSync(dirname(COST_LOG), { recursive: true });
  appendFileSync(COST_LOG, `${new Date().toISOString()}\t${label}\t${cost ?? 0}\n`);
  const month = new Date().toISOString().slice(0, 7);
  const total = readFileSync(COST_LOG, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith(month))
    .reduce((sum, l) => sum + Number(l.split('\t')[2] ?? 0), 0);
  console.log(`Kosten dieser Call: $${(cost ?? 0).toFixed(4)} | Monat ${month} gesamt: $${total.toFixed(4)}`);
}

async function post(path, tasks, label) {
  const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
    method: 'POST',
    headers: { authorization: AUTH, 'content-type': 'application/json' },
    body: JSON.stringify(tasks),
  });
  const data = await res.json();
  if (data.status_code !== 20000) fail(`${path}: ${data.status_code} ${data.status_message}`);
  for (const t of data.tasks ?? []) {
    if (t.status_code !== 20000) console.warn(`Task-Fehler: ${t.status_code} ${t.status_message}`);
  }
  logCost(label, data.cost);
  return data;
}

const iso = new Date().toISOString().slice(0, 10);
const outDir = join(ROOT, 'seo-data', 'dfs', iso);
mkdirSync(outDir, { recursive: true });
const save = (name, data) => {
  const file = join(outDir, name);
  writeFileSync(file, JSON.stringify(data));
  console.log(`Gespeichert: ${file}`);
};

const [cmd = 'ranked', ...rest] = process.argv.slice(2);

if (cmd === 'ranked') {
  const target = rest[0] ?? OWN_DOMAIN;
  const data = await post(
    '/dataforseo_labs/google/ranked_keywords/live',
    [
      {
        target,
        location_code: LOCATION,
        language_code: LANGUAGE,
        limit: 1000,
        ignore_synonyms: true,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      },
    ],
    `ranked ${target}`
  );
  const result = data.tasks?.[0]?.result?.[0];
  const organic = result?.metrics?.organic ?? {};
  console.log(
    `${target}: ${result?.total_count ?? 0} Keywords | ` +
      `Top 3: ${(organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0)} | ` +
      `Pos 4–10: ${organic.pos_4_10 ?? 0} | Pos 11–20: ${organic.pos_11_20 ?? 0} | ` +
      `ETV: ${Math.round(organic.etv ?? 0)}`
  );
  save(target === OWN_DOMAIN ? 'ranked.json' : `ranked_${target.replace(/[^a-z0-9.-]/gi, '_')}.json`, data);
} else if (cmd === 'competitors') {
  const data = await post(
    '/dataforseo_labs/google/competitors_domain/live',
    [{ target: OWN_DOMAIN, location_code: LOCATION, language_code: LANGUAGE, limit: 30 }],
    'competitors'
  );
  const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
  for (const c of items.slice(0, 10)) {
    console.log(
      `${c.domain} | gemeinsame Keywords: ${c.intersections ?? '?'} | Ø-Position: ${c.avg_position ?? '?'}`
    );
  }
  save('competitors.json', data);
} else if (cmd === 'volume') {
  const keywords = rest
    .join(' ')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keywords.length) fail('Nutzung: npm run seo:dfs -- volume "keyword1, keyword2"');
  const data = await post(
    '/dataforseo_labs/google/keyword_overview/live',
    [{ keywords, location_code: LOCATION, language_code: LANGUAGE }],
    `volume ${keywords.length}kw`
  );
  const items = data.tasks?.[0]?.result?.[0]?.items ?? [];
  for (const i of items) {
    const ki = i.keyword_info ?? {};
    const diff = i.keyword_properties?.keyword_difficulty;
    console.log(
      `${i.keyword} | vol=${ki.search_volume ?? '?'} | cpc=${ki.cpc ?? '?'} | comp=${ki.competition_level ?? '?'} | difficulty=${diff ?? '?'}`
    );
  }
  save(`volume-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.json`, data);
} else if (cmd === 'serp') {
  const keywords = rest
    .join(' ')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keywords.length) fail('Nutzung: npm run seo:dfs -- serp "keyword1, keyword2"');
  // Der Live-Endpoint akzeptiert nur einen Task pro Request — daher einzeln abfragen.
  const data = { tasks: [] };
  for (const keyword of keywords) {
    const single = await post(
      '/serp/google/organic/live/advanced',
      [{ keyword, location_code: LOCATION, language_code: LANGUAGE, device: 'desktop', depth: 20 }],
      `serp ${keyword}`
    );
    data.tasks.push(...(single.tasks ?? []));
  }
  for (const task of data.tasks ?? []) {
    const items = (task.result?.[0]?.items ?? []).filter((i) => i.type === 'organic');
    console.log(`\n"${task.data?.keyword}":`);
    for (const i of items.slice(0, 10)) {
      console.log(`  ${String(i.rank_group).padStart(2)}. ${i.domain}  ${i.url}`);
    }
  }
  save(`serp-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.json`, data);
} else {
  fail(`Unbekanntes Kommando "${cmd}". Verfügbar: ranked [domain] | competitors | volume "kw1, kw2" | serp "kw1, kw2"`);
}
