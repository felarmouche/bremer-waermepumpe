#!/usr/bin/env node
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT,localEnvironment,credentials,gscKeyPath } from './lib/environment.mjs';
const env=localEnvironment();
const checks=[];
const add=(name,ok,help,required=true)=>checks.push({name,ok,help,required});
add('Node >=22.12',Number(process.versions.node.split('.')[0])>22 || (Number(process.versions.node.split('.')[0])===22 && Number(process.versions.node.split('.')[1])>=12),'Unterstützte Node-Version installieren.');
add('Offizieller MCP installiert',existsSync(resolve(ROOT,'node_modules/dataforseo-mcp-server/dist/index.js')),'npm ci ausführen.');
try {credentials(env);add('DataForSEO-Zugangsdaten vorhanden',true,'');}catch {add('DataForSEO-Zugangsdaten vorhanden',false,'.env.local ergänzen; Werte werden nicht ausgegeben.');}
for(const f of ['.mcp.json','.codex/config.toml']) add(f,existsSync(resolve(ROOT,f)),'Projektkonfiguration fehlt.');
const gsc=gscKeyPath(env);
add('GSC-Service-Account',existsSync(gsc),'Optional: GSC_SERVICE_ACCOUNT_FILE setzen und Property-Zugriff freigeben.',false);
for(const bin of ['codex','claude']) add(`${bin} im PATH`,!spawnSync(bin,['--version'],{cwd:ROOT,encoding:'utf8'}).error,'Client installieren/Projekt dort öffnen; SDK-Test prüft nur den Server.',false);
for(const f of ['.env.local','.secrets/example.json','seo-data/REPORT.md','.claude/settings.local.json']) {
 add(`${f} gitignored`,spawnSync('git',['check-ignore','--quiet',f],{cwd:ROOT}).status===0,'Privaten Pfad in .gitignore ergänzen.');
}
const tracked=spawnSync('git',['ls-files','--','.env.local','.secrets','seo-data'],{cwd:ROOT,encoding:'utf8'});
add('Keine privaten SEO-Dateien versioniert',tracked.status===0 && !tracked.stdout.trim(),'Getrackte private Dateien vor Veröffentlichung prüfen.');
const pkg=JSON.parse(readFileSync(resolve(ROOT,'package.json'),'utf8'));
add('MCP-Version festgeschrieben',/^\d+\.\d+\.\d+$/.test(pkg.devDependencies?.['dataforseo-mcp-server']??''),'Exakte Version und Lockfile verwenden.');
for(const c of checks) console.log(`${c.ok?'OK':c.required?'FEHLER':'OFFEN'} ${c.name}${!c.ok?`: ${c.help}`:''}`);
console.log('Nur lokale Voraussetzungen geprüft; keine API-Abfrage und kein Authentifizierungsnachweis.');
process.exitCode=checks.some(c=>!c.ok&&c.required)?1:0;
