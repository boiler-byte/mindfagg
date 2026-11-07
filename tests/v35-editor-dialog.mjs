#!/usr/bin/env node
// v35: Verify browser autocomplete on code editors and node dialog layout.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const markdown=read('markdown/editor.js'),script=read('script/editor.js'),dialogs=read('ui/dialogs.js');
for(const [src,id] of [[markdown,'source'],[script,'scriptSource']]){
  const area=src.match(new RegExp(`<textarea\\s+id="${id}"[^>]*>`));
  assert.ok(area,`Missing textarea ${id}`);
  assert.match(area[0],/\bautocomplete="off"/,`${id}: autocomplete must be off`);
}
const edit=dialogs.split('function editNode(path){',2)[1]?.split('function navigateLink(',1)[0];
assert.ok(edit,'editNode() not found');
const description=edit.indexOf('id="nodeDescription"');
const date=edit.indexOf('${nodeDateFieldsHtml(n.date)}');
assert.ok(description!==-1&&date!==-1&&description<date,'Description must precede date in edit dialog');
assert.match(edit,/id="nodeDescription" autocomplete="off"/,'Node description autocomplete must be off');
const add=dialogs.split('function addNode(){',2)[1]?.split('function findHeadingEnd',1)[0];
assert.match(add,/\$\{nodeDateFieldsHtml\(\)\}/,'Node creation dialog must retain date field');
assert.equal(JSON.parse(read('module-manifest.json')).version,'v53');
assert.match(read('sw.js'),/const VERSION='mindfagg-v53'/);
console.log('PASS: v35 editor regression under v44, node-edit field order, node creation and offline cache version');
