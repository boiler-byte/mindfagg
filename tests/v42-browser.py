#!/usr/bin/env python3
"""v42: native datalists for GitHub repositories and clipboard file names."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    fixture='''
      projects=[{id:'p42',name:'Datalist-Test',created:Date.now(),folders:['pages','empty','assets','only-htm']},
                {id:'other',name:'Fremdes Projekt',created:Date.now(),folders:[]}];projectId='p42';
      const paths=['main.HTML','app.js','common.css','zeta.css','readme.md',
        'pages/site.html','pages/alternate.html','pages/print.css','pages/nested/hidden.html',
        'assets/cat.png','assets/dog.jpeg','only-htm/start.htm'];
      docs=paths.map((path,i)=>({id:'doc'+i,projectId:'p42',name:path.split('/').pop(),path,
        fileType:'script',content:'',updatedAt:Date.now()}));
      docs.push({id:'foreign',projectId:'other',name:'foreign.html',path:'foreign.html',fileType:'script',content:''});
      activeFolderPath='';docId=null;
      githubCredentialToken='demo-token';githubCredentialAccount='test-user';
      window.githubCalls=[];
      githubApi=async(token,path)=>{
        githubCalls.push({token,path});
        if(!path.startsWith('/user/repos?'))throw Error('Unexpected API endpoint');
        const page=Number(new URL('https://api.github.com'+path).searchParams.get('page'));
        if(page===1)return Array.from({length:100},(_,i)=>({full_name:'test-user/repo'+String(i).padStart(3,'0'),private:i%2===0}));
        if(page===2)return [{full_name:'another/awesome',private:true},{full_name:'test-user/repo100',private:false}];
        return [];
      };
      flushMapInlineEdit=async()=>{};flushSource=async()=>{};
      window.savedImport=null;
      workspaceCommitBatch=async(files,folders)=>{savedImport={paths:files.map(d=>workspacePath(d)),folders};return true};
      window.openClipboard=(text,folder='',mime='text/plain')=>{
        const descriptor={path:mime==='text/html'?'clipboard.html':workspaceSuggestTextName(text),
          bytes:new TextEncoder().encode(text),text,mime};
        openFileImportDialog([descriptor],{clipboard:true,folder});
      };
    '''
    return html.replace('</body>','<script>'+fixture+'</script></body>')


def options(page,selector):
    return page.locator(selector+' option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)

    # Native repository datalist contains ALL authorized repositories after pagination.
    page.evaluate('openGithubDialog()')
    repository=page.locator('#githubRepository')
    assert repository.get_attribute('list')=='githubRepoOptions'
    assert page.locator('#githubRepoOptions').evaluate('(node)=>node.tagName')=='DATALIST'
    page.wait_for_function("document.querySelectorAll('#githubRepoOptions option').length===102")
    assert 'another/awesome' in options(page,'#githubRepoOptions')
    assert 'test-user/repo099' in options(page,'#githubRepoOptions')
    assert all(c['token']=='demo-token' for c in page.evaluate('githubCalls'))
    assert page.locator('#githubRepoSuggestion').count()==0
    repository.fill('another/awesome')
    assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/another/awesome'
    repository.fill('my-custom-org/my-custom-repo')
    assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/my-custom-org/my-custom-repo'
    page.evaluate("githubApi=async()=>{throw Error('No access')};closeModal();openGithubDialog()")
    page.wait_for_function("document.querySelector('#githubRepoLookup').textContent.includes('No access')")
    assert page.locator('#githubRepository').get_attribute('list')=='githubRepoOptions'
    page.locator('#githubRepository').fill('manual/repository')
    assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/manual/repository'
    page.evaluate('closeModal()')
    print('PASS: native repository datalist with two API pages, error and free-form input')

    # The content type, not the name typed by the user, determines suggestions.
    page.evaluate("openClipboard('body { color: red; }')")
    name=page.locator('#workspaceImportName')
    assert name.get_attribute('list')=='workspaceImportNameOptions'
    assert page.locator('#workspaceImportNameOptions').evaluate('(node)=>node.tagName')=='DATALIST'
    assert name.input_value()=='clipboard.css'
    assert options(page,'#workspaceImportNameOptions')==['common.css','zeta.css']
    name.fill('my-own.css')
    page.locator('#workspaceImportFolder').select_option('pages')
    assert options(page,'#workspaceImportNameOptions')==['print.css']
    assert name.input_value()=='my-own.css'
    page.locator('#workspaceImportFolder').select_option('empty')
    assert options(page,'#workspaceImportNameOptions')==[]
    page.evaluate('closeModal()')
    print('PASS: clipboard datalist follows current folder, preferred extension, and manual editing')

    # HTML defaults to index.html only in folders without any HTML documents.
    page.evaluate("openClipboard('<!doctype html><html><body>Hello</body></html>','empty')")
    assert page.locator('#workspaceImportName').input_value()=='index.html'
    assert options(page,'#workspaceImportNameOptions')==[]
    page.locator('#workspaceImportFolder').select_option('pages')
    assert page.locator('#workspaceImportName').input_value()=='clipboard.html'
    assert options(page,'#workspaceImportNameOptions')==['alternate.html','site.html']
    page.locator('#workspaceImportFolder').select_option('')
    assert options(page,'#workspaceImportNameOptions')==['main.HTML']
    assert page.locator('#workspaceImportName').input_value()=='clipboard.html'
    page.locator('#workspaceImportFolder').select_option('only-htm')
    assert page.locator('#workspaceImportName').input_value()=='clipboard.html', 'An .htm document is HTML'
    assert options(page,'#workspaceImportNameOptions')==[], 'Only preferred .html extension is suggested'
    page.locator('#workspaceImportFolder').select_option('empty')
    assert page.locator('#workspaceImportName').input_value()=='index.html'
    page.locator('#workspaceFilesForm [type="submit"]').click()
    page.wait_for_function('savedImport!==null')
    assert page.evaluate('savedImport.paths')==['empty/index.html']
    print('PASS: HTML auto-name responds to folder changes and is used when importing')

    # Explicit editing is never overwritten by the HTML-specific default.
    page.evaluate("openClipboard('<html><body>Hi</body></html>','empty')")
    name=page.locator('#workspaceImportName')
    name.fill('my-entry.html')
    page.locator('#workspaceImportFolder').select_option('pages')
    page.locator('#workspaceImportFolder').select_option('empty')
    assert name.input_value()=='my-entry.html'
    page.evaluate('closeModal()')
    print('PASS: HTML auto-name does not replace manually entered filenames')

    # An HTML clipboard MIME type can contain an HTML fragment without a doctype.
    page.evaluate("openClipboard('<section>Fragment</section>','empty','text/html')")
    assert page.locator('#workspaceImportName').input_value()=='index.html'
    page.evaluate('closeModal()')
    result=page.evaluate('''()=>workspaceClipboardFromEvent({clipboardData:{items:[],getData:t=>t==='text/html'?'<section>Fragment</section>':''}})''')
    assert result[0]['mime']=='text/html' and result[0]['path']=='clipboard.html'
    print('PASS: text/html fragments use the HTML extension and index.html default')

    # Binary clipboard content uses the file's preferred image extension.
    page.evaluate('''()=>openFileImportDialog([{
      file:new File([new Uint8Array([137,80,78,71])],'clipboard.png',{type:'image/png'}),path:'clipboard.png'
    }],{clipboard:true,folder:'assets'})''')
    assert options(page,'#workspaceImportNameOptions')==['cat.png']
    assert page.locator('#workspaceImportName').input_value()=='clipboard.png'
    page.evaluate('closeModal()')
    print('PASS: clipboard PNG suggestions exclude JPEG files')
    page.evaluate('''()=>openFileImportDialog([{
      file:new File([new Uint8Array([137,80,78,71])],'mislabeled.jpg',{type:'image/png'}),path:'mislabeled.jpg'
    }],{clipboard:true,folder:'assets'})''')
    assert options(page,'#workspaceImportNameOptions')==['cat.png'], 'MIME content type should decide suggested extension'
    page.evaluate('closeModal()')
    print('PASS: binary MIME type determines preferred extension even when filename differs')

    # File upload dialog remains unchanged (no name editing/datalist for multiple files).
    page.evaluate("openFileImportDialog([{path:'new.css',bytes:new Uint8Array([1])}],{folder:'pages'})")
    assert page.locator('#workspaceImportName').count()==0
    assert page.locator('#workspaceImportFolder').input_value()=='pages'
    page.evaluate('closeModal()')
    assert not errors,errors
    print('PASS: upload dialog unaffected and no runtime exceptions')
    browser.close()
