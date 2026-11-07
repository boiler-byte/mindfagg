#!/usr/bin/env node
// v63: binary create patch schema, lossless byte encoding, sizes and planner.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let counter=0;
const docs=[{id:'original',projectId:'source',path:'src/a.js',fileType:'script',content:'abc'}];
const ctx=vm.createContext({
  TextEncoder,Uint8Array,console,btoa:raw=>Buffer.from(raw,'binary').toString('base64'),
  atob:value=>Buffer.from(value,'base64').toString('binary'),
  docs,projects:[{id:'source',folders:[]},{id:'target',folders:[]}],projectId:'target',uid:()=>`created-${++counter}`,
  workspacePath:d=>d.path,workspaceValidPath:p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('..')?p:null,
  isMarkdownPath:p=>/\.md$/i.test(p),knownTextPath:p=>/\.(?:js|txt|csv)$/i.test(p),
  docIsText:d=>['script','markdown'].includes(d.fileType),fileKind:d=>d.fileType,
  docNameForPath:p=>p.split('/').at(-1),
  WORKSPACE_IMAGE_MIME:{png:'image/png'},WORKSPACE_AUDIO_MIME:{ogg:'audio/ogg'}
});
vm.runInContext(fs.readFileSync(path.join(root,'workspace/patch-tool.js'),'utf8'),ctx);
const run=(name,...args)=>{ctx.args=args;return vm.runInContext(`${name}(...args)`,ctx)};
const bytes=Uint8Array.from({length:24579},(_,i)=>(i*127+19)%256);
const coded=run('patchToolEncodeBase64',bytes);
assert.equal(coded,Buffer.from(bytes).toString('base64'));
assert.deepEqual(Array.from(run('patchToolDecodeBase64',coded)),Array.from(bytes));
assert.equal(run('patchToolBase64ByteSize',coded),bytes.length);
assert.equal(run('patchToolBase64ByteSize',''),0);
const patch=run('parseWorkspacePatch',JSON.stringify({patches:[
  {operation:'create',file:'assets/pic.png',encoding:'base64',content:coded},
  {operation:'create',file:'assets/sound.ogg',encoding:'base64',content:'AA=='},
  {operation:'create',file:'assets/empty.bin',encoding:'base64',content:''},
  {operation:'create',file:'src/a.js',content:'hello!'}
]}));
const chosen=new Set(patch.patches.map((_,i)=>i+':0'));
const plan=run('planWorkspacePatch',patch,chosen,'target');
assert.equal(plan.errors,0);
assert.equal(plan.count,4);
assert.deepEqual(Array.from(plan.operations,r=>r.byteDelta),[bytes.length,1,0,6]);
const file=path=>plan.finalFiles.find(d=>d.path===path);
assert.equal(file('assets/pic.png').fileType,'image');
assert.deepEqual(Array.from(file('assets/pic.png').data),Array.from(bytes));
assert.equal(file('assets/sound.ogg').fileType,'audio');
assert.deepEqual(Array.from(file('assets/sound.ogg').data),[0]);
assert.equal(file('assets/empty.bin').fileType,'binary');
assert.equal(file('assets/empty.bin').data.byteLength,0);
assert.equal(file('src/a.js').fileType,'script');
assert.equal(file('src/a.js').content,'hello!');
assert.equal(docs.length,1,'planner cannot modify original documents');
const partial=run('planWorkspacePatch',patch,new Set(['3:0']),'target');
assert.equal(partial.errors,0);
assert.equal(partial.operations[0].byteDelta,null);
assert.equal(partial.finalFiles.length,1);
for(const malformed of [
  {operation:'create',file:'icon.png',encoding:'hex',content:'00'},
  {operation:'create',file:'icon.png',encoding:'base64',content:'AQ==='},
  {operation:'create',file:'icon.png',encoding:'base64',content:'abc'},
  {operation:'create',file:'icon.png',encoding:'base64',content:'@@@='},
  {operation:'replace',file:'a.txt',encoding:'base64',content:'AA=='},
  {operation:'create',file:'icon.png',encoding:'base64'}
])assert.throws(()=>run('parseWorkspacePatch',JSON.stringify({patches:[malformed]})),/./);
console.log('PASS: v63 binary/text create patches, Base64 across chunks, empty binary and strict validation');
