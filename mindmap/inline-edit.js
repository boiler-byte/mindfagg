'use strict';
// mindfagg v30: mindmap/inline-edit.js (klassisches Script; gemeinsame globale Laufzeit).
let mapInlineSaveChain=Promise.resolve();
function applyMapInlineDraft(state,edit){
  const title=edit.input.value.trim();
  if(!title)return false;
  if(title===edit.row.node.title)return true;
  const d=docs.find(item=>item.id===state.docId);
  if(!d)return false;
  const changed=lineEdit(edit.row.node,{title});
  if(!changed)return false;
  edit.row.node.title=title;
  edit.label.textContent=mapVisibleNodeTitle(title);
  edit.row.el.setAttribute('aria-label',nodeTypeLabel(edit.row.node)+' '+plain(title)+'; auswählen oder ziehen');
  edit.dirty=true;
  updateSaveStatus();
  return true;
}
async function saveMapInlineEdit(state,edit=state?.inlineEdit){
  if(!edit)return mapInlineSaveChain;
  clearTimeout(edit.timer);
  if(edit.dirty){
    const d=docs.find(item=>item.id===state.docId);
    if(!d)return false;
    const snapshot={...d};
    const record=!edit.historyRecorded;
    edit.historyRecorded=true;
    edit.dirty=false;
    mapInlineSaveChain=mapInlineSaveChain.catch(()=>{}).then(()=>put('docs',snapshot,{record}))
      .then(()=>true).catch(error=>{
        console.error(error);
        edit.dirty=true;
        edit.historyRecorded=record?false:edit.historyRecorded;
        toast('Knotentitel konnte nicht gespeichert werden');
        return false;
      });
  }
  return mapInlineSaveChain;
}
async function flushMapInlineEdit(){
  const state=activeMap;
  return state?.inlineEdit?saveMapInlineEdit(state,state.inlineEdit):mapInlineSaveChain;
}
function closeMapInlineEdit(state,restoreFocus=false){
  const edit=state.inlineEdit;
  if(!edit)return;
  edit.stopVisibilityWatch?.();
  clearTimeout(edit.timer);
  if(!edit.input.value.trim())edit.input.value=edit.row.node.title;
  else applyMapInlineDraft(state,edit);
  if(edit.dirty)saveMapInlineEdit(state,edit);
  state.inlineEdit=null;
  edit.host.remove();edit.label.classList.remove('hidden');
  edit.row.el.classList.remove('mm-inline-editing');
  edit.row.el.setAttribute('role','button');edit.row.el.tabIndex=0;
  if(activeMap===state){
    positionMapRows(state);drawMapLinks(state);positionMapToolbar(state);
    if(restoreFocus&&edit.row.el.isConnected)edit.row.el.focus({preventScroll:true});
  }
}
async function finishMapInlineEdit(state,restoreFocus=false){
  const edit=state?.inlineEdit;
  // A pending save may resolve to undefined when no editor is active.
  // Callers require a boolean success value before handling fold controls.
  if(!edit){const saved=await flushMapInlineEdit();return saved!==false}
  if(!edit.input.value.trim())edit.input.value=edit.row.node.title;
  else applyMapInlineDraft(state,edit);
  const saved=await saveMapInlineEdit(state,edit);
  if(saved===false)return false;
  if(state.inlineEdit===edit)closeMapInlineEdit(state,restoreFocus);
  return true;
}
// Keep the input inside the *visible* mobile canvas, clear of the fixed map
// controls and of the portion covered by the on-screen keyboard. Pan the map,
// not the page, so surrounding nodes keep their relative positions.
function ensureMapInlineInputVisible(state,center=false){
  const edit=state?.inlineEdit;
  if(activeMap!==state||!edit?.input.isConnected||!window.matchMedia('(max-width:850px)').matches)return;
  const canvas=state.viewport.getBoundingClientRect(),visual=window.visualViewport;
  const visualLeft=visual?.offsetLeft??0,visualTop=visual?.offsetTop??0;
  const margin=18;
  const left=Math.max(canvas.left,visualLeft)+margin;
  const right=Math.min(canvas.right,visualLeft+(visual?.width??window.innerWidth))-margin;
  const top=Math.max(canvas.top,visualTop)+margin;
  let bottom=Math.min(canvas.bottom,visualTop+(visual?.height??window.innerHeight))-margin;
  const controls=document.querySelector('#surface .mm-controls');
  if(controls){
    const b=controls.getBoundingClientRect();
    if(b.top<bottom&&b.bottom>top&&b.left<right&&b.right>left){
      bottom=Math.min(bottom,b.top-margin);
    }
  }
  if(right<=left||bottom<=top)return;
  const input=edit.input.getBoundingClientRect();
  // Newly created nodes are placed in the middle of the free area; existing
  // nodes only move the minimum distance needed to become fully readable.
  const dx=center?(left+right-input.left-input.right)/2
    :input.left<left?left-input.left:input.right>right?right-input.right:0;
  const dy=center?(top+bottom-input.top-input.bottom)/2
    :input.top<top?top-input.top:input.bottom>bottom?bottom-input.bottom:0;
  if(Math.abs(dx)>.5||Math.abs(dy)>.5){
    state.panX+=dx;state.panY+=dy;applyMapView(state);
  }
}
function watchMapInlineInput(state,edit){
  let frame=0;
  const schedule=()=>{
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      if(state.inlineEdit===edit)ensureMapInlineInputVisible(state,edit.centerNew);
    });
  };
  const visual=window.visualViewport;
  visual?.addEventListener('resize',schedule);
  visual?.addEventListener('scroll',schedule);
  window.addEventListener('resize',schedule);
  edit.scheduleVisibilityCheck=schedule;
  edit.stopVisibilityWatch=()=>{
    if(frame)cancelAnimationFrame(frame);
    visual?.removeEventListener('resize',schedule);
    visual?.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',schedule);
  };
  schedule();
}
function beginMapInlineEdit(state,path,selectAll=false,centerNew=false){
  if(activeMap!==state)return;
  const row=state.rows.find(r=>r.path===path);
  if(!row)return;
  if(state.inlineEdit){
    if(state.inlineEdit.path===path){
      state.inlineEdit.input.focus({preventScroll:true});
      if(selectAll)state.inlineEdit.input.select();
      state.inlineEdit.scheduleVisibilityCheck?.();
      return;
    }
    closeMapInlineEdit(state);
  }
  selectMapNode(state,path);
  const label=row.el.querySelector('.node-text');
  const title=row.el.querySelector('.nodetitle');
  if(!label||!title)return;
  const host=document.createElement('span');
  host.className='mm-inline-editor';
  host.innerHTML='<input type="text" class="mm-inline-input" aria-label="Knotentitel bearbeiten; automatisch gespeichert" autocomplete="off" spellcheck="false">';
  label.classList.add('hidden');title.appendChild(host);
  row.el.classList.add('mm-inline-editing');
  row.el.setAttribute('role','group');row.el.tabIndex=-1;
  const input=host.querySelector('input');input.value=row.node.title;
  const edit={row,path,label,host,input,dirty:false,historyRecorded:false,timer:null,centerNew};
  state.inlineEdit=edit;
  host.onpointerdown=e=>e.stopPropagation();
  host.onclick=e=>e.stopPropagation();
  host.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==='Enter'||e.key==='Escape'){
      e.preventDefault();
      finishMapInlineEdit(state,true);
    }
  };
  input.addEventListener('input',()=>{
    if(!applyMapInlineDraft(state,edit))return;
    clearTimeout(edit.timer);
    if(edit.dirty)edit.timer=setTimeout(()=>saveMapInlineEdit(state,edit),180);
  });
  positionMapRows(state);drawMapLinks(state);positionMapToolbar(state);
  input.focus({preventScroll:true});
  if(selectAll)input.select();else input.setSelectionRange(input.value.length,input.value.length);
  ensureMapInlineInputVisible(state,centerNew);
  watchMapInlineInput(state,edit);
}
function selectMapNode(state,path){
  if(activeMap!==state)return;
  if(state.inlineEdit&&state.inlineEdit.path!==path)closeMapInlineEdit(state);
  const row=state.rows.find(r=>r.path===path)||null;
  state.selectedPath=row?.path||null;
  if(state.selectedPath)mapSelectedPaths.set(state.docId,state.selectedPath);
  else mapSelectedPaths.delete(state.docId);
  for(const r of state.rows){
    r.el.classList.toggle('selected',r===row);
    r.el.setAttribute('aria-selected',String(r===row));
  }
  state.world.querySelector('.mm-actions')?.remove();
  if(row){
    const toolbar=document.createElement('div');
    toolbar.className='mm-actions';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Aktionen für ausgewählten Knoten');
    toolbar.style.left=(row.x+row.width/2)+'px';
    toolbar.style.top=Math.max(5,row.y-48)+'px';
    toolbar.style.transform='translateX(-50%)';
    toolbar.innerHTML=`<button type="button" data-map-action="edit" title="Knoten bearbeiten" aria-label="Knoten bearbeiten">${mapSvg('edit')}</button>
      <button type="button" data-map-action="copy" title="Knoten samt Unterknoten als Markdown kopieren" aria-label="Knoten kopieren" ${row===state.rootRow?'disabled':''}>${mapSvg('copy')}</button>
      ${mapCopyReference?`<button type="button" data-map-action="paste" title="Kopierten Knoten hier als Unterknoten einfügen" aria-label="Knoten als Unterknoten einfügen">${mapSvg('paste')}</button>`:''}
      <button type="button" data-map-action="delete" class="danger" title="Knoten samt Unterknoten löschen" aria-label="Knoten löschen" ${row===state.rootRow?'disabled':''}>${mapSvg('delete')}</button>`;
    toolbar.onpointerdown=e=>e.stopPropagation();
    toolbar.onclick=async e=>{
      const action=e.target.closest('[data-map-action]');if(!action||action.disabled)return;
      e.stopPropagation();
      if(!(await finishMapInlineEdit(state)))return;
      if(action.dataset.mapAction==='edit')editNode(row.path);
      if(action.dataset.mapAction==='copy')await copyMapNode(row.path);
      if(action.dataset.mapAction==='paste')await pasteMapNode(row.path);
      if(action.dataset.mapAction==='delete')confirmMapDelete(row.path);
    };
    state.world.appendChild(toolbar);
    positionMapToolbar(state);
  }
  updateMapControls(state);
}
function centerMapNode(path){
  const state=activeMap,row=state?.rows.find(r=>r.path===path);
  if(!row)return;
  selectMapNode(state,path);
  state.panX=state.viewport.clientWidth/2-(row.x+row.width/2)*state.scale;
  state.panY=state.viewport.clientHeight/2-(row.y+row.height/2)*state.scale;
  applyMapView(state);
}
async function toggleMapChildren(state,path){
  if(!(await finishMapInlineEdit(state)))return;
  if(activeMap!==state)return;
  const n=flattened(currentModel).find(x=>x.path===path);
  if(!n||!n.children.length)return;
  const collapsed=mapCollapsed(state.docId),wasCollapsed=collapsed.has(path);
  if(wasCollapsed)collapsed.delete(path);else collapsed.add(path);
  if(!wasCollapsed&&state.selectedPath?.startsWith(path+'.'))mapSelectedPaths.set(state.docId,path);
  renderMindmap();
  await persistMapCollapsed(state.docId);
}
async function setAllMapChildrenCollapsed(state,shouldCollapse){
  if(!state||activeMap!==state)return;
  if(!(await finishMapInlineEdit(state)))return;
  if(activeMap!==state)return;
  const allBranches=flattened(currentRoot()).filter(n=>n.children.length>0);
  const collapsed=mapCollapsed(state.docId);
  if(shouldCollapse){
    collapsed.clear();
    for(const node of allBranches)collapsed.add(node.path);
    // The root is the only visible node after collapsing everything.
    mapSelectedPaths.set(state.docId,currentRoot().path);
  }else collapsed.clear();
  renderMindmap();
  await persistMapCollapsed(state.docId);
}
// Scan boundaries rather than using recorded `end`, which is the next markdown node,
// not necessarily the end of a heading or nested list subtree.
