'use strict';
/* mindfagg v36 - offline source checks. Errors use zero-based offsets, one-based
 * lines/columns. Acorn validates JavaScript, while CSS/HTML use conservative
 * structural scanners plus browser CSS.supports for recognized declarations.
 * Never execute pasted or edited source. */
function codeDiagnostic(text,at,message,length=1){
  const offset=Math.max(0,Math.min(text.length,Number(at)||0));
  const prefix=text.slice(0,offset),lines=prefix.split(/\r\n?|\n/);
  return {offset,line:lines.length,column:lines.at(-1).length+1,length:Math.max(1,length),message};
}
function parseJavascriptCode(text,sourceType='auto'){
  if(typeof acorn==='undefined'||typeof acorn.parse!=='function')
    return {ast:null,errors:[codeDiagnostic(text,0,'JavaScript-Parser nicht verf\u00fcgbar.')]};
  const modes=sourceType==='module'?['module']:sourceType==='script'?['script']:['module','script'];
  let issue=null;
  for(const mode of modes){
    try{return {ast:acorn.parse(text,{ecmaVersion:'latest',sourceType:mode,allowHashBang:true,allowReturnOutsideFunction:mode==='script'}),errors:[]}}
    catch(error){if(!issue||(Number(error.pos)||0)>(Number(issue.pos)||0))issue=error}
  }
  return {ast:null,errors:[codeDiagnostic(text,issue?.pos??0,'JavaScript: '+String(issue?.message||'Syntaxfehler').replace(/\s*\(\d+:\d+\)\s*$/,''))]};
}
function validateCssCode(text,{fragment=false}={}){
  const errors=[],stack=[];let start=0,quote='',quoteAt=0,comment=false,commentAt=0,paren=[],brackets=[];
  const add=(at,msg)=>{if(errors.length<30)errors.push(codeDiagnostic(text,at,msg))};
  const cleaned=value=>value.replace(/\/\*[\s\S]*?\*\//g,match=>' '.repeat(match.length));
  function statement(from,to,terminator){
    const raw=cleaned(text.slice(from,to)),value=raw.trim();if(!value)return;
    const at=from+raw.search(/\S/),context=stack.at(-1);
    if(!context){
      if(!/^@(?:import|charset|namespace|layer)\b/i.test(value)){
        if(fragment&&/^(?:--[\w-]+|[-a-zA-Z][\w-]*)\s*:\s*\S[\s\S]*$/.test(value))return;
        add(at,'CSS: Deklaration au\u00dferhalb einer Regel.');
      }
      return;
    }
    if(context.group){add(at,'CSS: Regelblock oder Selektor erwartet.');return}
    if(/^@(?:apply|include|extend)\b/.test(value))return;
    const match=/^(--[\w-]+|[-a-zA-Z][\w-]*)\s*:\s*([\s\S]*)$/.exec(value);
    if(!match){add(at,'CSS: Eigenschaft und Doppelpunkt erwartet.');return}
    const property=match[1],propertyAt=at+match[0].indexOf(property),data=match[2].trim();
    if(!data){add(at+value.length,'CSS: Wert f\u00fcr '+property+' fehlt.');return}
    const nested=/\r?\n\s*(?:--[\w-]+|[-a-zA-Z][\w-]*)\s*:/g;
    const extra=nested.exec(match[2]);
    if(extra){add(at+value.indexOf(match[2])+extra.index+extra[0].search(/[^\s\r\n]/),'CSS: Semikolon vor der n\u00e4chsten Eigenschaft fehlt.');return}
    // Unknown or future CSS properties are not marked invalid merely because
    // the current browser does not implement them.
    const cssValue=data.replace(/\s*!important\s*$/i,'');
    if(typeof CSS!=='undefined'&&typeof CSS.supports==='function'&&!property.startsWith('--')
      &&CSS.supports(property,'initial')&&!CSS.supports(property,cssValue))
      add(propertyAt,'CSS: Ung\u00fcltiger Wert f\u00fcr '+property+'.');
  }
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(comment){if(ch==='*'&&next==='/'){comment=false;i++}continue}
    if(quote){if(ch==='\\'){i++;continue}if(ch===quote)quote='';continue}
    if(ch==='/'&&next==='*'){comment=true;commentAt=i;i++;continue}
    if(ch==='"'||ch==="'"){quote=ch;quoteAt=i;continue}
    if(ch==='('){paren.push(i);continue}
    if(ch===')'){if(paren.length)paren.pop();else add(i,'CSS: Unerwartete schlie\u00dfende Klammer.');continue}
    if(ch==='['){brackets.push(i);continue}
    if(ch===']'){if(brackets.length)brackets.pop();else add(i,'CSS: Unerwartete eckige Klammer.');continue}
    if(paren.length||brackets.length)continue;
    if(ch==='{'){
      const raw=cleaned(text.slice(start,i)),value=raw.trim(),at=start+Math.max(0,raw.search(/\S/));
      if(!value)add(i,'CSS: Selektor oder At-Regel fehlt.');
      // An @media/@supports etc. block contains rule blocks; a selector,
      // @font-face and keyframe selector contain declarations or CSS nesting.
      stack.push({at:i,group:/^@(?:media|supports|container|layer|scope|document|keyframes|-[\w-]*keyframes)\b/i.test(value)});
      start=i+1;
    }else if(ch===';'){statement(start,i,';');start=i+1}
    else if(ch==='}'){
      if(!stack.length)add(i,'CSS: Unerwartete schlie\u00dfende geschweifte Klammer.');
      else{statement(start,i,'}');stack.pop()}
      start=i+1;
    }
  }
  if(comment)add(commentAt,'CSS: Kommentar wird nicht geschlossen.');
  if(quote)add(quoteAt,'CSS: Zeichenfolge wird nicht geschlossen.');
  for(const at of paren.slice(0,3))add(at,'CSS: Runde Klammer wird nicht geschlossen.');
  for(const at of brackets.slice(0,3))add(at,'CSS: Eckige Klammer wird nicht geschlossen.');
  if(stack.length){for(const block of stack.slice(-3))add(block.at,'CSS: Geschweifte Klammer wird nicht geschlossen.');}
  else statement(start,text.length,'EOF');
  return {errors:errors.sort((a,b)=>a.offset-b.offset)};
}
const HTML_VOID_ELEMENTS=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const HTML_OPTIONAL_END=new Set('html head body p li dt dd option optgroup thead tbody tfoot tr td th colgroup'.split(' '));
function validateHtmlCode(text){
  const errors=[],opened=[];
  const add=(at,msg)=>{if(errors.length<30)errors.push(codeDiagnostic(text,at,msg))};
  let i=0;
  while(i<text.length){
    const lt=text.indexOf('<',i);if(lt<0)break;i=lt+1;
    if(text.startsWith('<!--',lt)){
      const end=text.indexOf('-->',lt+4);
      if(end<0){add(lt,'HTML: Kommentar wird nicht geschlossen.');break}
      i=end+3;continue;
    }
    if(/^<!doctype\b/i.test(text.slice(lt,lt+12))||text.startsWith('<![CDATA[',lt)||text.startsWith('<?',lt)){
      const token=text.startsWith('<![CDATA[',lt)?']]>':text.startsWith('<?',lt)?'?>':'>';
      const end=text.indexOf(token,i);
      if(end<0){add(lt,'HTML: Deklaration wird nicht geschlossen.');break}
      i=end+token.length;continue;
    }
    const head=/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i.exec(text.slice(lt));
    if(!head)continue;
    let end=lt+head[0].length,quote='',quoteAt=lt;
    for(;end<text.length;end++){
      const ch=text[end];if(quote){if(ch===quote)quote='';continue}
      if(ch==='"'||ch==="'"){quote=ch;quoteAt=end;continue}
      if(ch==='>')break;
    }
    if(end===text.length){add(quote?quoteAt:lt,quote?'HTML: Attributwert nicht geschlossen.':'HTML: Tag wird nicht geschlossen.');break}
    i=end+1;
    const tag=head[2].toLowerCase(),closing=Boolean(head[1]);
    if(closing){
      const found=opened.findLastIndex(item=>item.tag===tag);
      if(found<0){add(lt,'HTML: Unerwartetes Schlie\u00df-Tag </'+tag+'>.');continue}
      for(let k=opened.length-1;k>found;k--){
        const item=opened[k];if(!HTML_OPTIONAL_END.has(item.tag))add(item.at,'HTML: Fehlendes </'+item.tag+'> vor </'+tag+'>.');
      }
      opened.length=found;continue;
    }
    if(tag==='li'&&opened.at(-1)?.tag==='li'||tag==='p'&&opened.at(-1)?.tag==='p'||tag==='option'&&opened.at(-1)?.tag==='option'||tag==='tr'&&opened.at(-1)?.tag==='tr'||['td','th'].includes(tag)&&['td','th'].includes(opened.at(-1)?.tag))opened.pop();
    // HTML implicitly closes a paragraph when a block element begins.
    if(/^(?:div|section|article|aside|main|header|footer|nav|ul|ol|table|h[1-6])$/.test(tag)&&opened.at(-1)?.tag==='p')opened.pop();
    if(HTML_VOID_ELEMENTS.has(tag)||/\/\s*>$/.test(text.slice(lt,end+1)))continue;
    opened.push({tag,at:lt});
    if(tag==='script'||tag==='style'){
      const closePattern=new RegExp('</'+tag+'\\s*>','ig');closePattern.lastIndex=i;
      const closer=closePattern.exec(text);
      if(!closer){add(lt,'HTML: Fehlendes </'+tag+'>.');break}
      const body=text.slice(i,closer.index),sourceStart=i,attribute=text.slice(lt,end+1);
      if(tag==='style'){
        for(const error of validateCssCode(body).errors.slice(0,10))add(sourceStart+error.offset,error.message);
      }else if(!/\btype\s*=\s*["']?(?:application\/(?:json|ld\+json)|text\/plain)/i.test(attribute)){
        for(const error of parseJavascriptCode(body).errors.slice(0,10))add(sourceStart+error.offset,error.message);
      }
      opened.pop();i=closer.index+closer[0].length;
    }
  }
  for(const item of opened){if(!HTML_OPTIONAL_END.has(item.tag))add(item.at,'HTML: Fehlendes </'+item.tag+'>.');}
  return {errors:errors.sort((a,b)=>a.offset-b.offset)};
}
function validateScriptContent(text,extension){
  const ext=String(extension||'').toLowerCase();
  if(['js','mjs','cjs'].includes(ext))return {language:'JavaScript',...parseJavascriptCode(text,ext==='mjs'?'module':ext==='cjs'?'script':'auto')};
  if(ext==='css')return {language:'CSS',...validateCssCode(text)};
  if(['html','htm'].includes(ext))return {language:'HTML',...validateHtmlCode(text)};
  return {language:null,errors:[]};
}
function detectClipboardCodeLanguage(source){
  const text=String(source||'').trim();if(!text||text.length>500000)return null;
  const cssShape=/(?:^|[}\s])(?:@(?:media|supports|keyframes|font-face|container)\b|[.#*\w\[:>+~][^{};=]*\{)/m.test(text);
  const cssDecl=/^(?:(?:--[\w-]+|(?:color|background(?:-color)?|display|margin(?:-\w+)?|padding(?:-\w+)?|width|height|font(?:-\w+)?|border(?:-\w+)?|opacity|position|gap|transform))\s*:\s*[^;{}]+;?\s*)+$/i.test(text);
  if((cssShape||cssDecl)&&!validateCssCode(text,{fragment:cssDecl}).errors.length)return 'css';
  if(!/[;=(){}[\].]|\b(?:const|let|var|function|class|if|for|while|import|export|return|async|await|new|throw|try|catch)\b/.test(text))return null;
  const result=parseJavascriptCode(text);if(result.errors.length||!result.ast?.body?.length)return null;
  const supported=result.ast.body.some(node=>{
    if(node.type==='EmptyStatement')return false;
    if(node.type==='ExpressionStatement')return ['CallExpression','NewExpression','AssignmentExpression','UpdateExpression','AwaitExpression','ArrowFunctionExpression','FunctionExpression','ClassExpression','TaggedTemplateExpression','SequenceExpression','UnaryExpression'].includes(node.expression?.type);
    return ['VariableDeclaration','FunctionDeclaration','ClassDeclaration','ImportDeclaration','ExportNamedDeclaration','ExportDefaultDeclaration','ExportAllDeclaration','IfStatement','ForStatement','ForOfStatement','ForInStatement','WhileStatement','DoWhileStatement','TryStatement','SwitchStatement','ThrowStatement','ReturnStatement'].includes(node.type);
  });
  return supported?'js':null;
}
