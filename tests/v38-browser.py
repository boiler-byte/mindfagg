#!/usr/bin/env python3
"""v59 migration regression: the v38 storage opt-in no longer weakens the iframe."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
TEST_HTML=r'''<!doctype html><html><body><h1>Isolated</h1><script>
try { parent.document.body.dataset.previewEscaped = 'yes'; console.log('DOM-ACCESSIBLE'); }
catch(error) { console.log('DOM-BLOCKED',error.name); }
try { localStorage.setItem('old-optin-test', 'unsafe'); console.log('STORAGE-ACCESSIBLE'); }
catch(error) { console.error('localStorage sandboxed:',error.name,error.message); }
console.log('V38-MIGRATION-EXECUTED');
</script></body></html>'''

def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',
                lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js')
                else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    return html

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                               args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)
    page.evaluate('''html => {
      projects=[{id:'v38-migration',name:'Test',created:Date.now(),folders:[]}];
      projectId='v38-migration';
      docs=[{id:'html',projectId,name:'index.html',path:'index.html',fileType:'script',content:html}];
      docId='html';activeFilePanel='preview';
      appEditorSettings.previewStorageAccess=true; // simulate an old runtime flag
      renderHtmlPreview();
    }''',TEST_HTML)
    frame=page.locator('#htmlPreviewFrame')
    assert frame.get_attribute('sandbox')=='allow-scripts'
    assert page.evaluate("document.querySelector('#htmlPreviewFrame').contentDocument===null")
    page.wait_for_function("htmlPreviewLogs.some(log => log.text.includes('V38-MIGRATION-EXECUTED'))")
    logs=page.evaluate('htmlPreviewLogs.map(log=>log.text)')
    assert any('DOM-BLOCKED' in log for log in logs),logs
    assert any('localStorage sandboxed:' in log for log in logs),logs
    assert page.locator('[data-html-preview-storage-grant]').count()==0
    page.evaluate('openAppSettings()')
    assert page.locator('#appPreviewStorageAccess').count()==0
    assert 'Immer isoliert' in page.locator('.app-preview-isolation-note').inner_text()
    assert not errors,errors
    print('PASS: v38 privileged mode permanently revoked; HTML sandbox isolates DOM/storage, legacy settings cannot re-enable it')
    browser.close()
