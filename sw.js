/* mindfagg v45 Service Worker: offline app cache plus isolated, project-local VFS.
 * The virtual route is resolved from IndexedDB on EVERY request, never from
 * CacheStorage or the network. CSP's sandbox directive protects even direct
 * navigation to a preview URL without an iframe sandbox attribute. */
'use strict';

const VERSION='mindfagg-v50';
const CORE_CACHE=`${VERSION}-core`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const VFS_ROUTE='__mindfagg_preview__/';
const VFS_PREFIX=new URL(VFS_ROUTE,self.registration.scope).pathname;
const CORE_ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './css/foundation.css',
  './markdown/editor-foundation.css',
  './ui/responsive-shell.css',
  './markdown/editor-interactions.css',
  './mindmap/canvas-foundation.css',
  './ui/node-dialogs.css',
  './mindmap/mindmap.css',
  './ui/project-components.css',
  './markdown/mobile-editor.css',
  './ui/theme.css',
  './views/kanban.css',
  './views/calendar.css',
  './workspace/files.css',
  './workspace/io.css',
  './workspace/github.css',
  './script/editor.css',
  './script/find-replace.css',
  './ui/settings.css',
  './css/code-folding.css',
  './preview/html-preview.css',
  './workspace/patch-tool.css',
  './core/state.js',
  './core/database.js',
  './core/history.js',
  './core/persistence.js',
  './core/documents.js',
  './markdown/parser.js',
  './ui/router.js',
  './markdown/nodes.js',
  './mindmap/state-layout.js',
  './mindmap/inline-edit.js',
  './mindmap/operations.js',
  './mindmap/interactions.js',
  './core/code-folding.js',
  './markdown/highlight.js',
  './markdown/controls.js',
  './markdown/completions.js',
  './markdown/commands.js',
  './markdown/editor.js',
  './workspace/files.js',
  './preview/html-preview.js',
  './ui/settings.js',
  './vendor/prism.min.js',
  './vendor/acorn.js',
  './script/functions.js',
  './script/validators.js',
  './script/find-replace.js',
  './script/pretty-code.js',
  './script/editor.js',
  './views/kanban.js',
  './views/calendar.js',
  './ui/dialogs.js',
  './workspace/io.js',
  './workspace/github.js',
  './workspace/patch-tool.js',
  './ui/browser-back.js',
  './ui/bindings.js',
  './core/service-worker.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CORE_CACHE)
    .then(cache=>cache.addAll(CORE_ASSETS).catch(err=>{
      console.warn('[SW] Einige Core-Assets konnten nicht gecacht werden:',err);
    })).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CORE_CACHE&&k!==RUNTIME_CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});

const VFS_MIME={
  html:'text/html',htm:'text/html',xhtml:'application/xhtml+xml',
  css:'text/css',js:'text/javascript',mjs:'text/javascript',cjs:'text/javascript',
  json:'application/json',jsonc:'application/json',xml:'application/xml',svg:'image/svg+xml',
  txt:'text/plain',text:'text/plain',md:'text/markdown',markdown:'text/markdown',
  csv:'text/csv',tsv:'text/tab-separated-values',webmanifest:'application/manifest+json',
  png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',
  bmp:'image/bmp',avif:'image/avif',ico:'image/x-icon',apng:'image/apng',
  mp3:'audio/mpeg',wav:'audio/wav',wave:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',
  opus:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',
  weba:'audio/webm',aif:'audio/aiff',aiff:'audio/aiff',mid:'audio/midi',midi:'audio/midi',
  mp4:'video/mp4',m4v:'video/mp4',webm:'video/webm',ogv:'video/ogg',mov:'video/quicktime',
  woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',eot:'application/vnd.ms-fontobject',
  wasm:'application/wasm',pdf:'application/pdf'
};
const VFS_TEXT_TYPES=new Set(['html','htm','xhtml','css','js','mjs','cjs','json','jsonc','xml','svg','txt','text','md','markdown','csv','tsv','webmanifest']);
const VFS_ENCODER=new TextEncoder();

function vfsMime(path){
  const base=path.split('/').pop(),dot=base.lastIndexOf('.');
  const extension=dot<0?'':base.slice(dot+1).toLowerCase();
  const type=VFS_MIME[extension]||'application/octet-stream';
  return VFS_TEXT_TYPES.has(extension)?type+'; charset=utf-8':type;
}
function vfsBytes(doc){
  if(typeof doc.content==='string'&&['script','markdown'].includes(doc.fileType))return VFS_ENCODER.encode(doc.content);
  if(typeof doc.content==='string'&&!doc.fileType)return VFS_ENCODER.encode(doc.content);
  const raw=doc.data??doc.raw;
  if(raw instanceof Uint8Array)return raw;
  if(raw instanceof ArrayBuffer)return new Uint8Array(raw);
  if(ArrayBuffer.isView(raw))return new Uint8Array(raw.buffer,raw.byteOffset,raw.byteLength);
  if(typeof doc.content==='string')return VFS_ENCODER.encode(doc.content);
  return new Uint8Array();
}
function vfsLookup(projectId,path){
  return new Promise((resolve,reject)=>{
    const open=indexedDB.open('mindfagg-db');
    open.onerror=()=>reject(open.error||new Error('IndexedDB nicht erreichbar'));
    open.onsuccess=()=>{
      const db=open.result;
      let transaction;
      try{transaction=db.transaction(['projects','docs'],'readonly')}
      catch(error){db.close();reject(error);return}
      let foundProject=false,foundDoc=null;
      const projectRequest=transaction.objectStore('projects').get(projectId);
      projectRequest.onsuccess=()=>{foundProject=Boolean(projectRequest.result)};
      const cursorRequest=transaction.objectStore('docs').openCursor();
      cursorRequest.onsuccess=()=>{
        const cursor=cursorRequest.result;
        if(!cursor)return;
        const doc=cursor.value;
        const filePath=typeof doc.path==='string'&&doc.path?doc.path:(doc.name||'Projekt').replace(/[\\/]/g,'_')+'.md';
        if(doc.projectId===projectId&&filePath===path){foundDoc=doc;return}
        cursor.continue();
      };
      transaction.oncomplete=()=>{db.close();resolve(foundProject?foundDoc:null)};
      transaction.onerror=()=>{db.close();reject(transaction.error||new Error('Workspace-Lesevorgang fehlgeschlagen'))};
      transaction.onabort=()=>{db.close();reject(transaction.error||new Error('Workspace-Lesevorgang abgebrochen'))};
    };
  });
}
function vfsRequestPath(url){
  const raw=url.pathname.slice(VFS_PREFIX.length).split('/');
  if(!raw.length||!raw[0])return null;
  let segments;
  try{segments=raw.map(decodeURIComponent)}catch(_){return null}
  if(segments.some(segment=>segment==='.'||segment==='..'||segment.includes('/')||segment.includes('\\')||/[\x00-\x1f\x7f]/.test(segment)))return null;
  const projectId=segments.shift();
  if(!projectId||projectId.length>180)return null;
  const path=segments.filter(Boolean).join('/')+(segments.at(-1)===''?'/':'');
  return {projectId,path:path.endsWith('/')?path+'index.html':path||'index.html'};
}
function vfsHeaders(path){
  const origin=self.location.origin;
  const headers=new Headers({
    'Content-Type':vfsMime(path),
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET, HEAD, OPTIONS',
    'Cross-Origin-Resource-Policy':'cross-origin',
    'Accept-Ranges':'bytes'
  });
  // The sandbox DIRECTIVE is essential: opening the VFS URL in a normal tab
  // must never promote imported JavaScript to mindfagg's same-origin privileges.
  if(/\.(?:html?|xhtml|svg|xml)$/i.test(path)){
    const allowed=origin;
    headers.set('Content-Security-Policy',[
      'sandbox allow-scripts',
      "default-src 'none'",
      `script-src ${allowed} blob: 'unsafe-inline' 'unsafe-eval'`,
      `style-src ${allowed} blob: 'unsafe-inline'`,
      `img-src ${allowed} blob: data:`,
      `media-src ${allowed} blob: data:`,
      `font-src ${allowed} blob: data:`,
      `connect-src ${allowed}`,
      `base-uri ${allowed}`,
      "frame-src 'none'",
      "object-src 'none'",
      "worker-src 'none'",
      "form-action 'none'"
    ].join('; '));
    headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  }
  return headers;
}
function vfsError(code,message,path='error.txt'){
  return new Response(message,{status:code,headers:vfsHeaders(path)});
}
async function vfsRespond(request,url){
  const info=vfsRequestPath(url);
  if(!info)return vfsError(400,'Ungültiger Workspace-Pfad');
  const headers=vfsHeaders(info.path);
  if(request.method==='OPTIONS'){
    const requested=request.headers.get('Access-Control-Request-Headers');
    if(requested)headers.set('Access-Control-Allow-Headers',requested);
    return new Response(null,{status:204,headers});
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return vfsError(405,'Nur lesender Zugriff auf Workspace-Dateien.');
  let doc;
  try{doc=await vfsLookup(info.projectId,info.path)}
  catch(error){console.error('[VFS]',error);return vfsError(503,'Virtuelles Dateisystem nicht verfügbar. Bitte Vorschau erneut öffnen.');}
  if(!doc)return vfsError(404,'Datei im Workspace nicht gefunden: '+info.path,info.path);
  const bytes=vfsBytes(doc),size=bytes.byteLength;
  let start=0,end=size?size-1:0,status=200;
  const range=request.headers.get('Range');
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if(!match||(!match[1]&&!match[2])){
      headers.set('Content-Range',`bytes */${size}`);
      return new Response(null,{status:416,headers});
    }
    if(!match[1]){const tail=Number(match[2]);start=Math.max(0,size-tail)}
    else start=Number(match[1]);
    if(match[1]&&match[2])end=Math.min(size-1,Number(match[2]));
    if(!Number.isSafeInteger(start)||start>=size||end<start||!Number.isSafeInteger(end)){
      headers.set('Content-Range',`bytes */${size}`);
      return new Response(null,{status:416,headers});
    }
    status=206;
    headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
  }
  const slice=status===206?bytes.slice(start,end+1):bytes;
  headers.set('Content-Length',String(slice.byteLength));
  return new Response(request.method==='HEAD'?null:slice,{status,headers});
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // ALWAYS route VFS first, including its 404 and navigation cases. No cache fallback.
  if(url.pathname.startsWith(VFS_PREFIX)){
    event.respondWith(vfsRespond(request,url));return;
  }
  if(request.method!=='GET')return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();
      caches.open(RUNTIME_CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
      return response;
    }).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{
    if(cached){
      fetch(request).then(response=>{
        if(response&&response.ok)caches.open(RUNTIME_CACHE).then(cache=>cache.put(request,response.clone()));
      }).catch(()=>{});
      return cached;
    }
    return fetch(request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(RUNTIME_CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match('./index.html'));
  }));
});
self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
