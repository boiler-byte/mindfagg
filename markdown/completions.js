'use strict';
// mindfagg v30: markdown/completions.js (klassisches Script; gemeinsame globale Laufzeit).
function wikiLinkAtCaret(line,col){
  const open=line.lastIndexOf('[[',col);
  if(open<0)return null;
  const close=line.indexOf(']]',open+2),priorClose=line.lastIndexOf(']]',col-1);
  if(priorClose>open&&!(close===priorClose&&col===close+2)||close>=0&&col>close+2)return null;
  const tokenEnd=close>=0?close+2:col;
  const full=line.slice(open+2,close>=0?close:col);
  const before=line.slice(open+2,Math.min(col,close>=0?close:col));
  if(before.includes(']]')||before.includes('[['))return null;
  const target=full.split('|')[0],hash=target.indexOf('#');
  return {start:open,end:tokenEnd,query:before,full,
    doc:hash>=0?target.slice(0,hash):target,
    heading:hash>=0?target.slice(hash+1):null};
}
function linkCompletionTarget(item){
  if(!item?.targetDoc)return null;
  return {doc:item.targetDoc,heading:item.targetHeading||null};
}
function completionLinkTarget(state){
  if(state?.existingLink?.doc&&docs.some(d=>d.projectId===projectId&&d.name.toLowerCase()===state.existingLink.doc.toLowerCase()))
    return state.existingLink;
  return linkCompletionTarget(state?.items[state?.index??completionIndex])||linkCompletionTarget(state?.items[0]);
}
async function openCompletionDocument(){
  const target=completionLinkTarget(completionState);
  if(!target)return;
  // Preserve the most recent edits before opening another document.
  await flushSource();
  hideCompletions();
  navigateLink(target.doc,target.heading);
}
function completionForCaret(){
  const source=$('#source');if(!source||editorComposing||codeFoldHasCollapsed(source)||source.selectionStart!==source.selectionEnd)return null;
  const position=linePosition(source.selectionStart),item=editorScan.items[position.line];
  if(!item||item.kind==='code'||item.kind==='fence'||item.kind==='comment')return null;
  const lineStart=editorScan.offsets[position.line],before=source.value.slice(lineStart,source.selectionStart);
  let m,items=[],label='',start=source.selectionStart;
  const link=wikiLinkAtCaret(editorScan.lines[position.line],position.col);
  let linkMode=false,existingLink=null;
  if(link){
    linkMode=true;
    start=lineStart+link.start;
    const query=link.query,sep=query.indexOf('#');
    if(link.full&&link.doc)existingLink={doc:link.doc,heading:link.heading};
    if(sep>=0){
      const targetName=query.slice(0,sep),term=query.slice(sep+1).toLowerCase();
      const doc=docs.find(d=>d.projectId===projectId&&d.name.toLowerCase()===targetName.toLowerCase());
      if(doc){const headings=scanMarkdown(doc.content).items.filter(x=>x.kind==='heading');
        items=headings.filter(h=>plain(nodeText(h.title).title).toLowerCase().includes(term)).slice(0,12).map(h=>{
          const heading=plain(nodeText(h.title).title);
          return {...namedCompletion(heading,'Überschrift · '+doc.name,'[['+doc.name+'#'+heading+']]'),targetDoc:doc.name,targetHeading:heading};
        });
      }
      label='Überschriften';
    }else{
      items=docs.filter(d=>d.projectId===projectId&&d.name.toLowerCase().includes(query.toLowerCase())).slice(0,12).map(d=>({...namedCompletion(d.name,'Dokument','[['+d.name+']]'),targetDoc:d.name}));
      label='Dokument verlinken';
    }
    return items.length||existingLink?{start,end:lineStart+link.end,items,label,linkMode,existingLink}:null;
  }else if((m=before.match(/\[status:([a-z-]*)$/i))){
    start=source.selectionStart-m[0].length;const q=m[1].toLowerCase();
    items=STATUS.filter(s=>s.startsWith(q)).map(s=>({...namedCompletion(statusLabel(s),'[status:'+s+']','[status:'+s+'] ','apply-node-status'),value:s}));label='Knotenstatus';
  }else if((m=before.match(/(^|[^\[])\[([a-z xX]*)$/i))&&['heading','list'].includes(item.kind)){
    start=source.selectionStart-m[2].length-1;const q=m[2].toLowerCase();
    items=[{...namedCompletion('[ ]','Offene Aufgabe','[ ] ','apply-node-checkbox'),value:false},{...namedCompletion('[x]','Erledigte Aufgabe','[x] ','apply-node-checkbox'),value:true},...STATUS.map(s=>({...namedCompletion('[status:'+s+']',statusLabel(s),'[status:'+s+'] ','apply-node-status'),value:s}))].filter(o=>o.insert.toLowerCase().startsWith('['+q));label='Knoten-Eigenschaften';
  }else if((m=before.match(/^\s*\/([a-z0-9-]*)$/i))){
    const q=m[1].toLowerCase();start=source.selectionStart-q.length-1;
    items=[namedCompletion('/h1','Überschrift 1','# '),namedCompletion('/h2','Überschrift 2','## '),namedCompletion('/h3','Überschrift 3','### '),namedCompletion('/list','Listenpunkt','- '),namedCompletion('/task','Offene Aufgabe','- [ ] '),namedCompletion('/done','Erledigte Aufgabe','- [x] '),namedCompletion('/link','Dokument verlinken','[[', 'link'),namedCompletion('/status','Knotenstatus wählen','', 'status')].filter(o=>o.label.slice(1).startsWith(q));label='Markdown-Befehle';
  }else if((m=before.match(/^\s*(#{1,6})$/))){
    start=source.selectionStart-m[1].length;
    items=[1,2,3,4,5,6].filter(i=>i>=m[1].length).map(i=>namedCompletion('H'+i,'Überschrift '+i,'#'.repeat(i)+' '));label='Überschrift';
  }else if((m=before.match(/^\s*[-+*]$/))){
    start=source.selectionStart-1;items=[namedCompletion('Listenpunkt','- ', '- '),namedCompletion('Offene Aufgabe','- [ ] ','- [ ] '),namedCompletion('Erledigt','- [x] ','- [x] ')];label='Liste';
  }
  return items.length?{start,end:source.selectionStart,items,label}:null;
}
function positionCompletionPopup(){
  const pop=$('#completionPopup'),source=$('#source');if(!pop||!source||!completionState||pop.classList.contains('hidden'))return;
  const m=editorMetrics(),p=linePosition(source.selectionStart),row=(editorScan.lines[p.line]||'').slice(0,p.col),pane=source.parentElement;
  const x=m.padLeft+visualColumns(row)*m.charWidth-source.scrollLeft,y=m.padTop+p.line*m.lineHeight-source.scrollTop;
  const width=Math.min(340,Math.max(168,pane.clientWidth-10));pop.style.width=width+'px';
  pop.style.left=Math.max(5,Math.min(x,pane.clientWidth-width-5))+'px';
  // VisualViewport keeps suggestions above the on-screen keyboard on phones.
  const visual=window.visualViewport;
  const visibleBottom=visual?visual.offsetTop+visual.height:window.innerHeight;
  const usableHeight=Math.max(70,Math.min(pane.clientHeight,visibleBottom-pane.getBoundingClientRect().top)-6);
  const allowed=Math.max(65,Math.min(253,usableHeight-10));
  pop.style.maxHeight=allowed+'px';
  const height=Math.min(pop.scrollHeight||230,allowed);
  const below=y+m.lineHeight+3;
  const proposed=below+height>usableHeight&&y-height-4>=5?y-height-4:below;
  pop.style.top=Math.max(5,Math.min(proposed,usableHeight-height-5))+'px';
}
function renderCompletionPopup(){
  const pop=$('#completionPopup'),state=completionState;
  if(!pop||!state||(!state.items.length&&!state.linkMode)){hideCompletions();return}
  pop.classList.remove('hidden');
  const destination=state.linkMode?completionLinkTarget(state):null;
  const openButton=destination?`<button type="button" class="completion-open" id="completionOpen" aria-label="${escapeHtml(destination.doc+(destination.heading?' – '+destination.heading:''))} öffnen"><span>↗ ${escapeHtml(destination.doc+(destination.heading?' # '+destination.heading:''))} öffnen</span></button>`:'';
  pop.innerHTML=`${openButton}<div class="completion-heading">${escapeHtml(state.label)}</div>${state.items.map((o,i)=>`<button type="button" class="completion-item ${i===completionIndex?'active':''}" data-suggestion="${i}" role="option" aria-selected="${i===completionIndex}"><strong>${escapeHtml(o.label)}</strong><small>${escapeHtml(o.detail)}</small></button>`).join('')}<div class="completion-tip">↵ / Tab übernehmen · ↑↓ auswählen · Tippen zum Einfügen</div>`;
  pop.querySelectorAll('[data-suggestion]').forEach(el=>{
    el.onpointerdown=e=>{if(window.matchMedia('(max-width:850px)').matches&&document.activeElement===$('#source')&&e.cancelable)e.preventDefault()};
    el.onmousedown=e=>e.preventDefault();
    el.onclick=()=>acceptCompletion(Number(el.dataset.suggestion));
  });
  const open=pop.querySelector('#completionOpen');if(open){open.onmousedown=e=>e.preventDefault();open.onclick=()=>openCompletionDocument()}
  positionCompletionPopup();
}
function updateCompletions(){
  const next=completionForCaret();completionState=next;completionIndex=0;
  if(next)renderCompletionPopup();else hideCompletions();
}
function acceptCompletion(index){
  const state=completionState,o=state?.items[index];if(!state||!o)return;
  if(o.action==='apply-status'){hideCompletions();setEditorLineStatus(o.value,state.targetSelection);return}
  if(o.action==='status'){
    editorReplace(state.start,state.end,'',true);hideCompletions();openToolbarStatus();return;
  }
  if(o.action==='apply-node-status'||o.action==='apply-node-checkbox'){
    const line=linePosition(state.start).line;
    let end=state.end;
    // Do not leave a dangling closing bracket after completing a partial marker.
    const remainder=$('#source').value.slice(end);
    const closing=remainder.match(o.action==='apply-node-status'?/^[a-z-]*\](?:[ \t]*)/:/^[ xX]*\](?:[ \t]*)/);
    if(closing)end+=closing[0].length;
    editorApplyRange(state.start,end,'',state.start);
    hideCompletions();
    setEditorNodeControls(line,o.action==='apply-node-status'?{status:o.value}:{checked:o.value},true);
    return;
  }
  // state.end includes the remainder of [[ExistingLink]] so replacement is atomic.
  editorReplace(state.start,state.end,o.insert,true);
  const source=$('#source');source.setSelectionRange(state.start+o.insert.length,state.start+o.insert.length);
  if(o.action==='link')updateCompletions();else hideCompletions();
}
function editorInsert(text){
  const source=$('#source'),start=source.selectionStart,end=source.selectionEnd;
  editorReplace(start,end,text,true);source.setSelectionRange(start+text.length,start+text.length);updateCompletions();
}
// mindfagg v15: Apply toolbar formatting atomically to every selected Markdown line.
// A selection ending exactly at the beginning of the next line does not include it.
