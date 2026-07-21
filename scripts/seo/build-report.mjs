#!/usr/bin/env node
/**
 * Verdichtet die neuesten Snapshots aus seo-data/gsc/ und seo-data/dfs/ zu
 * seo-data/REPORT.md — dem Einstiegspunkt für jede Audit-Session.
 * Rein lokal, keine API-Calls. Nutzung: npm run seo:report
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GSC_BASE = join(ROOT, 'seo-data', 'gsc');
const DFS_BASE = join(ROOT, 'seo-data', 'dfs');
const REPORT = join(ROOT, 'seo-data', 'REPORT.md');
const COST_LOG = join(ROOT, 'seo-data', 'dfs-costs.log');

// Schwellwerte (90-Tage-Fenster); bei wenig Traffic hier absenken.
const MIN_IMPR_STRIKING = 30;
const MIN_IMPR_CTR = 40;
const MIN_IMPR_CANNIBAL = 50;
const MIN_VOLUME = 50;
// Zweites Positionsfenster: auf junger Domain liegen die volumenstärksten
// Queries oft jenseits von Pos 15 und fallen sonst aus jedem Abschnitt.
const DEEP_POS_MAX = 45;
const MIN_IMPR_DEEP = 100;
// Zersplitterung: ab so vielen URLs pro Query, solange keine klar dominiert.
const SPREAD_MIN_PAGES = 4;
const SPREAD_MAX_TOP_SHARE = 0.75;
// Themenfilter für die Keyword-Gap. Wettbewerber wie finanztip.de ranken für
// ihr ganzes Portfolio (paypal, elster, …); ohne Filter ersäuft die Gap-Liste
// in themenfremden Millionen-Volumen-Keywords.
// Kurze Tokens (geg, scop, kfw, bafa) brauchen Wortgrenzen — sonst matcht
// z. B. "pflegegeld" über das eingebettete "geg".
const TOPIC_RX = new RegExp(
  [
    'w(ä|ae)rmepumpe',
    'heizung',
    'heizen',
    'heizk(ö|oe)rper',
    'fu(ss|ß)bodenheizung',
    'f(ö|oe)rder',
    'zuschuss',
    'altbau',
    'neubau',
    'fernw(ä|ae)rme',
    'gastherme',
    '(ö|oe)lheizung',
    'klimaanlage',
    'jahresarbeitszahl',
    'k(ä|ae)ltemittel',
    'energieberat',
    'sanierung',
    '\\b(kfw|bafa|geg|scop|jaz)\\b',
  ].join('|'),
  'i'
);
// Grobe Erwartungs-CTR je (gerundeter) Position 1–5.
const EXPECTED_CTR = [0, 0.28, 0.15, 0.1, 0.07, 0.05];

const newestDir = (base) =>
  existsSync(base)
    ? readdirSync(base)
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .at(-1) ?? null
    : null;

// Jüngster Datumsordner, der eine bestimmte Datei enthält. Nötig, weil
// `seo:dfs -- serp` eigene Datumsordner ohne ranked.json anlegt und damit
// sonst den letzten Vollsnapshot verdeckt.
const newestDirWith = (base, file) =>
  existsSync(base)
    ? readdirSync(base)
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse()
        .find((d) => existsSync(join(base, d, file))) ?? null
    : null;

const load = (dir, name) => {
  const p = join(dir, name);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
};

const num = (x) => Math.round(x).toLocaleString('de-DE');
const pct = (x) => `${(100 * x).toFixed(1).replace('.', ',')} %`;
const pos = (x) => x.toFixed(1).replace('.', ',');
const rel = (u) => u.replace(/^https?:\/\/[^/]+/, '') || '/';
const esc = (s) => String(s).replace(/\|/g, '\\|');
const norm = (u) => u.replace(/\/$/, '');

const table = (headers, rows) =>
  rows.length
    ? [
        `| ${headers.join(' | ')} |`,
        `|${headers.map(() => '---').join('|')}|`,
        ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
      ].join('\n')
    : '_Keine Einträge über den Schwellwerten._';

// --- GSC laden -----------------------------------------------------------
const gscDate = newestDir(GSC_BASE);
if (!gscDate) {
  console.error('Kein GSC-Snapshot gefunden. Erst: npm run seo:gsc');
  process.exit(1);
}
const gscDir = join(GSC_BASE, gscDate);
const meta = load(gscDir, 'meta.json');
const pageCur = load(gscDir, 'page-current.json') ?? [];
const pagePrev = load(gscDir, 'page-previous.json') ?? [];
const qpCur = load(gscDir, 'query-page-current.json') ?? [];
const sitemap = load(gscDir, 'sitemap.json') ?? [];

const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0);
const wPos = (rows) => {
  const impr = sum(rows, 'impressions');
  return impr ? rows.reduce((a, r) => a + r.position * r.impressions, 0) / impr : 0;
};

// --- Gewinner / Verlierer -------------------------------------------------
const byPage = (rows) => new Map(rows.map((r) => [norm(r.keys[0]), r]));
const curMap = byPage(pageCur);
const prevMap = byPage(pagePrev);
const deltas = [...new Set([...curMap.keys(), ...prevMap.keys()])]
  .map((url) => {
    const c = curMap.get(url);
    const p = prevMap.get(url);
    return {
      url,
      cur: c?.clicks ?? 0,
      prev: p?.clicks ?? 0,
      delta: (c?.clicks ?? 0) - (p?.clicks ?? 0),
      posCur: c?.position,
      posPrev: p?.position,
    };
  })
  .filter((d) => d.cur + d.prev >= 5 && d.delta !== 0);
const winners = [...deltas].sort((a, b) => b.delta - a.delta).slice(0, 8);
const losers = [...deltas].sort((a, b) => a.delta - b.delta).filter((d) => d.delta < 0).slice(0, 8);

const moverRow = (d) => [
  rel(d.url),
  num(d.prev),
  num(d.cur),
  (d.delta > 0 ? '+' : '') + num(d.delta),
  d.posPrev && d.posCur ? `${pos(d.posPrev)} → ${pos(d.posCur)}` : '–',
];

// --- Striking Distance ------------------------------------------------------
const striking = qpCur
  .filter((r) => r.position >= 4 && r.position <= 15 && r.impressions >= MIN_IMPR_STRIKING)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 20)
  .map((r) => [r.keys[0], rel(r.keys[1]), pos(r.position), num(r.impressions), num(r.clicks)]);

// --- Volumen jenseits der Striking Distance ---------------------------------
// Die grössten Queries stehen auf junger Domain oft auf Pos 20–45. Ohne dieses
// Fenster fallen sie aus Abschnitt 2 und tauchen im Report nirgends auf.
const deepPotential = qpCur
  .filter(
    (r) => r.position > 15 && r.position <= DEEP_POS_MAX && r.impressions >= MIN_IMPR_DEEP
  )
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 10)
  .map((r) => [r.keys[0], rel(r.keys[1]), pos(r.position), num(r.impressions), num(r.clicks)]);

// --- CTR-Lücken -------------------------------------------------------------
const isBrand = (q) => /bremer.?w(ä|ae)rmepumpe/i.test(q);
const ctrGaps = qpCur
  .filter((r) => {
    const p = Math.min(5, Math.round(r.position));
    return (
      r.position <= 5.4 &&
      r.impressions >= MIN_IMPR_CTR &&
      r.ctr < 0.5 * EXPECTED_CTR[p]
    );
  })
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 15)
  .map((r) => [
    r.keys[0] + (isBrand(r.keys[0]) ? ' _(Brand)_' : ''),
    rel(r.keys[1]),
    pos(r.position),
    num(r.impressions),
    pct(r.ctr),
    `~${pct(EXPECTED_CTR[Math.min(5, Math.round(r.position))])}`,
  ]);

// --- Kannibalisierung ---------------------------------------------------------
const byQuery = new Map();
for (const r of qpCur) {
  const q = r.keys[0];
  if (!byQuery.has(q)) byQuery.set(q, []);
  byQuery.get(q).push(r);
}
for (const rows of byQuery.values()) rows.sort((a, b) => b.impressions - a.impressions);

const cannibal = [...byQuery.entries()]
  .map(([q, rows]) => {
    const total = sum(rows, 'impressions');
    const significant = rows.filter((r) => r.impressions / total >= 0.2);
    // Zersplitterung: viele URLs, keine dominiert klar. Diese Fälle rutschen
    // durch den reinen Anteilsfilter, weil bei vielen Seiten kaum eine über
    // 20 % kommt — der Filter wird also blind, je schlimmer der Split ist.
    const spread =
      rows.length >= SPREAD_MIN_PAGES && rows[0].impressions / total < SPREAD_MAX_TOP_SHARE;
    return { q, total, significant, spread, rows };
  })
  .filter((c) => c.total >= MIN_IMPR_CANNIBAL && (c.significant.length >= 2 || c.spread))
  .sort((a, b) => b.total - a.total)
  .slice(0, 15)
  .map((c) => [
    c.q + (c.spread ? ` _(${c.rows.length} URLs)_` : ''),
    num(c.total),
    (c.significant.length >= 2 ? c.significant : c.rows.slice(0, 4))
      .map((r) => `${rel(r.keys[1])} (Pos ${pos(r.position)}, ${pct(r.impressions / c.total)})`)
      .join('<br>'),
  ]);

// --- Seiten ohne Impressionen ---------------------------------------------
const pagesWithImpr = new Set(pageCur.filter((r) => r.impressions > 0).map((r) => norm(r.keys[0])));
const zeroImpr = sitemap.map(norm).filter((u) => !pagesWithImpr.has(u));

// --- DataForSEO -------------------------------------------------------------
const dfsDate = newestDirWith(DFS_BASE, 'ranked.json');
const dfsDir = dfsDate ? join(DFS_BASE, dfsDate) : null;
const dfsSections = [];
if (dfsDir) {
  const rankedItems = (file) =>
    (load(dfsDir, file)?.tasks?.[0]?.result?.[0]?.items ?? []).filter(
      (i) => i.ranked_serp_element?.serp_item?.type === 'organic'
    );
  const kwOf = (i) => i.keyword_data?.keyword;
  const volOf = (i) => i.keyword_data?.keyword_info?.search_volume ?? 0;
  const rankOf = (i) => i.ranked_serp_element?.serp_item?.rank_group ?? 999;
  const urlOf = (i) => i.ranked_serp_element?.serp_item?.url ?? '';

  const own = rankedItems('ranked.json');
  if (own.length) {
    const ownRaw = load(dfsDir, 'ranked.json')?.tasks?.[0]?.result?.[0];
    const o = ownRaw?.metrics?.organic ?? {};
    dfsSections.push(
      `**Ranking-Verteilung** (${ownRaw?.total_count ?? own.length} Keywords, Snapshot ${dfsDate}): ` +
        `Top 3: ${(o.pos_1 ?? 0) + (o.pos_2_3 ?? 0)} | Pos 4–10: ${o.pos_4_10 ?? 0} | ` +
        `Pos 11–20: ${o.pos_11_20 ?? 0} | Pos 21–50: ${(o.pos_21_30 ?? 0) + (o.pos_31_40 ?? 0) + (o.pos_41_50 ?? 0)} | ` +
        `geschätzter Traffic-Wert (ETV): ${num(o.etv ?? 0)}`
    );
    const opps = own
      .filter((i) => rankOf(i) >= 11 && rankOf(i) <= 30 && volOf(i) >= MIN_VOLUME)
      .sort((a, b) => volOf(b) - volOf(a))
      .slice(0, 20)
      .map((i) => [kwOf(i), num(volOf(i)), rankOf(i), rel(urlOf(i))]);
    dfsSections.push(
      `### Volumen-Chancen (Position 11–30, Volumen ≥ ${MIN_VOLUME})\n\n` +
        table(['Keyword', 'Vol./Monat', 'Pos', 'Seite'], opps)
    );

    const ownKeywords = new Set(own.map(kwOf));
    const gapMap = new Map();
    for (const f of readdirSync(dfsDir).filter((f) => f.startsWith('ranked_'))) {
      const domain = f.replace(/^ranked_/, '').replace(/\.json$/, '');
      for (const i of rankedItems(f)) {
        if (
          rankOf(i) <= 20 &&
          volOf(i) >= MIN_VOLUME &&
          !ownKeywords.has(kwOf(i)) &&
          TOPIC_RX.test(kwOf(i))
        ) {
          const e = gapMap.get(kwOf(i)) ?? { vol: volOf(i), who: [] };
          e.who.push(`${domain} (Pos ${rankOf(i)})`);
          gapMap.set(kwOf(i), e);
        }
      }
    }
    if (gapMap.size) {
      const gap = [...gapMap.entries()]
        .sort((a, b) => b[1].vol - a[1].vol)
        .slice(0, 20)
        .map(([kw, e]) => [kw, num(e.vol), e.who.join(', ')]);
      dfsSections.push(`### Keyword-Gap (Wettbewerber Top 20, wir nicht in Top 100)\n\n` + table(['Keyword', 'Vol./Monat', 'Wer rankt'], gap));
    } else {
      dfsSections.push(
        '_Keyword-Gap: keine Wettbewerber-Snapshots vorhanden. ' +
          'Für die Gap-Analyse: `npm run seo:dfs -- ranked <wettbewerber-domain>`._'
      );
    }
  }

  const comp = load(dfsDir, 'competitors.json')?.tasks?.[0]?.result?.[0]?.items ?? [];
  if (comp.length) {
    const rows = comp
      .filter((c) => c.domain !== 'bremer-waermepumpe.de')
      .slice(0, 10)
      .map((c) => [c.domain, num(c.intersections ?? 0), c.avg_position ? pos(c.avg_position) : '–']);
    dfsSections.push(`### Wettbewerber (gemeinsame Keywords)\n\n` + table(['Domain', 'Gemeinsame Keywords', 'Ø-Position'], rows));
  }
}
if (!dfsSections.length) {
  dfsSections.push('_Noch kein DataForSEO-Snapshot. Erzeugen mit `npm run seo:dfs` (kostet Cents)._');
}

// --- Monatskosten DFS -------------------------------------------------------
let costLine = '';
if (existsSync(COST_LOG)) {
  const month = new Date().toISOString().slice(0, 7);
  const total = readFileSync(COST_LOG, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith(month))
    .reduce((s, l) => s + Number(l.split('\t')[2] ?? 0), 0);
  costLine = `DataForSEO-Kosten im ${month}: $${total.toFixed(2)}`;
}

// --- Nächste Schritte --------------------------------------------------------
const nextSteps = [];
if (ctrGaps.length)
  nextSteps.push(`**Snippet-Fix:** ${ctrGaps[0][1]} — Query „${ctrGaps[0][0]}" holt bei Position ${ctrGaps[0][2]} nur ${ctrGaps[0][4]} CTR. Title/Description schärfen.`);
if (striking.length)
  nextSteps.push(`**Inhalt erweitern:** ${striking[0][1]} — „${striking[0][0]}" steht bei Position ${striking[0][2]} mit ${striking[0][3]} Impressionen. Abschnitt/H2 zur Query ergänzen.`);
if (deepPotential.length)
  nextSteps.push(`**Grösstes ungenutztes Volumen:** „${deepPotential[0][0]}" — ${deepPotential[0][3]} Impressionen auf Position ${deepPotential[0][2]} (${deepPotential[0][1]}). Ausserhalb der Striking Distance, aber der grösste Hebel.`);
if (cannibal.length)
  nextSteps.push(`**Kannibalisierung klären:** „${cannibal[0][0]}" verteilt sich auf mehrere Seiten. Intent trennen oder intern konsolidieren (keine URL-Änderung!).`);
if (losers.length)
  nextSteps.push(`**Decay verteidigen:** ${rel(losers[0].url)} verliert (${num(losers[0].prev)} → ${num(losers[0].cur)} Klicks). Inhalt aktualisieren, Konkurrenz-SERP prüfen.`);
nextSteps.push('Regel: **eine Maßnahme pro Seite pro Zyklus**, Umsetzung via `/optimize-bremer-waermepumpe-seo`, Wirkung nach 2–4 Wochen im nächsten Report prüfen.');

// --- Report schreiben --------------------------------------------------------
const [curW, prevW] = [meta?.windows?.current, meta?.windows?.previous];
const md = `# SEO-Report bremer-waermepumpe.de

Generiert: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} | GSC-Snapshot: ${gscDate} | Property: ${meta?.property ?? '?'}
Fenster: **${curW?.[0]} bis ${curW?.[1]}** vs. ${prevW?.[0]} bis ${prevW?.[1]} ${costLine ? `| ${costLine}` : ''}

**Gesamt:** ${num(sum(pageCur, 'clicks'))} Klicks (Vorperiode: ${num(sum(pagePrev, 'clicks'))}) | ${num(sum(pageCur, 'impressions'))} Impressionen (${num(sum(pagePrev, 'impressions'))}) | Ø-Position ${pos(wPos(pageCur))} (${pos(wPos(pagePrev))})

## 1. Gewinner / Verlierer (Klicks, 90 Tage vs. Vorperiode)

### Gewinner
${table(['Seite', 'Vorher', 'Jetzt', 'Δ', 'Position'], winners.map(moverRow))}

### Verlierer
${table(['Seite', 'Vorher', 'Jetzt', 'Δ', 'Position'], losers.map(moverRow))}

## 2. Striking Distance (Position 4–15, Impressionen ≥ ${MIN_IMPR_STRIKING})

${table(['Query', 'Seite', 'Pos', 'Impr.', 'Klicks'], striking)}

## 2b. Volumen jenseits der Striking Distance (Pos 16–${DEEP_POS_MAX}, Impr. ≥ ${MIN_IMPR_DEEP})

${table(['Query', 'Seite', 'Pos', 'Impr.', 'Klicks'], deepPotential)}

## 3. CTR-Lücken (Top-5-Position, CTR < 50 % der Erwartung, Impressionen ≥ ${MIN_IMPR_CTR})

${table(['Query', 'Seite', 'Pos', 'Impr.', 'CTR', 'Erwartung'], ctrGaps)}

## 4. Kannibalisierung (≥ 2 Seiten mit ≥ 20 % Anteil — oder ≥ ${SPREAD_MIN_PAGES} URLs ohne klaren Favoriten)

${table(['Query', 'Impr. gesamt', 'Seiten'], cannibal)}

## 5. Sitemap-Seiten ohne Impressionen (${zeroImpr.length})

${zeroImpr.length ? zeroImpr.map((u) => `- ${rel(u)}`).join('\n') + '\n\nIndexstatus prüfen: `npm run seo:inspect -- <volle-url>`' : '_Alle Sitemap-Seiten haben Impressionen._'}

## 6. DataForSEO

${dfsSections.join('\n\n')}

## 7. Nächste Schritte (Kandidaten — Agent priorisiert)

${nextSteps.map((s) => `- ${s}`).join('\n')}
`;

writeFileSync(REPORT, md);
console.log(`Report: ${REPORT}`);
console.log(
  `Gewinner: ${winners.length} | Verlierer: ${losers.length} | Striking: ${striking.length} | ` +
    `Tiefes Volumen: ${deepPotential.length} | CTR-Lücken: ${ctrGaps.length} | ` +
    `Kannibalisierung: ${cannibal.length} | Ohne Impressionen: ${zeroImpr.length}` +
    (dfsDate ? ` | DFS-Snapshot: ${dfsDate}` : ' | DFS: keiner')
);
