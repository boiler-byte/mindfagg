'use strict';
/* mindfagg v51: safe, offline Markdown-to-HTML view with editable node metadata.
 * Markdown remains the only document source. Never interpret raw Markdown as
 * trusted HTML or execute scripts from it. */
let markdownHtmlAssetURLs=[];
let markdownHtmlSaving=false;
function markdownHtmlReleaseAssets(){
  for(const url of markdownHtmlAssetURLs)URL.revokeObjectURL(url);
  markdownHtmlAssetURLs=[];
}
function markdownHtmlSafeURL(value,image=false){
  const url=String(value||'').trim().replace(/^<|>$/g,'');
  if(!url||/[\u0000-\u001f\u007f\\]/.test(url)||url.startsWith('//'))return null;
  const scheme=url.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
  if(scheme&&!['http','https',...(image?[]:['mailto'])].includes(scheme))return null;
  if(!scheme&&/^(?:\/|#|\?)/.test(url)&&image)return null;
  return url;
}
function markdownHtmlImageURL(raw){
  const url=markdownHtmlSafeURL(raw,true);
  if(!url)return null;
  if(/^https?:\/\//i.test(url))return url;
  try{
    const base='https://mindfagg-markdown.invalid/'+workspacePath(documentNow()).split('/').map(encodeURIComponent).join('/');
    const resolved=new URL(url,base);
    if(resolved.origin!=='https://mindfagg-markdown.invalid')return null;
    const path=decodeURIComponent(resolved.pathname.slice(1));
    if(!workspaceValidPath(path))return null;
    const doc=docs.find(d=>d.projectId===projectId&&workspacePath(d)===path);
    if(!doc||!['image','script'].includes(fileKind(doc)))return null;
    const ext=pathExtension(path),mime=WORKSPACE_IMAGE_MIME[ext];
    if(!mime||ext==='svg')return null; // Never embed executable SVG markup.
    const bytes=docIsText(doc)?new TextEncoder().encode(doc.content||''):workspaceBytes(doc.data);
    const objectURL=URL.createObjectURL(new Blob([bytes],{type:mime}));
    markdownHtmlAssetURLs.push(objectURL);
    return objectURL;
  }catch(_){return null}
}
// Convert inline Markdown only after escaping untrusted text. Token placeholders
// prevent code, links and image HTML from being parsed as emphasis markup.
function markdownHtmlInline(source){
  const saved=[];
  const hold=html=>'\uE100'+(saved.push(html)-1)+'\uE101';
  let text=String(source??'').replace(/[\uE100\uE101]/g,'');
  text=text.replace(/`([^`\n]+)`/g,(_,code)=>hold('<code>'+escapeHtml(code)+'</code>'));
  text=text.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(_,alt,url)=>{
    const safe=markdownHtmlImageURL(url);
    return safe?hold('<img src="'+escapeHtml(safe)+'" alt="'+escapeHtml(alt)+'" loading="lazy">'):alt;
  });
  text=text.replace(/\[\[([^\]\n]+)\]\]/g,(_,value)=>{
    const [target,label]=value.split('|');
    const [name,section]=String(target).split('#');
    if(!name?.trim())return escapeHtml(label||value);
    return hold('<button type="button" class="html-md-wikilink" data-html-wiki="'+escapeHtml(name.trim())+'" data-html-section="'+escapeHtml(section||'')+'">'+escapeHtml(label||name.trim())+'</button>');
  });
  text=text.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(_,label,url)=>{
    const safe=markdownHtmlSafeURL(url);
    if(!safe)return label;
    return hold('<a href="'+escapeHtml(safe)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(label)+'</a>');
  });
  text=escapeHtml(text);
  text=text.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g,(_,a,b)=>'<strong>'+(a||b)+'</strong>');
  text=text.replace(/\*([^*\n]+)\*|_([^_\n]+)_/g,(_,a,b)=>'<em>'+(a||b)+'</em>');
  text=text.replace(/~~([^~\n]+)~~/g,'<del>$1</del>');
  return text.replace(/\uE100(\d+)\uE101/g,(_,number)=>saved[Number(number)]||'');
}
function markdownHtmlNodeControls(node,line){
  if(!node)return '';
  const done=node.checked;
  const task=done===null
    ?`<button class="html-md-add-task" type="button" data-html-task-add="${line}" title="Checkbox hinzufügen">☐ Aufgabe</button>`
    :`<label class="html-md-task"><input type="checkbox" data-html-task="${line}" aria-label="${escapeHtml(node.title)} erledigt" ${done?'checked':''}><span>${done?'Erledigt':'Offen'}</span></label><button class="html-md-remove-task" type="button" data-html-task-remove="${line}" title="Checkbox entfernen" aria-label="Checkbox entfernen">×</button>`;
  const status=`<label class="html-md-status"><span class="sr-only">Status für ${escapeHtml(node.title)}</span><select data-html-status="${line}" aria-label="Status für ${escapeHtml(node.title)}"><option value="" ${!node.status?'selected':''}>Status</option>${STATUS.filter(s=>s!=='story').map(s=>`<option value="${s}" ${node.status===s?'selected':''}>${escapeHtml(statusLabel(s))}</option>`).join('')}</select></label>`;
  const d=node.date;
  const formatDuration=d?['y','m','d'].filter(k=>d.duration?.[k]>0).map(k=>'+'+d.duration[k]+k).join(' '):'';
  const number=(unit,label)=>`<label>${label}<input type="number" inputmode="numeric" min="0" max="9999" step="1" data-html-date-${unit} value="${Number(d?.duration?.[unit]||0)}" aria-label="${label}"></label>`;
  const date=`<details class="html-md-date" data-html-date-line="${line}"><summary title="Datum und Dauer bearbeiten">${d?'Datum: '+escapeHtml(d.start+(formatDuration?' '+formatDuration:'')):'Datum +'}</summary><div class="html-md-date-fields"><label>Startdatum<input type="date" min="0001-01-01" max="9999-12-31" data-html-date-start value="${escapeHtml(d?.start||'')}"></label><div class="html-md-date-duration">${number('y','Jahre')}${number('m','Monate')}${number('d','Tage')}</div><div class="html-md-date-actions"><button type="button" data-html-date-save="${line}">Übernehmen</button>${d?`<button type="button" data-html-date-remove="${line}">Entfernen</button>`:''}</div></div></details>`;
  return `<div class="html-md-node-controls" aria-label="Knoten-Eigenschaften">${task}${status}${date}</div>`;
}
function markdownHtmlTableCells(row){
  return String(row).trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
}
function markdownHtmlRenderBody(scan){
  const items=scan.items;
  const byLine=new Map(flattened(currentModel).filter(n=>n.kind==='h'||n.kind==='li').map(n=>[n.start,n]));
  const toc=[];
  const isBlank=item=>!item||!item.raw.trim();
  const ordered=item=>/^\d/.test(item.marker||'');
  function renderList(start){
    const base=items[start].indent,tag=ordered(items[start])?'ol':'ul';
    let out='<'+tag+' class="html-md-list">',i=start;
    while(i<items.length){
      const item=items[i];
      if(isBlank(item)){
        let ahead=i+1;while(ahead<items.length&&isBlank(items[ahead]))ahead++;
        if(ahead<items.length&&items[ahead].kind==='list'&&items[ahead].indent>=base){i=ahead;continue}
        break;
      }
      if(item.kind!=='list'||item.indent!==base||ordered(item)!==(tag==='ol'))break;
      const node=byLine.get(item.line),text=node?node.title:item.title;
      out+=`<li class="${node?.checked!==null?'html-md-list-node':''}"><div class="html-md-list-row"><span class="html-md-list-text">${markdownHtmlInline(text)}</span>${markdownHtmlNodeControls(node,item.line)}</div>`;
      i++;
      while(i<items.length){
        const next=items[i];
        if(isBlank(next)){
          let ahead=i+1;while(ahead<items.length&&isBlank(items[ahead]))ahead++;
          if(ahead<items.length&&items[ahead].kind==='list'&&items[ahead].indent>=base){i=ahead;continue}
          break;
        }
        if(next.kind==='list'&&next.indent>base){const inner=renderList(i);out+=inner.html;i=inner.next;continue}
        if(next.kind==='description'&&next.raw.match(/^\s{2,}\S/)&&next.raw.search(/\S/)>base){
          out+='<p>'+markdownHtmlInline(next.raw.trim())+'</p>';i++;continue;
        }
        break;
      }
      out+='</li>';
    }
    return {html:out+'</'+tag+'>',next:i};
  }
  let html='',i=0;
  while(i<items.length){
    const item=items[i],raw=item.raw;
    if(!raw.trim()){i++;continue}
    if(item.kind==='fence'){
      const opener=raw.match(/^\s*(`{3,}|~{3,})\s*([^\s`~]*)/);
      if(!opener){i++;continue}
      const char=opener[1][0],size=opener[1].length,lang=opener[2]||'';
      const content=[];i++;
      while(i<items.length){
        const closing=items[i].raw.match(/^\s*(`{3,}|~{3,})[ \t]*$/);
        if(closing&&closing[1][0]===char&&closing[1].length>=size){i++;break}
        content.push(items[i].raw);i++;
      }
      html+=`<pre class="html-md-code"><code${lang?' data-lang="'+escapeHtml(lang)+'"':''}>${escapeHtml(content.join('\n'))}</code></pre>`;
      continue;
    }
    if(item.kind==='heading'){
      const node=byLine.get(item.line),title=node?node.title:item.title,level=item.level;
      const id='html-md-heading-'+item.line;
      toc.push({line:item.line,level,title:plain(title)||title});
      html+=`<div class="html-md-heading" id="${id}"><h${level}>${markdownHtmlInline(title)}</h${level}>${markdownHtmlNodeControls(node,item.line)}</div>`;
      i++;continue;
    }
    if(item.kind==='list'){
      const result=renderList(i);html+=result.html;i=result.next;continue;
    }
    if(item.kind==='quote'){
      const lines=[];
      while(i<items.length&&items[i].kind==='quote'){
        lines.push(items[i].raw.replace(/^\s*>\s?/,''));i++;
      }
      html+='<blockquote><p>'+markdownHtmlInline(lines.join(' '))+'</p></blockquote>';continue;
    }
    if(/^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:_\s*){3,}$/.test(raw)){
      html+='<hr>';i++;continue;
    }
    if(item.kind==='table'&&i+1<items.length){
      const cells=markdownHtmlTableCells(raw),separator=markdownHtmlTableCells(items[i+1].raw);
      if(cells.length===separator.length&&separator.every(cell=>/^:?-{3,}:?$/.test(cell))){
        html+='<div class="html-md-table-wrap"><table><thead><tr>'+cells.map(cell=>'<th>'+markdownHtmlInline(cell)+'</th>').join('')+'</tr></thead><tbody>';
        i+=2;
        while(i<items.length&&items[i].raw.trim()&&items[i].kind==='table'){
          const data=markdownHtmlTableCells(items[i].raw);
          html+='<tr>'+cells.map((_,j)=>'<td>'+markdownHtmlInline(data[j]||'')+'</td>').join('')+'</tr>';i++;
        }
        html+='</tbody></table></div>';continue;
      }
    }
    if(/^ {4}\S/.test(raw)){
      const code=[];
      while(i<items.length&&(/^ {4}/.test(items[i].raw)||!items[i].raw.trim())){code.push(items[i].raw.replace(/^ {4}/,''));i++}
      html+='<pre class="html-md-code"><code>'+escapeHtml(code.join('\n').replace(/\n+$/,''))+'</code></pre>';continue;
    }
    // Ordinary paragraphs, including literal HTML (escaped, never executed).
    const lines=[];
    while(i<items.length&&items[i].raw.trim()){
      const current=items[i];
      if(lines.length&&(current.kind==='heading'||current.kind==='list'||current.kind==='fence'||current.kind==='quote'))break;
      lines.push(current.raw.trim());i++;
    }
    if(lines.length)html+='<p>'+markdownHtmlInline(lines.join(' '))+'</p>';
  }
  return {html,toc};
}
function renderMarkdownHtml(){
  const doc=documentNow();
  markdownHtmlReleaseAssets();
  if(!doc||fileKind(doc)!=='markdown')return;
  const scan=scanMarkdown(doc.content);
  const result=markdownHtmlRenderBody(scan);
  const mobile=window.matchMedia('(max-width:850px)').matches;
  const toc=result.toc.map(entry=>`<button type="button" data-html-jump="${entry.line}" class="html-md-toc-entry" style="--html-toc-indent:${entry.level-1}" title="${escapeHtml(entry.title)}">${escapeHtml(entry.title)}</button>`).join('');
  $('#surface').innerHTML=`<div class="markdown-html-view" id="markdownHtmlView" aria-label="Markdown als HTML">
    <aside class="html-md-toc" aria-label="Inhaltsverzeichnis"><details id="htmlMdTocDetails" ${mobile?'':'open'}><summary>Inhaltsverzeichnis <span>${result.toc.length}</span></summary><nav class="html-md-toc-list" aria-label="Überschriften">${toc||'<span class="html-md-toc-empty">Keine Überschriften vorhanden.</span>'}</nav></details></aside>
    <div class="html-md-scroll" id="htmlMdScroll" tabindex="0"><article class="html-md-article">${result.html||'<p class="html-md-empty">Dieses Dokument ist leer.</p>'}</article></div>
  </div>`;
  const viewElement=$('#markdownHtmlView');
  viewElement.addEventListener('click',async event=>{
    const jump=event.target.closest('[data-html-jump]');
    if(jump){$('#html-md-heading-'+jump.dataset.htmlJump)?.scrollIntoView({behavior:'smooth',block:'start'});return}
    const wiki=event.target.closest('[data-html-wiki]');
    if(wiki){
      const name=wiki.dataset.htmlWiki;
      const other=docs.find(d=>d.projectId===projectId&&fileKind(d)==='markdown'&&docNameForPath(workspacePath(d)).toLowerCase()===name.toLowerCase());
      if(other){selectDocument(other.id);if(wiki.dataset.htmlSection){const section=plain(wiki.dataset.htmlSection).toLowerCase();const heading=[...$('#htmlMdScroll').querySelectorAll('.html-md-heading')].find(el=>el.querySelector('h1,h2,h3,h4,h5,h6')?.textContent.trim().toLowerCase()===section);heading?.scrollIntoView({block:'start'})}}
      else toast('Verknüpftes Dokument nicht gefunden: '+name);
      return;
    }
    const add=event.target.closest('[data-html-task-add]');
    if(add){await markdownHtmlChangeNode(Number(add.dataset.htmlTaskAdd),{checked:false});return}
    const remove=event.target.closest('[data-html-task-remove]');
    if(remove){await markdownHtmlChangeNode(Number(remove.dataset.htmlTaskRemove),{checked:null});return}
    const save=event.target.closest('[data-html-date-save]');
    if(save){
      const row=save.closest('[data-html-date-line]');
      const start=row.querySelector('[data-html-date-start]').value;
      if(!start){toast('Startdatum wählen');return}
      const duration={};
      for(const unit of ['y','m','d']){
        const input=row.querySelector('[data-html-date-'+unit+']');
        const value=Number(input.value);
        if(!Number.isSafeInteger(value)||value<0||value>9999){toast('Ungültige Dauer: '+unit);return}
        duration[unit]=value;
      }
      const payload=start+['y','m','d'].filter(unit=>duration[unit]>0).map(unit=>' +'+duration[unit]+unit).join('');
      const date=parseNodeDatePayload(payload);
      if(!date){toast('Ungültiges Datum oder ungültige Dauer');return}
      await markdownHtmlChangeNode(Number(save.dataset.htmlDateSave),{date});return;
    }
    const removeDate=event.target.closest('[data-html-date-remove]');
    if(removeDate){await markdownHtmlChangeNode(Number(removeDate.dataset.htmlDateRemove),{date:null});return}
  });
  viewElement.addEventListener('change',async event=>{
    if(event.target.matches('[data-html-task]')){
      await markdownHtmlChangeNode(Number(event.target.dataset.htmlTask),{checked:event.target.checked});
    }else if(event.target.matches('[data-html-status]')){
      await markdownHtmlChangeNode(Number(event.target.dataset.htmlStatus),{status:event.target.value||null});
    }
  });
}
// Modify only the prefix metadata of a heading or list item, preserving the
// content of every other Markdown line. put() records a regular undo snapshot.
async function markdownHtmlChangeNode(line,change){
  if(markdownHtmlSaving||view!=='html')return;
  const doc=documentNow();
  if(!doc||fileKind(doc)!=='markdown'||!Number.isSafeInteger(line)||line<0)return;
  const scan=scanMarkdown(doc.content),item=scan.items[line];
  if(!item||!['heading','list'].includes(item.kind))return;
  const old=doc.content,lines=scan.lines.slice();
  const prefix=lines[line].match(item.kind==='heading'?/^(\s{0,3}#{1,6}[ \t]+)(.*)$/:/^([ \t]*(?:[-+*]|\d+[.)])[ \t]+)(.*)$/);
  if(!prefix)return;
  const original=nodeText(item.title),next={...original,...change};
  if(next.status&&!STATUS.includes(next.status))return;
  const parts=[];
  if(next.checked!==null)parts.push(next.checked?'[x]':'[ ]');
  if(next.status&&next.status!=='story')parts.push('[status:'+next.status+']');
  if(next.date?.start)parts.push(serializeNodeDate(next.date));
  // Preserve the item's actual title including inline Markdown and spacing.
  parts.push(original.title);
  lines[line]=prefix[1]+parts.join(' ');
  const replacement=lines.join('\n');
  if(replacement===old)return;
  const scroll=$('#htmlMdScroll'),toc=$('#htmlMdTocDetails');
  const scrollTop=scroll?.scrollTop||0,tocOpen=toc?.open||false;
  markdownHtmlSaving=true;
  doc.content=replacement;
  try{await put('docs',{...doc});render();if($('#htmlMdScroll'))$('#htmlMdScroll').scrollTop=scrollTop;if($('#htmlMdTocDetails'))$('#htmlMdTocDetails').open=tocOpen}
  catch(error){doc.content=old;console.error(error);render();toast('HTML-Änderung konnte nicht gespeichert werden')}
  finally{markdownHtmlSaving=false}
}
