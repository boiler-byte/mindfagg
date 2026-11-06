#!/usr/bin/env python3
"""v44: browser patch menu, modal, four import paths, validation, atomic apply/undo/redo.

Runs inline production scripts and a transaction-only IndexedDB double because
local/HTTP navigation is unavailable in the isolated headless test runtime.
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
      projects=[{id:'p44',name:'Test v44',created:Date.now(),folders:['src','patches']}];
      projectId='p44';
      const create=(id,path,content,fileType='script')=>({id,projectId:'p44',path,name:path.split('/').pop(),fileType,content,updatedAt:Date.now()});
      docs=[create('html','index.html','<h1>Old</h1>\\nEnd'),
        create('js','src/app.js','fetch(url)\\nfetch(url)\\nend'),
        create('stored','patches/example.patch.json',JSON.stringify({patches:[{file:'index.html',description:'From project',hunks:[{search:'Old',replace:'Project',occurrence:1}]}]}))];
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

h=lambda search,replace,occurrence=1:dict(search=search,replace=replace,occurrence=occurrence)
patch=lambda entries:json.dumps(dict(patches=entries),ensure_ascii=False)
entry=lambda file,hunks,description='Change':dict(file=file,description=description,hunks=hunks)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1200,'height':900})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)
    assert page.locator('#collapseFolders svg rect[stroke-dasharray]').count()==1,'new dashed collapse icon missing'
    assert page.locator('#collapseFolders svg path[d="M8 12h8"]').count()==1,'minus line missing'
    page.locator('#workspacePatchQuick').click()
    assert page.locator('#patchTool').is_visible()
    assert page.locator('#patchApplyTitle').inner_text()=='Einspielen'
    assert page.locator('#patchCreateTitle').inner_text()=='Erstellen'
    page.locator('#patchCopyPrompt').click()
    assert '"patches"' in page.evaluate('window.clipboardWritten')

    content=patch([entry('index.html',[h('Old','New')]),entry('src/app.js',[h('fetch(url)','fetchNew(url)',2),h('MISSING','never')])])
    page.evaluate('(text)=>window.clipboardText=text',content)
    page.locator('#patchPasteClipboard').click()
    assert page.locator('[data-patch-operation]').count()==3
    assert page.locator('[data-patch-operation]:checked').count()==3
    assert page.locator('#patchApply').is_disabled()
    page.locator('[data-patch-file="1"] summary').click()
    assert 'nicht gefunden' in page.locator('[data-patch-file="1"]').inner_text()
    assert page.evaluate('docs.find(d=>d.id==="html").content')=='<h1>Old</h1>\nEnd','preview modified source'
    page.locator('[data-patch-operation="1:1"]').uncheck()
    assert page.locator('#patchApply').is_enabled()
    page.locator('#patchApply').click()
    page.wait_for_function('!document.querySelector("#patchTool") || document.querySelector("#modalBack").classList.contains("hidden")')
    assert page.evaluate('docs.find(d=>d.id==="html").content')=='<h1>New</h1>\nEnd'
    assert page.evaluate('docs.find(d=>d.id==="js").content')=='fetch(url)\nfetchNew(url)\nend'
    assert page.evaluate('testDbTables.docs.get("html").content')=='<h1>New</h1>\nEnd'
    assert page.evaluate('deletionHistoryFor("p44").undo.length')==1
    assert page.evaluate('deletionHistoryFor("p44").undo[0].changes.length')==2
    page.evaluate('changeHistory("undo")')
    page.wait_for_function('docs.find(d=>d.id==="html").content.includes("Old")')
    assert page.evaluate('docs.find(d=>d.id==="js").content')=='fetch(url)\nfetch(url)\nend'
    assert page.evaluate('testDbTables.docs.get("js").content')=='fetch(url)\nfetch(url)\nend'
    page.evaluate('changeHistory("redo")')
    page.wait_for_function('docs.find(d=>d.id==="html").content.includes("New")')
    assert page.evaluate('docs.find(d=>d.id==="js").content')=='fetch(url)\nfetchNew(url)\nend'
    print('PASS: menu, dashed icon, prompt copy, preview, opt-out, 2-file atomic apply and one undo/redo')

    page.evaluate('openPatchTool()')
    assert page.locator('#patchProjectFile option').count()==2
    page.locator('#patchProjectFile').select_option('stored')
    page.locator('#patchLoadProject').click()
    assert page.locator('#patchJsonInput').input_value().startswith('{"patches"')
    assert page.locator('#patchApply').is_disabled(),'Original Old search no longer matches after redo'
    page.evaluate('changeHistory("undo")')
    page.wait_for_function('docs.find(d=>d.id==="html").content.includes("Old")')
    # A new preview must re-evaluate source after external changes.
    page.locator('#patchJsonInput').dispatch_event('input')
    page.locator('.patch-validate-link').click()
    assert page.locator('#patchApply').is_enabled()
    page.locator('#patchClose').click()
    print('PASS: project .patch.json selection and missing target detection')

    page.evaluate('openPatchTool()')
    upload=patch([entry('index.html',[h('Old','fromFile')])])
    page.locator('#patchFileInput').set_input_files({'name':'example.json','mimeType':'application/json','buffer':upload.encode()})
    page.wait_for_function('document.querySelector("#patchApply")?.disabled===false')  # async File.text()
    assert 'fromFile' in page.locator('#patchJsonInput').input_value()
    dropped=patch([entry('index.html',[h('Old','fromDrop')])])
    page.evaluate('''(data)=>{
      const transfer=new DataTransfer();
      transfer.items.add(new File([data],'drop.json',{type:'application/json'}));
      const drop=document.querySelector('#patchDropzone');
      drop.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
    }''',dropped)
    page.wait_for_function('document.querySelector("#patchJsonInput").value.includes("fromDrop")')
    page.wait_for_function('document.querySelector("#patchApply")?.disabled===false')  # async drop File.text()
    page.locator('#patchJsonInput').fill('{"patches":[]}')
    page.locator('.patch-validate-link').click()
    assert 'abgelehnt' in page.locator('#patchToolMessage').inner_text()
    assert page.locator('#patchApply').is_disabled()
    page.locator('#patchFileInput').set_input_files({'name':'invalid.txt','mimeType':'text/plain','buffer':b'{}'})
    assert 'Nur .json' in page.locator('#patchToolMessage').inner_text()
    assert page.locator('#patchApply').is_disabled()
    print('PASS: JSON file selection, drag-and-drop, invalid schema, invalid file extension')
    if errors: raise AssertionError('Browser JS exceptions: '+repr(errors))
    browser.close()
