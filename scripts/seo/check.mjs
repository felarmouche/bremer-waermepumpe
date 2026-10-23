#!/usr/bin/env node
import { load } from 'cheerio';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib/environment.mjs';
const SITE = 'https://bremer-waermepumpe.de';
const dynamic = p => /^\/(api(?:\/|$)|dashboard\/?$)/.test(p);
const files = dir => readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory() ? files(join(dir,e.name)) : [join(dir,e.name)]);
const route = f => f === 'index.html' ? '/' : `/${f.replace(/\/index\.html$/, '/')}`;
export function checkBuild(dir, redirectsFile) {
  const errors = [], warnings = [];
  if (!existsSync(dir)) return {errors:['Build fehlt. Zuerst npm run build ausführen.'],warnings,pages:0};
  const html = files(dir).filter(f => f.endsWith('.html'));
  if (!html.length) return {errors:['Keine gebauten HTML-Seiten gefunden.'],warnings,pages:0};
  const pages = new Map(html.map(f => [route(relative(dir,f)),load(readFileSync(f,'utf8'))]));
  const redirects = new Set(existsSync(redirectsFile ?? '') ? readFileSync(redirectsFile,'utf8').split('\n').filter(l => /^\//.test(l)).map(l => l.trim().split(/\s+/)[0]) : []);
  const documentAt = p => pages.get(p) ?? pages.get(p.endsWith('/') ? p : `${p}/`);
  const assetAt = p => { try { const f = resolve(dir,`.${decodeURIComponent(p)}`); return f.startsWith(`${resolve(dir)}/`) && existsSync(f) && statSync(f).isFile(); } catch { return false; } };
  const titles = new Map(), descriptions = new Map(), indexable = new Set();
  for (const [pathname,$] of pages) {
    const fail = msg => errors.push(`${pathname}: ${msg}`);
    const noindex = /\bnoindex\b/i.test($('meta[name="robots"]').attr('content') ?? '');
    if (!noindex) indexable.add(pathname);
    for (const [selector,label] of [['title','Title'],['meta[name="description"]','Description']]) {
      const nodes=$(selector), value=selector==='title'?nodes.text().trim():nodes.attr('content')?.trim();
      if (nodes.length!==1 || !value) fail(`${label} fehlt, ist leer oder mehrfach vorhanden.`);
      if (value && !noindex) { const map=selector==='title'?titles:descriptions; if(map.has(value)) fail(`${label} identisch zu ${map.get(value)}.`); else map.set(value,pathname); }
    }
    if ($('h1').length!==1) fail('Es muss genau eine H1 geben.');
    const expected = new URL(pathname,SITE).href;
    const canonical=$('link[rel="canonical"]');
    if(!noindex && (canonical.length!==1 || canonical.attr('href')!==expected)) fail(`Canonical muss ${expected} sein.`);
    if(!noindex && $('meta[property="og:url"]').attr('content')!==expected) fail('og:url stimmt nicht mit der Seiten-URL überein.');
    const og=$('meta[property="og:image"]').attr('content');
    const checkAsset = (src,label) => {
      try { const u=new URL(src,expected); if(u.origin===SITE && !assetAt(u.pathname)) fail(`${label} fehlt im Build: ${u.pathname}`); }
      catch { fail(`${label} hat ungültige URL.`); }
    };
    if(!og) fail('OG-Bild fehlt.'); else checkAsset(og,'OG-Bild');
    $('img[src], source[srcset], img[srcset]').each((_,el)=>{
      const src=$(el).attr('src'); if(src && !src.startsWith('data:')) checkAsset(src,'Bild');
      const srcset=$(el).attr('srcset'); if(srcset && !srcset.startsWith('data:')) for(const entry of srcset.split(',')) checkAsset(entry.trim().split(/\s+/)[0],'srcset-Bild');
    });
    $('script[type="application/ld+json"]').each((_,el)=>{
      try {
        const value=JSON.parse($(el).text());
        const visit=v=>{ if(!v || typeof v!=='object') return; if(v['@type']==='Article') { const image=Array.isArray(v.image)?v.image[0]:typeof v.image==='object'?v.image.url:v.image; if(image!==og) fail('Article-Bild weicht vom OG-Bild ab.'); if(v.mainEntityOfPage!==expected) fail('Article-URL weicht vom Canonical ab.'); } for(const child of Object.values(v)) if(typeof child==='object') Array.isArray(child)?child.forEach(visit):visit(child); };
        visit(value);
      } catch { fail('JSON-LD ist kein gültiges JSON.'); }
    });
    $('a[href]').each((_,el)=>{
      const href=$(el).attr('href'); if(!href || /^(mailto:|tel:|javascript:)/.test(href)) return;
      let u; try {u=new URL(href,expected);}catch {fail(`Ungültiger Link: ${href}`);return;}
      if(u.origin!==SITE || dynamic(u.pathname)) return;
      if(redirects.has(u.pathname)) { warnings.push(`${pathname}: Link über Redirect ${u.pathname}`); return; }
      const target=documentAt(u.pathname);
      if(!target && !assetAt(u.pathname)) fail(`Interner Link ohne Ziel: ${href}`);
      if(target && u.hash) { try { const id=decodeURIComponent(u.hash.slice(1)); if(!target('[id]').toArray().some(e=>target(e).attr('id')===id) && !target('a[name]').toArray().some(e=>target(e).attr('name')===id)) fail(`Fragment ohne Ziel: ${href}`); } catch { fail(`Ungültiges Fragment: ${href}`); } }
    });
  }
  const sitemapFiles=files(dir).filter(f=>/sitemap.*\.xml$/.test(f));
  if(!sitemapFiles.length) errors.push('Sitemap fehlt.');
  const sitemapUrls=new Set();
  for(const file of sitemapFiles) {
    const $=load(readFileSync(file,'utf8'),{xml:true});
    if($('sitemapindex').length) continue;
    $('url > loc').each((_,el)=>sitemapUrls.add($(el).text()));
  }
  for(const url of sitemapUrls) {
    let u;try{u=new URL(url);}catch{errors.push(`Ungültige Sitemap-URL: ${url}`);continue;}
    if(u.origin!==SITE || u.search || u.hash) errors.push(`Sitemap-URL nicht kanonisch: ${url}`);
    if(!indexable.has(u.pathname)) errors.push(`Sitemap enthält fehlende, dynamische oder noindex-Seite: ${u.pathname}`);
  }
  for(const p of indexable) if(!sitemapUrls.has(new URL(p,SITE).href)) errors.push(`${p}: indexierbare Seite fehlt in Sitemap.`);
  const robots=join(dir,'robots.txt');
  if(!existsSync(robots) || !readFileSync(robots,'utf8').includes(`Sitemap: ${SITE}/sitemap-index.xml`)) errors.push('robots.txt fehlt oder verweist nicht auf die Sitemap.');
  return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],pages:pages.size};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=checkBuild(resolve(ROOT,'dist/client'),resolve(ROOT,'public/_redirects'));
  for(const e of result.errors) console.error(`FEHLER ${e}`);
  for(const w of result.warnings) console.warn(`HINWEIS ${w}`);
  console.log(`${result.pages} Seiten geprüft; ${result.errors.length} Fehler; ${result.warnings.length} Hinweise.`);
  process.exitCode=result.errors.length?1:0;
}
