#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/environment.mjs';

// Both configs deliberately have a minimal, identical command/args shape.
const claude = JSON.parse(readFileSync(resolve(ROOT,'.mcp.json'),'utf8')).mcpServers.dataforseo;
const toml = readFileSync(resolve(ROOT,'.codex/config.toml'),'utf8');
const codex = { command: JSON.parse(toml.match(/^command\s*=\s*(.+)$/m)[1]), args: JSON.parse(toml.match(/^args\s*=\s*(.+)$/m)[1]) };
for (const [name, config] of [['Codex',codex],['Claude Code',claude]]) {
  const transport = new StdioClientTransport({ command: config.command, args: config.args, cwd: ROOT, stderr:'pipe' });
  const client = new Client({name:'bwp-mcp-smoke',version:'1.0.0'});
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const expected = ['docs_index','docs_list_sections','docs_search','api_request'];
    if (expected.some(n => !tools.some(t => t.name === n))) throw new Error('Erwartete Werkzeuge fehlen.');
    console.log(`${name}-Konfiguration: Handshake OK; ${tools.map(t => t.name).join(', ')}`);
    if (process.argv.includes('--schema')) console.log(JSON.stringify(tools.find(t => t.name === 'api_request').inputSchema,null,2));
  } finally { await client.close(); }
}
console.log('Keine API-Abfragen ausgeführt. Dies prüft die Konfiguration per SDK, nicht die Benutzeroberfläche der Clients.');
