'use strict';
// Kalender: Datumsauswahl, Monatsansicht, Ereignisse und Navigation.
// Month/selected day remain in session when switching tabs or documents.
const calendarNow=new Date();
let calendarMonth={year:calendarNow.getFullYear(),month:calendarNow.getMonth()+1},calendarSelectedDay=null;

// mindfagg v20: render only nodes whose [date:...] marker passed the shared parser.
// All calendar arithmetic is UTC-based; the user's local date is used only for "Heute".
function calendarKey(year,month,day){
  return String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}
function calendarUTC(year,month,day){
  const value=new Date(0);
  value.setUTCHours(0,0,0,0);
  value.setUTCFullYear(year,month-1,day);
  return value;
}
function calendarDateKey(date){return calendarKey(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate())}
function calendarTodayKey(){
  const today=new Date();
  return calendarKey(today.getFullYear(),today.getMonth()+1,today.getDate());
}
function calendarDisplayDate(key){
  const [year,month,day]=key.split('-').map(Number);
  return String(day).padStart(2,'0')+'.'+String(month).padStart(2,'0')+'.'+String(year).padStart(4,'0');
}
function calendarFullDate(key){
  const [year,month,day]=key.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(calendarUTC(year,month,day));
}
function calendarDatedNodes(){
  return flattened(currentModel).filter(node=>node.kind!=='virtual'&&node.date?.start).map(node=>{
    const end=nodeDateEnd(node.date);
    const hasDuration=Object.values(node.date.duration||{}).some(Boolean);
    return {path:node.path,start:node.date.start,end:end||(hasDuration?'9999-12-31':node.date.start),
      endBeyond:hasDuration&&!end,title:plain(node.title)||'Ohne Titel',accent:mapStatusColor(node),
      status:node.status&&STATUS.includes(node.status)?statusLabel(node.status):node.checked===true?statusLabel('done'):''};
  }).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'de'));
}
function calendarShiftMonth(delta){
  const index=(calendarMonth.year-1)*12+(calendarMonth.month-1)+delta;
  if(index<0||index>=9999*12)return;
  calendarMonth={year:Math.floor(index/12)+1,month:index%12+1};
  calendarSelectedDay=null;
  renderCalendar();
}
function renderCalendar(){
  const {year,month}=calendarMonth;
  const first=calendarUTC(year,month,1);
  const startOffset=(first.getUTCDay()+6)%7; // Monday is the first column.
  const length=calendarUTC(year,month+1,0).getUTCDate();
  const firstVisible=calendarUTC(year,month,1-startOffset);
  const cellCount=Math.ceil((startOffset+length)/7)*7;
  const dates=Array.from({length:cellCount},(_,index)=>{
    const day=calendarUTC(firstVisible.getUTCFullYear(),firstVisible.getUTCMonth()+1,firstVisible.getUTCDate()+index);
    const y=day.getUTCFullYear(),m=day.getUTCMonth()+1,d=day.getUTCDate();
    return {key:calendarDateKey(day),year:y,month:m,day:d,valid:y>=1&&y<=9999};
  });
  const entries=calendarDatedNodes();
  const monthStart=calendarKey(year,month,1),monthEnd=calendarKey(year,month,length);
  const monthEntries=entries.filter(entry=>entry.start<=monthEnd&&entry.end>=monthStart);
  const visibleEntries=entries.filter(entry=>entry.start<=dates.at(-1).key&&entry.end>=dates[0].key);
  const eventsByDate=new Map();
  for(const date of dates){
    eventsByDate.set(date.key,date.valid?visibleEntries.filter(entry=>entry.start<=date.key&&entry.end>=date.key):[]);
  }
  const today=calendarTodayKey();
  if(!calendarSelectedDay||calendarSelectedDay.slice(0,7)!==monthStart.slice(0,7)){
    const firstWithEvent=dates.find(date=>date.month===month&&date.year===year&&(eventsByDate.get(date.key)||[]).length);
    calendarSelectedDay=today.slice(0,7)===monthStart.slice(0,7)&&(eventsByDate.get(today)||[]).length?today:firstWithEvent?.key||(today.slice(0,7)===monthStart.slice(0,7)?today:monthStart);
  }
  const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
  const monthLabel=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'UTC'}).format(first);
  const selected=eventsByDate.get(calendarSelectedDay)||[];
  const dateRange=entry=>calendarDisplayDate(entry.start)+(entry.end!==entry.start?' – '+(entry.endBeyond?'nach 9999':calendarDisplayDate(entry.end)):'');
  const cellHTML=dates.map(date=>{
    if(!date.valid)return '<div class="calendar-day is-unavailable" aria-hidden="true"></div>';
    const dayEntries=eventsByDate.get(date.key)||[];
    const todayClass=date.key===today?' is-today':'';
    const selectedClass=date.key===calendarSelectedDay?' is-selected':'';
    const outsideClass=date.month!==month||date.year!==year?' is-outside':'';
    const shown=dayEntries.slice(0,3);
    return `<div class="calendar-day${outsideClass}${todayClass}${selectedClass}" data-calendar-cell="${date.key}">
      <div class="calendar-day-head"><button type="button" class="calendar-date-button" data-calendar-day="${date.key}"
        aria-label="${escapeHtml(calendarFullDate(date.key))}, ${dayEntries.length} datierte Knoten" aria-pressed="${date.key===calendarSelectedDay}">${date.day}${dayEntries.length?`<span class="calendar-day-count" aria-hidden="true">${dayEntries.length}</span>`:''}</button></div>
      <div class="calendar-event-stack">${shown.map(entry=>`<button type="button" class="calendar-event${entry.start!==entry.end?' is-period':''}" data-calendar-node="${escapeHtml(entry.path)}"
        style="--calendar-accent:${entry.accent}" title="${escapeHtml(entry.title+' · '+dateRange(entry))}" aria-label="${escapeHtml(entry.title+' bearbeiten, '+dateRange(entry))}"><span class="calendar-event-dot" aria-hidden="true"></span><span class="calendar-event-title">${escapeHtml(entry.title)}</span></button>`).join('')}
      ${dayEntries.length>3?`<button type="button" class="calendar-more" data-calendar-more="${date.key}">+${dayEntries.length-3} weitere</button>`:''}</div>
      <div class="calendar-mobile-indicators" aria-hidden="true">${dayEntries.slice(0,4).map(entry=>`<span class="calendar-mobile-dot" style="--calendar-accent:${entry.accent}"></span>`).join('')}</div>
    </div>`;
  }).join('');
  $('#surface').innerHTML=`<div class="calendar-view" id="calendarView">
    <div class="calendar-top"><div><div class="calendar-kicker">Monatskalender</div><h2 class="calendar-month-title" id="calendarMonthTitle">${escapeHtml(monthLabel)}</h2>
    <div class="calendar-summary">${monthEntries.length} ${monthEntries.length===1?'datierter Knoten':'datierte Knoten'} in diesem Monat</div></div>
    <div class="calendar-navigation" role="group" aria-label="Kalendernavigation">
      <button type="button" id="calendarPrev" aria-label="Vorheriger Monat" title="Vorheriger Monat" ${year===1&&month===1?'disabled':''}>‹</button>
      <button type="button" class="calendar-jump" id="calendarToday">Heute</button>
      <button type="button" id="calendarNext" aria-label="Nächster Monat" title="Nächster Monat" ${year===9999&&month===12?'disabled':''}>›</button>
    </div></div>
    <div class="calendar-scroll" id="calendarScroll">
      <div class="calendar-weekdays" aria-hidden="true">${weekdays.map(day=>`<span>${day}</span>`).join('')}</div>
      <div class="calendar-grid" role="group" aria-label="${escapeHtml(monthLabel)}">${cellHTML}</div>
      ${!entries.length?'<div class="calendar-no-dates">Dieses Dokument enthält noch keine Knoten mit gültigem <code>[date:…]</code>-Tag. Füge ein Datum im Markdown oder im Knoten-Dialog hinzu.</div>':''}
      <section class="calendar-agenda" aria-label="Einträge des ausgewählten Tages">
        <div class="calendar-agenda-top"><h3 class="calendar-agenda-title">${escapeHtml(calendarFullDate(calendarSelectedDay))}</h3><span class="calendar-agenda-count">${selected.length} ${selected.length===1?'Knoten':'Knoten'}</span></div>
        ${selected.length?`<div class="calendar-agenda-list">${selected.map(entry=>`<button type="button" class="calendar-agenda-item" data-calendar-node="${escapeHtml(entry.path)}" style="--calendar-accent:${entry.accent}" aria-label="${escapeHtml(entry.title+' bearbeiten')}">
          <span class="calendar-agenda-dot" aria-hidden="true"></span><span class="calendar-agenda-info"><span class="calendar-agenda-name">${escapeHtml(entry.title)}</span><span class="calendar-agenda-meta">${escapeHtml(dateRange(entry))}${entry.status?' · '+escapeHtml(entry.status):''}</span></span>
        </button>`).join('')}</div>`:'<p class="calendar-empty-message">An diesem Tag sind keine datierten Knoten vorhanden.</p>'}
      </section>
    </div>
  </div>`;
  $('#calendarPrev').onclick=()=>{calendarShiftMonth(-1);$('#calendarPrev')?.focus({preventScroll:true})};
  $('#calendarNext').onclick=()=>{calendarShiftMonth(1);$('#calendarNext')?.focus({preventScroll:true})};
  $('#calendarToday').onclick=()=>{
    const now=new Date();calendarMonth={year:now.getFullYear(),month:now.getMonth()+1};
    calendarSelectedDay=calendarTodayKey();renderCalendar();$('#calendarToday')?.focus({preventScroll:true});
  };
  document.querySelectorAll('[data-calendar-day],[data-calendar-more]').forEach(button=>{
    button.onclick=()=>{
      const key=button.dataset.calendarDay||button.dataset.calendarMore;
      const [chosenYear,chosenMonth]=key.split('-').map(Number);
      calendarMonth={year:chosenYear,month:chosenMonth};
      calendarSelectedDay=key;renderCalendar();
      document.querySelector(`[data-calendar-day="${key}"]`)?.focus({preventScroll:true});
      $('#calendarScroll .calendar-agenda')?.scrollIntoView({block:'nearest',behavior:'smooth'});
    };
  });
  document.querySelectorAll('[data-calendar-node]').forEach(button=>{
    button.onclick=()=>editNode(button.dataset.calendarNode);
  });
}

