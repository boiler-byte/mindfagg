'use strict';
// mindfagg v30: core/history.js (klassisches Script; gemeinsame globale Laufzeit).
const docHistory=new Map(),persistedDocSnapshots=new Map();
// Deletions are project-wide history entries because the selected document changes.
const deletionHistory=new Map();
const projectDeletionHistory={undo:[],redo:[]};
function invalidateProjectRedo(){projectDeletionHistory.redo.length=0}
let historyBusy=false,historySerial=0,redoSerial=0;
function deletionHistoryFor(id){
  if(!deletionHistory.has(id))deletionHistory.set(id,{undo:[],redo:[]});
  return deletionHistory.get(id);
}

function docSnapshot(doc){return {content:doc.content,name:doc.name,path:doc.path??null,fileType:doc.fileType??null,mapCollapsedPaths:Array.isArray(doc.mapCollapsedPaths)?[...doc.mapCollapsedPaths]:[]}}
function equalDocSnapshot(a,b){return a?.content===b?.content&&a?.name===b?.name&&a?.path===b?.path&&a?.fileType===b?.fileType}
function applyDocSnapshot(doc,snapshot){
  doc.content=snapshot.content;doc.name=snapshot.name;
  if(snapshot.path)doc.path=snapshot.path;else delete doc.path;
  if(snapshot.fileType)doc.fileType=snapshot.fileType;else delete doc.fileType;
  doc.mapCollapsedPaths=[...(snapshot.mapCollapsedPaths||[])];
}
function docHistoryFor(id){
  if(!docHistory.has(id))docHistory.set(id,{undo:[],redo:[]});
  return docHistory.get(id);
}
// A single persistent save indicator is shared by Mindmap, Kanban and Markdown.
// Uses the new mindfagg-db; no old database is read or migrated.
const pendingDocWrites=new Map(),failedDocWrites=new Set();
function updateSaveStatus(){
  const label=$('#saveLabel');if(!label)return;
  const doc=documentNow();
  const failed=!!doc&&failedDocWrites.has(doc.id);
  const pending=!!doc&&((pendingDocWrites.get(doc.id)||0)>0||!equalDocSnapshot(docSnapshot(doc),persistedDocSnapshots.get(doc.id)));
  const state=failed?'error':pending?'saving':'saved';
  label.dataset.state=state;
  label.textContent=state==='error'?'Speichern fehlgeschlagen':state==='saving'?'Wird gespeichert …':doc?'Gespeichert ✓':'Automatisch gespeichert';
}
function updateHistoryButtons(){
  const d=documentNow(),h=d?docHistory.get(d.id):null;
  const structural=projectId?deletionHistory.get(projectId):null;
  const hasUnsaved=!!d&&!equalDocSnapshot(docSnapshot(d),persistedDocSnapshots.get(d.id));
  const undo=$('#undoAction'),redo=$('#redoAction');
  if(undo)undo.disabled=historyBusy||!((h?.undo.length||0)>0||hasUnsaved||(structural?.undo.length||0)>0||projectDeletionHistory.undo.length>0);
  if(redo)redo.disabled=historyBusy||!((h?.redo.length||0)>0||(structural?.redo.length||0)>0||projectDeletionHistory.redo.length>0);
}
