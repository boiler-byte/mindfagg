#!/usr/bin/env node
// v45: extended JSON schema, sequential filesystem planner, checked subsets and save log.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[
 {id:'html',projectId:'p',path:'index.html',name:'index.html',fileType:'script',content:'<h1>Alt</h1>\nEnd'},
 {id:'app',projectId:'p',path:'src/app.js',name:'app.js',fileType:'script',content:'fetch(1)\nfetch(1)'},
 {id:'old',projectId:'p',path:'src/old.js',name:'old.js',fileType:'script',content:'old'},
 {id:'binary',projectId:'p',path:'assets/logo.png',name:'logo.png',fileType:'image',data:new Uint8Array([1,2,3])},
 {id:'foreign',projectId:'other',path:'src/app.js',name:'app.js',fileType:'script',content:'private'}
];
const proj=[{id:'p',folders:['src','assets','empty']},{id:'other',folders:[]}];
let serial=0;
const validPath=p=>typeof p==='string'&&p&&!p.startsWith('/')&&!/^[a-zA-Z]:/.test(p)&&!/(^|\/)\.{1,2}(\/|$)/.test(p)&&!/[\\:\x00-\x1f]/.test(p)&&!p.endsWith('/')&&p.length<=2048?p:null;
const context=vm.createContext({
  TextEncoder,console,docs:files,projects:proj,projectId:'p',uid:()=>`created-${++serial}`,
  workspacePath:d=>d.path,workspaceValidPath:validPath,docIsText:d=>['script','markdown'].includes(d.fileType),
  isMarkdownPath:p=>/\.md$/i.test(p),knownTextPath:p=>/\.(?:js|json|html|css|txt)$/i.test(p),
  docNameForPath:p=>p.split('/').pop().replace(/\.md$/i,''),fileKind:d=>d.fileType
});
vm.runInContext(fs.readFileSync(path.join(root,'workspace/patch-tool.js'),'utf8'),context);
const call=(name,...args)=>{context.args=args;return vm.runInContext(name+'(...args)',context)};
const json=patches=>JSON.stringify({patches});
const h=(search,replace,occurrence=1)=>({search,replace,occurrence});
const p=(operation,file,fields={})=>({operation,file,...fields});
const simple=[p('create','lib/new.js',{content:'new code'}),p('update','index.html',{hunks:[h('Alt','Neu')]}),p('replace','src/app.js',{content:''}),p('rename','src/old.js',{to:'lib/moved.js'}),p('delete','assets/logo.png')];
const parsed=call('parseWorkspacePatch',json(simple));
assert.equal(parsed.patches.length,5);
const chosen=new Set(['0:0','1:0','2:0','3:0','4:0']);
let plan=call('planWorkspacePatch',parsed,chosen,'p');
assert.equal(plan.errors,0);
assert.equal(plan.count,5);
assert.equal(plan.changes.length,4);
assert.equal(plan.deletedIds.length,1);
assert.equal(plan.affected,5);
assert.deepEqual(Array.from(plan.folders),['src','assets','empty','lib']);
assert.equal(plan.changes.find(d=>d.id==='html').content,'<h1>Neu</h1>\nEnd');
assert.equal(plan.changes.find(d=>d.id==='app').content,'');
assert.equal(plan.changes.find(d=>d.id==='old').path,'lib/moved.js');
assert.equal(plan.changes.find(d=>d.path==='lib/new.js').fileType,'script');
assert.equal(files.find(d=>d.id==='old').path,'src/old.js','planning cannot mutate existing documents');
assert.equal(files.find(d=>d.id==='app').content,'fetch(1)\nfetch(1)','planning cannot replace originals');
assert.equal(files.find(d=>d.id==='binary').data.length,3);
const applied=call('patchToolSelectedPatch',parsed,new Set(['0:0','1:0','3:0']));
assert.equal(applied.patches.length,3);
assert.deepEqual(Array.from(Object.keys(applied.patches[1])),['operation','file','hunks']);
const saved=call('patchToolSaveRecord',parsed,chosen,plan,'p',new Date('2026-11-06T21:31:05'));
assert.match(saved.path,/^2026-11-06-213105\.patch\.json$/);
assert.equal(saved.path,saved.name);
assert.equal(saved.fileType,'script');
assert.equal(JSON.parse(saved.content).patches.length,5);
const serialPatch=call('parseWorkspacePatch',json([
  p('create','lib/hi.js',{content:'one'}),p('update','lib/hi.js',{hunks:[h('one','two')]}),
  p('rename','lib/hi.js',{to:'lib/bye.js'}),p('replace','lib/bye.js',{content:'three'}),
  p('delete','lib/bye.js'),p('create','lib/bye.js',{content:'four'})
]));
plan=call('planWorkspacePatch',serialPatch,new Set(['0:0','1:0','2:0','3:0','4:0','5:0']),'p');
assert.equal(plan.errors,0);
assert.equal(plan.deletedIds.length,0);
assert.equal(plan.changes.length,1);
assert.equal(plan.changes[0].path,'lib/bye.js');
assert.equal(plan.changes[0].content,'four');
const partial=call('parseWorkspacePatch',json([p('update','index.html',{hunks:[h('Alt','Neu'),h('MISSING','ERROR')]})]));
assert.equal(call('planWorkspacePatch',partial,new Set(['0:0','0:1']),'p').errors,1);
assert.equal(call('planWorkspacePatch',partial,new Set(['0:0']),'p').errors,0);
const partialLog=call('patchToolSelectedPatch',partial,new Set(['0:0']));
assert.equal(partialLog.patches[0].hunks.length,1);
const collisions=[
 [p('create','src/app.js',{content:'x'}),'Zieldatei'],
 [p('create','SRC/APP.JS',{content:'x'}),'Zieldatei'],
 [p('create','src',{content:'x'}),'Ordner'],
 [p('create','src/app.js/new.js',{content:'x'}),'blockiert'],
 [p('create','test.png',{content:'x'}),'Textdateien'],
 [p('rename','src/old.js',{to:'src/app.js'}),'Zieldatei'],
 [p('rename','src/old.js',{to:'assets'}),'Ordner'],
 [p('rename','assets/logo.png',{to:'src/app.js'}),'Zieldatei'],
 [p('update','assets/logo.png',{hunks:[h('x','y')]}),'editierbar'],
 [p('replace','assets/logo.png',{content:'bad'}),'editierbar'],
 [p('delete','not-found.js'),'nicht vorhanden'],
 [p('rename','not-found.js',{to:'new.js'}),'nicht vorhanden']
];
for(const [entry,fragment] of collisions){
 const parsed=call('parseWorkspacePatch',json([entry]));
 const result=call('planWorkspacePatch',parsed,new Set(['0:0']),'p');
 assert.equal(result.errors,1,JSON.stringify(entry));
 assert.ok(result.operations[0].message.includes(fragment),JSON.stringify(entry)+': '+result.operations[0].message);
}
const bad=[
 {},{patches:[]},
 {patches:[p('wat','a.js')]},
 {patches:[p('','a.js',{hunks:[h('x','y')]})]},
 {patches:[p('create','x.js')]},
 {patches:[p('replace','x.js',{content:33})]},
 {patches:[p('create','x.js',{content:'',to:'x'})]},
 {patches:[p('delete','x.js',{content:''})]},
 {patches:[p('rename','x.js',{to:'../x.js'})]},
 {patches:[p('rename','x.js',{to:''})]},
 {patches:[p('update','x.js',{hunks:[]})]},
 {patches:[p('update','x.js',{hunks:[{search:'',replace:'r',occurrence:1}]})]},
 {patches:[p('update','x.js',{hunks:[{search:'x',replace:'r',occurrence:0}]})]},
 {patches:[p('update','x.js',{hunks:[{search:'x',replace:'r',occurrence:1,regex:true}]})]},
 {patches:[p('delete','/absolute.js')]},
 {patches:[p('create','a/../x.js',{content:''})]},
 {patches:[p('delete','x.js',{description:''})]}
];
for(const sample of bad)assert.throws(()=>call('parseWorkspacePatch',JSON.stringify(sample)),/./,JSON.stringify(sample));
// Old v44 patch remains valid and serializable into v45 format.
const legacy=call('parseWorkspacePatch',json([{file:'index.html',description:'legacy',hunks:[h('Alt','Neu')]}]));
assert.equal(call('planWorkspacePatch',legacy,new Set(['0:0']),'p').errors,0);
assert.equal(call('patchToolSelectedPatch',legacy,new Set(['0:0'])).patches[0].operation,'update');
// Saving a second patch within one second must be a new root file, not an overwrite.
context.docs.push({...saved,id:'existing'});
const second=call('patchToolSaveRecord',parsed,chosen,call('planWorkspacePatch',parsed,chosen,'p'),'p',new Date('2026-11-06T21:31:05'));
assert.equal(second.path,'2026-11-06-213106.patch.json');
console.log('PASS: v45 create/update/replace/delete/rename, ordered plan, optional descriptions, collisions, selected log and root timestamp');
