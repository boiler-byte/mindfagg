#!/usr/bin/env node
// v50: standalone static integrity test. Not needed to run the app.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const exists=(name)=>fs.existsSync(path.join(root,name));
const catalog=JSON.parse(file('module-manifest.json'));
const index=file('index.html');
const sw=file('sw.js');
const errors=[];
const assert=(ok,message)=>{if(!ok)errors.push(message)};
const refs=(regexp)=>[...index.matchAll(regexp)].map(match=>match[1]);
const css=refs(/<link rel="stylesheet" href="([^"]+)"/g);
const js=refs(/<script src="([^"]+)"><\/script>/g);
assert(!/<script\s*>/i.test(index),'Inline-script remained in index.html');
assert(!/<style\s*>/i.test(index),'Inline-style remained in index.html');
assert(index.split('\n').length<200,'index.html exceeds 200 lines');
assert(JSON.stringify(css)===JSON.stringify(catalog.stylesheets),'CSS order differs from manifest');
assert(JSON.stringify(js)===JSON.stringify(catalog.scripts),'Script order differs from manifest');
assert(js.at(-2)==='ui/bindings.js'&&js.at(-1)==='core/service-worker.js', 'Bootstrap must be last');
for(const asset of [...css,...js]){
  assert(!asset.includes('..')&&exists(asset),'Missing local module: '+asset);
}
const missingAssets=catalog.cacheAssets.filter(asset=>!exists(asset));
assert(missingAssets.length===0,'Missing cache assets: '+missingAssets.join(', '));
for(const name of catalog.cacheAssets){
  assert(sw.includes("'"+name+"'"),'Service-worker pre-cache misses '+name);
}
assert(sw.includes("const VERSION='mindfagg-v50'"),'Service-worker cache version incorrect');
const runtimeAssets=new Set([...css,...js,'./index.html','./manifest.webmanifest','./icons/icon.svg','./icons/icon-maskable.svg'].map(x=>x.replace(/^\.\//,'')));
for(const name of runtimeAssets)assert(catalog.cacheAssets.some(x=>x.replace(/^\.\//,'')===name),'Runtime file not cached: '+name);
let passed=0;
for(const src of [...js,'sw.js']){
  const check=spawnSync(process.execPath,['--check',path.join(root,src)],{encoding:'utf8'});
  if(check.status===0)passed++;
  else errors.push('JS syntax invalid in '+src+': '+(check.stderr||'').trim());
}
if(errors.length){for(const error of errors)console.error('FAIL:',error);process.exit(1)}
console.log(`PASS: ${css.length} stylesheets, ${js.length} scripts, ${catalog.cacheAssets.length} cache assets, ${passed} JavaScript syntax checks`);
