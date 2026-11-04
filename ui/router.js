'use strict';
// mindfagg v30: ui/router.js (klassisches Script; gemeinsame globale Laufzeit).
function toast(s){let e=$('#toast');e.textContent=s;e.classList.remove('hidden');clearTimeout(toast._timer);toast._timer=setTimeout(()=>e.classList.add('hidden'),2600)}

function render(){
  let p=project(),d=documentNow();
  if(d){
    ensureSvgScript(d);
    ensureMarkdownRoot(d);
  }
  persistDocId();
  applyProjectAccent(p);
  githubUpdateIndicator(p);
  githubScheduleLocalStatus(p?.id);
  $('.app').classList.toggle('settings-open',appSettingsOpen);
  $('#projectLabel').innerHTML=`<select id="projectSelect" aria-label="Projekt auswählen, nach letzter Änderung sortiert">${projectOptionsHtml()}</select><button type="button" class="project-settings-button" id="projectSettings" aria-label="Projekteinstellungen" title="Status-Bezeichnungen und -Farben bearbeiten">⚙</button>`;
  $('#projectSelect').disabled=!projects.length;
  $('#projectSettings').disabled=!p;
  $('#projectSelect').onchange=async e=>{await flushMapInlineEdit();await flushSource();selectProject(e.target.value,{keepSidebarOpen:true})};
  $('#projectSettings').onclick=async()=>{await flushMapInlineEdit();await flushSource();setMobileMenu(false);openProjectSettings()};
  $('#docList').innerHTML=workspaceTreeHtml(p);
  wireWorkspaceTree();
  $('#breadcrumb').textContent=`${p?.name||'Workspace'} / ${d?workspacePath(d):'Keine Datei'}`;
  $('#renameDoc').disabled=!d||appSettingsOpen;
  updateHistoryButtons();
  updateSaveStatus();
  document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
  showFileTabs(appSettingsOpen?null:d);
  releaseWorkspacePreview();
  if(editorResizeObserver){editorResizeObserver.disconnect();editorResizeObserver=null}
  if(view!=='markdown'||!d||fileKind(d)!=='markdown')syncMobileMarkdownViewportInactive();
  if(appSettingsOpen){activeMap=null;currentModel=null;syncMobileMarkdownViewportInactive();$('#breadcrumb').textContent='mindfagg / Einstellungen';renderAppSettingsPage();return}
  if(!d){currentModel=null;activeMap=null;$('#surface').innerHTML='<div class="empty">'+(p?'Datei oder Ordner erstellen oder eine ZIP-Datei importieren.':'Lege ein Projekt an oder stelle das gelöschte Projekt mit Rückgängig wieder her.')+'</div>';return}
  if(fileKind(d)!=='markdown'){
    currentModel=null;activeMap=null;
    if(fileKind(d)==='script'){
      if(activeFilePanel==='preview'&&isHtmlScriptFile(d))renderHtmlPreview();
      else if(activeFilePanel==='preview'&&isSvgScriptFile(d))renderSvgPreview();
      else if(activeFilePanel==='functions'&&isJavascriptFile(d))renderFunctionsView();
      else renderScriptView();
    }
    else if(fileKind(d)==='image')renderImageView();
    else if(fileKind(d)==='audio')renderAudioView();
    else renderBinaryView();
    return;
  }
  const inspection=scanMarkdown(d.content);
  currentModel=parseMarkdown(d.content,inspection);
  if(scopePath!==KANBAN_ALL_SCOPE&&!flattened(currentModel).some(n=>n.path===scopePath))scopePath=currentRoot().path;
  if(view!=='mindmap')activeMap=null;
  if(view==='markdown'){renderEditor();return}
  // The calendar does not require a valid H1, only valid node date markers.
  if(view==='calendar'){renderCalendar();return}
  if(!inspection.valid){
    $('#surface').innerHTML=`<div class="source-invalid"><div class="warningicon">!</div><h2>Dokumentstruktur prüfen</h2><p>${escapeHtml(validationMessage(inspection))}. Eine Mindmap benötigt genau eine Überschrift der Ebene 1 (<code># Titel</code>). Der Markdown-Text ist weiterhin gespeichert.</p><button class="btn primary" id="fixRoot">Im Markdown-Editor korrigieren</button></div>`;
    $('#fixRoot').onclick=()=>{setView('markdown');render();focusRootProblem()};return;
  }
  if(view==='mindmap')renderMindmap();
  if(view==='kanban')renderKanban();
}


