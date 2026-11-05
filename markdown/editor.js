'use strict';
// mindfagg v30: markdown/editor.js (klassisches Script; gemeinsame globale Laufzeit).
let editorVisualFrame=0,editorUnobstructedHeight=0,editorLastViewportWidth=0;
function syncMobileMarkdownViewportInactive(){
  const app=$('.app');
  app.classList.remove('mobile-markdown-active','mobile-keyboard-open');
  document.body.classList.remove('mobile-markdown-active');
  app.style.removeProperty('--mf-visual-height');
  app.style.removeProperty('--mf-visual-top');
  editorUnobstructedHeight=0;editorLastViewportWidth=0;
}
function syncMobileMarkdownViewport(){
  const app=$('.app'),source=$('#source');
  const active=view==='markdown'&&!!source&&window.matchMedia('(max-width:850px)').matches;
  app.classList.toggle('mobile-markdown-active',active);
  document.body.classList.toggle('mobile-markdown-active',active);
  if(!active){
    app.classList.remove('mobile-keyboard-open');
    app.style.removeProperty('--mf-visual-height');
    app.style.removeProperty('--mf-visual-top');
    editorUnobstructedHeight=0;editorLastViewportWidth=0;
    positionCompletionPopup();
    return;
  }
  const visual=window.visualViewport;
  const height=Math.max(1,visual?.height||window.innerHeight);
  const top=visual?.offsetTop||0;
  const width=Math.round(visual?.width||window.innerWidth);
  if(width!==editorLastViewportWidth){editorLastViewportWidth=width;editorUnobstructedHeight=height}
  if(document.activeElement!==source)editorUnobstructedHeight=Math.max(editorUnobstructedHeight,height);
  const keyboardGap=Math.max(editorUnobstructedHeight-height,window.innerHeight-height);
  app.classList.toggle('mobile-keyboard-open',keyboardGap>110);
  app.style.setProperty('--mf-visual-height',height.toFixed(2)+'px');
  app.style.setProperty('--mf-visual-top',top.toFixed(2)+'px');
  positionCompletionPopup();
  syncCodeScroll();
}
function scheduleMobileMarkdownViewport(){
  if(editorVisualFrame)return;
  editorVisualFrame=requestAnimationFrame(()=>{editorVisualFrame=0;syncMobileMarkdownViewport()});
}
// Never reactivate the phone's keyboard just because a formatting action finished.
// Desktop retains its existing focus-restore behavior.
function restoreMarkdownEditorFocus(){
  const source=$('#source');
  if(source&&!window.matchMedia('(max-width:850px)').matches&&document.activeElement!==source){
    source.focus({preventScroll:true});
  }
}
function renderEditor(){
  const d=documentNow();editorDocId=d.id;
  completionState=null;editorComposing=false;
  $('#surface').innerHTML=`<div class="editor">
    <div class="editor-tools" aria-label="Markdown-Schnelleingabe"><select class="tool tool-heading" id="headingLevel" aria-label="Überschriftenebene auswählen" title="Überschriftenebene auf alle markierten Zeilen anwenden"><option value="" selected disabled>H ▾</option>${[2,3,4,5,6].map(i=>`<option value="${i}">H${i}</option>`).join('')}</select><button type="button" class="tool" data-tool="outdent" title="Listenpunkt mit Unterpunkten ausrücken (Shift+Tab)" aria-label="Ausrücken">⇤</button><button type="button" class="tool" data-tool="indent" title="Listenpunkt mit Unterpunkten einrücken (Tab)" aria-label="Einrücken">⇥</button><button type="button" class="tool" data-tool="list" title="Listenmarker für alle markierten Zeilen ein-/ausblenden" aria-label="Listenmarker umschalten">-</button><button type="button" class="tool" data-tool="checkbox" title="Checkbox für alle markierten Zeilen ein-/ausblenden" aria-label="Checkbox umschalten">☐</button><button type="button" class="tool" data-tool="status" title="Status für alle markierten Knoten wählen">Status ▾</button><button type="button" class="tool" data-tool="link" title="Wikilink einfügen">Link</button></div>
    <div class="codeframe" id="codeFrame">
      <div class="codegutter"><pre id="lineNumbers" aria-hidden="true"></pre><div class="code-fold-gutter" id="markdownFoldGutter" aria-label="Markdown-Codefaltung"></div></div>
      <div class="codepane"><pre class="syntaxlayer" id="syntax" aria-hidden="true"></pre><textarea id="source" aria-label="Mindmap-Markdown bearbeiten" aria-describedby="editorHelp" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" wrap="off"></textarea><div class="code-interactions" id="interactionLayer"></div><div id="completionPopup" class="completion-popup hidden" role="listbox" aria-label="Markdown-Vervollständigung"></div></div>
      <div class="minimap" id="minimap" role="scrollbar" aria-label="Code-Minimap, scrollbar" aria-controls="source" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><canvas id="miniCanvas" aria-hidden="true"></canvas><div class="mini-viewport" id="miniViewport"></div></div>
    </div>
    <div class="editfoot"><button type="button" id="rootState" class="root-state" title="H1-Validierung"></button><small class="codehelp" id="editorHelp">Autocomplete: / · [[ · [status: · Enter setzt Listen fort · Tab/Shift+Tab rückt ein/aus</small></div>
  </div>`;
  const source=$('#source');source.value=d.content;source.wrap=appEditorSettings.wordWrap?'soft':'off';
  codeFoldInitialize(source,d,'markdown',()=>{refreshCodeVisuals();hideCompletions()});
  syncMobileMarkdownViewport();
  refreshCodeVisuals();wireMinimap();wireEditorTools();
  $('#rootState').onclick=focusRootProblem;
  source.onscroll=syncCodeScroll;
  source.oninput=()=>{
    const text=codeFoldUpdateAfterInput(source);
    const doc=docs.find(item=>item.id===editorDocId);
    if(doc){
      if(doc.content!==text){const h=docHistoryFor(doc.id);h.redo.length=0;deletionHistoryFor(doc.projectId).redo.length=0}
      doc.content=text;
      failedDocWrites.delete(doc.id);
    }
    updateHistoryButtons();
    updateSaveStatus();
    refreshCodeVisuals();
    if(!editorComposing)updateCompletions();
    clearTimeout(saveTimer);
    const id=editorDocId;
    saveTimer=setTimeout(()=>saveSource(id,text).catch(error=>{console.error(error);toast('Speichern fehlgeschlagen')}),650);
  };
  source.oncompositionstart=()=>{editorComposing=true;hideCompletions()};
  source.oncompositionend=()=>{editorComposing=false;updateCompletions()};
  source.onkeydown=e=>{
    if(codeFoldHasCollapsed(source)&&(e.key==='Enter'||e.key==='Tab'))codeFoldExpandAll(source);
    if(completionState?.items?.length&&!editorComposing){
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();completionIndex=(completionIndex+(e.key==='ArrowDown'?1:-1)+completionState.items.length)%completionState.items.length;
        renderCompletionPopup();$('#completionPopup .completion-item.active')?.scrollIntoView({block:'nearest'});return;
      }
      if(e.key==='Enter'||e.key==='Tab'){
        e.preventDefault();if(completionState.items[completionIndex]?.action==='apply-status'){
          const selection=completionState.targetSelection,s=completionState.items[completionIndex]?.value;hideCompletions();setEditorLineStatus(s,selection);
        }else acceptCompletion(completionIndex);
        return;
      }
      if(e.key==='Escape'){e.preventDefault();hideCompletions();return}
    }
    if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
      if(smartListEnter()){e.preventDefault();return}
    }
    if(e.key==='Tab'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
      e.preventDefault();smartListIndent(e.shiftKey);return;
    }
  };
  // Toolbar actions and Markdown inline controls operate on canonical offsets.
  for(const action of ['pointerdown','click','change'])$('#surface .editor-tools').addEventListener(action,()=>codeFoldExpandAll(source),true);
  source.onkeyup=e=>{if(['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key))updateCompletions()};
  source.onclick=()=>updateCompletions();
  source.onblur=e=>{if(!e.relatedTarget?.closest?.('.completion-popup,.editor-tools'))hideCompletions()};
  if(typeof ResizeObserver!=='undefined'){
    editorResizeObserver=new ResizeObserver(()=>{if(appEditorSettings.wordWrap)refreshCodeVisuals();else syncCodeScroll()});
    editorResizeObserver.observe(source);editorResizeObserver.observe($('#minimap'));
  }
  requestAnimationFrame(()=>{if(document.querySelector('#source')===source)syncCodeScroll()});
}
window.visualViewport?.addEventListener('resize',scheduleMobileMarkdownViewport);
window.visualViewport?.addEventListener('scroll',scheduleMobileMarkdownViewport);
window.addEventListener('resize',scheduleMobileMarkdownViewport);
window.addEventListener('orientationchange',()=>{editorLastViewportWidth=0;scheduleMobileMarkdownViewport()});
document.addEventListener('focusin',e=>{if(e.target?.id==='source')scheduleMobileMarkdownViewport()});
document.addEventListener('focusout',e=>{if(e.target?.id==='source')scheduleMobileMarkdownViewport()});
async function saveSource(id=editorDocId,text){
  const d=docs.find(x=>x.id===id);if(!d)return;
  const value=text===undefined?($('#source')?.value??d.content):text;
  // If an older scheduled save fires late, preserve the newest in-memory content.
  if(d.content!==value)return;
  // Switching views must not start a second write when everything is already saved.
  const persisted=persistedDocSnapshots.get(id);
  if(persisted&&equalDocSnapshot(docSnapshot(d),persisted)&&!(pendingDocWrites.get(id)||0)){
    updateSaveStatus();return;
  }
  await put('docs',{...d,content:value});
}
async function flushSource(){
  clearTimeout(saveTimer);
  const d=docs.find(x=>x.id===editorDocId),source=d&&fileKind(d)==='script'?$('#scriptSource'):$('#source');
  if(!source||!editorDocId||!d||d.id!==docId||!docIsText(d))return;
  if(fileKind(d)==='markdown'&&view!=='markdown')return;
  const value=codeFoldFull(source);d.content=value;await saveSource(editorDocId,value);
}


