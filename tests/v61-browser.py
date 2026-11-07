#!/usr/bin/env python3
"""v61: plus controls appear only for a hovered, selected or focused HTML node."""
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
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1100,'height':850})
        page.set_default_timeout(7000)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(inline_app(),wait_until='load',timeout=30000)
        source='# Ohne Attribute\n## [status:doing] Statusknoten\n- Listenpunkt\n  - Kindknoten\n- [ ] Aufgabe\n## [x] [status:done] [date:2026-11-08] Vollständig\n\nNormaler Absatz'
        page.evaluate('''(source) => {
          projects=[{id:'p61',name:'Test',created:Date.now(),folders:[]}];projectId='p61';
          docs=[{id:'md',projectId:'p61',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
          docId='md';view='html';put=async()=>{};render();
        }''',source)
        page.mouse.move(5,5)
        first=page.locator('#html-md-heading-0 [data-html-menu-toggle]')
        second=page.locator('#html-md-heading-1 [data-html-menu-toggle]')
        lst=page.locator('.html-md-list-row [data-html-menu-toggle]')
        assert first.count()==1 and second.count()==1 and lst.count()>=2
        assert not first.is_visible() and not second.is_visible() and not lst.first.is_visible()
        assert page.locator('#html-md-heading-0 .html-md-node-controls').evaluate('(el)=>getComputedStyle(el).display')=='none'
        # Heading hover: only its own plus, without selecting the node.
        page.locator('#html-md-heading-0 h1').hover()
        assert first.is_visible() and not second.is_visible() and not lst.first.is_visible()
        page.mouse.move(5,5)
        assert not first.is_visible()
        # List hover must not expose controls on child list nodes.
        rows=page.locator('.html-md-list-row')
        assert rows.count()==3
        rows.nth(0).locator('.html-md-list-text').hover()
        assert lst.nth(0).is_visible() and not lst.nth(1).is_visible()
        page.mouse.move(5,5)
        assert not lst.nth(0).is_visible()
        print('PASS: hidden by default, scoped heading and nested-list hover, no reserved empty controls')
        # Node click makes its plus stick even after the cursor leaves.
        page.locator('#html-md-heading-0 h1').click()
        page.mouse.move(5,5)
        assert first.is_visible() and not second.is_visible()
        page.locator('#html-md-heading-1 h2').click()
        page.mouse.move(5,5)
        assert not first.is_visible() and second.is_visible()
        assert page.locator('#html-md-heading-1 [data-html-status]').count()==1
        page.locator('.html-md-toc summary').click()
        page.mouse.move(5,5)
        assert not first.is_visible() and not second.is_visible()
        print('PASS: click selection persists, switches nodes and clears outside')
        # Keyboard focus also exposes controls, including an empty metadata row.
        page.locator('#html-md-heading-0').focus()
        assert first.is_visible()
        page.locator('#html-md-heading-1').focus()
        assert not first.is_visible() and second.is_visible()
        page.locator('#html-md-heading-0 h1').click()
        first.click()
        assert page.locator('#html-md-heading-0 [data-html-attr-add="task"]').is_visible()
        page.mouse.move(5,5)
        assert first.is_visible()  # open menu doesn't lose its anchor
        page.locator('#html-md-heading-0 [data-html-attr-add="task"]').click()
        page.wait_for_function('docs[0].content.startsWith("# [ ] Ohne Attribute")')
        assert page.locator('[data-html-task="0"]').count()==1
        print('PASS: focus and attribute dropdown remain functional')
        # Touch: tapping title reveals menu toggle without requiring hover.
        touch=browser.new_page(viewport={'width':390,'height':760},has_touch=True,is_mobile=True)
        touch.set_default_timeout(7000)
        touch.set_content(inline_app(),wait_until='load',timeout=30000)
        touch.evaluate('''(source) => {
          projects=[{id:'p61',name:'Test',created:Date.now(),folders:[]}];projectId='p61';
          docs=[{id:'md',projectId:'p61',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
          docId='md';view='html';put=async()=>{};render();
        }''',source)
        touch.locator('#html-md-heading-0 h1').tap()
        assert touch.locator('#html-md-heading-0 [data-html-menu-toggle]').is_visible()
        touch.locator('#html-md-heading-0 [data-html-menu-toggle]').tap()
        assert touch.locator('#html-md-heading-0 [data-html-attr-add="date"]').is_visible()
        print('PASS: touch tap exposes plus and opens options on narrow displays')
        assert not errors,errors
        browser.close()

if __name__=='__main__':main()
