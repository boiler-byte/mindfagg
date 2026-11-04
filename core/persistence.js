'use strict';
// mindfagg v30: core/persistence.js (klassisches Script; gemeinsame globale Laufzeit).
function projectChangedAt(p){
  const inDocuments=docs.filter(d=>d.projectId===p.id).reduce((latest,d)=>Math.max(latest,Number(d.updatedAt)||0),0);
  return Math.max(Number(p.updatedAt)||0,Number(p.created)||0,inDocuments);
}
function nextProjectChange(p){return Math.max(Date.now(),(Number(p?.updatedAt)||0)+1)}
function projectChangeLabel(p){
  const when=projectChangedAt(p);
  return when?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(when)):'-';
}
function projectOptionsHtml(){
  if(!projects.length)return '<option value="">Kein Projekt</option>';
  return [...projects].sort((a,b)=>projectChangedAt(b)-projectChangedAt(a)||a.name.localeCompare(b.name,'de'))
    .map(item=>`<option value="${item.id}" ${item.id===projectId?'selected':''}>${escapeHtml(item.name)} · ${escapeHtml(projectChangeLabel(item))}</option>`).join('');
}
function refreshProjectSelect(){
  const select=$('#projectSelect');if(!select)return;
  select.innerHTML=projectOptionsHtml();
}
function writeDocumentWithProject(value){
  return new Promise((resolve,reject)=>{
    const p=projects.find(item=>item.id===value.projectId),stamp=nextProjectChange(p);
    const record={...value,updatedAt:stamp};
    const transaction=db.transaction(['docs','projects'],'readwrite');
    transaction.objectStore('docs').put(record);
    if(p)transaction.objectStore('projects').put({...p,updatedAt:stamp});
    transaction.oncomplete=()=>{
      value.updatedAt=stamp;
      const stored=docs.find(d=>d.id===value.id);if(stored)stored.updatedAt=stamp;
      if(p)p.updatedAt=stamp;
      refreshProjectSelect();
      resolve(record.id);
    };
    transaction.onerror=()=>reject(transaction.error||new Error('Dokument konnte nicht gespeichert werden'));
    transaction.onabort=()=>reject(transaction.error||new Error('Dokumenttransaktion abgebrochen'));
  });
}
async function put(store,value,options={}){
  const isDoc=store==='docs';
  const before=isDoc?persistedDocSnapshots.get(value.id):null;
  if(isDoc){
    pendingDocWrites.set(value.id,(pendingDocWrites.get(value.id)||0)+1);
    failedDocWrites.delete(value.id);
    updateSaveStatus();
  }
  try{
    let result;
    if(isDoc)result=await writeDocumentWithProject(value);
    else if(store==='projects'){
      const active=projects.find(item=>item.id===value.id);
      const stamp=nextProjectChange(active||value);
      result=await req(tx(store,'readwrite').put({...value,updatedAt:stamp}));
      value.updatedAt=stamp;
      if(active)active.updatedAt=stamp;
      refreshProjectSelect();
    }else result=await req(tx(store,'readwrite').put(value));
    if(options.invalidateProjectRedo!==false)invalidateProjectRedo();
    if(isDoc){
      const after=docSnapshot(value);
      if(before&&!equalDocSnapshot(before,after)&&options.record!==false){
        const h=docHistoryFor(value.id);
        h.undo.push({...before,stamp:++historySerial});if(h.undo.length>100)h.undo.shift();
        h.redo.length=0;
        deletionHistoryFor(value.projectId).redo.length=0;
      }
      persistedDocSnapshots.set(value.id,after);
    }
    return result;
  }catch(error){
    if(isDoc)failedDocWrites.add(value.id);
    throw error;
  }finally{
    if(isDoc){
      const pending=(pendingDocWrites.get(value.id)||1)-1;
      if(pending>0)pendingDocWrites.set(value.id,pending);
      else pendingDocWrites.delete(value.id);
      updateHistoryButtons();
      updateSaveStatus();
      githubScheduleLocalStatus(value.projectId);
    }
  }
}
async function changeHistory(direction){
  if(historyBusy||(!documentNow()&&!projectDeletionHistory[direction].length&&!deletionHistory.get(projectId)?.[direction]?.length))return;
  historyBusy=true;updateHistoryButtons();
  try{
    // First persist unsaved Markdown or inline edits to preserve undo order.
    if(view==='mindmap')await flushMapInlineEdit();
    await flushSource();
    const d=documentNow(),h=d?docHistoryFor(d.id):null,structural=projectId?deletionHistoryFor(projectId):null;
    const local=direction==='undo'?(h?.undo||[]):(h?.redo||[]);
    const global=direction==='undo'?(structural?.undo||[]):(structural?.redo||[]);
    const projectStack=projectDeletionHistory[direction];
    const localLast=local[local.length-1],globalLast=global[global.length-1],projectLast=projectStack[projectStack.length-1];
    const key=direction==='undo'?'stamp':'redoStamp';
    if(projectLast&&(projectLast[key]||0)>Math.max(localLast?.[key]||0,globalLast?.[key]||0)){
      const ok=direction==='undo'?await restoreDeletedProject(projectLast):await repeatDeletedProject(projectLast);
      if(!ok)return;
      projectStack.pop();
      if(direction==='undo')projectDeletionHistory.redo.push({...projectLast,redoStamp:++redoSerial});
      else projectDeletionHistory.undo.push({...projectLast,stamp:++historySerial});
      updateHistoryButtons();
      toast(direction==='undo'?'Projekt wiederhergestellt':'Projekt erneut gelöscht');
      return;
    }
    if(globalLast&&(!localLast||(globalLast[key]||0)>(localLast[key]||0))){
      const ok=globalLast.kind==='workspace-batch'
        ?await applyWorkspaceBatchHistory(globalLast,direction)
        :(direction==='undo'?await restoreDeletedDocument(globalLast):await repeatDeletedDocument(globalLast));
      if(!ok)return;
      global.pop();
      if(direction==='undo')structural.redo.push({...globalLast,redoStamp:++redoSerial});
      else structural.undo.push({...globalLast,stamp:++historySerial});
      render();
      toast(globalLast.kind==='workspace-batch'?(direction==='undo'?'Dateiaktion rückgängig gemacht':'Dateiaktion wiederhergestellt'):(direction==='undo'?'Dokument wiederhergestellt':'Dokument erneut gel\u00f6scht'));
      return;
    }
    if(!d||!local.length)return;
    const target=local.pop(),current=docSnapshot(d);
    const other=direction==='undo'?h.redo:h.undo;
    other.push({...current,...(direction==='undo'?{redoStamp:++redoSerial}:{stamp:++historySerial})});
    if(other.length>100)other.shift();
    applyDocSnapshot(d,target);
    try{await put('docs',{...d},{record:false,invalidateProjectRedo:false})}
    catch(e){
      applyDocSnapshot(d,current);
      other.pop();local.push(target);console.error(e);toast('Verlauf konnte nicht gespeichert werden');return;
    }
    clearTimeout(saveTimer);
    mapSelectedPaths.delete(d.id);mapCollapsedPaths.set(d.id,new Set(d.mapCollapsedPaths));
    const editorCursor=fileKind(d)==='script'?$('#scriptSource')?.selectionStart:view==='markdown'?$('#source')?.selectionStart:null;
    const editorScroll=fileKind(d)==='script'?$('#scriptSource')?.scrollTop:view==='markdown'?$('#source')?.scrollTop:null;
    render();
    if(editorCursor!==null&&editorCursor!==undefined){
      const source=fileKind(d)==='script'?$('#scriptSource'):$('#source');
      if(source){const i=Math.min(editorCursor,source.value.length);source.setSelectionRange(i,i);source.scrollTop=editorScroll||0;if(source.id==='source')syncCodeScroll();else syncScriptCodeScroll()}
    }
    toast(direction==='undo'?'\u00c4nderung r\u00fcckg\u00e4ngig gemacht':'\u00c4nderung wiederhergestellt');
  }catch(error){console.error(error);toast('R\u00fcckg\u00e4ngig fehlgeschlagen')}
  finally{historyBusy=false;updateHistoryButtons()}
}

// Both deleting and auto-creating a fallback happen in one IndexedDB transaction.
