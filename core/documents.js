'use strict';
// mindfagg v30: core/documents.js (klassisches Script; gemeinsame globale Laufzeit).
function commitDocumentChanges(upserts=[],deletedIds=[],options={}){
  return new Promise((resolve,reject)=>{
    const affected=new Set(upserts.map(item=>item.projectId));
    for(const id of deletedIds){const old=docs.find(d=>d.id===id);if(old)affected.add(old.projectId)}
    const transaction=db.transaction(['docs','projects'],'readwrite'),store=transaction.objectStore('docs');
    const timestamps=[];
    for(const id of affected){
      const p=projects.find(item=>item.id===id);if(!p)continue;
      const stamp=nextProjectChange(p);
      transaction.objectStore('projects').put({...p,updatedAt:stamp});
      timestamps.push({p,stamp});
    }
    for(const id of deletedIds)store.delete(id);
    for(const item of upserts){
      const stamp=timestamps.find(t=>t.p.id===item.projectId)?.stamp||Date.now();
      store.put({...item,updatedAt:stamp});
    }
    transaction.oncomplete=()=>{
      for(const {p,stamp} of timestamps)p.updatedAt=stamp;
      for(const item of upserts)item.updatedAt=timestamps.find(t=>t.p.id===item.projectId)?.stamp||Date.now();
      if(!options.preserveProjectRedo)invalidateProjectRedo();
      refreshProjectSelect();
      resolve();
    };
    transaction.onerror=()=>reject(transaction.error||new Error('Dokumenttransaktion fehlgeschlagen'));
    transaction.onabort=()=>reject(transaction.error||new Error('Dokumenttransaktion abgebrochen'));
  });
}
function applyDocumentChanges(upserts=[],deletedIds=[]){
  const removed=new Set(deletedIds);
  docs=docs.filter(item=>!removed.has(item.id));
  for(const id of deletedIds){
    persistedDocSnapshots.delete(id);pendingDocWrites.delete(id);failedDocWrites.delete(id);
  }
  for(const item of upserts){
    const index=docs.findIndex(existing=>existing.id===item.id);
    if(index===-1)docs.push(item);else docs[index]=item;
    persistedDocSnapshots.set(item.id,docSnapshot(item));failedDocWrites.delete(item.id);
  }
}
function newProjectDocument(id=uid(),idOfProject=projectId){
  return {id,projectId:idOfProject,name:'Projekt',path:'Projekt.md',fileType:'markdown',content:'# Projekt\n'};
}
async function restoreDeletedDocument(action){
  const restored=structuredClone(action.document);
  if(docs.some(item=>item.id===restored.id)){
    toast('Dokument ist bereits vorhanden');return false;
  }
  // An untouched, automatically created replacement is no longer needed after undo.
  const placeholder=action.placeholder&&docs.find(item=>item.id===action.placeholder.id);
  const removePlaceholder=placeholder&&placeholder.name===action.placeholder.name&&placeholder.content===action.placeholder.content;
  const deletes=removePlaceholder?[placeholder.id]:[];
  const names=docs.filter(item=>item.projectId===restored.projectId&&!deletes.includes(item.id)).map(item=>workspacePath(item).toLowerCase());
  if(names.includes(workspacePath(restored).toLowerCase())){
    const original=workspacePath(restored),folder=pathParent(original),base=pathName(original),dot=base.lastIndexOf('.'),stem=dot>0?base.slice(0,dot):base,ext=dot>0?base.slice(dot):'';let index=1,path;
    do{path=[folder,stem+' (Wiederhergestellt'+(index===1?'':' '+index)+')'+ext].filter(Boolean).join('/');index++}while(names.includes(path.toLowerCase()));
    restored.path=path;restored.name=docNameForPath(path);
  }
  await commitDocumentChanges([restored],deletes,{preserveProjectRedo:true});
  applyDocumentChanges([restored],deletes);
  if(removePlaceholder){
    docHistory.delete(placeholder.id);mapCollapsedPaths.delete(placeholder.id);
    mapSelectedPaths.delete(placeholder.id);mapSessionViews.delete(placeholder.id);
  }
  projectId=restored.projectId;docId=restored.id;scopePath='0';
  mapCollapsedPaths.set(restored.id,new Set(restored.mapCollapsedPaths||[]));
  return true;
}
async function repeatDeletedDocument(action){
  const deleted=docs.find(item=>item.id===action.document.id);
  if(!deleted){toast('Dokument ist nicht mehr vorhanden');return false}
  const remaining=docs.filter(item=>item.projectId===deleted.projectId&&item.id!==deleted.id);
  let replacement=null;
  if(!remaining.length){
    const former=action.placeholder;
    replacement=former?structuredClone(former):newProjectDocument(uid(),deleted.projectId);
    if(docs.some(item=>item.id===replacement.id))replacement.id=uid();
  }
  await commitDocumentChanges(replacement?[replacement]:[],[deleted.id],{preserveProjectRedo:true});
  applyDocumentChanges(replacement?[replacement]:[],[deleted.id]);
  if(replacement)action.placeholder=structuredClone(replacement);
  projectId=deleted.projectId;
  docId=(remaining.find(item=>item.id===action.successorId)||remaining[0]||replacement).id;
  scopePath='0';
  docHistoryFor(deleted.id).redo.length=0;
  return true;
}
async function del(store,key){return req(tx(store,'readwrite').delete(key))}
async function init(){
  db = await new Promise((res, rej) => {
    let r = indexedDB.open("mindfagg-db", 2);
    r.onupgradeneeded = () => {
      let d = r.result;
      if(!d.objectStoreNames.contains("projects"))d.createObjectStore("projects", { keyPath: "id" });
      if(!d.objectStoreNames.contains("docs"))d.createObjectStore("docs", { keyPath: "id" });
      if(!d.objectStoreNames.contains("settings"))d.createObjectStore("settings", { keyPath: "key" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  await githubRestoreCredentials();
  await refresh();
  if (!projects.length) {
    let p = {
      id: uid(),
      name: "Mein Workspace",
      created: Date.now(),
      statusSettings: statusSettingsFor(null),
      accentColor: DEFAULT_PROJECT_ACCENT,
    };
    await put("projects", p);
    await put("docs", { id: uid(), projectId: p.id, name: "Projekt", path: "Projekt.md", fileType: "markdown", content: SAMPLE });
  }
  await refresh();
  try {
    kanbanTierlist = localStorage.getItem("mfKanbanLayout") === "tierlist";
  } catch (e) {
    console.warn("Kanban-Darstellung konnte nicht geladen werden:", e);
  }
  try {
    const savedView = localStorage.getItem("mfLastView");
    view = VIEWS.includes(savedView) ? savedView : "markdown";
  } catch (error) {
    view = "markdown";
    console.warn("Letzte Ansicht konnte nicht geladen werden:", error);
  }
  projectId=localStorage.getItem('msProject');
  if(!projects.some(p=>p.id===projectId))projectId=[...projects].sort((a,b)=>projectChangedAt(b)-projectChangedAt(a))[0].id;
  try{
    const savedDoc=localStorage.getItem('msDoc');
    if(savedDoc&&docs.some(item=>item.id===savedDoc&&item.projectId===projectId))docId=savedDoc;
  }catch(e){console.warn('Letztes Dokument konnte nicht geladen werden:',e)}
  selectProject(projectId);

}
async function refresh(){projects=await all('projects');docs=await all('docs');for(const d of docs)persistedDocSnapshots.set(d.id,docSnapshot(d));updateHistoryButtons()}
function project(){return projects.find(p=>p.id===projectId)}function documentNow(){return docs.find(d=>d.id===docId)}
function persistDocId(){
  try{
    if(docId)localStorage.setItem('msDoc',docId);
    else localStorage.removeItem('msDoc');
  }catch(e){console.warn('Dokumentauswahl konnte nicht gespeichert werden:',e)}
}
function selectProject(id,{keepSidebarOpen=false}={}){if(!keepSidebarOpen)setMobileMenu(false);appSettingsOpen=false;activeFilePanel='script';projectId=id||null;try{if(projectId)localStorage.setItem('msProject',projectId);else localStorage.removeItem('msProject')}catch(e){console.warn('Projektauswahl konnte nicht gespeichert werden:',e)}let pd=docs.filter(d=>d.projectId===projectId);let old=docId;docId=pd.some(d=>d.id===old)?old:pd[0]?.id||null;activeFolderPath=docId?pathParent(workspacePath(documentNow())):'';workspaceExpandAncestors(activeFolderPath);scopePath='0';render();githubProjectActivated(project())}
function selectDocument(id){setMobileMenu(false);appSettingsOpen=false;activeFilePanel='script';docId=id;const d=documentNow();if(d)changeWorkspaceFolder(pathParent(workspacePath(d)));scopePath='0';render()}

// A shared scanner keeps root validation, highlighting and the tree parser consistent.
