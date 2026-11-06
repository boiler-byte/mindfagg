#!/usr/bin/env node
// v38: preference default/persistence, browser sandbox guard, opt-in code path.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>fs.readFileSync(path.join(root,name),'utf8');
const values=new Map();
function context(){
  const app={classList:{toggle(){}}};
  const style={removeProperty(){},setProperty(){}};
  const memory={
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value))
  };
  const ctx=vm.createContext({
    window:{matchMedia:()=>({matches:false})},
    localStorage:memory,
    document:{documentElement:{style}},
    $:()=>app,
    console,
  });
  vm.runInContext(load('ui/settings.js'),ctx);
  return ctx;
}
let state=context();
assert.equal(vm.runInContext('appEditorSettings.previewStorageAccess',state),false,'Opt-in must default to false');
vm.runInContext('appEditorSettings.previewStorageAccess=true;saveAppEditorPreferences()',state);
assert.equal(JSON.parse(values.get('mfEditorPreferencesV28')).previewStorageAccess,true,'Must persist enabled setting');
state=context();
assert.equal(vm.runInContext('appEditorSettings.previewStorageAccess',state),true,'Must restore stored consent');
vm.runInContext('Object.assign(appEditorSettings,{fontSize:null,wordWrap:false,lineNumbers:true,minimap:true});saveAppEditorPreferences()',state);
assert.equal(JSON.parse(values.get('mfEditorPreferencesV28')).previewStorageAccess,true,'Editor reset must not revoke storage');
vm.runInContext('appEditorSettings.previewStorageAccess=false;saveAppEditorPreferences()',state);
assert.equal(JSON.parse(values.get('mfEditorPreferencesV28')).previewStorageAccess,false);
values.set('mfEditorPreferencesV28','{"fontSize":14,"wordWrap":true}');
assert.equal(vm.runInContext('appEditorSettings.previewStorageAccess',context()),false,'Existing preferences must keep preview isolated');
const src=load('preview/html-preview.js');
assert.match(src,/frame\.setAttribute\('sandbox',appEditorSettings\.previewStorageAccess\?'allow-scripts allow-same-origin':'allow-scripts'\)/);
assert.match(src,/function htmlPreviewGrantStorage\(\)/);
assert.match(src,/htmlPreviewLoad\(\);/);
assert.match(src,/data-html-preview-storage-grant/);
assert.match(src,/if\(!appEditorSettings\.previewStorageAccess&&htmlPreviewStorageBlockedError\(text\)\)htmlPreviewSetConsoleOpen\(true\)/);
const helper=src.match(/const HTML_PREVIEW_STORAGE_BLOCKED=.*?;\s*function htmlPreviewStorageBlockedError\(text\)\{[\s\S]*?\n\}/);
assert.ok(helper,'Cannot locate storage error detector');
const inspect=vm.createContext({});
vm.runInContext(helper[0],inspect);
inspect.error="Uncaught SecurityError: Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.";
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),true);
inspect.error="SecurityError: Failed to execute 'open' on 'IDBFactory': The document is sandboxed and lacks the 'allow-same-origin' flag.";
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),true);
inspect.error='Uncaught ReferenceError: nothing is defined';
assert.equal(vm.runInContext('htmlPreviewStorageBlockedError(error)',inspect),false);
assert.equal(JSON.parse(load('module-manifest.json')).version,'v49');
assert.match(load('sw.js'),/const VERSION='mindfagg-v49'/);
console.log('PASS: v38 preview permissions default off, persist, recognize blocked storage, reload, and update cache version');
