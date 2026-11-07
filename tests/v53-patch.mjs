#!/usr/bin/env node
// v53: byte-accurate patch deltas and full/selected persistence modes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let serial=0;
const docs=[
  {id:'a',projectId:'p',path:'a.txt',fileType:'script',content:'\u00e4A'},
  {id:'b',projectId:'p',path:'b.js',fileType:'script',content:'abc'},
  {id:'img',projectId:'p',path:'img.png',fileType:'image',data:new Uint8Array([1,2,3,4])},
  {id:'old',projectId:'p',path:'old.js',fileType:'script',content:'x'}
];
const projects=[{id:'p',folders:[]}];
const validPath=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!p.includes('..')?p:null;
const sandbox=vm.createContext({TextEncoder,console,docs,projects,projectId:'p',uid:()=>`new-${++serial}`,
  workspacePath:d=>d.path,workspaceValidPath:validPath,
  docIsText:d=>['script','markdown'].includes(d.fileType),fileKind:d=>d.fileType,
  isMarkdownPath:p=>/\.md$/i.test(p),knownTextPath:p=>/\.(?:js|txt)$/i.test(p),
  docNameForPath:p=>p.split('/').at(-1)
});
vm.runInContext(fs.readFileSync(path.join(root,'workspace/patch-tool.js'),'utf8'),sandbox);
const call=(name,...args)=>{sandbox.args=args;return vm.runInContext(name+'(...args)',sandbox)};
const patch=call('parseWorkspacePatch',JSON.stringify({patches:[
  {operation:'update',file:'a.txt',hunks:[
    {search:'\u00e4',replace:'\u20ac\u20ac',occurrence:1},
    {search:'A',replace:'AA',occurrence:1}]},
  {operation:'create',file:'c.txt',content:'Hallo \u00e4'},
  {operation:'replace',file:'b.js',content:'Z'},
  {operation:'delete',file:'img.png'},
  {operation:'rename',file:'old.js',to:'renamed.js'}
]}));
const all=new Set(['0:0','0:1','1:0','2:0','3:0','4:0']);
const plan=call('planWorkspacePatch',patch,all,'p');
assert.equal(plan.errors,0);
const deltas=Array.from(plan.operations,op=>op.byteDelta);
assert.deepEqual(deltas,[4,1,8,-2,-4,0]);
assert.equal(deltas.reduce((a,b)=>a+b,0),7);
assert.equal(call('patchToolByteDeltaLabel',0),'0 B');
assert.equal(call('patchToolByteDeltaLabel',-4),'-4 B');
assert.equal(call('patchToolByteDeltaLabel',2048),'+2 KB');
assert.equal(call('patchToolByteDeltaLabel',1536),'+1.5 KB');
const subset=new Set(['0:0','1:0','2:0','3:0','4:0']);
const chosen=call('planWorkspacePatch',patch,subset,'p');
assert.equal(chosen.errors,0);
assert.equal(chosen.operations.reduce((sum,row)=>sum+(row.byteDelta||0),0),6);
const now=new Date('2026-11-07T16:00:00');
const partial=call('patchToolSaveRecord',patch,subset,chosen,'p',now,'selected');
const full=call('patchToolSaveRecord',patch,subset,chosen,'p',now,'full');
assert.equal(JSON.parse(partial.content).patches.length,5);
assert.equal(JSON.parse(partial.content).patches[0].hunks.length,1);
assert.equal(JSON.parse(full.content).patches[0].hunks.length,2);
assert.equal(full.fileType,'script');
assert.throws(()=>call('patchToolSaveRecord',patch,subset,chosen,'p',now,'none'),/Speichermodus/);
assert.equal(docs.find(d=>d.id==='a').content,'\u00e4A','planner must be immutable');
console.log('PASS: v53 per-hunk UTF-8 bytes, patch totals, file deletion and full/selected save scope');
