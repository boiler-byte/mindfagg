'use strict';
// mindfagg v30: ui/bindings.js (klassisches Script; gemeinsame globale Laufzeit).
'use strict';
$('#appSettingsButton').onclick=async()=>{try{await flushMapInlineEdit();await flushSource();openAppSettings()}catch(error){console.error(error);toast('Änderungen konnten nicht gespeichert werden')}};$('#addProject').onclick=async()=>{await flushMapInlineEdit();await flushSource();setMobileMenu(false);createProject()};$('#addDocument').onclick=()=>toggleWorkspaceActionMenu('add',$('#addDocument'));$('#workspaceMore').onclick=()=>toggleWorkspaceActionMenu('more',$('#workspaceMore'));$('#collapseFolders').onclick=workspaceCollapseFolders;$('#githubSync').onclick=async()=>{try{await flushMapInlineEdit();await flushSource();await githubSyncClicked()}catch(error){console.error(error);toast('GitHub-Synchronisation fehlgeschlagen: '+error.message)}};$('#renameDoc').onclick=async()=>{await flushMapInlineEdit();await flushSource();renameDocument()};$('#undoAction').onclick=()=>changeHistory('undo');$('#redoAction').onclick=()=>changeHistory('redo');wireWorkspaceIO();document.querySelectorAll('[data-view]').forEach(e=>e.onclick=async()=>{await flushMapInlineEdit();await flushSource();appSettingsOpen=false;setView(e.dataset.view);render()});$('#menuToggle').onclick=()=>setMobileMenu(!$('.app').classList.contains('menu-open'));$('#sidebarScrim').onclick=()=>setMobileMenu(false);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('.app').classList.contains('menu-open'))setMobileMenu(false)});window.addEventListener('resize',()=>setMobileMenu($('.app').classList.contains('menu-open')));
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||e.altKey||$('#modalBack')&&!$('#modalBack').classList.contains('hidden'))return;
  const inInput=!!e.target.closest('textarea,input,select,[contenteditable="true"]');
  const key=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&!inInput){
    if(key==='z'){e.preventDefault();changeHistory(e.shiftKey?'redo':'undo');return}
    if(key==='y'){e.preventDefault();changeHistory('redo');return}
  }
  if(view==='mindmap'&&activeMap&&!inInput&&!e.ctrlKey&&!e.metaKey){
    if(['+','=','add'].includes(key)||e.code==='NumpadAdd'||key==='-'||e.code==='NumpadSubtract'){
      e.preventDefault();
      setAllMapChildrenCollapsed(activeMap,!(['+','=','add'].includes(key)||e.code==='NumpadAdd'));
    }
  }
});
setMobileMenu(false);init().catch(e=>{console.error(e);toast('IndexedDB konnte nicht geöffnet werden')});
