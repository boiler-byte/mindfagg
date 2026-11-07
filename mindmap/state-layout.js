'use strict';
// mindfagg v30: mindmap/state-layout.js (klassisches Script; gemeinsame globale Laufzeit).
const mapSessionViews=new Map(),mapSelectedPaths=new Map(),mapCollapsedPaths=new Map();
// Session-only reference; the actual Markdown subtree is resolved on paste.
let mapCopyReference=null;
let activeMap=null,mapResizeObserver=null;
function clamp(x,min,max){return Math.min(max,Math.max(min,x))}
function mapCollapsed(docId){
  if(!mapCollapsedPaths.has(docId)){
    const doc=docs.find(d=>d.id===docId);
    const paths=Array.isArray(doc?.mapCollapsedPaths)?doc.mapCollapsedPaths:[];
    mapCollapsedPaths.set(docId,new Set(paths.filter(p=>typeof p==='string')));
  }
  return mapCollapsedPaths.get(docId);
}
async function persistMapCollapsed(docId){
  await flushMapInlineEdit();
  const doc=docs.find(d=>d.id===docId);
  if(!doc)return;
  doc.mapCollapsedPaths=[...mapCollapsed(docId)];
  try{await put('docs',{...doc},{record:false})}
  catch(error){console.error(error);toast('Aufklappzustand konnte nicht gespeichert werden')}
}
function mapLayout(root,collapsed){
  const rows=[],links=[];
  function visit(node,depth,parent=null){
    const row={node,path:node.path,depth,parent,children:[],width:depth===0?218:205,x:0,y:0,height:70,branchHeight:0,el:null};
    rows.push(row);
    if(parent){parent.children.push(row);links.push([parent,row])}
    if(!collapsed.has(node.path))node.children.forEach(child=>visit(child,depth+1,row));
    return row;
  }
  return {rows,links,rootRow:visit(root,0)};
}
function mapStatusColor(n){
  return n.status&&STATUS.includes(n.status)?statusColor(n.status):n.checked===true?statusColor('done'):statusColor('story');
}
const mapIcons={
  edit:'<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L10 16l-4 1 1-4z"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  paste:'<path d="M9 4h6M9 2h6v4H9z"/><path d="M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M8 14h8m-4-4v8"/>',
  delete:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  child:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sibling:'<path d="M5 4v8a4 4 0 0 0 4 4h11m-6-6 6 6-6 6"/>',
  fit:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>'
};
function mapSvg(icon){return `<svg viewBox="0 0 24 24" aria-hidden="true">${mapIcons[icon]}</svg>`}
// Truncate only the presentation; keep the original title for editing, ARIA and export.
function mapVisibleNodeTitle(title){
  const chars=Array.from(plain(String(title??'')));
  return chars.length<=120?chars.join(''):chars.slice(0,119).join('')+'\u2026';
}
function mapNodeHtml(row,root){
  const n=row.node,hasChildren=n.children.length>0,collapsed=mapCollapsed(documentNow().id).has(n.path);
  const deep=row.depth>=3;
  const progress=(n.checked!==null||hasChildren)?(deep
    ?`<span class="nodefoot mm-bottom-progress" role="progressbar" aria-label="Fortschritt" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(n.progress)}" title="${Math.round(n.progress)} % Fortschritt"><span class="bar"><i style="width:${n.progress}%"></i></span></span>`
    :`<span class="nodefoot">${n.checked===true?'✓ ':''}${Math.round(n.progress)} % <span class="bar"><i style="width:${n.progress}%"></i></span></span>`):'';
  const fold=hasChildren?`<button type="button" class="mm-fold${collapsed?' is-collapsed':''}" data-map-fold="${escapeHtml(n.path)}" aria-label="${collapsed?n.children.length+' direkte Unterknoten einblenden':'Unterknoten ausblenden'}" title="${collapsed?n.children.length+' direkte Unterknoten einblenden':'Unterknoten ausblenden'}" aria-expanded="${!collapsed}">${collapsed?`<span class="mm-child-count" aria-hidden="true">${n.children.length}</span>`:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'}</button>`:'';
  const levelClass=row.depth===2?'mm-level-3':deep?'mm-level-deep':'';
  return `<div class="node mm-node ${root?'treeroot':''} ${levelClass}" role="button" tabindex="0" data-map-node="${escapeHtml(n.path)}"
    style="left:${row.x}px;top:${row.y}px;--node-accent:${mapStatusColor(n)}"
    aria-label="${escapeHtml(nodeTypeLabel(n)+' '+plain(n.title))}; auswählen oder ziehen"
    aria-selected="false" ${hasChildren?`aria-expanded="${!collapsed}"`:''} title="Auswählen · Ziehen zum Sortieren oder Umhängen · Doppelklick zum Bearbeiten">
    <span class="nodeinner"><span class="nodetitle">${labeledNodeTitle({...n,title:mapVisibleNodeTitle(n.title)})}</span>${progress}</span>${fold}</div>`;
}
function positionMapRows(state){
  // v37: Double the space between direct siblings compared with v36.
  // Top-level branches are separate visual blocks and receive an additional
  // 24px of separation (40 -> 64px) so a parent/context change remains clear.
  const step=286;
  const siblingGap=depth=>depth===0?24:depth===1?24:depth===2?24:12;
  function measure(r){
    r.height=Math.max(r.depth>=3?43:r.depth===2?56:64,r.el?.offsetHeight||70);
    r.width=r.el?.offsetWidth||r.width;
    const total=r.children.reduce((s,c)=>s+measure(c),0)+Math.max(0,r.children.length-1)*siblingGap(r.depth);
    r.branchHeight=Math.max(r.height,total);
    return r.branchHeight;
  }
  function place(r,top){
    r.x=74+r.depth*step;
    r.y=top+(r.branchHeight-r.height)/2;
    const gap=siblingGap(r.depth);
    const total=r.children.reduce((s,c)=>s+c.branchHeight,0)+Math.max(0,r.children.length-1)*gap;
    let childTop=top+(r.branchHeight-total)/2;
    for(const child of r.children){place(child,childTop);childTop+=child.branchHeight+gap}
    if(r.el){r.el.style.left=r.x+'px';r.el.style.top=r.y+'px'}
  }
  measure(state.rootRow);place(state.rootRow,104);
}
function mapBounds(state){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const row of state.rows){
    minX=Math.min(minX,row.x);minY=Math.min(minY,row.y);
    maxX=Math.max(maxX,row.x+row.width);maxY=Math.max(maxY,row.y+row.height);
  }
  return {minX,minY,maxX,maxY};
}
function drawMapLinks(state){
  if(activeMap!==state)return;
  const bounds=mapBounds(state);
  state.world.style.width=Math.max(500,bounds.maxX+180)+'px';
  state.world.style.height=Math.max(380,bounds.maxY+160)+'px';
  state.svg.setAttribute('width',Math.max(500,bounds.maxX+180));
  state.svg.setAttribute('height',Math.max(380,bounds.maxY+160));
  state.svg.innerHTML=state.links.map(([parent,child])=>{
    const x1=parent.x+parent.width,y1=parent.y+parent.height/2;
    const x2=child.x,y2=child.y+child.height/2;
    const bend=clamp((x2-x1)*.45,28,120);
    return `<path d="M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}"/>`;
  }).join('');
}
function positionMapToolbar(state){
  const toolbar=state.world.querySelector('.mm-actions');
  const row=state.rows.find(r=>r.path===state.selectedPath);
  if(!toolbar||!row)return;
  const preferred=(row.y-48)*state.scale+state.panY;
  const bottom=(row.y+row.height+8)*state.scale+state.panY;
  const below=preferred<8&&bottom+43*state.scale<state.viewport.clientHeight-9;
  toolbar.style.top=(below?row.y+row.height+8:row.y-48)+'px';
  const halfWidth=62*state.scale;
  const wanted=(row.x+row.width/2)*state.scale+state.panX;
  const clipped=clamp(wanted,halfWidth+7,Math.max(halfWidth+7,state.viewport.clientWidth-halfWidth-7));
  toolbar.style.left=((clipped-state.panX)/state.scale)+'px';
}
function applyMapView(state){
  state.world.style.transform=`translate(${state.panX}px,${state.panY}px) scale(${state.scale})`;
  positionMapToolbar(state);
  mapSessionViews.set(state.docId,{panX:state.panX,panY:state.panY,scale:state.scale});
}
function zoomMapAt(state,requested,clientX,clientY){
  const b=state.viewport.getBoundingClientRect(),vx=clientX-b.left,vy=clientY-b.top;
  const wx=(vx-state.panX)/state.scale,wy=(vy-state.panY)/state.scale;
  state.scale=clamp(requested,.32,2.6);
  state.panX=vx-wx*state.scale;state.panY=vy-wy*state.scale;
  applyMapView(state);
}
function fitMap(state){
  const {minX,minY,maxX,maxY}=mapBounds(state),w=state.viewport.clientWidth,h=state.viewport.clientHeight;
  const px=w<700?23:58,py=w<700?73:95;
  state.scale=clamp(Math.min(1.1,(w-2*px)/Math.max(1,maxX-minX),(h-2*py)/Math.max(1,maxY-minY)),.32,2.6);
  state.panX=w/2-(minX+maxX)/2*state.scale;
  state.panY=h/2-(minY+maxY)/2*state.scale;
  applyMapView(state);
}
function focusMapRoot(state){
  const r=state.rootRow,w=state.viewport.clientWidth,h=state.viewport.clientHeight;
  state.scale=w<700?.86:1;
  state.panX=(w<700?16:60)-r.x*state.scale;
  state.panY=h/2-(r.y+r.height/2)*state.scale;
  applyMapView(state);
}
function updateMapControls(state){
  const row=state.rows.find(r=>r.path===state.selectedPath);
  const child=$('#mapAddChild'),sibling=$('#mapAddSibling');
  if(child)child.disabled=!row;
  if(sibling)sibling.disabled=!row||row===state.rootRow;
}
// Sequential writes guarantee that a slower IndexedDB operation cannot overwrite
// a newer inline edit. Closing the input never discards the current valid text.
