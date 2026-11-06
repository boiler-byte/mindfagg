#!/usr/bin/env python3
"""v46 browser tests for patch preview, context validation, grouped selective sharing."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    setup='''<script>
      window.testStorageData={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>testStorageData[key]??null,setItem:(key,value)=>{testStorageData[key]=String(value)},removeItem:key=>{delete testStorageData[key]}}});
    </script>'''
    html=html.replace('<body>','<body>'+setup,1)
    fixture='''<script>
      projects=[{id:'p46',name:'Projekt v46',created:Date.now(),folders:['src','assets','nested','nested/more','empty']}];
      projectId='p46';
      const mk=(id,path,content,fileType='script')=>({id,projectId:'p46',path,name:path.split('/').pop(),fileType,content,updatedAt:Date.now()});
      docs=[mk('html','index.html','<h1>Old</h1>\\nEnd'),mk('js','src/app.js','alpha\\nbeta'),
        mk('srcdup','src/dup.txt','folder version'),mk('rootdup','dup.txt','root version'),
        mk('nested','nested/more/readme.md','# Heading','markdown'),
        {id:'logo',projectId:'p46',path:'assets/logo.png',name:'logo.png',fileType:'image',data:new Uint8Array([12,27,18])}];
      docId='html';view='markdown';activeFilePanel='script';
      saveSource=async()=>{};flushSource=async()=>{};flushMapInlineEdit=async()=>{};
      window.testShares=[];window.testDownloads=[];
      Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length>0});
      Object.defineProperty(navigator,'share',{configurable:true,value:data=>{testShares.push(data);return Promise.resolve()}});
      saveWorkspaceBlob=(blob,name)=>{testDownloads.push({blob,name})};
      render();document.querySelector('#workspaceShareQuick').onclick=()=>{void workspaceExecuteAction('zip-share')};
    </script>'''
    return html.replace('</body>',fixture+'</body>')


with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1180,'height':870})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)

    # Explicit validation button is replaced by the red, keyboard-focusable message.
    page.evaluate('openPatchTool()')
    assert page.locator('#patchValidate').count()==0
    patch={'patches':[
        {'operation':'update','file':'index.html','description':'Title', 'hunks':[
            {'search':'Old','replace':'New','occurrence':1},
            {'search':'MISSING','replace':'x','occurrence':1}]},
        {'operation':'rename','file':'src/app.js','to':'src/moved.js','description':'Move'},
        {'operation':'delete','file':'not-found.js','description':'Missing file'}
    ]}
    page.locator('#patchJsonInput').fill(json.dumps(patch))
    hint=page.locator('.patch-validate-link')
    assert hint.count()==1 and hint.inner_text()=='Patch prüfen, um die Vorschau zu aktualisieren.'
    assert hint.evaluate('(el)=>getComputedStyle(el).color')=='rgb(255, 129, 149)'
    hint.click()
    assert page.locator('.patch-preview-file').count()==3
    assert page.locator('.patch-preview-file[open]').count()==0, 'File panels must default to closed'
    assert page.locator('[data-patch-file="0"] .patch-preview-file-head').inner_text().find('update')>=0
    header=page.locator('[data-patch-file="0"] summary').inner_text()
    assert 'patch / found / total' in header and '2 / 1 / 2' in header,header
    assert '1 / 1 / 1' in page.locator('[data-patch-file="1"] summary').inner_text()
    assert '1 / 0 / 1' in page.locator('[data-patch-file="2"] summary').inner_text()
    page.locator('[data-patch-file="0"] summary').click()
    assert page.locator('[data-patch-file="0"][open]').count()==1
    page.locator('[data-patch-operation="0:1"]').uncheck()
    assert page.locator('[data-patch-file="0"][open]').count()==1, 'Open panel must survive selection changes'
    assert '1 / 1 / 2' in page.locator('[data-patch-file="0"] summary').inner_text()
    page.locator('[data-patch-file="2"] summary').click()
    page.locator('[data-patch-operation="2:0"]').uncheck()
    assert page.locator('#patchApply').is_enabled()
    assert '1 / 0 / 1' in page.locator('[data-patch-file="2"] summary').inner_text() or '0 / 0 / 1' in page.locator('[data-patch-file="2"] summary').inner_text()
    page.locator('#patchJsonInput').fill('{"patches":[]}')
    assert page.locator('#patchPreview').is_hidden()
    assert page.locator('.patch-validate-link').count()==1
    page.locator('.patch-validate-link').click()
    assert 'abgelehnt' in page.locator('#patchToolMessage').inner_text()
    page.locator('#patchClose').click()
    print('PASS: red contextual validation, patch/found/total, collapsed summary and retained expansion')

    # Share menu is renamed and contains an inline sharing icon.
    menu=page.locator('#workspaceShareQuick')
    assert 'Teilen' in menu.inner_text() and menu.locator('svg').count()==1
    menu.click()
    page.wait_for_selector('#workspaceShareDialog')
    groups=page.locator('.workspace-share-group')
    assert groups.count()==4
    assert 'root (Wurzel)' in groups.nth(0).inner_text()
    assert 'assets' in groups.nth(1).inner_text()
    assert 'nested/more' in groups.nth(2).inner_text()
    assert 'src' in groups.nth(3).inner_text()
    assert page.locator('[data-share-group]').count()==4
    assert page.locator('.workspace-share-select-all').count()==5  # v47 adds a global select-all above 4 groups
    assert page.locator('[data-share-file]').count()==6
    assert page.locator('#workspaceShareCount').inner_text()=='6 von 6 gewählt'
    # Unselect a complete directory, then select only a subset of root.
    page.locator('[data-share-group="3"]').uncheck()
    assert page.locator('[data-share-file="srcdup"]').is_checked() is False
    assert page.locator('[data-share-file="js"]').is_checked() is False
    assert page.locator('#workspaceShareCount').inner_text()=='4 von 6 gewählt'
    page.locator('[data-share-file="rootdup"]').uncheck()
    assert page.locator('[data-share-group="0"]').evaluate('(el)=>el.indeterminate') is True
    assert page.locator('#workspaceShareCount').inner_text()=='3 von 6 gewählt'
    page.locator('[data-share-group="0"]').check()
    assert page.locator('[data-share-file="rootdup"]').is_checked() is True
    assert page.locator('#workspaceShareCount').inner_text()=='4 von 6 gewählt'
    # Keep one folder and one root file. Selected ZIP must omit all other files/dirs.
    page.locator('[data-share-group="0"]').uncheck()
    page.locator('[data-share-file="html"]').check()
    page.locator('[data-share-group="1"]').uncheck()
    assert page.locator('#workspaceShareCount').inner_text()=='2 von 6 gewählt'
    assert page.locator('[name="workspaceShareMode"][value="zip"]').is_checked()
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    info=page.evaluate('''async()=>{
      const files=window.testShares.at(-1).files;
      return {name:files[0].name,entries:(await unzipWorkspace(await files[0].arrayBuffer())).map(e=>e.path)};
    }''')
    assert info['name']=='Projekt v46.zip'
    assert 'index.html' in info['entries'] and 'nested/more/readme.md' in info['entries']
    assert 'src/app.js' not in info['entries'] and 'assets/logo.png' not in info['entries']
    assert 'src' not in info['entries'] and 'nested' in info['entries'] and 'nested/more' in info['entries']
    assert any(n.startswith('mindfagg-workspace') for n in info['entries'])
    # The default full selection should still include explicitly empty folders.
    page.evaluate('openWorkspaceShareDialog()')
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    full=page.evaluate('''async()=>
      (await unzipWorkspace(await window.testShares.at(-1).files[0].arrayBuffer())).map(e=>e.path)
    ''')
    assert 'empty' in full and 'src/app.js' in full
    print('PASS: share selector, group and per-file selection, selective ZIP and full ZIP compatibility')

    # Single-file attachments are shared with unmodified contents. Duplicates
    # get disambiguated filename prefixes (Web Share API has no directory tree).
    page.evaluate('openWorkspaceShareDialog()')
    page.locator('[name="workspaceShareMode"][value="files"]').check()
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    info=page.evaluate('''async()=>{
      const files=window.testShares.at(-1).files;
      return {names:files.map(f=>f.name),data:await Promise.all(files.map(f=>f.text()))};
    }''')
    assert len(info['names'])==6
    assert len(set(n.lower() for n in info['names']))==6,info
    assert 'src__dup.txt' in info['names']
    assert 'dup.txt' in info['names']
    assert info['data'][info['names'].index('src__dup.txt')]=='folder version'
    binary=page.evaluate('''async()=>{
      const file=window.testShares.at(-1).files.find(f=>f.name==='logo.png');
      return {type:file.type,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))};
    }''')
    assert binary=={'type':'image/png','bytes':[12,27,18]},binary
    print('PASS: individual share, unique basename disambiguation, original binary and text bytes')

    # Graceful fallbacks and selection safeguards.
    page.evaluate('Object.defineProperty(navigator,"canShare",{configurable:true,value:()=>false})')
    page.evaluate('openWorkspaceShareDialog()')
    page.locator('[name="workspaceShareMode"][value="files"]').check()
    page.locator('[data-share-group="0"]').uncheck()
    page.locator('[data-share-group="1"]').uncheck()
    page.locator('[data-share-group="2"]').uncheck()
    page.locator('[data-share-group="3"]').uncheck()
    assert page.locator('#workspaceShareSubmit').is_disabled()
    page.locator('[data-share-file="js"]').check()
    assert page.locator('#workspaceShareSubmit').is_enabled()
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    assert page.evaluate('testDownloads.map(d=>d.name)')==['app.js']
    assert len(page.evaluate('testShares'))==3
    print('PASS: empty selection safeguard, individual-download fallback')
    # Aborting the system share prompt must not generate fallback downloads.
    page.evaluate('''()=>{
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:()=>Promise.reject(new DOMException('Cancelled','AbortError'))});
    }''')
    page.evaluate('openWorkspaceShareDialog()')
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#workspaceShareSubmit")?.disabled===false')
    assert page.locator('#workspaceShareDialog').is_visible()
    assert page.evaluate('testDownloads.length')==1
    page.locator('#workspaceShareCancel').click()
    print('PASS: cancelled native share does not download')

    # Root appears even without any files in the root, with inactive select-all.
    page.evaluate('docs=docs.filter(d=>!["html","rootdup"].includes(d.id));openWorkspaceShareDialog()')
    assert 'root (Wurzel)' in page.locator('.workspace-share-group').first.inner_text()
    assert page.locator('[data-share-group="0"]').is_disabled()
    page.locator('#workspaceShareCancel').click()
    page.set_viewport_size({'width':390,'height':780})
    page.evaluate('openWorkspaceShareDialog()')
    geometry=page.locator('#modal').evaluate('''el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth})''')
    assert geometry['left']>=0 and geometry['right']<=geometry['width']+1,geometry
    assert page.locator('#workspaceShareSubmit').is_visible()
    print('PASS: empty-root grouping and responsive mobile dialog')
    if errors:raise AssertionError('Browser JavaScript errors: '+repr(errors))
    browser.close()
