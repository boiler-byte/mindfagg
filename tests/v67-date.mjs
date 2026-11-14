#!/usr/bin/env node
// v67: case-sensitive Y/M/D/h/m durations, optional :MM and minute-accurate calendar ranges.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context=vm.createContext({
  console,plain:value=>value,mapStatusColor:()=> '#778899',
  STATUS:['story','todo','doing','review','done'],statusLabel:s=>s
});
for(const filename of ['markdown/parser.js','views/calendar.js'])
  vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),context,{filename});
const call=(fn,...args)=>vm.runInContext(`${fn}(${args.map(arg=>JSON.stringify(arg)).join(',')})`,context);
const norm=value=>JSON.parse(JSON.stringify(value));
const parse=text=>norm(call('parseNodeDatePayload',text));
const valid=text=>{const date=parse(text);assert.notEqual(date,null,`Should accept ${text}`);return date};
const serialized=text=>call('serializeNodeDate',valid(text));
const end=text=>norm(call('nodeDateEndInfo',valid(text)));

for(const raw of [
  '2026-11-13:24','2026-11-13:18:60','2026-11-13:18:99','2026-11-13:18:',
  '2026-11-13:18::00','2026-11-13::30','2026-11-13:18:-1',
  '2026-02-29:18:00','2026-11-13:18:00:01',
  '2026-11-13 +1y','2026-11-13 +1d','2026-11-13 +1H','2026-11-13 +1x',
  '2026-11-13 +0m','2026-11-13 -5m','2026-11-13 +2m +1m',
  '2026-11-13 +1M +2M','2026-11-13 +2D +1D',
  '2026-11-13:18:00 +9007199254740992m',
  '2026-11-13:18:00 +30m junk'
])assert.equal(parse(raw),null,`Should reject ${raw}`);

assert.deepEqual(valid('2026-11-13'),{
  start:'2026-11-13',hour:null,minute:null,duration:{Y:0,M:0,D:0,h:0,m:0}
});
assert.equal(serialized('2026-11-13'),'[date:2026-11-13]');
assert.equal(serialized('2026-11-13:18'),'[date:2026-11-13:18]');
assert.equal(serialized('2026-11-13:9:5'),'[date:2026-11-13:09:05]');
assert.equal(serialized('2026-11-13:18:00 +30m'),'[date:2026-11-13:18:00 +30m]');
assert.equal(serialized('2026-11-13:18:00 +30m +1D +1Y +2h +2M'),
  '[date:2026-11-13:18:00 +1Y +2M +1D +2h +30m]');
assert.equal(serialized('2026-11-13 +1M +1m'),'[date:2026-11-13 +1M +1m]',
  'uppercase M must denote a month; lowercase m denotes a minute');
assert.deepEqual(end('2026-11-13:18:00 +30m'),{day:'2026-11-13',hour:18,minute:30});
assert.deepEqual(end('2026-11-13:18:45 +30m'),{day:'2026-11-13',hour:19,minute:15});
assert.deepEqual(end('2026-11-13:18:30 +90m'),{day:'2026-11-13',hour:20,minute:0});
assert.deepEqual(end('2026-11-13:23:30 +30m'),{day:'2026-11-14',hour:0,minute:0});
assert.deepEqual(end('2026-11-13:23:30 +31m'),{day:'2026-11-14',hour:0,minute:1});
assert.deepEqual(end('2026-11-13:23:59 +2m'),{day:'2026-11-14',hour:0,minute:1});
assert.deepEqual(end('2026-11-13 +1m'),{day:'2026-11-13',hour:0,minute:1});
assert.deepEqual(end('2026-11-13:18 +6h'),{day:'2026-11-14',hour:0,minute:0});
assert.deepEqual(end('2026-11-13 +1D'),{day:'2026-11-14',hour:null,minute:null});
assert.deepEqual(end('2026-01-31:23:30 +1M +2h'),{day:'2026-03-01',hour:1,minute:30});
assert.deepEqual(end('2024-02-29:23:59 +1Y +2m'),{day:'2025-03-01',hour:0,minute:1});
assert.deepEqual(end('2026-12-31:23:45 +30m'),{day:'2027-01-01',hour:0,minute:15});
assert.equal(end('9999-12-31:23:59 +1m'),null);
assert.equal(end('2026-11-13:18 +9007199254740991h'),null);
assert.equal(call('nodeDateEnd',valid('2026-11-13 +2D')),'2026-11-15');
assert.equal(norm(call('nodeText','[date:2026-11-13:18:00 +30m] Termin')).title,'Termin');
assert.equal(norm(call('nodeText','[date:2026-11-13 +1d] Termin')).date,null);
assert.equal(norm(call('nodeText','[date:2026-11-13 +1d] Termin')).title,'[date:2026-11-13 +1d] Termin');
assert.equal(norm(call('nodeDatePrefix','[date:2026-11-13 +1M +1m] Aufgabe')).date.duration.M,1);
assert.equal(norm(call('nodeDatePrefix','[date:2026-11-13 +1M +1m] Aufgabe')).date.duration.m,1);

vm.runInContext(`currentModel=parseMarkdown('# Root\\n'
  +'- [date:2026-11-13] Ganztags\\n'
  +'- [date:2026-11-13:18:45 +30m] Spaeter\\n'
  +'- [date:2026-11-13:18:00 +30m] Frueher\\n'
  +'- [date:2026-11-13:23:30 +30m] ExaktMitternacht\\n'
  +'- [date:2026-11-13:23:30 +31m] UeberMitternacht\\n'
  +'- [date:2026-11-13 +1D] Mehrtag\\n'
  +'- [date:2026-11-13 +1M] Monat\\n'
  +'- [date:2026-11-13 +1m] EineMinute\\n'
  +'- [date:2026-11-13 +1d] Ungueltig')`,context);
const events=norm(call('calendarDatedNodes'));
assert.equal(events.length,8);
assert.deepEqual(events.map(e=>e.title),[
  'Ganztags','Mehrtag','Monat','EineMinute','Frueher','Spaeter','ExaktMitternacht','UeberMitternacht'
]);
assert.equal(events.find(e=>e.title==='ExaktMitternacht').end,'2026-11-13');
assert.equal(events.find(e=>e.title==='ExaktMitternacht').endDate,'2026-11-14');
assert.equal(events.find(e=>e.title==='UeberMitternacht').end,'2026-11-14');
assert.equal(events.find(e=>e.title==='Mehrtag').end,'2026-11-14');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='Frueher')),
  '13.11.2026, 18:00 Uhr – 13.11.2026, 18:30 Uhr');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='Spaeter')),
  '13.11.2026, 18:45 Uhr – 13.11.2026, 19:15 Uhr');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='ExaktMitternacht')),
  '13.11.2026, 23:30 Uhr – 14.11.2026, 00:00 Uhr');
assert.equal(call('calendarEventRange',events.find(e=>e.title==='Ganztags')),'13.11.2026');
console.log('PASS: v67 Y/M/D/h/m date syntax, minute normalization, range arithmetic, midnight occupancy, calendar ordering');
