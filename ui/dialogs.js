'use strict';
// Projekt- und Dokumentdialoge, Knotenformulare, Einstellungen sowie ZIP-Import/Export.
function openModal(html){$('#modal').classList.remove('node-modal');$('#modal').innerHTML=html;$('#modalBack').classList.remove('hidden')}
function closeModal(){if(typeof githubBusy!=='undefined'&&githubBusy&&($('#githubModal')||$('#githubConflictModal')))return;$('#modalBack').classList.add('hidden')}
// A drag starting inside a dialog may end on the backdrop (e.g. when selecting
// input text). Its synthesized click must NOT dismiss the dialog.
let modalBackdropPointerStart=false,modalBackdropPointerEnd=false;
$('#modalBack').addEventListener('pointerdown',event=>{modalBackdropPointerStart=event.target===$('#modalBack');modalBackdropPointerEnd=false});
$('#modalBack').addEventListener('pointerup',event=>{modalBackdropPointerEnd=event.target===$('#modalBack')});
$('#modalBack').addEventListener('pointercancel',()=>{modalBackdropPointerStart=false;modalBackdropPointerEnd=false});
$('#modalBack').addEventListener('click',event=>{
  if(event.target===$('#modalBack')&&modalBackdropPointerStart&&modalBackdropPointerEnd)closeModal();
  modalBackdropPointerStart=false;modalBackdropPointerEnd=false;
});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal()});
function formActions(label='Speichern'){return `<div class="modalactions"><button class="btn" type="button" id="cancelModal">Abbrechen</button><button class="btn primary" type="submit">${label}</button></div>`}function wireCancel(){$('#cancelModal').onclick=closeModal}
function openProjectSettings(){
  const p=project();if(!p)return;
  const settings=statusSettingsFor(p);
  const rows=STATUS.map(key=>`<div class="status-setting-row">
    <span class="status-code" title="Markdown: [status:${key}]">${key}</span>
    <input type="text" id="statusLabel-${key}" aria-label="Bezeichnung für ${key}" maxlength="36" required value="${escapeHtml(settings[key].label)}">
    <input type="color" id="statusColor-${key}" aria-label="Farbe für ${key}" value="${settings[key].color}">
  </div>`).join('');
  openModal(`<h2>Projekteinstellungen</h2><p>Projektname, Akzentfarbe und Knoten-Status bearbeiten.</p>
    <form id="projectSettingsForm">
      <div class="field"><label for="projectNameDisplay">Projektname</label>
        <button type="button" id="projectNameDisplay" class="project-name-display" title="Projektname anklicken zum Bearbeiten" aria-label="Projektname bearbeiten"><span class="project-name-value">${escapeHtml(p.name)}</span><span class="project-name-pencil" aria-hidden="true">✎</span></button>
        <input type="text" id="projectNameInput" class="hidden" maxlength="90" required aria-label="Projektname eingeben" value="${escapeHtml(p.name)}">
      </div>
      <div class="field"><label for="projectAccent">Akzentfarbe</label>
        <div class="project-accent-field"><input type="color" id="projectAccent" aria-label="Akzentfarbe auswählen" value="${projectAccentColor(p)}"><small class="field-note">Gilt für die Oberfläche dieses Projekts. Statusfarben bleiben separat einstellbar.</small></div>
      </div>
      <div class="field github-project-assignment"><label>GitHub-Repository</label>
        <div class="github-project-assignment-line"><span id="githubProjectAssignment">${escapeHtml(githubConnection(p)?githubConnection(p).owner+'/'+githubConnection(p).repo+' · '+githubConnection(p).branch:'Kein Repository zugeordnet')}</span><button type="button" class="btn" id="projectGithubRepo">${githubConnection(p)?'Ändern':'Zuordnen'}</button></div>
        <small class="field-note">GitHub-Zugangsdaten werden unter mindfagg App-Einstellungen gespeichert.</small>
      </div>
      <div class="field"><label>Knoten-Status</label>
        <div class="status-settings-grid"><div class="status-setting-head"><span>Kennung</span><span>Bezeichnung</span><span>Farbe</span></div>${rows}</div>
        <small class="field-note status-settings-note">Kennungen wie <code>[status:doing]</code> bleiben im Markdown unverändert. Bezeichnungen und Farben gelten nur für dieses Projekt.</small>
      </div>
      <div class="modalactions project-modal-actions"><button type="button" class="btn delete-project" id="deleteProject">Projekt löschen</button>
        <span class="project-action-spacer" aria-hidden="true"></span>
        <button type="button" class="btn" id="cancelModal">Abbrechen</button>
        <button type="submit" class="btn primary">Einstellungen speichern</button></div>
    </form>`);
  wireCancel();
  const nameButton=$('#projectNameDisplay'),nameInput=$('#projectNameInput');
  function finishNameEdit(apply=true){
    if(nameInput.classList.contains('hidden'))return;
    if(!apply)nameInput.value=nameButton.querySelector('.project-name-value').textContent;
    const value=nameInput.value.replace(/\s+/g,' ').trim();
    if(!value){nameInput.value=nameButton.querySelector('.project-name-value').textContent;toast('Projektname darf nicht leer sein')}
    nameInput.value=value;
    nameButton.querySelector('.project-name-value').textContent=value;
    nameInput.classList.add('hidden');nameButton.classList.remove('hidden');
  }
  nameButton.onclick=()=>{nameButton.classList.add('hidden');nameInput.classList.remove('hidden');nameInput.focus();nameInput.select()};
  nameInput.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();finishNameEdit(true)}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finishNameEdit(false)}
  });
  nameInput.addEventListener('blur',()=>finishNameEdit(true));
  $('#deleteProject').onclick=()=>confirmProjectDelete(p.id);
  $('#projectGithubRepo').onclick=()=>openGithubDialog();
  $('#projectSettingsForm').onsubmit=async event=>{
    event.preventDefault();
    const name=nameInput.value.replace(/\s+/g,' ').trim();
    if(!name){nameButton.click();nameInput.focus();toast('Projektname darf nicht leer sein');return}
    const next={};
    for(const key of STATUS){
      const label=$('#statusLabel-'+key).value.replace(/\s+/g,' ').trim().slice(0,36);
      if(!label){$('#statusLabel-'+key).focus();toast('Status-Bezeichnungen dürfen nicht leer sein');return}
      next[key]={label,color:$('#statusColor-'+key).value};
    }
    const previous={name:p.name,statusSettings:p.statusSettings,accentColor:p.accentColor};
    p.name=name;p.statusSettings=next;p.accentColor=$('#projectAccent').value;
    const submit=$('#projectSettingsForm [type="submit"]');submit.disabled=true;
    try{await put('projects',{...p})}
    catch(error){Object.assign(p,previous);console.error(error);toast('Projekteinstellungen konnten nicht gespeichert werden');submit.disabled=false;return}
    closeModal();render();toast('Projekteinstellungen gespeichert');
  };
}
// Project removal and recovery are atomic across the project and all its documents.
function commitProjectRemoval(id){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(['projects','docs'],'readwrite');
    const docStore=transaction.objectStore('docs');
    for(const d of docs.filter(item=>item.projectId===id))docStore.delete(d.id);
    transaction.objectStore('projects').delete(id);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Projekt konnte nicht gelöscht werden'));
    transaction.onabort=()=>reject(transaction.error||new Error('Projektlöschung abgebrochen'));
  });
}
function commitProjectRestore(action){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(['projects','docs'],'readwrite');
    transaction.objectStore('projects').add(structuredClone(action.project));
    for(const d of action.documents)transaction.objectStore('docs').add(structuredClone(d));
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Projekt konnte nicht wiederhergestellt werden'));
    transaction.onabort=()=>reject(transaction.error||new Error('Projektwiederherstellung abgebrochen'));
  });
}
function forgetDeletedProject(id){
  // v34: the token is app-wide; deleting a project only clears its local status.
  githubProjectStatuses.delete(id);if(githubReview?.projectId===id)githubReview=null;
  projects=projects.filter(p=>p.id!==id);
  const deleted=docs.filter(d=>d.projectId===id);
  docs=docs.filter(d=>d.projectId!==id);
  for(const d of deleted){
    persistedDocSnapshots.delete(d.id);pendingDocWrites.delete(d.id);failedDocWrites.delete(d.id);
  }
}
function selectNextAvailableProject(){
  const next=[...projects].sort((a,b)=>projectChangedAt(b)-projectChangedAt(a))[0];
  docId=null;selectProject(next?.id||null);
}
async function restoreDeletedProject(action){
  if(projects.some(p=>p.id===action.project.id)){toast('Projekt ist bereits vorhanden');return false}
  if(action.documents.some(d=>docs.some(item=>item.id===d.id))){toast('Eine Dokument-ID ist bereits vorhanden');return false}
  await commitProjectRestore(action);
  projects.push(structuredClone(action.project));
  for(const d of action.documents){
    const restored=structuredClone(d);docs.push(restored);
    persistedDocSnapshots.set(restored.id,docSnapshot(restored));failedDocWrites.delete(restored.id);
    mapCollapsedPaths.set(restored.id,new Set(restored.mapCollapsedPaths||[]));
  }
  docId=action.selectedDocId;
  selectProject(action.project.id);
  return true;
}
async function repeatDeletedProject(action){
  if(!projects.some(p=>p.id===action.project.id)){toast('Projekt wurde bereits gelöscht');return false}
  await commitProjectRemoval(action.project.id);
  forgetDeletedProject(action.project.id);
  selectNextAvailableProject();
  return true;
}
function confirmProjectDelete(id){
  const p=projects.find(item=>item.id===id);if(!p)return;
  const count=docs.filter(d=>d.projectId===id).length;
  openModal(`<h2>Projekt löschen?</h2>
    <p>Soll <strong>${escapeHtml(p.name)}</strong> einschließlich ${count} ${count===1?'Dokument':'Dokumenten'} gelöscht werden?</p>
    <div class="project-delete-warning">Alle Dokumente des Projekts werden gelöscht. Die Aktion kann in dieser Sitzung über Rückgängig wiederhergestellt werden.</div>
    <div class="modalactions"><button type="button" class="btn" id="cancelProjectDelete">Zurück</button>
      <button type="button" class="btn delete-project" id="confirmProjectDelete">Projekt löschen</button></div>`);
  $('#cancelProjectDelete').onclick=()=>openProjectSettings();
  $('#confirmProjectDelete').onclick=async()=>{
    if(historyBusy)return;
    const button=$('#confirmProjectDelete');button.disabled=true;
    historyBusy=true;updateHistoryButtons();
    try{
      await flushMapInlineEdit();
      await flushSource();
      clearTimeout(saveTimer);
      const current=projects.find(item=>item.id===id);
      if(!current)throw new Error('Projekt nicht mehr gefunden');
      const action={project:structuredClone(current),documents:docs.filter(d=>d.projectId===id).map(d=>structuredClone(d)),selectedDocId:docId};
      await commitProjectRemoval(id);
      forgetDeletedProject(id);
      projectDeletionHistory.undo.push({...action,stamp:++historySerial});
      if(projectDeletionHistory.undo.length>100)projectDeletionHistory.undo.shift();
      projectDeletionHistory.redo.length=0;
      selectNextAvailableProject();
      closeModal();toast('Projekt gelöscht · Rückgängig zum Wiederherstellen');
    }catch(error){console.error(error);toast('Projekt konnte nicht gelöscht werden')}
    finally{historyBusy=false;if(button.isConnected)button.disabled=false;updateHistoryButtons()}
  };
}
// Create the project and its initial Markdown document atomically.
function commitNewProject(p,d){
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction(['projects','docs'],'readwrite');
    p.updatedAt=p.created;d.updatedAt=p.created;
    transaction.objectStore('projects').add(p);
    transaction.objectStore('docs').add(d);
    transaction.oncomplete=()=>{invalidateProjectRedo();resolve()};
    transaction.onerror=()=>reject(transaction.error||new Error('Projekt konnte nicht erstellt werden'));
    transaction.onabort=()=>reject(transaction.error||new Error('Projekttransaktion abgebrochen'));
  });
}
function createProject(){
  openModal(`<h2>Neues Projekt</h2><p>Ein neues Projekt erhält automatisch ein Dokument namens „Projekt“.</p><form id="projectForm"><div class="field"><label>Projektname</label><input id="projectName" maxlength="90" required placeholder="Mein neues Projekt" autofocus></div>${formActions('Projekt erstellen')}</form>`);
  wireCancel();
  $('#projectForm').onsubmit=async e=>{
    e.preventDefault();
    const name=$('#projectName').value.trim();if(!name)return;
    const submit=e.submitter||$('#projectForm').querySelector('[type="submit"]');submit.disabled=true;
    const p={id:uid(),name,created:Date.now(),statusSettings:statusSettingsFor(null),accentColor:DEFAULT_PROJECT_ACCENT};
    const d=newProjectDocument(uid(),p.id);
    try{
      await flushSource();
      await commitNewProject(p,d);
      await refresh();
      setView('markdown');selectProject(p.id);
      closeModal();toast('Projekt mit Dokument erstellt');
    }catch(error){console.error(error);toast('Projekt konnte nicht erstellt werden')}
    finally{submit.disabled=false}
  };
}
function createDocument(){
  if(!projectId)return createProject();
  openModal(`<h2>Datei erstellen</h2><p>Markdown-Dateien erhalten die Endung .md; andere Textdateien öffnen die einfache Script-Ansicht.</p>
    <form id="docForm"><div class="field"><label for="newDocName">Dateiname</label>
      <input id="newDocName" required maxlength="200" placeholder="Notizen.md, app.js oder config.json" autofocus></div>
      <div class="field"><label for="newDocFolder">Ordner</label><select id="newDocFolder">${workspaceFolderOptions()}</select><button type="button" class="btn" id="newFolderFromFile" style="justify-self:start">Neuen Ordner anlegen</button></div>
      ${formActions('Datei erstellen')}</form>`);
  wireCancel();
  $('#newFolderFromFile').onclick=()=>createWorkspaceFolder();
  $('#docForm').onsubmit=async e=>{
    e.preventDefault();const input=$('#newDocName').value.trim(),folder=$('#newDocFolder').value;
    let name=input;if(!name.includes('.'))name+='.md';
    if(!name||name.includes('/')||name.includes('\\')||name==='.'||name==='..')return toast('Ungültiger Dateiname');
    const path=workspaceValidPath([folder,name].filter(Boolean).join('/'));
    if(!path)return toast('Ungültiger Dateipfad');
    if(!workspaceUniquePath(path))return toast('Dateiname in diesem Ordner bereits vergeben');
    if(!isMarkdownPath(path)&&!knownTextPath(path))return toast('Neue Dateien müssen ein Textformat haben; Binärdateien per ZIP importieren');
    const markdown=isMarkdownPath(path);
    const d={id:uid(),projectId,path,name:docNameForPath(path),fileType:markdown?'markdown':'script',content:markdown?'# '+docNameForPath(path)+'\n':''};
    try{await recordWorkspaceFileCreation(d);selectDocument(d.id);closeModal();toast('Datei erstellt · Rückgängig möglich')}
    catch(error){console.error(error);toast('Datei konnte nicht erstellt werden')}
  };
}
function renameDocument(){
  const d=documentNow();if(!d)return;
  openModal(`<h2>Datei umbenennen oder verschieben</h2><form id="renameForm">
    <div class="field"><label for="renameValue">Dateiname</label><input id="renameValue" required maxlength="200" value="${escapeHtml(fileLabel(d))}"></div>
    <div class="field"><label for="renameFolder">Ordner</label><select id="renameFolder">${workspaceFolderOptions(pathParent(workspacePath(d)))}</select></div>
    <div class="modalactions document-modal-actions">
      <button type="button" class="btn delete-document" id="deleteDocument">Löschen</button>
      <span class="document-action-spacer" aria-hidden="true"></span>
      <button class="btn" type="button" id="cancelModal">Abbrechen</button>
      <button class="btn primary" type="submit">Speichern</button>
    </div></form>`);
  wireCancel();
  $('#deleteDocument').onclick=deleteCurrentDocument;
  $('#renameForm').onsubmit=async e=>{
    e.preventDefault();let name=$('#renameValue').value.trim(),folder=$('#renameFolder').value;
    if(!name.includes('.')&&fileKind(d)==='markdown')name+='.md';
    if(!name||name.includes('/')||name.includes('\\')||name==='.'||name==='..')return toast('Ungültiger Dateiname');
    const path=workspaceValidPath([folder,name].filter(Boolean).join('/'));
    if(!path||!workspaceUniquePath(path,d.id))return toast('Dateipfad existiert bereits oder ist ungültig');
    const previous={path:d.path,name:d.name,fileType:d.fileType};
    const wasText=docIsText(d);
    d.path=path;d.name=docNameForPath(path);
    if(wasText)d.fileType=isMarkdownPath(path)?'markdown':'script';
    try{await put('docs',{...d})}
    catch(error){Object.assign(d,previous);console.error(error);toast('Datei konnte nicht umbenannt werden');return}
    changeWorkspaceFolder(folder);closeModal();render();toast('Datei gespeichert');
  };
}
async function deleteCurrentDocument(){
  if(historyBusy||!documentNow())return;
  historyBusy=true;updateHistoryButtons();
  const button=$('#deleteDocument');if(button)button.disabled=true;
  try{
    // Save any pending editor input before preserving the deleted document for undo.
    await flushSource();
    clearTimeout(saveTimer);
    const current=documentNow();
    const others=docs.filter(item=>item.projectId===current.projectId&&item.id!==current.id);
    const replacement=others.length?null:newProjectDocument(uid(),current.projectId);
    const next=others[0]||replacement;
    const record={document:structuredClone(current),projectId:current.projectId,
      placeholder:replacement?structuredClone(replacement):null,successorId:next.id};
    await commitDocumentChanges(replacement?[replacement]:[],[current.id]);
    applyDocumentChanges(replacement?[replacement]:[],[current.id]);
    docHistoryFor(current.id).redo.length=0;
    const history=deletionHistoryFor(current.projectId);
    history.undo.push({...record,stamp:++historySerial});
    if(history.undo.length>100)history.undo.shift();
    history.redo.length=0;
    docId=next.id;scopePath='0';
    closeModal();render();toast('Dokument gel\u00f6scht \u00b7 R\u00fcckg\u00e4ngig zum Wiederherstellen');
  }catch(error){console.error(error);toast('Dokument konnte nicht gel\u00f6scht werden')}
  finally{historyBusy=false;if(button?.isConnected)button.disabled=false;updateHistoryButtons()}
}
// Date controls are shared by the node editor and the creation dialog.
function dateSelectOptions(unit,selected){
  const maxima={y:100,m:120,d:365},max=maxima[unit];
  const choices=Array.from({length:max+1},(_,n)=>n);
  if(Number.isSafeInteger(selected)&&selected>max)choices.push(selected);
  return choices.map(n=>`<option value="${n}" ${n===selected?'selected':''}>${n||'–'}</option>`).join('');
}
function nodeDateFieldsHtml(value=null){
  const date=value||{start:'',duration:{y:0,m:0,d:0}};
  return `<div class="field node-date-fields">
    <span class="node-date-label">Datum / Zeitraum</span>
    <div class="node-date-layout">
      <div class="node-date-start"><label for="nodeDateStart">Start</label><input id="nodeDateStart" type="date" value="${escapeHtml(date.start)}" min="0001-01-01" max="9999-12-31"></div>
      <div class="node-date-durations">
        <div class="node-duration-selects">
          <div><label for="nodeDateYears">Jahre (y)</label><select id="nodeDateYears">${dateSelectOptions('y',date.duration.y)}</select></div>
          <div><label for="nodeDateMonths">Monate (m)</label><select id="nodeDateMonths">${dateSelectOptions('m',date.duration.m)}</select></div>
          <div><label for="nodeDateDays">Tage (d)</label><select id="nodeDateDays">${dateSelectOptions('d',date.duration.d)}</select></div>
        </div>
      </div>
    </div>
    <small class="field-note node-date-preview" id="nodeDatePreview" aria-live="polite"></small>
  </div>`;
}
function readNodeDateFields(){
  const start=$('#nodeDateStart').value;
  if(!start)return null;
  const duration={y:Number($('#nodeDateYears').value),m:Number($('#nodeDateMonths').value),d:Number($('#nodeDateDays').value)};
  return parseNodeDatePayload(start+['y','m','d'].filter(unit=>duration[unit]>0).map(unit=>' +'+duration[unit]+unit).join(''));
}
function wireNodeDateFields(){
  const start=$('#nodeDateStart'),preview=$('#nodeDatePreview');
  if(!start||!preview)return;
  function update(){
    const empty=!start.value;
    for(const id of ['#nodeDateYears','#nodeDateMonths','#nodeDateDays'])$(id).disabled=empty;
    if(empty){preview.textContent='Ohne Startdatum wird kein [date:…]-Tag gespeichert.';return}
    const date=readNodeDateFields();
    if(!date){preview.textContent='Bitte ein gültiges Startdatum wählen.';return}
    const hasDuration=Object.values(date.duration).some(Boolean);
    const end=hasDuration?nodeDateEnd(date):null;
    preview.textContent=hasDuration?(end?'Zeitraum: '+date.start+' → '+end:'Zeitraum überschreitet den darstellbaren Kalenderbereich.'):'Einzeldatum: '+date.start;
  }
  start.addEventListener('input',update);start.addEventListener('change',update);
  for(const id of ['#nodeDateYears','#nodeDateMonths','#nodeDateDays'])$(id).addEventListener('change',update);
  update();
}
function lineEdit(n,props){
  const d=documentNow(),ls=d.content.replace(/\r\n?/g,'\n').split('\n'),line=ls[n.start];
  if(line===undefined)return false;
  const oldPrefix=n.kind==='h'?line.match(/^\s*#{1,6}\s*/)?.[0]:line.match(/^\s*(?:[-+*]|\d+[.)])\s+/)?.[0];
  if(!oldPrefix)return false;
  const type=props.nodeType??nodeTypeValue(n);
  const leading=(line.match(/^\s*/)||[''])[0];
  let prefix;
  if(/^h[1-6]$/.test(type)){
    prefix=(n.kind==='h'?leading.slice(0,3):'')+'#'.repeat(Number(type.slice(1)))+' ';
  }else if(/^ul[-+*]$/.test(type)){
    prefix=(n.kind==='li'?leading:'')+type.slice(2)+' ';
  }else if(type==='ol.'||type==='ol)'){
    const num=n.kind==='li'&&/^\d+[.)]$/.test(n.marker||'')?Number.parseInt(n.marker,10):1;
    prefix=(n.kind==='li'?leading:'')+num+type.slice(2)+' ';
  }else return false;
  const title=props.title??n.title,requestedStatus=props.status===undefined?n.status:props.status,
        status=requestedStatus==='story'?null:requestedStatus,
        checked=props.checked===undefined?n.checked:props.checked,
        date=props.date===undefined?n.date:props.date;
  const parts=[];
  if(checked!==null)parts.push(checked?'[x]':'[ ]');
  if(status!==null&&status!==undefined&&status!=='')parts.push('[status:'+status+']');
  if(date?.start)parts.push(serializeNodeDate(date));
  parts.push(title);
  ls[n.start]=prefix+parts.join(' ');
  const result=ls.join('\n');
  if(scanMarkdown(result).roots.length!==1){
    toast('Pro Dokument ist genau eine H1 erforderlich. Knotentyp wurde nicht geändert.');
    return false;
  }
  d.content=result;
  return d;
}
async function patchNode(path,props){let n=flattened(currentModel).find(n=>n.path===path);if(!n)return;let d=lineEdit(n,props);if(d){await put('docs',d);render()}}
function editNode(path){
  const n=flattened(currentModel).find(item=>item.path===path);
  if(!n||n.kind==='virtual')return;
  const refs=[...n.title.matchAll(/\[\[([^\]#|]+)(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/g)];
  const previousType=nodeTypeValue(n);
  const typeOptions=NODE_TYPES.map(t=>`<option value="${t.value}" ${t.value===previousType?'selected':''}>${escapeHtml(t.label)}</option>`).join('');
  // v37: Mindmap, Kanban and calendar share the same node editor and status control.
  openModal(`<h2><label for="nodeTitle">Knoten bearbeiten</label></h2><form id="nodeForm" class="node-form">
    <div class="field"><input id="nodeTitle" aria-label="Knoten bearbeiten: Titel" required value="${escapeHtml(n.title)}"></div>
    <div class="node-properties"><div class="field"><label for="nodeType">Knotentyp</label><select id="nodeType">${typeOptions}</select></div>
    <div class="field"><label for="nodeStatus">Status</label><select id="nodeStatus">${STATUS.map(st=>`<option value="${st}" ${st===(n.status||'story')?'selected':''}>${escapeHtml(statusLabel(st))}</option>`).join('')}</select></div></div>
    <div class="field"><label>Aufgabenstatus (Checkbox)</label><div class="node-check-group"><label><input type="checkbox" id="nodeUseCheck" ${n.checked!==null?'checked':''}> Checkbox für diesen Knoten verwenden</label><label><input type="checkbox" id="nodeDone" ${n.checked===true?'checked':''} ${n.checked===null?'disabled':''}> Erledigt</label></div></div>
    <div class="field"><label for="nodeDescription">Beschreibung (Markdown)</label><textarea id="nodeDescription" autocomplete="off">${escapeHtml(n.description.join('\n').trim())}</textarea></div>
    ${nodeDateFieldsHtml(n.date)}
    ${refs.length?`<div class="field"><label>Dokumentenverknüpfungen</label>${refs.map((m,i)=>`<button type="button" class="btn" data-link="${i}" style="text-align:left">↗ ${escapeHtml(m[0])}</button>`).join('')}</div>`:''}
    ${formActions()}</form>`);
  $('#modal').classList.add('node-modal');
  wireCancel();
  $('#nodeUseCheck').onchange=()=>{$('#nodeDone').disabled=!$('#nodeUseCheck').checked};
  wireNodeDateFields();
  document.querySelectorAll('[data-link]').forEach(el=>el.onclick=()=>navigateLink(refs[Number(el.dataset.link)][1],refs[Number(el.dataset.link)][2]));
  $('#nodeForm').onsubmit=async e=>{
    e.preventDefault();
    const nextType=$('#nodeType').value;
    const date=readNodeDateFields();
    if($('#nodeDateStart').value&&!date){toast('Ungültiges Startdatum oder unzulässige Dauer');return}
    const d=lineEdit(n,{title:$('#nodeTitle').value.trim(),nodeType:nextType,
      status:$('#nodeStatus').value||null,
      checked:$('#nodeUseCheck').checked?$('#nodeDone').checked:null,
      date});
    if(!d)return;
    const lines=d.content.split('\n'),scan=scanMarkdown(d.content),start=n.start+1;
    let end=start;
    while(end<lines.length&&!['heading','list'].includes(scan.items[end]?.kind))end++;
    const desc=$('#nodeDescription').value.trim();
    const markerLine=lines[n.start];
    const isList=!nextType.startsWith('h');
    const indent=isList?(markerLine.match(/^\s*/)?.[0]||'')+'  ':'';
    const replacement=desc?desc.split('\n').map(l=>l?indent+l:''):[];
    if(n.children.length&&replacement.length)replacement.push('');
    lines.splice(start,end-start,...replacement);
    d.content=lines.join('\n');
    await put('docs',{...d});
    // Keep the selection anchored to the edited line if its node type changes.
    if(view==='mindmap'){
      const updated=parseMarkdown(d.content,scanMarkdown(d.content));
      const edited=flattened(updated).find(item=>item.start===n.start&&item.kind!=='virtual');
      if(edited)mapSelectedPaths.set(d.id,edited.path);
      else mapSelectedPaths.delete(d.id);
    }
    closeModal();render();toast('Knoten gespeichert');
  };
}
function navigateLink(name,heading){let d=docs.find(x=>x.projectId===projectId&&x.name.toLowerCase()===name.toLowerCase());if(!d)return toast('Zieldokument nicht gefunden: '+name);docId=d.id;setView('mindmap');scopePath='0';closeModal();render();if(heading){let target=flattened(currentModel).find(n=>n.kind==='h'&&plain(n.title).toLowerCase()===heading.toLowerCase());if(target){let el=[...document.querySelectorAll('[data-node]')].find(x=>x.dataset.node===target.path);centerMapNode(target.path)}else toast('Überschrift nicht gefunden: '+heading)}}
function addNode(){
  const root=currentRoot(),options=flattened(root);
  openModal(`<h2><label for="nodeTitle">Knoten erstellen</label></h2><form id="addForm" class="node-form">
    <div class="field"><input id="nodeTitle" required placeholder="Neuer Gedanke"></div>
    <div class="field"><label for="parentSelect">Übergeordneter Knoten</label><select id="parentSelect">${options.map(n=>`<option value="${n.path}">${escapeHtml(plain(n.title))}</option>`).join('')}</select></div>
    <div class="field"><label for="addStatus">Status</label><select id="addStatus">${STATUS.map(s=>`<option value="${s}">${escapeHtml(statusLabel(s))}</option>`).join('')}</select></div>
    ${nodeDateFieldsHtml()}
    ${formActions('Knoten hinzufügen')}</form>`);
  $('#modal').classList.add('node-modal');wireCancel();wireNodeDateFields();
  $('#addForm').onsubmit=async e=>{
    e.preventDefault();
    const date=readNodeDateFields();
    if($('#nodeDateStart').value&&!date){toast('Ungültiges Startdatum oder unzulässige Dauer');return}
    const parent=options.find(n=>n.path===$('#parentSelect').value),d=documentNow(),lines=d.content.split('\n');
    const indent=parent.kind==='li'?' '.repeat(parent.indent+2):'';
    const status=$('#addStatus').value;
    const metadata=[status&&status!=='story'?'[status:'+status+']':'',serializeNodeDate(date)].filter(Boolean).join(' ');
    const line=indent+'- '+(metadata?metadata+' ':'')+$('#nodeTitle').value.trim();
    const insertion=parent.kind==='h'?findHeadingEnd(lines,parent):findListEnd(lines,parent);
    lines.splice(insertion,0,line);d.content=lines.join('\n');await put('docs',{...d});
    closeModal();render();toast('Knoten hinzugefügt');
  };
}
function findHeadingEnd(lines,n){let i=n.start+1;for(;i<lines.length;i++){let m=lines[i].match(/^ {0,3}(#{1,6})\s/);if(m&&m[1].length<=n.level)break}return i}function findListEnd(lines,n){let i=n.start+1;for(;i<lines.length;i++){let m=lines[i].match(/^(\s*)(?:[-+*]|\d+[.)])\s/);if(/^ {0,3}#{1,6}\s/.test(lines[i])||(m&&m[1].length<=n.indent))break}return i}
// ZIP import/export and folder management are handled by workspace.js (v25).
