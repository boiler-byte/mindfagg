#!/usr/bin/env node
// v59: old stored HTML preview opt-in must not re-enable same-origin access.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const values=new Map([['mfEditorPreferencesV28',JSON.stringify({wordWrap:true,previewStorageAccess:true})]]);
const ctx=vm.createContext({
  console,CSV_DEFAULT_SETTINGS:{delimiter:',',encoding:'utf-8',newline:'\n',quoteChar:'"'},
  csvNormalizeOptions:()=>({}),
  window:{matchMedia:()=>({matches:false})},
  document:{documentElement:{style:{setProperty(){},removeProperty(){}}}},
  $:()=>({classList:{toggle(){}}}),
  localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))}
});
vm.runInContext(fs.readFileSync(path.join(root,'ui/settings.js'),'utf8'),ctx);
assert.equal(vm.runInContext("Object.hasOwn(appEditorSettings,'previewStorageAccess')",ctx),false);
assert.equal(vm.runInContext('appEditorSettings.wordWrap',ctx),true);
vm.runInContext('saveAppEditorPreferences()',ctx);
assert.equal(Object.hasOwn(JSON.parse(values.get('mfEditorPreferencesV28')),'previewStorageAccess'),false);
const html=fs.readFileSync(path.join(root,'preview/html-preview.js'),'utf8');
assert.match(html,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
assert.doesNotMatch(html,/htmlPreviewGrantStorage|data-html-preview-storage-grant|appEditorSettings\.previewStorageAccess/);
assert.match(html,/content-security-policy/i);
const settings=fs.readFileSync(path.join(root,'ui/settings.js'),'utf8');
assert.doesNotMatch(settings,/appPreviewStorageAccess|previewStorageAccess/);
assert.match(settings,/Immer isoliert/);
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'module-manifest.json'),'utf8')).version,'v65');
assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/const VERSION='mindfagg-v65'/);
console.log('PASS: legacy preview origin permission is ignored, removed from persisted settings and never present in new sandbox');
