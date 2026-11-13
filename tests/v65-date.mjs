#!/usr/bin/env node
// v65: backward-compatible date tags, hourly ranges and calendar occupancy.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({
  console,
  plain:value=>value,
  mapStatusColor:()=> '#778899',
  STATUS:['story','todo','doing','review','done'],
  statusLabel:s=>s
});
for(const name of ['markdown/parser.js','views/calendar.js']){
  vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
}
const call=(fn,...args)=>vm.runInContext(`${fn}(${args.map(arg=>JSON.stringify(arg)).join(',')})`,context);
const norm=value=>JSON.parse(JSON.stringify(value));
const parse=value=>norm(call('parseNodeDatePayload',value));
const date=value=>{const result=parse(value);assert(result!==null,`Unexpected invalid date: ${value}`);return result};
const serialize=value=>call('serializeNodeDate',date(value));
const end=value=>norm(call('nodeDateEndInfo',date(value)));
const invalid=[
  '2026-11-13:24','2026-11-13:99','2026-11-13:-1','2026-11-13:','2026-11-13:18:30',
  '2026-11-13:18 +0h','2026-11-13:18 -6h','2026-11-13:18 +6h +2h',
  '2026-11-13:18 +1d +2d','2026-11-13:18 +1x','2026-02-29:18',
  '2026-11-13:18 +9007199254740992h'
];
for(const raw of invalid)assert.equal(parse(raw),null,raw);
assert.deepEqual(date('2026-11-13'),{start:'2026-11-13',hour:null,duration:{y:0,m:0,d:0,h:0}});
assert.equal(serialize('2026-11-13'),'[date:2026-11-13]');
assert.equal(serialize('2026-11-13 +1y +2m +3d'),'[date:2026-11-13 +1y +2m +3d]');
assert.equal(serialize('2026-11-13:18'),'[date:2026-11-13:18]');
assert.equal(serialize('2026-11-13:0 +6h'),'[date:2026-11-13:00 +6h]');
assert.equal(serialize('2026-11-13:18 +6h +1d +2m'),'[date:2026-11-13:18 +2m +1d +6h]');
assert.equal(serialize('2026-11-13 +6h'),'[date:2026-11-13 +6h]');
assert.equal(norm(call('nodeDatePrefix','[date:2026-11-13:18 +6h] Titel')).date.hour,18);
assert.equal(norm(call('nodeText','[date:2026-11-13:18 +6h] Termin')).title,'Termin');
assert.equal(norm(call('nodeText','[date:2026-11-13:24] Termin')).date,null);
assert.equal(norm(call('nodeText','[date:2026-11-13:24] Termin')).title,'[date:2026-11-13:24] Termin');
assert.deepEqual(end('2026-11-13:18 +6h'),{day:'2026-11-14',hour:0});
assert.deepEqual(end('2026-11-13:23 +2h'),{day:'2026-11-14',hour:1});
assert.deepEqual(end('2026-11-13:18'),{day:'2026-11-13',hour:18});
assert.deepEqual(end('2026-11-13 +6h'),{day:'2026-11-13',hour:6});
assert.deepEqual(end('2026-11-13 +1d'),{day:'2026-11-14',hour:null});
assert.deepEqual(end('2026-01-31:23 +1m +2h'),{day:'2026-03-01',hour:1});
assert.deepEqual(end('2026-03-29:23 +3h'),{day:'2026-03-30',hour:2});
assert.deepEqual(end('2026-12-31:23 +2h'),{day:'2027-01-01',hour:1});
assert.deepEqual(end('2024-02-29:23 +1y +2h'),{day:'2025-03-01',hour:1});
assert.equal(end('9999-12-31:23 +1h'),null);
assert.equal(call('nodeDateEnd',date('2026-11-13 +2d')),'2026-11-15');

vm.runInContext(`currentModel=parseMarkdown('# Projekt\\n- [date:2026-11-13] Ganztags\\n- [date:2026-11-13:19] Spaet\\n- [date:2026-11-13:18 +6h] Bis Mitternacht\\n- [date:2026-11-13:23 +2h] Nacht\\n- [date:2026-11-13:20 +1d] Mehrtag\\n- [date:2026-11-13:25] Ungueltig')`,context);
const events=norm(call('calendarDatedNodes'));
assert.equal(events.length,5);
assert.deepEqual(events.map(e=>e.title),['Ganztags','Bis Mitternacht','Spaet','Mehrtag','Nacht']);
assert.equal(events.find(e=>e.title==='Bis Mitternacht').end,'2026-11-13','midnight end is exclusive');
assert.equal(events.find(e=>e.title==='Bis Mitternacht').endDate,'2026-11-14');
assert.equal(events.find(e=>e.title==='Nacht').end,'2026-11-14','over-midnight interval occupies the next day');
assert.equal(events.find(e=>e.title==='Mehrtag').end,'2026-11-14','legacy +1d remains inclusive');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='Bis Mitternacht')),
             '13.11.2026, 18:00 Uhr – 14.11.2026, 00:00 Uhr');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='Ganztags')),'13.11.2026');
console.log('PASS: v65 date parser, canonical tags, invalid dates, UTC hour rollover, calendar ranges and legacy periods');
