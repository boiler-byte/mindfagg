'use strict';
/* mindfagg v43: literal, multiline find/replace and clipboard toolbar for Script editor.
 * Search and replacement always use the FULL source, never fold placeholders.
 * The preview layer is inert and contains only escaped text. No regex UI. */
const scriptFindState={docId:null,open:false,replaceOpen:false,caseSensitive:false,
  query:'',replacement:'',matches:[],active:-1};
const SCRIPT_FIND_HIGHLIGHT_LIMIT=1400;
let scriptVisualFrame=0,scriptUnobstructedHeight=0,scriptLastViewportWidth=0;

function scriptFindMatches(text,needle,caseSensitive=false){
  if(!needle||needle.length>text.length)return [];
  const body=caseSensitive?text:text.toLowerCase();
  const query=caseSensitive?needle:needle.toLowerCase();
  const hits=[];let from=0,found;
  // Literal search: no regex parsing, captures, backreferences or case patterns.
  while((found=body.indexOf(query,from))!==-1){
    hits.push({start:found,end:found+needle.length});
    from=found+Math.max(needle.length,1);
  }
  return hits;
}
function scriptFindWidgetHtml(){
  return `<div class="script-editor-tools" role="toolbar" aria-label="Script-Editor-Werkzeuge">
    <button type="button" class="tool" id="scriptClipboardToggle" title="Text aus Zwischenablage einfügen oder Dateiinhalt ersetzen" aria-haspopup="menu" aria-controls="scriptClipboardMenu" aria-expanded="false">Einfügen ▾</button>
    <button type="button" class="tool" id="scriptFindToggle" title="Suchen und Ersetzen (Strg/⌘+F)" aria-controls="scriptFindWidget" aria-expanded="false">⌕ Suchen &amp; Ersetzen</button>
    <button type="button" class="tool" id="scriptPrettyCode" title="Code lesbar formatieren" aria-label="Pretty Code">{ } Pretty Code</button>
  </div>
  <div class="script-clipboard-menu" id="scriptClipboardMenu" role="menu" aria-label="Zwischenablage einfügen" hidden>
    <button type="button" role="menuitem" id="scriptClipboardInsert">Einfügen <small>An Cursorposition</small></button>
    <button type="button" role="menuitem" id="scriptClipboardReplace">Ersetzen <small>Gesamten Dateiinhalt</small></button>
  </div>
  <section class="script-find-widget" id="scriptFindWidget" aria-label="Suchen und Ersetzen" hidden>
    <div class="script-find-row">
      <button type="button" class="script-find-icon script-find-expand" id="scriptFindExpand" aria-label="Ersetzen einblenden" aria-expanded="false" title="Ersetzen ein-/ausblenden">▸</button>
      <div class="script-find-input-wrap">
        <textarea id="scriptFindQuery" rows="1" aria-label="Suchen" placeholder="Suchen" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea>
        <button type="button" class="script-find-case" id="scriptFindCase" aria-pressed="false" title="Groß-/Kleinschreibung beachten" aria-label="Groß-/Kleinschreibung beachten">Aa</button>
      </div>
      <span class="script-find-count" id="scriptFindCount" role="status" aria-live="polite">0 Treffer</span>
      <button type="button" class="script-find-icon" id="scriptFindPrevious" title="Vorheriger Treffer" aria-label="Vorheriger Treffer">↑</button>
      <button type="button" class="script-find-icon" id="scriptFindNext" title="Nächster Treffer" aria-label="Nächster Treffer">↓</button>
      <button type="button" class="script-find-icon" id="scriptFindClose" title="Suche schließen (Esc)" aria-label="Suche schließen">×</button>
    </div>
    <div class="script-replace-row" id="scriptReplaceRow" hidden>
      <span class="script-replace-indent" aria-hidden="true"></span>
      <textarea id="scriptReplaceText" rows="1" aria-label="Ersetzen durch" placeholder="Ersetzen durch" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off"></textarea>
      <button type="button" class="script-find-action" id="scriptReplaceOne" title="Aktuellen Treffer ersetzen" aria-label="Aktuellen Treffer ersetzen">Ersetzen</button>
      <button type="button" class="script-find-action" id="scriptReplaceAll" title="Alle Treffer ersetzen" aria-label="Alle Treffer ersetzen">Alle ersetzen</button>
    </div>
    <div class="script-find-help">Mehrzeilig: Umschalt + Enter oder Text einfügen · Enter: nächster Treffer</div>
  </section>`;
}
function scriptFindGrow(textarea){
  if(!textarea)return;
  textarea.style.height='32px';
  textarea.style.height=Math.max(32,Math.min(78,textarea.scrollHeight))+'px';
}
function scriptFindPaintControls(){
  const widget=$('#scriptFindWidget');if(!widget)return;
  widget.hidden=!scriptFindState.open;
  $('#scriptFindToggle')?.setAttribute('aria-expanded',String(scriptFindState.open));
  $('#scriptReplaceRow').hidden=!scriptFindState.replaceOpen;
  const expand=$('#scriptFindExpand');
  expand.textContent=scriptFindState.replaceOpen?'▾':'▸';
  expand.setAttribute('aria-expanded',String(scriptFindState.replaceOpen));
  expand.setAttribute('aria-label',scriptFindState.replaceOpen?'Ersetzen ausblenden':'Ersetzen einblenden');
  const caseButton=$('#scriptFindCase');caseButton.setAttribute('aria-pressed',String(scriptFindState.caseSensitive));
  caseButton.classList.toggle('is-active',scriptFindState.caseSensitive);
  const number=scriptFindState.matches.length,index=scriptFindState.active;
  $('#scriptFindCount').textContent=scriptFindState.query?(number?(index+1)+' von '+number:'0 Treffer'):'0 Treffer';
  for(const id of ['scriptFindPrevious','scriptFindNext','scriptReplaceOne','scriptReplaceAll'])
    $('#'+id).disabled=!number;
}
function scriptFindOpen(replace=false){
  const source=$('#scriptSource');if(!source)return;
  const state=scriptFindState;
  if(state.docId!==editorDocId)return;
  state.open=true;
  if(replace)state.replaceOpen=true;
  const selection=source.value.slice(source.selectionStart,source.selectionEnd);
  if(!state.query&&selection&&selection.length<=400&&!selection.includes('Zeilen eingeklappt')){
    state.query=selection;
    $('#scriptFindQuery').value=selection;
  }
  scriptFindPaintControls();scriptFindGrow($('#scriptFindQuery'));
  scriptFindRefresh({jump:Boolean(state.query)});
  const query=$('#scriptFindQuery');query.focus({preventScroll:true});query.select();
  scriptSyncMobileViewport();
}
function scriptFindClose(){
  if(!scriptFindState.open)return;
  scriptFindState.open=false;
  scriptFindPaintControls();scriptFindRenderHighlights();
  const source=$('#scriptSource');source?.focus({preventScroll:true});
  scriptSyncMobileViewport();
}
function scriptFindVisibleMatch(source,match){
  const folded=codeFoldState(source);
  const start=folded?codeFoldMapToVisible(folded,match.start):match.start;
  const end=folded?codeFoldMapToVisible(folded,match.end):match.end;
  return end-start===match.end-match.start&&
    source.value.slice(start,end)===codeFoldFull(source).slice(match.start,match.end)
    ?{start,end}:null;
}
function scriptFindScrollTo(source,start){
  const text=source.value,starts=codeFoldLineStarts(text),line=codeFoldLineAt(starts,start);
  const style=getComputedStyle(source),height=parseFloat(style.lineHeight)||23;
  const padTop=parseFloat(style.paddingTop)||0,padLeft=parseFloat(style.paddingLeft)||0;
  const charColumn=text.slice(starts[line],start);
  const canvas=scriptFindScrollTo.canvas||(scriptFindScrollTo.canvas=document.createElement('canvas'));
  const context=canvas.getContext('2d');if(context)context.font=style.font;
  let x=padLeft+(context?.measureText(charColumn).width||charColumn.length*8);
  let top=padTop+(scriptLineLayout?.offsets[line]??line)*height;
  if(appEditorSettings.wordWrap){
    const width=Math.max(1,source.clientWidth-padLeft-(parseFloat(style.paddingRight)||0));
    const row=Math.floor((x-padLeft)/width);
    top+=row*height;x=padLeft+(x-padLeft)%width;
  }
  source.scrollTop=Math.max(0,top-source.clientHeight*.38);
  if(!appEditorSettings.wordWrap)source.scrollLeft=Math.max(0,x-source.clientWidth*.5);
  syncScriptCodeScroll();
}
function scriptFindGoToActive(){
  const source=$('#scriptSource'),hit=scriptFindState.matches[scriptFindState.active];
  if(!source||!hit)return;
  // A result may be behind a collapsed block: reveal only the touched regions.
  codeFoldRevealOffset(source,hit.start);
  codeFoldRevealOffset(source,Math.max(hit.start,hit.end-1));
  let visible=scriptFindVisibleMatch(source,hit);
  if(!visible){codeFoldExpandAll(source);visible=scriptFindVisibleMatch(source,hit)}
  if(!visible)return;
  source.setSelectionRange(visible.start,visible.end);
  scriptFindScrollTo(source,visible.start);
  scriptFindRenderHighlights();
}
function scriptFindRefresh({anchor=null,jump=false}={}){
  const source=$('#scriptSource');if(!source||scriptFindState.docId!==editorDocId)return;
  const state=scriptFindState,previous=state.matches[state.active]?.start;
  state.matches=scriptFindMatches(codeFoldFull(source),state.query,state.caseSensitive);
  if(!state.matches.length)state.active=-1;
  else if(anchor!==null) {
    const index=state.matches.findIndex(hit=>hit.start>=anchor);
    state.active=index===-1?0:index;
  }else{
    const same=state.matches.findIndex(hit=>hit.start===previous);
    state.active=same===-1?0:same;
  }
  scriptFindPaintControls();
  if(jump&&state.active>=0)scriptFindGoToActive();
  else scriptFindRenderHighlights();
}
function scriptFindStep(direction){
  const state=scriptFindState;if(!state.matches.length)return;
  state.active=(state.active+direction+state.matches.length)%state.matches.length;
  scriptFindPaintControls();scriptFindGoToActive();
}
function scriptFindRenderHighlights(){
  const layer=$('#scriptFindLayer'),source=$('#scriptSource');
  if(!layer||!source)return;
  if(!scriptFindState.open||!scriptFindState.query||!scriptFindState.matches.length){layer.textContent='';return}
  const visible=source.value,folded=codeFoldState(source);
  const all=scriptFindMatches(visible,scriptFindState.query,scriptFindState.caseSensitive);
  const activeFull=scriptFindState.matches[scriptFindState.active];
  const active=activeFull?scriptFindVisibleMatch(source,activeFull):null;
  // Restrict DOM size for very common queries, while always showing active hit.
  const matches=all.filter(hit=>!folded||!codeFoldTouchesPlaceholder(folded,hit.start,hit.end));
  const shown=matches.slice(0,SCRIPT_FIND_HIGHLIGHT_LIMIT);
  if(active&&!shown.some(hit=>hit.start===active.start&&hit.end===active.end))shown.push(active);
  shown.sort((a,b)=>a.start-b.start);
  const html=[];let offset=0;
  for(const hit of shown){
    if(hit.start<offset)continue;
    html.push(escapeHtml(visible.slice(offset,hit.start)));
    const isActive=active&&active.start===hit.start&&active.end===hit.end;
    html.push('<mark class="script-find-highlight'+(isActive?' is-current':'')+'">'+escapeHtml(visible.slice(hit.start,hit.end))+'</mark>');
    offset=hit.end;
  }
  html.push(escapeHtml(visible.slice(offset)));
  layer.innerHTML=html.join('')+'\n';
  layer.style.transform=`translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
}
function scriptFindApplyChange(next,caret){
  const source=$('#scriptSource');if(!source||next===codeFoldFull(source))return false;
  const state=codeFoldState(source);
  if(state){
    state.full=next;
    codeFoldRebuild(state);
    source.value=state.visible;
    codeFoldSessions.set(state.docId,new Set(state.collapsed));
    codeFoldApplyUiState(source);
    const position=codeFoldMapToVisible(state,Math.min(caret,next.length));
    source.setSelectionRange(position,position);
  }else{source.value=next;source.setSelectionRange(caret,caret)}
  // Reuse the normal edit / autosave / undo-redo / validation pipeline.
  source.dispatchEvent(new Event('input',{bubbles:true}));
  return true;
}
function scriptFindReplaceCurrent(){
  const source=$('#scriptSource'),state=scriptFindState,hit=state.matches[state.active];
  if(!source||!hit||!state.query)return;
  const full=codeFoldFull(source),replacement=state.replacement;
  if(scriptFindApplyChange(full.slice(0,hit.start)+replacement+full.slice(hit.end),hit.start+replacement.length)){
    scriptFindRefresh({anchor:hit.start+replacement.length,jump:true});
  }else scriptFindStep(1);
}
function scriptFindReplaceAll(){
  const source=$('#scriptSource'),state=scriptFindState;
  if(!source||!state.matches.length||!state.query)return;
  const full=codeFoldFull(source),replacement=state.replacement;
  const count=state.matches.length,parts=[];let start=0;
  for(const hit of state.matches){parts.push(full.slice(start,hit.start),replacement);start=hit.end}
  parts.push(full.slice(start));
  const next=parts.join('');
  scriptFindApplyChange(next,0);
  scriptFindRefresh({anchor:0,jump:false});
  toast(count===1?'1 Treffer ersetzt':count+' Treffer ersetzt');
}
function scriptFindMount(source){
  const state=scriptFindState;
  if(state.docId!==editorDocId){
    Object.assign(state,{docId:editorDocId,open:false,replaceOpen:false,caseSensitive:false,query:'',replacement:'',matches:[],active:-1});
  }
  const toggle=$('#scriptFindToggle'),query=$('#scriptFindQuery'),replacement=$('#scriptReplaceText');
  query.value=state.query;replacement.value=state.replacement;
  toggle.onclick=()=>state.open?scriptFindClose():scriptFindOpen(false);
  $('#scriptFindClose').onclick=scriptFindClose;
  $('#scriptFindExpand').onclick=()=>{
    state.replaceOpen=!state.replaceOpen;scriptFindPaintControls();
    if(state.replaceOpen){scriptFindGrow(replacement);replacement.focus({preventScroll:true})}
  };
  $('#scriptFindCase').onclick=()=>{state.caseSensitive=!state.caseSensitive;scriptFindRefresh({jump:true});query.focus({preventScroll:true})};
  query.oninput=()=>{state.query=query.value;scriptFindGrow(query);scriptFindRefresh({jump:true})};
  replacement.oninput=()=>{state.replacement=replacement.value;scriptFindGrow(replacement)};
  $('#scriptFindPrevious').onclick=()=>scriptFindStep(-1);
  $('#scriptFindNext').onclick=()=>scriptFindStep(1);
  $('#scriptReplaceOne').onclick=scriptFindReplaceCurrent;
  $('#scriptReplaceAll').onclick=scriptFindReplaceAll;
  for(const entry of [query,replacement])entry.onkeydown=event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();scriptFindClose()}
    else if(event.key==='Enter'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey){
      event.preventDefault();if(entry===replacement)scriptFindReplaceCurrent();else scriptFindStep(1);
    }
    // Shift+Enter enters an actual newline in either query or replacement.
  };
  scriptFindGrow(query);scriptFindGrow(replacement);
  scriptFindPaintControls();scriptFindRefresh({jump:false});
  scriptSyncMobileViewport();
}
function scriptFindSourceChanged(){
  if(scriptFindState.open)scriptFindRefresh({jump:false});
  else scriptFindRenderHighlights();
}
function scriptFindSyncScroll(){
  const source=$('#scriptSource'),layer=$('#scriptFindLayer');
  if(source&&layer)layer.style.transform=`translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
}
function scriptMobileViewportInactive(){
  const app=$('.app');if(!app)return;
  app.classList.remove('mobile-script-active','mobile-script-keyboard-open');
  document.body.classList.remove('mobile-script-active');
  app.style.removeProperty('--mf-script-visual-height');app.style.removeProperty('--mf-script-visual-top');
  scriptUnobstructedHeight=0;scriptLastViewportWidth=0;
}
function scriptSyncMobileViewport(){
  const app=$('.app'),source=$('#scriptSource');if(!app)return;
  const active=!!source&&window.matchMedia('(max-width:850px)').matches;
  app.classList.toggle('mobile-script-active',active);
  document.body.classList.toggle('mobile-script-active',active);
  if(!active){
    app.classList.remove('mobile-script-keyboard-open');
    app.style.removeProperty('--mf-script-visual-height');app.style.removeProperty('--mf-script-visual-top');
    scriptUnobstructedHeight=0;scriptLastViewportWidth=0;return;
  }
  const visual=window.visualViewport,height=Math.max(1,visual?.height||window.innerHeight);
  const width=Math.round(visual?.width||window.innerWidth);
  if(width!==scriptLastViewportWidth){scriptLastViewportWidth=width;scriptUnobstructedHeight=height}
  const activeElement=document.activeElement;
  const hasEditorFocus=activeElement===source||Boolean(activeElement?.closest?.('#scriptFindWidget'));
  if(!hasEditorFocus)scriptUnobstructedHeight=Math.max(scriptUnobstructedHeight,height);
  const gap=Math.max(scriptUnobstructedHeight-height,window.innerHeight-height);
  app.classList.toggle('mobile-script-keyboard-open',gap>110);
  app.style.setProperty('--mf-script-visual-height',height.toFixed(2)+'px');
  app.style.setProperty('--mf-script-visual-top',(visual?.offsetTop||0).toFixed(2)+'px');
}
function scriptScheduleMobileViewport(){
  if(scriptVisualFrame)return;
  scriptVisualFrame=requestAnimationFrame(()=>{scriptVisualFrame=0;scriptSyncMobileViewport()});
}
window.visualViewport?.addEventListener('resize',scriptScheduleMobileViewport);
window.visualViewport?.addEventListener('scroll',scriptScheduleMobileViewport);
window.addEventListener('resize',scriptScheduleMobileViewport);
window.addEventListener('orientationchange',()=>{scriptLastViewportWidth=0;scriptScheduleMobileViewport()});
document.addEventListener('focusin',event=>{
  if(event.target?.id==='scriptSource'||event.target?.closest?.('#scriptFindWidget'))scriptScheduleMobileViewport();
});
document.addEventListener('focusout',event=>{
  if(event.target?.id==='scriptSource'||event.target?.closest?.('#scriptFindWidget'))scriptScheduleMobileViewport();
});
document.addEventListener('keydown',event=>{
  if(!$('#scriptSource')||event.altKey&&!event.metaKey)return;
  const modifier=event.ctrlKey||event.metaKey;
  if(modifier&&event.key.toLowerCase()==='f'&&!event.shiftKey){
    event.preventDefault();scriptFindOpen(event.altKey);return;
  }
  if(modifier&&event.key.toLowerCase()==='h'&&!event.altKey){
    event.preventDefault();scriptFindOpen(true);return;
  }
  if(event.key==='Escape'&&scriptFindState.open&&event.target?.closest?.('#scriptFindWidget')){
    event.preventDefault();scriptFindClose();
  }
});
