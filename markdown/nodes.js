'use strict';
// mindfagg v30: markdown/nodes.js (klassisches Script; gemeinsame globale Laufzeit).
function plain(s){return s.replace(/!?\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,(_,d,h,a)=>a||h||d).replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_`~]/g,'').trim()}
// The type is read from the original Markdown marker, not inferred from status.
function nodeTypeLabel(n){
  if(n.kind==='h')return 'H'+n.level;
  if(n.kind==='li')return n.marker||'-';
  return '';
}
function nodeTypeValue(n){
  if(n.kind==='h')return 'h'+n.level;
  const marker=n.marker||'-';
  if(/^\d+\.$/.test(marker))return 'ol.';
  if(/^\d+\)$/.test(marker))return 'ol)';
  return 'ul'+marker;
}
const NODE_TYPES=[
  ...[1,2,3,4,5,6].map(level=>({value:'h'+level,label:'H'+level+' · '+ '#'.repeat(level)+' · Überschrift '+level})),
  {value:'ul-',label:'- · Unsortierte Liste'},
  {value:'ul*',label:'* · Unsortierte Liste'},
  {value:'ul+',label:'+ · Unsortierte Liste'},
  {value:'ol.',label:'1. · Nummerierte Liste (Punkt)'},
  {value:'ol)',label:'1) · Nummerierte Liste (Klammer)'}
];
function labeledNodeTitle(n){
  return `<span class="node-type">${escapeHtml(nodeTypeLabel(n))}</span><span class="node-text">${escapeHtml(plain(n.title))}</span>`;
}
// mindstorm v10: Mindomo-inspired structured tree layout and real Markdown drag-and-drop.
// Node coordinates are a function of the hierarchy; dragging edits the Markdown tree.
