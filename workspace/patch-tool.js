'use strict';
// v46: validated ordered operations, collapsible patch summary, contextual validation.
// Patches are data only; changes and the optional .patch.json log form ONE undoable batch.
const PATCH_TOOL_MAX_BYTES=4*1024*1024;
const PATCH_TOOL_MAX_HUNKS=500;
const PATCH_TOOL_OPERATIONS=new Set(['create','update','replace','delete','rename']);
const PATCH_TOOL_PROMPT=[
  'Gib die gewünschten Datei-Änderungen ausschließlich als gültiges JSON aus: kein Markdown-Codeblock, keine Erklärung.',
  'Das Wurzelobjekt hat exakt einen Schlüssel: "patches" (nichtleeres Array).',
  'Jeder Eintrag benötigt "operation" und "file"; "description" ist ein optionaler, kurzer Text.',
  'Erlaubte Operationen und ihre Felder (keine anderen Schlüssel):',
  '- "create": {"operation":"create","file":"src/neu.js","content":"const x = 1;"} – neue Textdatei; darf nicht existieren.',
  '- "update": {"operation":"update","file":"index.html","description":"Titel","hunks":[{"search":"<h1>Alt</h1>","replace":"<h1>Neu</h1>","occurrence":1}]} – bestehende Textdatei gezielt ändern.',
  '- "replace": {"operation":"replace","file":"src/app.js","content":"vollständiger neuer Dateiinhalt"} – bestehende Textdatei komplett ersetzen.',
  '- "delete": {"operation":"delete","file":"src/alt.js"} – vorhandene Datei löschen.',
  '- "rename": {"operation":"rename","file":"src/alt.js","to":"src/neu.js"} – vorhandene Datei umbenennen oder verschieben.',
  'Pfadnamen sind exakt, projekt-relativ und verwenden /; keine absoluten Pfade, .. oder Datei-/Ordnerkollisionen.',
  'Bei "update" muss "hunks" ein nichtleeres Array sein. Jeder Hunk hat exakt "search", "replace" und "occurrence".',
  '"search" ist ein nichtleerer, wortwörtlicher Text inkl. Einrückung/Zeilenumbrüchen; keine Regex. "replace" darf leer sein.',
  '"occurrence" ist der 1-basierte, nicht überlappende Treffer. Alle ausgewählten Vorgänge laufen in JSON-Reihenfolge auf dem jeweils aktuellen Dateistand.',
  '"content" ist immer ein String und darf leer sein. Nur Textdateien können erstellt oder inhaltlich geändert werden; Umbenennen/Löschen funktioniert auch für binäre Dateien.',
  'Escape JSON-Zeichen korrekt (insbesondere Anführungszeichen, Backslashes und Zeilenumbrüche als \\n).',
  'Niemals Quelltext erfinden: Falls Originalinhalt für ein exaktes update fehlt, zuerst die betreffende Datei anfordern.'
].join('\n');
let patchToolState=null;

function patchToolExactKeys(obj,expected,location){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).length!==expected.length||expected.some(key=>!Object.hasOwn(obj,key))){
    throw Error(location+': erforderliche Felder: '+expected.join(', '));
  }
}
function patchToolAllowedKeys(obj,required,optional,location){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||required.some(k=>!Object.hasOwn(obj,k))||Object.keys(obj).some(k=>!required.includes(k)&&!optional.includes(k))){
    throw Error(location+': erforderliche Felder: '+required.join(', ')+(optional.length?'; optional: '+optional.join(', '):''));
  }
}
function patchToolCheckPath(path,label){
  if(typeof path!=='string'||!workspaceValidPath(path)||workspaceValidPath(path)!==path){
    throw Error(label+': ungültiger relativer Dateipfad.');
  }
}
function patchToolOperation(entry){return Object.hasOwn(entry,'operation')?entry.operation:'update'}
function parseWorkspacePatch(source){
  if(typeof source!=='string'||!source.trim())throw Error('Bitte einen JSON-Patch einfügen.');
  if(new TextEncoder().encode(source).length>PATCH_TOOL_MAX_BYTES)throw Error('Der Patch ist zu groß (maximal 4 MB).');
  let value;
  try{value=JSON.parse(source.replace(/^\uFEFF/,''))}
  catch(error){throw Error('Ungültiges JSON: '+error.message)}
  patchToolExactKeys(value,['patches'],'Patch');
  if(!Array.isArray(value.patches)||!value.patches.length)throw Error('patches muss eine nichtleere Liste sein.');
  if(value.patches.length>PATCH_TOOL_MAX_HUNKS)throw Error('Zu viele Dateioperationen im Patch.');
  let total=0;
  for(let i=0;i<value.patches.length;i++){
    const entry=value.patches[i],key='patches['+i+']';
    // Backward compatibility: v44 entries without operation mean update;
    // their previously mandatory description is still required.
    const legacy=entry&&typeof entry==='object'&&!Array.isArray(entry)&&!Object.hasOwn(entry,'operation');
    const op=patchToolOperation(entry||{});
    if(!PATCH_TOOL_OPERATIONS.has(op))throw Error(key+': unbekannte operation.');
    const required=legacy?['file','description','hunks']:['operation','file'];
    if(op==='update'&&!legacy)required.push('hunks');
    if(op==='create'||op==='replace')required.push('content');
    if(op==='rename')required.push('to');
    patchToolAllowedKeys(entry,required,legacy?[]:['description'],key);
    patchToolCheckPath(entry.file,key+'.file');
    if(!legacy&&typeof entry.operation!=='string')throw Error(key+': operation muss ein Text sein.');
    if(Object.hasOwn(entry,'description')&&(typeof entry.description!=='string'||!entry.description.trim())){
      throw Error(key+': description muss ein nichtleerer Text sein.');
    }
    if(op==='update'){
      if(!Array.isArray(entry.hunks)||!entry.hunks.length)throw Error(key+': hunks muss eine nichtleere Liste sein.');
      total+=entry.hunks.length;
      for(let j=0;j<entry.hunks.length;j++){
        const h=entry.hunks[j],at=key+'.hunks['+j+']';
        patchToolExactKeys(h,['search','replace','occurrence'],at);
        if(typeof h.search!=='string'||!h.search.length)throw Error(at+': search darf nicht leer sein.');
        if(typeof h.replace!=='string')throw Error(at+': replace muss ein Text sein (darf leer sein).');
        if(!Number.isSafeInteger(h.occurrence)||h.occurrence<1)throw Error(at+': occurrence muss eine positive ganze Zahl sein.');
      }
    }else{
      total++;
      if((op==='create'||op==='replace')&&typeof entry.content!=='string')throw Error(key+': content muss ein Text sein (darf leer sein).');
      if(op==='rename')patchToolCheckPath(entry.to,key+'.to');
    }
    if(total>PATCH_TOOL_MAX_HUNKS)throw Error('Maximal 500 ausgewählbare Vorgänge erlaubt.');
  }
  return value;
}
function patchToolNthOffset(content,search,n){
  let start=0;
  for(let i=0;i<n;i++){
    const at=content.indexOf(search,start);
    if(at<0)return -1;
    if(i===n-1)return at;
    start=at+search.length;
  }
  return -1;
}
function patchToolOperationId(i,j){return i+':'+j}
function patchToolSelectionIds(entry,i){
  return patchToolOperation(entry)==='update'?entry.hunks.map((_,j)=>patchToolOperationId(i,j)):[patchToolOperationId(i,0)];
}
function patchToolSelectedPatch(patch,selected){
  return {patches:patch.patches.flatMap((entry,i)=>{
    const op=patchToolOperation(entry);
    if(op==='update'){
      const hunks=entry.hunks.filter((_,j)=>selected.has(patchToolOperationId(i,j)));
      return hunks.length?[{...entry,operation:'update',hunks}]:[];
    }
    return selected.has(patchToolOperationId(i,0))?[{...entry}]:[];
  })};
}
function patchToolCanonical(path){return path.toLocaleLowerCase('de')}
function patchToolParents(path){
  const parts=path.split('/'),out=[];
  for(let i=1;i<parts.length;i++)out.push(parts.slice(0,i).join('/'));
  return out;
}
// Evaluate each selected operation on a virtual filesystem. No real record is
// mutated until EVERY selected operation has passed validation and one IDB
// transaction commits all resulting changes/deletions/folders.
function planWorkspacePatch(patch,selected,whichProject=projectId){
  const originals=docs.filter(d=>d.projectId===whichProject);
  const projectData=(typeof projects!=='undefined'?projects.find(p=>p.id===whichProject):null)||{folders:[]};
  const files=new Map(originals.map(d=>[patchToolCanonical(workspacePath(d)),{...d}]));
  const folders=new Map();
  const additions=new Map();
  function rememberFolder(path){for(const parent of [...patchToolParents(path+'/file'),path])if(parent)folders.set(patchToolCanonical(parent),parent)}
  for(const folder of projectData.folders||[]){if(workspaceValidPath(folder))rememberFolder(folder)}
  for(const d of originals)for(const part of patchToolParents(workspacePath(d)))folders.set(patchToolCanonical(part),part);
  const operations=[];let errors=0,count=0;
  const fail=(row,message)=>{row.ok=false;row.message=message;errors++};
  function canPlace(path,excludeId=null){
    const key=patchToolCanonical(path),old=files.get(key);
    if(old&&old.id!==excludeId)return 'Zieldatei existiert bereits.';
    if(folders.has(key))return 'Zielpfad ist bereits ein Ordner.';
    for(const parent of patchToolParents(path))if(files.has(patchToolCanonical(parent)))return 'Eine Datei blockiert den Zielordner: '+parent;
    return '';
  }
  for(let i=0;i<patch.patches.length;i++){
    const entry=patch.patches[i],op=patchToolOperation(entry),ids=patchToolSelectionIds(entry,i);
    for(let j=0;j<ids.length;j++){
      const id=ids[j],checked=selected.has(id),row={id,operation:op,file:entry.file,to:entry.to||'',description:entry.description||'',number:j+1,checked,ok:true,message:'',before:''};
      if(!checked){row.message='Abgewählt';operations.push(row);continue}
      count++;
      const fromKey=patchToolCanonical(entry.file),file=files.get(fromKey);
      if(op==='update'||op==='replace'){
        if(!file)fail(row,'Datei ist im Projekt nicht vorhanden.');
        else if(!docIsText(file))fail(row,'Datei ist nicht als Text editierbar.');
        else{
          const before=String(file.content??'');row.before=before;
          if(op==='update'){
            const hunk=entry.hunks[j],at=patchToolNthOffset(before,hunk.search,hunk.occurrence);
            if(at<0)fail(row,'Suchtext / Treffer '+hunk.occurrence+' nicht gefunden.');
            else{
              files.set(fromKey,{...file,content:before.slice(0,at)+hunk.replace+before.slice(at+hunk.search.length)});
              row.message='Treffer '+hunk.occurrence+' gefunden';
            }
          }else{
            files.set(fromKey,{...file,content:entry.content,...(fileKind(file)==='markdown'?{preserveSource:true}:{})});
            row.message='Gesamter Inhalt wird ersetzt.';
          }
        }
      }else if(op==='create'){
        const collision=canPlace(entry.file);
        if(collision)fail(row,collision);
        else if(!isMarkdownPath(entry.file)&&!knownTextPath(entry.file))fail(row,'Nur Textdateien können per Patch erstellt werden.');
        else{
          const md=isMarkdownPath(entry.file);
          files.set(fromKey,{id:uid(),projectId:whichProject,path:entry.file,name:docNameForPath(entry.file),
            fileType:md?'markdown':'script',content:entry.content,...(md?{preserveSource:true}:{} )});
          for(const parent of patchToolParents(entry.file)){
            const key=patchToolCanonical(parent);
            if(!folders.has(key)){folders.set(key,parent);additions.set(key,parent)}
          }
          row.message='Neue Textdatei wird angelegt.';
        }
      }else if(op==='delete'){
        if(!file)fail(row,'Datei ist im Projekt nicht vorhanden.');
        else{row.before=docIsText(file)?String(file.content??''):'';files.delete(fromKey);row.message='Datei wird gelöscht.'}
      }else if(op==='rename'){
        if(!file)fail(row,'Datei ist im Projekt nicht vorhanden.');
        else{
          const toKey=patchToolCanonical(entry.to),collision=canPlace(entry.to,file.id);
          if(collision)fail(row,collision);
          else{
            const wasText=docIsText(file);
            const moved={...file,path:entry.to,name:docNameForPath(entry.to),
              ...(wasText?{fileType:isMarkdownPath(entry.to)?'markdown':'script'}:{})};
            files.delete(fromKey);files.set(toKey,moved);
            for(const parent of patchToolParents(entry.to)){
              const key=patchToolCanonical(parent);
              if(!folders.has(key)){folders.set(key,parent);additions.set(key,parent)}
            }
            row.message=entry.file===entry.to?'Unveränderter Pfad.':'Zieldateiname verfügbar.';
          }
        }
      }
      operations.push(row);
    }
  }
  const finalById=new Map([...files.values()].map(d=>[d.id,d]));
  const oldById=new Map(originals.map(d=>[d.id,d]));
  const changes=[...finalById].flatMap(([id,d])=>{
    const before=oldById.get(id);
    return !before||before.path!==d.path||before.name!==d.name||before.fileType!==d.fileType||before.content!==d.content||before.preserveSource!==d.preserveSource?[d]:[];
  });
  const deletedIds=originals.filter(d=>!finalById.has(d.id)).map(d=>d.id);
  const foldersAfter=[...new Set([...(projectData.folders||[]),...additions.values()])];
  return {operations,errors,count,changes,deletedIds,folders:foldersAfter,
    affected:changes.length+deletedIds.length,finalFiles:[...files.values()]};
}
function patchToolTimestamp(now=new Date()){
  const pad=(n,size=2)=>String(n).padStart(size,'0');
  return pad(now.getFullYear(),4)+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'-'+
    pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds())+'.patch.json';
}
function patchToolSaveRecord(patch,selected,plan,whichProject=projectId,now=new Date()){
  const applied=patchToolSelectedPatch(patch,selected);
  const reserved=new Set(plan.finalFiles.map(doc=>patchToolCanonical(workspacePath(doc))));
  const folderNames=new Set(plan.folders.map(patchToolCanonical));
  for(const doc of plan.finalFiles)for(const parent of patchToolParents(workspacePath(doc)))folderNames.add(patchToolCanonical(parent));
  // Two invocations within one second must never overwrite a previous patch.
  for(let seconds=0;seconds<86400;seconds++){
    const date=new Date(now.getTime()+seconds*1000),path=patchToolTimestamp(date),key=patchToolCanonical(path);
    if(reserved.has(key)||folderNames.has(key))continue;
    return {id:uid(),projectId:whichProject,path,name:docNameForPath(path),fileType:'script',
      content:JSON.stringify(applied,null,2)+'\n'};
  }
  throw Error('Kein freier Dateiname für den gespeicherten Patch.');
}
function patchToolReject(message){
  if(patchToolState){patchToolState.patch=null;patchToolState.selected.clear()}
  $('#patchPreview')?.classList.add('hidden');
  if($('#patchApply'))$('#patchApply').disabled=true;
  patchToolMessage(message,'error');
}
function patchToolMessage(message,kind='info'){
  const target=$('#patchToolMessage');if(!target)return;
  target.replaceChildren();target.dataset.kind=kind;
  if(kind==='needs-validation'){
    const link=document.createElement('button');
    link.type='button';link.className='patch-validate-link';link.textContent=message;
    link.addEventListener('click',patchToolParseInput);
    target.appendChild(link);
  }else target.textContent=message;
}
function patchToolProjectOptions(){
  return docs.filter(d=>d.projectId===projectId&&/\.patch\.json$/i.test(workspacePath(d))&&docIsText(d))
    .sort((a,b)=>workspacePath(a).localeCompare(workspacePath(b),'de',{numeric:true}))
    .map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(workspacePath(d))}</option>`).join('');
}
function openPatchTool(){
  if(!projectId){toast('Bitte zuerst ein Projekt auswählen');return}
  patchToolState={projectId,patch:null,selected:new Set(),expanded:new Set(),applying:false};
  openModal(`<div id="patchTool" class="patch-tool">
    <h2>Patch-Tool</h2><p>Dateien erstellen, ändern, ersetzen, umbenennen und löschen. Alle ausgewählten Vorgänge vor dem Einspielen prüfen.</p>
    <section class="patch-section" aria-labelledby="patchApplyTitle">
      <h3 id="patchApplyTitle">Einspielen</h3>
      <div class="field"><label for="patchJsonInput">JSON-Patch einfügen</label>
        <textarea id="patchJsonInput" spellcheck="false" placeholder='{"patches":[{"operation":"update","file":"index.html","hunks":[{"search":"...","replace":"...","occurrence":1}]}]}'></textarea></div>
      <div class="patch-input-actions"><button type="button" class="btn" id="patchPasteClipboard">Aus Zwischenablage einfügen</button>
        <button type="button" class="btn" id="patchSelectFile">JSON-Datei auswählen</button></div>
      <input type="file" id="patchFileInput" class="hidden" accept=".json,application/json" aria-label="JSON-Patch-Datei auswählen">
      <div id="patchDropzone" class="patch-dropzone" role="group" aria-label="JSON-Patch-Datei ablegen" tabindex="0">.json-Datei hierher ziehen und ablegen</div>
      <div class="patch-project-select"><label for="patchProjectFile">Patch aus dem Projekt (.patch.json)</label>
        <div class="patch-project-controls"><select id="patchProjectFile"><option value="">Patch-Datei auswählen</option>${patchToolProjectOptions()}</select>
        <button type="button" class="btn" id="patchLoadProject">Laden</button></div></div>
      <div id="patchToolMessage" class="patch-message" data-kind="info" role="status" aria-live="polite">Noch kein Patch geladen.</div>
      <div id="patchPreview" class="patch-preview hidden" aria-label="Patch-Vorschau"></div>
      <div class="patch-action-row"><label class="patch-save-option" for="patchSave"><input type="checkbox" id="patchSave">Patch speichern</label>
        <button type="button" class="btn primary" id="patchApply" disabled>Ausgewählte Vorgänge einspielen</button></div>
      <small class="patch-save-note">Optional: Nach erfolgreicher Ausfuehrung im Projekt-Root unter YYYY-MM-DD-HHmmss.patch.json speichern. Gespeichert werden nur ausgewählte Vorgänge; ein Rückgängig stellt auch die Patch-Datei zurueck.</small>
    </section>
    <section class="patch-section patch-create" aria-labelledby="patchCreateTitle">
      <h3 id="patchCreateTitle">Erstellen</h3><p>Hänge diese Phrase an einen KI-Prompt an. Stelle der KI auch die betroffenen Originaldateien zur Verfuegung.</p>
      <pre id="patchPromptPhrase" class="patch-prompt"></pre>
      <button type="button" class="btn" id="patchCopyPrompt">Phrase kopieren</button>
    </section>
    <div class="modalactions"><button type="button" class="btn" id="patchClose">Schließen</button></div>
  </div>`);
  $('#modal').classList.add('patch-modal');
  $('#patchPromptPhrase').textContent=PATCH_TOOL_PROMPT;
  $('#patchClose').onclick=closeModal;
  $('#patchPasteClipboard').onclick=async()=>{
    try{
      if(!navigator.clipboard?.readText)throw Error('Zwischenablage-Zugriff nicht unterstuetzt');
      patchToolLoadText(await navigator.clipboard.readText());
    }catch(error){patchToolReject('Zwischenablage konnte nicht gelesen werden. JSON bitte manuell einfügen.')}
  };
  $('#patchJsonInput').addEventListener('input',()=>{
    if(patchToolState){patchToolState.patch=null;patchToolState.selected.clear()}
    $('#patchPreview').classList.add('hidden');$('#patchApply').disabled=true;
    patchToolMessage('Patch prüfen, um die Vorschau zu aktualisieren.','needs-validation');
  });
  $('#patchSelectFile').onclick=()=>$('#patchFileInput').click();
  $('#patchFileInput').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(file)await patchToolLoadFile(file);
  };
  $('#patchLoadProject').onclick=()=>{
    const d=docs.find(d=>d.id===$('#patchProjectFile').value&&d.projectId===projectId);
    if(!d||!/\.patch\.json$/i.test(workspacePath(d))||!docIsText(d))return patchToolReject('Bitte eine gültige .patch.json-Datei auswählen.');
    patchToolLoadText(d.content);
  };
  const drop=$('#patchDropzone');
  drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('#patchFileInput').click()}});
  drop.addEventListener('dragover',event=>{event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';drop.classList.add('drag-over')});
  drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('drag-over')});
  drop.addEventListener('drop',async event=>{
    event.preventDefault();event.stopPropagation();drop.classList.remove('drag-over');
    const files=[...event.dataTransfer.files];
    if(files.length!==1)return patchToolReject('Bitte genau eine .json-Datei ablegen.');
    await patchToolLoadFile(files[0]);
  });
  $('#patchCopyPrompt').onclick=async()=>{
    try{
      if(!navigator.clipboard?.writeText)throw Error('Keine Schreibberechtigung');
      await navigator.clipboard.writeText(PATCH_TOOL_PROMPT);toast('Phrase kopiert');
    }catch(error){patchToolMessage('Kopieren nicht möglich. Bitte die Phrase markieren und manuell kopieren.','error')}
  };
  $('#patchApply').onclick=()=>void patchToolApply();
}
function patchToolLoadText(text){
  if(!$('#patchJsonInput'))return;
  $('#patchJsonInput').value=text;
  patchToolParseInput();
}
async function patchToolLoadFile(file){
  try{
    if(!file||!/\.json$/i.test(file.name))throw Error('Nur .json-Dateien sind erlaubt.');
    if(file.size>PATCH_TOOL_MAX_BYTES)throw Error('Die Datei ist größer als 4 MB.');
    patchToolLoadText(await file.text());
  }catch(error){patchToolReject(error.message)}
}
function patchToolParseInput(){
  if(!patchToolState||!$('#patchJsonInput'))return;
  try{
    const value=parseWorkspacePatch($('#patchJsonInput').value);
    patchToolState.patch=value;patchToolState.selected=new Set();patchToolState.expanded=new Set();
    value.patches.forEach((entry,i)=>patchToolSelectionIds(entry,i).forEach(id=>patchToolState.selected.add(id)));
    patchToolRenderPreview();
  }catch(error){
    patchToolState.patch=null;patchToolState.selected.clear();
    $('#patchPreview').classList.add('hidden');$('#patchApply').disabled=true;
    patchToolMessage('Patch abgelehnt: '+error.message,'error');
  }
}
function patchToolPreviewText(value){
  const text=String(value??'');return escapeHtml(text.slice(0,2000))+(text.length>2000?'\n… (weitere '+(text.length-2000)+' Zeichen)':'');
}
function patchToolRenderPreview(){
  const state=patchToolState;
  if(!state?.patch||!$('#patchPreview'))return;
  const plan=planWorkspacePatch(state.patch,state.selected,state.projectId);
  // Match counts describe the *entire* authored patch, regardless of which
  // operations the user has unchecked. The Patch count is the active selection.
  const allIds=new Set(state.patch.patches.flatMap((entry,i)=>patchToolSelectionIds(entry,i)));
  const complete=planWorkspacePatch(state.patch,allIds,state.projectId);
  const status=new Map(plan.operations.map(row=>[row.id,row]));
  const detected=new Map(complete.operations.map(row=>[row.id,row]));
  const operationLabel={create:'Erstellen',update:'Aktualisieren',replace:'Ersetzen',delete:'Löschen',rename:'Umbenennen'};
  const markup=state.patch.patches.map((entry,i)=>{
    const op=patchToolOperation(entry),ids=patchToolSelectionIds(entry,i);
    const chosen=ids.filter(id=>state.selected.has(id)).length;
    const found=ids.filter(id=>detected.get(id)?.ok).length;
    const total=ids.length;
    const lines=ids.map((id,j)=>{
      const row=status.get(id),h=op==='update'?entry.hunks[j]:null;
      let detail='';
      if(h)detail=`<div class="patch-preview-diff"><div><small>search (Treffer ${h.occurrence})</small><pre>${patchToolPreviewText(h.search)}</pre></div><div><small>replace</small><pre>${h.replace?patchToolPreviewText(h.replace):'<em>(leerer Text)</em>'}</pre></div></div>`;
      else if(op==='create'||op==='replace')detail=`<div class="patch-preview-diff patch-preview-single"><div><small>${op==='create'?'Inhalt der neuen Datei':'Neuer vollständiger Inhalt'}</small><pre>${entry.content?patchToolPreviewText(entry.content):'<em>(leere Datei)</em>'}</pre></div></div>`;
      else if(op==='delete')detail='<p class="patch-operation-hint">Die Datei wird vollständig gelöscht (einschließlich Inhalt).</p>';
      else if(op==='rename')detail=`<p class="patch-operation-hint">${escapeHtml(entry.file)} → <strong>${escapeHtml(entry.to)}</strong></p>`;
      return `<div class="patch-preview-operation${row.ok?'':' patch-invalid'}">
        <label class="patch-operation-title"><input type="checkbox" data-patch-operation="${id}" ${row.checked?'checked':''}>
          <strong>${escapeHtml(operationLabel[op])}${h?' · Hunk '+(j+1):''}</strong><span class="patch-operation-status${row.ok?'':' is-error'}">${escapeHtml(row.message)}</span></label>${detail}</div>`;
    }).join('');
    return `<details class="patch-preview-file" data-patch-file="${i}" ${state.expanded.has(i)?'open':''}>
      <summary class="patch-preview-file-head">
        <span class="patch-preview-file-title"><strong>${escapeHtml(entry.file)}</strong>${op==='rename'?`<strong>→ ${escapeHtml(entry.to)}</strong>`:''}${entry.description?`<small>${escapeHtml(entry.description)}</small>`:''}</span>
        <span class="patch-preview-file-meta"><span class="patch-preview-operation-type">operation: ${escapeHtml(op)}</span><span class="patch-preview-file-counts" title="patch: ausgewählte Treffer / found: im vollständigen Patch gefundene Treffer / total: erwartete Treffer"><span class="patch-count-label">patch / found / total</span><strong>${chosen} / ${found} / ${total}</strong></span></span>
      </summary><div class="patch-preview-file-body">${lines}</div>
    </details>`;
  }).join('');
  $('#patchPreview').innerHTML=`<h4>Patch-Vorschau <span>${plan.count} ausgewählt / ${plan.operations.length} gesamt</span></h4>${markup}`;
  $('#patchPreview').classList.remove('hidden');
  $('#patchApply').disabled=plan.errors>0||!plan.count||!plan.affected||state.applying;
  patchToolMessage(plan.errors?plan.errors+' ausgewählte Vorgänge nicht anwendbar. Bitte Auswahl oder Patch korrigieren.':
    plan.count?(plan.affected?plan.count+' Vorgänge bereit, '+plan.affected+' Dateien betroffen.':'Alle ausgewählten Vorgänge erzeugen keine Änderung.'):'Kein Vorgang ausgewählt.',
    plan.errors?'error':'info');
  $('#patchPreview').querySelectorAll('[data-patch-file]').forEach(details=>{
    details.addEventListener('toggle',()=>{
      if(!details.isConnected||patchToolState!==state)return;
      const index=Number(details.dataset.patchFile);
      if(details.open)state.expanded.add(index);else state.expanded.delete(index);
    });
  });
  $('#patchPreview').querySelectorAll('[data-patch-operation]').forEach(box=>box.onchange=()=>{
    if(!patchToolState||patchToolState.applying)return;
    if(box.checked)state.selected.add(box.dataset.patchOperation);else state.selected.delete(box.dataset.patchOperation);
    // Record open state synchronously before rebuilding the DOM. This also
    // covers immediate changes before the asynchronous native toggle event.
    $('#patchPreview').querySelectorAll('[data-patch-file]').forEach(details=>{
      const index=Number(details.dataset.patchFile);
      if(details.open)state.expanded.add(index);else state.expanded.delete(index);
    });
    patchToolRenderPreview();
  });
}

async function patchToolApply(){
  const state=patchToolState;
  if(!state?.patch||state.applying||historyBusy||state.projectId!==projectId)return;
  state.applying=true;$('#patchApply').disabled=true;
  let failure='';
  try{
    await flushMapInlineEdit();await flushSource();
    if(state.projectId!==projectId)throw Error('Das aktuelle Projekt hat sich geändert.');
    const plan=planWorkspacePatch(state.patch,state.selected,state.projectId);
    if(plan.errors)throw Error('Mindestens ein ausgewählter Vorgang passt nicht mehr.');
    if(!plan.count||!plan.affected)throw Error('Keine Änderungen zum Einspielen ausgewählt.');
    const save=$('#patchSave')?.checked;
    const stored=save?patchToolSaveRecord(state.patch,state.selected,plan,state.projectId):null;
    historyBusy=true;updateHistoryButtons();
    await workspaceCommitChanges(stored?[...plan.changes,stored]:plan.changes,plan.deletedIds,plan.folders,docId);
    const count=plan.count,files=plan.affected;
    closeModal();render();toast('Patch eingespielt: '+count+' Vorgänge, '+files+' Dateien.'+(stored?' Gespeichert: '+stored.path+'.':'')+' Rückgängig möglich.');
  }catch(error){console.error(error);failure='Einspielen fehlgeschlagen: '+error.message}
  finally{
    historyBusy=false;state.applying=false;updateHistoryButtons();
    if($('#patchApply')&&$('#patchTool')){patchToolRenderPreview();if(failure)patchToolMessage(failure,'error')}
  }
}
