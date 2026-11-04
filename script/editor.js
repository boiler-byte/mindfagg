'use strict';
/* mindfagg v28 — Script editor: shared visual style with Markdown, no toolbar.
 * Prism is bundled locally for offline syntax coloring; file contents are NEVER
 * evaluated or inserted without Prism's HTML escaping. */
const SCRIPT_LANGUAGE_BY_EXTENSION={
  js:'javascript',mjs:'javascript',cjs:'javascript',jsx:'javascript',ts:'javascript',tsx:'javascript',
  html:'markup',htm:'markup',xhtml:'markup',vue:'markup',svelte:'markup',
  xml:'markup',svg:'markup',xsd:'markup',xsl:'markup',xslt:'markup',wsdl:'markup',rss:'markup',atom:'markup',
  css:'css',scss:'css',sass:'css',less:'css',
  json:'json',jsonc:'javascript'
};
let scriptMiniGeometry=null,scriptMiniFrame=0,scriptMinimapLines=[],scriptLineLayout=null;
function scriptLanguage(doc){return SCRIPT_LANGUAGE_BY_EXTENSION[pathExtension(workspacePath(doc))]||null}
function scriptPaintSource(source,doc){
  const lang=scriptLanguage(doc);
  if(!lang||typeof Prism==='undefined'||!Prism.languages[lang])return escapeHtml(source);
  try{return Prism.highlight(source,Prism.languages[lang],lang)}
  catch(error){console.warn('Syntaxhervorhebung fehlgeschlagen:',error);return escapeHtml(source)}
}
function refreshScriptVisuals(){
  const source=$('#scriptSource');if(!source)return;
  const doc=docs.find(item=>item.id===editorDocId);if(!doc)return;
  const text=source.value;
  scriptMinimapLines=text.replace(/\r\n?/g,'\n').split('\n');
  scriptLineLayout=editorVisualLayout(source,scriptMinimapLines);
  $('#scriptSyntax').innerHTML=scriptPaintSource(text,doc)+'\n';
  $('#scriptLineNumbers').innerHTML=scriptMinimapLines.map((_,i)=>'<span class="gline" style="--mf-visual-rows:'+scriptLineLayout.counts[i]+'">'+(i+1)+'</span>').join('');
  syncScriptCodeScroll();
}
function syncScriptCodeScroll(){
  const source=$('#scriptSource');if(!source)return;
  const syntax=$('#scriptSyntax'),gutter=$('#scriptLineNumbers');
  if(!syntax||!gutter)return;
  syntax.style.transform=`translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
  gutter.style.transform=`translateY(${-source.scrollTop}px)`;
  if(!scriptMiniFrame)scriptMiniFrame=requestAnimationFrame(()=>{scriptMiniFrame=0;drawScriptMinimap()});
}
function scriptMiniColor(line,lang){
  const trimmed=line.trimStart();
  if(/^(?:\/\/|\/\*|\*|<!--|#\s)/.test(trimmed))return '#66849b';
  if(lang==='markup')return trimmed.startsWith('<')?'#b6a6fa':'#7998a7';
  if(lang==='css')return trimmed.startsWith('@')?'#ecba82':trimmed.includes('{')?'#b8a6f5':trimmed.includes(':')?'#8ed8c9':'#829cb8';
  if(lang==='javascript')return /\b(?:const|let|var|function|class|return|import|export|async|await)\b/.test(trimmed)?'#b7a8fb':'#82accb';
  if(lang==='json')return trimmed.includes(':')?'#91cdb5':'#819dbd';
  return '#8193aa';
}
function drawScriptMinimap(){
  const source=$('#scriptSource'),map=$('#scriptMinimap'),canvas=$('#scriptMiniCanvas'),target=$('#scriptMiniViewport');
  if(!source||!map||!canvas||!target)return;
  const width=map.clientWidth,height=map.clientHeight;if(width<1||height<1)return;
  const scale=Math.min(window.devicePixelRatio||1,2),wpx=Math.round(width*scale),hpx=Math.round(height*scale);
  if(canvas.width!==wpx||canvas.height!==hpx){canvas.width=wpx;canvas.height=hpx}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
  const scrollHeight=Math.max(source.scrollHeight,source.clientHeight),maxScroll=Math.max(0,scrollHeight-source.clientHeight);
  const ratio=maxScroll?source.scrollTop/maxScroll:0;
  const virtualHeight=Math.max(height,(scriptLineLayout?.totalRows||scriptMinimapLines.length)*5.3+19);
  const mapOffset=ratio*Math.max(0,virtualHeight-height);
  const style=getComputedStyle(source),lineHeight=parseFloat(style.lineHeight)||23,topPad=parseFloat(style.paddingTop)||17;
  const lineSpacing=lineHeight*virtualHeight/scrollHeight;
  const first=Math.max(0,editorIndexAtVisualRow(scriptLineLayout?.offsets||[],(mapOffset*scrollHeight/virtualHeight-topPad)/lineHeight)-2);
  const last=Math.min(scriptMinimapLines.length,editorIndexAtVisualRow(scriptLineLayout?.offsets||[],((mapOffset+height)*scrollHeight/virtualHeight-topPad)/lineHeight)+3);
  const lang=scriptLanguage(documentNow());
  for(let i=first;i<last;i++){
    const line=scriptMinimapLines[i];if(!line.trim())continue;
    const y=((topPad+(scriptLineLayout?.offsets[i]??i)*lineHeight)*virtualHeight/scrollHeight)-mapOffset;
    if(y< -8||y>height+8)continue;
    const leading=(line.match(/^\s*/)||[''])[0].replace(/\t/g,'  ').length;
    const x=4+Math.min(leading,36)*.83;
    const len=Math.max(2,Math.min(width-x-5,line.trimEnd().length*.95));
    if(len<=0)continue;
    ctx.fillStyle=scriptMiniColor(line,lang);ctx.globalAlpha=.82;
    ctx.fillRect(x,y,len,Math.min(3.2,Math.max(1.6,lineSpacing*.5)));
  }
  ctx.globalAlpha=1;
  const rawThumb=source.clientHeight/scrollHeight*virtualHeight;
  const thumbHeight=Math.max(20,Math.min(height,rawThumb));
  const thumbY=ratio*Math.max(0,height-thumbHeight);
  target.style.height=thumbHeight+'px';target.style.transform=`translateY(${thumbY}px)`;
  map.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
  map.setAttribute('aria-valuetext',`${Math.round(ratio*100)} % des Dokuments`);
  scriptMiniGeometry={width,height,thumbY,thumbHeight,maxScroll,mapOffset,virtualHeight};
}
function wireScriptMinimap(){
  const map=$('#scriptMinimap'),source=$('#scriptSource');let drag=null;
  function jump(y){
    const g=scriptMiniGeometry;if(!g)return;
    const ratio=Math.max(0,Math.min(1,(y-g.thumbHeight/2)/Math.max(1,g.height-g.thumbHeight)));
    source.scrollTop=g.maxScroll*ratio;syncScriptCodeScroll();
  }
  map.onpointerdown=e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    e.preventDefault();map.focus({preventScroll:true});drawScriptMinimap();
    const g=scriptMiniGeometry;if(!g)return;
    const y=e.clientY-map.getBoundingClientRect().top;
    if(y<g.thumbY||y>g.thumbY+g.thumbHeight)jump(y);
    drag={pointer:e.pointerId,startY:e.clientY,startScroll:source.scrollTop};
    map.setPointerCapture(e.pointerId);
  };
  map.onpointermove=e=>{
    if(!drag||drag.pointer!==e.pointerId)return;
    const g=scriptMiniGeometry;if(!g)return;
    const travel=Math.max(1,g.height-g.thumbHeight);
    source.scrollTop=Math.max(0,Math.min(g.maxScroll,drag.startScroll+(e.clientY-drag.startY)*g.maxScroll/travel));
    syncScriptCodeScroll();
  };
  map.onpointerup=map.onpointercancel=e=>{if(drag?.pointer===e.pointerId)drag=null};
  map.onkeydown=e=>{
    const step=source.clientHeight*.7;
    if(e.key==='ArrowDown')source.scrollTop+=step/3;
    else if(e.key==='ArrowUp')source.scrollTop-=step/3;
    else if(e.key==='PageDown')source.scrollTop+=step;
    else if(e.key==='PageUp')source.scrollTop-=step;
    else if(e.key==='Home')source.scrollTop=0;
    else if(e.key==='End')source.scrollTop=source.scrollHeight;
    else return;
    e.preventDefault();syncScriptCodeScroll();
  };
  map.onwheel=e=>{e.preventDefault();source.scrollTop+=e.deltaY;source.scrollLeft+=e.deltaX;syncScriptCodeScroll()};
}
function renderEnhancedScriptEditor(){
  const doc=documentNow();editorDocId=doc.id;scriptMiniGeometry=null;
  $('#surface').innerHTML=`<div class="script-editor">
    <div class="codeframe script-codeframe">
      <div class="codegutter" aria-hidden="true"><pre id="scriptLineNumbers"></pre></div>
      <div class="codepane"><pre class="syntaxlayer script-syntax" id="scriptSyntax" aria-hidden="true"></pre><textarea id="scriptSource" aria-label="Script-Datei bearbeiten" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" wrap="off"></textarea></div>
      <div class="minimap" id="scriptMinimap" role="scrollbar" aria-label="Script-Minimap, scrollbar" aria-controls="scriptSource" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><canvas id="scriptMiniCanvas" aria-hidden="true"></canvas><div class="mini-viewport" id="scriptMiniViewport"></div></div>
    </div>
  </div>`;
  const input=$('#scriptSource');input.value=doc.content||'';input.wrap=appEditorSettings.wordWrap?'soft':'off';
  refreshScriptVisuals();wireScriptMinimap();
  input.onscroll=syncScriptCodeScroll;
  input.oninput=()=>{
    const value=input.value,d=docs.find(item=>item.id===editorDocId);if(!d)return;
    if(d.content!==value){docHistoryFor(d.id).redo.length=0;deletionHistoryFor(d.projectId).redo.length=0}
    d.content=value;failedDocWrites.delete(d.id);updateHistoryButtons();updateSaveStatus();
    refreshScriptVisuals();
    clearTimeout(saveTimer);const id=d.id;
    saveTimer=setTimeout(()=>saveSource(id,value).catch(error=>{console.error(error);toast('Speichern fehlgeschlagen')}),650);
  };
  input.onkeydown=event=>{
    if((event.ctrlKey||event.metaKey)&&!event.altKey){
      const key=event.key.toLowerCase();
      if(key==='z'||key==='y'){event.preventDefault();changeHistory(key==='y'||event.shiftKey?'redo':'undo');return}
    }
    if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      event.preventDefault();const a=input.selectionStart,b=input.selectionEnd;
      input.setRangeText('  ',a,b,'end');input.dispatchEvent(new Event('input',{bubbles:true}));
    }
  };
  if(typeof ResizeObserver!=='undefined'){
    editorResizeObserver=new ResizeObserver(()=>{if(appEditorSettings.wordWrap)refreshScriptVisuals();else syncScriptCodeScroll()});
    editorResizeObserver.observe(input);editorResizeObserver.observe($('#scriptMinimap'));
  }
  requestAnimationFrame(()=>{if(document.querySelector('#scriptSource')===input)syncScriptCodeScroll()});
}
