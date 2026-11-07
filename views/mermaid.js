'use strict';
/* mindfagg v53: local Mermaid diagram preview, shared script editor diagnostics.
 * Rendered SVG remains inert: it is displayed only as an image (blob URL).
 * Never insert user-supplied Mermaid output into the live document as HTML. */
const MERMAID_MAX_TEXT=120000;
let mermaidEnginePromise=null,mermaidPreviewSequence=0,mermaidRenderSequence=0;
const mermaidSessionViews=new Map();
let mermaidPreviewState=null;

function isMermaidFile(doc){
  return fileKind(doc)==='script'&&['mmd','mermaid'].includes(pathExtension(workspacePath(doc)));
}
function loadMermaidEngine(){
  if(!mermaidEnginePromise){
    mermaidEnginePromise=import(new URL('vendor/mermaid/mermaid-entry.js',document.baseURI).href)
      .then(({default:engine})=>{
        if(typeof engine?.parse!=='function'||typeof engine?.render!=='function')throw Error('Mermaid-Renderer nicht verfügbar');
        engine.initialize({
          startOnLoad:false,securityLevel:'strict',theme:'dark',maxTextSize:MERMAID_MAX_TEXT,
          flowchart:{htmlLabels:false},fontFamily:'ui-sans-serif, system-ui, sans-serif',
          themeVariables:{background:'#141d2b',primaryColor:'#302d49',primaryTextColor:'#f4f1ff',
            primaryBorderColor:'#9487ca',lineColor:'#9cadd0',secondaryColor:'#1d3a46',tertiaryColor:'#1b293c'}
        });
        return engine;
      }).catch(error=>{mermaidEnginePromise=null;throw error});
  }
  return mermaidEnginePromise;
}
function mermaidErrorDiagnostic(source,error){
  const text=String(source??''),raw=String(error?.message||error||'Ungültige Mermaid-Syntax');
  const loc=error?.hash?.loc||error?.location||{};
  const match=/\bline\s+(\d+)/i.exec(raw);
  const line=Math.max(1,Number(loc.first_line??loc.start?.line??error?.line??match?.[1]??1)||1);
  const column=Math.max(1,Number(loc.first_column??loc.start?.column??error?.column??1)||1);
  const lines=text.split(/\r\n?|\n/),lineIndex=Math.min(lines.length-1,line-1);
  const offset=lines.slice(0,lineIndex).reduce((sum,item)=>sum+item.length+1,0)
    +Math.min(column-1,lines[lineIndex]?.length||0);
  const message=raw.replace(/\s+/g,' ').trim().slice(0,300)||'Ungültige Mermaid-Syntax';
  return codeDiagnostic(text,offset,'Mermaid: '+message);
}
async function mermaidValidateSyntax(source){
  const code=String(source??'');
  if(!code.trim())return [];
  if(code.length>MERMAID_MAX_TEXT)
    return [codeDiagnostic(code,0,'Mermaid: Diagramm überschreitet die zulässige Größe.')];
  try{
    const result=await(await loadMermaidEngine()).parse(code,{suppressErrors:false});
    return result===false?[codeDiagnostic(code,0,'Mermaid: Syntax konnte nicht gelesen werden.')]:[];
  }catch(error){return [mermaidErrorDiagnostic(code,error)];}
}
function mermaidOpenSource(error){
  activeFilePanel='script';render();
  requestAnimationFrame(()=>{
    if(error)scriptFocusDiagnostic(error);
    else $('#scriptSource')?.focus({preventScroll:true});
  });
}
function mermaidPreviewDiagnostics(errors){
  const bar=$('#mermaidPreviewDiagnostics');if(!bar)return;
  bar.replaceChildren();
  const label=document.createElement('span');
  label.className='script-validation-label '+(errors.length?'is-invalid':'is-valid');
  label.textContent=errors.length?'Mermaid: '+errors.length+' Fehler':'Mermaid: keine Syntaxfehler erkannt.';
  bar.appendChild(label);
  for(const error of errors.slice(0,4)){
    const button=document.createElement('button');button.type='button';button.className='script-diagnostic-link';
    button.textContent='Zeile '+error.line+':'+error.column+' – '+error.message;
    button.title='Fehler im Script-Editor anzeigen';
    button.onclick=()=>mermaidOpenSource(error);bar.appendChild(button);
  }
}
function mermaidPreviewMessage(message,invalid=false){
  const stage=$('#mermaidPreviewStage');if(!stage)return;
  stage.replaceChildren();
  stage.classList.add('is-message');
  stage.style.width='100%';stage.style.height='100%';stage.style.transform='none';
  const text=document.createElement('div');
  text.className='mermaid-preview-message'+(invalid?' is-invalid':'');
  text.textContent=message;stage.appendChild(text);
}
// Store pan/zoom per file only while its Mermaid source stays identical.
function mermaidSourceKey(code){
  let hash=2166136261;
  for(let i=0;i<code.length;i++)hash=Math.imul(hash^code.charCodeAt(i),16777619);
  return code.length+':'+(hash>>>0).toString(16);
}
function mermaidSvgSize(svg,image){
  const tag=String(svg).match(/<svg\b[^>]*>/i)?.[0]||'';
  const value=/\bviewBox\s*=\s*(['"])(.*?)\1/i.exec(tag)?.[2];
  const parts=value?.trim().split(/[\s,]+/).map(Number);
  const valid=parts?.length===4&&parts.every(Number.isFinite)&&parts[2]>0&&parts[3]>0;
  return {width:valid?parts[2]:image.naturalWidth||300,
    height:valid?parts[3]:image.naturalHeight||150};
}
function mermaidApplyView(state){
  state.stage.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.scale})`;
  mermaidSessionViews.set(state.docId,{sourceKey:state.sourceKey,
    panX:state.panX,panY:state.panY,scale:state.scale,userMoved:state.userMoved});
}
function mermaidFitView(state){
  const width=state.viewport.clientWidth,height=state.viewport.clientHeight;
  const padding=width<650?18:36;
  state.scale=clamp(Math.min(1.2,(width-2*padding)/state.width,(height-2*padding)/state.height),.025,8);
  state.panX=(width-state.width*state.scale)/2;
  state.panY=(height-state.height*state.scale)/2;
  state.userMoved=false;
  mermaidApplyView(state);
}
function mermaidZoomAt(state,requested,clientX,clientY){
  const rect=state.viewport.getBoundingClientRect();
  const x=clientX-rect.left,y=clientY-rect.top;
  const worldX=(x-state.panX)/state.scale,worldY=(y-state.panY)/state.scale;
  state.scale=clamp(requested,.025,8);
  state.panX=x-worldX*state.scale;
  state.panY=y-worldY*state.scale;
  state.userMoved=true;
  mermaidApplyView(state);
}
function wireMermaidGestures(state){
  const {viewport}=state,pointers=new Map();
  let gesture=null;
  const pinchStart=()=>{
    const [a,b]=[...pointers.values()];
    if(!a||!b)return;
    const rect=viewport.getBoundingClientRect();
    const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;
    gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),
      scale:state.scale,worldX:(x-state.panX)/state.scale,worldY:(y-state.panY)/state.scale};
  };
  viewport.onpointerdown=event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    try{viewport.setPointerCapture(event.pointerId)}catch(_){}
    if(pointers.size===1){gesture={kind:'pan',startX:event.clientX,startY:event.clientY,
      panX:state.panX,panY:state.panY};viewport.classList.add('is-panning')}
    else if(pointers.size===2){viewport.classList.remove('is-panning');pinchStart()}
    event.preventDefault();
  };
  viewport.onpointermove=event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2&&gesture?.kind==='pinch'){
      const [a,b]=[...pointers.values()],rect=viewport.getBoundingClientRect();
      const x=(a.x+b.x)/2-rect.left,y=(a.y+b.y)/2-rect.top;
      state.scale=clamp(gesture.scale*Math.hypot(a.x-b.x,a.y-b.y)/gesture.distance,.025,8);
      state.panX=x-gesture.worldX*state.scale;
      state.panY=y-gesture.worldY*state.scale;
      state.userMoved=true;mermaidApplyView(state);
    }else if(pointers.size===1&&gesture?.kind==='pan'){
      state.panX=gesture.panX+event.clientX-gesture.startX;
      state.panY=gesture.panY+event.clientY-gesture.startY;
      if(Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY)>2)
        state.userMoved=true;
      mermaidApplyView(state);
    }
    event.preventDefault();
  };
  const pointerEnd=event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.delete(event.pointerId);
    if(pointers.size===1){
      const remaining=[...pointers.values()][0];
      gesture={kind:'pan',startX:remaining.x,startY:remaining.y,
        panX:state.panX,panY:state.panY};viewport.classList.add('is-panning');
    }else if(pointers.size>=2)pinchStart();
    else{gesture=null;viewport.classList.remove('is-panning')}
  };
  viewport.onpointerup=pointerEnd;
  viewport.onpointercancel=pointerEnd;
  viewport.onlostpointercapture=pointerEnd;
  viewport.addEventListener('wheel',event=>{
    event.preventDefault();
    if(event.shiftKey&&!event.ctrlKey&&!event.metaKey){
      state.panX-=event.deltaY;state.panY-=event.deltaX;
      state.userMoved=true;mermaidApplyView(state);return;
    }
    const delta=event.deltaY*(event.deltaMode===1?18:event.deltaMode===2?viewport.clientHeight:1);
    mermaidZoomAt(state,state.scale*Math.exp(-clamp(delta,-400,400)*(event.ctrlKey||event.metaKey?.004:.0018)),event.clientX,event.clientY);
  },{passive:false});
  viewport.onkeydown=event=>{
    if(event.target!==viewport)return;
    if(event.key==='0'){mermaidFitView(state);event.preventDefault()}
    else if(event.key==='+'||event.key==='='||event.key==='-'){
      const rect=viewport.getBoundingClientRect();
      mermaidZoomAt(state,state.scale*(event.key==='-'?1/1.25:1.25),
        rect.left+rect.width/2,rect.top+rect.height/2);event.preventDefault();
    }else if(event.key.startsWith('Arrow')){
      if(event.key==='ArrowLeft')state.panX+=60;
      if(event.key==='ArrowRight')state.panX-=60;
      if(event.key==='ArrowUp')state.panY+=60;
      if(event.key==='ArrowDown')state.panY-=60;
      state.userMoved=true;mermaidApplyView(state);event.preventDefault();
    }
  };
}
async function renderMermaidPreview(){
  mermaidPreviewState?.resizeObserver?.disconnect();mermaidPreviewState=null;
  const doc=documentNow(),code=String(doc?.content??''),sequence=++mermaidPreviewSequence;
  $('#surface').innerHTML=`<div class="mermaid-preview">
    <div class="mermaid-preview-viewport" id="mermaidPreviewViewport" tabindex="0"
      aria-label="Mermaid-Diagramm: ziehen zum Verschieben, Mausrad oder zwei Finger zum Zoomen, Taste 0 zum Einpassen">
      <div id="mermaidPreviewStage" class="mermaid-preview-stage" role="status" aria-live="polite"></div>
    </div>
    <button type="button" class="mermaid-fit-button" id="mermaidFit" title="Diagramm zentrieren und einpassen" aria-label="Diagramm zentrieren und einpassen" disabled>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/></svg>
    </button>
    <div class="script-validation-bar mermaid-preview-diagnostics" id="mermaidPreviewDiagnostics" role="status" aria-live="polite"></div>
  </div>`;
  const stage=$('#mermaidPreviewStage'),viewport=$('#mermaidPreviewViewport');
  const live=()=>stage.isConnected&&sequence===mermaidPreviewSequence&&
    documentNow()?.id===doc.id&&activeFilePanel==='preview';
  if(!code.trim()){
    mermaidPreviewMessage('Das Mermaid-Diagramm ist leer. Im Script-Editor Quelltext eingeben.');return;
  }
  mermaidPreviewMessage('Mermaid-Diagramm wird gerendert \u2026');
  const errors=await mermaidValidateSyntax(code);
  if(!live())return;
  if(errors.length){
    mermaidPreviewMessage('Das Diagramm enth\u00e4lt Syntaxfehler. Im Script-Editor korrigieren.',true);
    mermaidPreviewDiagnostics(errors);return;
  }
  try{
    const engine=await loadMermaidEngine();
    const {svg}=await engine.render('mindfagg-mermaid-'+(++mermaidRenderSequence),code);
    if(!live())return;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    releaseWorkspacePreview();workspacePreviewURL=url;
    const image=document.createElement('img');
    image.className='mermaid-preview-image';image.alt='Mermaid-Diagramm: '+fileLabel(doc);
    image.draggable=false;
    image.onload=()=>{
      if(!live())return;
      const {width,height}=mermaidSvgSize(svg,image);
      const state={docId:doc.id,sourceKey:mermaidSourceKey(code),viewport,stage,
        width,height,scale:1,panX:0,panY:0,userMoved:false,resizeObserver:null};
      mermaidPreviewState=state;
      const fitButton=$('#mermaidFit');
      if(fitButton){fitButton.disabled=false;fitButton.onclick=()=>mermaidFitView(state)}
      stage.classList.remove('is-message');
      stage.style.width=width+'px';stage.style.height=height+'px';
      wireMermaidGestures(state);
      const remembered=mermaidSessionViews.get(doc.id);
      if(remembered?.sourceKey===state.sourceKey){
        Object.assign(state,{panX:remembered.panX,panY:remembered.panY,
          scale:remembered.scale,userMoved:remembered.userMoved});
        mermaidApplyView(state);
      }else mermaidFitView(state);
      if(typeof ResizeObserver!=='undefined'){
        const observer=new ResizeObserver(()=>{
          if(!viewport.isConnected){observer.disconnect();return}
          if(mermaidPreviewState===state&&!state.userMoved)mermaidFitView(state);
        });
        observer.observe(viewport);state.resizeObserver=observer;
      }
    };
    image.onerror=()=>{if(live())mermaidPreviewMessage('Mermaid-SVG konnte nicht angezeigt werden.',true)};
    stage.replaceChildren(image);image.src=url;
    mermaidPreviewDiagnostics([]);
  }catch(error){
    if(!live())return;
    mermaidPreviewMessage('Diagramm konnte nicht gerendert werden.',true);
    mermaidPreviewDiagnostics([mermaidErrorDiagnostic(code,error)]);
  }
}
