'use strict';
// mindfagg v30: mindmap/interactions.js (klassisches Script; gemeinsame globale Laufzeit).
function mapDropTarget(state,drag,x,y){
  const targetElement=document.elementFromPoint(x,y)?.closest?.('[data-map-node]');
  let row=targetElement?state.rows.find(r=>r.el===targetElement):null;
  if(!row){
    let closest=null,distance=Infinity;
    for(const candidate of state.rows){
      const b=candidate.el.getBoundingClientRect();
      const dx=Math.max(b.left-x,0,x-b.right),dy=Math.max(b.top-y,0,y-b.bottom);
      const d=Math.hypot(dx,dy);
      if(d<distance){distance=d;closest=candidate}
    }
    if(distance>34)return null;
    row=closest;
  }
  if(!row||row===drag.row||row.path.startsWith(drag.row.path+'.'))return null;
  const rect=row.el.getBoundingClientRect();
  const rel=(y-rect.top)/Math.max(1,rect.height);
  let place=rel<.27?'before':rel>.73?'after':'child';
  if(row===state.rootRow)place='child';
  if((place==='before'||place==='after')&&row.node.parent?.kind==='virtual')return null;
  return {row,place};
}
function mapDropHighlight(state,target){
  for(const r of state.rows){
    r.el.classList.toggle('mm-drop-before',target?.row===r&&target.place==='before');
    r.el.classList.toggle('mm-drop-after',target?.row===r&&target.place==='after');
    r.el.classList.toggle('mm-drop-child',target?.row===r&&target.place==='child');
  }
  const hint=$('#mapDropHint');if(!hint)return;
  if(!target){hint.classList.add('hidden');return}
  const label=plain(target.row.node.title),verb=target.place==='before'?'Davor':target.place==='after'?'Danach':'Als Unterknoten';
  hint.textContent=verb+': '+label;hint.classList.remove('hidden');
}
function wireMapGestures(state){
  const viewport=state.viewport,pointers=new Map();let gesture=null;
  function startPinch(){
    const [a,b]=[...pointers.values()];
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    const rect=viewport.getBoundingClientRect(),vx=cx-rect.left,vy=cy-rect.top;
    if(gesture?.ghost)gesture.ghost.remove();
    gesture?.row?.el.classList.remove('mm-drag-source');
    viewport.classList.remove('drag-active');mapDropHighlight(state,null);
    gesture={kind:'pinch',distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale:state.scale,wx:(vx-state.panX)/state.scale,wy:(vy-state.panY)/state.scale};
    viewport.classList.remove('is-panning');
  }
  function beginNodeDrag(g){
    g.dragging=true;const rect=g.row.el.getBoundingClientRect();
    const ghost=g.row.el.cloneNode(true);
    ghost.removeAttribute('id');ghost.removeAttribute('tabindex');ghost.removeAttribute('role');ghost.removeAttribute('data-map-node');
    ghost.querySelector('.mm-fold')?.remove();
    ghost.classList.remove('selected');ghost.classList.add('mm-drag-ghost');
    ghost.style.width=g.row.width+'px';ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';
    ghost.style.transform=`scale(${state.scale})`;
    document.body.appendChild(ghost);g.ghost=ghost;
    g.offsetX=g.startX-rect.left;g.offsetY=g.startY-rect.top;
    g.row.el.classList.add('mm-drag-source');viewport.classList.add('drag-active');
  }
  function clearNodeDrag(g){
    g.ghost?.remove();g.row?.el?.classList.remove('mm-drag-source');
    viewport.classList.remove('drag-active');mapDropHighlight(state,null);
  }
  viewport.onpointerdown=e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(e.target.closest('[data-map-fold],.mm-actions,.mm-controls,.mm-inline-editor'))return;
    if(state.inlineEdit)closeMapInlineEdit(state);
    const btn=e.target.closest('[data-map-node]');
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    try{viewport.setPointerCapture(e.pointerId)}catch(_){}
    if(pointers.size===1){
      if(btn){
        const row=state.rows.find(r=>r.path===btn.dataset.mapNode);
        if(!row)return;
        gesture={kind:'node',row,startX:e.clientX,startY:e.clientY,dragging:false,ghost:null,drop:null,startOnText:!!e.target.closest('.node-text')};
        selectMapNode(state,row.path);
      }else{
        gesture={kind:'pan',startX:e.clientX,startY:e.clientY,panX:state.panX,panY:state.panY,moved:false};
        viewport.classList.add('is-panning');
      }
    }else if(pointers.size===2)startPinch();
    e.preventDefault();
  };
  viewport.onpointermove=e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>=2&&gesture?.kind==='pinch'){
      const [a,b]=[...pointers.values()],dist=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),box=viewport.getBoundingClientRect();
      const vx=(a.x+b.x)/2-box.left,vy=(a.y+b.y)/2-box.top;
      state.scale=clamp(gesture.scale*dist/gesture.distance,.32,2.6);
      state.panX=vx-gesture.wx*state.scale;state.panY=vy-gesture.wy*state.scale;applyMapView(state);
    }else if(pointers.size===1&&gesture?.kind==='pan'){
      if(Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>5)gesture.moved=true;
      state.panX=gesture.panX+e.clientX-gesture.startX;
      state.panY=gesture.panY+e.clientY-gesture.startY;applyMapView(state);
    }else if(pointers.size===1&&gesture?.kind==='node'){
      const g=gesture;
      if(!g.dragging&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>8)beginNodeDrag(g);
      if(g.dragging){
        g.ghost.style.left=(e.clientX-g.offsetX)+'px';g.ghost.style.top=(e.clientY-g.offsetY)+'px';
        g.drop=mapDropTarget(state,g,e.clientX,e.clientY);
        mapDropHighlight(state,g.drop);
        // Panning near map edges makes deep branches reachable while dragging.
        const b=viewport.getBoundingClientRect(),edge=46,speed=11;
        if(e.clientX>b.left&&e.clientX<b.right){
          if(e.clientX<b.left+edge)state.panX+=speed;
          if(e.clientX>b.right-edge)state.panX-=speed;
        }
        if(e.clientY>b.top&&e.clientY<b.bottom){
          if(e.clientY<b.top+edge)state.panY+=speed;
          if(e.clientY>b.bottom-edge)state.panY-=speed;
        }
        applyMapView(state);
      }
    }
    e.preventDefault();
  };
  function endPointer(e,cancelled){
    if(!pointers.has(e.pointerId))return;
    const wasSingle=pointers.size===1,old=gesture;
    pointers.delete(e.pointerId);
    if(wasSingle&&old?.kind==='node'){
      const drop=old.drop;clearNodeDrag(old);
      if(old.dragging&&!cancelled){
        const finalTarget=mapDropTarget(state,old,e.clientX,e.clientY)||drop;
        if(finalTarget)moveMapNode(old.row.path,finalTarget.row.path,finalTarget.place);
        else toast('Auf einen Knoten ziehen, um zu sortieren oder anzuhängen');
      }else if(!cancelled&&old.row.el.isConnected){
          if(old.startOnText)beginMapInlineEdit(state,old.row.path);
          else old.row.el.focus({preventScroll:true});
        }
    }
    if(wasSingle&&old?.kind==='pan'&&!old.moved&&!cancelled)selectMapNode(state,null);
    if(pointers.size===1){
      const remaining=[...pointers.values()][0];
      gesture={kind:'pan',startX:remaining.x,startY:remaining.y,panX:state.panX,panY:state.panY,moved:false};
      viewport.classList.add('is-panning');
    }else if(!pointers.size){gesture=null;viewport.classList.remove('is-panning')}
  }
  viewport.onpointerup=e=>endPointer(e,false);
  viewport.onpointercancel=e=>endPointer(e,true);
  viewport.onlostpointercapture=e=>{if(pointers.has(e.pointerId))endPointer(e,true)};
  viewport.onwheel=e=>{
    e.preventDefault();
    // Mouse wheel zooms at the cursor; Shift+wheel keeps horizontal panning accessible.
    if(e.shiftKey&&!e.ctrlKey&&!e.metaKey){state.panX-=e.deltaY;state.panY-=e.deltaX;applyMapView(state);return}
    const delta=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?viewport.clientHeight:1);
    zoomMapAt(state,state.scale*Math.exp(-clamp(delta,-400,400)*(e.ctrlKey||e.metaKey?.004:.0018)),e.clientX,e.clientY);
  };
  viewport.onkeydown=e=>{
    if(e.target!==viewport)return;
    if(e.key==='0'){fitMap(state);e.preventDefault()}
    else if(e.key==='Escape'){selectMapNode(state,null);e.preventDefault()}
    else if(e.key.startsWith('Arrow')){const delta=50;if(e.key==='ArrowLeft')state.panX+=delta;if(e.key==='ArrowRight')state.panX-=delta;if(e.key==='ArrowUp')state.panY+=delta;if(e.key==='ArrowDown')state.panY-=delta;applyMapView(state);e.preventDefault()}
  };
  for(const row of state.rows){
    row.el.ondblclick=e=>{if(state.inlineEdit||e.target.closest('[data-map-fold], .mm-inline-editor, .node-text'))return;e.stopPropagation();editNode(row.path)};
    row.el.onkeydown=e=>{
      if(e.target!==row.el)return;
      if(!state.inlineEdit&&state.selectedPath===row.path&&e.key==='Tab'&&!e.shiftKey&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
        e.preventDefault();createMapNode('child');return;
      }
      if(!state.inlineEdit&&state.selectedPath===row.path&&e.key==='Enter'&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
        e.preventDefault();if(row!==state.rootRow)createMapNode('sibling');return;
      }
      if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMapNode(state,row.path)}
      else if(e.key==='F2'){e.preventDefault();beginMapInlineEdit(state,row.path)}
      else if(e.key==='Delete'&&row!==state.rootRow){e.preventDefault();confirmMapDelete(row.path)}
      else if(e.key==='ArrowRight'&&row.node.children.length){
        e.preventDefault();if(mapCollapsed(state.docId).has(row.path))toggleMapChildren(state,row.path);
        else{const child=state.rows.find(r=>r.parent===row);if(child){selectMapNode(state,child.path);child.el.focus()}}
      }else if(e.key==='ArrowLeft'&&row.parent){e.preventDefault();selectMapNode(state,row.parent.path);row.parent.el.focus()}
      else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();const index=state.rows.indexOf(row),next=state.rows[clamp(index+(e.key==='ArrowDown'?1:-1),0,state.rows.length-1)];
        if(next){selectMapNode(state,next.path);next.el.focus()}
      }
    };
  }
  for(const toggle of state.world.querySelectorAll('[data-map-fold]')){
    toggle.onpointerdown=e=>e.stopPropagation();
    toggle.onclick=e=>{e.preventDefault();e.stopPropagation();toggleMapChildren(state,toggle.dataset.mapFold)};
  }
}
function renderMindmap(){
  const root=currentRoot(),doc=documentNow();
  const layout=mapLayout(root,mapCollapsed(doc.id));
  activeMap?.resizeObserver?.disconnect();
  $('#surface').innerHTML=`<div class="mm-viewport" id="mapViewport" tabindex="0" aria-label="Mindmap: Knoten antippen zum Auswählen, ziehen zum Sortieren oder Anhängen; freie Fläche verschieben; Mausrad oder zwei Finger zoomen; Plus/Minus klappt alle Unterknoten auf oder zu">
      <div class="mm-world" id="mapWorld"><svg class="mm-links" id="mapLinks" aria-hidden="true"></svg>${layout.rows.map(r=>mapNodeHtml(r,r===layout.rootRow)).join('')}</div>
    </div>
    <div class="mm-drop-hint hidden" id="mapDropHint" role="status"></div>
    <div class="mm-controls" role="toolbar" aria-label="Mindmap-Steuerung">
      <button type="button" id="mapAddChild" title="Unterknoten erstellen" aria-label="Unterknoten erstellen" disabled>${mapSvg('child')}</button>
      <button type="button" id="mapAddSibling" title="Knoten auf gleicher Ebene erstellen" aria-label="Knoten auf gleicher Ebene erstellen" disabled>${mapSvg('sibling')}</button>
      <span class="mm-divider" aria-hidden="true"></span>
      <button type="button" id="mapFit" title="Alle Knoten einpassen" aria-label="Alle Knoten einpassen">${mapSvg('fit')}</button>
      <button type="button" class="mm-zoom" id="mapCollapseAll" title="Alle Unterknoten zuklappen (−)" aria-label="Alle Unterknoten zuklappen">−</button>
      <button type="button" class="mm-zoom" id="mapExpandAll" title="Alle Unterknoten aufklappen (+)" aria-label="Alle Unterknoten aufklappen">+</button>
    </div>`;
  const state={...layout,docId:doc.id,viewport:$('#mapViewport'),world:$('#mapWorld'),svg:$('#mapLinks'),panX:0,panY:0,scale:1,selectedPath:null,inlineEdit:null};
  activeMap=state;
  const nodeElements=state.world.querySelectorAll('[data-map-node]');
  state.rows.forEach((row,i)=>row.el=nodeElements[i]);
  positionMapRows(state);drawMapLinks(state);
  const remembered=mapSessionViews.get(doc.id);
  if(remembered){Object.assign(state,remembered);applyMapView(state)}else focusMapRoot(state);
  wireMapGestures(state);
  selectMapNode(state,mapSelectedPaths.get(doc.id)||null);
  $('#mapAddChild').onclick=()=>createMapNode('child');
  $('#mapAddSibling').onclick=()=>createMapNode('sibling');
  $('#mapFit').onclick=()=>fitMap(state);
  $('#mapCollapseAll').onclick=()=>setAllMapChildrenCollapsed(state,true);
  $('#mapExpandAll').onclick=()=>setAllMapChildrenCollapsed(state,false);
  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(()=>{
      if(activeMap!==state)return;
      positionMapRows(state);drawMapLinks(state);
      if(state.selectedPath)selectMapNode(state,state.selectedPath);
    });
    observer.observe(state.viewport);state.resizeObserver=observer;
  }
}

