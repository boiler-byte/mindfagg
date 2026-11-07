'use strict';
/* mindfagg v41: offline source pretty-printing for HTML, JS, CSS, XML, SVG and JSON.
 * Formatters never execute source code. Invalid or semantically changed JavaScript
 * is rejected before the canonical document is modified. */
const SCRIPT_PRETTY_EXTENSIONS=new Set(['html','htm','js','mjs','cjs','css','xml','svg','xhtml','json']);
const SCRIPT_PRETTY_LIMIT=2*1024*1024;

function scriptPrettyKind(extension){
  const ext=String(extension||'').toLowerCase();
  if(['html','htm'].includes(ext))return 'html';
  if(['js','mjs','cjs'].includes(ext))return 'js';
  if(ext==='css')return 'css';
  if(ext==='json')return 'json';
  if(['xml','svg','xhtml'].includes(ext))return 'xml';
  return null;
}
function scriptPrettyNormalize(text){return String(text).replace(/\r\n?/g,'\n')}
function scriptPrettyAstSignature(value){
  return JSON.stringify(value,(key,item)=>['start','end','loc','range','raw','startLine','startColumn'].includes(key)?undefined:item);
}
function scriptPrettyJsTokens(text,ast){
  if(typeof acorn==='undefined')throw Error('JavaScript-Parser nicht verf\u00fcgbar.');
  const comments=[],tokens=[],protectedParts=[];
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(node.type==='TemplateLiteral'){
      protectedParts.push({start:node.start,end:node.end});return;
    }
    for(const [key,item] of Object.entries(node)){
      if(key==='parent'||key==='tokens'||key==='comments')continue;
      if(Array.isArray(item))item.forEach(visit);
      else if(item&&typeof item==='object'&&typeof item.type==='string')visit(item);
    }
  };
  visit(ast);
  protectedParts.sort((a,b)=>a.start-b.start);
  const tokenizer=acorn.tokenizer(text,{ecmaVersion:'latest',sourceType:ast.sourceType||'module',allowHashBang:true,
    onComment:(block,_,start,end)=>comments.push({start,end,raw:text.slice(start,end),comment:true,line:!block})});
  while(true){
    const token=tokenizer.getToken();if(token.type.label==='eof')break;
    tokens.push({start:token.start,end:token.end,raw:text.slice(token.start,token.end)});
  }
  const all=tokens.concat(comments).sort((a,b)=>a.start-b.start||b.end-a.end);
  const output=[];let cursor=0,protect=0;
  for(const token of all){
    while(protect<protectedParts.length&&protectedParts[protect].end<=token.start)protect++;
    const area=protectedParts[protect];
    if(area&&token.start>=area.start&&token.start<area.end){
      if(cursor<=area.start){output.push({start:area.start,end:area.end,raw:text.slice(area.start,area.end),protected:true});cursor=area.end}
      continue;
    }
    if(token.start<cursor)continue;
    output.push(token);cursor=token.end;
  }
  return output;
}
function scriptPrettyJavascript(source){
  const text=scriptPrettyNormalize(source),parsed=parseJavascriptCode(text);
  if(parsed.errors.length)throw Error(parsed.errors[0].message);
  if(!parsed.ast)return text;
  const tokens=scriptPrettyJsTokens(text,parsed.ast);
  if(!tokens.length)return text;
  let out='',depth=0,paren=0,bracket=0,prev=null,prevEnd=0;
  const ternary=[];
  const trim=()=>{out=out.replace(/[ \t]+$/,'')};
  const space=()=>{if(out&&!/[ \t\n]$/.test(out))out+=' '};
  const newline=()=>{
    trim();if(!out.endsWith('\n'))out+='\n';out+='  '.repeat(Math.max(0,depth));
  };
  const operators=/^(?:=|=>|\+|\-|\*|\/|%|\*\*|==|===|!=|!==|<=|>=|<|>|&&|\|\||\?\?|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\?\?=|&&=|\|\|=|\||&|\^|<<|>>|>>>|<<=|>>=|>>>=|\*\*=)$/;
  const controls=new Set(['if','for','while','switch','catch','with']);
  tokens.forEach((token,i)=>{
    const raw=token.raw,next=tokens[i+1]?.raw||'',oldGap=text.slice(prevEnd,token.start);
    if(!prev){
      if(token.start>0&&text.startsWith('#!')){const end=text.indexOf('\n');if(end>=0){out+=text.slice(0,end);newline()}}
    }else if(prev.line){newline()}
    else if(raw==='}'){}
    else if(prev.raw==='}'&& ![';',',',')',']','.','?.','(','[',':','?'].includes(raw)&&!['else','catch','finally','while'].includes(raw))newline();
    else if(oldGap.includes('\n')&&!out.endsWith('\n')&&!/^\s*$/.test(out))newline();
    if(token.comment){
      if(!out.endsWith('\n'))space();
      out+=raw;
      if(token.line)newline();
      else if(raw.includes('\n'))newline();
      prev=token;prevEnd=token.end;return;
    }
    if(raw==='{'){
      if(prev&&!['(','[','.','?.','${'].includes(prev.raw))space();
      out+='{';depth++;newline();
    }else if(raw==='}'){
      depth=Math.max(0,depth-1);
      if(prev?.raw==='{'){
        trim();out+='}';
      }else{newline();out+='}'}
    }else if(raw===';'){
      trim();out+=';';
      if(paren>0)space();else newline();
    }else if(raw===','){
      trim();out+=',';space();
    }else if(raw===':'){
      const conditional=ternary.length&&ternary.at(-1).depth===depth&&ternary.at(-1).paren===paren&&ternary.at(-1).bracket===bracket;
      if(conditional){ternary.pop();space();}else trim();
      out+=': '; 
    }else if(raw==='('){
      if(controls.has(prev?.raw)||['=','=>','return','yield'].includes(prev?.raw))space();
      else trim();
      out+='(';paren++;
    }else if(raw===')'){
      trim();out+=')';paren=Math.max(0,paren-1);
    }else if(raw==='['){
      if(['=',':','return','yield','=>',','].includes(prev?.raw))space();
      else trim();
      out+='[';bracket++;
    }else if(raw===']'){
      trim();out+=']';bracket=Math.max(0,bracket-1);
    }else if(['.','?.'].includes(raw)){
      trim();out+=raw;
    }else if(raw==='?'){
      ternary.push({depth,paren,bracket});
      space();out+='?';space();
    }else if(operators.test(raw)){
      if(!['!','~'].includes(raw))space();
      out+=raw;space();
    }else if(['!','~','++','--','...'].includes(raw)){
      if(raw==='...'&&prev&&!['(','[','{',','].includes(prev.raw))space();
      out+=raw;
    }else{
      const prevRaw=prev?.raw||'';
      if(prev&& !/^(?:\(|\[|\.|\?\.|!|~|\+\+|--|\.\.\.)$/.test(prevRaw)
        &&!out.endsWith('\n')&&!out.endsWith(' ')&&raw!=='`')space();
      out+=raw;
    }
    prev=token;prevEnd=token.end;
  });
  const formatted=out.trimEnd()+'\n';
  const again=parseJavascriptCode(formatted);
  if(again.errors.length||scriptPrettyAstSignature(parsed.ast)!==scriptPrettyAstSignature(again.ast)){
    throw Error('Formatierung w\u00fcrde die JavaScript-Struktur ver\u00e4ndern. Der Quelltext bleibt unver\u00e4ndert.');
  }
  return formatted;
}

function scriptPrettyCss(source){
  const text=scriptPrettyNormalize(source);
  let out='',buffer='',depth=0,paren=0,bracket=0,quote='',comment=false;
  const indent=()=> '  '.repeat(depth);
  const flush=(symbol='')=>{
    const part=buffer.trim();buffer='';
    if(part){
      let written=part;
      if(depth>0&&symbol!=='{'&&!/^@/.test(part))written=written.replace(/^(--[\w-]+|[-a-zA-Z][\w-]*)\s*:\s*/, '$1: ');
      out+=indent()+written+symbol+'\n';
    }else if(symbol===';')out+=indent()+';\n';
    else if(symbol==='{')throw Error('CSS: Fehlender Selektor vor der geschweiften Klammer.');
  };
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(comment){buffer+=ch;if(ch==='*'&&next==='/'){buffer+='/';i++;comment=false}continue}
    if(quote){buffer+=ch;if(ch==='\\'&&i+1<text.length){buffer+=text[++i];continue}if(ch===quote)quote='';continue}
    if(ch==='/'&&next==='*'){buffer+='/*';i++;comment=true;continue}
    if(ch==='"'||ch==="'"){quote=ch;buffer+=ch;continue}
    if(ch==='(')paren++;else if(ch===')')paren--;
    else if(ch==='[')bracket++;else if(ch===']')bracket--;
    if(paren<0||bracket<0)throw Error('CSS: Unerwartete schlie\u00dfende Klammer.');
    if(paren||bracket){buffer+=ch;continue}
    if(ch==='{'){flush(' {');depth++;continue}
    if(ch==='}'){
      if(!depth)throw Error('CSS: Unerwartetes }');
      flush();depth--;out+=indent()+'}\n';continue;
    }
    if(ch===';'){flush(';');continue}
    buffer+=ch;
  }
  if(comment||quote||paren||bracket||depth)throw Error('CSS: Nicht geschlossene Zeichenfolge, Klammer oder Regel.');
  flush();return out.trimEnd()+'\n';
}

function scriptPrettyMarkupTokenize(text,xml){
  const tokens=[];let i=0;
  while(i<text.length){
    if(text[i]!=='<'){
      let end=text.indexOf('<',i);if(end<0)end=text.length;
      tokens.push({kind:'text',raw:text.slice(i,end),start:i,end});i=end;continue;
    }
    const start=i;
    if(text.startsWith('<!--',i)||text.startsWith('<![CDATA[',i)||text.startsWith('<?',i)){
      const close=text.startsWith('<!--',i)?'-->':text.startsWith('<![CDATA[',i)?']]>':'?>';
      const found=text.indexOf(close,i+(close==='-->'?4:2));
      if(found<0)throw Error('Nicht geschlossene XML/HTML-Deklaration.');
      i=found+close.length;
      tokens.push({kind:close===']]>'?'text':'declaration',raw:text.slice(start,i),start,end:i});continue;
    }
    let quote='';i++;
    for(;i<text.length;i++){
      const ch=text[i];if(quote){if(ch===quote)quote='';continue}
      if(ch==='"'||ch==="'"){quote=ch;continue}
      if(ch==='>'){i++;break}
    }
    if(quote||i>text.length||text[i-1]!=='>')throw Error('Nicht geschlossenes HTML/XML-Tag.');
    const raw=text.slice(start,i),match=/^<\s*(\/?)\s*([\w:-]+)/.exec(raw);
    if(!match){tokens.push({kind:'declaration',raw,start,end:i});continue}
    const name=xml?match[2]:match[2].toLowerCase();
    const closing=!!match[1],selfClosing=!closing&&(/\/\s*>$/.test(raw)||(!xml&&HTML_VOID_ELEMENTS.has(name)));
    tokens.push({kind:closing?'close':selfClosing?'single':'open',name,raw,start,end:i});
    if(!xml&&!closing&&!selfClosing&&['script','style','pre','textarea'].includes(name)){
      const rest=text.slice(i),pattern=new RegExp('</'+name+'\\s*>','i'),found=pattern.exec(rest);
      if(found){
        const end=i+found.index;
        tokens.push({kind:'raw',name,raw:text.slice(i,end),start:i,end});
        i=end;
      }
    }
  }
  return tokens;
}
function scriptPrettyMarkup(source,xml){
  const text=scriptPrettyNormalize(source);
  if(xml&&typeof DOMParser!=='undefined'){
    const parsed=new DOMParser().parseFromString(text,'application/xml');
    if(parsed.querySelector('parsererror'))throw Error('XML/SVG ist nicht wohlgeformt. Bitte Syntaxfehler korrigieren.');
  }
  const tokens=scriptPrettyMarkupTokenize(text,xml);
  const root={kind:'root',children:[]},stack=[root];
  for(const token of tokens){
    const parent=stack[stack.length-1];
    if(token.kind==='open'){
      const node={kind:'element',name:token.name,open:token,close:null,children:[],start:token.start,end:token.end};
      parent.children.push(node);stack.push(node);
    }else if(token.kind==='close'){
      const node=stack[stack.length-1];
      if(node===root||node.name!==token.name){
        throw Error('Nicht passendes Schlie\u00df-Tag: '+token.name);
      }
      node.close=token;node.end=token.end;stack.pop();
    }else parent.children.push(token);
  }
  if(stack.length!==1)throw Error('Schlie\u00df-Tag fehlt: '+stack.at(-1).name);
  const pad=level=>'  '.repeat(level);
  const render=(node,level)=>{
    if(node.kind==='text'||node.kind==='raw'||node.kind==='declaration'||node.kind==='single')return pad(level)+node.raw.trim();
    if(node.kind==='root')return node.children.filter(child=>child.kind!=='text'||child.raw.trim()).map(child=>render(child,level)).filter(Boolean).join('\n');
    const inlineHtml=new Set(['a','abbr','b','bdi','bdo','br','button','code','em','i','img','input','label','mark','small','span','strong','sub','sup','time','u']);
    const inlineChildren=!xml&&node.children.some(child=>child.kind==='element'&&inlineHtml.has(child.name));
    const directContent=node.children.some(child=>
      (child.kind==='text'&&child.raw.trim())||(child.kind==='raw'&&!['script','style'].includes(node.name)));
    const preserve=directContent||inlineChildren||/\bxml:space\s*=\s*['"]preserve['"]/i.test(node.open.raw)
      ||['pre','textarea','text','tspan'].includes(node.name);
    if(preserve)return pad(level)+text.slice(node.start,node.end).trim();
    const relevant=node.children.filter(child=>child.kind!=='text'||child.raw.trim());
    if(!relevant.length)return pad(level)+node.open.raw+node.close.raw;
    // Raw script/style is formatted by its own parser; non-JS scripts stay verbatim.
    if(relevant.length===1&&relevant[0].kind==='raw'){
      const raw=relevant[0].raw.trim();
      let body=raw;
      if(raw&&node.name==='style')try{body=scriptPrettyCss(raw).trimEnd()}catch(_){body=raw}
      else if(raw&&node.name==='script'&&!/\btype\s*=\s*['"]?(?:application\/(?:json|ld\+json)|text\/plain)/i.test(node.open.raw)){
        try{body=scriptPrettyJavascript(raw).trimEnd()}catch(_){body=raw}
      }
      return pad(level)+node.open.raw+'\n'+body.split('\n').map(line=>pad(level+1)+line).join('\n')+'\n'+pad(level)+node.close.raw;
    }
    return pad(level)+node.open.raw+'\n'+relevant.map(child=>render(child,level+1)).join('\n')+'\n'+pad(level)+node.close.raw;
  };
  return render(root,0).trimEnd()+'\n';
}
function scriptPrettyJson(source){
  // Parse before changing the editor, so invalid JSON is never overwritten.
  const value=JSON.parse(String(source));
  return JSON.stringify(value,null,2)+'\n';
}
function scriptPrettyFormat(source,extension){
  if(source.length>SCRIPT_PRETTY_LIMIT)throw Error('Datei ist f\u00fcr Pretty Code zu gro\u00df (maximal 2 MB).');
  const kind=scriptPrettyKind(extension);
  if(!kind)throw Error('Pretty Code ist f\u00fcr diesen Dateityp nicht verf\u00fcgbar.');
  if(kind==='json')return scriptPrettyJson(source);
  if(kind==='js')return scriptPrettyJavascript(source);
  if(kind==='css')return scriptPrettyCss(source);
  return scriptPrettyMarkup(source,kind==='xml');
}
function scriptPrettyMount(doc){
  const button=$('#scriptPrettyCode');if(!button)return;
  const extension=pathExtension(workspacePath(doc));
  button.hidden=!scriptPrettyKind(extension);
  button.onclick=()=>{
    const source=$('#scriptSource');if(!source||button.disabled||editorDocId!==doc.id)return;
    const original=codeFoldFull(source);button.disabled=true;
    try{
      const formatted=scriptPrettyFormat(original,extension);
      if(formatted===original){toast('Code ist bereits formatiert.');return}
      // Reformatting changes line offsets: discard stale fold anchors safely.
      if(codeFoldHasCollapsed(source))codeFoldExpandAll(source);
      if(!scriptFindApplyChange(formatted,Math.min(source.selectionStart,formatted.length))){return}
      refreshScriptValidation();
      toast('Pretty Code angewendet \u00b7 R\u00fcckg\u00e4ngig m\u00f6glich');
    }catch(error){console.warn('Pretty Code:',error);toast('Pretty Code: '+error.message)}
    finally{button.disabled=false}
  };
}
