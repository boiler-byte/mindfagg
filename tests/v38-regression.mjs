#!/usr/bin/env node
// v59: supersedes the former v38 privileged-preview regression.
// Stored opt-in flags from earlier installations are ignored.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const values=new Map([['mfEditorPreferencesV28',JSON.stringify({wordWrap:true,previewStorageAccess:true})]]);
const ctx=vm.createContext({
  console,window:{matchMedia:()=>({matches:false})},
  document:{documentElement:{style:{setProperty(){},removeProperty(){}}}},
  $:()=>({classList:{toggle(){}}}),
  CSV_DEFAULT_SETTINGS:{delimiter:',',encoding:'utf-8',newline:'\n',quoteChar:'"'},
  csvNormalizeOptions:()=>({}),
  localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))}
});
vm.runInContext(read('ui/settings.js'),ctx);
assert.equal(vm.runInContext("Object.hasOwn(appEditorSettings,'previewStorageAccess')",ctx),false);
assert.equal(vm.runInContext('appEditorSettings.wordWrap',ctx),true);
vm.runInContext('saveAppEditorPreferences()',ctx);
assert.equal(Object.hasOwn(JSON.parse(values.get('mfEditorPreferencesV28')),'previewStorageAccess'),false);
const src=read('preview/html-preview.js');
assert.match(src,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
assert.doesNotMatch(src,/htmlPreviewGrantStorage|data-html-preview-storage-grant|appEditorSettings\.previewStorageAccess/);
const helper=src.match(/const HTML_PREVIEW_STORAGE_BLOCKED=.*?;\s*function htmlPreviewStorageBlockedError\(text\)\{[\s\S]*?\n\}/);
assert.ok(helper);
const inspect=vm.createContext({});vm.runInContext(helper[0],inspect);
inspect.error="Uncaught SecurityError: Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.";
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),true);
inspect.error="SecurityError: Failed to execute 'open' on 'IDBFactory': The document is sandboxed and lacks the 'allow-same-origin' flag.";
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),true);
inspect.error='Uncaught ReferenceError: nothing is defined';
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),false);
assert.equal(JSON.parse(read('module-manifest.json')).version,'v62');
assert.match(read('sw.js'),/const VERSION='mindfagg-v62'/);
console.log('PASS: legacy v38 storage opt-in is revoked, preview stays sandboxed and storage errors are detected');
