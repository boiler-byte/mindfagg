'use strict';
/* mindfagg v39 - lossless, editor-local code folding.
 * The displayed textarea can contain placeholders, but the document and all
 * saves, validation and exports ALWAYS use the unmodified canonical source.
 * Edits to visible text are mapped back onto the canonical source; editing a
 * placeholder first expands the folds rather than overwriting hidden text.
 */
const codeFoldSessions=new Map();
const codeFoldEditors=new WeakMap();
const CODE_FOLD_SUMMARY='⋯';
function codeFoldLineStarts(text){
  const starts=[0];for(let i=0;i<text.length;i++)if(text[i]==='\n')starts.push(i+1);
  return starts;
}
function codeFoldLineAt(starts,offset){
  let lo=0,hi=starts.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(starts[mid]<=offset)lo=mid+1;else hi=mid}
  return Math.max(0,lo-1);
}
function codeFoldAdd(regions,start,end,kind,lines){
  if(end<=start+1||start<0||end>=lines.length)return;
  const intro=(lines[start]||'').trim().slice(0,100);
  regions.push({start,end,kind,key:kind+':'+start+':'+intro});
}
function codeFoldBraces(text,language,lines,starts,regions){
  const stack=[];let quote='',comment='',regex=false,inRegexClass=false;
  let line=0,commentLine=0,regexAllowed=true;
  const javascript=language==='javascript';
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='\n'){
      line++;
      if(comment==='line')comment='';
      if(quote==='\''||quote==='"')quote='';
      if(regex)regex=false;
      continue;
    }
    if(comment){
      if(comment==='block'&&ch==='*'&&next==='/'){
        codeFoldAdd(regions,commentLine,line,'comment',lines);comment='';i++;
      }
      continue;
    }
    if(quote){
      if(ch==='\\'){if(next==='\n')line++;i++;continue}
      if(ch===quote)quote='';
      continue;
    }
    if(regex){
      if(ch==='\\'){i++;continue}
      if(ch==='[')inRegexClass=true;
      else if(ch===']')inRegexClass=false;
      else if(ch==='/'&&!inRegexClass){regex=false;regexAllowed=false}
      continue;
    }
    if(ch==='/'&&next==='*'){comment='block';commentLine=line;i++;continue}
    if(javascript&&ch==='/'&&next==='/'){comment='line';i++;continue}
    if(ch==='\''||ch==='"'||(javascript&&ch==='`')){quote=ch;regexAllowed=false;continue}
    if(javascript&&ch==='/'&&regexAllowed&&next!=='='&&next!=='/'){
      regex=true;inRegexClass=false;continue;
    }
    if(ch==='{'||(javascript&&(ch==='['||ch==='('))){
      stack.push({symbol:ch,line});regexAllowed=true;continue;
    }
    if(ch==='}'||(javascript&&(ch===']'||ch===')'))){
      const expected=ch==='}'?'{':ch===']'?'[':'(';
      if(stack.at(-1)?.symbol===expected){
        const open=stack.pop();
        codeFoldAdd(regions,open.line,line,ch==='}'?'block':ch===']'?'array':'group',lines);
      }
      regexAllowed=false;continue;
    }
    if(!/\s/.test(ch)){
      if(/[a-z0-9_$]/i.test(ch))regexAllowed=false;
      else if(/[=(:,;!~?+*%&|<>\-]/.test(ch))regexAllowed=true;
    }
  }
}
function codeFoldMarkup(text,language,lines,starts,regions){
  const stack=[],html=['html','htm','xhtml','markup'].includes(language);
  const voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for(let i=0;i<text.length;){
    if(text[i]!=='<'){i++;continue}
    if(text.startsWith('<!--',i)){
      const end=text.indexOf('-->',i+4);if(end<0)break;
      codeFoldAdd(regions,codeFoldLineAt(starts,i),codeFoldLineAt(starts,end),'comment',lines);i=end+3;continue;
    }
    if(text.startsWith('<![CDATA[',i)){
      const end=text.indexOf(']]>',i+9);if(end<0)break;
      codeFoldAdd(regions,codeFoldLineAt(starts,i),codeFoldLineAt(starts,end),'cdata',lines);i=end+3;continue;
    }
    if(!/^<\/?[A-Za-z][\w:.-]*/.test(text.slice(i,i+125))){i++;continue}
    const start=i;let quote='',end=i+1;
    for(;end<text.length;end++){
      const ch=text[end];
      if(quote){if(ch===quote)quote='';continue}
      if(ch==='\''||ch==='"'){quote=ch;continue}
      if(ch==='>')break;
    }
    if(end>=text.length)break;
    const token=text.slice(start,end+1),match=token.match(/^<\s*(\/?)\s*([\w:.-]+)/);
    i=end+1;if(!match)continue;
    const tag=html?match[2].toLowerCase():match[2];
    if(match[1]){
      const pos=stack.map(item=>item.tag).lastIndexOf(tag);
      if(pos!==-1){
        const opener=stack[pos];stack.length=pos;
        codeFoldAdd(regions,opener.line,codeFoldLineAt(starts,end),'tag',lines);
      }
    }else if(!/\/\s*>$/.test(token)&&!(html&&voidTags.has(tag))){
      stack.push({tag,line:codeFoldLineAt(starts,start)});
    }
  }
}
function codeFoldMarkdown(text,lines,regions){
  const scan=scanMarkdown(text);
  for(let i=0;i<scan.items.length;i++){
    const item=scan.items[i];
    if(item.kind==='heading'){
      let end=lines.length-1;
      for(let j=i+1;j<scan.items.length;j++){
        const next=scan.items[j];
        if(next.kind==='heading'&&next.level<=item.level){end=j-1;break}
      }
      codeFoldAdd(regions,i,end,'heading',lines);
    }else if(item.kind==='list'){
      let end=lines.length-1;
      for(let j=i+1;j<scan.items.length;j++){
        const next=scan.items[j];
        if(next.kind==='heading'||(next.kind==='list'&&next.indent<=item.indent)){
          end=j-1;break;
        }
      }
      codeFoldAdd(regions,i,end,'list',lines);
    }else if(item.kind==='fence'&&/^\s*(`{3,}|~{3,})/.test(item.raw)){
      const marker=item.raw.match(/^\s*(`{3,}|~{3,})/)[1];
      for(let j=i+1;j<scan.items.length;j++){
        if(scan.items[j].kind==='fence'&&new RegExp('^\\s*'+marker[0]+'{'+marker.length+',}\\s*$').test(scan.items[j].raw)){
          codeFoldAdd(regions,i,j,'fence',lines);i=j;break;
        }
      }
    }
  }
}
function codeFoldRegions(text,language){
  if(['js','mjs','cjs','jsx','ts','tsx','jsonc'].includes(language))language='javascript';
  const lines=String(text).replace(/\r\n?/g,'\n').split('\n');
  const starts=codeFoldLineStarts(text),regions=[];
  if(language==='markdown')codeFoldMarkdown(text,lines,regions);
  else if(['html','htm','xhtml','svg','xml','markup','xsd','xsl','xslt','wsdl','rss','atom','vue','svelte'].includes(language))
    codeFoldMarkup(text,language,lines,starts,regions);
  else if(['css','scss','sass','less','javascript'].includes(language))codeFoldBraces(text,language,lines,starts,regions);
  // At most one fold control per source line. Keep the outermost region.
  const byStart=new Map();
  for(const r of regions){const existing=byStart.get(r.start);if(!existing||r.end>existing.end)byStart.set(r.start,r)}
  return [...byStart.values()].sort((a,b)=>a.start-b.start||b.end-a.end);
}
function codeFoldProjection(state){
  const full=state.full,lines=full.split('\n'),starts=codeFoldLineStarts(full),collapsed=state.collapsed;
  const regionByStart=new Map(state.regions.map(r=>[r.start,r]));
  const visibleLines=[],meta=[],segments=[];
  let display='',i=0;
  while(i<lines.length){
    const region=regionByStart.get(i),fold=region&&collapsed.has(region.key)?region:null;
    const lineEnd=starts[i]+lines[i].length;
    const hasNewline=i<lines.length-1;
    const literal=full.slice(starts[i],lineEnd+(hasNewline?1:0));
    const begin=display.length;display+=literal;
    segments.push({kind:'real',from:begin,to:display.length,fullFrom:starts[i]});
    visibleLines.push(lines[i]);meta.push({original:i,foldKey:null});
    if(fold){
      const hidden=fold.end-i;
      const indent=(lines[i].match(/^[ \t]*/)||[''])[0];
      const summary=indent+CODE_FOLD_SUMMARY+' '+hidden+' '+(hidden===1?'Zeile':'Zeilen')+' eingeklappt';
      const newline=fold.end<lines.length-1?'\n':'';
      const at=display.length;display+=summary+newline;
      segments.push({kind:'placeholder',from:at,to:display.length,fullFrom:starts[i+1],fullTo:fold.end+1<lines.length?starts[fold.end+1]:full.length,key:fold.key});
      visibleLines.push(summary);meta.push({original:null,foldKey:fold.key,anchor:i});
      i=fold.end+1;
    }else i++;
  }
  state.visible=display;state.segments=segments;state.meta=meta;
  return display;
}
function codeFoldMapToFull(state,offset,side='right'){
  const n=Math.max(0,Math.min(state.visible.length,offset));
  // For a boundary between a real segment and a placeholder, favor the real
  // segment when the caret is in its text; never edit inside a placeholder.
  for(const seg of state.segments){
    if(seg.kind==='real'&&seg.from<=n&&n<=seg.to)return seg.fullFrom+n-seg.from;
  }
  for(const seg of state.segments){
    if(seg.kind==='placeholder'&&seg.from<=n&&n<=seg.to){
      if(n===seg.from)return seg.fullFrom;
      if(n===seg.to)return seg.fullTo;
      return null;
    }
  }
  return n===state.visible.length?state.full.length:null;
}
function codeFoldMapToVisible(state,fullOffset){
  const n=Math.max(0,Math.min(state.full.length,fullOffset));
  for(const seg of state.segments){
    if(seg.kind==='real'){
      const end=seg.fullFrom+seg.to-seg.from;
      if(seg.fullFrom<=n&&n<=end)return seg.from+n-seg.fullFrom;
    }
  }
  for(const seg of state.segments){
    if(seg.kind==='placeholder'&&seg.fullFrom<=n&&n<=seg.fullTo)return n===seg.fullTo?seg.to:seg.from;
  }
  return state.visible.length;
}
function codeFoldTouchesPlaceholder(state,start,end){
  return state.segments.some(s=>s.kind==='placeholder'&&(end>start?s.from<end&&s.to>start:s.from<start&&s.to>start));
}
function codeFoldState(source){return source?codeFoldEditors.get(source):null}
function codeFoldHasCollapsed(source){const state=codeFoldState(source);return Boolean(state&&state.collapsed.size)}
function codeFoldRebuild(state){
  state.regions=appEditorSettings.codeFolding?codeFoldRegions(state.full,state.language):[];
  const keys=new Set(state.regions.map(r=>r.key));
  for(const key of state.collapsed)if(!keys.has(key))state.collapsed.delete(key);
  return codeFoldProjection(state);
}
function codeFoldInitialize(source,doc,language,onRefresh){
  const previous=codeFoldSessions.get(doc.id);
  const state={source,docId:doc.id,language,full:doc.content||'',visible:'',segments:[],meta:[],regions:[],
    collapsed:new Set(previous||[]),onRefresh};
  codeFoldEditors.set(source,state);
  codeFoldRebuild(state);source.value=state.visible;
  codeFoldApplyUiState(source);
  source.addEventListener('beforeinput',()=>{
    if(!state.collapsed.size)return;
    const start=source.selectionStart,end=source.selectionEnd;
    if(codeFoldTouchesPlaceholder(state,start,end)||codeFoldMapToFull(state,start)===null||codeFoldMapToFull(state,end)===null)
      codeFoldExpandAll(source);
  });
  source.addEventListener('compositionstart',()=>{if(state.collapsed.size)codeFoldExpandAll(source)});
  // Clipboard operations spanning a fold must copy/cut the ORIGINAL source,
  // not the generated "... Zeilen eingeklappt" summary.
  source.addEventListener('copy',event=>{
    if(!state.collapsed.size||!event.clipboardData)return;
    const a=source.selectionStart,b=source.selectionEnd;
    if(a===b||!codeFoldTouchesPlaceholder(state,a,b))return;
    const from=codeFoldMapToFull(state,a),to=codeFoldMapToFull(state,b);
    if(from===null||to===null)return;
    event.clipboardData.setData('text/plain',state.full.slice(from,to));event.preventDefault();
  });
  source.addEventListener('cut',event=>{
    if(!state.collapsed.size||!event.clipboardData)return;
    const a=source.selectionStart,b=source.selectionEnd;
    if(a===b||!codeFoldTouchesPlaceholder(state,a,b))return;
    const from=codeFoldMapToFull(state,a),to=codeFoldMapToFull(state,b);
    if(from===null||to===null){codeFoldExpandAll(source);return}
    event.clipboardData.setData('text/plain',state.full.slice(from,to));event.preventDefault();
    state.full=state.full.slice(0,from)+state.full.slice(to);
    state.collapsed.clear();codeFoldRebuild(state);source.value=state.visible;
    source.setSelectionRange(from,from);codeFoldSessions.set(state.docId,new Set());
    codeFoldApplyUiState(source);source.dispatchEvent(new Event('input',{bubbles:true}));
  });
  return state;
}
function codeFoldApplyUiState(source){
  const frame=source?.closest('.codeframe');if(!frame)return;
  frame.classList.toggle('has-folded-lines',codeFoldHasCollapsed(source));
  frame.classList.toggle('has-code-folding',appEditorSettings.codeFolding);
}
function codeFoldFull(source){return codeFoldState(source)?.full??source?.value??''}
function codeFoldUpdateAfterInput(source){
  const state=codeFoldState(source);if(!state)return source.value;
  const fresh=source.value,old=state.visible;
  if(!state.collapsed.size){
    state.full=fresh;codeFoldRebuild(state);codeFoldSessions.set(state.docId,new Set(state.collapsed));
    return state.full;
  }
  let start=0;while(start<old.length&&start<fresh.length&&old[start]===fresh[start])start++;
  let suffix=0;while(suffix<old.length-start&&suffix<fresh.length-start&&old[old.length-1-suffix]===fresh[fresh.length-1-suffix])suffix++;
  const end=old.length-suffix,replacement=fresh.slice(start,fresh.length-suffix);
  const fullStart=codeFoldMapToFull(state,start),fullEnd=codeFoldMapToFull(state,end,'left');
  if(codeFoldTouchesPlaceholder(state,start,end)||fullStart===null||fullEnd===null){
    // Unknown edit spanning hidden text: reveal the source without modifying it.
    source.value=old;codeFoldExpandAll(source);return state.full;
  }
  const previousCursor=source.selectionStart;
  const caret=previousCursor<=start?codeFoldMapToFull(state,previousCursor):fullStart+Math.min(replacement.length,Math.max(0,previousCursor-start));
  const top=source.scrollTop,left=source.scrollLeft;
  state.full=state.full.slice(0,fullStart)+replacement+state.full.slice(fullEnd);
  codeFoldRebuild(state);source.value=state.visible;
  const index=codeFoldMapToVisible(state,caret===null?fullStart:caret);
  source.setSelectionRange(index,index);source.scrollTop=top;source.scrollLeft=left;
  codeFoldSessions.set(state.docId,new Set(state.collapsed));codeFoldApplyUiState(source);
  return state.full;
}
function codeFoldExpandAll(source){
  const state=codeFoldState(source);if(!state||!state.collapsed.size)return;
  const fallback=position=>state.segments.find(seg=>seg.kind==='placeholder'&&seg.from<position&&position<seg.to)?.fullFrom??state.full.length;
  const originalStart=codeFoldMapToFull(state,source.selectionStart),originalEnd=codeFoldMapToFull(state,source.selectionEnd);
  // A click inside a fold placeholder reveals the first hidden line rather
  // than unexpectedly moving the caret to the end of the entire file.
  const position=originalStart??fallback(source.selectionStart),other=originalEnd??fallback(source.selectionEnd);
  const top=source.scrollTop,left=source.scrollLeft;
  state.collapsed.clear();codeFoldRebuild(state);source.value=state.visible;
  source.setSelectionRange(Math.min(position,other),Math.max(position,other));
  source.scrollTop=top;source.scrollLeft=left;
  codeFoldSessions.set(state.docId,new Set());codeFoldApplyUiState(source);
  state.onRefresh();
}
function codeFoldRevealOffset(source,offset){
  const state=codeFoldState(source);if(!state||!state.collapsed.size)return;
  const starts=codeFoldLineStarts(state.full),line=codeFoldLineAt(starts,offset);
  let changed=false;
  for(const region of state.regions){
    if(state.collapsed.has(region.key)&&region.start<line&&region.end>=line){state.collapsed.delete(region.key);changed=true}
  }
  if(changed){
    const top=source.scrollTop;
    codeFoldRebuild(state);source.value=state.visible;source.scrollTop=top;
    codeFoldSessions.set(state.docId,new Set(state.collapsed));codeFoldApplyUiState(source);state.onRefresh();
  }
}
function codeFoldToggle(source,key){
  const state=codeFoldState(source);if(!state||!appEditorSettings.codeFolding)return;
  const region=state.regions.find(r=>r.key===key);if(!region)return;
  const current=codeFoldMapToFull(state,source.selectionStart);
  const top=source.scrollTop,left=source.scrollLeft;
  if(state.collapsed.has(key))state.collapsed.delete(key);else state.collapsed.add(key);
  codeFoldRebuild(state);source.value=state.visible;
  const caret=codeFoldMapToVisible(state,current??codeFoldLineStarts(state.full)[region.start]);
  source.setSelectionRange(caret,caret);source.scrollTop=top;source.scrollLeft=left;
  codeFoldSessions.set(state.docId,new Set(state.collapsed));codeFoldApplyUiState(source);state.onRefresh();
}
function codeFoldToggleAll(source){
  const state=codeFoldState(source);if(!state||!appEditorSettings.codeFolding)return;
  if(state.collapsed.size){codeFoldExpandAll(source);return}
  // Fold the outermost regions; nested regions can still be folded later.
  let end=-1;
  for(const region of state.regions){if(region.start<=end)continue;state.collapsed.add(region.key);end=region.end}
  codeFoldRebuild(state);source.value=state.visible;
  codeFoldSessions.set(state.docId,new Set(state.collapsed));codeFoldApplyUiState(source);state.onRefresh();
}
function codeFoldPaintGutter(source,gutterId,lines,layout){
  const state=codeFoldState(source),layer=document.getElementById(gutterId);
  if(!layer)return;layer.replaceChildren();
  if(!appEditorSettings.codeFolding||!state)return;
  const regionsByLine=new Map(state.regions.map(region=>[region.start,region]));
  const style=getComputedStyle(source),lineHeight=parseFloat(style.lineHeight)||23,padTop=parseFloat(style.paddingTop)||17;
  state.meta.forEach((meta,index)=>{
    if(meta.original===null)return;
    const region=regionsByLine.get(meta.original);if(!region)return;
    const collapsed=state.collapsed.has(region.key),button=document.createElement('button');
    button.type='button';button.className='code-fold-toggle'+(collapsed?' collapsed':'');
    button.textContent=collapsed?'▸':'▾';button.setAttribute('aria-expanded',String(!collapsed));
    button.setAttribute('aria-label',(collapsed?'Ausklappen':'Einklappen')+' ab Zeile '+(region.start+1));
    button.title=(collapsed?'Ausklappen':'Einklappen')+' · Zeilen '+(region.start+1)+'–'+(region.end+1);
    button.style.top=(padTop+(layout?.offsets[index]||0)*lineHeight)+'px';
    button.onclick=()=>codeFoldToggle(source,region.key);layer.appendChild(button);
  });
  layer.style.transform=`translateY(${-source.scrollTop}px)`;
}
function codeFoldSyncGutter(source,gutterId){
  const layer=document.getElementById(gutterId);if(layer&&source)layer.style.transform=`translateY(${-source.scrollTop}px)`;
}
function codeFoldOriginalIndex(source,visibleIndex){
  const state=codeFoldState(source);return state?.meta[visibleIndex]?.original??null;
}
function codeFoldVisibleIndex(source,originalIndex){
  const state=codeFoldState(source);if(!state)return originalIndex;
  const found=state.meta.findIndex(item=>item.original===originalIndex);
  if(found>=0)return found;
  const owner=state.regions.find(r=>r.start<originalIndex&&r.end>=originalIndex&&state.collapsed.has(r.key));
  return owner?state.meta.findIndex(item=>item.foldKey===owner.key):-1;
}
