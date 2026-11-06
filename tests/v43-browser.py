#!/usr/bin/env python3
"""v43 regression: diagnostics/minimap, pointer-safe modal, folder state/deletion, clipboard actions.

Uses isolated inline scripts and a minimal IndexedDB transaction double because
headless network/file navigation is disabled in this test environment.
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app(storage=None):
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    initial=json.dumps(storage or {})
    storage_script='''<script>
      window.testStorageData='''+initial+''';
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:key=>Object.prototype.hasOwnProperty.call(testStorageData,key)?testStorageData[key]:null,
        setItem:(key,value)=>{testStorageData[key]=String(value)},
        removeItem:key=>{delete testStorageData[key]}
      }});
    </script>'''
    html=html.replace('<body>', '<body>'+storage_script,1)
    fixture='''<script>
      projects=[{id:'p43',name:'App v43',created:Date.now(),folders:['dir','dir/child','other','empty']}];
      projectId='p43';
      const d=(id,path,content)=>({id,projectId:'p43',path,name:path.split('/').pop(),fileType:'script',content,updatedAt:Date.now()});
      docs=[d('valid','dir/valid.js','const one = 1;\\nconst two = 2;'),
        d('nested','dir/child/nested.js','const nested = 3;'),
        d('bad','other/broken.js','const x = ;'),
        d('keep','other/stay.js','console.log("safe")')];
      // Project/document persistence is exercised through the real workspace batch
      // functions; this double only replaces the IndexedDB transaction boundary.
      window.testDbTables={projects:new Map(projects.map(p=>[p.id,structuredClone(p)])),docs:new Map(docs.map(d=>[d.id,structuredClone(d)]))};
      db={transaction(names,mode){
        const t={oncomplete:null,onerror:null,onabort:null,objectStore(name){return {
          put(record){testDbTables[name].set(record.id,structuredClone(record));return {result:record.id}},
          delete(id){testDbTables[name].delete(id);return {result:undefined}}
        }}};
        setTimeout(()=>t.oncomplete?.(),0);return t;
      }};
      docId='valid';view='markdown';activeFilePanel='script';
      saveSource=async()=>{};flushSource=async()=>{};flushMapInlineEdit=async()=>{};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{readText:async()=>window.mockClipboard}});
      window.mockClipboard='';
      render();
      document.querySelector('#collapseFolders').onclick=workspaceCollapseFolders;
    </script>'''
    return html.replace('</body>',fixture+'</body>')

with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1240,'height':850})
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(inline_app(),wait_until='load',timeout=60000)

  assert page.locator('#collapseFolders').is_visible()
  assert page.locator('#collapseFolders').evaluate('(el)=>el.nextElementSibling.id')=='addDocument'
  page.locator('[data-folder-toggle="dir"]').click()
  assert page.locator('[data-folder-toggle="dir"]').get_attribute('aria-expanded')=='false'
  assert page.locator('[data-folder-toggle="dir/child"]').count()==0
  assert page.locator('#collapseFolders').is_visible()
  # Reinitialize all the production scripts with exactly the same localStorage
  # snapshot to emulate an app restart and prove initial folder-state restoration.
  saved=page.evaluate('structuredClone(testStorageData)')
  page.close();page=browser.new_page(viewport={'width':1240,'height':850});page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(inline_app(saved),wait_until='load',timeout=60000)
  assert page.locator('[data-folder-toggle="dir"]').get_attribute('aria-expanded')=='false'
  assert page.locator('[data-folder-toggle="dir/child"]').count()==0
  page.locator('#collapseFolders').click()
  assert page.locator('#collapseFolders').is_hidden()
  assert all(v=='false' for v in page.locator('[data-folder-toggle]').evaluate_all('(nodes)=>nodes.map(el=>el.getAttribute("aria-expanded"))'))
  saved=page.evaluate('structuredClone(testStorageData)')
  page.close();page=browser.new_page(viewport={'width':1240,'height':850});page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(inline_app(saved),wait_until='load',timeout=60000)
  assert page.locator('#collapseFolders').is_hidden()
  page.locator('[data-folder-toggle="dir"]').click()
  assert page.locator('#collapseFolders').is_visible()
  assert page.locator('[data-folder-toggle="dir/child"]').count()==1
  print('PASS: collapse-all visibility/order and project-scoped folder state restore')

  # A press on the dialog/input followed by a backdrop release MUST NOT close it.
  page.evaluate('openWorkspaceFolderSettings("dir")')
  assert page.locator('#removeFolder').inner_text()=='Ordner löschen'
  name=page.locator('#folderNewName')
  rect=name.bounding_box()
  page.mouse.move(rect['x']+10,rect['y']+rect['height']/2)
  page.mouse.down()
  page.mouse.move(5,5,steps=6)
  page.mouse.up()
  assert page.locator('#folderEditForm').is_visible(),'Input text drag dismissed the dialog'
  # An outside-to-inside drag must not synthesize a backdrop dismissal either.
  page.mouse.move(5,5);page.mouse.down()
  page.mouse.move(rect['x']+10,rect['y']+rect['height']/2,steps=6);page.mouse.up()
  assert page.locator('#folderEditForm').is_visible()
  page.mouse.click(5,5)
  assert page.locator('#modalBack').is_hidden()
  print('PASS: drag-started-in-dialog does not close it; actual backdrop click does')

  # Empty deletes immediately, nonempty shows confirmation and atomically removes
  # descendants while preserving the existing batch undo mechanism.
  page.evaluate('openWorkspaceFolderSettings("empty")')
  assert page.locator('#removeFolder').inner_text()=='Leeren Ordner löschen'
  page.locator('#removeFolder').click()
  page.wait_for_function('!workspaceFolderPaths().includes("empty")')
  assert page.locator('#modalBack').is_hidden()
  page.evaluate('openWorkspaceFolderSettings("dir")')
  page.locator('#removeFolder').click()
  assert page.locator('#confirmFolderDelete').is_visible()
  assert '2 Dateien' in page.locator('#modal').inner_text()
  page.locator('#cancelFolderDelete').click()
  assert page.locator('#folderEditForm').is_visible()
  page.locator('#removeFolder').click()
  page.locator('#confirmFolderDelete').click()
  page.wait_for_function('!workspaceFolderPaths().includes("dir")')
  assert not page.evaluate('docs.some(d=>workspacePath(d).startsWith("dir/"))')
  assert page.evaluate('docs.some(d=>d.id==="keep")')
  assert 'dir' not in page.evaluate('project().folders')
  assert not page.evaluate('testDbTables.docs.has("valid")||testDbTables.docs.has("nested")')
  assert page.locator('#modalBack').is_hidden()
  page.evaluate('changeHistory("undo")')
  page.wait_for_function('workspaceFolderPaths().includes("dir")')
  assert page.evaluate('docs.some(d=>d.id==="valid") && docs.some(d=>d.id==="nested")')
  assert 'dir/child' in page.evaluate('project().folders')
  assert page.evaluate('testDbTables.docs.has("valid")&&testDbTables.docs.has("nested")')
  # A folder with no files but with nested folders is nonempty as well.
  page.evaluate('project().folders.push("vacant","vacant/nested");render()')
  page.evaluate('openWorkspaceFolderSettings("vacant")')
  assert page.locator('#removeFolder').inner_text()=='Ordner löschen'
  page.locator('#removeFolder').click()
  assert '0 Dateien' in page.locator('#modal').inner_text()
  page.locator('#confirmFolderDelete').click()
  page.wait_for_function('!workspaceFolderPaths().includes("vacant")')
  assert not page.evaluate('workspaceFolderPaths().includes("vacant/nested")')
  print('PASS: folder delete confirmation, nested files, empty child folders, persisted writes, single-batch undo')

  # Toolbar insert uses the textarea selection, replace changes full contents.
  page.evaluate('selectDocument("valid")')
  page.locator('#scriptSource').focus()
  page.evaluate('''()=>{document.querySelector('#scriptSource').setSelectionRange(14,14);mockClipboard='MIDDLE\\n';}''')
  page.locator('#scriptClipboardToggle').click()
  assert page.locator('#scriptClipboardMenu').is_visible()
  page.locator('#scriptClipboardInsert').click()
  page.wait_for_function('documentNow().content.includes("MIDDLE\\n")')
  assert page.evaluate('documentNow().content')=='const one = 1;MIDDLE\n\nconst two = 2;'
  assert page.locator('#scriptClipboardToggle').get_attribute('aria-expanded')=='false'
  page.evaluate('mockClipboard="function fixed() { return 1; }"')
  page.locator('#scriptClipboardToggle').click()
  page.locator('#scriptClipboardReplace').click()
  page.wait_for_function('documentNow().content === "function fixed() { return 1; }"')
  assert page.locator('#scriptSource').input_value()=='function fixed() { return 1; }'
  page.evaluate('()=>{navigator.clipboard.readText=async()=>{throw new DOMException("Denied","NotAllowedError")}}')
  page.locator('#scriptClipboardToggle').click()
  page.locator('#scriptClipboardReplace').click()
  page.wait_for_function('document.querySelector("#toast").textContent.includes("Zwischenablage konnte")')
  assert page.evaluate('documentNow().content')=='function fixed() { return 1; }'
  print('PASS: clipboard insert at cursor, replace all text, deny handling')

  # Diagnostic rows are painted red on the SAME canvas as regular minimap rows.
  page.evaluate('selectDocument("bad")')
  page.wait_for_function('scriptValidationState.errors.length > 0')
  page.evaluate('''()=>{
    window.redRects=[];
    const ctx=document.querySelector('#scriptMiniCanvas').getContext('2d');
    const orig=ctx.fillRect.bind(ctx);
    ctx.fillRect=function(...args){if(this.fillStyle==='#ff657e')redRects.push(args);return orig(...args)};
    drawScriptMinimap();
  }''')
  assert page.evaluate('redRects.length>0')
  page.evaluate('()=>{navigator.clipboard.readText=async()=>"const fixed = 1;"}')
  page.locator('#scriptClipboardToggle').click()
  page.locator('#scriptClipboardReplace').click()
  page.wait_for_function('scriptValidationState.errors.length===0')
  page.evaluate('redRects=[];drawScriptMinimap()')
  assert page.evaluate('redRects.length')==0
  print('PASS: red editor diagnostics appear in minimap and disappear after repair')

  # Folding keeps placeholder summaries out of persisted text.
  page.evaluate('''()=>{appEditorSettings.codeFolding=true;applyAppEditorPreferences();
    const d=docs.find(d=>d.id==='valid');d.content='function outer(){\\n const secret=1;\\n return secret;\\n}';
    docId='valid';render();mockClipboard='// inserted\\n';
    navigator.clipboard.readText=async()=>mockClipboard; }''')
  page.locator('#scriptFoldGutter button').first.click()
  assert 'eingeklappt' in page.locator('#scriptSource').input_value()
  page.evaluate('''()=>{const e=document.querySelector('#scriptSource');const n=e.value.indexOf('eingeklappt');e.setSelectionRange(n,n)}''')
  page.locator('#scriptClipboardToggle').click()
  page.locator('#scriptClipboardInsert').click()
  page.wait_for_function('documentNow().content.includes("// inserted")')
  assert 'eingeklappt' not in page.evaluate('documentNow().content')
  print('PASS: clipboard insertion at collapsed section preserves canonical text')

  # On narrow screens the menu must open upward from the bottom script toolbar.
  page.set_viewport_size({'width':390,'height':760})
  page.locator('#scriptClipboardToggle').click()
  assert page.locator('#scriptClipboardMenu').is_visible()
  toolbar=page.locator('#scriptClipboardToggle').bounding_box()
  dropdown=page.locator('#scriptClipboardMenu').bounding_box()
  assert dropdown['y']+dropdown['height']<=toolbar['y']+4,(dropdown,toolbar)
  page.locator('#scriptClipboardInsert').click()
  print('PASS: mobile clipboard dropdown opens above bottom toolbar')

  assert not errors,errors
  print('PASS: no JavaScript runtime errors')
  browser.close()
