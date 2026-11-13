#!/usr/bin/env python3
"""v64: App-setting notices for Markdown editor controls in Chromium."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT=Path(__file__).resolve().parent.parent

def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda m:'<style>'+ (ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',
                lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js')
                else '<script>'+(ROOT/m.group(1)).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>',html)
    return html

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    for width in (1130,375):
        page=browser.new_page(viewport={'width':width,'height':800})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('openAppSettings()')
        wrap=page.locator('label.app-setting-row:has(#appWordWrap)')
        folding=page.locator('label.app-setting-row:has(#appCodeFolding)')
        assert wrap.is_visible() and folding.is_visible()
        assert 'Bei aktiviertem Wordwrap' in wrap.locator('.app-setting-compat-note').inner_text()
        assert 'nicht verfügbar' in wrap.locator('.app-setting-compat-note').inner_text()
        assert 'mindestens ein Abschnitt eingeklappt' in folding.locator('.app-setting-compat-note').inner_text()
        assert 'Alle Abschnitte aufklappen' in folding.locator('.app-setting-compat-note').inner_text()
        for row in (wrap,folding):
            assert row.locator('.app-setting-compat-note').is_visible()
            assert page.evaluate('''(el)=>{
                 const style=getComputedStyle(el),rect=el.getBoundingClientRect();
                 return style.display==='block'&&rect.width>0&&rect.height>0;
            }''',row.locator('.app-setting-compat-note').element_handle())
        assert not page.locator('#appWordWrap').is_checked()
        assert not page.locator('#appCodeFolding').is_checked()
        page.locator('#appWordWrap').check()
        page.locator('#appCodeFolding').check()
        assert page.evaluate('appEditorSettings.wordWrap && appEditorSettings.codeFolding')
        assert wrap.locator('.app-setting-compat-note').is_visible()
        assert folding.locator('.app-setting-compat-note').is_visible()
        page.locator('#appWordWrap').uncheck()
        page.locator('#appCodeFolding').uncheck()
        assert not page.evaluate('appEditorSettings.wordWrap || appEditorSettings.codeFolding')
        assert not errors,errors
        print(f'PASS: setting notices and preferences, viewport={width}px')
        page.close()
    browser.close()
