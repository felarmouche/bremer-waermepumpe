import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

export function validateResponse(response, strict = true) {
  if (!response || !Array.isArray(response.tasks) || !response.tasks.length) throw new Error('Vollständige DataForSEO-Antwort mit tasks erforderlich.');
  if (strict && (!Number.isFinite(response.cost) || response.cost < 0 || response.tasks_count !== response.tasks.length || !Number.isInteger(response.status_code))) {
    throw new Error('Antwort unvollständig: cost, status_code oder tasks_count fehlen/stimmen nicht.');
  }
  for (const task of response.tasks) {
    if (!task.id || !Number.isFinite(task.cost) || task.cost < 0 || !Number.isInteger(task.status_code)) throw new Error('Task-ID, Kosten oder Status fehlen.');
    if (task.status_code !== 20000) continue; // Preserve and account for failures, but do not treat them as successful data.
    if (!Array.isArray(task.result) || task.result_count !== task.result.length) throw new Error('Task-Ergebnis fehlt oder wurde gekürzt.');
    for (const result of task.result) {
      if (result.items_count != null && result.items_count !== (result.items?.length ?? 0)) throw new Error('items_count passt nicht: gekürzte Antwort.');
    }
  }
  if (strict && Math.abs(response.cost - response.tasks.reduce((s, t) => s + t.cost, 0)) > 0.000001) throw new Error('Antwort- und Task-Kosten widersprechen sich.');
  return response;
}

export function importResponse(base, input) {
  if (input.schemaVersion !== 1 || input.complete !== true || !['dataforseo-mcp', 'dataforseo-script'].includes(input.source) || !/^\/v3\/[a-z0-9_/.]+$/.test(input.endpoint || '') || !Array.isArray(input.request) || !input.request.length || !Number.isFinite(Date.parse(input.fetchedAt))) {
    throw new Error('Import benötigt schemaVersion:1, complete:true, source:dataforseo-mcp oder dataforseo-script, fetchedAt, endpoint und request (Task-Array).');
  }
  validateResponse(input.response);
  if (input.response.tasks_count !== input.request.length) throw new Error('Request und Antwort enthalten unterschiedlich viele Tasks.');
  for (const task of input.response.tasks) {
    if (task.path && `/${task.path.join('/')}`.replace(/\.ai$/, '') !== input.endpoint.replace(/\.ai$/, '')) throw new Error('Endpunkt widerspricht Antwort.');
  }
  const ids = input.response.tasks.map(t => t.id).sort();
  if (new Set(ids).size !== ids.length) throw new Error('Doppelte Task-ID innerhalb einer Antwort.');
  const id = createHash('sha256').update(ids.join('\n')).digest('hex').slice(0, 24);
  const folder = join(base, 'dfs', new Date(input.fetchedAt).toISOString().slice(0, 10));
  // Deduplicate across dates too: re-importing the same task never becomes a new bill.
  const existing = dfsRecords(base).records.find(r => r.envelope?.response.tasks.map(t => t.id).sort().join('\n') === ids.join('\n'));
  if (existing) return { file: existing.file, duplicate: true };
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `mcp-${id}.json`);
  writeFileSync(file, `${JSON.stringify(input, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { file, duplicate: false };
}

export function dfsRecords(base) {
  const records = [], issues = [];
  const dir = join(base, 'dfs');
  if (!existsSync(dir)) return { records, issues };
  for (const date of readdirSync(dir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
    for (const name of readdirSync(join(dir, date)).filter(n => n.endsWith('.json')).sort()) {
      const file = join(dir, date, name);
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        const envelope = raw.schemaVersion === 1 ? raw : null;
        if (envelope && envelope.complete !== true) throw new Error('Unvollständiger Import');
        const response = validateResponse(envelope?.response ?? raw, Boolean(envelope));
        records.push({ file, date, fetchedAt: envelope?.fetchedAt ?? `${date}T00:00:00Z`, response, envelope });
        for (const task of response.tasks) if (task.status_code !== 20000) issues.push(`${relative(base, file)}: Task-Status ${task.status_code}`);
      } catch (error) { issues.push(`${relative(base, file)}: ${error.message}`); }
    }
  }
  records.sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt));
  return { records, issues };
}

export function latestTasks(records) {
  const found = new Map();
  for (const record of records) {
    for (const task of record.response.tasks) {
      if (task.status_code !== 20000 || !task.result?.length) continue;
      const data = task.data ?? {};
      const endpoint = record.envelope?.endpoint ?? `/${(task.path ?? []).join('/')}`;
      const key = JSON.stringify([endpoint, data.target ?? data.keyword ?? data.keywords ?? '', data.location_code ?? data.location_name, data.language_code, data.device]);
      if (!found.has(key)) found.set(key, { ...record, task, endpoint });
    }
  }
  return [...found.values()];
}

export function costSummary(base, records, month) {
  const seen = new Map();
  for (const r of records) for (const t of r.response.tasks) if (r.date.startsWith(month) && !seen.has(t.id)) seen.set(t.id, t.cost);
  const verified = [...seen.values()].reduce((s, c) => s + c, 0);
  const legacyFile = join(base, 'dfs-costs.log');
  const legacy = existsSync(legacyFile) ? readFileSync(legacyFile, 'utf8').split('\n').filter(l => l.startsWith(month)).reduce((s, l) => s + (Number(l.split('\t')[2]) || 0), 0) : 0;
  return { verified, legacy, tasks: seen.size }; // The old log lacks task IDs: never add it to verified costs.
}
