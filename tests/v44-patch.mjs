#!/usr/bin/env node
// v44: JSON patch schema, exact occurrence matching, opt-in operations and no partial plan.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=[
 {id:'html',projectId:'p',path:'index.html',fileType:'script',content:'<h1>Old</h1>\nEnd'},
 {id:'script',projectId:'p',path:'src/app.js',fileType:'script',content:'fetch(url)\nfetch(url)\nend'},
 {id:'other',projectId:'different',path:'index.html',fileType:'script',content:'SECRET'},
 {id:'bin',projectId:'p',path:'image.png',fileType:'image',data:[1,2,3]}
];
const context=vm.createContext({
 TextEncoder,console,docs:data,projectId:'p',
 workspacePath:d=>d.path,docIsText:d=>['script','markdown'].includes(d.fileType),
 workspaceValidPath:p=>typeof p==='string'&&p&&!p.startsWith('/')&&!/(^|\/)\.{1,2}(\/|$)/.test(p)&&!/\\|:|[\x00-\x1f]/.test(p)?p:null
});
vm.runInContext(fs.readFileSync(path.join(root,'workspace/patch-tool.js'),'utf8'),context);
const call=(name,...args)=>{context.testArgs=args;return vm.runInContext(name+'(...testArgs)',context)};
const h=(search,replace,occurrence=1)=>({search,replace,occurrence});
const entry=(file,hunks,description='Change text')=>({file,description,hunks});
const json=patches=>JSON.stringify({patches});
const valid=json([
 entry('index.html',[h('<h1>Old</h1>','<h1>New</h1>')]),
 entry('src/app.js',[h('fetch(url)','fetchNew(url)',2),h('end','done')])
]);
const parsed=call('parseWorkspacePatch',valid);
assert.equal(parsed.patches.length,2);
const all=new Set(['0:0','1:0','1:1']);
let plan=call('planWorkspacePatch',parsed,all,'p');
assert.equal(plan.errors,0);
assert.equal(plan.count,3);
assert.equal(plan.changes.length,2);
assert.equal(plan.changes.find(d=>d.id==='html').content,'<h1>New</h1>\nEnd');
assert.equal(plan.changes.find(d=>d.id==='script').content,'fetch(url)\nfetchNew(url)\ndone');
assert.equal(data[0].content,'<h1>Old</h1>\nEnd','plan must not mutate original files');
plan=call('planWorkspacePatch',parsed,new Set(['0:0','1:1']),'p');
assert.equal(plan.errors,0);
assert.equal(plan.changes.find(d=>d.id==='script').content,'fetch(url)\nfetch(url)\ndone');
assert.equal(call('patchToolNthOffset','aba aba aba','aba',3),8);
assert.equal(call('patchToolNthOffset','aa','a',3),-1);
assert.equal(call('patchToolNthOffset','aaa','aa',2),-1,'occurrences must not overlap');
const badMatch=call('parseWorkspacePatch',json([
 entry('index.html',[h('<h1>Old</h1>','<h1>New</h1>'),h('MISSING','error')])
]));
plan=call('planWorkspacePatch',badMatch,new Set(['0:0','0:1']),'p');
assert.equal(plan.errors,1,'a failing operation blocks applying the whole plan');
plan=call('planWorkspacePatch',badMatch,new Set(['0:0']),'p');
assert.equal(plan.errors,0,'unchecking a failing operation allows valid selected operations');
const missing=call('parseWorkspacePatch',json([entry('another.js',[h('x','y')])]));
assert.equal(call('planWorkspacePatch',missing,new Set(['0:0']),'p').errors,1);
const binary=call('parseWorkspacePatch',json([entry('image.png',[h('x','y')])]));
assert.equal(call('planWorkspacePatch',binary,new Set(['0:0']),'p').errors,1);
const serial=call('parseWorkspacePatch',json([entry('index.html',[h('Old','New'),h('New','Modern')])]));
assert.equal(call('planWorkspacePatch',serial,new Set(['0:0','0:1']),'p').changes[0].content,'<h1>Modern</h1>\nEnd');
const invalid=[
 '', 'not json','{}','{"patches":[]}',
 json([entry('../secret.js',[h('a','b')])]),
 json([entry('index.html',[h('','')])]),
 json([entry('index.html',[{search:'a',replace:'b',occurrence:0}])]),
 json([entry('index.html',[{search:'a',replace:'b',occurrence:1,regex:true}])]),
 JSON.stringify({patches:[{file:'index.html',hunks:[h('a','b')]}]}),
 JSON.stringify({patches:[entry('index.html',[h('a','b')])],version:2}),
 json([entry('index.html',[])]),
 json([entry('index.html',[{search:'a',occurrence:1}])]),
 json([entry('index.html',[{search:'a',replace:'b',occurrence:1.2}])]),
 json([entry('index.html',[h('a','b',-1)])])
];
for(const sample of invalid)assert.throws(()=>call('parseWorkspacePatch',sample),/./,sample.slice(0,90));
const deletion=call('parseWorkspacePatch',json([entry('index.html',[h('Old','')])]));
assert.equal(call('planWorkspacePatch',deletion,new Set(['0:0']),'p').changes[0].content,'<h1></h1>\nEnd');
console.log('PASS: v44 patch schema, paths, literal Nth occurrence, sequential replacements, selective failures and text-only targets');
