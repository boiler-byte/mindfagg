#!/usr/bin/env python3
"""v34 isolated browser UI integration. External navigation/IndexedDB are blocked
by this test environment, so scripts are inlined and DB/GitHub are simulated.
Exercises the actual view code, dialogs, sync controller and conflict selections.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
SCRIPT=r'''
const p={id:'p1',name:'Testprojekt',created:Date.now(),folders:[]};
projects=[p];docs=[{id:'d1',projectId:p.id,name:'Projekt',path:'Projekt.md',fileType:'markdown',content:'# Projekt\n',updatedAt:Date.now()}];
projectId=p.id;docId='d1';persistedDocSnapshots.set('d1',docSnapshot(docs[0]));
const store={settings:new Map()};
tx=(name,mode)=>({get:key=>({result:store[name]?.get(key)}),put:row=>{store[name].set(row.key,row);return {result:row.key}},delete:key=>{store[name].delete(key);return {result:undefined}}});
req=async request=>request.result;
Object.defineProperty(window,'crypto',{configurable:true,value:{
  getRandomValues:arr=>{arr.fill(13);return arr},
  randomUUID:()=>String(Date.now()+Math.random()),
  subtle:{generateKey:async()=>({extractable:false,algorithm:{name:'AES-GCM'}}),
    encrypt:async(options,key,bytes)=>Uint8Array.from(bytes,x=>x^0xA5).buffer,
    decrypt:async(options,key,bytes)=>Uint8Array.from(bytes,x=>x^0xA5).buffer}
}});
put=async (name,value)=>{
  if(name==='projects'){Object.assign(projects.find(x=>x.id===value.id),value)}
  else if(name==='docs'){
    value.updatedAt=Date.now();let i=docs.findIndex(x=>x.id===value.id);
    if(i<0)docs.push(value);else docs[i]={...value};persistedDocSnapshots.set(value.id,docSnapshot(value))
  }return value.id;
};
workspaceCommitChanges=async (items,deleted,folders)=>{
  docs=docs.filter(d=>!deleted.includes(d.id));
  for(const item of items){const i=docs.findIndex(d=>d.id===item.id);if(i<0)docs.push(item);else docs[i]=item;persistedDocSnapshots.set(item.id,docSnapshot(item))}
  p.folders=folders;render();return true;
};
function fakeSha(bytes){let n=2166136261;for(const x of bytes)n=Math.imul(n^x,16777619)>>>0;return n.toString(16).padStart(8,'0').repeat(5)}
githubBlobHash=async bytes=>fakeSha(bytes);
let fakeHead='a'.repeat(40),fakeTree='b'.repeat(40),fakeCommitCount=0,fakeObjectCount=10,networkOffline=false;
let fakeFiles=new Map([['README.md',new TextEncoder().encode('# Online\n')]]);
const fakeTrees=new Map([[fakeTree,new Map(fakeFiles)]]),fakeBlobs=new Map(),fakeCommits=new Map([[fakeHead,{tree:fakeTree,parents:[]}]]);
for(const bytes of fakeFiles.values())fakeBlobs.set(fakeSha(bytes),bytes);
function externalChange(path,text){
  const bytes=new TextEncoder().encode(text);
  fakeFiles.set(path,bytes);fakeBlobs.set(fakeSha(bytes),bytes);
  fakeTree=(++fakeObjectCount).toString(16).padStart(40,'0');fakeTrees.set(fakeTree,new Map(fakeFiles));
  fakeHead=(++fakeObjectCount).toString(16).padStart(40,'0');fakeCommits.set(fakeHead,{tree:fakeTree,parents:[]});
}
githubApi=async (token,path)=>{if(token!=='fake_token')throw Error('Token fehlt');if(path==='/user')return {login:'sim-user'};throw Error('Unexpected user endpoint')};
githubRequest=async (cfg,token,path,method='GET',body)=>{
  if(networkOffline){const e=new Error('GitHub nicht erreichbar');e.offline=true;throw e}
  if(token!=='fake_token')throw Error('Token fehlt');
  if(method==='GET'&&path==='/git/ref/heads/main')return {object:{sha:fakeHead}};
  if(method==='GET'&&path.startsWith('/git/commits/'))return {tree:{sha:fakeCommits.get(path.slice(13)).tree}};
  if(method==='GET'&&path.startsWith('/git/trees/'))return {truncated:false,tree:[...fakeTrees.get(path.split('/').pop().split('?')[0])].map(([path,bytes])=>({path,type:'blob',mode:'100644',sha:fakeSha(bytes),size:bytes.length}))};
  if(method==='GET'&&path.startsWith('/git/blobs/'))return {encoding:'base64',content:githubBytesBase64(fakeBlobs.get(path.slice(11)))};
  if(method==='GET'&&path.startsWith('/commits?'))return [{commit:{committer:{date:'2026-11-04T12:00:00Z'}}}];
  if(method==='POST'&&path==='/git/blobs'){
    const bytes=githubBase64Bytes(body.content),sha=fakeSha(bytes);fakeBlobs.set(sha,bytes);return {sha};
  }
  if(method==='POST'&&path==='/git/trees'){
    const next=new Map(fakeTrees.get(body.base_tree));
    for(const entry of body.tree){if(entry.sha===null)next.delete(entry.path);else next.set(entry.path,fakeBlobs.get(entry.sha))}
    fakeTree=(++fakeObjectCount).toString(16).padStart(40,'0');fakeTrees.set(fakeTree,next);return {sha:fakeTree};
  }
  if(method==='POST'&&path==='/git/commits'){
    const sha=(++fakeObjectCount).toString(16).padStart(40,'0');fakeCommits.set(sha,{tree:body.tree,parents:body.parents});fakeCommitCount++;return {sha};
  }
  if(method==='PATCH'&&path==='/git/refs/heads/main'){
    if(body.force!==false||!fakeCommits.get(body.sha).parents.includes(fakeHead))throw Error('Non-fast-forward');
    fakeHead=body.sha;fakeTree=fakeCommits.get(fakeHead).tree;fakeFiles=new Map(fakeTrees.get(fakeTree));return {object:{sha:fakeHead}};
  }
  throw Error('Unexpected mock '+method+' '+path);
};
$('#githubSync').onclick=async()=>{await flushSource();await githubSyncClicked()};
$('#appSettingsButton').onclick=openAppSettings;
$('#menuToggle').onclick=()=>setMobileMenu(!$('.app').classList.contains('menu-open'));
$('#sidebarScrim').onclick=()=>setMobileMenu(false);
render();
'''

def inline_app():
    html=(ROOT/'index.html').read_text()
    def css(m):return '<style>'+(ROOT/m.group(1)).read_text()+'</style>'
    def script(m):
        src=m.group(1)
        if src in ('ui/bindings.js','core/service-worker.js'):return ''
        return '<script>'+(ROOT/src).read_text().replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',css,html)
    html=re.sub(r'<script src="([^"]+)"></script>',script,html)
    return html.replace('</body>','<script>'+SCRIPT+'</script></body>')

def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1200,'height':850})
        errors=[];page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=30000)
        page.locator('#docList [data-doc]').first.wait_for(timeout=10000)
        page.click('#appSettingsButton')
        page.fill('#appGithubToken','fake_token')
        page.click('#appGithubSave')
        page.wait_for_function("document.querySelector('#appGithubConnectionState')?.textContent.includes('@sim-user')")
        assert page.evaluate("!JSON.stringify(store.settings.get('github-credential')).includes('fake_token')")
        page.evaluate("githubCredentialToken=null;githubCredentialAccount=''")
        page.evaluate('githubRestoreCredentials()')
        assert page.evaluate("githubCredentialToken==='fake_token'")
        print('PASS: app-level saved token, credential restore, settings UI')
        page.click('#closeAppSettings')
        page.click('#githubSync')
        page.fill('#githubRepository','acme/demo')
        assert page.locator('#githubBranch').input_value()=='main'
        page.click('#githubConnectBtn')
        page.wait_for_function("project().github?.repo==='demo'&&!githubBusy")
        page.click('#githubSyncFromDialog')
        page.wait_for_function("document.querySelector('#githubSyncText').textContent==='Synchronisiert'",timeout=15000)
        assert page.evaluate("new TextDecoder().decode(fakeFiles.get('Projekt.md'))==='# Projekt\\n' && docs.some(d=>d.path==='README.md') && fakeCommitCount===1")
        print('PASS: first one-click sync uploads local and downloads remote files')
        page.evaluate('''async()=>{
          const d=docs.find(x=>x.path==='Projekt.md');d.content='# Lokal neu\\n';await put('docs',{...d});render();
          externalChange('README.md','# Remote neu\\n');
        }''')
        page.click('#githubSync')
        page.wait_for_function("document.querySelector('#githubSyncText').textContent==='Synchronisiert'",timeout=15000)
        assert page.evaluate("new TextDecoder().decode(fakeFiles.get('Projekt.md'))==='# Lokal neu\\n' && docs.find(d=>d.path==='README.md').content==='# Remote neu\\n' && fakeCommitCount===2")
        print('PASS: simultaneous conflict-free upload and download in a single click')
        page.evaluate('''async()=>{
          for(const path of ['Projekt.md','README.md']){
            const d=docs.find(d=>d.path===path);d.content='# Lokal '+path+'\\n';await put('docs',{...d});
            externalChange(path,'# Github '+path+'\\n');
          }render();
        }''')
        page.click('#githubSync')
        page.locator('#githubConflictModal').wait_for(timeout=12000)
        assert page.locator('.github-conflict-card').count()==2
        assert '04.11.2026' in page.locator('.github-conflict-list').inner_text()
        assert page.evaluate("docs.find(d=>d.path==='README.md').content==='# Lokal README.md\\n'")
        page.screenshot(path='/mnt/data/mindfagg-v34-conflicts-desktop.png')
        for i in range(2):
            name=page.locator('.github-conflict-heading strong').nth(i).inner_text()
            page.locator('[data-github-choice]').nth(i).select_option('local' if name=='README.md' else 'remote')
        page.click('#githubApplyResolutions')
        page.wait_for_function("document.querySelector('#modalBack').classList.contains('hidden') && document.querySelector('#githubSyncText').textContent==='Synchronisiert'",timeout=15000)
        assert page.evaluate("new TextDecoder().decode(fakeFiles.get('README.md'))==='# Lokal README.md\\n' && docs.find(d=>d.path==='Projekt.md').content==='# Github Projekt.md\\n' && fakeCommitCount===3")
        print('PASS: grouped two-file conflicts, side-by-side metadata, individually chosen winners')
        page.evaluate('''async()=>{
          const d=docs.find(x=>x.path==='Projekt.md');d.content='# Lokal offline\\n';await put('docs',{...d});render();networkOffline=true;
        }''')
        page.click('#githubSync')
        page.wait_for_function("document.querySelector('#githubSyncText').textContent==='GitHub nicht erreichbar'",timeout=12000)
        assert page.evaluate("docs.find(d=>d.path==='Projekt.md').content==='# Lokal offline\\n'")
        print('PASS: offline error retains local files and shows clear status')
        page.evaluate('networkOffline=false')
        page.set_viewport_size({'width':390,'height':844});page.click('#menuToggle')
        page.wait_for_timeout(310)  # wait for mobile sidebar slide animation
        page.screenshot(path='/mnt/data/mindfagg-v34-mobile-sidebar.png')
        assert page.locator('#githubSyncText').is_visible()
        assert not errors,errors
        print('PASS: mobile sync button state visible; no browser JavaScript errors')
        browser.close()

if __name__=='__main__':run()
