#!/usr/bin/env python3
"""v59: selection-aware whole-file diffs and permanently sandboxed HTML preview."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent

def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',
                lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js')
                else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    return html

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1100,'height':820})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        old,updated,new='Kopf\nalt 🚀\n','Kopf\nALTER 🚀\n','Kopf\nneuer Inhalt & 🚀\n'
        patch={'patches':[
            {'operation':'update','file':'example.txt','hunks':[
                {'search':'alt','replace':'ALTER','occurrence':1}]},
            {'operation':'replace','file':'example.txt','content':new}
        ]}
        page.evaluate('''old => {
          flushMapInlineEdit=async()=>true;flushSource=async()=>true;
          projects=[{id:'v59',name:'Test',created:Date.now(),folders:[]}];projectId='v59';
          docs=[{id:'file',projectId:'v59',path:'example.txt',name:'example.txt',fileType:'script',content:old}];
          docId='file';activeFilePanel='script';appSettingsOpen=false;
          render();openPatchTool();
        }''',old)
        page.locator('#patchJsonInput').fill(json.dumps(patch,ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        page.locator('[data-patch-file="1"] summary').click()

        def replace_info():
            return page.locator('[data-patch-file="1"] .patch-preview-operation')
        def delta():
            return replace_info().locator('.patch-operation-title .patch-size-delta').inner_text()
        def search_delta():
            return replace_info().locator('.patch-preview-diff-search .patch-size-delta').inner_text()
        def file_delta():
            return page.locator('[data-patch-file="1"] .patch-preview-file-counts .patch-size-delta').inner_text()

        expected_new=len(new.encode())-len(updated.encode())
        assert delta()==('+' if expected_new>0 else '')+f'{expected_new} B',delta()
        assert search_delta()==delta()
        assert replace_info().locator('.patch-preview-diff-search pre').inner_text()==updated
        assert replace_info().locator('.patch-preview-diff-replace pre').inner_text()==new
        assert replace_info().locator('.patch-diff-removed').count()>0
        assert replace_info().locator('.patch-diff-added').count()>0
        assert replace_info().locator('.patch-preview-diff').count()==1
        page.locator('[data-patch-operation="1:0"]').uncheck()
        assert delta()=='0 B',delta()
        assert search_delta()=='0 B',search_delta()
        assert file_delta()=='0 B'
        expected_update=len(updated.encode())-len(old.encode())
        assert page.locator('.patch-preview-total .patch-size-delta').inner_text()==f'+{expected_update} B'
        assert replace_info().locator('.patch-preview-diff-search pre').inner_text()==updated
        assert replace_info().locator('.patch-diff-removed').count()>0
        assert page.locator('[data-patch-file="1"]').get_attribute('open') is not None
        page.locator('[data-patch-file="0"] summary').click()
        page.locator('[data-patch-operation="0:0"]').uncheck()
        assert replace_info().locator('.patch-preview-diff-search pre').inner_text()==old
        page.locator('[data-patch-operation="1:0"]').check()
        expected_original=len(new.encode())-len(old.encode())
        assert delta()==f'+{expected_original} B',delta()
        assert search_delta()==delta()
        page.locator('[data-patch-operation="0:0"]').check()
        assert delta()==f'+{expected_new} B',delta()
        assert not errors,errors
        print('PASS: replace before/after compares selected virtual content; toggles display 0 B, resynchronize all size totals')

        test_html='''<!doctype html><html><head><title>Probe</title></head><body><h1 id="probe">Sandbox executed</h1><script>
            try { parent.document.body.dataset.compromised='true'; console.log('PARENT-ACCESSIBLE'); }
            catch(e) { console.log('PARENT-BLOCKED',e.name); }
            try { localStorage.setItem('probe','yes'); console.log('STORAGE-ACCESSIBLE'); }
            catch(e) { console.error('localStorage sandboxed:',e.name,e.message); }
            try { indexedDB.open('probe'); console.log('IDB-ACCESSIBLE'); }
            catch(e) { console.error('indexedDB sandboxed:',e.name,e.message); }
            console.log('V59-SCRIPT-EXECUTED');
        </script></body></html>'''
        page.evaluate('''html => {
          closeModal();
          docs=[{id:'html',projectId:'v59',path:'index.html',name:'index.html',fileType:'script',content:html}];
          docId='html';activeFilePanel='preview';htmlPreviewEntryId=null;renderHtmlPreview();
        }''',test_html)
        frame=page.locator('#htmlPreviewFrame')
        assert frame.get_attribute('sandbox')=='allow-scripts'
        assert page.evaluate("document.querySelector('#htmlPreviewFrame').contentDocument===null")
        page.wait_for_function("htmlPreviewLogs.some(log => log.text.includes('V59-SCRIPT-EXECUTED'))")
        logs=page.evaluate('htmlPreviewLogs.map(log=>log.text)')
        assert any('PARENT-BLOCKED' in log for log in logs),logs
        assert not any('PARENT-ACCESSIBLE' in log for log in logs),logs
        assert any('localStorage sandboxed:' in log for log in logs),logs
        assert not any('STORAGE-ACCESSIBLE' in log for log in logs),logs
        assert not any('IDB-ACCESSIBLE' in log for log in logs),logs
        assert page.evaluate('document.body.dataset.compromised') is None
        assert page.locator('[data-html-preview-storage-grant]').count()==0
        assert page.locator('.html-preview-storage-note').count()>0
        page.evaluate('''() => {appEditorSettings.previewStorageAccess=true; htmlPreviewLoad()}''')
        assert frame.get_attribute('sandbox')=='allow-scripts'
        assert page.locator('#htmlPreviewState').inner_text().startswith('Isolierte Vorschau')
        assert page.evaluate("document.querySelector('#htmlPreviewFrame').contentDocument===null")
        page.evaluate('openAppSettings()')
        assert page.locator('#appPreviewStorageAccess').count()==0
        assert 'Immer isoliert' in page.locator('.app-preview-isolation-note').inner_text()
        assert not errors,errors
        print('PASS: HTML preview always uses opaque sandbox (even with legacy opt-in), blocks app DOM/storage and cannot grant permission')
        browser.close()

if __name__=='__main__':main()
