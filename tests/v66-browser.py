#!/usr/bin/env python3
"""v66 browser behavior: breadcrumb copies direct links; initial routing restores views.

The execution environment blocks HTTP/file navigation. Like the existing v65 tests,
this test inlines the app and simulates IndexedDB persistence during bootstrap.
"""
import re
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda m:'<style>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
    def script_tag(match):
        name=match.group(1)
        if name=='core/service-worker.js':return ''
        script=(ROOT/name).read_text(encoding='utf-8')
        if name=='ui/bindings.js':
            # Use the actual UI click handlers; only postpone IndexedDB init.
            script=script.replace("init().catch(e=>{console.error(e);toast('IndexedDB konnte nicht geöffnet werden')});",'')
        return '<script>'+script.replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<script src="([^"]+)"></script>',script_tag,html)
    return html


SETUP='''({address,savedProject='project-b-456',savedDoc='note-b',savedView='markdown'})=>{
  const ls=new Map(Object.entries({msProject:savedProject,msDoc:savedDoc,mfLastView:savedView}));
  Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>ls.get(k)??null,setItem:(k,v)=>ls.set(k,String(v)),
      removeItem:k=>ls.delete(k),clear:()=>ls.clear()
  }});
  if(address)history.replaceState({},'',address);
  projects=[{id:'project-a-123',name:'Alpha',created:100,folders:[]},
            {id:'project-b-456',name:'Beta',created:200,folders:[]}];
  docs=[{id:'note-a',projectId:'project-a-123',path:'Docs/Plan.md',name:'Plan',fileType:'markdown',content:'# Plan\\n## Ziele\\n- Aufgabe\\n'},
        {id:'note-b',projectId:'project-b-456',path:'Beta.md',name:'Beta',fileType:'markdown',content:'# Beta\\n## Zweites Kapitel\\n'},
        {id:'js-b',projectId:'project-b-456',path:'scripts/app.js',name:'app.js',fileType:'script',content:'function start(){ return 42; }'}];
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
    writeText:async text=>{window.__copied=text},readText:async()=>window.__copied
  }});
}'''


def open_app(browser,address=None):
    page=browser.new_page(viewport={'width':1160,'height':810})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(inline_app(),wait_until='load',timeout=60000)
    page.evaluate(SETUP,{'address':address})
    return page,errors


def start_app(page):
    # No IndexedDB needed: the two stored projects were seeded in SETUP.
    page.evaluate('''async()=>{
       indexedDB.open=()=>{
         const request={result:{}};
         queueMicrotask(()=>request.onsuccess?.());
         return request;
       };
       githubRestoreCredentials=async()=>{};
       refresh=async()=>{};
       await init();
    }''')


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page,errors=open_app(browser,'about:blank?unrelated=preserved&project=old&fileId=old&view=html#obsolete')
        page.evaluate("projectId='project-a-123';docId='note-a';view='mindmap';render()")
        crumb=page.locator('#breadcrumb')
        assert crumb.evaluate('element=>element.tagName')=='BUTTON'
        assert crumb.is_enabled()
        assert crumb.text_content()=='Alpha / Docs/Plan.md'
        assert 'kopieren' in crumb.get_attribute('title')
        crumb.click()
        copied=page.evaluate('window.__copied')
        assert copied.startswith('about:blank?unrelated=preserved&'),copied
        assert parse_qs(urlparse(copied).query)=={
            'unrelated':['preserved'],'project':['project-a-123'],
            'fileId':['note-a'],'view':['mindmap']},copied
        assert urlparse(copied).fragment=='',copied
        assert page.evaluate('location.search').startswith('?unrelated=preserved&project=old'), 'Click must not change the current URL'
        assert 'Direktlink kopiert' in page.locator('#toast').inner_text()
        assert not errors,errors
        print('PASS: accessible breadcrumb copies project/fileId/view, preserves other query and leaves the location unchanged',flush=True)
        page.close()

        # Simulate a fresh page startup with saved preferences pointing elsewhere.
        page,errors=open_app(browser,copied)
        start_app(page)
        assert page.evaluate('({projectId,docId,view})')=={'projectId':'project-a-123','docId':'note-a','view':'mindmap'}
        assert page.locator('[data-view="mindmap"]').get_attribute('aria-selected')=='true'
        assert 'Plan' in page.locator('#surface').inner_text()
        assert page.evaluate("localStorage.getItem('msDoc')")=='note-a'
        assert not errors,errors
        print('PASS: URL route overrides previous local selection and restores mindmap on initial startup',flush=True)
        page.close()

        for tab in ('calendar','html','kanban','markdown'):
            page,errors=open_app(browser)
            page.evaluate(f"projectId='project-a-123';docId='note-a';setView('{tab}');render()")
            page.locator('#breadcrumb').click()
            link=page.evaluate('window.__copied')
            assert parse_qs(urlparse(link).query)['view']==[tab],(tab,link)
            page.close()
            page,errors2=open_app(browser,link)
            start_app(page)
            assert page.evaluate('({projectId,docId,view})')=={'projectId':'project-a-123','docId':'note-a','view':tab}
            assert page.locator(f'[data-view="{tab}"]').get_attribute('aria-selected')=='true'
            assert not errors+errors2,errors+errors2
            page.close()
        print('PASS: markdown, kanban, HTML and calendar round-trip through their deep-link URLs',flush=True)

        page,errors=open_app(browser)
        page.evaluate("projectId='project-b-456';docId='js-b';activeFilePanel='functions';render()")
        assert page.locator('[data-file-panel="functions"]').get_attribute('aria-selected')=='true'
        page.locator('#breadcrumb').click()
        script_link=page.evaluate('window.__copied')
        assert parse_qs(urlparse(script_link).query)=={
            'project':['project-b-456'],'fileId':['js-b'],'view':['functions']}
        page.close()
        page,errors2=open_app(browser,script_link)
        start_app(page)
        assert page.evaluate('({projectId,docId,activeFilePanel})')=={
            'projectId':'project-b-456','docId':'js-b','activeFilePanel':'functions'}
        assert page.locator('[data-file-panel="functions"]').get_attribute('aria-selected')=='true'
        assert not errors+errors2,errors+errors2
        print('PASS: script-file panel (functions) reopens on the correct project and file',flush=True)
        page.close()

        page,errors=open_app(browser,'about:blank?project=project-a-123&fileId=js-b&view=mindmap')
        start_app(page)
        assert page.evaluate('({projectId,docId})')=={'projectId':'project-b-456','docId':'note-b'}
        assert 'nicht verfügbar' in page.locator('#toast').inner_text()
        assert not errors,errors
        page.close()
        page,errors=open_app(browser,'about:blank?project=project-a-123&fileId=note-a&view=invalid')
        start_app(page)
        assert page.evaluate('({projectId,docId,view})')=={'projectId':'project-a-123','docId':'note-a','view':'markdown'}
        assert 'Unbekannte Ansicht' in page.locator('#toast').inner_text()
        assert not errors,errors
        print('PASS: cross-project file IDs rejected; invalid views safely fall back with notice',flush=True)

        page.evaluate('''()=>{
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}});
          document.execCommand=(cmd)=>{
            if(cmd==='copy'){window.__fallbackCopied=document.activeElement.value;return true}
            return false;
          };
        }''')
        page.locator('#breadcrumb').click()
        assert page.evaluate('window.__fallbackCopied===directLinkUrl()')
        assert 'Direktlink kopiert' in page.locator('#toast').inner_text()
        page.evaluate('openAppSettings()')
        assert page.locator('#breadcrumb').is_disabled()
        assert 'Einstellungen' in page.locator('#breadcrumb').text_content()
        page.set_viewport_size({'width':375,'height':780})
        page.evaluate("selectProject('project-a-123')")
        assert page.locator('#breadcrumb').is_enabled()
        dimensions=page.locator('#breadcrumb').bounding_box()
        assert dimensions['x']>=0 and dimensions['x']+dimensions['width']<=375,dimensions
        assert not errors,errors
        print('PASS: denied clipboard falls back to legacy copy; settings are disabled; mobile layout usable',flush=True)
        page.close()
        browser.close()

if __name__=='__main__':
    main()
