#!/usr/bin/env node
// v40: default-off folding and persistence in the existing app preferences key.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const preferences=new Map();
const create=()=>{
  const classes=new Map(),style={setProperty(){},removeProperty(){}};
  const ctx=vm.createContext({
    localStorage:{getItem:k=>preferences.get(k)??null,setItem:(k,v)=>preferences.set(k,String(v))},
    document:{documentElement:{style}},window:{matchMedia:()=>({matches:false})},
    console,$:()=>({classList:{toggle:(key,value)=>classes.set(key,value)}})
  });
  vm.runInContext(fs.readFileSync(path.join(root,'ui/settings.js'),'utf8'),ctx);
  return {ctx,classes};
};
let {ctx,classes}=create();
assert.equal(vm.runInContext('appEditorSettings.codeFolding',ctx),false);
assert.equal(classes.get('editor-code-folding'),false);
vm.runInContext('appEditorSettings.codeFolding=false;saveAppEditorPreferences();applyAppEditorPreferences()',ctx);
assert.equal(classes.get('editor-code-folding'),false);
assert.equal(JSON.parse(preferences.get('mfEditorPreferencesV28')).codeFolding,false);
ctx=create().ctx;
assert.equal(vm.runInContext('appEditorSettings.codeFolding',ctx),false);
vm.runInContext('appEditorSettings.codeFolding=true;saveAppEditorPreferences()',ctx);
assert.equal(vm.runInContext('appEditorSettings.codeFolding',create().ctx),true);
preferences.set('mfEditorPreferencesV28',JSON.stringify({wordWrap:true,previewStorageAccess:false}));
assert.equal(vm.runInContext('appEditorSettings.codeFolding',create().ctx),false,'old v38 preferences without a folding key default off');
assert.match(fs.readFileSync(path.join(root,'ui/settings.js'),'utf8'),/appCodeFolding/);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'module-manifest.json'),'utf8')).version,'v53');
console.log('PASS: Code Folding defaults off, persists off/on, preserves v38 preferences and cache version');
