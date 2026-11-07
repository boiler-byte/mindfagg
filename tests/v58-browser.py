#!/usr/bin/env python3
"""v58: per-Hunk byte deltas follow selection and sum to file/patch totals."""
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
        page=browser.new_page(viewport={'width':1100,'height':800})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''() => {
          flushMapInlineEdit=async()=>true;flushSource=async()=>true;
          projects=[{id:'v58',name:'Test',created:Date.now(),folders:[]}];projectId='v58';
          docs=[{id:'file-a',projectId:'v58',path:'a.txt',name:'a.txt',fileType:'script',
            content:'äA\\nold-large\\n'}];
          docId='file-a';activeFilePanel='script';view='markdown';appSettingsOpen=false;
          render();openPatchTool();
        }''')
        patch={'patches':[
            {'operation':'update','file':'a.txt','hunks':[
                {'search':'ä','replace':'€€','occurrence':1},       # +4 UTF-8 bytes
                {'search':'A','replace':'AA','occurrence':1},     # +1 byte
                {'search':'old-large','replace':'x','occurrence':1}, # -8 bytes
            ]},
            {'operation':'create','file':'new.txt','content':'test'}, # +4 bytes
        ]}
        page.locator('#patchJsonInput').fill(json.dumps(patch,ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        page.locator('[data-patch-file="0"] summary').click()

        def hunk_delta(index):
            return page.locator(f'[data-patch-operation="0:{index}"]').locator(
                'xpath=ancestor::div[contains(@class,"patch-preview-operation")]'
            ).locator('.patch-preview-diff-search .patch-size-delta').inner_text()

        def file_delta(index):
            return page.locator(f'[data-patch-file="{index}"] .patch-preview-file-counts .patch-size-delta').inner_text()

        def total_delta():
            return page.locator('.patch-preview-total .patch-size-delta').inner_text()

        def snapshot(expected_hunks,expected_file,expected_total):
            assert [hunk_delta(i) for i in range(3)]==expected_hunks,[hunk_delta(i) for i in range(3)]
            assert file_delta(0)==expected_file,file_delta(0)
            assert file_delta(1)=='+4 B',file_delta(1)
            assert total_delta()==expected_total,total_delta()

        snapshot(['+4 B','+1 B','-8 B'],'-3 B','+1 B')
        page.locator('[data-patch-operation="0:0"]').uncheck()
        snapshot(['0 B','+1 B','-8 B'],'-7 B','-3 B')
        page.locator('[data-patch-operation="0:2"]').uncheck()
        snapshot(['0 B','+1 B','0 B'],'+1 B','+5 B')
        page.locator('[data-patch-operation="0:0"]').check()
        snapshot(['+4 B','+1 B','0 B'],'+5 B','+9 B')
        page.locator('[data-patch-operation="0:2"]').check()
        snapshot(['+4 B','+1 B','-8 B'],'-3 B','+1 B')
        page.locator('[data-patch-operation="0:1"]').uncheck()
        snapshot(['+4 B','0 B','-8 B'],'-4 B','0 B')
        # Toggling an unrelated Hunk must not modify the first or third Hunk.
        page.locator('[data-patch-operation="0:1"]').check()
        snapshot(['+4 B','+1 B','-8 B'],'-3 B','+1 B')
        assert page.locator('[data-patch-file="0"]').get_attribute('open') is not None
        assert not errors,errors
        print('PASS: per-Hunk UTF-8 deltas follow checkboxes and match per-file and overall totals')
        browser.close()

if __name__=='__main__':
    main()
