#!/usr/bin/env python3
"""v36 offline browser smoke test, using an inlined copy and test-only state.
This environment blocks local network navigation, so IndexedDB is mocked.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
INIT=r'''
const p={id:'p36',name:'Testprojekt',created:Date.now(),folders:[]};
projects=[p];docs=[{id:'initial',projectId:p.id,name:'Projekt',path:'Projekt.md',fileType:'markdown',content:'# Projekt\n- Aufgabe A\n',updatedAt:Date.now()}];
projectId=p.id;docId='initial';persistedDocSnapshots.set('initial',docSnapshot(docs[0]));
put=async (name,value)=>{
  if(name==='projects'){Object.assign(p,value)}
  else if(name==='docs'){
    const i=docs.findIndex(d=>d.id===value.id);
    if(i<0)docs.push(value);else docs[i]={...value};
    persistedDocSnapshots.set(value.id,docSnapshot(value));
  }
  return value.id;
};
saveSource=async()=>{};
$('#appSettingsButton').onclick=openAppSettings;
$('#addDocument').onclick=()=>toggleWorkspaceActionMenu('add',$('#addDocument'));
$('#workspaceMore').onclick=()=>toggleWorkspaceActionMenu('more',$('#workspaceMore'));
function mockOpenText(path){
  const id='test-'+path;
  if(!docs.some(item=>item.id===id))docs.push({id,projectId:p.id,path,name:path,fileType:'script',content:''});
  docId=id;activeFilePanel='script';render();
}
render();
'''
def inline_app():
    html=(ROOT/'index.html').read_text()
    def css(match):return '<style>'+(ROOT/match.group(1)).read_text()+'</style>'
    def js(match):
        src=match.group(1)
        if src in ('ui/bindings.js','core/service-worker.js'):return ''
        return '<script>'+(ROOT/src).read_text().replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',css,html)
    html=re.sub(r'<script src="([^"]+)"></script>',js,html)
    return html.replace('</body>','<script>'+INIT+'</script></body>')

def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1280,'height':800})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=30000)
        page.locator('#docList [data-doc]').first.wait_for(timeout=10000)
        page.click('#appSettingsButton')
        page.locator('#appGithubToken').wait_for()
        assert page.locator('.app-settings-token-guide a').get_attribute('href')=='https://github.com/settings/personal-access-tokens/new'
        assert page.locator('#appGithubToken').get_attribute('autocomplete')=='off'
        assert page.locator('#appGithubToken').get_attribute('type')=='text', 'Chrome should mask a normal text input'
        assert page.evaluate("getComputedStyle(document.querySelector('#appGithubToken')).webkitTextSecurity")=='disc'
        print('PASS: token creation guide and masked text field (no password input)')
        page.click('#closeAppSettings')
        page.click('#projectSettings')
        page.locator('#projectGithubRepo').click()
        page.fill('#githubRepository','demo-owner/example-repo')
        assert page.locator('#githubRepositoryOpen').is_visible()
        assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/demo-owner/example-repo'
        assert page.locator('#githubRepositoryOpen').get_attribute('target')=='_blank'
        assert page.locator('#githubRepositoryCreate').get_attribute('href')=='https://github.com/new'
        page.fill('#githubRepository','invalid text')
        assert page.locator('#githubRepositoryOpen').is_hidden()
        page.click('#cancelModal')
        print('PASS: live GitHub repository link, create link and invalid URL handling')
        page.click('#addDocument')
        assert page.locator('#workspaceActionsMenu [role="separator"]').count()==1
        assert page.locator('#workspaceActionsMenu [data-workspace-action="new-folder"] + .workspace-menu-separator').count()==1
        assert page.locator('#workspaceActionsMenu .workspace-menu-separator + [data-workspace-action="upload"]').count()==1
        assert page.evaluate("workspaceSuggestTextName('body { color: red; }')")=='clipboard.css'
        assert page.evaluate("workspaceSuggestTextName('const answer = 42;')")=='clipboard.js'
        assert page.evaluate("workspaceSuggestTextName('A plain text note.')")=='clipboard.txt'
        page.evaluate('closeWorkspaceActionMenu()')
        print('PASS: file menu separator and clipboard CSS/JS detection')
        page.evaluate("mockOpenText('broken.css')")
        page.locator('#scriptSource').wait_for()
        page.fill('#scriptSource','body { color red; }')
        page.wait_for_function("document.querySelector('.script-validation-label.is-invalid')?.textContent.includes('CSS')",timeout=7000)
        assert page.locator('.script-invalid-line').count()>0
        assert page.locator('.script-editor .gline.error').count()>0
        page.locator('.script-diagnostic-link').first.click()
        assert page.evaluate("document.activeElement.id==='scriptSource'")
        page.fill('#scriptSource','body { color: red; }')
        page.wait_for_function("document.querySelector('.script-validation-label.is-valid')?.textContent.includes('CSS')",timeout=7000)
        assert page.locator('.script-invalid-line').count()==0
        print('PASS: CSS error markers, jump to position and clearing after fix')
        page.evaluate("mockOpenText('broken.js')")
        page.fill('#scriptSource','const x = ;')
        page.wait_for_function("document.querySelector('.script-validation-label.is-invalid')?.textContent.includes('JavaScript')",timeout=7000)
        assert page.locator('.script-invalid-token').count()>0
        print('PASS: JavaScript parser errors with token markers')
        page.evaluate("mockOpenText('broken.html')")
        page.fill('#scriptSource','<div><span>x</div>')
        page.wait_for_function("document.querySelector('.script-validation-label.is-invalid')?.textContent.includes('HTML')",timeout=7000)
        assert page.locator('.script-invalid-line').count()>0
        print('PASS: HTML nested-tag diagnostic markers')
        result=page.evaluate('''()=>{
          const child=()=>({path:'x',children:[]});
          const branch=()=>({path:'b',children:[child(),child()]});
          const root={path:'r',children:[branch(),branch()]};
          const layout=mapLayout(root,new Set());
          for(const row of layout.rows){row.el={offsetHeight:70,offsetWidth:205,style:{}}}
          positionMapRows(layout);
          const leaf=layout.rows.filter(r=>r.depth===2);
          return {within:leaf[1].y-(leaf[0].y+leaf[0].height),between:leaf[2].y-(leaf[1].y+leaf[1].height)};
        }''')
        assert result['within']<result['between'],result
        print('PASS: mindmap subtree gaps smaller than inter-parent gaps',result)
        assert not errors,errors
        browser.close()

if __name__=='__main__':run()
