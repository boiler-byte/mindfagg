'use strict';
/* mindfagg v59 — always-isolated HTML preview with a virtual project file system.
 * A sandboxed iframe has an opaque origin and cannot be controlled by a SW.
 * Instead, static resources are rebased/inlined in an inert DOM and runtime
 * fetch/media requests are answered by a read-only postMessage file broker.
 * This also works with file:// and in an offline installation. */
let htmlPreviewEntryId=null,htmlPreviewCurrentPath='',htmlPreviewBackStack=[];
let htmlPreviewFrame=null,htmlPreviewToken='',htmlPreviewGeneration=0;
const HTML_PREVIEW_LOG_LIMIT=100;
let htmlPreviewLogs=[],htmlPreviewLogSerial=0,htmlPreviewConsoleOpen=false;
let htmlPreviewConsoleRenderPending=false;
// A sandboxed srcdoc iframe must never receive allow-same-origin: with
// allow-scripts this would expose the parent DOM and stored GitHub credentials.
const HTML_PREVIEW_STORAGE_BLOCKED=/(?:sandbox(?:ed)?|allow-same-origin)/i;
function htmlPreviewStorageBlockedError(text){
  return HTML_PREVIEW_STORAGE_BLOCKED.test(String(text))&&/(?:localStorage|indexedDB|IDBFactory|sessionStorage)/i.test(String(text));
}

const HTML_PREVIEW_ORIGIN='https://mindfagg-preview.invalid';
const HTML_PREVIEW_MAX_INLINE=2*1024*1024;

function isHtmlScriptFile(doc){
  return fileKind(doc)==='script'&&['html','htm','xhtml'].includes(pathExtension(workspacePath(doc)));
}
function htmlPreviewFiles(){
  return new Map(docs.filter(d=>d.projectId===projectId).map(d=>[workspacePath(d),d]));
}
function htmlPreviewResolve(raw,basePath){
  if(typeof raw!=='string'||!raw.trim()||/^\s*(?:data:|blob:|javascript:|mailto:|tel:|#)/i.test(raw))return null;
  try{
    const url=new URL(raw,HTML_PREVIEW_ORIGIN+'/'+basePath.split('/').map(encodeURIComponent).join('/'));
    if(url.origin!==HTML_PREVIEW_ORIGIN)return null;
    const path=decodeURIComponent(url.pathname.slice(1));
    if(!path||!workspaceValidPath(path))return null;
    return path;
  }catch(_){return null}
}
function htmlPreviewFileBytes(doc){
  if(docIsText(doc))return new TextEncoder().encode(doc.content||'');
  return workspaceBytes(doc.data);
}
function htmlPreviewMime(path){
  const types={html:'text/html',htm:'text/html',xhtml:'application/xhtml+xml',
    css:'text/css',js:'text/javascript',mjs:'text/javascript',cjs:'text/javascript',
    json:'application/json',xml:'application/xml',svg:'image/svg+xml',
    png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',
    bmp:'image/bmp',avif:'image/avif',ico:'image/x-icon',apng:'image/apng',
    mp3:'audio/mpeg',wav:'audio/wav',wave:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',
    m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',weba:'audio/webm',aif:'audio/aiff',aiff:'audio/aiff',mid:'audio/midi',midi:'audio/midi',
    mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',ogv:'video/ogg',
    woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',
    wasm:'application/wasm',txt:'text/plain',md:'text/markdown'};
  return types[pathExtension(path)]||'application/octet-stream';
}
function htmlPreviewBase64(bytes){
  const parts=[];for(let i=0;i<bytes.length;i+=16384){
    parts.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
  }
  return btoa(parts.join(''));
}
function htmlPreviewDataUrl(doc){
  return 'data:'+htmlPreviewMime(workspacePath(doc))+';base64,'+htmlPreviewBase64(htmlPreviewFileBytes(doc));
}
function htmlPreviewModule(path,files,cache,visiting,warnings){
  if(cache.has(path))return cache.get(path);
  const doc=files.get(path);
  if(!doc||!docIsText(doc)){warnings.add('Modul nicht gefunden: '+path);return null}
  if(visiting.has(path)){warnings.add('Zyklische ES-Modul-Importe sind in der Offline-Vorschau eingeschränkt: '+path);return null}
  visiting.add(path);
  const code=htmlPreviewRewriteImports(doc.content||'',path,files,cache,visiting,warnings);
  visiting.delete(path);
  const url='data:text/javascript;base64,'+htmlPreviewBase64(new TextEncoder().encode(code));
  cache.set(path,url);return url;
}
function htmlPreviewRewriteImports(code,base,files,cache,visiting,warnings){
  if(typeof acorn==='undefined')return code;
  let ast;
  try{ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true})}
  catch(_){return code}
  const edits=[];
  function walk(node){
    if(!node||typeof node!=='object')return;
    if((node.type==='ImportDeclaration'||node.type==='ExportNamedDeclaration'||node.type==='ExportAllDeclaration'||node.type==='ImportExpression')&&
      node.source?.type==='Literal'&&typeof node.source.value==='string'){
      const target=htmlPreviewResolve(node.source.value,base);
      if(target){
        const url=htmlPreviewModule(target,files,cache,visiting,warnings);
        if(url)edits.push({start:node.source.start,end:node.source.end,value:JSON.stringify(url)});
      }
    }
    for(const [key,value] of Object.entries(node)){
      if(key==='start'||key==='end'||key==='source'&&node.source?.type==='Literal')continue;
      if(Array.isArray(value))value.forEach(walk);
      else if(value&&typeof value==='object'&&value.type)walk(value);
    }
  }
  walk(ast);
  for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.value+code.slice(edit.end);
  return code;
}
function htmlPreviewStylesheet(path,files,visiting,warnings){
  const doc=files.get(path);
  if(!doc||!docIsText(doc)){warnings.add('Stylesheet nicht gefunden: '+path);return ''}
  if(visiting.has(path)){warnings.add('Zyklisches CSS-@import: '+path);return ''}
  visiting.add(path);
  let content=doc.content||'';
  content=content.replace(/@import\s+(?:url\(\s*(['"]?)([^)'"\s]+)\1\s*\)|(['"])([^'"\n]+)\3)\s*([^;]*);/gi,(_,q1,first,q2,second,condition)=>{
    const target=htmlPreviewResolve(first||second,path);
    if(!target||!files.has(target))return '';
    const inner=htmlPreviewStylesheet(target,files,visiting,warnings);
    return condition.trim()?`@media ${condition.trim()} {\n${inner}\n}`:inner;
  });
  content=content.replace(/url\(\s*(['"]?)([^)'"\n]+)\1\s*\)/gi,(original,quote,source)=>{
    const target=htmlPreviewResolve(source,path),asset=target&&files.get(target);
    return asset?`url("${htmlPreviewDataUrl(asset)}")`:original;
  });
  visiting.delete(path);
  return content;
}
function htmlPreviewBootstrap(path,token){
  const base=JSON.stringify(HTML_PREVIEW_ORIGIN+'/'+path.split('/').map(encodeURIComponent).join('/')).replace(/</g,'\\u003c');
  const key=JSON.stringify(token);
  // This boot script intentionally contains no Workspace data. Only the parent
  // can read IndexedDB. PostMessage responses are returned to this one iframe.
  return `(()=>{
    'use strict';
    const token=${key}, virtualBase=${base}, pending=new Map();let nextId=0;
    const origin='${HTML_PREVIEW_ORIGIN}';
    // Forward logs and uncaught errors from this opaque-origin iframe.
    // Do not expose parent internals or store any workspace state in the iframe.
    function serializeConsoleValue(value){
      try{
        if(value instanceof Error)return value.stack||value.name+': '+value.message;
        if(typeof value==='string')return value;
        if(typeof value==='undefined')return 'undefined';
        if(typeof value==='bigint')return value.toString()+'n';
        if(typeof value==='object'&&value!==null){
          const seen=new WeakSet();
          return JSON.stringify(value,(key,item)=>{
            if(typeof item==='bigint')return item.toString()+'n';
            if(item instanceof Error)return item.stack||item.message;
            if(item&&typeof item==='object'){if(seen.has(item))return '[Zirkulärer Verweis]';seen.add(item)}
            return item;
          })||String(value);
        }
        return String(value);
      }catch(_){return '[Nicht darstellbarer Konsolenwert]'}
    }
    function sendLog(level,values){
      try{
        const message=Array.from(values).map(serializeConsoleValue).join(' ')
          .replace(/data:(?:text|application)[/]javascript;base64,[A-Za-z0-9+/=]+/g,'[eingebettetes Script]')
          .slice(0,8000);
        parent.postMessage({type:'mindfagg-preview-log',token,level,text:message},'*');
      }catch(_){}
    }
    for(const level of ['log','info','warn','error','debug']){
      const original=console[level];
      console[level]=function(...args){
        sendLog(level,args);
        if(typeof original==='function')return original.apply(console,args);
      };
    }
    window.addEventListener('error',event=>{
      if(event instanceof ErrorEvent){
        const location=event.filename&&!event.filename.startsWith('data:')?' ('+event.filename+':'+event.lineno+':'+event.colno+')':'';
        sendLog('error',[event.message+location,event.error?.stack||'']);
      }else if(event.target&&event.target!==window){
        const item=event.target;
        sendLog('error',['Ressource konnte nicht geladen werden:',item.getAttribute?.('src')||item.getAttribute?.('href')||item.tagName||'unbekannt']);
      }
    },true);
    window.addEventListener('unhandledrejection',event=>{
      sendLog('error',['Unbehandelte Promise-Ablehnung:',event.reason]);
    });
    function pathOf(raw){
      if(typeof raw!=='string'||raw.startsWith('#'))throw new TypeError('Ungültiger Dateipfad');
      const url=new URL(raw,virtualBase);
      if(url.origin!==origin)throw new TypeError('Externe Netzwerkzugriffe sind in der Vorschau gesperrt');
      return decodeURIComponent(url.pathname.slice(1));
    }
    function readFile(path){
      return new Promise((resolve,reject)=>{
        const id=++nextId;
        pending.set(id,{resolve,reject});
        parent.postMessage({type:'mindfagg-vfs-read',token,id,path},'*');
      });
    }
    window.addEventListener('message',event=>{
      const data=event.data;
      if(!data||data.type!=='mindfagg-vfs-result'||data.token!==token)return;
      const entry=pending.get(data.id);if(!entry)return;
      pending.delete(data.id);
      if(data.error)entry.reject(new Error(data.error));
      else entry.resolve(data);
    });
    window.fetch=async function(input,init={}){
      const method=String(init.method||(input&&input.method)||'GET').toUpperCase();
      if(method!=='GET'&&method!=='HEAD')throw new TypeError('Im virtuellen Dateisystem sind nur GET und HEAD möglich');
      const value=typeof input==='string'?input:input?.url;
      const path=pathOf(value);
      const file=await readFile(path);
      return new Response(method==='HEAD'?null:file.bytes,{status:200,headers:{'Content-Type':file.mime}});
    };
    // Basic async XHR support for existing small web projects.
    window.XMLHttpRequest=class LocalXHR extends EventTarget {
      constructor(){super();this.readyState=0;this.status=0;this.response=null;this.responseText='';this.responseType='';this.onload=null;this.onerror=null;this.onreadystatechange=null;this._headers={}}
      open(method,url,async=true){if(async===false)throw new Error('Synchrones XHR wird nicht unterstützt');this._method=method;this._url=url;this.readyState=1;this._dispatch('readystatechange')}
      setRequestHeader(name,value){this._headers[name]=value}
      getResponseHeader(name){return name.toLowerCase()==='content-type'?this._mime:null}
      getAllResponseHeaders(){return this._mime?'content-type: '+this._mime+'\\r\\n':''}
      abort(){this.readyState=0}
      _dispatch(name){this.dispatchEvent(new Event(name));const cb=this['on'+name];if(typeof cb==='function')cb.call(this,new Event(name))}
      async send(){try{
        const response=await fetch(this._url,{method:this._method});this.status=response.status;this._mime=response.headers.get('Content-Type');
        if(this.responseType==='arraybuffer')this.response=await response.arrayBuffer();
        else if(this.responseType==='blob')this.response=await response.blob();
        else {this.responseText=await response.text();this.response=this.responseType==='json'?JSON.parse(this.responseText):this.responseText}
        this.readyState=4;this._dispatch('readystatechange');this._dispatch('load');this._dispatch('loadend');
      }catch(error){this.status=0;this.readyState=4;this._dispatch('readystatechange');this._dispatch('error');this._dispatch('loadend');}}
    };
    async function loadMedia(el){
      const path=el.getAttribute('data-mf-resource');if(!path)return;
      el.removeAttribute('data-mf-resource');
      try{
        const data=await readFile(path),url=URL.createObjectURL(new Blob([data.bytes],{type:data.mime}));
        el.src=url;
        if(typeof el.load==='function')el.load();
      }catch(error){console.warn('Lokale Mediendatei nicht gefunden:',path,error)}
    }
    document.addEventListener('DOMContentLoaded',()=>{
      document.querySelectorAll('[data-mf-resource]').forEach(loadMedia);
    });
    document.addEventListener('click',event=>{
      const anchor=event.target?.closest?.('a[href]');if(!anchor||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const href=anchor.getAttribute('href');if(!href||href.startsWith('#'))return;
      let file;try{file=pathOf(href)}catch(_){event.preventDefault();return}
      if(/\\.(?:html?|xhtml)$/i.test(file)){
        event.preventDefault();parent.postMessage({type:'mindfagg-vfs-navigate',token,path:file},'*');
      }
    },true);
    window.mindfaggVirtualPath=virtualBase;
  })();`;
}
function htmlPreviewCompile(path,files,token,warnings){
  const entry=files.get(path);
  if(!entry||!docIsText(entry))throw Error('HTML-Datei nicht gefunden: '+path);
  const parsed=new DOMParser().parseFromString(entry.content||'','text/html');
  // Untrusted DOM is never attached to the parent document.
  parsed.querySelectorAll('base,meta[http-equiv]').forEach(el=>{
    if(el.tagName==='BASE'||['refresh','content-security-policy'].includes((el.getAttribute('http-equiv')||'').toLowerCase()))el.remove();
  });
  const modules=new Map(),visiting=new Set();
  for(const link of [...parsed.querySelectorAll('link[href]')]){
    const rel=(link.getAttribute('rel')||'').toLowerCase();
    const target=htmlPreviewResolve(link.getAttribute('href'),path),asset=target&&files.get(target);
    if(rel.split(/\s+/).includes('stylesheet')){
      const style=parsed.createElement('style');
      if(asset)style.textContent=htmlPreviewStylesheet(target,files,new Set(),warnings);
      else warnings.add('Stylesheet nicht gefunden: '+link.getAttribute('href'));
      if(link.media)style.setAttribute('media',link.media);
      link.replaceWith(style);
    }else if(rel.split(/\s+/).some(x=>['modulepreload','preload','prefetch','preconnect','dns-prefetch'].includes(x)))link.remove();
    else if(asset)link.setAttribute('href',htmlPreviewDataUrl(asset));
  }
  for(const style of parsed.querySelectorAll('style')){
    if(style.textContent)style.textContent=htmlPreviewInlineCss(style.textContent,path,files,warnings);
  }
  for(const script of parsed.querySelectorAll('script')){
    const type=(script.getAttribute('type')||'').trim().toLowerCase();
    if(type&&!['module','text/javascript','application/javascript'].includes(type))continue;
    const src=script.getAttribute('src');
    if(src){
      const target=htmlPreviewResolve(src,path),file=target&&files.get(target);
      script.removeAttribute('src');script.removeAttribute('integrity');script.removeAttribute('crossorigin');
      if(file&&docIsText(file)){
        const url=type==='module'?htmlPreviewModule(target,files,modules,visiting,warnings):htmlPreviewDataUrl(file);
        if(url)script.setAttribute('src',url);
      }else warnings.add('Script nicht gefunden: '+src);
    }else if(type==='module')script.textContent=htmlPreviewRewriteImports(script.textContent,path,files,modules,visiting,warnings);
  }
  // Static images are data URLs; media are requested after DOMContentLoaded and
  // converted into Blob URLs *inside* the opaque-origin frame for larger files.
  for(const element of parsed.querySelectorAll('img,source,audio,video,track,input[type="image"]')){
    const raw=element.getAttribute('src');if(!raw)continue;
    const target=htmlPreviewResolve(raw,path),asset=target&&files.get(target);
    if(!asset)continue;
    if(['AUDIO','VIDEO','SOURCE','TRACK'].includes(element.tagName)||htmlPreviewFileBytes(asset).length>HTML_PREVIEW_MAX_INLINE){
      element.removeAttribute('src');element.setAttribute('data-mf-resource',target);
    }else element.setAttribute('src',htmlPreviewDataUrl(asset));
  }
  for(const element of parsed.querySelectorAll('[poster]')){
    const target=htmlPreviewResolve(element.getAttribute('poster'),path),asset=target&&files.get(target);
    if(asset)element.setAttribute('poster',htmlPreviewDataUrl(asset));
  }
  for(const element of parsed.querySelectorAll('[style]')){
    element.setAttribute('style',htmlPreviewInlineCss(element.getAttribute('style'),path,files,warnings));
  }
  // Protect from external network, plugins, nested frames and arbitrary forms.
  const policy=parsed.createElement('meta');policy.setAttribute('http-equiv','Content-Security-Policy');
  policy.setAttribute('content',"default-src 'none'; script-src data: blob: 'unsafe-inline' 'unsafe-eval'; style-src data: blob: 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'");
  const bootstrap=parsed.createElement('script');bootstrap.textContent=htmlPreviewBootstrap(path,token);
  parsed.head.prepend(bootstrap);parsed.head.prepend(policy);
  return '<!doctype html>\n'+parsed.documentElement.outerHTML;
}
function htmlPreviewInlineCss(css,path,files,warnings){
  const copy=new Map(files);copy.set(path,{path,fileType:'script',content:css});
  return htmlPreviewStylesheet(path,copy,new Set(),warnings);
}
function htmlPreviewLog(level,text,path=htmlPreviewCurrentPath){
  if(!['log','info','warn','error','debug'].includes(level))level='log';
  htmlPreviewLogs.push({id:++htmlPreviewLogSerial,level,text:String(text||'').slice(0,8000),path,time:Date.now()});
  if(htmlPreviewLogs.length>HTML_PREVIEW_LOG_LIMIT)htmlPreviewLogs.splice(0,htmlPreviewLogs.length-HTML_PREVIEW_LOG_LIMIT);
  if(htmlPreviewStorageBlockedError(text))htmlPreviewSetConsoleOpen(true);
  if(!htmlPreviewConsoleRenderPending){
    htmlPreviewConsoleRenderPending=true;
    requestAnimationFrame(()=>{htmlPreviewConsoleRenderPending=false;htmlPreviewRenderLogs()});
  }
}
function htmlPreviewLogText(log){
  const timestamp=new Date(log.time).toLocaleTimeString('de-DE');
  return `[${timestamp}] [${log.level.toUpperCase()}] ${log.path}\n${log.text}`;
}
function htmlPreviewRenderLogs(){
  const count=$('#htmlPreviewConsoleCount'),list=$('#htmlPreviewConsoleList');
  if(count)count.textContent=String(htmlPreviewLogs.length);
  if(!list)return;
  const nearBottom=list.scrollHeight-list.scrollTop-list.clientHeight<55;
  list.innerHTML=htmlPreviewLogs.length?htmlPreviewLogs.map(item=>`<div class="html-preview-log html-preview-log-${item.level}">
    <div class="html-preview-log-meta"><time>${escapeHtml(new Date(item.time).toLocaleTimeString('de-DE'))}</time>
      <span class="html-preview-log-level">${escapeHtml(item.level.toUpperCase())}</span>
      <span class="html-preview-log-path" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</span>
      <button type="button" class="html-preview-log-copy" data-html-log-copy="${item.id}" aria-label="Meldung kopieren" title="Meldung kopieren">Kopieren</button>
    </div><pre>${escapeHtml(item.text)}</pre>
    ${htmlPreviewStorageBlockedError(item.text)?`<p class="html-preview-storage-note">Browser-Speicherzugriff ist in der isolierten Vorschau dauerhaft gesperrt. Die Projekte, Zugangsdaten und Daten der Hauptanwendung bleiben geschützt.</p>`:''}
  </div>`).join(''):'<p class="html-preview-console-empty">Noch keine Konsolenmeldungen.</p>';
  if(nearBottom)list.scrollTop=list.scrollHeight;
}
async function htmlPreviewCopyLog(id){
  const entry=htmlPreviewLogs.find(item=>item.id===id);if(!entry)return;
  const value=htmlPreviewLogText(entry);
  let copied=false;
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(value);copied=true}catch(_){/* browser permission fallback */}
  }
  if(!copied){
    const field=document.createElement('textarea');field.value=value;
    field.setAttribute('readonly','');field.style.position='fixed';field.style.left='-9999px';
    document.body.appendChild(field);
    try{field.select();copied=document.execCommand('copy')}catch(_){copied=false}
    finally{field.remove()}
  }
  toast(copied?'Konsolenmeldung kopiert':'Kopieren nicht möglich');
}
function htmlPreviewSetConsoleOpen(open){
  htmlPreviewConsoleOpen=Boolean(open);
  $('#htmlPreviewConsolePanel')?.classList.toggle('hidden',!htmlPreviewConsoleOpen);
  const button=$('#htmlPreviewConsoleToggle');
  if(button)button.setAttribute('aria-expanded',String(htmlPreviewConsoleOpen));
  if(htmlPreviewConsoleOpen){
    htmlPreviewRenderLogs();
    const list=$('#htmlPreviewConsoleList');if(list)list.scrollTop=list.scrollHeight;
  }
}
function htmlPreviewUpdateFullscreenButton(){
  const root=$('#htmlPreviewRoot'),button=$('#htmlPreviewFullscreen');if(!root||!button)return;
  const on=document.fullscreenElement===root||root.classList.contains('html-preview-fullscreen-fallback');
  button.setAttribute('aria-pressed',String(on));
  button.setAttribute('aria-label',on?'Vollbild verlassen':'Vollbild anzeigen');
  button.title=on?'Vollbild verlassen':'Vollbild anzeigen';
  button.textContent=on?'⤢':'⛶';
}
async function htmlPreviewToggleFullscreen(){
  const root=$('#htmlPreviewRoot');if(!root)return;
  if(document.fullscreenElement===root){
    try{await document.exitFullscreen()}catch(error){console.error(error);toast('Vollbild konnte nicht geschlossen werden')}
  }else if(root.classList.contains('html-preview-fullscreen-fallback')){
    root.classList.remove('html-preview-fullscreen-fallback');htmlPreviewUpdateFullscreenButton();
  }else{
    if(typeof root.requestFullscreen==='function'){
      try{await root.requestFullscreen();htmlPreviewUpdateFullscreenButton();return}
      catch(error){console.warn('Native Vollbildanzeige nicht verfügbar:',error)}
    }
    // CSS fallback for mobile browsers without the Fullscreen API.
    root.classList.add('html-preview-fullscreen-fallback');htmlPreviewUpdateFullscreenButton();
  }
}
if(!htmlPreviewToggleFullscreen.initialized){
  htmlPreviewToggleFullscreen.initialized=true;
  document.addEventListener('fullscreenchange',htmlPreviewUpdateFullscreenButton);
  document.addEventListener('keydown',event=>{
    const root=$('#htmlPreviewRoot');
    if(event.key==='Escape'&&root?.classList.contains('html-preview-fullscreen-fallback')){
      root.classList.remove('html-preview-fullscreen-fallback');htmlPreviewUpdateFullscreenButton();
    }
  });
}
function htmlPreviewInstallBroker(){
  if(htmlPreviewInstallBroker.installed)return;
  htmlPreviewInstallBroker.installed=true;
  window.addEventListener('message',event=>{
    const frame=htmlPreviewFrame,data=event.data;
    if(!frame||!frame.isConnected||event.source!==frame.contentWindow||!data||data.token!==htmlPreviewToken)return;
    if(data.type==='mindfagg-preview-log'){
      if(typeof data.text==='string')htmlPreviewLog(data.level,data.text,htmlPreviewCurrentPath);
    }else if(data.type==='mindfagg-vfs-read'){
      const path=workspaceValidPath(data.path),file=path&&htmlPreviewFiles().get(path);
      const result=file?{type:'mindfagg-vfs-result',token:htmlPreviewToken,id:data.id,
        mime:htmlPreviewMime(path),bytes:htmlPreviewFileBytes(file).slice()}:
        {type:'mindfagg-vfs-result',token:htmlPreviewToken,id:data.id,error:'Datei nicht gefunden: '+String(data.path).slice(0,200)};
      try{event.source.postMessage(result,'*',result.bytes?[result.bytes.buffer]:[])}
      catch(error){console.warn('Vorschau-Dateianfrage fehlgeschlagen:',error)}
    }else if(data.type==='mindfagg-vfs-navigate'){
      const path=workspaceValidPath(data.path),file=path&&htmlPreviewFiles().get(path);
      if(!file||!isHtmlScriptFile(file))return;
      htmlPreviewBackStack.push(htmlPreviewCurrentPath);
      htmlPreviewCurrentPath=path;
      htmlPreviewLoad();
    }
  });
}
function htmlPreviewLoad(){
  const area=$('#htmlPreviewArea'),entry=documentNow();
  if(!area||!entry||!isHtmlScriptFile(entry)||activeFilePanel!=='preview')return;
  const path=htmlPreviewCurrentPath,files=htmlPreviewFiles(),warnings=new Set();
  htmlPreviewToken=uid();
  let html;
  try{html=htmlPreviewCompile(path,files,htmlPreviewToken,warnings)}
  catch(error){area.innerHTML=`<div class="html-preview-unavailable"><h2>Vorschau nicht verfügbar</h2><p>${escapeHtml(error.message)}</p></div>`;htmlPreviewLog('error',error.message,path);return}
  const frame=document.createElement('iframe');
  frame.id='htmlPreviewFrame';frame.className='html-preview-frame';
  frame.title='Isolierte HTML-Vorschau: '+path;
  // Force an opaque origin, even if older preferences enabled same-origin
  // storage in earlier versions. This is a non-configurable security boundary.
  frame.setAttribute('sandbox','allow-scripts');
  frame.referrerPolicy='no-referrer';
  htmlPreviewFrame=frame;
  frame.srcdoc=html;
  area.replaceChildren(frame);
  const loc=$('#htmlPreviewLocation');if(loc){loc.textContent=path;loc.title=path}
  const state=$('#htmlPreviewState');if(state){
    state.textContent=warnings.size?`Isolierte Vorschau · ${warnings.size} Ressource(n) eingeschränkt`:'Isolierte Vorschau';
  }
  const back=$('#htmlPreviewBack');if(back)back.disabled=htmlPreviewBackStack.length===0;
  if(warnings.size)for(const warning of warnings)htmlPreviewLog('warn',warning,path);
}
function renderHtmlPreview(){
  const doc=documentNow();if(!doc||!isHtmlScriptFile(doc))return;
  ++htmlPreviewGeneration;
  if(htmlPreviewEntryId!==doc.id){
    htmlPreviewEntryId=doc.id;htmlPreviewCurrentPath=workspacePath(doc);htmlPreviewBackStack=[];
    htmlPreviewLogs=[];htmlPreviewLogSerial=0;htmlPreviewConsoleOpen=false;
  }
  htmlPreviewInstallBroker();
  $('#surface').innerHTML=`<div class="html-preview" id="htmlPreviewRoot">
    <div class="html-preview-toolbar">
      <span class="html-preview-location" id="htmlPreviewLocation" title="${escapeHtml(htmlPreviewCurrentPath)}">${escapeHtml(htmlPreviewCurrentPath)}</span>
      <span class="html-preview-state" id="htmlPreviewState" role="status">Isolierte Vorschau</span>
      <button type="button" class="btn html-preview-back" id="htmlPreviewBack" title="Zur vorherigen HTML-Seite">← Zurück</button>
      <button type="button" class="btn html-preview-reload" id="htmlPreviewReload" title="HTML und Workspace-Ressourcen neu laden">↻ Neu laden</button>
      <button type="button" class="btn html-preview-console-toggle" id="htmlPreviewConsoleToggle" aria-controls="htmlPreviewConsolePanel" aria-expanded="${htmlPreviewConsoleOpen}" title="Fehlerkonsole anzeigen">Konsole <span id="htmlPreviewConsoleCount">${htmlPreviewLogs.length}</span></button>
      <button type="button" class="btn html-preview-fullscreen" id="htmlPreviewFullscreen" aria-label="Vollbild anzeigen" aria-pressed="false" title="Vollbild anzeigen">⛶</button>
    </div><div class="html-preview-area" id="htmlPreviewArea"></div>
    <section class="html-preview-console ${htmlPreviewConsoleOpen?'':'hidden'}" id="htmlPreviewConsolePanel" aria-label="Fehlerkonsole">
      <div class="html-preview-console-heading"><strong>Fehlerkonsole</strong><span>Letzte 100 Meldungen</span>
        <button type="button" class="btn" id="htmlPreviewConsoleClear">Leeren</button>
        <button type="button" class="btn" id="htmlPreviewConsoleClose" aria-label="Fehlerkonsole schließen">✕</button>
      </div><div class="html-preview-console-list" id="htmlPreviewConsoleList" role="log" aria-live="off"></div>
    </section>
  </div>`;
  $('#htmlPreviewBack').onclick=()=>{
    if(!htmlPreviewBackStack.length)return;
    htmlPreviewCurrentPath=htmlPreviewBackStack.pop();htmlPreviewLoad();
  };
  $('#htmlPreviewReload').onclick=htmlPreviewLoad;
  $('#htmlPreviewFullscreen').onclick=htmlPreviewToggleFullscreen;
  $('#htmlPreviewConsoleToggle').onclick=()=>htmlPreviewSetConsoleOpen(!htmlPreviewConsoleOpen);
  $('#htmlPreviewConsoleClose').onclick=()=>htmlPreviewSetConsoleOpen(false);
  $('#htmlPreviewConsoleClear').onclick=()=>{htmlPreviewLogs=[];htmlPreviewRenderLogs()};
  $('#htmlPreviewConsoleList').onclick=event=>{
    const button=event.target.closest('[data-html-log-copy]');
    if(button)htmlPreviewCopyLog(Number(button.dataset.htmlLogCopy));
  };
  htmlPreviewSetConsoleOpen(htmlPreviewConsoleOpen);
  htmlPreviewUpdateFullscreenButton();
  htmlPreviewLoad();
}
