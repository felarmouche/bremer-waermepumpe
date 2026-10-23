#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/environment.mjs';
import { dfsRecords, latestTasks, costSummary } from './lib/snapshots.mjs';

const SITE = 'bremer-waermepumpe.de';
const esc = x => String(x ?? 'unbekannt').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const num = x => Number.isFinite(x) ? x.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : 'unbekannt';
const pct = x => Number.isFinite(x) ? `${num(x * 100)} %` : 'unbekannt';
const path = u => { try { return new URL(u).pathname; } catch { return u; } };
const norm = u => u.replace(/\/$/, '');
const table = (headers, rows) => rows.length ? `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map(r => `| ${r.map(esc).join(' | ')} |`).join('\n')}` : '_Keine Einträge in den verfügbaren Daten._';
const age = (date, now, days) => (Date.parse(now) - Date.parse(date)) / 86400000 > days ? 'veraltet' : 'aktuell';

export function loadGsc(base) {
  const dir = join(base, 'gsc'), issues = [];
  if (!existsSync(dir)) return { data: null, issues };
  for (const date of readdirSync(dir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse()) {
    try {
      const read = name => JSON.parse(readFileSync(join(dir, date, name), 'utf8'));
      const meta = read('meta.json');
      if (!meta.property || !meta.windows?.current?.length || !meta.windows?.previous?.length) throw new Error('Metadaten unvollständig');
      const data = { date, meta, page: read('page-current.json'), previous: read('page-previous.json'), queryPage: read('query-page-current.json'), sitemap: read('sitemap.json') };
      for (const key of ['page', 'previous', 'queryPage']) {
        if (!Array.isArray(data[key]) || data[key].some(r => !Array.isArray(r.keys) || r.keys.length !== (key === 'queryPage' ? 2 : 1) || r.keys.some(k => typeof k !== 'string') || ['clicks', 'impressions', 'ctr', 'position'].some(k => !Number.isFinite(r[k])))) throw new Error(`Ungültige Zeilen: ${key}`);
      }
      if (!Array.isArray(data.sitemap) || data.sitemap.some(u => typeof u !== 'string')) throw new Error('Ungültige Sitemap');
      return { data, issues };
    } catch { issues.push(`GSC ${date}: unvollständig oder fehlerhaft; verwende älteren gültigen Snapshot, sofern vorhanden.`); }
  }
  return { data: null, issues };
}

export function buildReport(base, now = new Date().toISOString()) {
  const { records, issues } = dfsRecords(base);
  const tasks = latestTasks(records);
  const gsc = loadGsc(base);
  const sections = [`# SEO-Report ${SITE}\n\nGeneriert: ${now}\n\nDataForSEO liefert externe Ranking-/Volumenschätzungen. GSC liefert eigene Suchperformance. Beide sind getrennte Datenquellen; fehlende Daten sind keine Nullmessung.`];
  const costs = costSummary(base, records, now.slice(0, 7));
  sections.push(`## Datenstand und Kosten\n\n${table(['Quelle', 'Stand', 'Status'], [
    ['GSC', gsc.data?.date ?? 'fehlt', gsc.data ? `${age(gsc.data.date, now, 7)}; ${gsc.data.page.length} Seitenzeilen` : 'Klicks, CTR und Indexstatus unbekannt'],
    ...tasks.map(r => [r.task.data?.function ?? r.endpoint, r.fetchedAt, `${age(r.fetchedAt, now, 30)}; ${r.task.data?.target ?? r.task.data?.keyword ?? 'Keyword-Abfrage'}`]),
  ])}\n\nKosten ${now.slice(0, 7)}: **$${costs.verified.toFixed(5)}**, ${costs.tasks} eindeutige Tasks aus gespeicherten Antworten.\nLegacy-Kostenlog: $${costs.legacy.toFixed(5)} separat, nicht addiert (kann dieselben Calls enthalten). Dies ist kein vollständiger Kontoauszug und kein Ausgabenlimit.`);
  if (issues.length || gsc.issues.length) sections.push(`### Datenfehler\n\n${[...issues, ...gsc.issues].map(i => `- ${i}`).join('\n')}`);
  const next = [];
  if (gsc.data) {
    const g = gsc.data;
    const old = new Map(g.previous.map(r => [norm(r.keys[0]), r]));
    const current = new Map(g.page.map(r => [norm(r.keys[0]), r]));
    const deltas = [...new Set([...old.keys(), ...current.keys()])].map(url => {
      const c = current.get(url), p = old.get(url);
      return { url, c: c?.clicks ?? null, p: p?.clicks ?? null, delta: c && p ? c.clicks - p.clicks : null };
    });
    const row = r => [path(r.url), num(r.p), num(r.c), num(r.delta)];
    sections.push(`## Eigene Suchperformance\n\nProperty: ${g.meta.property}. Fenster: ${g.meta.windows.current.join(' bis ')}; Vergleich: ${g.meta.windows.previous.join(' bis ')}.\n\nNur in beiden Fenstern erfasste Seiten werden als Gewinner/Verlierer verglichen; fehlende Zeilen sind unbekannt. GSC kann Zeilen auslassen. Länder/Devices entsprechend Snapshot, ohne zusätzliche regionale Attribution.\n\n### Gewinner\n${table(['Seite', 'Vorher', 'Jetzt', 'Δ Klicks'], deltas.filter(d => d.delta !== null && d.delta > 0).sort((a,b) => b.delta-a.delta).slice(0,8).map(row))}\n\n### Verlierer\n${table(['Seite', 'Vorher', 'Jetzt', 'Δ Klicks'], deltas.filter(d => d.delta !== null && d.delta < 0).sort((a,b) => a.delta-b.delta).slice(0,8).map(row))}`);
    const striking = g.queryPage.filter(r => r.position >= 4 && r.position <= 15 && r.impressions >= 30).sort((a,b) => b.impressions-a.impressions);
    sections.push(`### Striking Distance\n${table(['Query', 'Seite', 'Position', 'Impressionen'], striking.slice(0,20).map(r => [r.keys[0],path(r.keys[1]),num(r.position),num(r.impressions)]))}`);
    const expected = [0, .28, .15, .1, .07, .05];
    const ctr = g.queryPage.filter(r => r.position >= 1 && r.position <= 5.4 && r.impressions >= 40 && r.ctr < expected[Math.min(5,Math.round(r.position))] * .5);
    sections.push(`### CTR-Prüfkandidaten\n\nGrobe Positionsheuristik, keine Prognose; Brand, Gerät und SERP-Features vor Eingriff prüfen.\n${table(['Query', 'Seite', 'Position', 'CTR'], ctr.slice(0,15).map(r => [r.keys[0],path(r.keys[1]),num(r.position),pct(r.ctr)]))}`);
    const queries = new Map();
    for (const r of g.queryPage) { const rows = queries.get(r.keys[0]) ?? []; rows.push(r); queries.set(r.keys[0], rows); }
    const overlaps = [...queries].filter(([,rows]) => {
      const total = rows.reduce((s,r) => s+r.impressions,0);
      return total >= 50 && rows.filter(r => r.impressions >= total*.2).length >= 2;
    });
    sections.push(`### Mehrfachrankings – Intent prüfen\n\nKeine bestätigte Kannibalisierung. Redirect-Artefakte und unterschiedliche Suchintentionen berücksichtigen.\n${table(['Query','Seiten'],overlaps.slice(0,15).map(([q,rows]) => [q,rows.map(r => path(r.keys[1])).join(', ')]))}`);
    const seen = new Set(g.page.filter(r => r.impressions > 0).map(r => norm(r.keys[0])));
    sections.push(`### Sitemap-Seiten ohne erfasste Impressionen\n\n${g.sitemap.filter(u => !seen.has(norm(u))).map(u => `- ${u}`).join('\n') || '_Keine._'}\n\nFehlende Zeilen sind kein Nachweis für null Impressionen oder fehlende Indexierung. URL Inspection separat ausführen.`);
    if (ctr.length) next.push(`Snippet-Hypothese prüfen: ${path(ctr[0].keys[1])}.`);
    if (striking.length) next.push(`Suchintention und fehlende Antwort prüfen: ${path(striking[0].keys[1])} für „${striking[0].keys[0]}“.`);
  } else {
    sections.push('## Eigene Suchperformance\n\n**GSC fehlt oder ist nicht verwertbar.** Keine Aussagen über tatsächliche Klicks, CTR, Indexierungsstatus oder Lead-Erfolg möglich. GSC-Service-Account verbinden; externe Rankings ersetzen diese Messungen nicht.');
    next.push('GSC-Service-Account verbinden und danach `npm run seo:sync` ausführen.');
  }
  const ranked = tasks.filter(r => r.endpoint.includes('/ranked_keywords/') && r.task.data?.location_code === 2276 && r.task.data?.language_code === 'de');
  const own = ranked.find(r => r.task.data?.target === SITE);
  const items = r => (r?.task.result?.[0]?.items ?? []).filter(i => i.ranked_serp_element?.serp_item?.type === 'organic');
  const kw = i => i.keyword_data?.keyword;
  const volume = i => i.keyword_data?.keyword_info?.search_volume;
  const position = i => i.ranked_serp_element?.serp_item?.rank_group;
  const url = i => i.ranked_serp_element?.serp_item?.url;
  if (own) {
    sections.push(`## DataForSEO: eigene Rankings\n\nStand ${own.fetchedAt}; Deutschland/Deutsch. ${items(own).length} organische Einträge erfasst; Datenbankgesamtzahl ${num(own.task.result[0].total_count)}. Leere Ergebnisse bedeuten keine erfassten Rankings, nicht bewiesene Unsichtbarkeit.\n\n${table(['Keyword','Volumen/Monat','Position','Seite'],items(own).slice(0,50).map(i => [kw(i),num(volume(i)),num(position(i)),path(url(i))]))}`);
    const ownKws = new Set(items(own).map(kw));
    const gaps = ranked.filter(r => r !== own).flatMap(r => items(r).filter(i => !ownKws.has(kw(i)) && position(i) <= 20).map(i => [kw(i),num(volume(i)),r.task.data.target,num(position(i)),r.date]));
    sections.push(`### Themen bei Wettbewerbern, im eigenen erfassten Datensatz nicht enthalten\n\nKeine Aussage „nicht in Top 100“: Exporte und Datenbankabdeckung sind begrenzt. Unterschiedliche Messdaten beachten.\n${table(['Keyword','Volumen','Domain','Position','Stand'],gaps.slice(0,20))}`);
    next.push('Eigene Rankings nach lokaler Relevanz, Anfrage-Nähe und konkreter Antwortlücke priorisieren; SERP gezielt prüfen.');
  } else sections.push('## DataForSEO: eigene Rankings\n\nKein gültiger Ranking-Snapshot für Deutschland/Deutsch vorhanden.');
  const competitors = tasks.find(r => r.endpoint.includes('/competitors_domain/') && r.task.data?.target === SITE && r.task.data?.location_code === 2276);
  if (competitors) sections.push(`### Wettbewerber\n\nStand ${competitors.fetchedAt}.\n${table(['Domain','Gemeinsame Keywords'],(competitors.task.result[0].items ?? []).slice(0,10).map(i => [i.domain,num(i.intersections)]))}`);
  sections.push(`## Recherchebelege\n\n${records.length ? records.map(r => `- ${relative(base,r.file)} (${r.fetchedAt})`).join('\n') : '_Noch keine gültigen DataForSEO-Antworten gespeichert._'}`);
  sections.push(`## Nächste Schritte\n\n${next.map(n => `- ${n}`).join('\n')}\n- Eine Änderungshypothese für eine bestehende Seite dokumentieren; aktuelle Primärquellen für veränderliche Fakten prüfen.\n- Technische Fehler separat beheben. Veröffentlichung und Messbeginn im Journal festhalten; Vergleich nach 14–28 Tagen, saisonale Einflüsse beachten.`);
  const journal = join(base, 'changes.jsonl');
  if (existsSync(journal)) {
    const changes = readFileSync(journal,'utf8').trim().split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return { url:'?',hypothesis:'Fehlerhafter Journaleintrag',publishedAt:null }; } });
    sections.push(`## Änderungsjournal\n\n${table(['URL','Hypothese','Veröffentlicht','Messung'],changes.map(c => [c.url,c.hypothesis,c.publishedAt ?? 'nicht veröffentlicht',c.publishedAt ? '14–28 Tage ab Veröffentlichung; Änderungen und Saison berücksichtigen' : 'noch nicht gestartet']))}`);
  }
  return `${sections.join('\n\n')}\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const base = join(ROOT,'seo-data');
  mkdirSync(base,{recursive:true});
  writeFileSync(join(base,'REPORT.md'),buildReport(base));
  console.log('Report: seo-data/REPORT.md');
}
