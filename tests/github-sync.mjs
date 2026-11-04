#!/usr/bin/env node
// v34: deterministic tests for the bidirectional three-way sync rules.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'workspace/github.js'),'utf8');
const context=vm.createContext({
  crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,console,
  atob,btoa,fetch:async()=>{throw Error('Network unavailable')},
  workspaceValidPath:path=>typeof path==='string'&&!path.includes('..')?path:null,
  workspaceSize:n=>n+' B',workspacePath:d=>d.path,exportFileBytes:d=>d.bytes,
  docs:[],projects:[],projectId:'project',project:()=>null,$:()=>null,
  clearTimeout,setTimeout
});
vm.runInContext(code,context,{filename:'workspace/github.js'});
function invoke(source,vars={}){for(const [key,value] of Object.entries(vars))context[key]=value;return vm.runInContext(source,context)}
const bytes=s=>new TextEncoder().encode(s);
const hash=b=>invoke('githubBlobHash(testBytes)',{testBytes:b});
async function local(entries){const map=new Map();for(const [p,s] of entries){const data=bytes(s);map.set(p,{bytes:data,sha:await hash(data),doc:{path:p,updatedAt:Date.now()}})}return map}
async function remote(entries){const files=new Map();for(const [p,s] of entries){const data=bytes(s);files.set(p,{sha:await hash(data),mode:'100644',size:data.length})}return {head:'a'.repeat(40),treeSha:'b'.repeat(40),files,directories:new Set(),unsupported:new Set()}}
const baseline=async(entries)=>{const m=new Map();for(const [p,s] of entries)m.set(p,{sha:await hash(bytes(s)),mode:'100644'});return m};
const classify=(a,b,c=new Map(),folders=[])=>invoke('githubClassify(a,b,c,folders)',{a,b,c,folders});
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++}
const base=await baseline([['test.md','initial'],['removed.txt','remove me']]);
let plan=classify(await local([['a.md','local']]),await remote([['b.md','remote']]));
check(plan.uploads.length===1&&plan.downloads.length===1&&!plan.conflicts.length,'new files on either side are synchronized');
check(plan.uploads[0].type==='add'&&plan.downloads[0].type==='upsert','new-file operation types');
plan=classify(await local([['test.md','initial']]),await remote([['test.md','initial']]),base);
check(!plan.uploads.length&&!plan.downloads.length&&!plan.conflicts.length,'unchanged files are not transferred');
plan=classify(await local([['test.md','local edited']]),await remote([['test.md','initial']]),base);
check(plan.uploads.length===1&&plan.uploads[0].type==='modify','only local edit is uploaded');
plan=classify(await local([['test.md','initial']]),await remote([['test.md','remote edited']]),base);
check(plan.downloads.length===1&&plan.downloads[0].type==='upsert','only remote edit is downloaded');
plan=classify(await local([['test.md','local edited']]),await remote([['test.md','remote edited']]),base);
check(plan.conflicts.length===1&&!plan.uploads.length&&!plan.downloads.length,'simultaneous edits must conflict without action');
let ops=invoke('githubSelectedOperations(plan, choices)',{plan,choices:new Map([['test.md','local']])});
check(ops.uploads.length===1&&ops.downloads.length===0,'local winner is selected for upload');
ops=invoke('githubSelectedOperations(plan, choices)',{plan,choices:new Map([['test.md','remote']])});
check(ops.downloads.length===1&&ops.uploads.length===0,'remote winner is selected for download');
ops=invoke('githubSelectedOperations(plan, choices)',{plan,choices:new Map()});
check(ops.pending.length===1&&!ops.uploads.length&&!ops.downloads.length,'unresolved conflict is skipped');
plan=classify(await local([['test.md','initial']]),await remote([]),base);
check(plan.downloads.length===1&&plan.downloads[0].type==='delete','remote deletion is applied to unchanged local copy');
plan=classify(await local([]),await remote([['test.md','initial']]),base);
check(plan.uploads.length===1&&plan.uploads[0].type==='delete','local deletion is applied to unchanged remote copy');
plan=classify(await local([]),await remote([['test.md','remote edited']]),base);
check(plan.conflicts.length===1,'remote edit vs local deletion is conflict');
plan=classify(await local([['test.md','local edited']]),await remote([]),base);
check(plan.conflicts.length===1,'local edit vs remote deletion is conflict');
plan=classify(await local([['test.md','updated']]),await remote([['test.md','updated']]),base);
check(plan.aligned.some(item=>item.path==='test.md')&&!plan.conflicts.length,'equal concurrent edits are adopted');
plan=classify(await local([['same.md','different']]),await remote([['same.md','remote']]));
check(plan.conflicts.length===1,'untracked differing copies are conflict');
plan=classify(await local([['same.md','identical']]),await remote([['same.md','identical']]));
check(plan.aligned.length===1,'untracked identical copies are adopted');
plan=classify(await local([['file.md','local']]),await remote([['FILE.md','remote']]));
check(plan.blocked.length===2,'case insensitive name collisions are blocked');
const remoteFolder=await remote([]);remoteFolder.directories.add('folder');
plan=classify(await local([['folder','local']]),remoteFolder);
check(plan.blocked.length===1,'folder/file collisions are blocked');
plan=classify(await local([]),await remote([['existing','remote']]),new Map(),['existing']);
check(plan.blocked.length===1,'explicit local folder is protected');
const large=await local([['large.dat','some bytes']]);large.get('large.dat').sha=null;
plan=classify(large,await remote([]));
check(plan.blocked.length===1,'oversized local content is protected');
const content=new Uint8Array([0,1,2,127,128,255,0,99]);
const encoded=invoke('githubBytesBase64(content)',{content});
const roundtrip=invoke('githubBase64Bytes(encoded)',{encoded});
check(Buffer.from(roundtrip).equals(Buffer.from(content)),'binary roundtrips exactly');
check((await hash(content)).length===40,'valid Git blob SHA-1');
check(invoke('githubNormalizeBranch("")')==='main','branch main is default');
check(invoke('githubNormalizeRepository("https://github.com/acme/project.git")').repo==='project','repository URL normalization');
assert.throws(()=>invoke('githubNormalizeRepository("https://evil.example/acme/project")'));checks++;
assert.throws(()=>invoke('githubNormalizeBranch("refs/../unsafe")'));checks++;
console.log(`PASS: ${checks} v34 three-way sync tests (add/edit/delete/conflict/security/bytes)`);
