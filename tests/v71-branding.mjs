#!/usr/bin/env node
// v71: visible shorthand only in the sidebar, document title and PWA shortcut.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const manifest=JSON.parse(read('manifest.webmanifest'));
const sw=read('sw.js');
const modules=JSON.parse(read('module-manifest.json'));

assert.match(html,/<aside class="sidebar"[^>]*>.*?<button[^>]*class="brand"[^>]*>.*?<strong>mifa<\/strong><\/button>/s);
assert.match(html,/<title>mifa - Mindmap Markdown<\/title>/);
assert.equal((html.match(/<title>/g)||[]).length,1);
assert.equal(manifest.name,'mifa');
assert.equal(manifest.short_name,'mifa');
assert.match(html,/<meta name="application-name" content="mifa">/);
assert.match(html,/<meta name="apple-mobile-web-app-title" content="mifa">/);
assert.equal((html.match(/<strong>mifa<\/strong>/g)||[]).length,1);
assert.equal((html.match(/<title>mifa - Mindmap Markdown<\/title>/g)||[]).length,1);
assert.equal((html.match(/content="mifa"/g)||[]).length,2);
assert.equal(manifest.start_url,'./index.html');
assert.equal(manifest.scope,'./');
assert.deepEqual(manifest.icons,[
 {src:'icons/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},
 {src:'icons/icon-maskable.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}
]);
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'icons/icon.svg'))).digest('hex'),'5e3b91978eba2f1af6927b8d0252b15146ba9da84e9c42c4ef00823e815f31e5');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'icons/icon-maskable.svg'))).digest('hex'),'c93849d02f43ed25ccce7d23dcdc4d2c2fae4caac1c594a4694a8ae90969550b');
// Preserve original app identity across storage, routing and cache namespaces.
assert.match(read('core/database.js')+read('core/documents.js'),/mindfagg-db/);
assert.match(sw,/const VERSION='mindfagg-v72'/);
assert.match(sw,/__mindfagg_preview__/);
assert.equal(modules.version,'v72');
assert.match(html,/<meta name="description" content="mindfagg/);
assert.match(read('ui/settings.js'),/class="app-settings-kicker">mindfagg</);
console.log('PASS: three visible branding locations, PWA mobile metadata, original icon checksums and internal identity');
