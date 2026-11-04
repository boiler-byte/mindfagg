'use strict';
// mindfagg v34: app-wide, locally encrypted GitHub credential; one repository
// and a three-way synchronization baseline per project. Never force-push.
const GITHUB_MAX_FILE=20*1024*1024;
const GITHUB_MAX_PULL=80*1024*1024;
const GITHUB_MAX_PULL_FILES=750;
const GITHUB_MAX_PUSH=80*1024*1024;
const GITHUB_SECRET_KEY='github-aes-key';
const GITHUB_SECRET_RECORD='github-credential';
let githubCredentialToken=null,githubCredentialAccount='',githubCredentialError='';
let githubBusy=false,githubReview=null;
const githubProjectStatuses=new Map(),githubLocalTimers=new Map();
let githubStatusSerial=0;

function githubConnection(p=project()){
  const value=p?.github;
  return value&&typeof value.owner==='string'&&typeof value.repo==='string'&&typeof value.branch==='string'?value:null;
}
function githubNormalizeRepository(raw){
  const trimmed=String(raw||'').trim().replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/\.git$/i,'');
  const parts=trimmed.split('/');
  if(parts.length!==2||!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(parts[0])||!/^[A-Za-z0-9_.-]+$/.test(parts[1])||parts[1]==='.'||parts[1]==='..'){
    throw Error('Repository als owner/repo oder https://github.com/owner/repo angeben.');
  }
  return {owner:parts[0],repo:parts[1]};
}
function githubNormalizeBranch(raw){
  const branch=String(raw||'main').trim();
  if(branch.length>200||!branch||branch.startsWith('/')||branch.endsWith('/')||branch.endsWith('.')||
    /(?:\.\.|\/\/|@\{|\.lock(?:\/|$))/.test(branch)||!(/^[\w./-]+$/.test(branch))||
    branch.split('/').some(segment=>!segment||segment.startsWith('.')||segment.endsWith('.'))){
    throw Error('Ungültiger Branch-Name. Standard ist main.');
  }
  return branch;
}
function githubRepoApiPath(cfg){return '/repos/'+encodeURIComponent(cfg.owner)+'/'+encodeURIComponent(cfg.repo)}
function githubRefPath(cfg){return '/git/ref/heads/'+cfg.branch.split('/').map(encodeURIComponent).join('/')}
async function githubApi(token,path,method='GET',body){
  if(!token)throw Error('GitHub-Zugangsdaten in den App-Einstellungen hinterlegen.');
  let response;
  try{
    response=await fetch('https://api.github.com'+path,{
      method,mode:'cors',cache:'no-store',referrerPolicy:'no-referrer',
      headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token,
        ...(body===undefined?{}:{'Content-Type':'application/json'})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})
    });
  }catch(error){
    const failure=new Error('GitHub nicht erreichbar. Lokale Änderungen wurden behalten. ('+error.message+')');
    failure.offline=true;throw failure;
  }
  let payload=null;
  try{payload=await response.json()}catch(_){}
  if(!response.ok){
    const reason=String(payload?.message||'GitHub-Anfrage fehlgeschlagen').slice(0,220);
    let detail=reason;
    if(response.status===401)detail='Token ungültig oder abgelaufen.';
    else if(response.status===404)detail='Repository oder Branch nicht gefunden oder Zugriff fehlt.';
    else if(response.status===403)detail='Zugriff verweigert. Token-Rechte, Branch-Schutz oder Rate-Limit prüfen.';
    else if(response.status===409||response.status===422)detail='GitHub-Konflikt: '+reason;
    const error=new Error('GitHub '+response.status+': '+detail);
    error.status=response.status;throw error;
  }
  return payload;
}
function githubRequest(cfg,token,path,method='GET',body){return githubApi(token,githubRepoApiPath(cfg)+path,method,body)}

// A non-exportable AES-GCM CryptoKey and its ciphertext are kept in the local
// IndexedDB settings store, never in project records, ZIPs or CacheStorage.
// This protects against plaintext token disclosure at rest, NOT compromised
// scripts on the same origin or access to an unlocked browser profile.
async function githubRestoreCredentials(){
  try{
    if(!crypto?.subtle)throw Error('Für gespeicherte Zugangsdaten ist HTTPS oder localhost erforderlich.');
    const keyRow=await req(tx('settings').get(GITHUB_SECRET_KEY));
    const secretRow=await req(tx('settings').get(GITHUB_SECRET_RECORD));
    if(!secretRow){githubCredentialToken=null;githubCredentialAccount='';return}
    if(!keyRow?.value)throw Error('Verschlüsselungsschlüssel ist nicht verfügbar.');
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:secretRow.iv},keyRow.value,secretRow.cipher);
    githubCredentialToken=new TextDecoder().decode(plaintext);
    githubCredentialAccount=String(secretRow.account||'');githubCredentialError='';
  }catch(error){
    githubCredentialToken=null;githubCredentialAccount='';githubCredentialError=error.message;
    console.warn('GitHub-Zugangsdaten konnten nicht geladen werden:',error.message);
  }
}
async function githubSaveCredentials(token){
  const raw=String(token||'').trim();if(!raw)throw Error('GitHub-Token eingeben.');
  if(!crypto?.subtle)throw Error('Verschlüsselung benötigt HTTPS oder localhost.');
  // Verify before storing; an invalid token must never replace a working one.
  const user=await githubApi(raw,'/user');
  if(typeof user?.login!=='string'||!user.login)throw Error('GitHub-Benutzer konnte nicht bestätigt werden.');
  let keyRow=await req(tx('settings').get(GITHUB_SECRET_KEY));
  if(!keyRow?.value){
    const value=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await req(tx('settings','readwrite').put({key:GITHUB_SECRET_KEY,value}));keyRow={value};
  }
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},keyRow.value,new TextEncoder().encode(raw)));
  await req(tx('settings','readwrite').put({key:GITHUB_SECRET_RECORD,iv,cipher,account:user.login,savedAt:Date.now()}));
  githubCredentialToken=raw;githubCredentialAccount=user.login;githubCredentialError='';
  githubProjectStatuses.clear();githubStatusSerial++;
  githubUpdateIndicator();
  return user.login;
}
async function githubRemoveCredentials(){
  await req(tx('settings','readwrite').delete(GITHUB_SECRET_RECORD));
  githubCredentialToken=null;githubCredentialAccount='';githubCredentialError='';
  githubStatusSerial++;githubProjectStatuses.clear();githubUpdateIndicator();
}
function githubCredentialLabel(){
  return githubCredentialToken?'Verbunden als @'+githubCredentialAccount:githubCredentialError?'Zugangsdaten konnten nicht geladen werden: '+githubCredentialError:'Nicht angemeldet';
}

async function githubFetchSnapshot(cfg,token){
  const ref=await githubRequest(cfg,token,githubRefPath(cfg));
  const head=ref?.object?.sha;
  if(!/^[0-9a-f]{40}$/i.test(head||''))throw Error('GitHub hat keinen gültigen Commit für den Branch geliefert.');
  const commit=await githubRequest(cfg,token,'/git/commits/'+head);
  const treeSha=commit?.tree?.sha;
  if(!/^[0-9a-f]{40}$/i.test(treeSha||''))throw Error('GitHub-Commit enthält keinen gültigen Dateibaum.');
  const tree=await githubRequest(cfg,token,'/git/trees/'+treeSha+'?recursive=1');
  if(tree.truncated)throw Error('Repository-Dateibaum zu groß. Es wurde nichts geändert.');
  const files=new Map(),directories=new Set(),unsupported=new Set();
  for(const item of tree.tree||[]){
    if(!workspaceValidPath(item.path))continue;
    if(item.type==='tree'){directories.add(item.path);continue}
    if(item.type==='blob'&&['100644','100755'].includes(item.mode)&&/^[0-9a-f]{40}$/i.test(item.sha||'')){
      files.set(item.path,{sha:item.sha.toLowerCase(),mode:item.mode,size:item.size||0});
    }else unsupported.add(item.path);
  }
  return {head:head.toLowerCase(),treeSha:treeSha.toLowerCase(),files,directories,unsupported};
}
async function githubBlobHash(bytes){
  if(!crypto?.subtle)throw Error('Dateivergleich benötigt HTTPS oder localhost (Web Crypto).');
  const header=new TextEncoder().encode('blob '+bytes.length+'\0');
  const gitBlob=new Uint8Array(header.length+bytes.length);
  gitBlob.set(header);gitBlob.set(bytes,header.length);
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',gitBlob));
  return [...hash].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function githubBytesBase64(bytes){
  const parts=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return btoa(parts.join(''));
}
function githubBase64Bytes(encoded){
  const binary=atob(String(encoded||'').replace(/\s/g,''));
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function githubReadBlob(cfg,token,entry,path){
  if(entry.size>GITHUB_MAX_FILE)throw Error('Datei zu groß ('+workspaceSize(entry.size)+'): '+path);
  const data=await githubRequest(cfg,token,'/git/blobs/'+entry.sha);
  if(data.encoding!=='base64'||typeof data.content!=='string')throw Error('Keine lesbaren GitHub-Dateidaten: '+path);
  const bytes=githubBase64Bytes(data.content);
  if(bytes.length>GITHUB_MAX_FILE||await githubBlobHash(bytes)!==entry.sha)throw Error('Ungültige GitHub-Prüfsumme: '+path);
  return bytes;
}
async function githubLocalFiles(p){
  const local=new Map(),folded=new Set();
  for(const doc of docs.filter(d=>d.projectId===p.id)){
    const path=workspacePath(doc),key=path.toLocaleLowerCase('de');
    if(!workspaceValidPath(path)||folded.has(key))throw Error('Doppelter oder ungültiger lokaler Pfad: '+path);
    folded.add(key);
    const bytes=exportFileBytes(doc);
    local.set(path,{doc,bytes,sha:bytes.length<=GITHUB_MAX_FILE?await githubBlobHash(bytes):null});
  }
  return local;
}
function githubTracked(cfg){
  const result=new Map();
  for(const [path,value] of Object.entries(cfg?.baseline||{})){
    if(workspaceValidPath(path)&&/^[a-f0-9]{40}$/i.test(value?.sha||'')){
      result.set(path,{sha:value.sha.toLowerCase(),mode:value.mode==='100755'?'100755':'100644'});
    }
  }
  return result;
}
function githubPathBlocked(path,snapshot){
  if(snapshot.directories.has(path)||snapshot.unsupported.has(path))return true;
  const parts=path.split('/');
  for(let i=1;i<parts.length;i++){
    const ancestor=parts.slice(0,i).join('/');
    if(snapshot.unsupported.has(ancestor)||snapshot.files.has(ancestor))return true;
  }
  return false;
}
// Three-way comparison: base is the last synchronized SHA, absent files are null.
// Untracked equal files are adopted; different first-time copies are conflicts.
// No conflict changes a file until the user explicitly picks a side.
function githubClassify(local,remote,tracked,folders=[]){
  const uploads=[],downloads=[],conflicts=[],aligned=[],blocked=[];
  const paths=new Set([...local.keys(),...remote.files.keys(),...tracked.keys()]);
  const casePaths=new Map();
  for(const path of paths){
    const lower=path.toLocaleLowerCase('de');
    if(!casePaths.has(lower))casePaths.set(lower,[]);
    casePaths.get(lower).push(path);
  }
  const localFilePaths=new Set(local.keys());
  for(const path of [...paths].sort((a,b)=>a.localeCompare(b,'de'))){
    const entry=local.get(path),upstream=remote.files.get(path),baseline=tracked.get(path);
    const localSha=entry?.sha||null,remoteSha=upstream?.sha||null,baseSha=baseline?.sha||null;
    if(casePaths.get(path.toLocaleLowerCase('de')).length>1){
      blocked.push({path,reason:'Dateinamen unterscheiden sich nur durch Groß-/Kleinschreibung.'});continue;
    }
    if(githubPathBlocked(path,remote)||folders.includes(path)||[...localFilePaths].some(name=>name!==path&&name.startsWith(path+'/'))){
      blocked.push({path,reason:'Dateipfad kollidiert mit einem Ordner, Link oder Submodul.'});continue;
    }
    if(entry&&!localSha){blocked.push({path,reason:'Lokale Datei ist größer als '+workspaceSize(GITHUB_MAX_FILE)+'.'});continue}
    if(upstream&&upstream.size>GITHUB_MAX_FILE&&localSha!==remoteSha){
      blocked.push({path,reason:'GitHub-Datei ist größer als '+workspaceSize(GITHUB_MAX_FILE)+'.'});continue;
    }
    if(localSha===remoteSha){aligned.push({path,sha:localSha,mode:upstream?.mode||baseline?.mode||'100644'});continue}
    const localChanged=localSha!==baseSha,remoteChanged=remoteSha!==baseSha;
    if(localChanged&&remoteChanged){
      conflicts.push({path,reason:baseSha?'Beide Seiten seit dem letzten Abgleich geändert.':'Beide Seiten enthalten unterschiedliche Dateien.',
        local:entry||null,remote:upstream||null,baseline:baseline||null});
    }else if(localChanged){
      uploads.push({path,type:localSha?(upstream?'modify':'add'):'delete',sha:localSha,
        bytes:entry?.bytes||null,mode:upstream?.mode||baseline?.mode||'100644'});
    }else if(remoteChanged){
      downloads.push({path,type:remoteSha?'upsert':'delete',remote:upstream||null,local:entry||null});
    }
  }
  return {uploads,downloads,conflicts,aligned,blocked,local,remote,tracked};
}
async function githubBuildPlan(p,remote){
  const local=await githubLocalFiles(p),tracked=githubTracked(githubConnection(p));
  return githubClassify(local,remote,tracked,workspaceFolderPaths(p));
}
function githubPlanSignature(plan){
  return JSON.stringify([plan.remote.head,
    [...plan.local].map(([path,item])=>[path,item.sha,item.bytes.length]).sort((a,b)=>a[0].localeCompare(b[0])),
    [...plan.tracked].map(([path,item])=>[path,item.sha]).sort((a,b)=>a[0].localeCompare(b[0])),
    plan.uploads.map(x=>[x.path,x.type,x.sha]),plan.downloads.map(x=>[x.path,x.type,x.remote?.sha]),
    plan.conflicts.map(x=>[x.path,x.local?.sha,x.remote?.sha]),plan.blocked.map(x=>x.path)]);
}
function githubLocalDelta(p,local){
  const tracked=githubTracked(githubConnection(p));let changes=0;
  for(const [path,entry] of local){if(!entry.sha||entry.sha!==tracked.get(path)?.sha)changes++}
  for(const path of tracked.keys())if(!local.has(path))changes++;
  return changes;
}
function githubSetProjectStatus(p,status){
  if(!p)return;
  githubProjectStatuses.set(p.id,{...status,at:Date.now()});
  if(projectId===p.id)githubUpdateIndicator(p);
}
function githubStatusText(p){
  if(!p)return 'Kein Projekt';
  if(!githubConnection(p))return 'Repository zuordnen';
  if(!githubCredentialToken)return 'GitHub anmelden';
  const s=githubProjectStatuses.get(p.id);
  if(!s)return 'Noch nicht geprüft';
  switch(s.kind){
    case 'busy':return 'Synchronisiere …';
    case 'checking':return 'Prüfe Änderungen …';
    case 'conflict':return s.count>1?s.count+' Konflikte erkannt':'Konflikt erkannt';
    case 'offline':return 'GitHub nicht erreichbar';
    case 'error':return 'GitHub-Fehler';
    case 'local':return s.count+' lokale '+(s.count===1?'Änderung':'Änderungen');
    case 'remote':return s.count+' GitHub-'+(s.count===1?'Änderung':'Änderungen');
    case 'both':return s.local+' lokal · '+s.remote+' GitHub';
    case 'synced':return 'Synchronisiert';
    default:return 'Noch nicht geprüft';
  }
}
function githubUpdateIndicator(p=project()){
  const button=$('#githubSync');if(!button)return;
  const cfg=githubConnection(p),status=githubProjectStatuses.get(p?.id);
  const label=githubStatusText(p),text=$('#githubSyncText');if(text)text.textContent=label;
  button.disabled=!p||githubBusy;
  button.classList.toggle('github-connected',Boolean(cfg));
  button.dataset.state=!p?'none':!cfg?'unconfigured':!githubCredentialToken?'auth':status?.kind||'unknown';
  button.title=(cfg?cfg.owner+'/'+cfg.repo+' ('+cfg.branch+') · ':'')+label+' – klicken zum Synchronisieren';
  button.setAttribute('aria-label',button.title);
}
function githubStatusFromPlan(plan){
  if(plan.blocked.length)return {kind:'error',message:plan.blocked.length+' nicht synchronisierbare Pfade'};
  if(plan.conflicts.length)return {kind:'conflict',count:plan.conflicts.length};
  if(plan.uploads.length&&plan.downloads.length)return {kind:'both',local:plan.uploads.length,remote:plan.downloads.length};
  if(plan.uploads.length)return {kind:'local',count:plan.uploads.length};
  if(plan.downloads.length)return {kind:'remote',count:plan.downloads.length};
  return {kind:'synced'};
}
function githubScheduleLocalStatus(id){
  if(!id||!githubConnection(projects.find(p=>p.id===id))||githubBusy)return;
  clearTimeout(githubLocalTimers.get(id));
  githubLocalTimers.set(id,setTimeout(()=>{
    githubLocalTimers.delete(id);void githubRefreshLocalStatus(id);
  },360));
}
async function githubRefreshLocalStatus(id){
  const p=projects.find(item=>item.id===id);
  if(!p||!githubConnection(p)||!githubCredentialToken||githubBusy)return;
  try{
    const local=await githubLocalFiles(p),count=githubLocalDelta(p,local);
    const previous=githubProjectStatuses.get(id);
    if(!previous||['checking','busy','conflict','offline','error'].includes(previous.kind))return;
    if(previous.kind==='remote'||previous.kind==='both'){
      const remote=previous.remote||previous.count;
      githubSetProjectStatus(p,count?{kind:'both',local:count,remote}:{kind:'remote',count:remote});
    }else githubSetProjectStatus(p,count?{kind:'local',count}:{kind:'synced'});
  }catch(error){console.warn('Lokaler GitHub-Status:',error.message)}
}
async function githubCheckStatus(p=project()){
  if(!p||!githubConnection(p)||!githubCredentialToken||githubBusy)return;
  const serial=++githubStatusSerial,cfg=githubConnection(p);
  githubSetProjectStatus(p,{kind:'checking'});
  try{
    const remote=await githubFetchSnapshot(cfg,githubCredentialToken);
    const plan=await githubBuildPlan(p,remote);
    if(serial===githubStatusSerial&&!githubBusy&&githubConnection(p)===cfg)githubSetProjectStatus(p,githubStatusFromPlan(plan));
  }catch(error){
    if(serial===githubStatusSerial&&!githubBusy)githubSetProjectStatus(p,{kind:error.offline?'offline':'error',message:error.message});
  }
}
function githubProjectActivated(p){if(p&&githubConnection(p)&&githubCredentialToken)void githubCheckStatus(p);else githubUpdateIndicator(p)}
function githubSetBusy(value,p=project()){
  githubBusy=value;
  if(value)githubStatusSerial++;
  githubUpdateIndicator(p);
  const modal=$('#githubConflictModal');
  if(modal)for(const el of modal.querySelectorAll('button,select,input'))el.disabled=value;
}
function githubFormatDate(value){
  const millis=typeof value==='number'?value:Date.parse(value||'');
  if(!Number.isFinite(millis)||millis<=0)return 'Nicht verfügbar';
  return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(millis));
}
async function githubFillConflictDates(cfg,token,conflicts){
  const queue=conflicts.slice(0,40);let position=0;
  // Git tree entries have no per-file timestamps. GitHub's last commit touching
  // the path is the nearest reliable available source for the remote date.
  await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
    while(position<queue.length){
      const conflict=queue[position++];
      try{
        const history=await githubRequest(cfg,token,'/commits?sha='+encodeURIComponent(cfg.branch)+'&path='+encodeURIComponent(conflict.path)+'&per_page=1');
        conflict.remoteDate=history?.[0]?.commit?.committer?.date||history?.[0]?.commit?.author?.date||null;
      }catch(error){conflict.remoteDate=null}
    }
  }));
}

function openGithubDialog(){
  const p=project();if(!p)return toast('Zuerst ein Projekt auswählen');
  const cfg=githubConnection(p);setMobileMenu(false);
  openModal(`<div id="githubModal" class="github-modal">
    <h2>GitHub-Repository zuordnen</h2>
    <p>Jedes mindfagg-Projekt verwendet sein eigenes Repository und seinen eigenen Branch. Die Zugangsdaten werden zentral in den App-Einstellungen verwaltet.</p>
    <form id="githubConnectForm">
      <div class="field"><label for="githubRepository">Repository</label><input id="githubRepository" required spellcheck="false" placeholder="owner/repo" value="${cfg?escapeHtml(cfg.owner+'/'+cfg.repo):''}"></div>
      <div class="field"><label for="githubBranch">Branch</label><input id="githubBranch" required spellcheck="false" value="${escapeHtml(cfg?.branch||'main')}"></div>
      <p class="github-note" id="githubAccountState">${escapeHtml(githubCredentialLabel())}</p>
      <div class="github-actions"><button class="btn primary" id="githubConnectBtn" type="submit" ${githubCredentialToken?'':'disabled'}>${cfg?'Zuordnung prüfen':'Repository verbinden'}</button><button type="button" class="btn" id="githubAccountSettings">App-Zugangsdaten</button></div>
    </form>
    <p class="github-status" id="githubStatus" role="status" aria-live="polite">${cfg?'Aktuelle Zuordnung: '+escapeHtml(cfg.owner+'/'+cfg.repo+' · '+cfg.branch):'Noch kein Repository zugeordnet.'}</p>
    <div class="github-actions github-bottom-actions"><button type="button" class="btn delete-project" id="githubDisconnectBtn" ${cfg?'':'disabled'}>Zuordnung entfernen</button><button type="button" class="btn" id="githubSyncFromDialog" ${cfg&&githubCredentialToken?'':'disabled'}>Jetzt synchronisieren</button></div>
    <div class="modalactions"><button type="button" class="btn" id="cancelModal">Schließen</button></div>
  </div>`);
  wireCancel();
  $('#githubConnectForm').onsubmit=event=>{event.preventDefault();void githubConnect()};
  $('#githubDisconnectBtn').onclick=()=>void githubDisconnect();
  $('#githubSyncFromDialog').onclick=()=>{closeModal();void githubSyncNow()};
  $('#githubAccountSettings').onclick=()=>{closeModal();openAppSettings();document.querySelector('#appGithubToken')?.focus()};
}
function githubDialogStatus(message,error=false){
  const el=$('#githubStatus');if(el){el.textContent=message;el.classList.toggle('is-error',error)}
}
async function githubConnect(){
  if(githubBusy)return;
  const p=project();if(!p)return;
  try{
    if(!githubCredentialToken)throw Error('GitHub-Zugangsdaten in den App-Einstellungen hinterlegen.');
    const repo=githubNormalizeRepository($('#githubRepository').value),cfg={...repo,branch:githubNormalizeBranch($('#githubBranch').value)};
    const oldCfg=githubConnection(p);
    const same=oldCfg&&oldCfg.owner.toLowerCase()===cfg.owner.toLowerCase()&&oldCfg.repo.toLowerCase()===cfg.repo.toLowerCase()&&oldCfg.branch===cfg.branch;
    githubSetBusy(true,p);githubDialogStatus('Verbindung wird geprüft …');
    const snapshot=await githubFetchSnapshot(cfg,githubCredentialToken);
    const old=p.github;
    p.github={...cfg,baseline:same?(oldCfg.baseline||{}):{},lastCommit:same?oldCfg.lastCommit||null:null};
    try{await put('projects',{...p})}catch(error){p.github=old;throw error}
    githubProjectStatuses.delete(p.id);
    githubDialogStatus('Verbunden: '+cfg.owner+'/'+cfg.repo+' ('+cfg.branch+'), '+snapshot.head.slice(0,7)+'.');
    $('#githubConnectBtn').textContent='Zuordnung prüfen';
    $('#githubDisconnectBtn').disabled=false;
    $('#githubSyncFromDialog').disabled=false;
  }catch(error){console.error('GitHub-Zuordnung:',error);githubDialogStatus(error.message,true)}
  finally{githubSetBusy(false,p)}
  if(githubConnection(p))void githubCheckStatus(p);
}
async function githubDisconnect(){
  if(githubBusy)return;
  const p=project();if(!githubConnection(p))return;
  if(!confirm('Repository-Zuordnung für dieses Projekt entfernen? Lokale Dateien bleiben erhalten.'))return;
  githubSetBusy(true,p);
  try{
    const old=p.github;delete p.github;
    try{await put('projects',{...p})}catch(error){p.github=old;throw error}
    githubReview=null;githubProjectStatuses.delete(p.id);
    githubDialogStatus('Zuordnung entfernt. Lokale Dateien unverändert.');
    $('#githubDisconnectBtn').disabled=true;$('#githubSyncFromDialog').disabled=true;
  }catch(error){githubDialogStatus(error.message,true)}finally{githubSetBusy(false,p)}
}
function githubConflictCard(item,i){
  const local=item.local,remote=item.remote;
  const localSize=local?workspaceSize(local.bytes.length):'Datei nicht vorhanden';
  const remoteSize=remote?workspaceSize(remote.size):'Datei nicht vorhanden';
  const localDate=local?githubFormatDate(local.doc.updatedAt||local.doc.created||0):'–';
  const remoteDate=remote?githubFormatDate(item.remoteDate):'–';
  return `<article class="github-conflict-card">
    <div class="github-conflict-heading"><strong>${escapeHtml(item.path)}</strong><small>${escapeHtml(item.reason)}</small></div>
    <div class="github-comparison">
      <div class="github-comparison-side"><strong>Dieser Computer</strong><span>${escapeHtml(localSize)}</span><small>Geändert: ${escapeHtml(localDate)}</small></div>
      <div class="github-comparison-side"><strong>GitHub</strong><span>${escapeHtml(remoteSize)}</span><small>Geändert: ${escapeHtml(remoteDate)}</small></div>
    </div>
    <label class="github-choice-label" for="githubChoice-${i}">Welche Version behalten?</label>
    <select id="githubChoice-${i}" data-github-choice="${i}" aria-label="Konflikt ${escapeHtml(item.path)} entscheiden">
      <option value="skip">Noch nicht entscheiden</option>
      <option value="local">Lokale Version behalten</option>
      <option value="remote">GitHub-Version behalten</option>
    </select>
  </article>`;
}
function githubOpenConflictDialog(review){
  const {plan}=review,projectName=project()?.name||'Projekt';
  openModal(`<section id="githubConflictModal" class="github-conflict-modal" aria-labelledby="githubConflictTitle">
    <header class="github-conflict-header"><span class="github-conflict-kicker">GitHub-Abgleich · ${escapeHtml(projectName)}</span><h2 id="githubConflictTitle">${plan.conflicts.length} ${plan.conflicts.length===1?'Dateikonflikt':'Dateikonflikte'} erkannt</h2>
      <p>Beide Versionen wurden verändert. Wähle für jede Datei die gewünschte Version. Ohne Auswahl bleibt die Datei unverändert.</p></header>
    <div class="github-conflict-tools"><span>${plan.uploads.length} lokale und ${plan.downloads.length} GitHub-Änderungen sind konfliktfrei.</span><div><button type="button" class="btn" id="githubAllLocal">Alle lokal</button><button type="button" class="btn" id="githubAllRemote">Alle GitHub</button></div></div>
    <div class="github-conflict-list">${plan.conflicts.map(githubConflictCard).join('')}</div>
    <div class="field"><label for="githubResolveCommitMessage">Commit-Nachricht (bei Upload)</label><input id="githubResolveCommitMessage" maxlength="180" value="mindfagg: Dateien synchronisieren"></div>
    <p class="github-note">Das Änderungsdatum auf GitHub ist das Datum des letzten Commits dieser Datei. Nicht verfügbare Daten werden entsprechend gekennzeichnet.</p>
    <p class="github-status" id="githubConflictStatus" aria-live="polite">Konflikte ohne Entscheidung werden übersprungen.</p>
    <div class="modalactions github-conflict-actions"><button type="button" class="btn" id="githubConflictCancel">Abbrechen</button><button type="button" class="btn primary" id="githubApplyResolutions">Auswahl übernehmen und synchronisieren</button></div>
  </section>`);
  $('#githubConflictCancel').onclick=closeModal;
  $('#githubApplyResolutions').onclick=()=>void githubResolveAndSync();
  for(const [id,value] of [['githubAllLocal','local'],['githubAllRemote','remote']]){
    $('#'+id).onclick=()=>{document.querySelectorAll('[data-github-choice]').forEach(el=>{el.value=value})};
  }
}
async function githubSyncClicked(){
  const p=project();if(!p)return;
  if(!githubConnection(p)){openGithubDialog();return}
  if(!githubCredentialToken){openAppSettings();toast('GitHub-Zugangsdaten in den App-Einstellungen hinterlegen');return}
  await githubSyncNow();
}
async function githubSyncNow(){
  if(githubBusy)return;
  const p=project(),cfg=githubConnection(p),token=githubCredentialToken;
  if(!p||!cfg||!token)return;
  githubSetBusy(true,p);githubSetProjectStatus(p,{kind:'busy'});
  try{
    await flushMapInlineEdit();await flushSource();
    const snapshot=await githubFetchSnapshot(cfg,token),plan=await githubBuildPlan(p,snapshot);
    if(plan.blocked.length)throw Error('Nicht synchronisierbare Pfade: '+plan.blocked.slice(0,4).map(x=>x.path+' ('+x.reason+')').join('; '));
    if(plan.conflicts.length){
      await githubFillConflictDates(cfg,token,plan.conflicts);
      githubReview={projectId:p.id,signature:githubPlanSignature(plan),plan};
      githubSetProjectStatus(p,{kind:'conflict',count:plan.conflicts.length});
      githubSetBusy(false,p);
      githubOpenConflictDialog(githubReview);
      return;
    }
    await githubExecutePlan({p,cfg,token,plan,choices:new Map(),message:'mindfagg: Dateien synchronisieren'});
  }catch(error){
    console.error('GitHub-Abgleich:',error);
    githubSetProjectStatus(p,{kind:error.offline?'offline':'error',message:error.message});
    toast(error.message);
  }finally{githubSetBusy(false,p)}
}
async function githubResolveAndSync(){
  if(githubBusy||!githubReview)return;
  const review=githubReview,p=project(),cfg=githubConnection(p),token=githubCredentialToken;
  if(!p||!cfg||!token||review.projectId!==p.id)return;
  const choices=new Map();
  for(const [i,conflict] of review.plan.conflicts.entries()){
    const choice=$('#githubChoice-'+i)?.value;
    if(choice==='local'||choice==='remote')choices.set(conflict.path,choice);
  }
  if(!choices.size&&!review.plan.uploads.length&&!review.plan.downloads.length){
    $('#githubConflictStatus').textContent='Bitte mindestens einen Konflikt entscheiden.';return;
  }
  const message=$('#githubResolveCommitMessage')?.value.trim();
  if(!message&&([...choices].some(([path,choice])=>choice==='local')||review.plan.uploads.length)){
    $('#githubConflictStatus').textContent='Commit-Nachricht eingeben.';return;
  }
  githubSetBusy(true,p);githubSetProjectStatus(p,{kind:'busy'});
  try{
    // Reclassify immediately before applying decisions: stale choices must not
    // overwrite newer remote or local content.
    await flushMapInlineEdit();await flushSource();
    const remote=await githubFetchSnapshot(cfg,token),plan=await githubBuildPlan(p,remote);
    if(githubPlanSignature(plan)!==review.signature)throw Error('Dateien oder GitHub-Branch haben sich geändert. Bitte erneut synchronisieren.');
    await githubExecutePlan({p,cfg,token,plan,choices,message:message||'mindfagg: Dateien synchronisieren'});
    githubReview=null;
    githubSetBusy(false,p);
    closeModal();
  }catch(error){
    console.error('GitHub-Konfliktlösung:',error);
    const el=$('#githubConflictStatus');if(el)el.textContent=error.message;
    githubSetProjectStatus(p,{kind:error.offline?'offline':'error',message:error.message});
  }finally{githubSetBusy(false,p)}
}
function githubSelectedOperations(plan,choices){
  const uploads=[...plan.uploads],downloads=[...plan.downloads],pending=[];
  for(const conflict of plan.conflicts){
    const choice=choices.get(conflict.path);
    if(choice==='local'){
      uploads.push({path:conflict.path,type:conflict.local?(conflict.remote?'modify':'add'):'delete',
        sha:conflict.local?.sha||null,bytes:conflict.local?.bytes||null,
        mode:conflict.remote?.mode||conflict.baseline?.mode||'100644'});
    }else if(choice==='remote'){
      downloads.push({path:conflict.path,type:conflict.remote?'upsert':'delete',remote:conflict.remote,local:conflict.local});
    }else pending.push(conflict);
  }
  return {uploads,downloads,pending};
}
async function githubCommitUploads(cfg,token,remote,uploads,message){
  if(!uploads.length)return remote.head;
  const size=uploads.reduce((sum,item)=>sum+(item.bytes?.length||0),0);
  if(size>GITHUB_MAX_PUSH)throw Error('Upload zu groß (max. '+workspaceSize(GITHUB_MAX_PUSH)+').');
  if(!message.trim())throw Error('Commit-Nachricht eingeben.');
  const treeEntries=[];
  for(const change of uploads){
    if(change.type==='delete'){
      if(remote.files.has(change.path))treeEntries.push({path:change.path,mode:change.mode,type:'blob',sha:null});
      continue;
    }
    const blob=await githubRequest(cfg,token,'/git/blobs','POST',{content:githubBytesBase64(change.bytes),encoding:'base64'});
    if(blob.sha?.toLowerCase()!==change.sha)throw Error('Abweichende Prüfsumme bei GitHub für '+change.path);
    treeEntries.push({path:change.path,mode:change.mode,type:'blob',sha:blob.sha});
  }
  if(!treeEntries.length)return remote.head;
  const tree=await githubRequest(cfg,token,'/git/trees','POST',{base_tree:remote.treeSha,tree:treeEntries});
  if(!/^[0-9a-f]{40}$/i.test(tree?.sha||''))throw Error('GitHub konnte keinen Commit-Baum erstellen.');
  const commit=await githubRequest(cfg,token,'/git/commits','POST',{message,tree:tree.sha,parents:[remote.head]});
  if(!/^[0-9a-f]{40}$/i.test(commit?.sha||''))throw Error('GitHub konnte keinen Commit erstellen.');
  const latest=await githubRequest(cfg,token,githubRefPath(cfg));
  if(latest?.object?.sha?.toLowerCase()!==remote.head)throw Error('GitHub-Branch zwischenzeitlich geändert. Keine Datei überschrieben.');
  // A non-fast-forward update is rejected by GitHub. Never use force:true.
  await githubRequest(cfg,token,'/git/refs/heads/'+cfg.branch.split('/').map(encodeURIComponent).join('/'),'PATCH',{sha:commit.sha,force:false});
  return commit.sha.toLowerCase();
}
async function githubExecutePlan({p,cfg,token,plan,choices,message}){
  const {uploads,downloads,pending}=githubSelectedOperations(plan,choices);
  if(plan.blocked.length)throw Error('Nicht synchronisierbare Pfade entdeckt. Keine Änderungen ausgeführt.');
  const downloadFiles=downloads.filter(d=>d.type==='upsert');
  const downloadSize=downloadFiles.reduce((sum,d)=>sum+d.remote.size,0);
  if(downloadFiles.length>GITHUB_MAX_PULL_FILES||downloadSize>GITHUB_MAX_PULL){
    throw Error('Downloadgrenze überschritten (max. 750 Dateien und '+workspaceSize(GITHUB_MAX_PULL)+').');
  }
  if(uploads.reduce((sum,x)=>sum+(x.bytes?.length||0),0)>GITHUB_MAX_PUSH)throw Error('Upload zu groß.');
  // Fetch and validate all incoming blobs BEFORE any remote or local mutation.
  const afterFiles=[],deleteIds=[];
  for(const change of downloads){
    if(change.type==='delete'){
      if(change.local?.doc)deleteIds.push(change.local.doc.id);
      continue;
    }
    const bytes=await githubReadBlob(cfg,token,change.remote,change.path);
    const record=importedFileRecord(change.path,bytes,change.local?.doc||{});
    record.projectId=p.id;record.preserveSource=true;
    if(fileKind(record)==='markdown')record.content=record.originalContent;
    if(change.local?.doc)record.id=change.local.doc.id;
    afterFiles.push(record);
  }
  // Abort before the first mutation if a concurrent edit occurred since review.
  const before=await githubLocalFiles(p);
  if(JSON.stringify([...before].map(([path,item])=>[path,item.sha]))!==JSON.stringify([...plan.local].map(([path,item])=>[path,item.sha]))){
    throw Error('Lokale Dateien während der Synchronisation geändert. Erneut synchronisieren.');
  }
  const latest=await githubRequest(cfg,token,githubRefPath(cfg));
  if(latest?.object?.sha?.toLowerCase()!==plan.remote.head)throw Error('GitHub wurde inzwischen geändert. Erneut synchronisieren.');
  const head=await githubCommitUploads(cfg,token,plan.remote,uploads,message);
  // Uploading blobs and committing may take time. A second local check prevents
  // a fresh edit made during those requests from being overwritten by a pull.
  // When a push has already completed, retain the old baseline so the next
  // synchronization requires an explicit conflict decision instead of losing data.
  if(projectId!==p.id||githubConnection(p)!==cfg){
    throw Error('Projekt während des Abgleichs gewechselt. GitHub eventuell bereits aktualisiert; lokale Dateien unverändert. Erneut synchronisieren.');
  }
  const afterUpload=await githubLocalFiles(p);
  if(JSON.stringify([...afterUpload].map(([path,item])=>[path,item.sha]))!==JSON.stringify([...plan.local].map(([path,item])=>[path,item.sha]))){
    throw Error('Lokale Dateien wurden während des GitHub-Uploads bearbeitet. GitHub eventuell bereits aktualisiert; lokale Änderungen bleiben erhalten. Erneut synchronisieren.');
  }
  // One IndexedDB transaction + one undo step for all downloaded changes.
  if(afterFiles.length||deleteIds.length){
    try{await workspaceCommitChanges(afterFiles,deleteIds,p.folders||[],docId)}
    catch(error){throw Error('GitHub-Upload eventuell abgeschlossen, lokale Speicherung fehlgeschlagen. Lokale Dateien wurden nicht überschrieben: '+error.message)}
  }
  const baseline=Object.assign(Object.create(null),cfg.baseline||{});
  for(const item of plan.aligned){
    if(item.sha)baseline[item.path]={sha:item.sha,mode:item.mode};
    else delete baseline[item.path];
  }
  for(const change of uploads){
    if(change.sha)baseline[change.path]={sha:change.sha,mode:change.mode};
    else delete baseline[change.path];
  }
  for(const change of downloads){
    if(change.remote)baseline[change.path]={sha:change.remote.sha,mode:change.remote.mode};
    else delete baseline[change.path];
  }
  const old=p.github;p.github={...cfg,baseline,lastCommit:head,lastSyncedAt:Date.now()};
  try{await put('projects',{...p})}catch(error){p.github=old;throw Error('Synchronisiert, aber Abgleichsstand konnte nicht gespeichert werden: '+error.message)}
  const status=pending.length?{kind:'conflict',count:pending.length}:{kind:'synced'};
  githubSetProjectStatus(p,status);
  const summary=`${uploads.length} hochgeladen, ${downloads.length} übernommen`;
  toast(pending.length?summary+' · '+pending.length+' Konflikte offen':summary+' · Synchronisiert');
  return {uploads:uploads.length,downloads:downloads.length,pending:pending.length,head};
}
