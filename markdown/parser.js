'use strict';
// mindfagg v30: markdown/parser.js (klassisches Script; gemeinsame globale Laufzeit).
function scanMarkdown(source){
  const text=String(source).replace(/\r\n?/g,'\n'),ls=text.split('\n'),items=[],h1=[];let fence=null;
  for(let i=0;i<ls.length;i++){
    const raw=ls[i];let item={raw,line:i,kind:'description'};
    if(fence){
      const closing=raw.match(/^\s*(`{3,}|~{3,})[ \t]*$/);
      if(closing&&closing[1][0]===fence.char&&closing[1].length>=fence.size){item.kind='fence';fence=null}
      else item.kind='code';
      items.push(item);continue;
    }
    const opener=raw.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if(opener){item.kind='fence';fence={char:opener[1][0],size:opener[1].length};items.push(item);continue}
    const thematic=/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(raw);
    const heading=raw.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/);
    const list=thematic?null:raw.match(/^([ \t]*)(?:([-+*])|(\d+[.)]))[ \t]+(.+)$/);
    if(heading){item.kind='heading';item.level=heading[1].length;item.prefix=raw.slice(0,raw.indexOf(heading[1])+heading[1].length);item.title=(heading[2]||'').replace(/[ \t]+#+[ \t]*$/,'').trim();if(item.level===1)h1.push(i)}
    else if(list){item.kind='list';item.indent=list[1].replace(/\t/g,'    ').length;item.prefix=raw.slice(0,raw.length-list[4].length);item.marker=list[2]||list[3];item.title=list[4]}
    else if(/^\s*>/.test(raw))item.kind='quote';
    else if(/^\s*\|/.test(raw))item.kind='table';
    else if(/^\s*<!--/.test(raw))item.kind='comment';
    items.push(item);
  }
  const offsets=[];let offset=0;for(const line of ls){offsets.push(offset);offset+=line.length+1}
  return {lines:ls,items,roots:h1,valid:h1.length===1,offsets};
}
function validationMessage(scan){
  if(scan.roots.length===1)return '1 / 1 H1 · gültiger Root';
  if(!scan.roots.length)return 'Keine H1 · # Titel ergänzen';
  return scan.roots.length+' H1 gefunden · nur eine erlaubt (Zeilen '+scan.roots.slice(1).map(i=>i+1).join(', ')+')';
}
// [date:YYYY-MM-DD +1y +2m +3d] is a node property like [status:...].
// Units may appear in any order, but must be positive and occur at most once.
function parseNodeDatePayload(raw){
  const match=String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(.+))?$/);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  if(year<1||month<1||month>12||day<1||day>31)return null;
  const calendar=new Date(0);calendar.setUTCHours(0,0,0,0);calendar.setUTCFullYear(year,month-1,day);
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()!==month-1||calendar.getUTCDate()!==day)return null;
  const duration={y:0,m:0,d:0},seen=new Set();
  if(match[4])for(const component of match[4].split(/\s+/)){
    const part=component.match(/^\+([1-9]\d*)([ymd])$/);
    if(!part||seen.has(part[2]))return null;
    const amount=Number(part[1]);if(!Number.isSafeInteger(amount))return null;
    seen.add(part[2]);duration[part[2]]=amount;
  }
  return {start:String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),duration};
}
function nodeDatePrefix(text){
  const token=String(text).match(/^\[date:([^\]\r\n]+)\](?=\s|$)/);
  if(!token)return null;
  const date=parseNodeDatePayload(token[1]);
  return date?{text:token[0],date}:null;
}
function serializeNodeDate(date){
  if(!date?.start)return '';
  const pieces=['y','m','d'].filter(unit=>date.duration?.[unit]>0).map(unit=>'+'+date.duration[unit]+unit);
  return '[date:'+date.start+(pieces.length?' '+pieces.join(' '):'')+']';
}
// Calendar months/years are applied before days, clamping the day in short months.
// All calculations use UTC to avoid daylight-saving shifts.
function nodeDateEnd(date){
  if(!date?.start)return null;
  const [y,m,d]=date.start.split('-').map(Number);
  const months=y*12+m-1+(date.duration?.y||0)*12+(date.duration?.m||0);
  const year=Math.floor(months/12),month=months%12+1;
  if(!Number.isSafeInteger(months)||year<1||year>9999)return null;
  const endOfMonth=new Date(0);endOfMonth.setUTCHours(0,0,0,0);endOfMonth.setUTCFullYear(year,month,0);
  const result=new Date(0);result.setUTCHours(0,0,0,0);result.setUTCFullYear(year,month-1,Math.min(d,endOfMonth.getUTCDate()));
  result.setUTCDate(result.getUTCDate()+(date.duration?.d||0));
  const endYear=result.getUTCFullYear();
  if(!Number.isInteger(endYear)||endYear<1||endYear>9999)return null;
  return String(endYear).padStart(4,'0')+'-'+String(result.getUTCMonth()+1).padStart(2,'0')+'-'+String(result.getUTCDate()).padStart(2,'0');
}
function nodeText(raw){
  let s=raw.trim(),checked=null,status=null,date=null;
  for(let i=0;i<3;i++){
    const box=s.match(/^\[([ xX])\](?=\s|$)/);
    if(box&&checked===null){checked=box[1].toLowerCase()==='x';s=s.slice(box[0].length).trimStart();continue}
    const st=s.match(/^\[status:([a-z-]+)\](?=\s|$)/i);
    if(st&&status===null){status=st[1].toLowerCase();s=s.slice(st[0].length).trimStart();continue}
    const dt=nodeDatePrefix(s);
    if(dt&&date===null){date=dt.date;s=s.slice(dt.text.length).trimStart();continue}
    break;
  }
  return {title:s.trim(),checked,status,date};
}


function parseMarkdown(src,analysis){
  const scan=analysis||scanMarkdown(src),ls=scan.lines;
  const root={title:'Dokument',children:[],depth:0,path:'0',start:-1,end:ls.length,kind:'virtual',checked:null,status:null,description:[]};
  let headings=[],listStack=[],last=root;
  function addNode(item){
    let parent;
    if(item.kind==='heading'){
      while(headings.length&&headings[headings.length-1].level>=item.level)headings.pop();
      parent=headings.length?headings[headings.length-1].node:root;
      listStack=[];
    }else{
      while(listStack.length&&listStack[listStack.length-1].indent>=item.indent)listStack.pop();
      parent=listStack.length?listStack[listStack.length-1].node:(headings.length?headings[headings.length-1].node:root);
    }
    const n={...nodeText(item.title),children:[],parent,kind:item.kind==='heading'?'h':'li',level:item.level||0,marker:item.marker||null,indent:item.indent||0,start:item.line,end:ls.length,description:[]};
    n.path=parent.path+'.'+parent.children.length;
    parent.children.push(n);
    if(item.kind==='heading')headings.push({level:item.level,node:n});
    else listStack.push({indent:item.indent,node:n});
    last=n;
  }
  for(const item of scan.items){
    if(item.kind==='heading'||item.kind==='list')addNode(item);
    else last.description.push(item.raw);
  }
  const nodeLines=scan.items.filter(i=>i.kind==='heading'||i.kind==='list').map(i=>i.line);
  function close(n){
    for(const c of n.children)close(c);
    n.end=nodeLines.find(i=>i>n.start)??ls.length;
  }
  close(root);
  function forceProgress(n){
    n.children.forEach(forceProgress);
    n.progress=n.checked===true?100:n.children.length?n.children.reduce((s,c)=>s+c.progress,0)/n.children.length:0;
  }
  forceProgress(root);return root;
}




function flattened(root){let out=[];function rec(n){out.push(n);n.children.forEach(rec)}rec(root);return out}function actualRoot(m){return m.children.find(n=>n.kind==='h'&&n.level===1)||m.children[0]||m}
function currentRoot(){return actualRoot(currentModel)}function getScope(){return flattened(currentModel).find(n=>n.path===scopePath)||currentRoot()}
