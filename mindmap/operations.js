'use strict';
// mindfagg v30: mindmap/operations.js (klassisches Script; gemeinsame globale Laufzeit).
function mapNodeEnd(scan,n){
  for(let i=n.start+1;i<scan.items.length;i++){
    const it=scan.items[i];
    if(it.kind==='heading'&&(n.kind==='li'||it.level<=n.level))return i;
    if(n.kind==='li'&&it.kind==='list'&&it.indent<=n.indent)return i;
  }
  return scan.items.length;
}
function mapNodeBody(raw,n){
  const prefix=n.kind==='h'?raw.match(/^ {0,3}#{1,6}[ \t]*/):raw.match(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/);
  return prefix?raw.slice(prefix[0].length):raw.trimStart();
}
function mapSubtreeDepth(n,root){
  let depth=0,cur=n;
  while(cur&&cur!==root){depth++;cur=cur.parent}
  return depth;
}
// Change only structural Markdown markers and required indentation. Everything else
// (body text, status, checkboxes, descriptions, links, fenced code) stays with the subtree.
function mapRebaseBlock(scan,source,rawLines,spec){
  const nodes=flattened(source),structural=new Map(nodes.map(n=>[n.start,n]));
  const mode=source.kind+'-'+spec.kind;
  const newInfo=new Map();
  const difference=(spec.indent||0)-(source.indent||0);
  for(const node of nodes){
    const depth=mapSubtreeDepth(node,source);
    if(spec.kind==='li'){
      const indent=source.kind==='li'?Math.max(0,node.indent+difference):(spec.indent+depth*2);
      newInfo.set(node,{kind:'li',indent,marker:node===source?(spec.marker|| (node.kind==='li'?node.marker:'-')):(node.kind==='li'?node.marker:'-')});
    }else if(source.kind==='h'){
      if(node.kind==='h'){
        const level=node.level+spec.level-source.level;
        if(level<1||level>6)return null;
        newInfo.set(node,{kind:'h',level});
      }else newInfo.set(node,{kind:'li',indent:node.indent,marker:node.marker||'-'});
    }else{
      if(node===source)newInfo.set(node,{kind:'h',level:spec.level});
      else newInfo.set(node,{kind:'li',indent:Math.max(0,(depth-1)*2),marker:node.marker||'-'});
    }
  }
  let owner=source;
  return rawLines.map((raw,j)=>{
    const node=structural.get(source.start+j);
    if(node){
      owner=node;const info=newInfo.get(node),body=mapNodeBody(raw,node);
      return info.kind==='h'?'#'.repeat(info.level)+' '+body:' '.repeat(info.indent)+(info.marker||'-')+' '+body;
    }
    if(!raw.trim()||mode==='h-h')return raw;
    const oldBase=owner.kind==='li'?owner.indent+2:0;
    const info=newInfo.get(owner),newBase=info.kind==='li'?info.indent+2:0;
    const lead=(raw.match(/^[ \t]*/)||[''])[0],columns=indentWidth(lead);
    return ' '.repeat(Math.max(0,columns+newBase-oldBase))+raw.slice(lead.length);
  });
}
function mapNodeAt(path){return flattened(currentModel).find(n=>n.path===path&&n.kind!=='virtual')}
function mapInsertionSpec(source,target,place){
  if(place==='before'||place==='after'){
    if(target===currentRoot())return null;
    return target.kind==='h'?{kind:'h',level:target.level}:{kind:'li',indent:target.indent,marker:target.marker||'-'};
  }
  if(target.kind==='li')return {kind:'li',indent:target.indent+2,marker:'-'};
  const hasHeadingChildren=target.children.some(c=>c.kind==='h');
  if(target.level<6&&(source.kind==='h'||hasHeadingChildren))return {kind:'h',level:target.level+1};
  return {kind:'li',indent:0,marker:'-'};
}
async function commitMapContent(content,selectedLine,notice,expectedParentLine,lineRemap){
  await flushMapInlineEdit();
  const d=documentNow(),scan=scanMarkdown(content);
  if(!scan.valid){toast('Verschieben nicht m\u00f6glich: genau eine H1 erforderlich');return false}
  const model=parseMarkdown(content,scan);
  const selected=flattened(model).find(n=>n.start===selectedLine&&n.kind!=='virtual');
  if(selectedLine!==null&&!selected){toast('Die neue Knotenposition konnte nicht bestimmt werden');return false}
  if(expectedParentLine!==undefined&&selected?.parent?.start!==expectedParentLine){
    toast('Diese Position ist mit der Markdown-Hierarchie nicht vereinbar');return false;
  }
  if(content===d.content){toast('Reihenfolge unver\u00e4ndert');return false}
  // Map folded paths to the new tree before persistence; this also survives reopening.
  const folded=mapCollapsed(d.id),nextFolded=new Set();
  if(typeof lineRemap==='function'){
    const oldNodes=flattened(currentModel),nextNodes=flattened(model);
    for(const path of folded){
      const oldNode=oldNodes.find(n=>n.path===path);if(!oldNode)continue;
      const nextLine=lineRemap(oldNode.start);
      if(nextLine===null||nextLine===undefined)continue;
      const nextNode=nextNodes.find(n=>n.start===nextLine&&n.kind!=='virtual');
      if(nextNode&&nextNode.children.length)nextFolded.add(nextNode.path);
    }
  }
  if(selected){for(const foldedPath of [...nextFolded]){
    if(selected.path.startsWith(foldedPath+'.'))nextFolded.delete(foldedPath);
  }}
  const previousContent=d.content,previousFolded=d.mapCollapsedPaths;
  d.content=content;d.mapCollapsedPaths=[...nextFolded];
  try{await put('docs',{...d})}
  catch(e){d.content=previousContent;d.mapCollapsedPaths=previousFolded;console.error(e);toast('\u00c4nderung konnte nicht gespeichert werden');return false}
  mapCollapsedPaths.set(d.id,nextFolded);
  if(selected)mapSelectedPaths.set(d.id,selected.path);else mapSelectedPaths.delete(d.id);
  render();
  if(selected)centerMapNode(selected.path);
  if(notice)toast(notice);
  return selected||true;
}
function mapNewLineAfterRemoval(originalIndex,start,end,insertAt,insertLength){
  let index=originalIndex;
  if(index>=end)index-=end-start;
  if(index>=insertAt)index+=insertLength;
  return index;
}
async function moveMapNode(fromPath,toPath,place){
  const source=mapNodeAt(fromPath),target=mapNodeAt(toPath),root=currentRoot();
  if(!source||!target||source===root||source===target||toPath.startsWith(fromPath+'.'))return false;
  if((place==='before'||place==='after')&&target===root)return false;
  const parent=place==='child'?target:target.parent;
  if(!parent||parent.kind==='virtual')return false;
  const spec=mapInsertionSpec(source,target,place);if(!spec)return false;
  const d=documentNow(),scan=scanMarkdown(d.content),lines=scan.lines;
  const start=source.start,end=mapNodeEnd(scan,source),size=end-start;
  const destination=place==='before'?target.start:place==='after'?mapNodeEnd(scan,target):mapNodeEnd(scan,target);
  const chunk=mapRebaseBlock(scan,source,lines.slice(start,end),spec);
  if(!chunk){toast('Die maximale Überschriftenebene H6 würde überschritten');return false}
  const remainder=lines.slice();remainder.splice(start,size);
  const insertAt=clamp(destination-(destination>start?size:0),0,remainder.length);
  remainder.splice(insertAt,0,...chunk);
  const expectedParent=mapNewLineAfterRemoval(parent.start,start,end,insertAt,chunk.length);
  const remap=oldLine=>{
    if(oldLine>=start&&oldLine<end)return insertAt+oldLine-start;
    let result=oldLine>=end?oldLine-size:oldLine;
    if(result>=insertAt)result+=size;
    return result;
  };
  return commitMapContent(remainder.join('\n'),insertAt,place==='child'?'Knoten umgehängt':'Knoten sortiert',expectedParent,remap);
}
// Clipboard access is restricted by some browsers (especially file://). The fallback
// supports a direct click without requiring clipboard read permission.
async function writeMapClipboard(text){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return true}catch(error){console.warn('Clipboard API:',error)}
  }
  const input=document.createElement('textarea');
  input.value=text;input.setAttribute('readonly','');
  Object.assign(input.style,{position:'fixed',left:'-9999px',top:'0',opacity:'0'});
  document.body.appendChild(input);input.select();
  let copied=false;
  try{copied=document.execCommand('copy')}catch(error){console.warn('Clipboard-Fallback:',error)}
  input.remove();return copied;
}
async function copyMapNode(path){
  const node=mapNodeAt(path),doc=documentNow();
  if(!node||node===currentRoot()||!doc)return false;
  const scan=scanMarkdown(doc.content);
  const markdown=scan.lines.slice(node.start,mapNodeEnd(scan,node)).join('\n');
  // Keep a reference rather than duplicating anything in the document.
  mapCopyReference={docId:doc.id,path:node.path,start:node.start,raw:scan.lines[node.start]};
  const copied=await writeMapClipboard(markdown);
  if(activeMap?.docId===doc.id)selectMapNode(activeMap,activeMap.selectedPath);
  toast(copied?'Knoten mit Unterknoten als Markdown kopiert':'Knoten vorgemerkt · Zwischenablage nicht verfügbar');
  return true;
}
async function pasteMapNode(targetPath){
  const reference=mapCopyReference,target=mapNodeAt(targetPath),destDoc=documentNow();
  if(!reference||!target||!destDoc)return false;
  const sourceDoc=docs.find(d=>d.id===reference.docId);
  if(!sourceDoc){mapCopyReference=null;toast('Kopierter Knoten nicht mehr vorhanden');render();return false}
  const sourceScan=scanMarkdown(sourceDoc.content);
  const sourceModel=parseMarkdown(sourceDoc.content,sourceScan);
  const source=flattened(sourceModel).find(n=>n.path===reference.path&&n.kind!=='virtual');
  if(!source||source.start!==reference.start||sourceScan.lines[source.start]!==reference.raw){
    mapCopyReference=null;toast('Quellknoten wurde verändert · bitte erneut kopieren');render();return false;
  }
  const destScan=scanMarkdown(destDoc.content),lines=destScan.lines;
  const spec=mapInsertionSpec(source,target,'child');
  if(!spec)return false;
  const block=mapRebaseBlock(sourceScan,source,sourceScan.lines.slice(source.start,mapNodeEnd(sourceScan,source)),spec);
  if(!block){toast('Einfügen nicht möglich: maximale Überschriftenebene H6 überschritten');return false}
  const insertAt=mapNodeEnd(destScan,target);
  const result=[...lines];result.splice(insertAt,0,...block);
  const selected=await commitMapContent(result.join('\n'),insertAt,'Knoten als Unterknoten eingefügt · Rückgängig möglich',target.start,
    oldLine=>oldLine>=insertAt?oldLine+block.length:oldLine);
  if(!selected)return false;
  mapCopyReference=null;
  // commitMapContent rendered while the reference was present; remove paste from the menu now.
  if(activeMap?.docId===destDoc.id)selectMapNode(activeMap,activeMap.selectedPath);
  return true;
}
function confirmMapDelete(path){
  const n=mapNodeAt(path);if(!n||n===currentRoot())return;
  const descendants=flattened(n).length-1;
  openModal(`<h2>Knoten löschen?</h2><p><strong>${escapeHtml(plain(n.title))}</strong> wird gelöscht.${descendants?' Auch '+descendants+' Unterknoten werden entfernt.':''} Die Änderung kann über Rückgängig wiederhergestellt werden.</p><div class="modalactions"><button type="button" class="btn" id="cancelModal">Abbrechen</button><button type="button" class="btn" id="confirmMapDelete" style="background:#633443;border-color:#af6575;color:#fff">Löschen</button></div>`);
  wireCancel();
  $('#confirmMapDelete').onclick=async()=>{
    const d=documentNow(),scan=scanMarkdown(d.content),lines=scan.lines;
    lines.splice(n.start,mapNodeEnd(scan,n)-n.start);
    closeModal();
    const end=mapNodeEnd(scan,n);
    await commitMapContent(lines.join('\n'),n.parent.start,'Knoten gelöscht',undefined,oldLine=>oldLine<n.start?oldLine:oldLine>=end?oldLine-(end-n.start):null);
  };
}
async function createMapNode(place){
  const state=activeMap,selected=mapNodeAt(state?.selectedPath);
  if(!state||!selected)return;
  if(place==='sibling'&&selected===currentRoot())return;
  const scan=scanMarkdown(documentNow().content),lines=scan.lines;
  let text,insertion,parent;
  if(place==='child'){
    parent=selected;
    const hasHeadingChildren=selected.children.some(n=>n.kind==='h');
    if(selected.kind==='h'&&selected.level<6&&hasHeadingChildren)text='#'.repeat(selected.level+1)+' Neuer Knoten';
    else text=(selected.kind==='li'?' '.repeat(selected.indent+2):'')+'- Neuer Knoten';
    insertion=mapNodeEnd(scan,selected);
  }else{
    parent=selected.parent;
    if(selected.kind==='h')text='#'.repeat(selected.level)+' Neuer Knoten';
    else text=' '.repeat(selected.indent)+(selected.marker||'-')+' Neuer Knoten';
    insertion=mapNodeEnd(scan,selected);
  }
  lines.splice(insertion,0,text);
  const wasFolded=place==='child'&&mapCollapsed(state.docId).delete(parent.path);
  const result=await commitMapContent(lines.join('\n'),insertion,place==='child'?'Unterknoten erstellt':'Knoten auf gleicher Ebene erstellt',parent.start,oldLine=>oldLine>=insertion?oldLine+1:oldLine);
  if(!result&&wasFolded)mapCollapsed(state.docId).add(parent.path);
  if(result?.path&&activeMap?.docId===state.docId){
    beginMapInlineEdit(activeMap,result.path,true);
  }
}
