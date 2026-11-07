#!/usr/bin/env python3
"""v55 end-to-end checks for active/inactive patch diff colors and live refresh."""
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
        page=browser.new_page(viewport={'width':1200,'height':850})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''() => {
          flushMapInlineEdit=async()=>true;flushSource=async()=>true;
          projects=[{id:'p55',name:'Testprojekt',created:Date.now(),folders:[]}];projectId='p55';
          docs=[{id:'a',projectId:'p55',name:'code.js',path:'code.js',fileType:'script',
            content:'const number = 1;\\nconst next = true;\\nA😀Z\\n'}];
          docId='a';activeFilePanel='script';view='markdown';appSettingsOpen=false;render();openPatchTool();
        }''')
        patch={'patches':[{'operation':'update','file':'code.js','hunks':[
            {'search':'const number = 1;','replace':'const number = 2;','occurrence':1},
            {'search':'const next = true;','replace':'const next = false;','occurrence':1},
            {'search':'A😀Z','replace':'A🦊Z','occurrence':1}
        ]}]}
        page.locator('#patchJsonInput').fill(json.dumps(patch,ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        page.locator('[data-patch-file="0"] summary').click()
        row=page.locator('.patch-preview-operation').first
        assert row.get_attribute('class').find('patch-active')>=0
        assert row.locator('.patch-diff-unchanged').first.inner_text()=='const number = '
        assert row.locator('.patch-diff-removed').inner_text()=='1'
        assert row.locator('.patch-diff-added').inner_text()=='2'
        def color_snapshot(index=0):
            return page.locator('.patch-preview-operation').nth(index).evaluate('''el => {
              const css = (selector)=> {
                const s=el.querySelector(selector);
                if(!s)return null;
                const style=getComputedStyle(s);
                return {color:style.color,strike:style.textDecorationLine.includes('line-through'),
                  text:s.textContent};
              };
              return {active:el.classList.contains('patch-active'),
                inactive:el.classList.contains('patch-inactive'),
                removed:css('.patch-diff-removed'),added:css('.patch-diff-added'),
                common:css('.patch-diff-unchanged')};
            }''')
        colors=color_snapshot()
        assert colors['removed']['color']=='rgb(255, 210, 216)' and colors['removed']['strike'],colors
        assert colors['added']['color']=='rgb(196, 248, 214)' and not colors['added']['strike'],colors
        assert colors['common']['color']=='rgb(197, 213, 233)' and not colors['common']['strike'],colors
        print('PASS: selected Hunk shows only removed red/struck, inserted green, unchanged neutral')

        page.locator('[data-patch-operation="0:0"]').uncheck()
        off=color_snapshot()
        assert off['inactive'] and not off['active'],off
        assert off['removed']['color']=='rgb(196, 248, 214)' and not off['removed']['strike'],off
        assert off['added']['color']=='rgb(255, 210, 216)' and off['added']['strike'],off
        assert off['common']==colors['common'],(off,colors)
        assert page.locator('[data-patch-file="0"]').get_attribute('open') is not None
        assert color_snapshot(1)['active']
        assert page.locator('#patchPreview').locator('.patch-preview-total').count()==1
        assert page.locator('[data-patch-operation="0:0"]').count()==1
        print('PASS: deselected Hunk flips red/green immediately and preserves open file and other selection')

        page.locator('[data-patch-operation="0:0"]').check()
        on=color_snapshot()
        assert on['active'] and on['removed']==colors['removed'] and on['added']==colors['added'],on
        page.locator('[data-patch-operation="0:2"]').uncheck()
        assert color_snapshot(2)['removed']['text']=='😀'
        assert color_snapshot(2)['added']['text']=='🦊'
        assert color_snapshot(2)['inactive']
        page.locator('[data-patch-operation="0:2"]').check()
        assert color_snapshot(2)['active']
        print('PASS: reselect Hunk restores colors; Unicode replacements behave identically')
        assert not errors,errors
        browser.close()

if __name__=='__main__':main()
