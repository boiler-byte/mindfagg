'use strict';
// mindfagg v30: core/state.js (klassisches Script; gemeinsame globale Laufzeit).

'use strict';
const $=s=>document.querySelector(s), escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS=['story','todo','doing','review','done'];
const DEFAULT_STATUS_SETTINGS={
  story:{label:'Story',color:'#a99cff'},
  todo:{label:'To Do',color:'#8ebdff'},
  doing:{label:'In Progress',color:'#eabc7c'},
  review:{label:'Review',color:'#e2a4d6'},
  done:{label:'Done',color:'#70d8b5'}
};
function statusSetting(key,p=project()){
  const fallback=DEFAULT_STATUS_SETTINGS[key]||DEFAULT_STATUS_SETTINGS.story;
  const item=p?.statusSettings?.[key];
  const label=typeof item?.label==='string'?item.label.replace(/\s+/g,' ').trim().slice(0,36):'';
  const color=typeof item?.color==='string'&&/^#[0-9a-f]{6}$/i.test(item.color)?item.color.toLowerCase():fallback.color;
  return {label:label||fallback.label,color};
}
function statusLabel(key){return statusSetting(key).label}
function statusColor(key){return statusSetting(key).color}
function statusSettingsFor(p){return Object.fromEntries(STATUS.map(key=>[key,statusSetting(key,p)]))}
const DEFAULT_PROJECT_ACCENT='#9b8cff';
function projectAccentColor(p=project()){
  return typeof p?.accentColor==='string'&&/^#[0-9a-f]{6}$/i.test(p.accentColor)?p.accentColor.toLowerCase():DEFAULT_PROJECT_ACCENT;
}
function applyProjectAccent(p){
  document.documentElement.style.setProperty('--accent',projectAccentColor(p));
  document.documentElement.style.setProperty('--accent-foreground',`color-mix(in srgb, ${projectAccentColor(p)} 28%, white)`);
  const hex=projectAccentColor(p).slice(1),channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255);
  const rgb=channels.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  const brightness=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  document.documentElement.style.setProperty('--accent-contrast',brightness>.179?'#101521':'#ffffff');
}


const SAMPLE=`# [ ] Mein Projekt\nEine zentrale Mindmap für Ideen, Aufgaben und Fortschritt.\n\n## [status:done] Planung\nDie Anforderungen und das Konzept werden vorbereitet.\n\n- [x] Ziele definieren\n- [x] Anforderungen sammeln\n\n## [status:doing] Entwicklung\nDie App wird Schritt für Schritt umgesetzt.\n\n- [x] Markdown-Parser\n- [ ] [status:doing] Mindmap-Ansicht\n- [ ] [status:todo] Kanban-Ansicht\n- [ ] [status:review] Dokumentation\n\n## Ideen\nHier ist Platz für neue Gedanken.\n\n- [ ] Später umsetzen\n- [[Planung]]\n`;
let db,projects=[],docs=[],projectId=null,docId=null,view='markdown',scopePath='0',currentModel=null,saveTimer;
const VIEWS=['markdown','mindmap','kanban','calendar','html'];
// Markdown is the fallback for new users. Later visits restore the last selected tab.
function setView(next){
  if(!VIEWS.includes(next))return;
  view=next;
  try{localStorage.setItem('mfLastView',next)}catch(error){console.warn('Letzte Ansicht konnte nicht gespeichert werden:',error)}
}
function setMobileMenu(open){const mobile=window.matchMedia('(max-width:850px)').matches;const active=mobile&&Boolean(open);$('.app').classList.toggle('menu-open',active);$('#mainSidebar').inert=mobile&&!active;$('#menuToggle').setAttribute('aria-expanded',String(active));$('#menuToggle').setAttribute('aria-label',active?'Hauptmenü schließen':'Hauptmenü öffnen')}

