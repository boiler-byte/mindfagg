#!/usr/bin/env node
// v36: verify offline syntax diagnostics and content-based clipboard names.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const ctx=vm.createContext({console,Set,Map});
vm.runInContext(read('vendor/acorn.js'),ctx,{filename:'vendor/acorn.js'});
vm.runInContext(read('script/validators.js'),ctx,{filename:'script/validators.js'});
const invoke=(name,...args)=>vm.runInContext(name+'('+args.map(JSON.stringify).join(',')+')',ctx);
const ok=(lang,source)=>assert.equal(invoke('validateScriptContent',source,lang).errors.length,0,lang+' valid code: '+source);
const bad=(lang,source,expected)=>{
  const diag=invoke('validateScriptContent',source,lang).errors;
  assert.ok(diag.length,lang+' must report: '+source);
  assert.ok(diag[0].line>0&&diag[0].column>0&&diag[0].offset>=0,'no error position');
  if(expected)assert.match(diag.map(x=>x.message).join(' '),expected);
};
ok('js','export const getValue = () => 42;');
ok('js','function demo(){ return 1; }');
bad('js','let = ;');
bad('js','function foo( {');
ok('css','body { color: red; padding: 1rem; }');
ok('css','@media (max-width: 650px) { .a { display: flex; gap: 8px; } }');
ok('css','@keyframes spin {0% { transform: rotate(0deg) }100% { transform: rotate(360deg) } }');
bad('css','body { color red; }',/Eigenschaft/);
bad('css','h1 { color: red\nbackground: blue; }',/Semikolon/);
bad('css','h1 { color: red;',/Klammer/);
ok('html','<!doctype html><html><head><title>x</title></head><body><img src="x"><main>Hi</main></body></html>');
ok('html','<script>const x = 1;</script><style>body {color:red}</style>');
bad('html','<div><span>oops</div>',/span/);
bad('html','<style>body {color red}</style>',/CSS/);
bad('html','<script>let x = ;</script>',/JavaScript/);
for(const [s,expected] of [
  ['const x = 1;','js'],['console.log("test");','js'],['function draw() { return 2; }','js'],
  ['body { background: #fff; }','css'],['.layout { display: grid; }','css'],
  ['Hello World',null],['an ordinary note',null],['[1,2,3]',null]
])assert.equal(invoke('detectClipboardCodeLanguage',s),expected,'clipboard '+s);
const index=read('index.html'),sw=read('sw.js');
assert.ok(index.includes('<script src="script/validators.js"></script>'));
assert.ok(sw.includes("const VERSION='mindfagg-v53'"));
assert.ok(sw.includes("'./script/validators.js'"));
assert.ok(read('workspace/io.js').includes("const language=detectClipboardCodeLanguage(t)"));
assert.ok(read('ui/settings.js').includes('https://github.com/settings/personal-access-tokens/new'));
assert.ok(read('workspace/github.js').includes('https://github.com/new'));
console.log('PASS: v36 JavaScript/CSS/HTML checks, error offsets, clipboard recognition and wiring');
