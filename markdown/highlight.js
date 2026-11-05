'use strict';
// mindfagg v30: markdown/highlight.js (klassisches Script; gemeinsame globale Laufzeit).
function paintInline(raw){
  let out='',pos=0;
  for(const match of raw.matchAll(SYN_TOKENS)){
    out+=escapeHtml(raw.slice(pos,match.index));
    let word=match[0],type=/^\[\[|^\[[^\]]+\]\(/.test(word)?'syn-link':word.startsWith('`')?'syn-code':word.startsWith('**')||word.startsWith('__')?'syn-strong':'syn-em';
    out+=`<span class="${type}">${escapeHtml(word)}</span>`;pos=match.index+word.length;
  }
  return out+escapeHtml(raw.slice(pos));
}
function paintNodeText(value){
  let rest=value,html='';
  for(let i=0;i<3;i++){
    const space=rest.match(/^\s+/);
    if(space){html+=escapeHtml(space[0]);rest=rest.slice(space[0].length)}
    const cb=rest.match(/^\[([ xX])\](?=\s|$)/);
    const status=rest.match(/^\[status:([a-z-]+)\](?=\s|$)/i);
    const date=nodeDatePrefix(rest);
    if(cb){html+=`<span class="${cb[1].toLowerCase()==='x'?'syn-checkbox-done':'syn-checkbox'}">${escapeHtml(cb[0])}</span>`;rest=rest.slice(cb[0].length);continue}
    if(status){const key=status[1].toLowerCase(),cls=['done','doing','todo','review'].includes(key)?' syn-status-'+key:'',style=STATUS.includes(key)?` style="color:${statusColor(key)}" title="${escapeHtml(statusLabel(key))}"`:'';html+=`<span class="syn-status${cls}"${style}>${escapeHtml(status[0])}</span>`;rest=rest.slice(status[0].length);continue}
    if(date){html+=`<span class="syn-date">${escapeHtml(date.text)}</span>`;rest=rest.slice(date.text.length);continue}
    // Invalid date syntax remains literal text and gets a warning in the editor.
    const invalidDate=rest.match(/^\[date[^\]\r\n]*\](?=\s|$)/i);
    if(invalidDate){html+=`<span class="syn-date-invalid" title="Ungültiges Datums-Tag: [date:YYYY-MM-DD +1y +1m +1d], keine negativen oder doppelten Einheiten">${escapeHtml(invalidDate[0])}</span>`;rest=rest.slice(invalidDate[0].length);break}
    break;
  }
  return html+paintInline(rest);
}
function paintLine(item,scan){
  const raw=item.raw;
  if(item.kind==='heading'){
    const m=raw.match(/^( {0,3}#{1,6})(.*)$/);
    return `<span class="syn-heading">${escapeHtml(m[1])}</span><span class="syn-heading-title">${paintNodeText(m[2])}</span>`;
  }
  if(item.kind==='list')return `<span class="syn-bullet">${escapeHtml(item.prefix)}</span>${paintNodeText(raw.slice(item.prefix.length))}`;
  if(item.kind==='fence')return `<span class="syn-fence">${escapeHtml(raw)}</span>`;
  if(item.kind==='code')return `<span class="syn-codecontent">${escapeHtml(raw)}</span>`;
  if(item.kind==='quote')return `<span class="syn-quote">${paintInline(raw)}</span>`;
  if(item.kind==='table')return `<span class="syn-table">${paintInline(raw)}</span>`;
  if(item.kind==='comment')return `<span class="syn-comment">${escapeHtml(raw)}</span>`;
  return paintInline(raw);
}
let editorScan=null,editorDocId=null,editorResizeObserver=null,miniFrame=0,miniGeometry=null,editorLineLayout=null;
function refreshCodeVisuals(){
  const source=$('#source');if(!source)return;
  editorScan=scanMarkdown(codeFoldFull(source));
  const displayScan=scanMarkdown(source.value);
  const invalid=new Set(editorScan.roots.slice(1));
  editorLineLayout=editorVisualLayout(source,displayScan.lines);
  $('#syntax').innerHTML=displayScan.items.map((it,i)=>`<span class="syn-line ${it.kind==='heading'&&it.level===1?'syn-root':''} ${invalid.has(codeFoldOriginalIndex(source,i))?'syn-invalid':''}">${paintLine(it,displayScan)}</span>`).join('\n')+'\n';
  $('#lineNumbers').innerHTML=displayScan.items.map((it,i)=>{
    const original=codeFoldOriginalIndex(source,i);
    return `<span class="gline ${it.kind==='heading'&&it.level===1?'h1':''} ${invalid.has(original)?'error':''} ${original===null?'code-fold-summary':''}" style="--mf-visual-rows:${editorLineLayout.counts[i]}">${original===null?'⋯':original+1}</span>`;
  }).join('');
  codeFoldPaintGutter(source,'markdownFoldGutter',displayScan.lines,editorLineLayout);
  const state=$('#rootState');state.classList.toggle('invalid',!editorScan.valid);state.textContent=(editorScan.valid?'✓ ':'⚠ ')+validationMessage(editorScan);
  state.setAttribute('aria-label',editorScan.valid?'Dokumentstruktur gültig':validationMessage(editorScan)+'; klicken zum Fehler');
  state.title=editorScan.valid?'Genau eine Root-Überschrift vorhanden':'Zum Fehler im Markdown springen';
  syncCodeScroll();
}
function syncCodeScroll(){
  const source=$('#source');if(!source)return;
  $('#syntax').style.transform=`translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
  $('#lineNumbers').style.transform=`translateY(${-source.scrollTop}px)`;
  codeFoldSyncGutter(source,'markdownFoldGutter');
  if(!miniFrame)miniFrame=requestAnimationFrame(()=>{miniFrame=0;drawMinimap();drawEditorInteractions();positionCompletionPopup()});
}
function drawMinimap(){
  const source=$('#source'),map=$('#minimap'),canvas=$('#miniCanvas'),target=$('#miniViewport');
  if(!source||!map||!canvas||!editorScan||!target)return;
  const visibleScan=codeFoldHasCollapsed(source)?scanMarkdown(source.value):editorScan;
  const width=map.clientWidth,height=map.clientHeight;if(width<1||height<1)return;
  const scale=Math.min(window.devicePixelRatio||1,2),wpx=Math.round(width*scale),hpx=Math.round(height*scale);
  if(canvas.width!==wpx||canvas.height!==hpx){canvas.width=wpx;canvas.height=hpx}
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
  const scrollHeight=Math.max(source.scrollHeight,source.clientHeight),maxScroll=Math.max(0,scrollHeight-source.clientHeight);
  const ratio=maxScroll?source.scrollTop/maxScroll:0;
  const virtualHeight=Math.max(height,(editorLineLayout?.totalRows||visibleScan.lines.length)*5.3+19);
  // The overview travels at a reduced rate as the code scrolls: parallax.
  const mapOffset=ratio*Math.max(0,virtualHeight-height);
  const lineHeight=parseFloat(getComputedStyle(source).lineHeight)||23;
  const topPad=parseFloat(getComputedStyle(source).paddingTop)||17;
  const lineSpacing=lineHeight*virtualHeight/scrollHeight;
  const first=Math.max(0,editorIndexAtVisualRow(editorLineLayout?.offsets||[],(mapOffset*scrollHeight/virtualHeight-topPad)/lineHeight)-2);
  const last=Math.min(visibleScan.items.length,editorIndexAtVisualRow(editorLineLayout?.offsets||[],((mapOffset+height)*scrollHeight/virtualHeight-topPad)/lineHeight)+3);
  for(let i=first;i<last;i++){
    const it=visibleScan.items[i],raw=it.raw;
    if(!raw.trim())continue;
    const y=((topPad+(editorLineLayout?.offsets[i]??i)*lineHeight)*virtualHeight/scrollHeight)-mapOffset;
    if(y< -8||y>height+8)continue;
    const leading=(raw.match(/^\s*/)||[''])[0].replace(/\t/g,'  ').length;
    const x=4+Math.min(leading,36)*.83;
    const len=Math.max(2,Math.min(width-x-5,raw.trimEnd().length*.95));
    if(len<=0)continue;
    const color=it.kind==='heading'?'#aa99f5':it.kind==='list'?'#63bbc4':it.kind==='fence'?'#9c78bf':it.kind==='code'?'#61748e':it.kind==='quote'?'#75aa92':it.kind==='table'?'#829ec5':'#647891';
    ctx.fillStyle=color;ctx.globalAlpha=it.kind==='description'?.55:.82;
    ctx.fillRect(x,y,len,Math.min(3.2,Math.max(1.6,lineSpacing*.5)));
    if(it.kind==='heading'||it.kind==='list'){
      const status=raw.match(/\[status:(done|doing|todo|review|story)\]/i);
      const check=raw.match(/\[[ xX]\]/);
      if(status||check){ctx.fillStyle=status?statusColor(status[1].toLowerCase()):check?.[0].toLowerCase()==='[x]'?statusColor('done'):statusColor('story');ctx.globalAlpha=1;ctx.fillRect(Math.min(width-7,x+len*.38),y,Math.min(13,len*.25),Math.min(3.2,Math.max(1.6,lineSpacing*.5)))}
    }
    if(it.kind==='heading'&&it.level===1&&visibleScan.roots[0]!==i){ctx.fillStyle='#fc8090';ctx.globalAlpha=1;ctx.fillRect(0,y,3,4)}
  }
  ctx.globalAlpha=1;
  const rawThumb=source.clientHeight/scrollHeight*virtualHeight;
  const thumbHeight=Math.max(20,Math.min(height,rawThumb));
  const thumbY=ratio*Math.max(0,height-thumbHeight);
  target.style.height=thumbHeight+'px';target.style.transform=`translateY(${thumbY}px)`;
  map.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
  map.setAttribute('aria-valuetext',`${Math.round(ratio*100)} % des Dokuments`);
  miniGeometry={width,height,thumbY,thumbHeight,maxScroll,mapOffset,virtualHeight};
}
function wireMinimap(){
  const map=$('#minimap'),source=$('#source');let drag=null;
  function jump(y){
    const g=miniGeometry;if(!g)return;
    const ratio=Math.max(0,Math.min(1,(y-g.thumbHeight/2)/Math.max(1,g.height-g.thumbHeight)));
    source.scrollTop=g.maxScroll*ratio;
    syncCodeScroll();
  }
  map.onpointerdown=e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    e.preventDefault();map.focus({preventScroll:true});drawMinimap();
    let g=miniGeometry;if(!g)return;
    const y=e.clientY-map.getBoundingClientRect().top;
    if(y<g.thumbY||y>g.thumbY+g.thumbHeight)jump(y);
    drag={pointer:e.pointerId,startY:e.clientY,startScroll:source.scrollTop};
    map.setPointerCapture(e.pointerId);
  };
  map.onpointermove=e=>{
    if(!drag||drag.pointer!==e.pointerId)return;
    const g=miniGeometry;if(!g)return;
    const travel=Math.max(1,g.height-g.thumbHeight);
    source.scrollTop=Math.max(0,Math.min(g.maxScroll,drag.startScroll+(e.clientY-drag.startY)*g.maxScroll/travel));
    syncCodeScroll();
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
    e.preventDefault();syncCodeScroll();
  };
  map.onwheel=e=>{e.preventDefault();source.scrollTop+=e.deltaY;source.scrollLeft+=e.deltaX;syncCodeScroll()};
}
function focusRootProblem(){
  const source=$('#source');if(!source||!editorScan||editorScan.valid)return;
  const line=editorScan.roots[1]??0;
  const start=editorScan.lines.slice(0,line).reduce((s,x)=>s+x.length+1,0);
  codeFoldRevealOffset(source,start);
  source.focus();source.setSelectionRange(start,start+editorScan.lines[line].length);
  const lineHeight=parseFloat(getComputedStyle(source).lineHeight)||23;
  source.scrollTop=Math.max(0,line*lineHeight-source.clientHeight/3);
  syncCodeScroll();
}


// Completion data never changes the underlying Markdown until the user selects an item.
