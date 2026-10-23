#!/usr/bin/env node
// Capture directly from the official server, before any chat-output truncation.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/environment.mjs';
import { importResponse } from './lib/snapshots.mjs';
const client = new Client({name:'bwp-seo-capture',version:'1.0.0'});
try {
  const input = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  if (!process.argv.includes('--execute') || input.method !== 'POST' || !/^\/v3\/(dataforseo_labs|serp)\/[a-z_\/]+\/live(?:\/[a-z_]+)?$/.test(input.path || '') || !Array.isArray(input.data) || !input.data.length) {
    throw new Error('Nutzung: npm run seo:request -- <request.json> --execute. Nur ausdrücklich autorisierte Labs-/SERP-Live-POSTs; Kosten vorher prüfen.');
  }
  const transport = new StdioClientTransport({command:process.execPath,args:[resolve(ROOT,'scripts/seo/mcp-dataforseo.mjs')],cwd:ROOT,stderr:'pipe'});
  await client.connect(transport);
  const result = await client.callTool({name:'api_request',arguments:{method:'POST',path:input.path,data:input.data,noAiMode:true}},undefined,{timeout:120000});
  const text = result.content?.filter(c => c.type === 'text').map(c => c.text).join('\n');
  const response = result.structuredContent ?? JSON.parse(text);
  const envelope = {schemaVersion:1,complete:true,source:'dataforseo-mcp',fetchedAt:new Date().toISOString(),endpoint:input.path,request:input.data,response};
  // Persist even when validation fails; do not repeat a paid request to repair an import.
  const pending = resolve(ROOT,'seo-data/pending'); mkdirSync(pending,{recursive:true});
  const pendingFile = resolve(pending,`${Date.now()}.json`);
  writeFileSync(pendingFile,JSON.stringify(envelope,null,2),{flag:'wx',mode:0o600});
  const saved = importResponse(resolve(ROOT,'seo-data'),envelope);
  console.log(JSON.stringify({file:saved.file,cost:response.cost,status:response.status_code,tasks:response.tasks.map(t=>({id:t.id,status:t.status_code,count:t.result?.[0]?.items_count}))},null,2));
  if (result.isError || response.status_code !== 20000 || response.tasks.some(t=>t.status_code!==20000)) process.exitCode=1;
} catch (error) { console.error(error.message); process.exitCode=1; }
finally { await client.close(); }
