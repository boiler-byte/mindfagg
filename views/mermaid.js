'use strict';
/* mindfagg v52: local Mermaid diagram preview, shared script editor diagnostics.
 * Rendered SVG remains inert: it is displayed only as an image (blob URL).
 * Never insert user-supplied Mermaid output into the live document as HTML. */
const MERMAID_MAX_TEXT=120000;
let mermaidEnginePromise=null,mermaidPreviewSequence=0,mermaidRenderSequence=0;

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
  const text=document.createElement('div');
  text.className='mermaid-preview-message'+(invalid?' is-invalid':'');
  text.textContent=message;stage.appendChild(text);
}
async function renderMermaidPreview(){
  const doc=documentNow(),code=String(doc?.content??''),sequence=++mermaidPreviewSequence;
  $('#surface').innerHTML=`<div class="mermaid-preview">
    <div class="mermaid-preview-toolbar"><span class="mermaid-preview-name">${escapeHtml(fileLabel(doc))}</span>
      <span class="mermaid-preview-type">Mermaid</span>
      <button class="btn" type="button" id="mermaidEditSource">Im Script-Editor bearbeiten</button></div>
    <div class="mermaid-preview-scroll"><div id="mermaidPreviewStage" class="mermaid-preview-stage" role="status" aria-live="polite"></div></div>
    <div class="script-validation-bar mermaid-preview-diagnostics" id="mermaidPreviewDiagnostics" role="status" aria-live="polite"></div>
  </div>`;
  const stage=$('#mermaidPreviewStage');
  $('#mermaidEditSource').onclick=()=>mermaidOpenSource(null);
  const live=()=>stage.isConnected&&sequence===mermaidPreviewSequence&&
    documentNow()?.id===doc.id&&activeFilePanel==='preview';
  if(!code.trim()){
    mermaidPreviewMessage('Das Mermaid-Diagramm ist leer. Im Script-Editor Quelltext eingeben.');return;
  }
  mermaidPreviewMessage('Mermaid-Diagramm wird gerendert …');
  const errors=await mermaidValidateSyntax(code);
  if(!live())return;
  if(errors.length){
    mermaidPreviewMessage('Das Diagramm enthält Syntaxfehler. Im Script-Editor korrigieren.',true);
    mermaidPreviewDiagnostics(errors);return;
  }
  try{
    const engine=await loadMermaidEngine();
    const {svg}=await engine.render('mindfagg-mermaid-'+(++mermaidRenderSequence),code);
    if(!live())return;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    releaseWorkspacePreview();workspacePreviewURL=url;
    stage.replaceChildren();
    const image=document.createElement('img');
    image.className='mermaid-preview-image';image.alt='Mermaid-Diagramm: '+fileLabel(doc);
    image.src=url;
    image.onerror=()=>{if(image.isConnected)mermaidPreviewMessage('Mermaid-SVG konnte nicht angezeigt werden.',true)};
    stage.appendChild(image);mermaidPreviewDiagnostics([]);
  }catch(error){
    if(!live())return;
    mermaidPreviewMessage('Diagramm konnte nicht gerendert werden.',true);
    mermaidPreviewDiagnostics([mermaidErrorDiagnostic(code,error)]);
  }
}
