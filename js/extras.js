'use strict';
// Projekt- und Dokumentdialoge, Knotenformulare, Einstellungen sowie ZIP-Import/Export.
function openModal(html){$('#modal').classList.remove('node-modal');$('#modal').innerHTML=html;$('#modalBack').classList.remove('hidden')}function closeModal(){$('#modalBack').classList.add('hidden')};$('#modalBack').onclick=e=>{if(e.target===$('#modalBack'))closeModal()};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
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
      if(view==='markdown')await flushSource();
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
function createDocument(){if(!projectId)return createProject();openModal(`<h2>Neues Dokument</h2><p>Jedes Dokument besitzt einen eindeutigen Namen innerhalb des Projekts.</p><form id="docForm"><div class="field"><label>Dokumentname</label><input id="newDocName" required maxlength="100" placeholder="Planung"></div>${formActions('Dokument erstellen')}</form>`);wireCancel();$('#docForm').onsubmit=async e=>{e.preventDefault();let name=$('#newDocName').value.trim().replace(/\.md$/i,'');if(!name||docs.some(d=>d.projectId===projectId&&d.name.toLowerCase()===name.toLowerCase()))return toast('Dokumentname existiert bereits');let d={id:uid(),projectId,name,content:'# '+name+'\n'};await put('docs',d);deletionHistoryFor(d.projectId).redo.length=0;await refresh();selectDocument(d.id);closeModal();toast('Dokument erstellt')}}
function renameDocument(){
  const d=documentNow();if(!d)return;
  openModal(`<h2>Dokument umbenennen</h2><form id="renameForm">
    <div class="field"><label for="renameValue">Name</label><input id="renameValue" required maxlength="100" value="${escapeHtml(d.name)}"></div>
    <div class="modalactions document-modal-actions">
      <button type="button" class="btn delete-document" id="deleteDocument">L\u00f6schen</button>
      <span class="document-action-spacer" aria-hidden="true"></span>
      <button class="btn" type="button" id="cancelModal">Abbrechen</button>
      <button class="btn primary" type="submit">Speichern</button>
    </div></form>`);
  wireCancel();
  $('#deleteDocument').onclick=deleteCurrentDocument;
  $('#renameForm').onsubmit=async e=>{
    e.preventDefault();let name=$('#renameValue').value.trim().replace(/\.md$/i,'');
    if(!name||docs.some(x=>x.projectId===projectId&&x.id!==d.id&&x.name.toLowerCase()===name.toLowerCase()))return toast('Dokumentname bereits vergeben');
    const previous=d.name;d.name=name;
    try{await put('docs',{...d})}
    catch(error){d.name=previous;console.error(error);toast('Umbenennen fehlgeschlagen');return}
    closeModal();render();
  };
}
async function deleteCurrentDocument(){
  if(historyBusy||!documentNow())return;
  historyBusy=true;updateHistoryButtons();
  const button=$('#deleteDocument');if(button)button.disabled=true;
  try{
    // Save any pending editor input before preserving the deleted document for undo.
    if(view==='markdown')await flushSource();
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
  const previousType=nodeTypeValue(n),isKanbanTicket=view==='kanban';
  const typeOptions=NODE_TYPES.map(t=>`<option value="${t.value}" ${t.value===previousType?'selected':''}>${escapeHtml(t.label)}</option>`).join('');
  openModal(`<h2><label for="nodeTitle">${isKanbanTicket?'Ticket':'Knoten'} bearbeiten</label></h2><form id="nodeForm" class="node-form">
    <div class="field"><input id="nodeTitle" aria-label="Knoten bearbeiten: Titel" required value="${escapeHtml(n.title)}"></div>
    <div class="node-properties ${isKanbanTicket?'single':''}"><div class="field"><label for="nodeType">Knotentyp</label><select id="nodeType">${typeOptions}</select></div>
    ${isKanbanTicket?'':`<div class="field"><label for="nodeStatus">Status</label><select id="nodeStatus">${STATUS.map(st=>`<option value="${st}" ${st===(n.status||'story')?'selected':''}>${escapeHtml(statusLabel(st))}</option>`).join('')}</select></div>`}</div>
    <div class="field"><label>Aufgabenstatus (Checkbox)</label><div class="node-check-group"><label><input type="checkbox" id="nodeUseCheck" ${n.checked!==null?'checked':''}> Checkbox für diesen Knoten verwenden</label><label><input type="checkbox" id="nodeDone" ${n.checked===true?'checked':''} ${n.checked===null?'disabled':''}> Erledigt</label></div></div>
    ${nodeDateFieldsHtml(n.date)}
    <div class="field"><label for="nodeDescription">Beschreibung (Markdown)</label><textarea id="nodeDescription">${escapeHtml(n.description.join('\n').trim())}</textarea></div>
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
      status:isKanbanTicket?n.status:$('#nodeStatus').value||null,
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
// ZIP stored-entry writer (no dependencies, works offline)
const enc=new TextEncoder(),dec=new TextDecoder();function crc32(data){let crc=-1;for(let b of data){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^-1)>>>0}
function makeZip(entries){let parts=[],central=[],offset=0;for(let [name,text] of entries){let nb=enc.encode(name),body=enc.encode(text),crc=crc32(body),head=new Uint8Array(30+nb.length),v=new DataView(head.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,nb.length,true);head.set(nb,30);parts.push(head,body);let ch=new Uint8Array(46+nb.length),c=new DataView(ch.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint32(16,crc,true);c.setUint32(20,body.length,true);c.setUint32(24,body.length,true);c.setUint16(28,nb.length,true);c.setUint32(42,offset,true);ch.set(nb,46);central.push(ch);offset+=head.length+body.length}let cdsize=central.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,cdsize,true);e.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:'application/zip'})}
async function readZip(buffer){let a=new Uint8Array(buffer),v=new DataView(buffer),pos=a.length-22;while(pos>=0&&v.getUint32(pos,true)!==0x06054b50)pos--;if(pos<0)throw Error('Ungültige ZIP-Datei');let count=v.getUint16(pos+10,true),at=v.getUint32(pos+16,true),out=[];for(let k=0;k<count;k++){if(v.getUint32(at,true)!==0x02014b50)throw Error('Ungültiger ZIP-Eintrag');let method=v.getUint16(at+10,true),size=v.getUint32(at+20,true),nl=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),loc=v.getUint32(at+42,true),name=dec.decode(a.slice(at+46,at+46+nl)),start=loc+30+v.getUint16(loc+26,true)+v.getUint16(loc+28,true),bytes=a.slice(start,start+size);if(method===8){if(typeof DecompressionStream==='undefined')throw Error('Dieser Browser unterstützt komprimierte ZIP-Dateien nicht');let stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));bytes=new Uint8Array(await new Response(stream).arrayBuffer())}else if(method!==0)throw Error('Nicht unterstützte ZIP-Komprimierung');if(name&&!name.endsWith('/'))out.push([name,dec.decode(bytes)]);at+=46+nl+extra+comment}return out}
function safeName(s){return s.replace(/[\\/:*?"<>|]/g,'_')}
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportProject(){let p=project();if(!p)return;let items=docs.filter(d=>d.projectId===p.id),entries=[['mindstorm-project.json',JSON.stringify({format:'mindstorm',version:4,name:p.name,accentColor:projectAccentColor(p),statusSettings:statusSettingsFor(p),documents:items.map(d=>({name:d.name,file:safeName(d.name)+'.md',mapPositions:d.mapPositions||{},mapCollapsedPaths:d.mapCollapsedPaths||[]}))},null,2)],...items.map(d=>[safeName(d.name)+'.md',d.content])];download(makeZip(entries),safeName(p.name)+'.zip');toast('Projekt exportiert')}
async function importProject(file){try{let entries=await readZip(await file.arrayBuffer()),meta=entries.find(x=>x[0]==='mindstorm-project.json'),metadata=meta?JSON.parse(meta[1]):null,pname=metadata?.name||file.name.replace(/\.zip$/i,'');let mapping=metadata?metadata.documents:entries.filter(x=>x[0].endsWith('.md')).map(x=>({name:x[0].split('/').pop().replace(/\.md$/i,''),file:x[0]}));if(!mapping.length)throw Error('Keine Markdown-Dateien gefunden');let p={id:uid(),name:pname+' (Import)',created:Date.now(),accentColor:projectAccentColor({accentColor:metadata?.accentColor}),statusSettings:statusSettingsFor({statusSettings:metadata?.statusSettings})};await put('projects',p);for(let item of mapping){let found=entries.find(x=>x[0]===item.file);if(found)await put('docs',{id:uid(),projectId:p.id,name:item.name,content:found[1],mapPositions:item.mapPositions||{},mapCollapsedPaths:item.mapCollapsedPaths||[]})}await refresh();selectProject(p.id);toast('Projekt importiert')}catch(e){toast('Import fehlgeschlagen: '+e.message)}}
