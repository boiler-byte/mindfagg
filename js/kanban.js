'use strict';
// Kanban: Board/Tierlist, Statusfilter und Drag-and-drop.
let kanbanTierlist=false;
const KANBAN_ALL_SCOPE='__all__';

// The Kanban scope always contains immediate children only. Story is task-only.
function kanbanVisible(n){return (n.status||'story')!=='story'||n.checked!==null}
function renderKanban(){
  const root=currentRoot(),all=flattened(root).filter(n=>n.kind!=='virtual');
  const scopes=all.filter(n=>n.children.length>0);
  if(!scopes.length)scopes.push(root);
  const showAll=scopePath===KANBAN_ALL_SCOPE;
  const selected=showAll?null:(scopes.find(n=>n.path===scopePath)||scopes[0]);
  if(!showAll)scopePath=selected.path;
  const opts=`<option value="${KANBAN_ALL_SCOPE}" ${showAll?'selected':''}>Alle Knoten (${all.length})</option>`+
    scopes.map(n=>{
      const count=n.children.filter(kanbanVisible).length;
      return `<option value="${n.path}" ${n.path===scopePath?'selected':''}>${escapeHtml(plain(n.title))} (${count})</option>`;
    }).join('');
  const orderedStatuses=kanbanTierlist?[...STATUS].reverse():STATUS;
  const lanes=orderedStatuses.map(st=>{
    const candidates=showAll?all:selected.children;
    const ns=candidates.filter(n=>(n.status||'story')===st&&(showAll||kanbanVisible(n)));
    return `<div class="lane" data-lane-status="${st}" style="--lane-accent:${statusColor(st)}">
      <div class="laneheading"><span>${escapeHtml(statusLabel(st))}</span><span class="count">${ns.length}</span></div>
      <div class="lane-tickets">
      ${ns.map(n=>`<div class="ticket" data-open="${n.path}" data-ticket-status="${st}" tabindex="0" aria-label="${escapeHtml(plain(n.title))}; lange drücken und in einen anderen Status ziehen">
        <b>${labeledNodeTitle(n)}</b>
        ${n.children.length?`<small class="ticket-subcount">▦ ${n.children.length} Unterknoten</small>`:''}
        ${n.children.length?`<button class="btn" data-scope="${n.path}">Unterknoten →</button>`:''}
        <div class="ticket-progress" role="progressbar" aria-label="Fortschritt von ${escapeHtml(plain(n.title))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(n.progress)}" title="${Math.round(n.progress)} % Fortschritt"><span style="width:${Math.round(n.progress)}%"></span></div>
      </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  $('#surface').innerHTML=`<div class="surfacehead kanban-head"><div class="kanban-toolbar">
    <select class="scope" id="scopeSelect" aria-label="Kanban-Scope auswählen">${opts}</select>
    <button type="button" class="btn kanban-layout-toggle${kanbanTierlist?' active':''}" id="kanbanRotate" aria-label="Tierlist-Darstellung" aria-pressed="${kanbanTierlist}" title="Kanban-Layout zwischen Spalten und Tierlist wechseln"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V5h6M4 5a9 9 0 1 1-1 11"/><path d="M9 9h9M9 13h9M9 17h9"/></svg><span>Tierlist</span></button>
    </div></div><div class="kanban${kanbanTierlist?' tierlist':''}" id="kanbanBoard">${lanes}</div>`;
  $('#scopeSelect').onchange=e=>{scopePath=e.target.value;renderKanban()};
  $('#kanbanRotate').onclick=()=>{kanbanTierlist=!kanbanTierlist;try{localStorage.setItem('mfKanbanLayout',kanbanTierlist?'tierlist':'columns')}catch(e){console.warn('Kanban-Layout konnte nicht gespeichert werden:',e)}renderKanban()};
  document.querySelectorAll('[data-open]').forEach(el=>{
    el.onclick=e=>{if(el._suppressClickUntil&&Date.now()<el._suppressClickUntil){e.stopPropagation();e.preventDefault();return}
      if(e.target.closest('[data-scope]'))return;
      editNode(el.dataset.open);
    };
    el.onkeydown=e=>{if(e.target!==el)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();editNode(el.dataset.open)}};
  });
  document.querySelectorAll('[data-scope]').forEach(el=>el.onclick=e=>{e.stopPropagation();scopePath=el.dataset.scope;renderKanban()});
  wireKanbanDrag();
}
// Pointer Events support a deliberate long press on both mouse and touch.
// Only a drop into a different column changes metadata; Markdown tree order is preserved.
function wireKanbanDrag(){
  const board=$('#kanbanBoard');if(!board)return;
  let gesture=null;
  const edge=46;
  function laneAt(x,y){return document.elementFromPoint(x,y)?.closest?.('[data-lane-status]')||null}
  function highlight(lane){
    board.querySelectorAll('.lane').forEach(el=>el.classList.toggle('kb-drop-target',el===lane));
  }
  function positionGhost(g){
    if(!g.ghost)return;
    g.ghost.style.left=(g.x-g.offsetX)+'px';g.ghost.style.top=(g.y-g.offsetY)+'px';
  }
  function refreshTarget(g){
    const lane=laneAt(g.x,g.y);
    g.target=lane?.dataset.laneStatus||null;
    highlight(lane);
  }
  function tick(){
    const g=gesture;if(!g||!g.dragging)return;
    const r=board.getBoundingClientRect();
    if(kanbanTierlist){
      // Tierlist: scroll the vertical board and the current row independently.
      if(g.x>r.left&&g.x<r.right){
        const vertical=g.y<r.top+edge?-12:g.y>r.bottom-edge?12:0;
        if(vertical)board.scrollTop+=vertical;
      }
      const lane=laneAt(g.x,g.y)||board.querySelector('.lane.kb-drop-target');
      const strip=lane?.querySelector('.lane-tickets');
      if(strip){
        const b=strip.getBoundingClientRect();
        if(g.y>b.top&&g.y<b.bottom){
          const horizontal=g.x<b.left+edge?-13:g.x>b.right-edge?13:0;
          if(horizontal)strip.scrollLeft+=horizontal;
        }
      }
    }else if(g.y>r.top&&g.y<r.bottom){
      const speed=g.x<r.left+edge?-15:g.x>r.right-edge?15:0;
      if(speed)board.scrollLeft+=speed;
    }
    refreshTarget(g);g.raf=requestAnimationFrame(tick);
  }
  function start(g){
    if(gesture!==g||g.dragging)return;
    g.dragging=true;
    const rect=g.ticket.getBoundingClientRect();
    g.ghost=g.ticket.cloneNode(true);
    g.ghost.removeAttribute('data-open');g.ghost.classList.add('kb-drag-ghost');
    g.ghost.querySelectorAll('select,button').forEach(el=>{el.tabIndex=-1;el.disabled=true});
    Object.assign(g.ghost.style,{width:rect.width+'px',height:rect.height+'px'});
    document.body.appendChild(g.ghost);
    g.ticket.classList.add('kb-drag-source');
    document.body.classList.add('kb-is-dragging');
    positionGhost(g);refreshTarget(g);g.raf=requestAnimationFrame(tick);
  }
  function clear(g){
    clearTimeout(g.timer);
    if(g.raf)cancelAnimationFrame(g.raf);
    g.ghost?.remove();g.ticket.classList.remove('kb-drag-source');
    document.body.classList.remove('kb-is-dragging');highlight(null);
    if(gesture===g)gesture=null;
  }
  for(const ticket of board.querySelectorAll('.ticket')){
    ticket.addEventListener('pointerdown',e=>{
      if(gesture||e.button!==0||e.target.closest('select,button'))return;
      const rect=ticket.getBoundingClientRect();
      const g={ticket,id:ticket.dataset.open,source:ticket.dataset.ticketStatus,pointerId:e.pointerId,
        startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,
        offsetX:e.clientX-rect.left,offsetY:e.clientY-rect.top,
        dragging:false,target:null,timer:null,ghost:null,raf:0};
      gesture=g;
      g.timer=setTimeout(()=>start(g),e.pointerType==='mouse'?340:460);
      try{ticket.setPointerCapture(e.pointerId)}catch(_){}
    });
    ticket.addEventListener('pointermove',e=>{
      const g=gesture;if(!g||g.ticket!==ticket||g.pointerId!==e.pointerId)return;
      g.x=e.clientX;g.y=e.clientY;
      if(!g.dragging){if(Math.hypot(g.x-g.startX,g.y-g.startY)>10){g.ticket._suppressClickUntil=Date.now()+450;clear(g)}return}
      positionGhost(g);refreshTarget(g);e.preventDefault();
    });
    ticket.addEventListener('pointerup',e=>{
      const g=gesture;if(!g||g.ticket!==ticket||g.pointerId!==e.pointerId)return;
      if(!g.dragging){clear(g);return}
      g.ticket._suppressClickUntil=Date.now()+450;
      refreshTarget(g);
      const to=g.target,id=g.id,from=g.source;
      clear(g);e.preventDefault();e.stopPropagation();
      if(!to||to===from)return;
      const node=flattened(currentModel).find(n=>n.path===id);
      // A non-task moved to Story becomes hidden by the Story-only filter.
      patchNode(id,{status:to==='story'?null:to}).then(()=>toast(to==='story'&&node?.checked===null
        ?'Story: Knoten ohne Checkbox in Kanban ausgeblendet'
        :'Status: '+statusLabel(to)));
    });
    ticket.addEventListener('pointercancel',e=>{if(gesture?.ticket===ticket&&gesture.pointerId===e.pointerId)clear(gesture)});
    ticket.addEventListener('lostpointercapture',e=>{if(gesture?.ticket===ticket&&gesture.pointerId===e.pointerId)clear(gesture)});
    ticket.addEventListener('contextmenu',e=>{if(gesture?.ticket===ticket||Boolean(ticket._suppressClickUntil&&Date.now()<ticket._suppressClickUntil))e.preventDefault()});
  }
}

const SYN_TOKENS=/(\[\[([^\]]+)\]\]|\[[^\]]+\]\([^)]+\)|`[^`]*`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
