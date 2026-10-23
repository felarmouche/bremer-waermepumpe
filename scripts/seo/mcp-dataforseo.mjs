#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT, localEnvironment, credentials } from './lib/environment.mjs';

try {
  const auth = credentials(localEnvironment());
  const entry = resolve(ROOT, 'node_modules/dataforseo-mcp-server/dist/index.js');
  if (!existsSync(entry)) throw new Error('DataForSEO-MCP fehlt. Im Repository npm ci ausführen.');
  // Only forward the two provider credentials, never unrelated .env.local secrets.
  const child = spawn(process.execPath, [entry, '--docs-cache-dir', resolve(ROOT, 'seo-data/.docs-cache')], {
    cwd: ROOT, env: { ...process.env, ...auth }, stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('DataForSEO-MCP konnte nicht gestartet werden.'); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
