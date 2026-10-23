#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/environment.mjs';
import { importResponse } from './lib/snapshots.mjs';
try {
  if (!process.argv[2]) throw new Error('Nutzung: npm run seo:import -- <vollstaendige-envelope.json>');
  const result = importResponse(resolve(ROOT, 'seo-data'), JSON.parse(readFileSync(process.argv[2], 'utf8')));
  console.log(`${result.duplicate ? 'Bereits erfasst' : 'Gespeichert'}: ${result.file}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
