'use strict';
// mindfagg v30: markdown/commands.js (klassisches Script; gemeinsame globale Laufzeit).
function editorSelectedLineRange(selection){
  const source=$('#source'),scan=editorScan;
  if(!source||!scan?.items?.length)return null;
  const start=clamp(selection?.start??source.selectionStart,0,source.value.length);
  const end=clamp(selection?.end??source.selectionEnd,start,source.value.length);
  const first=linePosition(start).line;
  let last=linePosition(end).line;
  if(end>start&&last>first&&end===scan.offsets[last])last--;
  return {first,last,multiple:last>first,from:scan.offsets[first],to:scan.offsets[last]+scan.lines[last].length};
}
function editorNodeControlValue(item,change){
  const marker=lineMarker(item.raw);
  if(!marker)return item.raw;
  const tokens=nodeControlTokens(item);
  let checked=tokens.find(t=>t.type==='check')?.checked??null;
  let status=tokens.find(t=>t.type==='status')?.status??null;
  const date=tokens.find(t=>t.type==='date')?.date??null;
  if(Object.prototype.hasOwnProperty.call(change,'checked'))checked=change.checked;
  if(Object.prototype.hasOwnProperty.call(change,'status'))status=change.status==='story'?null:change.status;
  const prefixEnd=tokens.length?tokens[tokens.length-1].end:marker[0].length;
  const body=item.raw.slice(prefixEnd).replace(/^[ \t]+/,'');
  return marker[0]+(checked===null?'':(checked?'[x] ':'[ ] '))+(status===null?'':'[status:'+status+'] ')+(date?serializeNodeDate(date)+' ':'')+body;
}
function editorHasCheckbox(item){
  if(item.kind==='heading'||item.kind==='list')return nodeControlTokens(item).some(t=>t.type==='check');
  return /^\[[ xX]\](?:[ \t]+|$)/.test(item.raw.replace(/^[ \t]*/,''));
}
function editorLineBody(item){
  if(item.kind==='list')return smartListMatch(item.raw)?.[4]??item.raw.trimStart();
  if(item.kind==='heading')return item.raw.replace(/^ {0,3}#{1,6}[ \t]+/,'');
  return item.raw.replace(/^[ \t]*/, '');
}
function editorTransformSelectedLines(action,value,selection){
  const source=$('#source'),range=editorSelectedLineRange(selection);
  if(!range?.multiple)return false; // Keep existing one-line toolbar behavior.
  const items=editorScan.items.slice(range.first,range.last+1);
  const editable=items.filter(item=>item.raw.trim()&&item.kind!=='code'&&item.kind!=='fence');
  const removable=action==='list'?editable.filter(item=>!(item.kind==='heading'&&item.level===1)):
    action==='checkbox'?editable:editable.filter(item=>!(item.kind==='heading'&&item.level===1));
  const removeAll=action==='list'?removable.length>0&&removable.every(item=>item.kind==='list'):
    action==='checkbox'?removable.length>0&&removable.every(editorHasCheckbox):false;
  let applicable=0;
  const changed=items.map(item=>{
    const raw=item.raw;
    if(!raw.trim()||item.kind==='code'||item.kind==='fence')return raw;
    const lead=(raw.match(/^[ \t]*/)||[''])[0];
    if(action==='heading'){
      // The sole H1 root must remain a root; heading indentation is limited by Markdown syntax.
      if(item.kind==='heading'&&item.level===1)return raw;
      applicable++;
      const headingIndent=lead.includes('\t')||lead.length>3?'':lead;
      return headingIndent+'#'.repeat(value)+' '+editorLineBody(item);
    }
    if(action==='list'){
      if(item.kind==='heading'&&item.level===1)return raw;
      applicable++;
      if(removeAll)return item.kind==='list'?lead+editorLineBody(item):raw;
      return item.kind==='list'?raw:lead+'- '+editorLineBody(item);
    }
    if(action==='checkbox'){
      applicable++;
      if(item.kind==='heading'||item.kind==='list'){
        if(removeAll)return editorNodeControlValue(item,{checked:null});
        return editorHasCheckbox(item)?raw:editorNodeControlValue(item,{checked:false});
      }
      const body=raw.slice(lead.length);
      const checkbox=body.match(/^\[[ xX]\](?:[ \t]+|$)/);
      if(removeAll)return checkbox?lead+body.slice(checkbox[0].length):raw;
      return checkbox?raw:lead+'[ ] '+body;
    }
    if(action==='status'&&['heading','list'].includes(item.kind)){
      applicable++;
      return editorNodeControlValue(item,{status:value});
    }
    return raw;
  });
  if(!applicable){
    if(action==='status')toast('Status nur für Überschriften und Listen verfügbar');
    else toast('Keine passenden Zeilen in der Markierung');
    hideCompletions();restoreMarkdownEditorFocus();return true;
  }
  const replacement=changed.join('\n');
  if(replacement!==source.value.slice(range.from,range.to)){
    // One input event = one autosave/history step; keep the transformed lines selected.
    editorApplyRange(range.from,range.to,replacement,range.from,range.from+replacement.length);
  }
  hideCompletions();restoreMarkdownEditorFocus();
  return true;
}
function editorLineChange(marker){
  if(editorTransformSelectedLines('heading',marker.trim().length))return;
  const source=$('#source'),at=source.selectionStart,pos=linePosition(at),line=editorScan.lines[pos.line],start=editorScan.offsets[pos.line];
  const whitespace=(line.match(/^\s*/)||[''])[0].length,rest=line.slice(whitespace);
  const existing=rest.match(/^(?:#{1,6}[ \t]+|(?:[-+*]|\d+[.)])[ \t]+)/);
  const from=start+whitespace,to=from+(existing?existing[0].length:0);
  editorApplyRange(from,to,marker,from+marker.length);
  restoreMarkdownEditorFocus();
  hideCompletions();
}
// The list tool toggles the structural list marker, not the whole line's text.
function editorToggleList(){
  if(editorTransformSelectedLines('list'))return;
  const source=$('#source'),pos=linePosition(source.selectionStart),item=editorScan?.items[pos.line];
  if(!source||!item)return;
  if(item.kind==='code'||item.kind==='fence'){toast('Listenmarker innerhalb eines Codeblocks nicht verfügbar');return}
  if(item.kind==='heading'&&item.level===1){toast('Die einzige H1 kann nicht in eine Liste umgewandelt werden');return}
  const line=item.raw,start=editorScan.offsets[pos.line],lead=(line.match(/^[ \t]*/)||[''])[0];
  const marker=item.kind==='list'?smartListMatch(line):null;
  const heading=item.kind==='heading'?line.match(/^ {0,3}#{1,6}[ \t]+/):null;
  const from=marker?start+marker[1].length:heading?start:start+lead.length;
  const to=marker?from+marker[2].length+marker[3].length:heading?start+heading[0].length:from;
  const replacement=marker?'':'- ';
  const previous=source.selectionStart;
  const newCursor=previous>=to?previous+replacement.length-(to-from):Math.max(from,previous);
  editorApplyRange(from,to,replacement,newCursor);
  restoreMarkdownEditorFocus();hideCompletions();
}
// Checkbox tool only inserts/removes [ ]; it never inserts or removes a list marker.
function editorCheckboxToolbar(){
  if(editorTransformSelectedLines('checkbox'))return;
  const source=$('#source'),pos=linePosition(source.selectionStart),item=editorScan?.items[pos.line];
  if(!source||!item)return;
  if(item.kind==='code'||item.kind==='fence')return;
  if(['heading','list'].includes(item.kind)){
    const existing=nodeControlTokens(item).find(t=>t.type==='check');
    setEditorNodeControls(pos.line,{checked:existing?null:false},true);
    return;
  }
  const start=editorScan.offsets[pos.line],raw=item.raw,leading=(raw.match(/^[ \t]*/)||[''])[0].length;
  const existing=raw.slice(leading).match(/^\[[ xX]\](?:[ \t]+|$)/);
  const from=start+leading,to=from+(existing?existing[0].length:0);
  const replacement=existing?'':'[ ] ';
  const caret=source.selectionStart;
  const nextCaret=caret>=to?caret+replacement.length-(to-from):from+replacement.length;
  editorApplyRange(from,to,replacement,nextCaret);
  restoreMarkdownEditorFocus();hideCompletions();
}
function setEditorLineStatus(status,selection){
  if(editorTransformSelectedLines('status',status,selection))return;
  const source=$('#source'),pos=linePosition(selection?.start??source.selectionStart),item=editorScan.items[pos.line];
  if(!item||!['heading','list'].includes(item.kind)){toast('Status nur für Knoten verfügbar');hideCompletions();return}
  setEditorNodeControls(pos.line,{status},true);
}
function openToolbarStatus(){
  const source=$('#source'),at=source.selectionStart;
  const targetSelection={start:source.selectionStart,end:source.selectionEnd};
  completionState={start:at,end:at,targetSelection,label:'Status für markierte Knoten',items:STATUS.map(s=>({...namedCompletion(statusLabel(s),'[status:'+s+']','','apply-status'),value:s}))};
  completionIndex=0;renderCompletionPopup();
}
// List behavior is derived from the current Markdown line, and never changes
// the hierarchy unless the user explicitly indents or outdents a list item.
function editorApplyRange(from,to,replacement,selectionStart,selectionEnd=selectionStart){
  const source=$('#source');if(!source)return;
  // Toolbar/shortcut actions must never replace a folded placeholder.
  if(codeFoldHasCollapsed(source))codeFoldExpandAll(source);
  const top=source.scrollTop,left=source.scrollLeft;
  source.setRangeText(replacement,from,to,'end');
  source.setSelectionRange(selectionStart,selectionEnd);
  source.scrollTop=top;source.scrollLeft=left;
  source.dispatchEvent(new Event('input',{bubbles:true}));
}
function smartListMatch(raw){return raw.match(/^([ \t]*)([-+*]|\d+[.)])([ \t]+)(.*)$/)}
function indentWidth(s){let col=0;for(const c of s){col+=c==='\t'?4-col%4:1}return col}
function listItemContent(raw){
  let rest=raw;
  // An inherited checkbox restarts unchecked; status is intentionally not copied.
  let checkbox=false;
  for(let k=0;k<2;k++){
    const ck=rest.match(/^\[([ xX])\][ \t]*/);
    const status=rest.match(/^\[status:[a-z-]+\][ \t]*/i);
    if(ck){checkbox=true;rest=rest.slice(ck[0].length)}
    else if(status)rest=rest.slice(status[0].length);
    else break;
  }
  return {checkbox,title:rest.trim()};
}
function renumberOrderedAfter(text,insertedLine,indent,nextNumber,delimiter){
  const lines=text.split('\n');let number=nextNumber;
  for(let i=insertedLine+1;i<lines.length;i++){
    if(/^ {0,3}#{1,6}(?:\s|$)/.test(lines[i]))break;
    const m=smartListMatch(lines[i]);if(!m)continue;
    const w=indentWidth(m[1]);if(w<indent)break;if(w>indent)continue;
    if(!/^\d+[.)]$/.test(m[2])||m[2].slice(-1)!==delimiter)break;
    number++;
    lines[i]=m[1]+number+delimiter+m[3]+m[4];
  }
  return lines.join('\n');
}
function smartListEnter(){
  const source=$('#source');if(!source||editorComposing)return false;
  if(source.selectionStart!==source.selectionEnd)return false;
  const pos=source.selectionStart,loc=linePosition(pos),line=editorScan?.lines[loc.line]??'';
  const kind=editorScan?.items[loc.line]?.kind;
  if(kind==='code'||kind==='fence')return false;
  const m=smartListMatch(line),start=editorScan.offsets[loc.line];
  if(m){
    const markerLength=m[1].length+m[2].length+m[3].length;
    if(loc.col<markerLength)return false;
    const metadata=listItemContent(m[4]);
    const tail=line.slice(loc.col);
    if(!metadata.title&&!tail.trim()){
      // A blank item closes the list. On nested lists, Enter first dedents.
      const currentIndent=indentWidth(m[1]);
      if(currentIndent>=2){
        const oldIndent=m[1],removed=oldIndent.endsWith('\t')?1:2;
        const dedented=oldIndent.endsWith('\t')?oldIndent.slice(0,-1):oldIndent.slice(0,-removed);
        const replacement=dedented+m[2]+m[3];
        editorApplyRange(start,start+line.length,replacement,start+replacement.length);
      }else editorApplyRange(start,start+line.length,'',start);
      hideCompletions();return true;
    }
    const numbered=/^(\d+)([.)])$/.exec(m[2]);
    const newMarker=numbered?(Number(numbered[1])+1)+numbered[2]:m[2];
    const continuation=m[1]+newMarker+m[3]+(metadata.checkbox?'[ ] ':'');
    const insertedLine=loc.line+1,insertionText='\n'+continuation;
    const result=source.value.slice(0,pos)+insertionText+source.value.slice(pos);
    const caret=pos+insertionText.length;
    const changed=numbered?renumberOrderedAfter(result,insertedLine,indentWidth(m[1]),Number(numbered[1])+1,numbered[2]):result;
    editorApplyRange(0,source.value.length,changed,caret);
    hideCompletions();return true;
  }
  // Keep leading spaces on subsequent description lines, but not on empty lines.
  const indent=(line.match(/^[ \t]+/)||[''])[0];
  if(indent&&line.trim()){
    editorApplyRange(source.selectionStart,source.selectionEnd,'\n'+indent,pos+1+indent.length);
    hideCompletions();return true;
  }
  return false;
}
function smartListIndent(outdent=false){
  const source=$('#source');if(!source||!editorScan)return;
  const selStart=source.selectionStart,selEnd=source.selectionEnd;
  const first=linePosition(selStart).line;
  let last=linePosition(selEnd).line;
  const multiline=selStart!==selEnd&&last>first;
  if(multiline&&selEnd===editorScan.offsets[last])last--;
  if(!multiline){
    const m=smartListMatch(editorScan.lines[first]);
    if(m){
      const current=indentWidth(m[1]);
      // Move the entire subtree along with the selected list node.
      for(let i=first+1;i<editorScan.lines.length;i++){
        const it=editorScan.items[i];
        if(it.kind==='heading')break;
        if(it.kind==='list'&&indentWidth((smartListMatch(it.raw)||['',''])[1])<=current)break;
        last=i;
      }
    }
  }
  const from=editorScan.offsets[first];
  const to=editorScan.offsets[last]+editorScan.lines[last].length;
  const old=source.value.slice(from,to),lines=old.split('\n');
  const changed=lines.map(line=>{
    if(!line.trim())return line;
    if(!outdent)return '  '+line;
    return line.replace(/^(?: {1,2}|\t)/,'');
  });
  if(changed.every((line,i)=>line===lines[i]))return;
  const replacement=changed.join('\n');
  if(multiline){editorApplyRange(from,to,replacement,from,from+replacement.length)}
  else{
    const oldLead=(lines[0].match(/^[ \t]*/)||[''])[0].length;
    const newLead=(changed[0].match(/^[ \t]*/)||[''])[0].length;
    const adjustment=newLead-oldLead;
    const caret=clamp(selStart+adjustment,from,from+changed[0].length);
    editorApplyRange(from,to,replacement,caret);
  }
  hideCompletions();
}
function wireEditorTools(){
  const toolbar=$('.editor-tools');
  toolbar?.addEventListener('pointerdown',e=>{
    if(window.matchMedia('(max-width:850px)').matches &&
       e.target.closest('button[data-tool]') && document.activeElement===$('#source') && e.cancelable){
      // Prevent the button from stealing textarea focus; click still fires.
      e.preventDefault();
    }
  });
  const heading=$('#headingLevel');
  if(heading)heading.onchange=()=>{
    const level=Number(heading.value);
    heading.selectedIndex=0;
    if(level>=2&&level<=6)editorLineChange('#'.repeat(level)+' ');
  };
  document.querySelectorAll('[data-tool]').forEach(btn=>btn.onclick=()=>{
    const cmd=btn.dataset.tool;
    if(cmd==='list')editorToggleList();
    else if(cmd==='indent')smartListIndent(false);
    else if(cmd==='outdent')smartListIndent(true);
    else if(cmd==='checkbox')editorCheckboxToolbar();
    else if(cmd==='status')openToolbarStatus();
    else if(cmd==='link'){
      const source=$('#source'),pos=linePosition(source.selectionStart);
      if(wikiLinkAtCaret(editorScan.lines[pos.line]||'',pos.col))updateCompletions();
      else editorInsert('[[');
    }
  });
}
// v19: Track the *visible* viewport, not only 100dvh (which can include the keyboard on iOS).
