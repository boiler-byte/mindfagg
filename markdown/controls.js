'use strict';
// mindfagg v30: markdown/controls.js (klassisches Script; gemeinsame globale Laufzeit).
let completionState=null,completionIndex=0,editorComposing=false,tokenMetrics=null;
function editorMetrics(){
  const source=$('#source');if(!source)return null;
  const css=getComputedStyle(source),ctx=document.createElement('canvas').getContext('2d');
  ctx.font=css.font;
  return {lineHeight:parseFloat(css.lineHeight)||23,padTop:parseFloat(css.paddingTop)||17,
    padLeft:parseFloat(css.paddingLeft)||19,charWidth:ctx.measureText('M').width};
}
function visualColumns(text){let columns=0;for(const c of text){if(c==='\t')columns+=2-columns%2;else columns++}return columns}
function linePosition(index){
  const lines=editorScan?.lines||[],clamped=Math.max(0,index),lineStart=(editorScan?.offsets||[]);
  let low=0,high=lineStart.length-1;
  while(low<high){let mid=Math.ceil((low+high)/2);if(lineStart[mid]<=clamped)low=mid;else high=mid-1}
  return {line:low,col:clamped-(lineStart[low]||0)};
}
function lineMarker(raw){return raw.match(/^( {0,3}#{1,6}[ \t]+|[ \t]*(?:[-+*]|\d+[.)])[ \t]+)/)}
function nodeMarkerToken(item){
  if(!item)return null;
  if(item.kind==='heading'){
    const m=item.raw.match(/^( {0,3})(#{1,6})(?=[ \t]|$)/);
    return m?{start:m[1].length,end:m[1].length+m[2].length,type:'H'+m[2].length}:null;
  }
  if(item.kind==='list'){
    const m=item.raw.match(/^([ \t]*)([-+*]|\d+[.)])(?=[ \t])/);
    return m?{start:m[1].length,end:m[1].length+m[2].length,type:m[2]}:null;
  }
  return null;
}
function nodeControlTokens(item){
  if(!item||!['heading','list'].includes(item.kind))return [];
  const prefix=lineMarker(item.raw);if(!prefix)return [];
  const tokens=[];let index=prefix[0].length,rest=item.raw.slice(index);
  for(let k=0;k<3;k++){
    const blanks=rest.match(/^[ \t]+/);if(blanks){index+=blanks[0].length;rest=rest.slice(blanks[0].length)}
    const check=rest.match(/^\[([ xX])\](?=[ \t]|$)/);
    const status=rest.match(/^\[status:([a-z-]+)\](?=[ \t]|$)/i);
    const date=nodeDatePrefix(rest);
    if(check){tokens.push({type:'check',start:index,end:index+check[0].length,checked:check[1].toLowerCase()==='x'});index+=check[0].length;rest=rest.slice(check[0].length)}
    else if(status&&STATUS.includes(status[1].toLowerCase())){tokens.push({type:'status',start:index,end:index+status[0].length,status:status[1].toLowerCase()});index+=status[0].length;rest=rest.slice(status[0].length)}
    else if(date){tokens.push({type:'date',start:index,end:index+date.text.length,date:date.date});index+=date.text.length;rest=rest.slice(date.text.length)}
    else break;
  }
  return tokens;
}
function editorReplace(from,to,replacement,focus=false){
  const source=$('#source');if(!source)return;
  const scrollTop=source.scrollTop,scrollLeft=source.scrollLeft;
  source.setRangeText(replacement,from,to,'preserve');
  if(focus)restoreMarkdownEditorFocus();
  source.scrollTop=scrollTop;source.scrollLeft=scrollLeft;
  source.dispatchEvent(new Event('input',{bubbles:true}));
}
// Modify the node metadata as a single canonical prefix: checkbox, then status.
// Story is the implicit default: selecting it removes any serialized status marker.
function setEditorNodeControls(line,change,focus=false){
  const source=$('#source'),item=editorScan?.items[line];
  if(!source||!item||!['heading','list'].includes(item.kind))return false;
  const marker=lineMarker(item.raw);if(!marker)return false;
  const tokens=nodeControlTokens(item);
  let checked=tokens.find(t=>t.type==='check')?.checked??null;
  let status=tokens.find(t=>t.type==='status')?.status??null;
  const date=tokens.find(t=>t.type==='date')?.date??null;
  if(Object.prototype.hasOwnProperty.call(change,'checked'))checked=change.checked;
  if(Object.prototype.hasOwnProperty.call(change,'status'))status=change.status==='story'?null:change.status;
  const oldContentStart=tokens.length?tokens[tokens.length-1].end:marker[0].length;
  const remaining=item.raw.slice(oldContentStart);
  const body=remaining.replace(/^[ \t]+/,'');
  const newPrefix=marker[0]+(checked===null?'':(checked?'[x] ':'[ ] '))+(status===null?'':'[status:'+status+'] ')+(date?serializeNodeDate(date)+' ':'');
  const next=newPrefix+body;
  const start=editorScan.offsets[line],end=start+item.raw.length;
  const oldCaret=source.selectionStart;
  const bodyOffset=oldContentStart+(remaining.length-body.length);
  const caret=oldCaret>=start+bodyOffset&&oldCaret<=end
    ?start+newPrefix.length+oldCaret-(start+bodyOffset)
    :start+newPrefix.length;
  if(next!==item.raw)editorApplyRange(start,end,next,Math.max(start,Math.min(start+next.length,caret)));
  if(focus)restoreMarkdownEditorFocus();
  hideCompletions();
  return true;
}
function toggleEditorCheckbox(line,token){
  setEditorNodeControls(line,{checked:!token.checked});
}
function changeEditorStatus(line,token,status){
  setEditorNodeControls(line,{status});
}
function drawEditorInteractions(){
  const source=$('#source'),layer=$('#interactionLayer');if(!source||!layer||!editorScan)return;
  if(appEditorSettings.wordWrap){layer.replaceChildren();return}
  const m=editorMetrics();if(!m)return;
  tokenMetrics=m;
  const first=Math.max(0,Math.floor((source.scrollTop-m.padTop)/m.lineHeight)-1),
        last=Math.min(editorScan.items.length,Math.ceil((source.scrollTop+source.clientHeight-m.padTop)/m.lineHeight)+2);
  let html='';
  for(let line=first;line<last;line++){
    const item=editorScan.items[line],y=m.padTop+line*m.lineHeight-source.scrollTop;
    if(y < -m.lineHeight||y>source.clientHeight+1)continue;
    const marker=nodeMarkerToken(item);
    if(marker){
      const left=m.padLeft+visualColumns(item.raw.slice(0,marker.start))*m.charWidth-source.scrollLeft;
      const width=(visualColumns(item.raw.slice(0,marker.end))-visualColumns(item.raw.slice(0,marker.start)))*m.charWidth;
      if(left<source.clientWidth&&left+width>0){
        html+=`<button type="button" class="token-hit token-hit-marker" data-marker-line="${line}" style="top:${y.toFixed(2)}px;left:${left.toFixed(2)}px;width:${Math.max(12,width).toFixed(2)}px;height:${m.lineHeight}px" aria-label="Knoten in Zeile ${line+1} bearbeiten (${escapeHtml(marker.type)})" title="${escapeHtml(marker.type)} · Knoten bearbeiten"></button>`;
      }
    }
    for(const t of nodeControlTokens(item)){
      const left=m.padLeft+visualColumns(item.raw.slice(0,t.start))*m.charWidth-source.scrollLeft;
      const width=(visualColumns(item.raw.slice(0,t.end))-visualColumns(item.raw.slice(0,t.start)))*m.charWidth;
      if(left>source.clientWidth||left+width<0)continue;
      const base=`data-line="${line}" data-column="${t.start}" style="top:${y.toFixed(2)}px;left:${left.toFixed(2)}px;width:${Math.max(width,t.type==='check'?27:32).toFixed(2)}px;height:${m.lineHeight}px"`;
      if(t.type==='check')html+=`<button type="button" class="token-hit token-hit-checkbox" ${base} aria-label="Checkbox in Zeile ${line+1}: ${t.checked?'erledigt, als offen markieren':'offen, als erledigt markieren'}" title="Checkbox umschalten"></button>`;
      else if(t.type==='status')html+=`<select class="token-hit token-hit-status" ${base} aria-label="Status in Zeile ${line+1} ändern" title="Status ändern">${STATUS.map(s=>`<option value="${s}" ${s===t.status?'selected':''}>${escapeHtml(statusLabel(s))}</option>`).join('')}</select>`;
      else if(t.type==='date')html+=`<button type="button" class="token-hit token-hit-date" ${base} aria-label="Datum in Zeile ${line+1} bearbeiten" title="Datum im Knoten-Dialog bearbeiten"></button>`;
    }
  }
  layer.innerHTML=html;
  layer.querySelectorAll('[data-marker-line]').forEach(el=>el.onclick=()=>openNodeEditorFromEditorLine(Number(el.dataset.markerLine)));
  layer.querySelectorAll('.token-hit-checkbox').forEach(el=>el.onclick=()=>{
    const item=editorScan?.items[Number(el.dataset.line)];const t=nodeControlTokens(item).find(t=>t.type==='check'&&t.start===Number(el.dataset.column));
    if(t)toggleEditorCheckbox(Number(el.dataset.line),t);
  });
  layer.querySelectorAll('.token-hit-status').forEach(el=>el.onchange=()=>{
    const item=editorScan?.items[Number(el.dataset.line)];const t=nodeControlTokens(item).find(t=>t.type==='status'&&t.start===Number(el.dataset.column));
    if(t)changeEditorStatus(Number(el.dataset.line),t,el.value);
  });
  layer.querySelectorAll('.token-hit-date').forEach(el=>el.onclick=()=>openNodeEditorFromEditorLine(Number(el.dataset.line)));
}
async function openNodeEditorFromEditorLine(line){
  const source=$('#source'),item=editorScan?.items[line];
  if(!source||!item||!['heading','list'].includes(item.kind))return;
  await flushSource();
  hideCompletions();
  currentModel=parseMarkdown(source.value,scanMarkdown(source.value));
  const node=flattened(currentModel).find(n=>n.start===line&&n.kind!=='virtual');
  if(node)editNode(node.path);
}
function hideCompletions(){completionState=null;const pop=$('#completionPopup');if(pop)pop.classList.add('hidden')}
function namedCompletion(label,detail,insert,action){return {label,detail,insert,action}}
// A complete [[...]] token is a single edit range even when the caret is in its middle.
