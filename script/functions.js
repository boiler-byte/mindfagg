'use strict';
/* mindfagg v28 — static JavaScript outline. Acorn only parses the supplied text;
   the application's imported code is never executed. DOM event registrations
   are inferred statically and may be incomplete for dynamic bindings. */
function jsOutline(code){
  const functions=[],events=[],functionsSeen=new Set(),eventsSeen=new Set();
  function add(collection,seen,name,node,extra={}){
    if(!node||typeof node.start!=='number')return;
    const position=Number.isInteger(extra.offset)?extra.offset:node.start;
    const key=position+':'+name;
    if(seen.has(key))return;
    seen.add(key);
    collection.push({name,offset:position,line:node.loc?.start.line||code.slice(0,position).split('\n').length,...extra});
  }
  function snippet(node,max=85){
    if(!node)return '';
    const value=code.slice(node.start,node.end).replace(/\s+/g,' ').trim();
    return value.length>max?value.slice(0,max-1)+'…':value;
  }
  function propertyName(node){
    if(!node)return '';
    if(node.type==='Identifier')return node.name;
    if(node.type==='PrivateIdentifier')return '#'+node.name;
    if(node.type==='Literal')return String(node.value);
    return snippet(node,45);
  }
  function bindingName(node){
    if(!node)return '';
    return node.type==='Identifier'?node.name:snippet(node,65);
  }
  function callable(node){return node&&['FunctionExpression','ArrowFunctionExpression'].includes(node.type)}
  function memberName(node){
    if(!node)return '';
    if(node.type==='Identifier')return node.name;
    if(node.type==='MemberExpression'){
      const base=memberName(node.object)||snippet(node.object,55);
      return base+(node.computed?'['+propertyName(node.property)+']':'.'+propertyName(node.property));
    }
    return snippet(node,100);
  }
  function handlerName(node){
    if(!node)return '(ohne Callback)';
    if(callable(node))return node.id?.name||'(anonym)';
    return memberName(node)||snippet(node,50);
  }
  function eventType(node){
    if(!node)return '(dynamisch)';
    if(node.type==='Literal'&&typeof node.value==='string')return node.value;
    if(node.type==='TemplateLiteral'&&node.expressions.length===0)return node.quasis[0]?.value.cooked||'(dynamisch)';
    return '(dynamisch)';
  }
  let tree,parseError=null;
  if(typeof acorn!=='undefined'&&typeof acorn.parse==='function'){
    for(const sourceType of ['module','script']){
      try{tree=acorn.parse(code,{ecmaVersion:'latest',sourceType,locations:true,allowHashBang:true,allowAwaitOutsideFunction:true,allowReturnOutsideFunction:true});break}
      catch(error){parseError=error}
    }
  }else parseError=new Error('Der lokale JavaScript-Parser konnte nicht geladen werden');
  if(!tree){
    // Limited fallback for incomplete JS and JSX syntax, without executing it.
    const patterns=[
      /\b(?:async\s+)?function\s*\*?\s+([\w$]+)\s*\(/g,
      /\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|(?:\([^)]*\)|[\w$]+)\s*=>)/g
    ];
    for(const pattern of patterns){let match;while((match=pattern.exec(code))){
      const offset=match.index+match[0].indexOf(match[1]);
      add(functions,functionsSeen,match[1],{start:offset,loc:{start:{line:code.slice(0,offset).split('\n').length}}},{offset,kind:'Funktion (Näherung)'});
    }}
    return {functions:functions.sort((a,b)=>a.offset-b.offset),events,warning:'JavaScript konnte nicht vollständig analysiert werden: '+String(parseError?.message||'Parserfehler')+'. Die Funktionsliste ist möglicherweise unvollständig.'};
  }
  function visit(node,parent=null,context={className:'',objectName:''}){
    if(!node||typeof node.type!=='string')return;
    let nextContext=context;
    if(node.type==='ClassDeclaration'||node.type==='ClassExpression'){
      const name=node.id?.name||(parent?.type==='VariableDeclarator'?bindingName(parent.id):'');
      nextContext={...context,className:name};
    }
    if(node.type==='FunctionDeclaration'){
      add(functions,functionsSeen,node.id?.name||'(default export)',node.id||node,{kind:'Funktion'});
    }
    if(node.type==='VariableDeclarator'&&callable(node.init)){
      add(functions,functionsSeen,bindingName(node.id),node.id,{kind:'Funktion'});
    }
    if(node.type==='AssignmentExpression'&&callable(node.right)){
      const label=memberName(node.left);
      if(label)add(functions,functionsSeen,label,node.left,{kind:'Funktion'});
    }
    if(node.type==='Property'&&callable(node.value)){
      const name=(context.objectName?context.objectName+'.':'')+propertyName(node.key);
      add(functions,functionsSeen,name,node.key,{kind:'Objektmethode'});
    }
    if(node.type==='MethodDefinition'){
      const method=(context.className?context.className+'.':'')+propertyName(node.key);
      add(functions,functionsSeen,method,node.key,{kind:'Klassenmethode'});
    }
    if(node.type==='PropertyDefinition'&&callable(node.value)){
      const method=(context.className?context.className+'.':'')+propertyName(node.key);
      add(functions,functionsSeen,method,node.key,{kind:'Klassenfunktion'});
    }
    if(node.type==='FunctionExpression'&&node.id&&parent?.type!=='VariableDeclarator'&&parent?.type!=='Property'&&parent?.type!=='AssignmentExpression'){
      add(functions,functionsSeen,node.id.name,node.id,{kind:'Funktion'});
    }
    if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&propertyName(node.callee.property)==='addEventListener'){
      const name=eventType(node.arguments[0]);
      const target=snippet(node.callee.object,90),handler=handlerName(node.arguments[1]);
      add(events,eventsSeen,name,node.callee.property,{offset:node.start,target,handler,kind:'addEventListener'});
    }
    if(node.type==='AssignmentExpression'&&node.left?.type==='MemberExpression'){
      const property=propertyName(node.left.property);
      if(/^on[a-z][a-z0-9]*$/.test(property)){
        add(events,eventsSeen,property.slice(2),node.left.property,{offset:node.start,target:snippet(node.left.object,90),handler:handlerName(node.right),kind:'DOM-Property'});
      }
    }
    // Recursion through the AST; do not traverse arbitrary user objects or text.
    for(const [key,value] of Object.entries(node)){
      if(key==='loc'||key==='start'||key==='end')continue;
      let childContext=nextContext;
      if(node.type==='VariableDeclarator'&&key==='init'&&value?.type==='ObjectExpression'){
        childContext={...nextContext,objectName:bindingName(node.id)};
      }
      if(node.type==='Property'&&key==='value'&&value?.type==='ObjectExpression'){
        childContext={...nextContext,objectName:(context.objectName?context.objectName+'.':'')+propertyName(node.key)};
      }
      if(Array.isArray(value)){
        for(const item of value)if(item&&typeof item.type==='string')visit(item,node,childContext);
      }else if(value&&typeof value.type==='string')visit(value,node,childContext);
    }
  }
  visit(tree);
  functions.sort((a,b)=>a.offset-b.offset||a.name.localeCompare(b.name));
  events.sort((a,b)=>a.offset-b.offset);
  return {functions,events,warning:null};
}
function scriptGoToOffset(offset){
  const d=documentNow();if(!d||fileKind(d)!=='script')return;
  activeFilePanel='script';render();
  const source=$('#scriptSource');if(!source)return;
  const at=Math.max(0,Math.min(Number(offset)||0,source.value.length));
  source.focus({preventScroll:true});source.setSelectionRange(at,at);
  const before=source.value.slice(0,at),line=before.split('\n').length-1;
  const lineHeight=parseFloat(getComputedStyle(source).lineHeight)||23;
  source.scrollTop=Math.max(0,line*lineHeight-source.clientHeight/3);
  syncScriptCodeScroll();
}
function renderFunctionsView(){
  const doc=documentNow(),result=jsOutline(doc.content||'');
  function items(list,events=false){
    if(!list.length)return `<p class="script-functions-empty">${events?'Keine statisch erkennbaren Event-Registrierungen gefunden.':'Keine benannten Funktionen gefunden.'}</p>`;
    return `<div class="script-functions-items">${list.map(item=>`<button type="button" class="script-function-row" data-script-offset="${item.offset}" title="Im Script zu Zeile ${item.line} springen">
      <span><span class="script-function-name">${escapeHtml(item.name)}</span>${events?`<span class="script-function-subtitle">${escapeHtml(item.target)} · ${escapeHtml(item.handler)}</span>`:''}</span><span class="script-function-meta">Zeile ${item.line}</span>
    </button>`).join('')}</div>`;
  }
  $('#surface').innerHTML=`<div class="script-functions-view"><div class="script-functions-inner">
    <header class="script-functions-heading"><div><h2>Functions</h2><p>${result.functions.length} Funktionen · ${result.events.length} Event-Handler-Registrierungen in ${escapeHtml(fileLabel(doc))}</p></div></header>
    ${result.warning?`<p class="script-functions-warning" role="status">${escapeHtml(result.warning)}</p>`:''}
    <input type="search" id="scriptFunctionsSearch" class="script-functions-search" placeholder="Funktionen und Event-Handler suchen" aria-label="Funktionsübersicht filtern">
    <section class="script-functions-section" aria-label="Funktionen"><h3>Funktionen (${result.functions.length})</h3>${items(result.functions)}</section>
    <section class="script-functions-section" aria-label="Event-Handler"><h3>Event-Handler (${result.events.length})</h3>${items(result.events,true)}</section>
    <p class="script-function-subtitle">Statische Analyse: dynamisch registrierte Listener und indirekte Bindungen werden nicht immer erkannt. Ein Klick springt zur entsprechenden Stelle im Script.</p>
  </div></div>`;
  $('#scriptFunctionsSearch').oninput=event=>{
    const query=event.target.value.toLocaleLowerCase('de').trim();
    document.querySelectorAll('.script-function-row').forEach(row=>{row.hidden=Boolean(query)&&!row.textContent.toLocaleLowerCase('de').includes(query)});
  };
  $('#surface').onclick=event=>{
    const row=event.target.closest('[data-script-offset]');if(row)scriptGoToOffset(Number(row.dataset.scriptOffset));
  };
}
