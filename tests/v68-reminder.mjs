#!/usr/bin/env node
// v68: reminder metadata parsing, stable IDs, uniqueness, scoped completion, calendar neutrality.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let sequence=0;
const crypto={getRandomValues(array){array[0]=sequence++;return array}};
const context=vm.createContext({console,crypto,plain:x=>x,mapStatusColor:()=> '#778899',STATUS:['story','todo','doing','review','done'],statusLabel:s=>s});
for(const file of ['markdown/parser.js','views/calendar.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const call=(name,...args)=>vm.runInContext(`${name}(${args.map(arg=>JSON.stringify(arg)).join(',')})`,context);
const norm=obj=>JSON.parse(JSON.stringify(obj));
const parse=text=>norm(call('parseNodeDatePayload',text));
const serialize=text=>call('serializeNodeDate',parse(text));
for(const token of [
  '2026-11-13:18:00 +1h !a7f3:30m',
  '2026-11-13:18 +1h !a7f3:1h',
  '2026-11-13:18 +1h !a7f3:1D',
  '2026-11-13:18 +1h !a7f3:0m',
  '2026-11-13:18 +1h !0m',
  '2026-11-13 !9999Y',
  '2026-11-13:18 !0M',
  '2026-11-13:18 +1Y +2M +3D +4h +5m !0m'
])assert(parse(token)!==null,token);
const date=parse('2026-11-13:18:00 +1h !a7f3:30m');
assert.deepEqual(date.reminder,{id:'a7f3',amount:30,unit:'m'});
assert.equal(serialize('2026-11-13:18 +1h !a7f3:0m'),'[date:2026-11-13:18 +1h !a7f3:0m]');
assert.equal(serialize('2026-11-13:18 !0m'),'[date:2026-11-13:18 !0m]','parser/serializer do not generate IDs');
assert.deepEqual(parse('2026-11-13:18 +1h !0m').reminder,{id:null,amount:0,unit:'m'});
assert.equal(call('nodeDatePrefix','[date:2026-11-13:18 +1h !a7f3:1D] Termin').date.reminder.id,'a7f3');
assert.equal(norm(call('nodeText','[date:2026-11-13:18 +1h !0m] Termin')).title,'Termin');
assert.deepEqual(norm(call('nodeDateEndInfo',date)),{day:'2026-11-13',hour:19,minute:0},'reminder offset must not change duration');
for(const token of [
  '2026-11-13 !-1m','2026-11-13 !00m','2026-11-13 !+1h','2026-11-13 !1d',
  '2026-11-13 !1x','2026-11-13 !1h +1D','2026-11-13 !1h !2m',
  '2026-11-13 !abcd:1m !1234:2h','2026-11-13 !abc:1m',
  '2026-11-13 !abcdef:1m','2026-11-13 !A7F3:1h','2026-11-13 !a7f3:-1m',
  '2026-11-13 !9007199254740992m','2026-11-13 +0h !0m',
  '2026-11-13 +1h +1h !0m'
])assert.equal(parse(token),null,token);

const source=[
  '# Root',
  '- [date:2026-11-13:18 +1h !a7f3:1D] Vorhanden',
  '- [x] [status:todo] [date:2026-11-13:18 +1h !0m] Neu A',
  '- [status:doing] [date:2026-11-13:18:00 +1h !30m] Neu B',
  '- [date:2026-11-13:18 +1h !1h] Neu C',
  '- [date:2026-11-13 !abc:1m] Ungueltig',
  'Beschreibung [date:2026-11-13 !0m] nicht in Knoten-Attributen',
  '```md',
  '- [date:2026-11-13 !0m] Code darf nicht veraendert werden',
  '```',
  '- [date:2026-11-13 !0m] Neu D'
].join('\n');
const completed=norm(call('completeMarkdownReminderIds',source,[{content:'- [date:2026-11-13 !0000:0m] Andere Datei'}]));
assert.equal(completed.insertions.length,4);
assert(completed.text.includes('!a7f3:1D] Vorhanden'));
assert(completed.text.includes('!0001:0m] Neu A'));
assert(completed.text.includes('!0002:30m] Neu B'));
assert(completed.text.includes('!0003:1h] Neu C'));
assert(completed.text.includes('!0004:0m] Neu D'));
assert(completed.text.includes('!0m] Code darf nicht veraendert werden'));
assert(completed.text.includes('!abc:1m] Ungueltig'));
assert.equal(norm(call('completeMarkdownReminderIds',completed.text)).text,completed.text,'completion must be idempotent');
assert.deepEqual(norm(call('completeMarkdownReminderIds',completed.text)).insertions,[]);
assert.equal(vm.runInContext('nodeReminderKnownIds('+JSON.stringify(completed.text)+',[{content:\'\u005bdate:2026-11-13 !dead:1h]\'}]).has(\'dead\')',context),true);
assert.equal(call('serializeNodeDate',date),'[date:2026-11-13:18:00 +1h !a7f3:30m]');
vm.runInContext('currentModel=parseMarkdown('+JSON.stringify(completed.text)+')',context);
const events=norm(call('calendarDatedNodes'));
assert.equal(events.length,5);
assert.equal(events.find(event=>event.title==='Neu A').endDate,'2026-11-13');
console.log('PASS: v68 reminder syntax, offsets including zero, stable hex IDs, collision resistance, fenced-code protection, calendar neutrality');
