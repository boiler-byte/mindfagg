#!/usr/bin/env node
// v41 offline formatter unit checks, including JS AST preservation and idempotence.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({console});
for(const file of ['vendor/acorn.js','script/validators.js','script/pretty-code.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const call=(source,ext)=>vm.runInContext('scriptPrettyFormat('+JSON.stringify(source)+','+JSON.stringify(ext)+')',context);
const signature=source=>vm.runInContext('scriptPrettyAstSignature(parseJavascriptCode('+JSON.stringify(source)+').ast)',context);
const examples=[
  ['js','function sum(a,b){const obj={a:a,b:b};return obj.a+obj.b;}'],
  ['js','const x=`hello ${1+2}`;const regex=/\\s+\\/x/g; // preserved\nconsole.log(x,regex);'],
  ['js','export default function example(x){if(x){return [1,2]}return {a:3}}'],
  ['js','const render=()=>({title:"Hello",nested:{value:true}})'],
  ['css','a:hover{content:"a;{b}";color:blue;}@media (max-width:500px){a{padding:1px}}'],
  ['html','<!doctype html><html><head><title>App</title></head><body><main><p>Hi</p></main></body></html>'],
  ['xml','<?xml version="1.0"?><root><item>text</item><empty/></root>'],
  ['svg','<svg><g><rect width="5" height="5"/></g><text>A B</text></svg>'],
  ['json','{"title":"Daten","rows":[1,2,3],"flag":true}']
];
let checks=0;
for(const [extension,source] of examples){
  const result=call(source,extension);
  assert.ok(result.includes('\n'),extension+' must gain line breaks');
  assert.equal(call(result,extension),result,extension+' must be idempotent');
  if(extension==='js')assert.equal(signature(result),signature(source),'JS AST must not change');
  checks++;
}
const inline='<div><span>one</span><span>two</span></div>';
assert.equal(call(inline,'html'),inline+'\n','Inline text must not gain spacing');checks++;
for(const invalid of ['const = 1;','let text = "unterminated']){
  assert.throws(()=>call(invalid,'js'));checks++;
}
for(const invalid of ['{invalid}', '{"missing": 1,}']){assert.throws(()=>call(invalid,'json'));checks++}
for(const extension of ['txt','md']){assert.throws(()=>call('{}',extension));checks++}
console.log('PASS: '+checks+' Pretty Code cases (AST preservation, idempotence, comments, markup and unsupported formats)');
