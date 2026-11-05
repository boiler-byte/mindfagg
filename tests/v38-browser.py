#!/usr/bin/env python3
"""v38 Chromium regression for the sandbox, permission UI and console errors.
The test browser blocks all URL navigation (including localhost). The app is
therefore inlined on about:blank; actual native storage requires manual checking
on HTTPS/localhost outside this environment.
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TEST_HTML = r'''<!DOCTYPE html><html><head><title>Storage test</title></head><body><h1>Test</h1>
<script>
try { localStorage.setItem('mf38-preview-test', 'works'); console.log('localStorage-OK'); }
catch (error) { console.error('localStorage:', error.name, error.message); }
try {
  const open = indexedDB.open('mf38-preview-example', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('notes');
  open.onsuccess = () => {
    const tx = open.result.transaction('notes', 'readwrite');
    tx.objectStore('notes').put('saved', 'key');
    tx.oncomplete = () => console.log('IndexedDB-OK');
  };
  open.onerror = () => console.error('IndexedDB failed:', open.error);
} catch (error) { console.error('IndexedDB:', error.name, error.message); }
</script></body></html>'''

INIT = '''
const p = {id:'p38', name:'HTML Vorschau', created:Date.now(), folders:[]};
projects=[p]; docs=[{id:'preview', projectId:p.id, name:'index.html', path:'index.html',
  fileType:'script',content:''' + json.dumps(TEST_HTML).replace('</script', '<\\/script') + '''}];
projectId=p.id;docId='preview';activeFilePanel='preview';
renderHtmlPreview();
'''

def inline_app():
    html=(ROOT/'index.html').read_text()
    def style(match):return '<style>'+(ROOT/match.group(1)).read_text()+'</style>'
    def script(match):
        src=match.group(1)
        if src in ('ui/bindings.js','core/service-worker.js'):return ''
        return '<script>'+(ROOT/src).read_text().replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',style,html)
    html=re.sub(r'<script src="([^"]+)"></script>',script,html)
    return html.replace('</body>','<script>'+INIT+'</script></body>')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
       args=['--no-sandbox','--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':1100,'height':820},service_workers='block')
    page=ctx.new_page()
    errors=[]
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=30000)
    page.wait_for_selector('#htmlPreviewFrame')
    assert page.locator('#htmlPreviewFrame').get_attribute('sandbox')=='allow-scripts'
    page.wait_for_selector('[data-html-preview-storage-grant]',timeout=15000)
    assert page.locator('#htmlPreviewConsolePanel').is_visible(), 'console should open automatically'
    logs=page.locator('#htmlPreviewConsoleList').inner_text()
    assert 'localStorage' in logs and 'IndexedDB' in logs,logs
    assert page.evaluate("document.querySelector('#htmlPreviewFrame').contentDocument===null")
    print('PASS: sandbox default denies browser storage; detected error offers an immediate button')
    page.locator('[data-html-preview-storage-grant]').first.click()
    page.wait_for_function("document.querySelector('#htmlPreviewFrame')?.getAttribute('sandbox')==='allow-scripts allow-same-origin'")
    page.wait_for_function("document.querySelector('#htmlPreviewFrame')?.contentDocument?.body!==null",timeout=15000)
    assert page.evaluate('appEditorSettings.previewStorageAccess') is True
    # about:blank has no persistent storage: persistence is validated with a
    # deterministic storage stub in the separate Node regression test.
    assert 'nicht isoliert' in page.locator('#htmlPreviewState').inner_text()
    print('PASS: immediate grant reloads sandboxed frame with same-origin permission')
    page.evaluate('openAppSettings()')
    row=page.locator('#appPreviewStorageAccess')
    assert row.is_checked()
    assert 'GitHub' in page.locator('#appPreviewStorageWarning').inner_text()
    row.uncheck()
    assert page.evaluate('appEditorSettings.previewStorageAccess') is False
    assert not page.evaluate('appEditorSettings.previewStorageAccess')
    page.evaluate("closeAppSettings();activeFilePanel='preview';renderHtmlPreview()")
    page.wait_for_function("document.querySelector('#htmlPreviewFrame')?.getAttribute('sandbox')==='allow-scripts'")
    page.wait_for_selector('[data-html-preview-storage-grant]')
    assert page.locator('#htmlPreviewConsolePanel').is_visible()
    print('PASS: app settings toggle revokes storage on fresh preview')
    page.evaluate('openAppSettings()')
    page.locator('#appPreviewStorageAccess').check()
    page.evaluate("closeAppSettings();activeFilePanel='preview';renderHtmlPreview()")
    page.wait_for_function("document.querySelector('#htmlPreviewFrame')?.getAttribute('sandbox')==='allow-scripts allow-same-origin'")
    print('PASS: manual opt-in in settings re-enables the preview permission')
    assert not errors,errors
    ctx.close();browser.close()
