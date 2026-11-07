'use strict';
// mindfagg v31: file actions, import previews, clipboard, share, drop and batch undo.
// All incoming paths are validated; an entire multi-file import is committed atomically.
const WORKSPACE_IMPORT_LIMIT=ZIP_MAX_TOTAL;
let workspaceActionMenu=null,workspaceDropFolder=null;
const workspaceMime={...WORKSPACE_IMAGE_MIME,md:'text/markdown',markdown:'text/markdown',txt:'text/plain',js:'text/javascript',mjs:'text/javascript',cjs:'text/javascript',css:'text/css',json:'application/json',csv:'text/csv',mmd:'text/plain',mermaid:'text/plain',xml:'application/xml',html:'text/html',htm:'text/html',xhtml:'application/xhtml+xml',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',pdf:'application/pdf'};
function workspaceMimeFor(path){return workspaceMime[pathExtension(path)]||(knownTextPath(path)?'text/plain':'application/octet-stream')}
function workspaceZipFilename(p){return (p.name||'Workspace').replace(/[\\/:*?"<>|]/g,'_')+'.zip'}
function workspaceResetActionButton(){for(const id of ['#addDocument','#workspaceMore']){const el=$(id);if(el)el.setAttribute('aria-expanded','false')}}
function closeWorkspaceActionMenu(){workspaceActionMenu?.remove();workspaceActionMenu=null;workspaceResetActionButton()}
function toggleWorkspaceActionMenu(kind,anchor){
  if(workspaceActionMenu?.dataset.kind===kind){closeWorkspaceActionMenu();return}
  closeWorkspaceActionMenu();
  const options=kind==='add'?[
    ['new-file','file','Neue Datei','Markdown oder Script'],
    ['new-folder','folder','Neuer Ordner',''],
    ['upload','upload','Dateien hochladen','Mehrfachauswahl'],
    ['paste','clipboard','Aus Zwischenablage','Text, Bilder oder Dateien'],
    ['zip-import','zip','ZIP importieren','Projekt oder Ordner']
  ]:[
    ['zip-download','zip','ZIP herunterladen','Aktueller Workspace'],
    ['file-download','file','Aktuelle Datei herunterladen',documentNow()?fileLabel(documentNow()):'']
  ];
  const menu=document.createElement('div');menu.id='workspaceActionsMenu';menu.dataset.kind=kind;menu.className='workspace-actions-menu';menu.role='menu';menu.setAttribute('aria-label',kind==='add'?'Dateien hinzufügen':'Workspace-Aktionen');
  // Static SVGs avoid font-dependent glyphs; ZIP is a folder with a zipper.
  const svg=(paths)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  const icons={
    file:svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>'),
    folder:svg('<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/>'),
    zip:svg('<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/><path d="M15 7v2m0 2v2m0 2v1"/><rect x="13.5" y="16" width="3" height="2.5" rx=".5"/>'),
    upload:svg('<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>'),
    clipboard:svg('<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5M8 11h8M8 15h8"/>')
  };
  menu.innerHTML=options.map(([action,icon,label,detail])=>`${kind==='add'&&action==='upload'?'<div class="workspace-menu-separator" role="separator" aria-hidden="true"></div>':''}<button role="menuitem" type="button" data-workspace-action="${action}" ${(!projectId||action==='file-download'&&!documentNow())?'disabled':''}><span class="workspace-menu-icon" aria-hidden="true">${icons[icon]||''}</span><span><strong>${escapeHtml(label)}</strong>${detail?`<small>${escapeHtml(detail)}</small>`:''}</span></button>`).join('');
  document.body.appendChild(menu);workspaceActionMenu=menu;
  const box=anchor.getBoundingClientRect(),r=menu.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(innerWidth-r.width-8,box.right-r.width))+'px';
  menu.style.top=Math.max(8,Math.min(innerHeight-r.height-8,box.bottom+5))+'px';
  anchor.setAttribute('aria-expanded','true');
  menu.onclick=event=>{
    const button=event.target.closest('[data-workspace-action]');if(!button||button.disabled)return;
    const action=button.dataset.workspaceAction;closeWorkspaceActionMenu();
    void workspaceExecuteAction(action);
  };
  menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
async function workspaceExecuteAction(action){
  try{
    if(!['upload','zip-import','paste'].includes(action)){await flushMapInlineEdit();await flushSource()}
    if(action==='new-file'){setMobileMenu(false);createDocument()}
    else if(action==='new-folder'){setMobileMenu(false);createWorkspaceFolder()}
    else if(action==='upload')$('#workspaceFileInput').click();
    else if(action==='zip-import')$('#workspaceZipInput').click();
    else if(action==='paste')await pasteWorkspaceClipboard();
    else if(action==='patch'){setMobileMenu(false);openPatchTool()}
    else if(action==='zip-download'){setMobileMenu(false);await downloadWorkspaceZip()}
    else if(action==='zip-share'){setMobileMenu(false);openWorkspaceShareDialog()}
    else if(action==='file-download'){setMobileMenu(false);await downloadWorkspaceCurrentFile()}
  }catch(error){console.error(error);toast('Dateiaktion fehlgeschlagen: '+error.message)}
}
function workspaceCurrentFiles(){const p=project();return p?docs.filter(d=>d.projectId===p.id):[]}
// Construct a ZIP synchronously so it can also be passed directly to the
// native Share API from a user click (without losing transient activation).
function workspaceBuildZipSelection(selectedFiles=workspaceCurrentFiles(),includeAllFolders=true){
  const p=project();if(!p)throw Error('Kein Workspace ausgewählt');
  const files=[...selectedFiles];
  const folders=includeAllFolders?workspaceFolderPaths(p):
    [...new Set(files.flatMap(d=>workspaceFolderAncestors(workspacePath(d))))].sort((a,b)=>a.localeCompare(b,'de',{numeric:true}));
  const entries=[],occupied=new Set();
  for(const folder of folders){const path=folder+'/';if(!occupied.has(path)){entries.push({path,bytes:new Uint8Array()});occupied.add(path)}}
  for(const d of files){const path=workspacePath(d);if(occupied.has(path))throw Error('Doppelter Pfad: '+path);occupied.add(path);entries.push({path,bytes:exportFileBytes(d)})}
  const metadata={format:'mindfagg-workspace',version:32,name:p.name,accentColor:projectAccentColor(p),statusSettings:statusSettingsFor(p),folders:includeAllFolders?(p.folders||[]):folders,
    documents:files.filter(d=>fileKind(d)==='markdown').map(d=>({file:workspacePath(d),name:d.name,mapCollapsedPaths:d.mapCollapsedPaths||[],mapPositions:d.mapPositions||{}}))};
  entries.push({path:workspaceExportMetadataPath(occupied),bytes:JSON.stringify(metadata,null,2)});
  return {blob:zipWorkspace(entries),name:workspaceZipFilename(p)};
}
async function workspaceBuildZip(){
  await flushMapInlineEdit();await flushSource();
  return workspaceBuildZipSelection();
}
async function downloadWorkspaceZip(){
  try{const {blob,name}=await workspaceBuildZip();saveWorkspaceBlob(blob,name);toast('Workspace-ZIP heruntergeladen')}
  catch(error){console.error(error);toast('ZIP-Export fehlgeschlagen: '+error.message)}
}
// The root is always listed, even if it contains no files. Nested directory
// groups are derived from real file paths and shown in lexicographic order.
function workspaceShareGroups(files=workspaceCurrentFiles()){
  const groups=new Map([['',[]]]);
  for(const file of files){
    const path=pathParent(workspacePath(file));
    if(!groups.has(path))groups.set(path,[]);
    groups.get(path).push(file);
  }
  return [...groups].sort((a,b)=>!a[0]?-1:!b[0]?1:a[0].localeCompare(b[0],'de',{numeric:true}))
    .map(([folder,items])=>({folder,files:items.sort((a,b)=>fileLabel(a).localeCompare(fileLabel(b),'de',{numeric:true}))}));
}
// Display the number of actual exported bytes: UTF-8 text, original bytes when
// unchanged, and binary data are all handled by exportFileBytes().
function workspaceShareSizeLabel(bytes){
  const units=['B','KB','MB','GB','TB'];
  let value=Math.max(0,bytes),unit=0;
  while(value>=1024&&unit<units.length-1){value/=1024;unit++}
  return new Intl.NumberFormat('de-DE',{maximumFractionDigits:unit?1:0}).format(value)+' '+units[unit];
}
function workspaceShareIndividualFiles(items){
  const basenames=new Map(),used=new Set();
  for(const d of items){const key=fileLabel(d).toLocaleLowerCase('de');basenames.set(key,(basenames.get(key)||0)+1)}
  return items.map(d=>{
    const basename=fileLabel(d),path=workspacePath(d),key=basename.toLocaleLowerCase('de');
    let name=(basenames.get(key)>1?path.replaceAll('/','__'):basename),candidate=name,index=2;
    while(used.has(candidate.toLocaleLowerCase('de'))){candidate=index+'__'+name;index++}
    used.add(candidate.toLocaleLowerCase('de'));
    return new File([exportFileBytes(d)],candidate,{type:workspaceMimeFor(path)});
  });
}
// A self-contained patch is importable by the Patch Tool. Text files use the
// editor contents, while binary files carry their exact bytes as Base64.
function workspaceShareCreatePatch(items){
  const patches=items.map(d=>{
    const file=workspacePath(d);
    if(docIsText(d)&&(isMarkdownPath(file)||knownTextPath(file)))return {operation:'create',file,content:String(d.content??'')};
    // Unrecognized extensions cannot be created as text by the Patch Tool.
    // Keep the actual file bytes instead of generating an unimportable patch.
    return {operation:'create',file,encoding:'base64',content:patchToolEncodeBase64(exportFileBytes(d))};
  });
  const json=JSON.stringify({patches},null,2);
  parseWorkspacePatch(json); // enforce the Patch Tool's 500-operation / 4-MB limits
  return json;
}
function workspaceShareClipboardIcon(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5V3h6v1.5"/></svg>';
}
function openWorkspaceShareDialog(){
  if(!projectId)return toast('Kein Projekt ausgewählt');
  const originProject=projectId,files=workspaceCurrentFiles(),groups=workspaceShareGroups(files);
  const selected=new Set(files.map(d=>d.id));
  const fileSizes=new Map(files.map(d=>[d.id,exportFileBytes(d).byteLength]));
  const markup=groups.map((group,i)=>`<section class="workspace-share-group" data-share-section="${i}">
      <div class="workspace-share-group-header"><strong>${escapeHtml(group.folder||'root (Wurzel)')}</strong>
        <label class="workspace-share-select-all"><input type="checkbox" data-share-group="${i}" ${group.files.length?'checked':'disabled'}>Alle wählen</label>
        <small>${group.files.length} ${group.files.length===1?'Datei':'Dateien'}</small></div>
      <div class="workspace-share-files">${group.files.length?group.files.map(d=>`<label class="workspace-share-file"><input type="checkbox" data-share-file="${escapeHtml(d.id)}" checked>
        <span class="workspace-share-filename">${escapeHtml(fileLabel(d))}</span>
        <span class="workspace-share-size">${workspaceShareSizeLabel(fileSizes.get(d.id))}</span></label>`).join(''):'<span class="workspace-share-empty">Keine Dateien in diesem Verzeichnis.</span>'}</div></section>`).join('');
  openModal(`<div id="workspaceShareDialog" class="workspace-share-dialog">
    <h2>Dateien teilen</h2><p>Wähle die Dateien aus, die gesendet werden sollen.</p>
    <fieldset class="workspace-share-modes"><legend>Versandart</legend>
      <label><input type="radio" name="workspaceShareMode" value="zip" checked> Als ZIP</label>
      <label><input type="radio" name="workspaceShareMode" value="files"> Als Einzeldateien</label>
    </fieldset>
    <div class="workspace-share-global"><label class="workspace-share-select-all"><input type="checkbox" id="workspaceShareAll" ${files.length?'checked':'disabled'}> Alle wählen</label></div>
    <div class="workspace-share-list" aria-label="Dateien zum Teilen auswählen">${markup}</div>
    <div class="workspace-share-totals" role="status" aria-live="polite"><span id="workspaceShareCount"></span><span id="workspaceShareBytes"></span></div>
    <p class="workspace-share-info">Beim Einzelversand bleiben die Dateiinhalte erhalten, aber nicht die Verzeichnisstruktur. Gleichnamige Dateien erhalten einen Pfadpräfix. Ohne System-Teilen werden Downloads angeboten.</p>
    <div class="modalactions workspace-share-actions"><span class="workspace-share-copy-group"><button type="button" class="btn workspace-share-copy" id="workspaceShareCopyPatch" title="Patch-Phrase kopieren">${workspaceShareClipboardIcon()}<span>Patch Phrase</span></button><button type="button" class="btn workspace-share-copy" id="workspaceShareExportPatch" title="Ausgewählte Dateien als Patch kopieren">${workspaceShareClipboardIcon()}<span>Patch Export</span></button></span><button type="button" class="btn" id="workspaceShareCancel">Abbrechen</button><button type="button" class="btn primary" id="workspaceShareSubmit">Teilen</button></div>
  </div>`);
  const root=$('#workspaceShareDialog');
  function update(){
    if(!root.isConnected)return;
    groups.forEach((group,i)=>{
      const input=root.querySelector(`[data-share-group="${i}"]`);
      const count=group.files.filter(d=>selected.has(d.id)).length;
      input.checked=count===group.files.length&&count>0;
      input.indeterminate=count>0&&count<group.files.length;
    });
    const all=root.querySelector('#workspaceShareAll');
    all.checked=files.length>0&&selected.size===files.length;
    all.indeterminate=selected.size>0&&selected.size<files.length;
    root.querySelector('#workspaceShareCount').textContent=selected.size+' von '+files.length+' gewählt';
    const totalBytes=files.reduce((sum,d)=>sum+(selected.has(d.id)?fileSizes.get(d.id):0),0);
    root.querySelector('#workspaceShareBytes').textContent='Gesamtgröße: '+workspaceShareSizeLabel(totalBytes);
    root.querySelector('#workspaceShareSubmit').disabled=selected.size===0;
    root.querySelector('#workspaceShareExportPatch').disabled=selected.size===0;
  }
  root.addEventListener('change',event=>{
    const input=event.target;
    if(input.matches('[data-share-file]')){
      if(input.checked)selected.add(input.dataset.shareFile);else selected.delete(input.dataset.shareFile);
    }else if(input.matches('[data-share-group]')){
      const group=groups[Number(input.dataset.shareGroup)];
      for(const d of group.files){if(input.checked)selected.add(d.id);else selected.delete(d.id)}
    }else if(input.matches('#workspaceShareAll')){
      for(const d of files){if(input.checked)selected.add(d.id);else selected.delete(d.id)}
    }
    root.querySelectorAll('[data-share-file]').forEach(box=>{box.checked=selected.has(box.dataset.shareFile)});
    update();
  });
  root.querySelector('#workspaceShareCancel').onclick=closeModal;
  root.querySelector('#workspaceShareCopyPatch').onclick=async()=>{
    // Both dialogs share the exact, versioned prompt phrase from the Patch-Tool.
    try{
      if(await writeMapClipboard(PATCH_TOOL_PROMPT))toast('Patch-Phrase kopiert');
      else toast('Patch-Phrase konnte nicht kopiert werden');
    }catch(error){console.error(error);toast('Patch-Phrase konnte nicht kopiert werden')}
  };
  root.querySelector('#workspaceShareExportPatch').onclick=async()=>{
    if(projectId!==originProject){toast('Das Projekt wurde gewechselt. Bitte Teilen erneut öffnen.');return}
    const latest=new Map(docs.filter(d=>d.projectId===originProject).map(d=>[d.id,d]));
    const chosen=files.filter(d=>selected.has(d.id)).map(d=>latest.get(d.id)).filter(Boolean);
    if(chosen.length!==selected.size){toast('Die Dateiauswahl ist nicht mehr aktuell. Bitte Teilen erneut öffnen.');return}
    if(!chosen.length){toast('Keine Dateien ausgewählt');return}
    try{
      const patch=workspaceShareCreatePatch(chosen);
      toast(await writeMapClipboard(patch)?'Patch Export kopiert ('+chosen.length+' Dateien)':'Patch Export konnte nicht kopiert werden');
    }catch(error){console.error(error);toast('Patch Export fehlgeschlagen: '+error.message)}
  };
  root.querySelector('#workspaceShareSubmit').onclick=()=>{
    if(projectId!==originProject){toast('Das Projekt wurde gewechselt. Bitte Teilen erneut öffnen.');return}
    const latest=new Map(docs.filter(d=>d.projectId===originProject).map(d=>[d.id,d]));
    const chosen=files.filter(d=>selected.has(d.id)).map(d=>latest.get(d.id)).filter(Boolean);
    if(!chosen.length){update();return}
    const mode=root.querySelector('[name="workspaceShareMode"]:checked').value;
    let fileAttachments,downloadItems;
    try{
      if(mode==='zip'){
        const {blob,name}=workspaceBuildZipSelection(chosen,chosen.length===files.length);
        downloadItems=[{blob,name}];
        fileAttachments=typeof File==='function'?[new File([blob],name,{type:'application/zip'})]:null;
      }else{
        downloadItems=chosen.map(d=>({blob:new Blob([exportFileBytes(d)],{type:workspaceMimeFor(workspacePath(d))}),name:fileLabel(d)}));
        fileAttachments=typeof File==='function'?workspaceShareIndividualFiles(chosen):null;
        if(fileAttachments)downloadItems=fileAttachments.map(file=>({blob:file,name:file.name}));
      }
    }catch(error){console.error(error);toast('Dateien konnten nicht vorbereitet werden: '+error.message);return}
    const button=root.querySelector('#workspaceShareSubmit');
    const fallback=()=>{
      for(const item of downloadItems)saveWorkspaceBlob(item.blob,item.name);
      closeModal();toast(mode==='zip'?'ZIP-Download gestartet':'Einzeldatei-Downloads gestartet (ggf. Browserfreigabe nötig)');
    };
    let canShare=!!fileAttachments&&typeof navigator.share==='function';
    if(canShare&&typeof navigator.canShare==='function'){
      try{canShare=!!navigator.canShare({files:fileAttachments})}catch(error){console.warn('Dateifreigabe nicht unterstützt:',error);canShare=false}
    }
    if(!canShare){fallback();return}
    button.disabled=true;
    // Start share synchronously within the click handler. Awaiting a save/ZIP
    // before navigator.share would discard the browser's user gesture.
    try{
      Promise.resolve(navigator.share({files:fileAttachments,title:project()?.name||'mindfagg'}))
        .then(()=>{closeModal();toast('Dateien geteilt')})
        .catch(error=>{
          if(error?.name==='AbortError'){if(button.isConnected)button.disabled=false;return}
          console.warn('Teilen nicht möglich:',error);fallback();
        });
    }catch(error){console.warn('Teilen nicht möglich:',error);fallback()}
  };
  update();
}
// Keep the previous function as a public entrypoint for existing integrations.
function shareWorkspaceZip(){openWorkspaceShareDialog()}
async function downloadWorkspaceCurrentFile(){
  try{await flushMapInlineEdit();await flushSource();const d=documentNow();if(!d)throw Error('Keine Datei ausgewählt');
    saveWorkspaceBlob(new Blob([exportFileBytes(d)],{type:workspaceMimeFor(workspacePath(d))}),fileLabel(d));toast('Datei heruntergeladen')
  }catch(error){console.error(error);toast('Datei-Download fehlgeschlagen: '+error.message)}
}

// Batch history is stored on the existing project-wide structural history stack.
function workspaceBatchAction(projectData,filesAfter,foldersAfter,selectedAfter=docId){
  const changes=filesAfter.map(after=>({id:after.id,before:docs.find(d=>d.id===after.id)?structuredClone(docs.find(d=>d.id===after.id)):null,after:structuredClone(after)}));
  return {kind:'workspace-batch',projectId:projectData.id,changes,foldersBefore:[...(projectData.folders||[])],foldersAfter:[...new Set(foldersAfter)],selectedBefore:docId,selectedAfter};
}
async function workspaceApplyBatch(action,direction){
  const p=projects.find(item=>item.id===action.projectId);if(!p)throw Error('Projekt nicht gefunden');
  const applyAfter=direction==='redo',folders=applyAfter?action.foldersAfter:action.foldersBefore;
  const timestamp=nextProjectChange(p);
  await new Promise((resolve,reject)=>{
    const t=db.transaction(['projects','docs'],'readwrite'),s=t.objectStore('docs');
    t.objectStore('projects').put({...p,folders,updatedAt:timestamp});
    for(const change of action.changes){const record=applyAfter?change.after:change.before; if(record)s.put({...record,updatedAt:timestamp});else s.delete(change.id)}
    t.oncomplete=resolve;t.onerror=()=>reject(t.error||new Error('Speicherfehler'));t.onabort=()=>reject(t.error||new Error('Transaktion abgebrochen'));
  });
  p.folders=[...folders];p.updatedAt=timestamp;
  const changed=new Set(action.changes.map(c=>c.id));
  docs=docs.filter(d=>!changed.has(d.id));
  for(const change of action.changes){
    const record=applyAfter?change.after:change.before;
    persistedDocSnapshots.delete(change.id);failedDocWrites.delete(change.id);pendingDocWrites.delete(change.id);
    if(record){const restored={...structuredClone(record),updatedAt:timestamp};docs.push(restored);persistedDocSnapshots.set(restored.id,docSnapshot(restored));mapCollapsedPaths.set(restored.id,new Set(restored.mapCollapsedPaths||[]))}
    else{mapCollapsedPaths.delete(change.id);mapSelectedPaths.delete(change.id);mapSessionViews.delete(change.id)}
  }
  const preferred=applyAfter?action.selectedAfter:action.selectedBefore;
  if(projectId===p.id){
    docId=docs.some(d=>d.id===preferred)?preferred:(docs.some(d=>d.id===docId)?docId:docs.find(d=>d.projectId===p.id)?.id||null);
    const current=docs.find(d=>d.id===docId);
    activeFolderPath=current?pathParent(workspacePath(current)):'';
    workspaceExpandAncestors(activeFolderPath);
    render();
  }
  refreshProjectSelect();
}
async function workspaceCommitChanges(afterFiles,deletedIds=[],afterFolders=project()?.folders||[],selectedId=docId){
  const p=project();if(!p)throw Error('Kein Workspace ausgewählt');
  const action=workspaceBatchAction(p,afterFiles,afterFolders,selectedId);
  const upsertIds=new Set(afterFiles.map(item=>item.id));
  for(const id of deletedIds){
    if(upsertIds.has(id))throw Error('Datei kann nicht gleichzeitig ersetzt und gelöscht werden');
    const existing=docs.find(item=>item.id===id&&item.projectId===p.id);
    if(existing)action.changes.push({id,before:structuredClone(existing),after:null});
  }
  if(!action.changes.length&&JSON.stringify(action.foldersBefore)===JSON.stringify(action.foldersAfter))return false;
  await workspaceApplyBatch(action,'redo');
  for(const {id} of action.changes)docHistory.delete(id);
  const history=deletionHistoryFor(p.id);
  history.undo.push({...action,stamp:++historySerial});if(history.undo.length>100)history.undo.shift();history.redo.length=0;
  invalidateProjectRedo();updateHistoryButtons();githubScheduleLocalStatus(p.id);return true;
}
async function workspaceCommitBatch(afterFiles,afterFolders,selectedId){
  return workspaceCommitChanges(afterFiles,[],afterFolders,selectedId);
}
async function applyWorkspaceBatchHistory(action,direction){await workspaceApplyBatch(action,direction);return true}
async function recordWorkspaceFolderCreation(folders){return workspaceCommitBatch([],folders,docId)}
async function recordWorkspaceFileCreation(doc){return workspaceCommitBatch([doc],project()?.folders||[],doc.id)}

function workspaceFolderAncestors(path){
  const parts=path.split('/');return parts.slice(0,-1).map((_,i)=>parts.slice(0,i+1).join('/'));
}
function workspaceUniqueImportName(path,occupied){
  const parent=pathParent(path),name=pathName(path),dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name,ext=dot>0?name.slice(dot):'';
  for(let n=2;n<100000;n++){
    const candidate=[parent,stem+' ('+n+')'+ext].filter(Boolean).join('/');
    if(!occupied.has(candidate.toLocaleLowerCase('de')))return candidate;
  }
  throw Error('Kein freier Dateiname gefunden');
}
function workspacePlanFileImport(entries,targetProject,folder='',onConflict='rename',extraFolders=[],metadataDocs=new Map()){
  const original=docs.filter(d=>d.projectId===targetProject.id);
  const oldFiles=new Map(original.map(d=>[workspacePath(d).toLocaleLowerCase('de'),d]));
  const originalFolders=workspaceFolderPaths(targetProject);
  const existingFolders=new Set(originalFolders.map(x=>x.toLocaleLowerCase('de')));
  const folders=new Set(targetProject.folders||[]);
  const incomingFolders=new Set();
  const canonical=s=>s.toLocaleLowerCase('de');
  const filePaths=new Set([...oldFiles.keys()]);
  function addFolder(path){
    const valid=workspaceValidPath(path);if(!valid)throw Error('Ungültiger Ordner: '+String(path));
    const candidates=[...workspaceFolderAncestors(valid+'/x'),valid];
    for(const part of candidates){if(oldFiles.has(canonical(part))||filePaths.has(canonical(part)))throw Error('Ordner kollidiert mit Datei: '+part);incomingFolders.add(part)}
  }
  // Normalize parent paths of imported folders and files, preserving explicitly empty folders.
  for(const item of extraFolders){const valid=workspaceValidPath([folder,item].filter(Boolean).join('/'));if(valid)addFolder(valid)}
  const planned=[],reserved=new Set([...filePaths,...existingFolders,...[...incomingFolders].map(canonical)]),sourceSeen=new Set();
  for(const entry of entries){
    const relative=workspaceValidPath(entry.path);if(!relative)throw Error('Ungültiger Dateipfad: '+String(entry.path));
    if(sourceSeen.has(canonical(relative))){
      // Never update the same record twice in one transaction.
      if(onConflict==='skip'||onConflict==='replace')continue;
    }
    sourceSeen.add(canonical(relative));
    let path=workspaceValidPath([folder,relative].filter(Boolean).join('/'));
    if(!path)throw Error('Ungültiger Zielpfad: '+relative);
    let occupied=reserved.has(canonical(path));
    if(occupied&&onConflict==='skip')continue;
    if(occupied&&onConflict==='rename')path=workspaceUniqueImportName(path,reserved);
    else if(occupied&&(!oldFiles.has(canonical(path))||onConflict!=='replace'))throw Error('Ein Ordner oder Dateiname ist bereits vergeben: '+path);
    // A file cannot also be a parent of another file.
    for(const parent of workspaceFolderAncestors(path)){
      if(filePaths.has(canonical(parent))||planned.some(d=>canonical(d.path)===canonical(parent)))throw Error('Eine Datei blockiert den Ordner: '+parent);
    }
    for(const parent of workspaceFolderAncestors(path))incomingFolders.add(parent);
    const source=oldFiles.get(canonical(path)), info=metadataDocs.get(relative)||{};
    const doc=importedFileRecord(path,entry.bytes,info);
    doc.projectId=targetProject.id;
    if(info.name&&fileKind(doc)==='markdown')doc.name=info.name;
    if(source&&onConflict==='replace')doc.id=source.id;
    planned.push(doc);reserved.add(canonical(path));filePaths.add(canonical(path));
  }
  for(const path of incomingFolders){if(filePaths.has(canonical(path)))throw Error('Ordner und Datei haben denselben Namen: '+path);folders.add(path)}
  return {files:planned,folders:[...folders]};
}

function workspaceConflictCount(paths,folder){
  const p=project();if(!p)return {files:0,folders:0};
  const occupiedFiles=new Set(workspaceCurrentFiles().map(d=>workspacePath(d).toLocaleLowerCase('de')));
  const occupiedFolders=new Set(workspaceFolderPaths(p).map(path=>path.toLocaleLowerCase('de')));
  const received=new Set();let files=0,folders=0;
  for(const source of paths){
    const target=workspaceValidPath([folder,source].filter(Boolean).join('/'));
    if(!target)continue;
    const key=target.toLocaleLowerCase('de');
    if(occupiedFiles.has(key)||received.has(key))files++;
    else if(occupiedFolders.has(key))folders++;
    received.add(key);
  }
  return {files,folders};
}
function workspaceUpdateConflictInfo(paths,folder){
  const node=$('#workspaceConflictInfo');if(!node)return;
  const found=workspaceConflictCount(paths,folder);
  node.textContent=found.files||found.folders
    ?`${found.files} vorhandene/mehrfache Dateinamen${found.folders?', '+found.folders+' Ordnerkollisionen':''} im Ziel. Wähle Ersetzen, Umbenennen oder Überspringen. Ordner können nicht durch Dateien ersetzt werden.`
    :'Keine Dateinamenskonflikte im Zielordner erkannt.';
  node.classList.toggle('has-conflicts',Boolean(found.files||found.folders));
}
function workspaceImportSummary(items,folders=[]){
  const size=items.reduce((total,item)=>total+(item.size??item.bytes?.length??0),0);
  return `${items.length} ${items.length===1?'Datei':'Dateien'} · ${folders.length} ${folders.length===1?'Ordner':'Ordner'} · ${workspaceSize(size)}`;
}
function workspaceFileSamples(items){return `<div class="workspace-import-list">${items.slice(0,9).map(item=>`<div><span>${escapeHtml(item.path)}</span><small>${workspaceSize(item.size??item.bytes?.length??0)}</small></div>`).join('')}${items.length>9?`<div class="workspace-import-more">… und ${items.length-9} weitere</div>`:''}</div>`}
function workspaceImportFolderForm(selected=activeFolderPath){return `<div class="field"><label for="workspaceImportFolder">Zielordner</label><select id="workspaceImportFolder">${workspaceFolderOptions(selected)}</select></div>`}
function workspaceConflictForm(){return `<div class="field"><label for="workspaceConflict">Bei vorhandenen Dateinamen</label><select id="workspaceConflict"><option value="rename">Automatisch umbenennen</option><option value="replace">Ersetzen</option><option value="skip">Überspringen</option></select></div><p class="workspace-conflict-info" id="workspaceConflictInfo" role="status" aria-live="polite"></p>`}
async function workspaceReadUploads(descriptors){
  let total=0;const entries=[];
  for(const item of descriptors){
    const path=workspaceValidPath(item.path||item.file?.webkitRelativePath||item.file?.name);
    if(!path)throw Error('Ungültiger Upload-Dateiname: '+(item.path||item.file?.name));
    const size=item.file?.size??item.bytes?.length??0;
    if((total+=size)>WORKSPACE_IMPORT_LIMIT)throw Error('Import überschreitet die Größenbegrenzung');
    entries.push({path,bytes:item.bytes||new Uint8Array(await item.file.arrayBuffer())});
  }
  return entries;
}
// Suggestions are based on the clipboard content, not the edited destination name.
function workspaceClipboardPreferredExtension(item){
  const mime=String(item.file?.type||item.mime||'').split(';')[0].toLowerCase();
  if(mime==='text/html')return 'html';
  // Plain-text clipboard content may be recognized as HTML, CSS, JS, JSON, etc.
  if(typeof item.text==='string')return pathExtension(workspaceSuggestTextName(item.text));
  // For pasted files prefer their actual media type over a misleading filename.
  const typed=Object.keys(workspaceMime).find(extension=>workspaceMime[extension]===mime);
  return typed||pathExtension(item.path||item.file?.name||'');
}
function workspaceClipboardFilesInFolder(folder){
  return workspaceCurrentFiles().filter(doc=>pathParent(workspacePath(doc))===folder);
}
function workspaceClipboardDefaultName(item,folder){
  const preferred=workspaceClipboardPreferredExtension(item);
  if(preferred==='html'&&!workspaceClipboardFilesInFolder(folder).some(doc=>['html','htm'].includes(pathExtension(workspacePath(doc)))))return 'index.html';
  return item.path;
}
function openFileImportDialog(descriptors,options={}){
  if(!projectId)return toast('Bitte zuerst einen Workspace auswählen');
  if(!descriptors.length)return toast('Keine Dateien zum Importieren');
  const selected=options.folder??activeFolderPath;
  const mode=options.clipboard?'clipboard':'upload';
  const editable=mode==='clipboard'&&descriptors.length===1;
  const initialName=descriptors[0].path;
  const imageFile=editable&&/^image\//.test(descriptors[0].file?.type||descriptors[0].mime||'');
  let previewURL=null;
  if(imageFile){const item=descriptors[0];previewURL=URL.createObjectURL(item.file||new Blob([item.bytes],{type:item.mime}));}
  openModal(`<h2>${editable?'Zwischenablage als Datei einfügen':'Dateien importieren'}</h2><p>${escapeHtml(workspaceImportSummary(descriptors))}</p>
    ${imageFile?`<div class="workspace-clipboard-preview"><img src="${previewURL}" alt="Bild aus der Zwischenablage"></div>`:editable&&descriptors[0].text?`<pre class="workspace-clipboard-text">${escapeHtml(descriptors[0].text.slice(0,1500))}</pre>`:workspaceFileSamples(descriptors)}
    <form id="workspaceFilesForm">
    ${editable?`<div class="field"><label for="workspaceImportName">Dateiname</label><input id="workspaceImportName" list="workspaceImportNameOptions" required maxlength="200" value="${escapeHtml(initialName)}"><datalist id="workspaceImportNameOptions"></datalist></div>`:''}
    ${workspaceImportFolderForm(selected)}${workspaceConflictForm()}
    <div class="modalactions"><button type="button" class="btn" id="cancelModal">Abbrechen</button><button type="submit" class="btn primary">${editable?'Datei einfügen':'Dateien importieren'}</button></div></form>`);
  wireCancel();
  const folderInput=$('#workspaceImportFolder'),nameInput=editable?$('#workspaceImportName'):null;
  const preferredExtension=editable?workspaceClipboardPreferredExtension(descriptors[0]):'';
  let nameEdited=false;
  function refreshClipboardNameSuggestions(){
    if(!editable)return;
    const files=workspaceClipboardFilesInFolder(folderInput.value);
    const list=$('#workspaceImportNameOptions');
    const suggestions=files.filter(doc=>pathExtension(workspacePath(doc))===preferredExtension)
      .map(doc=>pathName(workspacePath(doc)))
      .sort((a,b)=>a.localeCompare(b,'de',{numeric:true,sensitivity:'base'}));
    list.replaceChildren(...suggestions.map(name=>{const option=document.createElement('option');option.value=name;return option}));
    // Auto-name HTML only as long as the user has not edited the filename.
    if(!nameEdited&&preferredExtension==='html')nameInput.value=workspaceClipboardDefaultName(descriptors[0],folderInput.value);
  }
  const refreshConflicts=()=>workspaceUpdateConflictInfo(editable?[nameInput.value]:descriptors.map(d=>d.path),folderInput.value);
  folderInput.addEventListener('change',()=>{refreshClipboardNameSuggestions();refreshConflicts()});
  if(editable)nameInput.addEventListener('input',()=>{nameEdited=true;refreshConflicts()});
  refreshClipboardNameSuggestions();refreshConflicts();
  if(previewURL){const button=$('#cancelModal');button.addEventListener('click',()=>URL.revokeObjectURL(previewURL),{once:true})}
  $('#workspaceFilesForm').onsubmit=async event=>{
    event.preventDefault();const submit=$('#workspaceFilesForm [type="submit"]');submit.disabled=true;
    try{
      await flushMapInlineEdit();await flushSource();
      const folder=$('#workspaceImportFolder').value,conflict=$('#workspaceConflict').value;
      const prepared=editable?[{...descriptors[0],path:$('#workspaceImportName').value.trim()}]:descriptors;
      const entries=await workspaceReadUploads(prepared);
      const next=workspacePlanFileImport(entries,project(),folder,conflict);
      if(!next.files.length){toast('Keine Dateien importiert (übersprungen)');submit.disabled=false;return}
      const committed=await workspaceCommitBatch(next.files,next.folders,next.files[0]?.id||docId);
      if(!committed)return;
      if(previewURL)URL.revokeObjectURL(previewURL);
      closeModal();toast(`${next.files.length} ${next.files.length===1?'Datei':'Dateien'} importiert · Rückgängig möglich`);
    }catch(error){console.error(error);toast('Dateiimport fehlgeschlagen: '+error.message);submit.disabled=false}
  };
}

async function workspaceReadZip(file){
  if(file.size>WORKSPACE_IMPORT_LIMIT)throw Error('ZIP ist zu groß');
  const all=await unzipWorkspace(await file.arrayBuffer());
  const metadataEntry=all.find(e=>!e.directory&&/^mindfagg-workspace(?:-\d+)?\.json$/.test(e.path)&&(()=>{try{return JSON.parse(ZIP_DECODE.decode(e.bytes)).format==='mindfagg-workspace'}catch(_){return false}})());
  let metadata=null,legacyEntry=null;
  if(metadataEntry){metadata=JSON.parse(ZIP_DECODE.decode(metadataEntry.bytes))}
  else{legacyEntry=all.find(e=>e.path==='mindstorm-project.json'&&!e.directory);
    if(legacyEntry){try{const candidate=JSON.parse(ZIP_DECODE.decode(legacyEntry.bytes));if(candidate.format==='mindstorm'&&Array.isArray(candidate.documents))metadata=candidate;else legacyEntry=null}catch(_){legacyEntry=null}}
  }
  const entries=all.filter(e=>e!==metadataEntry&&e!==legacyEntry),fileEntries=entries.filter(e=>!e.directory);
  const folders=[...new Set([...entries.filter(e=>e.directory).map(e=>e.path),...(Array.isArray(metadata?.folders)?metadata.folders:[]).map(workspaceValidPath).filter(Boolean)])];
  const topNames=new Set(entries.map(e=>e.path.split('/')[0]));
  // Strip only when every non-metadata entry is within a single top-level folder.
  const root=topNames.size===1&&entries.every(e=>e.directory||e.path.includes('/'))?[...topNames][0]:null;
  const legacyDocs=new Map((Array.isArray(metadata?.documents)?metadata.documents:[]).filter(d=>d?.file).map(d=>[d.file,d]));
  return {metadata,files:fileEntries,folders,root,legacyDocs};
}
function workspaceZipStrip(prepared,strip){
  if(!strip||!prepared.root)return {files:prepared.files,folders:prepared.folders,documents:prepared.legacyDocs};
  const prefix=prepared.root+'/';
  const trimmed=path=>path===prepared.root?'':path.startsWith(prefix)?path.slice(prefix.length):path;
  const files=prepared.files.map(e=>({...e,path:trimmed(e.path)}));
  const folders=prepared.folders.map(trimmed).filter(Boolean);
  const documents=new Map([...prepared.legacyDocs].map(([path,info])=>[trimmed(path),info]));
  return {files,folders,documents};
}
async function openZipImportDialog(file,options={}){
  if(!file)return;
  try{
    const prepared=await workspaceReadZip(file),canFolder=Boolean(projectId);
    const folderDefault=options.folder??activeFolderPath;
    openModal(`<h2>ZIP importieren</h2><p><strong>${escapeHtml(file.name)}</strong> · ${escapeHtml(workspaceImportSummary(prepared.files,prepared.folders))}</p>
      ${workspaceFileSamples(prepared.files)}
      <form id="workspaceZipForm"><fieldset class="workspace-import-modes"><legend>Importieren als</legend>
        <label><input type="radio" name="workspaceZipMode" value="project" ${options.intoFolder?'':'checked'}> Neues Projekt</label>
        <label><input type="radio" name="workspaceZipMode" value="folder" ${options.intoFolder?'checked':''} ${canFolder?'':'disabled'}> In aktuellen Workspace</label></fieldset>
        <div id="workspaceZipTarget" class="${options.intoFolder?'':'hidden'}">${workspaceImportFolderForm(folderDefault)}${workspaceConflictForm()}</div>
        ${prepared.root?`<label class="workspace-strip-option"><input type="checkbox" id="workspaceStripRoot"> Obersten ZIP-Ordner „${escapeHtml(prepared.root)}“ entfernen</label>`:''}
        <div class="modalactions"><button type="button" class="btn" id="cancelModal">Abbrechen</button><button type="submit" class="btn primary">ZIP importieren</button></div>
      </form>`);
    wireCancel();
    const refreshZipConflicts=()=>{
      const inFolder=$('#workspaceZipForm [value="folder"]').checked;
      $('#workspaceZipTarget').classList.toggle('hidden',!inFolder);
      if(inFolder)workspaceUpdateConflictInfo(workspaceZipStrip(prepared,!!$('#workspaceStripRoot')?.checked).files.map(e=>e.path),$('#workspaceImportFolder').value);
    };
    $('#workspaceZipForm').querySelectorAll('[name="workspaceZipMode"]').forEach(radio=>radio.onchange=refreshZipConflicts);
    $('#workspaceImportFolder')?.addEventListener('change',refreshZipConflicts);
    $('#workspaceStripRoot')?.addEventListener('change',refreshZipConflicts);
    refreshZipConflicts();
    $('#workspaceZipForm').onsubmit=async event=>{
      event.preventDefault();const submit=$('#workspaceZipForm [type="submit"]');submit.disabled=true;
      try{
        await flushMapInlineEdit();await flushSource();
        const stripped=workspaceZipStrip(prepared,!!$('#workspaceStripRoot')?.checked);
        if($('#workspaceZipForm [value="folder"]').checked){
          const folder=$('#workspaceImportFolder').value,conflict=$('#workspaceConflict').value,p=project();
          if(!p)throw Error('Kein Workspace ausgewählt');
          const plan=workspacePlanFileImport(stripped.files,p,folder,conflict,stripped.folders,stripped.documents);
          if(!plan.files.length&&JSON.stringify(plan.folders)===JSON.stringify(p.folders||[])){toast('Keine neuen Inhalte');submit.disabled=false;return}
          await workspaceCommitBatch(plan.files,plan.folders,plan.files[0]?.id||docId);
          closeModal();toast(`ZIP importiert: ${plan.files.length} Dateien · Rückgängig möglich`);
        }else{
          const base=prepared.metadata?.name||file.name.replace(/\.zip$/i,'')||'Workspace';
          const p={id:uid(),name:workspaceImportedName(base),created:Date.now(),accentColor:projectAccentColor({accentColor:prepared.metadata?.accentColor}),statusSettings:statusSettingsFor({statusSettings:prepared.metadata?.statusSettings}),folders:[...stripped.folders]};
          const planned=workspacePlanFileImport(stripped.files,p,'','rename',stripped.folders,stripped.documents);
          p.folders=planned.folders;
          await commitImportedWorkspace(p,planned.files);
          await refresh();activeFolderPath='';selectProject(p.id);
          closeModal();toast(`Projekt importiert: ${planned.files.length} Dateien`);
        }
      }catch(error){console.error(error);toast('ZIP-Import fehlgeschlagen: '+error.message);submit.disabled=false}
    };
  }catch(error){console.error(error);toast('ZIP konnte nicht gelesen werden: '+error.message)}
}

// Mermaid diagrams copied as text should keep the dedicated .mmd extension.
function workspaceLooksLikeMermaidText(value){
  let text=String(value??'').replace(/^\uFEFF/,'').trimStart();
  if(!text||text.length>500000)return false;
  // Optional Mermaid YAML front matter and directives/comments may precede a diagram.
  text=text.replace(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/,'').trimStart();
  text=text.replace(/^(?:[ \t]*%%[^\r\n]*(?:\r?\n|$)[ \t]*)*/,'').trimStart();
  return /^(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4(?:Context|Container|Component|Dynamic|Deployment)|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban|radar-beta|treemap-beta|zenuml)\b(?:\s|;|$)/i.test(text);
}
function workspaceSuggestTextName(value){
  const t=String(value).trim();
  if(workspaceLooksLikeMermaidText(t))return 'clipboard.mmd';
  if(/^<svg(?:\s|>)/i.test(t)||/^<\?xml[^>]*\?>[\s\S]*<svg(?:\s|>)/i.test(t))return 'clipboard.svg';
  if(/^<!doctype\s+html/i.test(t)||/^<html(?:\s|>)/i.test(t))return 'clipboard.html';
  if(/^<\?xml\b/i.test(t))return 'clipboard.xml';
  if(/^[{\[]/.test(t)){try{JSON.parse(t);return 'clipboard.json'}catch(_){}}
  const language=detectClipboardCodeLanguage(t);
  return language?'clipboard.'+language:'clipboard.txt';
}
function workspaceClipboardFromEvent(event){
  const data=event.clipboardData,files=[];
  if(data)for(const item of data.items){if(item.kind==='file'){const file=item.getAsFile();if(file)files.push({file,path:file.name&&file.name!=='image.png'?file.name:'clipboard.'+((file.type||'image/png').split('/')[1].replace('jpeg','jpg').replace('svg+xml','svg')||'png')})}}
  if(files.length)return files;
  const text=data?.getData('text/plain')||data?.getData('text/html')||'';
  const mime=data?.getData('text/plain')?'text/plain':'text/html';
  return text?[{path:mime==='text/html'?'clipboard.html':workspaceSuggestTextName(text),bytes:new TextEncoder().encode(text),text,mime}]:[];
}
function openWorkspacePasteFallback(){
  openModal(`<h2>Aus Zwischenablage einfügen</h2><p>Der Browser erlaubt hier keinen direkten Zugriff auf die Zwischenablage. Füge den Inhalt mit <strong>Strg+V</strong> bzw. <strong>⌘V</strong> in dieses Feld ein.</p>
    <textarea id="workspacePasteArea" rows="5" aria-label="Hier Text oder ein Bild einfügen" placeholder="Text oder Bild einfügen …"></textarea>
    <div class="modalactions"><button type="button" class="btn" id="cancelModal">Abbrechen</button><button type="button" class="btn primary" id="workspacePasteText">Text übernehmen</button></div>`);
  wireCancel();
  const area=$('#workspacePasteArea');area.focus();
  area.onpaste=event=>{const contents=workspaceClipboardFromEvent(event);if(contents.some(item=>item.file||item.mime==='text/html')){event.preventDefault();openFileImportDialog(contents,{clipboard:true})}};
  $('#workspacePasteText').onclick=()=>{
    if(!area.value)return toast('Zwischenablage ist leer');const text=area.value;
    openFileImportDialog([{path:workspaceSuggestTextName(text),bytes:new TextEncoder().encode(text),text}],{clipboard:true});
  };
}
async function pasteWorkspaceClipboard(){
  if(!projectId)return;
  try{
    if(!navigator.clipboard?.read)throw Error('Clipboard API nicht verfügbar');
    const items=await navigator.clipboard.read(),descriptors=[];
    for(const item of items){
      const fileType=item.types.find(t=>t.startsWith('image/'))||item.types.find(t=>t.startsWith('application/')&&!t.includes('json'));
      if(fileType){const blob=await item.getType(fileType),ext=fileType==='image/svg+xml'?'svg':fileType==='image/jpeg'?'jpg':fileType.split('/')[1].replace(/[^a-z0-9]/gi,'')||'bin';
        descriptors.push({file:new File([blob],'clipboard.'+ext,{type:fileType}),path:'clipboard.'+ext});continue}
      const textType=item.types.includes('text/plain')?'text/plain':item.types.includes('text/html')?'text/html':null;
      if(textType){const text=await (await item.getType(textType)).text();descriptors.push({path:textType==='text/html'?'clipboard.html':workspaceSuggestTextName(text),bytes:new TextEncoder().encode(text),text,mime:textType})}
    }
    if(!descriptors.length)throw Error('Kein unterstützter Inhalt');
    openFileImportDialog(descriptors,{clipboard:true});
  }catch(error){console.warn('Zwischenablage nur per Einfügen lesbar:',error);openWorkspacePasteFallback()}
}

async function workspaceDropDescriptors(dataTransfer){
  const items=[...(dataTransfer.items||[])],results=[];
  // webkitGetAsEntry retains folders and nested paths in Chromium, with ordinary files as fallback.
  if(items.length&&items.some(i=>i.webkitGetAsEntry?.())){
    async function walk(entry,prefix=''){
      const name=[prefix,entry.name].filter(Boolean).join('/');
      if(entry.isFile){const file=await new Promise((resolve,reject)=>entry.file(resolve,reject));results.push({file,path:name});return}
      if(entry.isDirectory){
        const reader=entry.createReader();let batch;
        do{batch=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));for(const child of batch)await walk(child,name)}while(batch.length);
      }
    }
    for(const item of items){const entry=item.webkitGetAsEntry?.();if(entry)await walk(entry)}
  }
  if(!results.length)for(const file of dataTransfer.files||[])results.push({file,path:file.webkitRelativePath||file.name});
  return results;
}
function workspaceDropDestination(event){
  const folderButton=event.target.closest?.('[data-folder]');
  const folderLine=event.target.closest?.('.folder-line');
  const doc=event.target.closest?.('[data-doc]');
  if(folderButton)return folderButton.dataset.folder;
  if(folderLine){const folder=folderLine.querySelector('[data-folder]');if(folder)return folder.dataset.folder}
  if(doc){const d=docs.find(item=>item.id===doc.dataset.doc);if(d)return pathParent(workspacePath(d))}
  return activeFolderPath;
}
function workspaceEnableDrop(){
  const sidebar=$('#mainSidebar');if(!sidebar)return;
  let depth=0;
  sidebar.addEventListener('dragenter',event=>{
    if(!event.dataTransfer?.types.includes('Files'))return;
    event.preventDefault();depth++;sidebar.classList.add('workspace-drop-active');
  });
  sidebar.addEventListener('dragover',event=>{
    if(!event.dataTransfer?.types.includes('Files'))return;
    event.preventDefault();event.dataTransfer.dropEffect='copy';
    const target=workspaceDropDestination(event);
    workspaceDropFolder=target;
    sidebar.querySelectorAll('[data-folder]').forEach(el=>el.classList.toggle('workspace-drop-target',el.dataset.folder===target));
  });
  sidebar.addEventListener('dragleave',()=>{
    if(--depth<=0){depth=0;sidebar.classList.remove('workspace-drop-active');sidebar.querySelectorAll('.workspace-drop-target').forEach(el=>el.classList.remove('workspace-drop-target'))}
  });
  sidebar.addEventListener('drop',async event=>{
    if(!event.dataTransfer?.types.includes('Files'))return;
    event.preventDefault();event.stopPropagation();
    const folder=workspaceDropDestination(event),transfer=event.dataTransfer;
    depth=0;sidebar.classList.remove('workspace-drop-active');sidebar.querySelectorAll('.workspace-drop-target').forEach(el=>el.classList.remove('workspace-drop-target'));
    try{
      const descriptors=await workspaceDropDescriptors(transfer);
      if(descriptors.length===1&&/\.zip$/i.test(descriptors[0].path))await openZipImportDialog(descriptors[0].file,{folder,intoFolder:true});
      else openFileImportDialog(descriptors,{folder});
    }catch(error){console.error(error);toast('Drag-and-drop fehlgeschlagen: '+error.message)}
  });
}
function wireWorkspaceIO(){
  $('#workspaceFileInput').onchange=event=>{const files=[...event.target.files].map(file=>({file,path:file.webkitRelativePath||file.name}));event.target.value='';openFileImportDialog(files)};
  $('#workspaceZipInput').onchange=event=>{const file=event.target.files[0];event.target.value='';if(file)void openZipImportDialog(file)};
  document.addEventListener('pointerdown',event=>{if(workspaceActionMenu&&!event.target.closest('#workspaceActionsMenu,#addDocument,#workspaceMore'))closeWorkspaceActionMenu()});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&workspaceActionMenu){event.preventDefault();closeWorkspaceActionMenu();return}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'&&!event.defaultPrevented&&projectId&&!$('#modalBack').classList.contains('hidden'))return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='v'&&!event.defaultPrevented&&projectId){
      const target=event.target;
      const editing=target.closest?.('textarea,input,select,[contenteditable="true"],.mm-inline-editor');
      const tree=target.closest?.('#docList,#mainSidebar');
      if(!editing&&tree){event.preventDefault();void pasteWorkspaceClipboard()}
    }
  });
  window.addEventListener('resize',closeWorkspaceActionMenu);
  $('#mainSidebar').addEventListener('scroll',closeWorkspaceActionMenu,{passive:true});
  workspaceEnableDrop();
}
