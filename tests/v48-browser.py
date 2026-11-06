#!/usr/bin/env python3
"""v48 browser smoke: persistent sidebar actions, token-gated GitHub and SVG menus.

Inlines the unchanged production modules for an isolated browser run, with a
fake workspace; the real ui/bindings.js is executed with only its init()
bootstrap suppressed to avoid IndexedDB/network access in this fixture.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    before='''<script>
      window.testStorage={};
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>testStorage[k]??null,setItem:(k,v)=>{testStorage[k]=String(v)},removeItem:k=>{delete testStorage[k]}}});
    </script>'''
    html=html.replace('<body>','<body>'+before,1)
    fixture='''<script>
      projects=[{id:'p48',name:'Projekt',created:Date.now(),folders:['src']}];projectId='p48';
      docs=[{id:'file',projectId:'p48',path:'src/index<NEW>.html',name:'index<NEW>.html',fileType:'script',content:'hi'}];
      docId='file';view='markdown';activeFilePanel='script';
      flushMapInlineEdit=async()=>{};flushSource=async()=>{};
      render();
    </script>'''
    bindings=(ROOT/'ui/bindings.js').read_text()
    assert 'setMobileMenu(false);initBrowserBackNavigation();init().catch' in bindings
    bindings=bindings[:bindings.rindex('setMobileMenu(false);initBrowserBackNavigation();init().catch')]
    return html.replace('</body>',fixture+'<script>'+bindings+'</script></body>')


def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1170,'height':850})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        assert not errors,errors
        assert page.locator('#githubSync').is_hidden(), 'Button must be hidden without token'
        assert page.locator('#workspacePatchQuick').is_visible()
        assert page.locator('#workspaceShareQuick').is_visible()
        assert page.locator('#workspacePatchQuick').bounding_box()['y']==page.locator('#workspaceShareQuick').bounding_box()['y']
        assert page.locator('#workspaceMore').get_attribute('title')=='Download'
        assert page.locator('#workspaceMore').get_attribute('aria-label')=='Download'
        # Add menu must include file/folder/zip icons but no duplicate patch.
        page.locator('#addDocument').click()
        assert page.locator('[data-workspace-action="patch"]').count()==0
        assert page.locator('[data-workspace-action="new-file"] .workspace-menu-icon svg').count()==1
        assert page.locator('[data-workspace-action="new-folder"] .workspace-menu-icon svg').count()==1
        assert page.locator('[data-workspace-action="zip-import"] .workspace-menu-icon svg').count()==1
        assert page.locator('[data-workspace-action="new-file"] .workspace-menu-icon svg path[d="M14 2v6h6"]').count()==1
        assert page.locator('[data-workspace-action="new-folder"] .workspace-menu-icon svg path[d^="M20 20H4"]').count()==1
        assert page.locator('[data-workspace-action="zip-import"] .workspace-menu-icon svg rect').count()==1
        page.evaluate('closeWorkspaceActionMenu()')
        page.locator('#workspaceMore').click()
        assert page.locator('[data-workspace-action="zip-share"]').count()==0
        assert page.locator('[data-workspace-action="zip-download"] .workspace-menu-icon svg rect').count()==1
        assert page.locator('[data-workspace-action="file-download"] .workspace-menu-icon svg path[d="M14 2v6h6"]').count()==1
        assert page.locator('[data-workspace-action="file-download"] small').inner_text()=='index<NEW>.html'
        assert page.locator('[data-workspace-action="file-download"] small').evaluate('(el)=>el.children.length')==0
        page.evaluate('closeWorkspaceActionMenu()')
        # Token in memory must reveal the button, removing it must hide it again.
        page.evaluate("githubCredentialToken='github_pat_test';githubUpdateIndicator()")
        assert page.locator('#githubSync').is_visible()
        assert (page.locator('#githubSync').bounding_box()['y']+page.locator('#githubSync').bounding_box()['height'])<page.locator('#workspacePatchQuick').bounding_box()['y']
        page.evaluate('githubCredentialToken=null;githubUpdateIndicator()')
        assert page.locator('#githubSync').is_hidden()
        # Direct buttons are wired by actual production bindings.
        page.locator('#workspacePatchQuick').click()
        page.locator('#patchTool').wait_for()
        assert page.locator('#patchTool').is_visible()
        page.locator('#patchClose').click()
        page.locator('#workspaceShareQuick').click()
        page.locator('#workspaceShareDialog').wait_for()
        assert page.locator('[data-share-file]').count()==1
        page.locator('#workspaceShareCancel').click()
        page.evaluate('projectId=null;render()')
        assert page.locator('#workspacePatchQuick').is_disabled()
        assert page.locator('#workspaceShareQuick').is_disabled()
        assert not errors,errors
        print('PASS: v48 sidebar buttons, GitHub token visibility, downloadable filename and SVG icons')
        page.set_viewport_size({'width':390,'height':800})
        page.evaluate("projectId='p48';docId='file';render();setMobileMenu(true)")
        assert page.locator('#workspacePatchQuick').is_visible()
        assert page.locator('#workspaceShareQuick').is_visible()
        assert page.locator('#workspacePatchQuick').bounding_box()['y']==page.locator('#workspaceShareQuick').bounding_box()['y']
        assert page.locator('#workspacePatchQuick').bounding_box()['width']>80
        assert not errors,errors
        print('PASS: mobile side-by-side actions')
        browser.close()


if __name__=='__main__':run()
