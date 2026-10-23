import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReport } from '../build-report.mjs';
import { importResponse,dfsRecords,costSummary,validateResponse } from '../lib/snapshots.mjs';
import { credentials,localEnvironment,gscKeyPath } from '../lib/environment.mjs';
import { checkBuild } from '../check.mjs';
const now='2026-10-20T12:00:00Z';
function temp(t){const p=mkdtempSync(join(tmpdir(),'bwp-seo-')); t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
function fixture(id='task-one',endpoint='/v3/dataforseo_labs/google/ranked_keywords/live'){
 return {schemaVersion:1,source:'dataforseo-mcp',complete:true,fetchedAt:now,endpoint,request:[{target:'bremer-waermepumpe.de',location_code:2276,language_code:'de',limit:1}],response:{status_code:20000,cost:.01212,tasks_count:1,tasks:[{id,cost:.01212,status_code:20000,path:endpoint.slice(1).split('/'),data:{target:'bremer-waermepumpe.de',location_code:2276,language_code:'de'},result_count:1,result:[{total_count:100,items_count:1,items:[{keyword_data:{keyword:'wärmepumpe bremen',keyword_info:{search_volume:50}},ranked_serp_element:{serp_item:{type:'organic',rank_group:13,url:'https://bremer-waermepumpe.de/'}}}]}]}]}};
}
test('DFS-only report is useful and missing GSC stays unknown',t=>{
 const p=temp(t);importResponse(p,fixture());const report=buildReport(p,now);
 assert.match(report,/GSC fehlt oder ist nicht verwertbar/);assert.match(report,/wärmepumpe bremen/);assert.match(report,/100/);assert.doesNotMatch(report,/\*\*Gesamt:\*\* 0/);
});
test('new SERP snapshot does not hide old ranked snapshot; malformed newest is visible',t=>{
 const p=temp(t);const old=fixture();old.fetchedAt='2026-07-19T10:00:00Z';importResponse(p,old);
 const recent=fixture('serp','/v3/serp/google/organic/live/advanced');importResponse(p,recent);
 writeFileSync(join(p,'dfs','2026-10-20','broken.json'),'{truncated');
 const report=buildReport(p,now);assert.match(report,/wärmepumpe bremen/);assert.match(report,/veraltet/);assert.match(report,/broken.json/);
});
test('shortened responses are rejected, zero results accepted',()=>{
 const f=fixture();f.response.tasks[0].result[0].items=[];assert.throws(()=>validateResponse(f.response),/gekürzte/);
 f.response.tasks[0].result[0].items_count=0;assert.doesNotThrow(()=>validateResponse(f.response));
 delete f.response.cost;assert.throws(()=>validateResponse(f.response),/unvollständig/);
});
test('duplicate imports across dates preserve first snapshot and bill once',t=>{
 const p=temp(t),f=fixture();const first=importResponse(p,f);const before=readFileSync(first.file,'utf8');
 f.fetchedAt='2026-10-21T12:00:00Z';assert.equal(importResponse(p,f).duplicate,true);
 assert.equal(readFileSync(first.file,'utf8'),before);
 writeFileSync(join(p,'dfs-costs.log'),'2026-10-20T12:00:00Z\tranked\t0.01212\n');
 const cost=costSummary(p,dfsRecords(p).records,'2026-10');assert.equal(cost.tasks,1);assert.equal(cost.verified,.01212);assert.equal(cost.legacy,.01212);
});
test('failed tasks are accounted for, not treated as ranking results',t=>{
 const p=temp(t),f=fixture();f.response.tasks[0].status_code=40501;f.response.tasks[0].result=null;
 importResponse(p,f);const r=buildReport(p,now);assert.match(r,/40501/);assert.match(r,/Kein gültiger Ranking-Snapshot/);assert.match(r,/0.01212/);
});
test('mismatched requests/endpoints and complete=false cannot be imported',t=>{
 const p=temp(t),f=fixture();f.complete=false;assert.throws(()=>importResponse(p,f));
 f.complete=true;f.endpoint='/v3/serp/google/organic/live/advanced';assert.throws(()=>importResponse(p,f),/Endpunkt/);
});
test('GSC report separates winners and losers and ignores incomplete newer snapshot',t=>{
 const p=temp(t),dir=join(p,'gsc','2026-10-19');mkdirSync(dir,{recursive:true});
 const row=(name,clicks)=>({keys:[`https://bremer-waermepumpe.de/${name}/`],clicks,impressions:100,ctr:clicks/100,position:3});
 const data={'meta.json':{property:'sc-domain:bremer-waermepumpe.de',windows:{current:['2026-09-01','2026-09-30'],previous:['2026-08-01','2026-08-31']}},'page-current.json':[row('winner',10),row('loser',1),row('unknown-baseline',20)],'page-previous.json':[row('winner',1),row('loser',10)],'query-page-current.json':[],'sitemap.json':[]};
 for(const [file,d]of Object.entries(data))writeFileSync(join(dir,file),JSON.stringify(d));
 mkdirSync(join(p,'gsc','2026-10-20'));const r=buildReport(p,now);
 const winners=r.split('### Gewinner')[1].split('### Verlierer')[0];assert.match(winners,/winner/);assert.doesNotMatch(winners,/loser|unknown-baseline/);assert.match(r,/unvollständig oder fehlerhaft/);
});
test('environment is loaded without shell evaluation; missing credentials do not expose values',t=>{
 const p=temp(t);writeFileSync(join(p,'.env.local'),'DATAFORSEO_LOGIN=file-login\nDATAFORSEO_PASSWORD="$(echo secret)"\n');
 const env=localEnvironment(p,{DATAFORSEO_LOGIN:'inherited'});assert.equal(env.DATAFORSEO_LOGIN,'inherited');assert.equal(env.DATAFORSEO_PASSWORD,'$(echo secret)');
 assert.throws(()=>credentials({DATAFORSEO_LOGIN:'private-user'}),e=>!e.message.includes('private-user'));
 assert.equal(gscKeyPath({GSC_SERVICE_ACCOUNT_FILE:'custom/key.json'},p),join(p,'custom/key.json'));
});
function site(t){
 const p=temp(t);writeFileSync(join(p,'og.jpg'),'fixture');
 const valid='<html><head><title>Example</title><meta name="description" content="Description"><link rel="canonical" href="https://bremer-waermepumpe.de/"><meta property="og:url" content="https://bremer-waermepumpe.de/"><meta property="og:image" content="https://bremer-waermepumpe.de/og.jpg"></head><body><h1>Example</h1></body></html>';
 writeFileSync(join(p,'index.html'),valid);writeFileSync(join(p,'sitemap-0.xml'),'<urlset><url><loc>https://bremer-waermepumpe.de/</loc></url></urlset>');writeFileSync(join(p,'robots.txt'),'Sitemap: https://bremer-waermepumpe.de/sitemap-index.xml');return {p,valid};
}
test('valid rendered site passes',t=>{const {p}=site(t);assert.deepEqual(checkBuild(p).errors,[]);});
test('checker detects canonical, image, H1, links, JSON-LD and sitemap regressions',t=>{
 const {p,valid}=site(t);writeFileSync(join(p,'index.html'),valid.replace('rel="canonical"','rel="other"').replace('/og.jpg','/missing.jpg').replace('</body>','<h1>Two</h1><a href="/missing/">Broken</a><script type="application/ld+json">{broken</script></body>'));
 const r=checkBuild(p).errors.join('\n');for(const pattern of [/Canonical/,/OG-Bild/,/H1/,/Interner Link/,/JSON-LD/])assert.match(r,pattern);
 writeFileSync(join(p,'index.html'),valid.replace('</head>','<meta name="robots" content="noindex"></head>'));assert.match(checkBuild(p).errors.join('\n'),/noindex/);
});
