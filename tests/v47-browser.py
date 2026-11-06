#!/usr/bin/env python3
"""v47: global share select/size/copy and browser/system back overlays.

As in the previous versions, inject the production modules into a temporary
browser document. The test replaces only the persistent DB initialization and
native share permission prompts.
"""
import json
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
    setup = '''<script>
      window.testStorageData={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>testStorageData[key]??null,setItem:(key,value)=>{testStorageData[key]=String(value)},removeItem:key=>{delete testStorageData[key]}}});
    </script>'''
    html = html.replace('<body>', '<body>' + setup, 1)
    fixture = '''<script>
      projects=[{id:'p47',name:'Projekt v47',created:Date.now(),folders:['src','assets','empty']}];
      projectId='p47';
      const mk=(id,path,content,fileType='script')=>({id,projectId:'p47',path,name:path.split('/').pop(),fileType,content,updatedAt:Date.now()});
      docs=[mk('unicode','index.html','Ä😀'),mk('other','readme.txt','é'),
        mk('code','src/app.js','12345'),
        {id:'binary',projectId:'p47',path:'assets/logo.png',name:'logo.png',fileType:'image',data:new Uint8Array([12,27,18])}];
      docId='unicode';view='markdown';activeFilePanel='script';
      flushSource=async()=>{};flushMapInlineEdit=async()=>{};
      window.testShares=[];window.testDownloads=[];window.copiedPhrase=null;
      Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length>0});
      Object.defineProperty(navigator,'share',{configurable:true,value:data=>{testShares.push(data);return Promise.resolve()}});
      saveWorkspaceBlob=(blob,name)=>{testDownloads.push({blob,name})};
      writeMapClipboard=async phrase=>{window.copiedPhrase=phrase;return true};
      render();
    </script>'''
    return html.replace('</body>', fixture + '</body>')


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                 args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1180, 'height': 870})
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.set_content(inline_app(), wait_until='load', timeout=60000)

    page.evaluate('openWorkspaceShareDialog()')
    assert page.locator('#workspaceShareAll').count() == 1
    assert page.locator('#workspaceShareAll').is_checked()
    assert page.locator('#workspaceShareCount').inner_text() == '4 von 4 gewählt'
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 16 B'
    assert page.locator('label:has([data-share-file="unicode"]) .workspace-share-size').inner_text() == '6 B'
    assert page.locator('label:has([data-share-file="other"]) .workspace-share-size').inner_text() == '2 B'
    assert page.locator('label:has([data-share-file="code"]) .workspace-share-size').inner_text() == '5 B'
    assert page.locator('label:has([data-share-file="binary"]) .workspace-share-size').inner_text() == '3 B'
    assert page.locator('.workspace-share-totals').bounding_box()['y'] >= page.locator('.workspace-share-list').bounding_box()['y']
    print('PASS: full selection and exact UTF-8/binary byte sizes')

    page.locator('#workspaceShareAll').uncheck()
    assert page.locator('#workspaceShareCount').inner_text() == '0 von 4 gewählt'
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 0 B'
    assert page.locator('#workspaceShareSubmit').is_disabled()
    assert page.locator('[data-share-file]:checked').count() == 0
    page.locator('[data-share-group="0"]').check()
    assert page.locator('#workspaceShareCount').inner_text() == '2 von 4 gewählt'
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 8 B'
    assert page.locator('#workspaceShareAll').evaluate('(e)=>e.indeterminate')
    page.locator('[data-share-file="unicode"]').uncheck()
    assert page.locator('[data-share-group="0"]').evaluate('(e)=>e.indeterminate')
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 2 B'
    page.locator('#workspaceShareAll').check()
    assert page.locator('[data-share-file]:checked').count() == 4
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 16 B'
    print('PASS: global/group/item select sync, indeterminate status and live totals')

    # Copy is the *exact* string used by the Patch Tool, not a shortened copy.
    buttons = page.locator('#workspaceShareDialog .workspace-share-actions button')
    assert buttons.all_text_contents() == ['Patch-Phrase kopieren', 'Abbrechen', 'Teilen']
    page.locator('#workspaceShareCopyPatch').click()
    page.wait_for_function('window.copiedPhrase !== null')
    assert page.evaluate('window.copiedPhrase === PATCH_TOOL_PROMPT')
    assert page.locator('#workspaceShareDialog').is_visible()
    print('PASS: shared Patch Tool phrase copy, preserves dialog and button order')

    page.locator('[data-share-file="code"]').uncheck()
    page.locator('[name="workspaceShareMode"][value="zip"]').check()
    page.locator('#workspaceShareSubmit').click()
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    entries = page.evaluate('''async()=>
      (await unzipWorkspace(await window.testShares.at(-1).files[0].arrayBuffer())).map(e=>e.path)
    ''')
    assert 'index.html' in entries and 'assets/logo.png' in entries and 'src/app.js' not in entries
    assert 'src' not in entries
    print('PASS: selected share payload unaffected by totals controls')

    # New browser history entry protects the app from Back navigation. Back first
    # dismisses dialogs, then toggles the mobile sidebar on successive presses.
    page.set_viewport_size({'width': 390, 'height': 800})
    page.evaluate('setMobileMenu(false);initBrowserBackNavigation()')
    assert page.evaluate('history.state.__mindfaggBackGuard === true')
    page.evaluate('openModal("<h2>Dialog offen</h2>")')
    page.evaluate('history.back()')
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    assert page.locator('.app.menu-open').count() == 0
    assert page.evaluate('history.state.__mindfaggBackGuard === true')
    page.evaluate('history.back()')
    page.wait_for_function('document.querySelector(".app").classList.contains("menu-open")')
    assert page.locator('#menuToggle').get_attribute('aria-expanded') == 'true'
    page.evaluate('history.back()')
    page.wait_for_function('!document.querySelector(".app").classList.contains("menu-open")')
    assert page.locator('#menuToggle').get_attribute('aria-expanded') == 'false'
    print('PASS: Back closes dialog first, then opens/closes mobile sidebar')

    # Reopening while sidebar visible must keep it visible after closing a modal.
    page.evaluate('setMobileMenu(true);openModal("<h2>Modal</h2>")')
    page.evaluate('history.back()')
    page.wait_for_function('document.querySelector("#modalBack").classList.contains("hidden")')
    assert page.locator('.app.menu-open').count() == 1
    page.evaluate('history.back()')
    page.wait_for_function('!document.querySelector(".app").classList.contains("menu-open")')
    print('PASS: modal priority also works when sidebar already open')

    page.set_viewport_size({'width': 1180, 'height': 850})
    page.evaluate('setMobileMenu(false)')
    page.evaluate('history.back()')
    page.wait_for_function('document.querySelector(".app").classList.contains("back-sidebar-hidden")')
    assert page.locator('#mainSidebar').evaluate('(e)=>getComputedStyle(e).display') == 'none'
    page.evaluate('history.back()')
    page.wait_for_function('!document.querySelector(".app").classList.contains("back-sidebar-hidden")')
    assert page.locator('#mainSidebar').evaluate('(e)=>getComputedStyle(e).display') != 'none'
    print('PASS: Back toggles wide-screen sidebar as well')

    # A project containing zero files retains a disabled global checkbox.
    page.evaluate('docs=[];openWorkspaceShareDialog()')
    assert page.locator('#workspaceShareAll').is_disabled()
    assert page.locator('#workspaceShareBytes').inner_text() == 'Gesamtgröße: 0 B'
    assert page.locator('#workspaceShareSubmit').is_disabled()
    page.locator('#workspaceShareCancel').click()
    assert not errors, errors
    print('PASS: empty-project summary, no runtime errors; all v47 browser tests complete')
    browser.close()
