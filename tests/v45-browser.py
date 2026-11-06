#!/usr/bin/env python3
"""v45: browser coverage for five file operations, selective saving and single undo.

Production JS/CSS are temporarily embedded into an in-memory page because file://
and HTTP navigation are unavailable in the isolated browser test environment.
"""
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
    html=html.replace('<body>', '<body>'+setup,1)
    fixture='''<script>
      projects=[{id:'p45',name:'Test v45',created:Date.now(),folders:['src','assets']}];
      projectId='p45';
      const create=(id,path,content,fileType='script')=>({id,projectId:'p45',path,name:path.split('/').pop(),fileType,content,updatedAt:Date.now()});
      docs=[create('html','index.html','<h1>Old</h1>\\nEnd'),
        create('app','src/app.js','fetch(url)\\nend'),
        create('old','src/old-name.js','old file'),
        {id:'image',projectId:'p45',path:'assets/logo.png',name:'logo.png',fileType:'image',data:new Uint8Array([1,2,3])}];
      window.testDbTables={projects:new Map(projects.map(p=>[p.id,structuredClone(p)])),docs:new Map(docs.map(d=>[d.id,structuredClone(d)]))};
      db={transaction(names,mode){
        const t={oncomplete:null,onerror:null,onabort:null,objectStore(name){return {
          put(record){testDbTables[name].set(record.id,structuredClone(record));return {result:record.id}},
          delete(id){testDbTables[name].delete(id);return {result:undefined}}
        }}};
        setTimeout(()=>t.oncomplete?.(),0);return t;
      }};
      docId='html';view='markdown';activeFilePanel='script';
      saveSource=async()=>{};flushSource=async()=>{};flushMapInlineEdit=async()=>{};
      window.clipboardWritten='';window.clipboardText='';
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>clipboardText,writeText:async value=>{clipboardWritten=value}}});
      render();document.querySelector('#workspacePatchQuick').onclick=()=>{void workspaceExecuteAction('patch')};
    </script>'''
    return html.replace('</body>',fixture+'</body>')

def p(operation,file,**fields):return dict(operation=operation,file=file,**fields)
def h(search,replace,occurrence=1):return dict(search=search,replace=replace,occurrence=occurrence)
def patch(*entries):return json.dumps({'patches':list(entries)},ensure_ascii=False)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1170,'height':850})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)
    page.locator('#workspacePatchQuick').click()
    assert page.locator('#patchTool').is_visible()
    assert page.locator('#patchSave').count()==1
    assert page.locator('#patchSave').is_checked() is False
    assert page.locator('#patchSave').evaluate('(el)=>!!(el.compareDocumentPosition(document.querySelector("#patchApply")) & Node.DOCUMENT_POSITION_FOLLOWING)'),'Save checkbox must be LEFT of apply button'
    page.locator('#patchCopyPrompt').click()
    for op in ('"create"','"update"','"replace"','"delete"','"rename"'):
        assert op in page.evaluate('window.clipboardWritten'),op
    body=patch(
        p('update','index.html',description='Update title',hunks=[h('Old','New'),h('MISSING','never')]),
        p('create','lib/hello.js',content="const name = 'Welt';"),
        p('replace','src/app.js',content='const ok=true;'),
        p('rename','src/old-name.js',to='lib/new-name.js',description='Move script'),
        p('delete','assets/logo.png',description='Remove logo')
    )
    page.locator('#patchJsonInput').fill(body)
    page.locator('.patch-validate-link').click()
    assert page.locator('[data-patch-operation]').count()==6
    assert page.locator('[data-patch-operation]:checked').count()==6
    assert page.locator('#patchApply').is_disabled()
    assert page.locator('.patch-preview-file').count()==5
    assert 'lib/new-name.js' in page.locator('#patchPreview').inner_text()
    page.locator('[data-patch-file="4"] summary').click()
    assert 'Löschen' in page.locator('[data-patch-file="4"]').inner_text()
    page.locator('[data-patch-file="0"] summary').click()
    page.locator('[data-patch-operation="0:1"]').uncheck()
    assert page.locator('#patchApply').is_enabled()
    page.locator('#patchSave').check()
    page.locator('#patchApply').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    assert page.evaluate('docs.find(d=>d.id==="html").content')=='<h1>New</h1>\nEnd'
    assert page.evaluate('docs.find(d=>d.id==="app").content')=='const ok=true;'
    assert page.evaluate('docs.find(d=>d.id==="old").path')=='lib/new-name.js'
    assert page.evaluate('docs.find(d=>d.id==="image")') is None
    assert page.evaluate('docs.some(d=>d.path==="lib/hello.js")')
    assert page.evaluate('project().folders.includes("lib")')
    assert page.evaluate('testDbTables.docs.has("image")') is False
    assert page.evaluate('testDbTables.docs.get("old").path')=='lib/new-name.js'
    saved=page.evaluate('docs.find(d=>/\\.patch\\.json$/.test(d.path))')
    assert saved and re.fullmatch(r'\d{4}-\d{2}-\d{2}-\d{6}\.patch\.json',saved['path']),saved
    assert '/' not in saved['path'],'Patch log must be in workspace root'
    selected=json.loads(saved['content'])['patches']
    assert len(selected)==5
    assert len(selected[0]['hunks'])==1
    assert selected[0]['hunks'][0]['replace']=='New'
    assert page.evaluate('deletionHistoryFor("p45").undo.length')==1
    assert page.evaluate('deletionHistoryFor("p45").undo[0].changes.length')==6,'Five files and saved patch must be ONE undo'
    assert page.evaluate('testDbTables.docs.has("'+saved['id']+'")') is True
    print('PASS: five operations, selection, atomic save with root timestamp and one project-level history entry')

    page.evaluate('changeHistory("undo")')
    page.wait_for_function('docs.find(d=>d.id==="html").content.includes("Old")')
    assert page.evaluate('docs.find(d=>d.id==="app").content')=='fetch(url)\nend'
    assert page.evaluate('docs.find(d=>d.id==="old").path')=='src/old-name.js'
    assert page.evaluate('docs.some(d=>d.id==="image")')
    assert page.evaluate('docs.some(d=>d.path==="lib/hello.js")') is False
    assert page.evaluate('docs.some(d=>/\\.patch\\.json$/.test(d.path))') is False
    assert page.evaluate('project().folders.includes("lib")') is False
    assert page.evaluate('testDbTables.docs.has("'+saved['id']+'")') is False
    page.evaluate('changeHistory("redo")')
    page.wait_for_function('docs.find(d=>d.id==="html").content.includes("New")')
    assert page.evaluate('docs.some(d=>/\\.patch\\.json$/.test(d.path))')
    assert page.evaluate('docs.find(d=>d.id==="image")') is None
    assert page.evaluate('project().folders.includes("lib")')
    print('PASS: Undo/Redo restores renamed, created, deleted and replaced files, folders and saved patch together')

    page.evaluate('openPatchTool()')
    options=page.locator('#patchProjectFile option').all_inner_texts()
    assert any(saved['path'] in option for option in options)
    page.locator('#patchProjectFile').select_option(saved['id'])
    page.locator('#patchLoadProject').click()
    assert page.locator('[data-patch-operation]').count()==5
    assert page.locator('#patchApply').is_disabled(),'Already applied patch must not silently overwrite/create duplicate files'
    page.locator('#patchClose').click()
    page.evaluate('openPatchTool()')
    page.locator('#patchJsonInput').fill(patch(p('create','test.txt',content='A')))
    page.locator('.patch-validate-link').click()
    assert page.locator('#patchApply').is_enabled()
    assert page.locator('#patchSave').is_checked() is False
    page.locator('#patchApply').click()
    page.wait_for_function('docs.some(d=>d.path==="test.txt")')
    assert page.evaluate('docs.filter(d=>/\\.patch\\.json$/.test(d.path)).length')==1,'Unchecked save must not create a new patch file'
    print('PASS: reloading saved patch, collision prevention, opt-out saving')
    if errors:raise AssertionError('Browser runtime exceptions: '+repr(errors))
    browser.close()
