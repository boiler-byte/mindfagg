#!/usr/bin/env node
// v55: exact UTF-safe diff fragments, escaped preview and bounded large diffs.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escapeHtml=text=>String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const sandbox=vm.createContext({TextEncoder,console,escapeHtml});
vm.runInContext(fs.readFileSync(path.join(root,'workspace/patch-tool.js'),'utf8'),sandbox);
const call=(name,...args)=>{sandbox.testArgs=args;return vm.runInContext(name+'(...testArgs)',sandbox)};
function check(left,right){
  const parts=call('patchToolDiffFragments',left,right);
  assert.equal(Array.from(parts).filter(p=>p.kind!=='added').map(p=>p.text).join(''),left);
  assert.equal(Array.from(parts).filter(p=>p.kind!=='removed').map(p=>p.text).join(''),right);
  const html=call('patchToolDiffPreview',left,right);
  assert.ok(!html.searchHtml.includes('<script>')&&!html.replaceHtml.includes('<script>'));
  return {parts:Array.from(parts),html};
}
let result=check('const number = 1;','const number = 2;');
assert.deepEqual(result.parts.map(p=>[p.kind,p.text]),[
  ['unchanged','const number = '],['removed','1'],['added','2'],['unchanged',';']
]);
assert.match(result.html.searchHtml,/class="patch-diff-removed">1<\/span>/);
assert.match(result.html.replaceHtml,/class="patch-diff-added">2<\/span>/);
check('one\ntwo\nthree\n','one\nTWO\nthree\n');
check('hello world','hello world');
check('€ ü 🦊\n<script>alert(1)</script>','€ ü 🦊\n<script>alert(2)</script>');
check('delete this','');
check('one','one plus new text');
check('hello old world old!', 'hello new world new!');
const markup=check('<img src=x onerror=alert(1)>','<script>alert(2)</script>').html;
assert.ok(markup.searchHtml.includes('&lt;')&&markup.replaceHtml.includes('&lt;')&&!markup.searchHtml.includes('<img')&&!markup.replaceHtml.includes('<script'));
// Long payloads must fall back to token-level diff (not a multi-million cell matrix).
const longA='old '.repeat(550),longB='new '.repeat(550);
result=check(longA,longB);
assert.match(result.html.searchHtml,/weitere 200 Zeichen/);
assert.match(result.html.replaceHtml,/weitere 200 Zeichen/);
// Character-level comparisons never split non-BMP characters.
result=check('A😀Z','A🦊Z');
assert.deepEqual(result.parts.map(p=>[p.kind,p.text]),[
  ['unchanged','A'],['removed','😀'],['added','🦊'],['unchanged','Z']
]);
// Stable deterministic fuzz: original and replacement must always reconstruct.
let seed=5342;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)|0)>>>0)/2**32;
const alphabet=['a','b','c',' ','\n','😄','<','&','€','0'];
for(let t=0;t<180;t++){
  const left=Array.from({length:Math.floor(random()*85)},()=>alphabet[Math.floor(random()*alphabet.length)]).join('');
  const right=Array.from({length:Math.floor(random()*85)},()=>alphabet[Math.floor(random()*alphabet.length)]).join('');
  check(left,right);
}
console.log('PASS: v55 escaped and Unicode-safe red/green search/replace diff, long-hunk fallback and reconstruction');
