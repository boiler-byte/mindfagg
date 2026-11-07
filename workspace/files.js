'use strict';
// mindfagg v29: ZIP workspaces, folders, script/SVG editing, images and binary files.
// The existing IndexedDB stores remain compatible with v24 markdown documents.
const WORKSPACE_TEXT_EXT=new Set([
  'txt','text','js','mjs','cjs','jsx','ts','tsx','json','jsonc','xml','html','htm','xhtml','css','scss','sass','less',
  'yaml','yml','toml','ini','cfg','conf','config','env','properties','csv','tsv','log','sql','graphql','gql','vue','svelte',
  'py','rb','php','java','kt','swift','go','rs','c','h','cpp','hpp','cc','cs','sh','bash','zsh','fish','ps1','bat','cmd',
  'mmd','mermaid','dockerfile','makefile','gradle','gitignore','gitattributes','editorconfig','lock','svg','tex','rst','adoc','diff','patch'
]);
const WORKSPACE_TEXT_NAMES=new Set(['dockerfile','makefile','license','readme','changelog','.gitignore','.gitattributes','.editorconfig','.env','.npmrc','.prettierrc','.eslintrc']);
const WORKSPACE_IMAGE_MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',svg:'image/svg+xml',avif:'image/avif',ico:'image/x-icon',apng:'image/apng'};
const WORKSPACE_AUDIO_MIME={mp3:'audio/mpeg',wav:'audio/wav',wave:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',weba:'audio/webm',aif:'audio/aiff',aiff:'audio/aiff',mid:'audio/midi',midi:'audio/midi'};
const workspaceFolderOpen=new Map();
const WORKSPACE_FOLDER_STORAGE_KEY='mfWorkspaceCollapsedFolders';
try{
  const stored=JSON.parse(localStorage.getItem(WORKSPACE_FOLDER_STORAGE_KEY)||'[]');
  if(Array.isArray(stored))for(const key of stored.slice(0,4000)){
    if(typeof key==='string'&&key.length<2200&&key.includes(':'))workspaceFolderOpen.set(key,false);
  }
}catch(error){console.warn('Gespeicherte Ordneransicht konnte nicht geladen werden:',error)}
function workspacePersistFolderOpen(){
  try{localStorage.setItem(WORKSPACE_FOLDER_STORAGE_KEY,JSON.stringify([...workspaceFolderOpen].filter(([,open])=>open===false).map(([key])=>key)))}
  catch(error){console.warn('Ordneransicht konnte nicht gespeichert werden:',error)}
}
function workspaceSetFolderOpen(path,open,projectKey=projectId){
  if(!projectKey||!path)return;
  const key=projectKey+':'+path;
  if(open)workspaceFolderOpen.delete(key);else workspaceFolderOpen.set(key,false);
  workspacePersistFolderOpen();
}
function workspaceCollapseFolders(){
  if(!projectId)return;
  for(const path of workspaceFolderPaths())workspaceFolderOpen.set(projectId+':'+path,false);
  workspacePersistFolderOpen();render();
}
function workspaceUpdateCollapseButton(){
  const button=$('#collapseFolders');if(!button)return;
  button.hidden=!projectId||!$('#docList')?.querySelector('.folder-toggle[aria-expanded="true"]');
}
function workspaceRenameFolderOpenStates(folder,nextPath,projectKey=projectId){
  const prefix=projectKey+':',updates=[];
  for(const [key,value] of workspaceFolderOpen){
    const path=key.startsWith(prefix)?key.slice(prefix.length):'';
    if(path===folder||path.startsWith(folder+'/'))updates.push([key,prefix+nextPath+path.slice(folder.length),value]);
  }
  for(const [before,after,value] of updates){workspaceFolderOpen.delete(before);workspaceFolderOpen.set(after,value)}
  if(updates.length)workspacePersistFolderOpen();
}
let activeFolderPath='',workspacePreviewURL=null,activeFilePanel='script';
function workspacePath(doc){
  return typeof doc?.path==='string'&&doc.path?doc.path:(doc?.name||'Projekt').replace(/[\\/]/g,'_')+'.md';
}
function pathParent(path){const pos=path.lastIndexOf('/');return pos<0?'':path.slice(0,pos)}
function pathName(path){return path.slice(path.lastIndexOf('/')+1)}
function pathExtension(path){const name=pathName(path),pos=name.lastIndexOf('.');return pos<0?'':name.slice(pos+1).toLowerCase()}
function isMarkdownPath(path){return /\.(?:md|markdown|mdown)$/i.test(path)}
function knownTextPath(path){const name=pathName(path).toLowerCase();return WORKSPACE_TEXT_EXT.has(pathExtension(path))||WORKSPACE_TEXT_NAMES.has(name)}
function fileKind(doc){
  // Audio from v31 was imported as binary. Keep it playable without rewriting
  // or migrating its IndexedDB record, preserving original bytes for ZIP export.
  if(doc&&WORKSPACE_AUDIO_MIME[pathExtension(workspacePath(doc))]&&['binary','audio',undefined].includes(doc.fileType))return 'audio';
  return ['markdown','script','image','binary','audio'].includes(doc?.fileType)?doc.fileType:isMarkdownPath(workspacePath(doc))?'markdown':'script';
}
function fileLabel(doc){return pathName(workspacePath(doc))}
function docNameForPath(path){const base=pathName(path);return isMarkdownPath(path)?base.replace(/\.(?:md|markdown|mdown)$/i,''):base}
function docIsText(doc){return ['markdown','script'].includes(fileKind(doc))}
// A Markdown file always has a real H1. Existing H1s inside fenced code
// do not count; documents with multiple H1s remain subject to validation.
function markdownWithRoot(path,content){
  const text=String(content??'');
  if(scanMarkdown(text).roots.length)return text;
  const title=docNameForPath(path).trim()||'Dokument';
  const body=text.replace(/^\uFEFF/,'');
  return '# '+title+'\n'+(body?'\n'+body:'');
}
function ensureMarkdownRoot(doc){
  if(!doc||doc.preserveSource||fileKind(doc)!=='markdown')return false;
  const content=markdownWithRoot(workspacePath(doc),doc.content);
  if(content===doc.content)return false;
  doc.content=content;
  put('docs',{...doc},{record:false}).catch(error=>{console.error(error);toast('Automatische H1-Ergänzung konnte nicht gespeichert werden')});
  return true;
}
// SVG was an image in v25. Convert old imported records on first opening,
// keeping the exact original bytes for lossless export until it is edited.
function ensureSvgScript(doc){
  if(!doc||pathExtension(workspacePath(doc))!=='svg'||doc.fileType!=='image')return false;
  const bytes=workspaceBytes(doc.data),content=decodeWorkspaceText(bytes,workspacePath(doc));
  if(content===null){toast('SVG konnte nicht als Text gelesen werden');return false}
  doc.fileType='script';doc.content=content;doc.originalContent=content;doc.raw=bytes;
  delete doc.data;
  put('docs',{...doc},{record:false}).catch(error=>{console.error(error);toast('SVG-Konvertierung konnte nicht gespeichert werden')});
  return true;
}
function workspaceValidPath(raw){
  if(typeof raw!=='string'||!raw||raw.length>2048||raw.startsWith('/')||/^[a-zA-Z]:/.test(raw)||/[\u0000-\u001f\u007f]/.test(raw))return null;
  const path=raw.replace(/\\/g,'/').replace(/^(?:\.\/)+/,'').replace(/\/$/,'');
  const parts=path.split('/');
  if(!path||parts.some(part=>!part||part==='.'||part==='..'))return null;
  return path;
}
function workspaceUniquePath(path,excluding=null,p=project()){
  const lowered=path.toLocaleLowerCase();
  if(docs.some(d=>d.projectId===p?.id&&d.id!==excluding&&workspacePath(d).toLocaleLowerCase()===lowered))return false;
  if(workspaceFolderPaths(p).some(folder=>folder.toLocaleLowerCase()===lowered))return false;
  // A file cannot also be a parent folder.
  if(docs.some(d=>d.projectId===p?.id&&d.id!==excluding&&path.toLocaleLowerCase().startsWith(workspacePath(d).toLocaleLowerCase()+'/')))return false;
  return true;
}
function workspaceFolderPaths(p=project()){
  if(!p)return [];
  const folders=new Set();
  function include(path){if(!path)return;const parts=path.split('/');for(let i=1;i<=parts.length;i++)folders.add(parts.slice(0,i).join('/'))}
  for(const path of p.folders||[]){const valid=workspaceValidPath(path);if(valid)include(valid)}
  for(const d of docs.filter(item=>item.projectId===p.id))include(pathParent(workspacePath(d)));
  return [...folders].sort((a,b)=>a.localeCompare(b,'de',{numeric:true,sensitivity:'base'}));
}
function workspaceFolderOptions(selected=activeFolderPath){
  return [''].concat(workspaceFolderPaths()).map(folder=>`<option value="${escapeHtml(folder)}" ${folder===selected?'selected':''}>${escapeHtml(folder||'/ (Wurzel)')}</option>`).join('');
}
function workspaceExpandAncestors(path){
  const parts=path.split('/');let changed=false;
  for(let i=1;i<=parts.length;i++){
    const key=projectId+':'+parts.slice(0,i).join('/');
    if(workspaceFolderOpen.delete(key))changed=true;
  }
  if(changed)workspacePersistFolderOpen();
}
// v50: file types get distinct, color-coded icons in the sidebar tree.
// Names and paths remain plain escaped text; these SVG templates are static.
function workspaceFileIcon(doc){
  const path=workspacePath(doc),ext=pathExtension(path);
  if(['js','mjs','cjs','jsx'].includes(ext))return '<svg class="file-type-mark file-type-js" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#f7df1e"/><text x="12" y="16.8" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11.8" font-weight="800" fill="#242112">JS</text></svg>';
  if(ext==='css')return '<svg class="file-type-mark file-type-css" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3 6 21M17 3l-3 18M4 9h17M3 15h17"/></svg>';
  if(['mmd','mermaid'].includes(ext))return '<svg class="file-type-mark file-type-mermaid" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="7" height="6" rx="1.1"/><rect x="15" y="15" width="7" height="6" rx="1.1"/><path d="M9 6h5a4 4 0 0 1 4 4v5M14 12l4 3 4-3"/></svg>';
  if(['htm','html','xhtml'].includes(ext))return '<svg class="file-type-mark file-type-html" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5-6 7 6 7m6-14 6 7-6 7"/></svg>';
  if(isMarkdownPath(path)||fileKind(doc)==='markdown')return '<svg class="file-type-mark file-type-markdown" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v17m-7-7 7 7 7-7"/></svg>';
  return escapeHtml({script:'⌘',image:'▧',audio:'♫',binary:'▣'}[fileKind(doc)]||'▣');
}
function workspaceTreeHtml(p){
  if(!p)return '';
  const folderPaths=workspaceFolderPaths(p),files=docs.filter(d=>d.projectId===p.id);
  const dirs=new Map([['',[]]]),byDir=new Map();
  for(const folder of folderPaths){if(!dirs.has(folder))dirs.set(folder,[]);const parent=pathParent(folder);if(!dirs.has(parent))dirs.set(parent,[]);dirs.get(parent).push(folder)}
  for(const file of files){const parent=pathParent(workspacePath(file));if(!byDir.has(parent))byDir.set(parent,[]);byDir.get(parent).push(file)}
  const sort=(a,b)=>a.localeCompare(b,'de',{numeric:true,sensitivity:'base'});
  function build(folder,level){
    const nodes=(dirs.get(folder)||[]).sort((a,b)=>sort(pathName(a),pathName(b)));
    const leaves=(byDir.get(folder)||[]).sort((a,b)=>sort(fileLabel(a),fileLabel(b)));
    let html='';
    for(const path of nodes){
      const key=p.id+':'+path,expanded=workspaceFolderOpen.get(key)!==false,selected=path===activeFolderPath;
      html+=`<div class="folder-entry"><div class="folder-line ${selected?'folder-active':''}" style="--tree-level:${level}">
        <button class="folder-toggle" type="button" data-folder-toggle="${escapeHtml(path)}" aria-label="${expanded?'Ordner einklappen':'Ordner aufklappen'}" aria-expanded="${expanded}">${expanded?'▾':'▸'}</button>
        <button class="folder-name" type="button" data-folder="${escapeHtml(path)}" title="${escapeHtml(path)}"><span class="file-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6h7l2.2 2.5H21v11H3z"/></svg></span><span>${escapeHtml(pathName(path))}</span></button>
        <button class="folder-menu" type="button" data-folder-menu="${escapeHtml(path)}" title="Ordner umbenennen oder löschen" aria-label="Ordner ${escapeHtml(pathName(path))} verwalten">⋯</button>
      </div>${expanded?build(path,level+1):''}</div>`;
    }
    for(const file of leaves){
      html+=`<button type="button" class="navitem file-navitem ${file.id===docId?'active':''}" style="--tree-level:${level}" data-doc="${file.id}" title="${escapeHtml(workspacePath(file))}"><span class="sym" aria-hidden="true">${workspaceFileIcon(file)}</span><span>${escapeHtml(fileLabel(file))}</span></button>`;
    }
    return html;
  }
  return build('',0)||'<div class="file-tree-empty">Noch keine Dateien. Datei oder Ordner erstellen.</div>';
}
function wireWorkspaceTree(){
  const list=$('#docList');if(!list)return;
  list.onclick=async event=>{
    const menu=event.target.closest('[data-folder-menu]');
    const toggle=event.target.closest('[data-folder-toggle]');
    const folder=event.target.closest('[data-folder]');
    const file=event.target.closest('[data-doc]');
    if(!menu&&!toggle&&!folder&&!file)return;
    try{await flushMapInlineEdit();await flushSource()}
    catch(error){console.error(error);toast('Änderungen konnten nicht gespeichert werden');return}
    if(menu){event.stopPropagation();openWorkspaceFolderSettings(menu.dataset.folderMenu);return}
    if(toggle){const path=toggle.dataset.folderToggle,key=projectId+':'+path;workspaceSetFolderOpen(path,workspaceFolderOpen.get(key)===false);render();return}
    if(folder){appSettingsOpen=false;activeFolderPath=folder.dataset.folder;workspaceExpandAncestors(activeFolderPath);render();return}
    if(file)selectDocument(file.dataset.doc);
  };
}
function changeWorkspaceFolder(folder){activeFolderPath=folder;workspaceExpandAncestors(folder)}
function createWorkspaceFolder(){
  if(!projectId)return;
  openModal(`<h2>Ordner erstellen</h2><p>Ordner können weitere Unterordner und Dateien enthalten.</p><form id="folderForm">
    <div class="field"><label for="parentFolder">Übergeordneter Ordner</label><select id="parentFolder">${workspaceFolderOptions()}</select></div>
    <div class="field"><label for="folderName">Neuer Ordnername</label><input id="folderName" required maxlength="180" placeholder="assets oder src/components" autofocus></div>${formActions('Ordner erstellen')}</form>`);
  wireCancel();
  $('#folderForm').onsubmit=async event=>{
    event.preventDefault();const parent=$('#parentFolder').value,sub=$('#folderName').value.trim();
    const path=workspaceValidPath([parent,sub].filter(Boolean).join('/'));
    if(!path||path.split('/').some(s=>s==='.'||s==='..'))return toast('Ungültiger Ordnerpfad');
    if(workspaceFolderPaths().includes(path)||!workspaceUniquePath(path))return toast('Dieser Pfad ist bereits vergeben');
    const p=project(),next={...p,folders:[...(p.folders||[]),path]};
    try{await recordWorkspaceFolderCreation(next.folders);changeWorkspaceFolder(path);closeModal();render();toast('Ordner erstellt · Rückgängig möglich')}
    catch(error){console.error(error);toast('Ordner konnte nicht erstellt werden')}
  };
}
function openWorkspaceFolderSettings(folder){
  const p=project();if(!p||!workspaceFolderPaths(p).includes(folder))return;
  const filesInside=docs.filter(d=>d.projectId===p.id&&workspacePath(d).startsWith(folder+'/'));
  const childFolders=workspaceFolderPaths(p).filter(path=>path.startsWith(folder+'/'));
  const empty=filesInside.length===0&&childFolders.length===0;
  openModal(`<h2>Ordner verwalten</h2><p>${escapeHtml(folder)}</p><form id="folderEditForm">
    <div class="field"><label for="folderNewName">Name</label><input id="folderNewName" required maxlength="180" value="${escapeHtml(pathName(folder))}"></div>
    <div class="modalactions document-modal-actions"><button type="button" class="btn delete-document" id="removeFolder">${empty?'Leeren Ordner löschen':'Ordner löschen'}</button><span class="document-action-spacer"></span><button type="button" class="btn" id="cancelModal">Abbrechen</button><button type="submit" class="btn primary">Umbenennen</button></div></form>`);
  wireCancel();
  $('#removeFolder').onclick=async()=>{
    if(!empty){confirmWorkspaceFolderDelete(folder);return}
    const remaining=(p.folders||[]).filter(path=>path!==folder);
    try{
      await workspaceCommitBatch([],remaining,docId);
      workspaceFolderOpen.delete(p.id+':'+folder);workspacePersistFolderOpen();
      activeFolderPath=workspaceFolderPaths(p).includes(pathParent(folder))?pathParent(folder):'';
      closeModal();render();toast('Ordner gelöscht · Rückgängig möglich');
    }catch(error){console.error(error);toast('Ordner konnte nicht gelöscht werden')}
  };
  $('#folderEditForm').onsubmit=async e=>{
    e.preventDefault();const name=$('#folderNewName').value.trim(),nextPath=workspaceValidPath([pathParent(folder),name].filter(Boolean).join('/'));
    if(!nextPath||name.includes('/')||name.includes('\\'))return toast('Ungültiger Ordnername');
    if(nextPath===folder){closeModal();return}
    if(workspaceFolderPaths(p).includes(nextPath)||!workspaceUniquePath(nextPath,null,p))return toast('Zielordner existiert bereits');
    const movePath=path=>path===folder?nextPath:path.startsWith(folder+'/')?nextPath+path.slice(folder.length):path;
    const moved=filesInside.map(d=>({...d,path:movePath(workspacePath(d))}));
    const existingPaths=new Set(docs.filter(d=>d.projectId===p.id&&!filesInside.includes(d)).map(d=>workspacePath(d).toLocaleLowerCase()));
    if(moved.some(d=>existingPaths.has(d.path.toLocaleLowerCase())))return toast('Ziel enthält bereits Dateien mit diesem Namen');
    const newFolders=[...new Set([...(p.folders||[]).map(movePath),nextPath])];
    try{
      await workspaceCommitBatch(moved,newFolders,docId);
      workspaceRenameFolderOpenStates(folder,nextPath,p.id);
      activeFolderPath=movePath(activeFolderPath);changeWorkspaceFolder(nextPath);
      closeModal();render();toast('Ordner umbenannt · Rückgängig möglich');
    }catch(error){console.error(error);toast('Ordner konnte nicht umbenannt werden')}
  };
}
// Deleting a nonempty folder removes all contained documents and subfolders
// as ONE undoable, atomic workspace batch, after an explicit confirmation.
function confirmWorkspaceFolderDelete(folder){
  const p=project();if(!p||!workspaceFolderPaths(p).includes(folder))return;
  const inside=docs.filter(d=>d.projectId===p.id&&workspacePath(d).startsWith(folder+'/'));
  const children=workspaceFolderPaths(p).filter(path=>path.startsWith(folder+'/'));
  const count=inside.length;
  openModal(`<h2>Ordner löschen?</h2><p>Soll <strong>${escapeHtml(folder)}</strong> mit ${count} ${count===1?'Datei':'Dateien'} und ${children.length} ${children.length===1?'Unterordner':'Unterordnern'} gelöscht werden?</p>
    <div class="project-delete-warning">Alle Dateien und Unterordner werden gelöscht. Diese Aktion lässt sich in dieser Sitzung mit Rückgängig wiederherstellen.</div>
    <div class="modalactions"><button class="btn" type="button" id="cancelFolderDelete">Zurück</button><button class="btn delete-document" type="button" id="confirmFolderDelete">Ordner löschen</button></div>`);
  $('#cancelFolderDelete').onclick=()=>openWorkspaceFolderSettings(folder);
  $('#confirmFolderDelete').onclick=async()=>{
    const button=$('#confirmFolderDelete');button.disabled=true;
    const current=project();if(!current||current.id!==p.id)return;
    const files=docs.filter(d=>d.projectId===p.id&&workspacePath(d).startsWith(folder+'/'));
    const deletedIds=new Set(files.map(d=>d.id));
    const remainingFolders=(p.folders||[]).filter(path=>path!==folder&&!path.startsWith(folder+'/'));
    const selected=deletedIds.has(docId)?docs.find(d=>d.projectId===p.id&&!deletedIds.has(d.id))?.id||null:docId;
    try{
      await workspaceCommitChanges([],files.map(d=>d.id),remainingFolders,selected);
      for(const key of [...workspaceFolderOpen.keys()]){
        const prefix=p.id+':';const path=key.startsWith(prefix)?key.slice(prefix.length):'';
        if(path===folder||path.startsWith(folder+'/'))workspaceFolderOpen.delete(key);
      }
      workspacePersistFolderOpen();
      activeFolderPath=workspaceFolderPaths(p).includes(pathParent(folder))?pathParent(folder):'';
      closeModal();render();toast('Ordner samt Inhalt gelöscht · Rückgängig möglich');
    }catch(error){console.error(error);toast('Ordner konnte nicht gelöscht werden');if(button.isConnected)button.disabled=false}
  };
}
function isSvgScriptFile(doc){return fileKind(doc)==='script'&&pathExtension(workspacePath(doc))==='svg'}
function isJavascriptFile(doc){return fileKind(doc)==='script'&&['js','mjs','cjs','jsx'].includes(pathExtension(workspacePath(doc)))}
function filePanelOptions(doc){
  if(!doc)return [];
  if(fileKind(doc)==='script'){
    const tabs=[{id:'script',label:'⌘  Script'}];
    if(isSvgScriptFile(doc)||isHtmlScriptFile(doc)||isMermaidFile(doc))tabs.push({id:'preview',label:isMermaidFile(doc)?'◇  Mermaid':'▧  Vorschau'});
    if(isJavascriptFile(doc))tabs.push({id:'functions',label:'ƒ  Functions'});
    return tabs;
  }
  return [{id:'file',label:fileKind(doc)==='image'?'▧  Bild':fileKind(doc)==='audio'?'♫  Audio':'▣  Datei'}];
}
function showFileTabs(doc){
  const regular=$('#markdownTabs'),tabs=$('#fileTypeTabs');if(!regular||!tabs)return;
  const nonMarkdown=!!doc&&fileKind(doc)!=='markdown';
  regular.classList.toggle('hidden',nonMarkdown||appSettingsOpen);
  tabs.classList.toggle('hidden',!nonMarkdown||appSettingsOpen);
  if(!nonMarkdown){tabs.replaceChildren();return}
  const options=filePanelOptions(doc);
  if(!options.some(opt=>opt.id===activeFilePanel))activeFilePanel=options[0].id;
  tabs.innerHTML=options.map(tab=>`<button type="button" class="file-subtab ${activeFilePanel===tab.id?'active':''}" data-file-panel="${tab.id}" role="tab" aria-selected="${activeFilePanel===tab.id}" title="${escapeHtml(tab.label.trim())}">${escapeHtml(tab.label)}</button>`).join('');
  tabs.onclick=async event=>{
    const button=event.target.closest('[data-file-panel]');if(!button||button.dataset.filePanel===activeFilePanel)return;
    try{await flushSource();activeFilePanel=button.dataset.filePanel;render()}
    catch(error){console.error(error);toast('Änderungen konnten nicht gespeichert werden')}
  };
}
function releaseWorkspacePreview(){if(workspacePreviewURL){URL.revokeObjectURL(workspacePreviewURL);workspacePreviewURL=null}}
function workspaceBytes(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  return new Uint8Array();
}
// Script editing and its highlighting/minimap are implemented in script-editor.js.
function renderScriptView(){renderEnhancedScriptEditor()}
// SVG source is displayed only inside an <img>, never inserted as live HTML.
function renderSvgPreview(){
  const doc=documentNow();
  workspacePreviewURL=URL.createObjectURL(new Blob([doc.content||''],{type:'image/svg+xml'}));
  $('#surface').innerHTML=`<div class="file-preview image-preview svg-preview"><img src="${workspacePreviewURL}" alt="SVG-Vorschau: ${escapeHtml(fileLabel(doc))}"><div class="file-preview-caption">${escapeHtml(workspacePath(doc))} · SVG-Vorschau</div></div>`;
  const image=$('#surface img');image.onerror=()=>{if(!image.isConnected)return;image.remove();$('#surface .svg-preview').insertAdjacentHTML('afterbegin','<div class="binary-note">SVG kann nicht als Bild angezeigt werden. Der Quelltext bleibt in „Script“ bearbeitbar.</div>')};
}

function renderImageView(){
  const doc=documentNow(),bytes=workspaceBytes(doc.data),mime=WORKSPACE_IMAGE_MIME[pathExtension(workspacePath(doc))]||'application/octet-stream';
  workspacePreviewURL=URL.createObjectURL(new Blob([bytes],{type:mime}));
  $('#surface').innerHTML=`<div class="file-preview image-preview"><img src="${workspacePreviewURL}" alt="${escapeHtml(fileLabel(doc))}"><div class="file-preview-caption">${escapeHtml(workspacePath(doc))} · ${workspaceSize(bytes.length)}</div></div>`;
  const image=$('#surface img');image.onerror=()=>{if(image.isConnected){image.remove();$('#surface .file-preview').insertAdjacentHTML('afterbegin','<div class="binary-note">Dieses Bildformat kann vom Browser nicht dargestellt werden.</div>')}};
}
// Native controls provide play/pause, seeking, duration, volume and download
// via browser UI. The preview URL is revoked when changing the document/view.
function renderAudioView(){
  const doc=documentNow(),bytes=workspaceBytes(doc.data);
  const path=workspacePath(doc),mime=WORKSPACE_AUDIO_MIME[pathExtension(path)]||'application/octet-stream';
  workspacePreviewURL=URL.createObjectURL(new Blob([bytes],{type:mime}));
  $('#surface').innerHTML=`<div class="file-preview audio-preview">
    <div class="audio-preview-icon" aria-hidden="true">♫</div>
    <h2>${escapeHtml(fileLabel(doc))}</h2>
    <audio controls preload="metadata" aria-label="${escapeHtml('Audio abspielen: '+fileLabel(doc))}" src="${workspacePreviewURL}">Dein Browser unterstützt keine Audiowiedergabe.</audio>
    <p class="binary-note hidden" id="audioPreviewError" role="alert">Diese Audiodatei kann vom Browser nicht abgespielt werden.</p>
    <div class="file-preview-caption">${escapeHtml(path)} · ${workspaceSize(bytes.length)}</div>
  </div>`;
  const audio=$('#surface audio');
  audio.addEventListener('error',()=>$('#audioPreviewError')?.classList.remove('hidden'));
}
function workspaceSize(size){if(size<1024)return size+' B';if(size<1024*1024)return (size/1024).toFixed(1)+' KB';return (size/1024/1024).toFixed(1)+' MB'}
function renderBinaryView(){
  const d=documentNow(),length=workspaceBytes(d.data).length;
  $('#surface').innerHTML=`<div class="file-preview binary-preview"><div class="binary-glyph" aria-hidden="true">▣</div><h2>${escapeHtml(fileLabel(d))}</h2><p>Der Inhalt dieser Binärdatei kann nicht dargestellt werden.</p><small>${escapeHtml(workspacePath(d))} · ${workspaceSize(length)}</small></div>`;
}
function decodeWorkspaceText(bytes,path){
  if(bytes.length>=2&&bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le').decode(bytes);
  if(bytes.length>=2&&bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be').decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
  catch(error){if(isMarkdownPath(path)||knownTextPath(path))return new TextDecoder('windows-1252').decode(bytes);return null}
}
function seemsText(bytes){
  if(!bytes.length)return true;
  if(bytes.includes(0))return false;
  let controls=0;for(const b of bytes.slice(0,4096)){if(b<32&&b!==9&&b!==10&&b!==13&&b!==12)controls++}
  return controls<=Math.max(1,Math.floor(Math.min(bytes.length,4096)*.005));
}
function importedFileRecord(path,bytes,metadata={}){
  const ext=pathExtension(path),name=docNameForPath(path);
  let fileType='binary',content;
  if(WORKSPACE_IMAGE_MIME[ext]&&ext!=='svg')fileType='image';
  else if(WORKSPACE_AUDIO_MIME[ext])fileType='audio';
  else if(isMarkdownPath(path)||knownTextPath(path)||seemsText(bytes)){
    const decoded=decodeWorkspaceText(bytes,path);
    if(decoded!==null){fileType=isMarkdownPath(path)?'markdown':'script';content=decoded}
  }
  const originalContent=content;
  if(fileType==='markdown')content=markdownWithRoot(path,content);
  const result={id:uid(),projectId:null,name,path,fileType,
    ...(fileType==='markdown'||fileType==='script'?{content,originalContent,raw:bytes}:{data:bytes})};
  if(fileType==='markdown'){
    result.mapCollapsedPaths=Array.isArray(metadata.mapCollapsedPaths)?metadata.mapCollapsedPaths:[];
    result.mapPositions=metadata.mapPositions||{};
  }
  return result;
}
function exportFileBytes(doc){
  if(!docIsText(doc))return workspaceBytes(doc.data);
  if(doc.raw&&doc.content===doc.originalContent)return workspaceBytes(doc.raw);
  return new TextEncoder().encode(doc.content||'');
}
// ZIP format: standard non-encrypted ZIP (stored/deflate), with safe paths and CRC validation.
const ZIP_MAX_TOTAL=512*1024*1024,ZIP_MAX_ENTRY=256*1024*1024,ZIP_MAX_ENTRIES=20000;
const ZIP_UTF8=new TextEncoder(),ZIP_DECODE=new TextDecoder();
const ZIP_CRC_TABLE=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0});
function zipCRC32(bytes){let c=0xffffffff;for(let i=0;i<bytes.length;i++)c=(c>>>8)^ZIP_CRC_TABLE[(c^bytes[i])&255];return (c^0xffffffff)>>>0}
function zipEntryName(bytes,utf8){
  if(utf8)return ZIP_DECODE.decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch(_){return new TextDecoder('windows-1252').decode(bytes)}
}
async function unzipWorkspace(buffer){
  const data=new Uint8Array(buffer),view=new DataView(buffer);
  if(data.length<22)throw Error('ZIP-Datei ist unvollständig');
  const low=Math.max(0,data.length-22-65535);let end=-1;
  for(let i=data.length-22;i>=low;i--){if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===data.length){end=i;break}}
  if(end<0)throw Error('ZIP-Endverzeichnis nicht gefunden');
  const count=view.getUint16(end+10,true),dirSize=view.getUint32(end+12,true),offset=view.getUint32(end+16,true);
  if(count===65535||offset===0xffffffff||dirSize===0xffffffff)throw Error('ZIP64-Dateien werden noch nicht unterstützt');
  if(count>ZIP_MAX_ENTRIES)throw Error('ZIP enthält zu viele Einträge');
  if(view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0||view.getUint16(end+8,true)!==count)throw Error('Mehrteilige ZIP-Dateien werden nicht unterstützt');
  if(offset+dirSize>end)throw Error('ZIP-Verzeichnis ist beschädigt');
  let pos=offset,total=0;const output=[],seen=new Set();
  for(let i=0;i<count;i++){
    if(pos+46>data.length||view.getUint32(pos,true)!==0x02014b50)throw Error('Beschädigter ZIP-Eintrag');
    const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),crc=view.getUint32(pos+16,true),compressed=view.getUint32(pos+20,true),expanded=view.getUint32(pos+24,true),nl=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true);
    if(flags&1)throw Error('Verschlüsselte ZIP-Dateien werden nicht unterstützt');
    if(![0,8].includes(method))throw Error('ZIP-Komprimierung '+method+' wird nicht unterstützt');
    if(expanded>ZIP_MAX_ENTRY||(total+=expanded)>ZIP_MAX_TOTAL)throw Error('ZIP ist für die Browser-Speicherung zu groß');
    if(pos+46+nl+extra+comment>data.length)throw Error('ZIP-Dateiname ist beschädigt');
    const zipName=zipEntryName(data.subarray(pos+46,pos+46+nl),!!(flags&0x800));
    const directory=zipName.endsWith('/'),rootMarker=directory&&zipName==='./',path=rootMarker?'':workspaceValidPath(zipName);
    if(!rootMarker&&!path)throw Error('Ungültiger ZIP-Pfad: '+zipName.slice(0,100));
    if(!rootMarker&&seen.has(path))throw Error('ZIP enthält einen doppelten Dateipfad: '+path);
    if(!rootMarker)seen.add(path);
    if(local+30>data.length||view.getUint32(local,true)!==0x04034b50)throw Error('ZIP-Eintragskopf ist beschädigt');
    const begin=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(begin+compressed>data.length)throw Error('ZIP-Daten sind unvollständig');
    let bytes=data.slice(begin,begin+compressed);
    if(!directory&&method===8){
      if(typeof DecompressionStream==='undefined')throw Error('Dieser Browser kann Deflate-ZIP-Dateien nicht entpacken');
      try{const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));bytes=new Uint8Array(await new Response(stream).arrayBuffer())}
      catch(error){throw Error('Komprimierter ZIP-Eintrag konnte nicht entpackt werden: '+path)}
    }else if(directory&&method===8&&compressed){
      if(typeof DecompressionStream==='undefined')throw Error('Komprimierter ZIP-Ordner wird nicht unterstützt');
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if(bytes.length!==expanded||zipCRC32(bytes)!==crc)throw Error('ZIP-Prüfsumme oder Dateigröße fehlerhaft: '+path);
    if(!rootMarker)output.push({path,directory,bytes});pos+=46+nl+extra+comment;
  }
  return output;
}
function zipWorkspace(entries){
  if(entries.length>65535)throw Error('Zu viele Dateien für ZIP-Export');
  const parts=[],central=[];let offset=0,dirSize=0;
  for(const {path,bytes:source} of entries){
    const name=ZIP_UTF8.encode(path),bytes=typeof source==='string'?ZIP_UTF8.encode(source):workspaceBytes(source);
    const crc=zipCRC32(bytes),local=new Uint8Array(30+name.length),a=new DataView(local.buffer);
    a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0x800,true);a.setUint32(14,crc,true);a.setUint32(18,bytes.length,true);a.setUint32(22,bytes.length,true);a.setUint16(26,name.length,true);local.set(name,30);
    const center=new Uint8Array(46+name.length),b=new DataView(center.buffer);
    b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);b.setUint16(8,0x800,true);b.setUint32(16,crc,true);b.setUint32(20,bytes.length,true);b.setUint32(24,bytes.length,true);b.setUint16(28,name.length,true);b.setUint32(42,offset,true);center.set(name,46);
    parts.push(local,bytes);central.push(center);offset+=local.length+bytes.length;dirSize+=center.length;
    if(offset>0xffffffff)throw Error('ZIP-Export größer als 4 GB wird nicht unterstützt');
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,dirSize,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
function saveWorkspaceBlob(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function workspaceExportMetadataPath(occupied){
  let n=1;while(true){const path=n===1?'mindfagg-workspace.json':`mindfagg-workspace-${n}.json`;if(!occupied.has(path))return path;n++}
}
async function exportProject(){return downloadWorkspaceZip()}

function workspaceImportedName(base){let name=base||'Importierter Workspace',index=2;while(projects.some(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase())){name=(base||'Importierter Workspace')+' ('+index+')';index++}return name}
function commitImportedWorkspace(p,items){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(['projects','docs'],'readwrite');
    transaction.objectStore('projects').add(p);
    for(const doc of items)transaction.objectStore('docs').add(doc);
    transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error||new Error('Speicherfehler'));transaction.onabort=()=>reject(transaction.error||new Error('Import abgebrochen'));
  });
}
async function importProject(file){return openZipImportDialog(file)}
