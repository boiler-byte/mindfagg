#!/usr/bin/env node
// v34: real AES-GCM credential persistence, restore, replacement and removal.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'workspace/github.js'),'utf8');
const settings=new Map();
const accesses=[];
const ctx=vm.createContext({
  crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,Map,Set,console,
  fetch:async (url,request)=>{
    accesses.push({url,request});
    const valid=request.headers.Authorization==='Bearer github_pat_verified_token';
    return {ok:valid,status:valid?200:401,json:async()=>valid?{login:'alice'}:{message:'Bad credentials'}};
  },
  tx:(store)=>{
    assert.equal(store,'settings');
    return {get:key=>({result:settings.get(key)}),
      put:row=>{settings.set(row.key,row);return {result:row.key}},
      delete:key=>{settings.delete(key);return {result:undefined}}};
  },
  req:async request=>request.result,
  $:()=>null,project:()=>null,projectId:null,
  clearTimeout,setTimeout
});
vm.runInContext(source,ctx,{filename:'workspace/github.js'});
const invoke=expression=>vm.runInContext(expression,ctx);
let tests=0;
const check=(condition,message)=>{assert.ok(condition,message);tests++};
check(await invoke('githubSaveCredentials("github_pat_verified_token")')==='alice','token verified before persistence');
check(settings.has('github-credential'),'cipher persisted');
check(settings.has('github-aes-key'),'non-extractable crypto key persisted');
check(settings.get('github-aes-key').value.extractable===false,'encryption key cannot be exported');
check(settings.get('github-credential').cipher instanceof Uint8Array,'encrypted binary stored');
check(JSON.stringify([...settings]).indexOf('github_pat_verified_token')<0,'raw token absent from settings');
check(accesses.length===1&&accesses[0].url==='https://api.github.com/user','verification uses GitHub API');
invoke('githubCredentialToken=null;githubCredentialAccount=""');
await invoke('githubRestoreCredentials()');
check(invoke('githubCredentialToken')==='github_pat_verified_token','token decrypts after app restart');
check(invoke('githubCredentialAccount')==='alice','account restored');
let rejected=false;
try{await invoke('githubSaveCredentials("bad_token")')}catch(error){rejected=/401/.test(error.message)}
check(rejected,'invalid token rejected');
check(invoke('githubCredentialToken')==='github_pat_verified_token','invalid replacement does not erase token');
await invoke('githubRemoveCredentials()');
check(!settings.has('github-credential'),'remove erases saved credential');
check(invoke('githubCredentialToken')===null,'remove erases in-memory access');
await invoke('githubRestoreCredentials()');
check(invoke('githubCredentialToken')===null,'removed token does not reappear on next startup');
console.log(`PASS: ${tests} v34 AES-GCM credential tests`);
