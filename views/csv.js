'use strict';
/* mindfagg v56: CSV Grid. Papa Parse 5.7.0 is used when available; the
 * small offline parser below preserves CSV editing when CDN access is blocked.
 * CSV is never executed or interpreted as HTML. All cells are text inputs. */
const CSV_GRID_PAGE_SIZE=100,CSV_GRID_MAX_COLUMNS=200;
const CSV_DEFAULT_SETTINGS=Object.freeze({delimiter:',',encoding:'utf-8',newline:'\r\n',quoteChar:'"'});
const CSV_ENCODING_VALUES=new Set(['utf-8','utf-8-bom','utf-16le','utf-16be','windows-1252']);
const CSV_DELIMITER_VALUES=new Set([',',';','\t','|']);
const CSV_NEWLINE_VALUES=new Set(['\r\n','\n','\r']);
const CSV_QUOTE_VALUES=new Set(['"',"'"]);
let csvGridState=null,csvPapaRequested=false;
function isCsvFile(doc){return fileKind(doc)==='script'&&pathExtension(workspacePath(doc))==='csv'}
function csvNormalizeOptions(value,defaults=CSV_DEFAULT_SETTINGS){
  return {
    delimiter:CSV_DELIMITER_VALUES.has(value?.delimiter)?value.delimiter:defaults.delimiter,
    encoding:CSV_ENCODING_VALUES.has(value?.encoding)?value.encoding:defaults.encoding,
    newline:CSV_NEWLINE_VALUES.has(value?.newline)?value.newline:defaults.newline,
    quoteChar:CSV_QUOTE_VALUES.has(value?.quoteChar)?value.quoteChar:defaults.quoteChar
  };
}
function csvTryLoadPapa(){
  if(csvPapaRequested||typeof Papa!=='undefined'&&typeof Papa.parse==='function')return;
  csvPapaRequested=true;
  // Lazy loading keeps non-CSV views usable even when external access is blocked.
  // A local RFC 4180 compatible parser is available immediately and offline.
  const script=document.createElement('script');
  script.async=true;script.crossOrigin='anonymous';
  script.src='https://cdn.jsdelivr.net/npm/papaparse@5.7.0/papaparse.min.js';
  script.onerror=()=>console.info('Papa Parse CDN nicht erreichbar. CSV-Offline-Parser wird verwendet.');
  document.head.appendChild(script);
}
function csvNewline(text){const match=/\r\n|\n|\r/.exec(text);return match?.[0]||CSV_DEFAULT_SETTINGS.newline}
function csvGuessDelimiter(text){
  const sample=String(text).slice(0,32000),counts={',':0,';':0,'\t':0,'|':0};
  let quote='',lines=0;
  for(let i=0;i<sample.length&&lines<12;i++){
    const ch=sample[i];
    if(quote){if(ch===quote){if(sample[i+1]===quote)i++;else quote=''}continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='\r'||ch==='\n'){lines++;if(ch==='\r'&&sample[i+1]==='\n')i++;continue}
    if(Object.hasOwn(counts,ch))counts[ch]++;
  }
  const ranked=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  return ranked[0][1]>0?ranked[0][0]:CSV_DEFAULT_SETTINGS.delimiter;
}
function csvGuessQuote(text,delimiter){
  const sample=String(text).slice(0,24000);
  // A single quote qualifies as a text delimiter only at the start of a field.
  const escaped=delimiter==='\t'?'\\t':delimiter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const start=new RegExp('(?:^|[\\r\\n]|'+escaped+')\\s*(["\\\'])');
  const match=start.exec(sample);
  return match?.[1]||CSV_DEFAULT_SETTINGS.quoteChar;
}
function csvDetectOptions(text,encoding='utf-8'){
  const delimiter=csvGuessDelimiter(text);
  return csvNormalizeOptions({delimiter,newline:csvNewline(text),quoteChar:csvGuessQuote(text,delimiter),encoding});
}
function csvFileOptions(doc){return csvNormalizeOptions(doc?.csvSettings||csvDetectOptions(doc?.content||'',csvGuessEncoding(doc?.raw)));}
function csvGuessEncoding(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes||[]);
  if(data.length>=2&&data[0]===255&&data[1]===254)return 'utf-16le';
  if(data.length>=2&&data[0]===254&&data[1]===255)return 'utf-16be';
  if(data.length>=3&&data[0]===239&&data[1]===187&&data[2]===191)return 'utf-8-bom';
  try{new TextDecoder('utf-8',{fatal:true}).decode(data);return 'utf-8'}catch(_){return 'windows-1252'}
}
const CSV_CP1252_EXTRA=[0x20ac,0x0081,0x201a,0x0192,0x201e,0x2026,0x2020,0x2021,0x02c6,0x2030,0x0160,0x2039,0x0152,0x008d,0x017d,0x008f,
  0x0090,0x2018,0x2019,0x201c,0x201d,0x2022,0x2013,0x2014,0x02dc,0x2122,0x0161,0x203a,0x0153,0x009d,0x017e,0x0178];
function csvEncodeText(text,encoding='utf-8'){
  const str=String(text??'');
  if(encoding==='utf-8-bom'){const bytes=new TextEncoder().encode(str);const out=new Uint8Array(3+bytes.length);out.set([239,187,191]);out.set(bytes,3);return out}
  if(encoding==='utf-16le'||encoding==='utf-16be'){
    const bigEndian=encoding==='utf-16be';
    const out=new Uint8Array(2+str.length*2);out.set(bigEndian?[254,255]:[255,254]);
    for(let i=0;i<str.length;i++){const code=str.charCodeAt(i);out[2+i*2]=bigEndian?code>>8:code&255;out[3+i*2]=bigEndian?code&255:code>>8}
    return out;
  }
  if(encoding==='windows-1252'){
    const out=new Uint8Array(Array.from(str).length);let offset=0;
    for(const ch of str){const code=ch.codePointAt(0);let byte=code;
      if(code>=128&&code<160)byte=CSV_CP1252_EXTRA.indexOf(code)+128;
      else if(code>255)byte=CSV_CP1252_EXTRA.indexOf(code)+128;
      if(byte<0||byte===127&&code!==127||byte>255||code>255&&byte===127)
        throw Error('Zeichen '+ch+' ist nicht in Windows-1252 darstellbar. Bitte UTF-8 in den CSV-Einstellungen wählen.');
      out[offset++]=byte;
    }
    return out;
  }
  return new TextEncoder().encode(str);
}
// RFC 4180-compatible offline fallback for quoted delimiters, escaped quotes and embedded newlines.
function csvOfflineParse(text,options={}){
  const content=String(text??'').replace(/^\uFEFF/,'');
  const delimiter=options.delimiter||csvGuessDelimiter(content),quote=options.quoteChar||'"';
  if(!content)return {data:[],errors:[],meta:{delimiter,linebreak:csvNewline(content)}};
  const rows=[],errors=[];let row=[],field='',quoted=false,closed=false,atStart=true;
  const endField=()=>{row.push(field);field='';quoted=false;closed=false;atStart=true};
  const endRow=()=>{endField();rows.push(row);row=[]};
  for(let i=0;i<content.length;i++){
    const ch=content[i];
    if(quoted){
      if(ch===quote){if(content[i+1]===quote){field+=quote;i++}else{quoted=false;closed=true}}
      else field+=ch;
      continue;
    }
    if(closed&&ch!==delimiter&&ch!=='\n'&&ch!=='\r'){
      if(ch!==' '&&ch!=='\t')errors.push({type:'Quotes',code:'InvalidQuotes',message:'Unerwarteter Inhalt nach schließendem Textbegrenzer',row:rows.length});
      field+=ch;closed=false;
      continue;
    }
    if(ch===quote&&atStart){quoted=true;atStart=false;continue}
    if(ch===delimiter){endField();continue}
    if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&content[i+1]==='\n')i++;
      endRow();continue;
    }
    field+=ch;atStart=false;closed=false;
  }
  if(quoted)errors.push({type:'Quotes',code:'MissingQuotes',message:'Nicht geschlossener Textbegrenzer',row:rows.length});
  if(field||row.length||!atStart||closed)endRow();

  return {data:rows,errors,meta:{delimiter,linebreak:csvNewline(content)}};
}
function csvOfflineUnparse(rows,options={}){
  const delim=options.delimiter||',',quote=options.quoteChar||'"',newline=options.newline||'\r\n';
  return rows.map(row=>row.map(item=>{
    const text=String(item??'');
    const needsQuote=text.includes(delim)||text.includes(quote)||/[\r\n]/.test(text)||/^\s|\s$/.test(text);
    return needsQuote?quote+text.replaceAll(quote,quote+quote)+quote:text;
  }).join(delim)).join(newline);
}
function csvParse(text,options){
  const config={delimiter:options.delimiter,newline:'',quoteChar:options.quoteChar,escapeChar:options.quoteChar,
    dynamicTyping:false,header:false,skipEmptyLines:false};
  return typeof Papa!=='undefined'&&typeof Papa.parse==='function'?Papa.parse(text,config):csvOfflineParse(text,config);
}
function csvUnparse(rows,options){
  const config={delimiter:options.delimiter,newline:options.newline,quotes:false,quoteChar:options.quoteChar,escapeChar:options.quoteChar};
  return typeof Papa!=='undefined'&&typeof Papa.unparse==='function'?Papa.unparse(rows,config):csvOfflineUnparse(rows,config);
}
function csvNewFileContent(options){return csvUnparse([['Spalte 1','Spalte 2'],['','']],options)+options.newline}
function csvGridColumnName(index){
  let result='',n=index+1;
  while(n){n--;result=String.fromCharCode(65+n%26)+result;n=Math.floor(n/26)}
  return result;
}
function csvGridCommit(state){
  const doc=docs.find(item=>item.id===state.docId);
  if(!doc||!isCsvFile(doc))return;
  const text=csvUnparse(state.rows,state.options)+(state.hasFinalNewline&&state.rows.length?state.options.newline:'');
  if(text===doc.content)return;
  doc.content=text;
  doc.csvSettings={...state.options};
  docHistoryFor(doc.id).redo.length=0;deletionHistoryFor(doc.projectId).redo.length=0;
  failedDocWrites.delete(doc.id);updateHistoryButtons();updateSaveStatus();
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>saveSource(doc.id,doc.content).catch(error=>{console.error(error);toast('CSV konnte nicht gespeichert werden')}),650);
}
function csvGridSelect(state,row,col){
  state.focusRow=row;state.focusCol=col;
  $('#csvDeleteRow').disabled=row<0;
  $('#csvDeleteColumn').disabled=col<0;
  $('#csvGridSelection').textContent=row<0
    ?(col<0?'Keine Zelle ausgewählt.':'Spalte '+csvGridColumnName(col))
    :(col<0?'Zeile '+(row+1):'Zeile '+(row+1)+' · Spalte '+csvGridColumnName(col));
  const table=$('#csvGridTable');
  table.querySelectorAll('.csv-grid-header-selected').forEach(header=>header.classList.remove('csv-grid-header-selected'));
  if(row>=0)table.querySelector(`[data-csv-row-header="${row}"]`)?.classList.add('csv-grid-header-selected');
  if(col>=0)table.querySelector(`[data-csv-col-header="${col}"]`)?.classList.add('csv-grid-header-selected');
}
function csvGridPaint(state){
  let widest=1;for(const row of state.rows)widest=Math.max(widest,row.length);
  const columns=state.columns=Math.min(CSV_GRID_MAX_COLUMNS,widest);
  const pageCount=Math.max(1,Math.ceil(state.rows.length/CSV_GRID_PAGE_SIZE));
  state.page=Math.max(0,Math.min(pageCount-1,state.page));
  const start=state.page*CSV_GRID_PAGE_SIZE,end=Math.min(state.rows.length,start+CSV_GRID_PAGE_SIZE);
  const displayRows=state.rows.length?state.rows.slice(start,end):[['','']];
  const header=Array.from({length:columns},(_,i)=>`<th scope="col"><button type="button" class="csv-grid-header-button" data-csv-col-header="${i}" aria-label="Spalte ${csvGridColumnName(i)} auswählen">${csvGridColumnName(i)}</button></th>`).join('');
  const body=displayRows.map((row,i)=>{
    const r=start+i;
    return `<tr><th scope="row" class="csv-grid-index"><button type="button" class="csv-grid-header-button" data-csv-row-header="${r}" aria-label="Zeile ${r+1} auswählen">${r+1}</button></th>${Array.from({length:columns},(_,c)=>
      `<td><textarea class="csv-grid-cell" rows="1" spellcheck="false" data-csv-row="${r}" data-csv-col="${c}" aria-label="Zeile ${r+1}, Spalte ${csvGridColumnName(c)}">${escapeHtml(row[c]??'')}</textarea></td>`).join('')}</tr>`;
  }).join('');
  $('#csvGridTable').innerHTML=`<thead><tr><th scope="col" class="csv-grid-index">#</th>${header}</tr></thead><tbody>${body}</tbody>`;
  $('#csvGridPage').textContent=`${state.page+1} / ${pageCount}`;
  $('#csvPreviousPage').disabled=state.page===0;
  $('#csvNextPage').disabled=state.page===pageCount-1;
  $('#csvGridMeta').textContent=state.rows.length+' Zeilen · '+columns+' Spalten · Trennzeichen: '+(state.options.delimiter==='\t'?'Tab':state.options.delimiter);
  $('#csvAddColumn').disabled=columns>=CSV_GRID_MAX_COLUMNS;
  csvGridSelect(state,-1,-1);
}
function renderCsvGridView(){
  const doc=documentNow();if(!isCsvFile(doc))return;
  editorDocId=doc.id;csvTryLoadPapa();
  const options=csvFileOptions(doc),usingPapa=typeof Papa!=='undefined'&&typeof Papa.parse==='function';
  const result=csvParse(doc.content||'',options);
  // Papa Parse includes an extra empty record after a final newline. The local parser does not.
  if(usingPapa&&/(?:\r\n|\n|\r)$/.test(doc.content||'')&&result.data.at(-1)?.length===1&&result.data.at(-1)?.[0]==='')result.data.pop();
  const errors=result.errors.filter(error=>error.code!=='UndetectableDelimiter');
  if(errors.length){
    $('#surface').innerHTML=`<div class="csv-grid-error" role="alert"><h2>CSV kann nicht als Grid dargestellt werden</h2><p>${escapeHtml(errors[0].message||'Ungültiges CSV-Format')} (Datensatz ${Number(errors[0].row||0)+1}).</p><p>Bitte den Fehler im Script-Editor korrigieren.</p><button type="button" class="btn" id="csvOpenScript">Script-Ansicht öffnen</button></div>`;
    $('#csvOpenScript').onclick=()=>{activeFilePanel='script';render()};return;
  }
  const state={docId:doc.id,rows:result.data.map(row=>row.map(value=>String(value??''))),options,
    hasFinalNewline:/(?:\r\n|\n|\r)$/.test(doc.content||''),page:0,columns:2,focusRow:-1,focusCol:-1};
  csvGridState=state;
  $('#surface').innerHTML=`<section class="csv-grid" aria-label="CSV-Grid-Ansicht">
    <div class="csv-grid-tools" role="toolbar" aria-label="CSV-Tabelle bearbeiten">
      <select class="btn csv-grid-insert-menu" id="csvAddRow" aria-label="Zeile hinzufügen">
        <option value="" selected disabled hidden>+ Zeile</option>
        <option value="above">Zeile darüber</option>
        <option value="below">Zeile darunter</option>
      </select>
      <select class="btn csv-grid-insert-menu" id="csvAddColumn" aria-label="Spalte hinzufügen">
        <option value="" selected disabled hidden>+ Spalte</option>
        <option value="left">Spalte links</option>
        <option value="right">Spalte rechts</option>
      </select>
      <button type="button" class="btn" id="csvDeleteRow" disabled>Zeile löschen</button>
      <button type="button" class="btn" id="csvDeleteColumn" disabled>Spalte löschen</button>
      <span id="csvGridMeta" class="csv-grid-meta" aria-live="polite"></span>
    </div>
    <div class="csv-grid-scroll"><table id="csvGridTable" class="csv-grid-table" aria-label="CSV-Daten bearbeiten"></table></div>
    <div class="csv-grid-bottom"><span id="csvGridSelection" class="csv-grid-selection" role="status">Keine Zelle ausgewählt.</span>
      <div class="csv-grid-pages"><button type="button" class="btn" id="csvPreviousPage">← Zurück</button><span id="csvGridPage" aria-live="polite"></span><button type="button" class="btn" id="csvNextPage">Weiter →</button></div></div>
  </section>`;
  const table=$('#csvGridTable');
  table.addEventListener('focusin',event=>{
    const target=event.target.closest('[data-csv-row]');if(!target)return;
    csvGridSelect(state,Number(target.dataset.csvRow),Number(target.dataset.csvCol));
  });
  table.addEventListener('click',event=>{
    const rowHeader=event.target.closest('[data-csv-row-header]');
    if(rowHeader){csvGridSelect(state,Number(rowHeader.dataset.csvRowHeader),-1);return}
    const colHeader=event.target.closest('[data-csv-col-header]');
    if(colHeader)csvGridSelect(state,-1,Number(colHeader.dataset.csvColHeader));
  });
  table.addEventListener('input',event=>{
    const target=event.target.closest('[data-csv-row]');if(!target)return;
    const row=Number(target.dataset.csvRow),column=Number(target.dataset.csvCol);
    while(state.rows.length<=row)state.rows.push([]);
    state.rows[row][column]=target.value;
    csvGridCommit(state);
  });
  $('#csvAddRow').onchange=event=>{
    const placement=event.target.value;
    // Without a selected row, both insertion modes append to the end.
    const selected=state.focusRow>=0&&state.focusRow<state.rows.length;
    const at=selected?state.focusRow+(placement==='below'?1:0):state.rows.length;
    const col=state.focusCol>=0?Math.min(state.focusCol,state.columns-1):0;
    event.target.value='';
    state.rows.splice(at,0,Array.from({length:state.columns},()=>''));
    csvGridCommit(state);
    state.page=Math.floor(at/CSV_GRID_PAGE_SIZE);csvGridPaint(state);
    table.querySelector(`[data-csv-row="${at}"][data-csv-col="${col}"]`)?.focus();
  };
  $('#csvAddColumn').onchange=event=>{
    if(state.columns>=CSV_GRID_MAX_COLUMNS)return;
    const placement=event.target.value;
    // Without a selected column, both insertion modes append to the end.
    const selected=state.focusCol>=0&&state.focusCol<state.columns;
    const at=selected?state.focusCol+(placement==='right'?1:0):state.columns;
    const rowIndex=state.focusRow;
    event.target.value='';
    for(const row of state.rows){
      // Pad ragged CSV rows before splicing so inserted cells line up.
      while(row.length<state.columns)row.push('');
      row.splice(at,0,'');
    }
    if(!state.rows.length)state.rows.push(Array.from({length:state.columns+1},()=>''));
    csvGridCommit(state);csvGridPaint(state);
    if(rowIndex>=0)table.querySelector(`[data-csv-row="${rowIndex}"][data-csv-col="${at}"]`)?.focus();
    else table.querySelector(`[data-csv-col-header="${at}"]`)?.click();
  };
  $('#csvDeleteRow').onclick=()=>{
    if(state.focusRow<0)return;
    state.rows.splice(state.focusRow,1);csvGridCommit(state);csvGridPaint(state);
  };
  $('#csvDeleteColumn').onclick=()=>{
    if(state.focusCol<0||state.columns<=1)return;
    for(const row of state.rows)row.splice(state.focusCol,1);
    csvGridCommit(state);csvGridPaint(state);
  };
  $('#csvPreviousPage').onclick=()=>{state.page--;csvGridPaint(state)};
  $('#csvNextPage').onclick=()=>{state.page++;csvGridPaint(state)};
  csvGridPaint(state);
}
