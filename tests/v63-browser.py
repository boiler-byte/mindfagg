#!/usr/bin/env python3
"""v63: share dialog clipboard labels and lossless selected create patch export."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def inline_app():
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>' + (ROOT / m.group(1)).read_text() + '</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '' if m.group(1) in ('ui/bindings.js', 'core/service-worker.js')
                  else '<script>' + (ROOT / m.group(1)).read_text().replace('</script', '<\\/script') + '</script>', html)
    fixture = '''<script>
      projects=[{id:'source',name:'Quelle',folders:['assets','src','docs']}];projectId='source';
      const doc=(id,path,content,type='script')=>({id,projectId:'source',path,name:path.split('/').at(-1),fileType:type,content});
      docs=[doc('a','src/main.js','const emoji = "😎";\\nconst escaped = "\\\\path";'),
        doc('b','docs/readme.md','# Dokument\\n\\nEintrag [x]','markdown'),
        {id:'c',projectId:'source',path:'assets/logo.png',name:'logo.png',fileType:'image',data:new Uint8Array([0,1,2,253,254,255])},
        {id:'d',projectId:'source',path:'assets/huge.bin',name:'huge.bin',fileType:'binary',data:Uint8Array.from({length:24579},(_,i)=>i%256)}];
      window.copiedText=null;window.copyCount=0;
      writeMapClipboard=async text=>{window.copiedText=text;window.copyCount++;return true};
      render();
    </script>'''
    return html.replace('</body>', fixture + '</body>')


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                 args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1100, 'height': 840})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(inline_app(), wait_until='load', timeout=60000)
    page.evaluate('openWorkspaceShareDialog()')
    assert page.locator('#workspaceShareCopyPatch').inner_text() == 'Patch Phrase'
    assert page.locator('#workspaceShareExportPatch').inner_text() == 'Patch Export'
    assert page.locator('#workspaceShareCopyPatch svg').count() == 1
    assert page.locator('#workspaceShareExportPatch svg').count() == 1
    page.locator('#workspaceShareCopyPatch').click()
    page.wait_for_function('window.copyCount === 1')
    assert page.evaluate('window.copiedText === PATCH_TOOL_PROMPT')
    assert page.locator('#workspaceShareDialog').is_visible()

    # Honor individual selection, including binary content. No non-selected
    # file or phrase can leak into the exported JSON payload.
    page.locator('[data-share-file="b"]').uncheck()
    page.locator('#workspaceShareExportPatch').click()
    page.wait_for_function('window.copyCount === 2')
    page.evaluate('window.savedExportPatch=window.copiedText')
    result = page.evaluate('''() => {
      const patch=parseWorkspacePatch(window.copiedText);
      projects.push({id:'target',name:'Ziel',folders:[]});
      const plan=planWorkspacePatch(patch,new Set(patch.patches.map((_,i)=>i+':0')),'target');
      return {
        paths:patch.patches.map(p=>p.file),types:patch.patches.map(p=>p.operation),
        binary:patch.patches.filter(p=>p.encoding==='base64').map(p=>p.file),
        text:patch.patches.find(p=>p.file==='src/main.js').content,
        errors:plan.errors,deltas:plan.operations.map(row=>row.byteDelta),
        data:plan.finalFiles.filter(d=>!docIsText(d)).map(d=>({path:d.path,kind:d.fileType,bytes:Array.from(d.data)}))
      };
    }''')
    assert result['paths'] == ['src/main.js', 'assets/logo.png', 'assets/huge.bin']
    assert result['types'] == ['create'] * 3
    assert result['binary'] == ['assets/logo.png', 'assets/huge.bin']
    assert result['text'] == 'const emoji = "😎";\nconst escaped = "\\path";'
    assert result['errors'] == 0
    assert result['data'][0] == {'path': 'assets/logo.png', 'kind': 'image', 'bytes': [0, 1, 2, 253, 254, 255]}
    assert result['data'][1]['path'] == 'assets/huge.bin'
    assert result['data'][1]['kind'] == 'binary'
    assert result['data'][1]['bytes'] == [i % 256 for i in range(24579)]
    assert result['deltas'][1:] == [6, 24579]
    assert page.locator('#workspaceShareDialog').is_visible()
    print('PASS: both clipboard buttons, selected create patches, Unicode and binary bytes across Base64 chunk boundary')

    # A zero selection must disable the export button and leave the clipboard unchanged.
    page.locator('#workspaceShareAll').check()
    page.locator('#workspaceShareAll').uncheck()
    assert page.locator('#workspaceShareExportPatch').is_disabled()
    assert page.evaluate('window.copyCount') == 2
    page.locator('[data-share-file="b"]').check()
    assert page.locator('#workspaceShareExportPatch').is_enabled()
    page.locator('#workspaceShareExportPatch').click()
    page.wait_for_function('window.copyCount === 3')
    assert page.evaluate('JSON.parse(window.copiedText).patches.map(p=>p.file)') == ['docs/readme.md']
    page.evaluate("projectId='target'")
    page.locator('#workspaceShareExportPatch').click()
    assert page.evaluate('window.copyCount') == 3
    print('PASS: empty selection, re-selection and changed-project protection')

    # Validate format errors before clipboard writes.
    page.evaluate("projectId='source'")
    limits = page.evaluate('''() => {
      let oversize='',tooMany='',invalidBase64='';
      try{workspaceShareCreatePatch([{path:'large.txt',fileType:'script',content:'a'.repeat(4*1024*1024)}])}catch(e){oversize=e.message}
      try{workspaceShareCreatePatch(Array.from({length:501},(_,i)=>({path:'f'+i+'.txt',fileType:'script',content:'x'})))}catch(e){tooMany=e.message}
      try{parseWorkspacePatch(JSON.stringify({patches:[{operation:'create',file:'bad.png',encoding:'base64',content:'AQ==='}]}))}catch(e){invalidBase64=e.message}
      return {oversize,tooMany,invalidBase64};
    }''')
    assert '4 MB' in limits['oversize']
    assert '500' in limits['tooMany'] or 'Zu viele' in limits['tooMany']
    assert 'Base64' in limits['invalidBase64']
    print('PASS: oversized, too-many-files and invalid Base64 patches are rejected')

    # Buttons remain reachable on narrow screens.
    page.set_viewport_size({'width': 360, 'height': 760})
    assert page.locator('#workspaceShareCopyPatch').is_visible()
    assert page.locator('#workspaceShareExportPatch').is_visible()
    assert page.locator('#workspaceShareExportPatch').bounding_box()['x'] >= 0
    assert page.locator('#workspaceShareExportPatch').bounding_box()['x'] + page.locator('#workspaceShareExportPatch').bounding_box()['width'] <= 360
    # Apply exported patch using the production Patch Tool and transactional
    # commit path. The destination is intentionally empty to avoid collisions.
    page.evaluate('''() => {
      closeModal();projectId='target';docId=null;
      window.testDbTables={projects:new Map(projects.map(p=>[p.id,structuredClone(p)])),docs:new Map()};
      db={transaction(names,mode){
        const t={oncomplete:null,onerror:null,onabort:null,objectStore(name){return {
          put(record){testDbTables[name].set(record.id,structuredClone(record));return {result:record.id}},
          delete(id){testDbTables[name].delete(id);return {result:undefined}}
        }}};
        setTimeout(()=>t.oncomplete?.(),0);return t;
      }};
      flushSource=async()=>{};flushMapInlineEdit=async()=>{};
      openPatchTool();patchToolLoadText(window.savedExportPatch);
    }''')
    assert page.locator('#patchApply').is_enabled()
    assert 'Binärdatei' in page.locator('#patchPreview').text_content()
    page.locator('#patchApply').click()
    page.wait_for_function('docs.some(d=>d.projectId==="target"&&d.path==="assets/logo.png")')
    assert page.evaluate('Array.from(docs.find(d=>d.projectId==="target"&&d.path==="assets/logo.png").data)') == [0,1,2,253,254,255]
    assert page.evaluate('testDbTables.docs.size') == 3
    assert not errors, errors
    print('PASS: mobile dialog and atomic Patch Tool apply of exported binary/text files, no runtime errors')
    browser.close()
