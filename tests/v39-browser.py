#!/usr/bin/env python3
"""v39: browser smoke/regression for lossless folds in six source languages."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
SAMPLES={
 'page.html':'<main>\n  <section>\n    <p>Hello</p>\n  </section>\n</main>\n<footer>End</footer>\n',
 'style.css':'body {\n  background: #111;\n  color: white;\n}\n.p { margin: 0; }\n',
 'app.js':'function hello() {\n  const user = {\n    name: "ok",\n    count: 1\n  };\n  return user;\n}\nconsole.log(hello());\n',
 'graphic.svg':'<svg xmlns="http://www.w3.org/2000/svg">\n  <g>\n    <path d="M0 0" />\n  </g>\n</svg>\n',
 'data.xml':'<?xml version="1.0"?>\n<root>\n  <child>\n    <item>Text</item>\n  </child>\n</root>\n',
 'PROJECT.md':'# Projekt\n## Kapitel\nEinleitung\n- Liste\n  - Unterpunkt\n  - Weiter\n## Anderes\n```js\nfunction f() {\n  return 1;\n}\n```\n',
}
def app_html():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    initial='''
      projects=[{id:'p39',name:'Folding-Test',created:Date.now(),folders:[]}];
      projectId='p39';
      saveSource=async()=>{};
      window.loadTestDoc=(name,content)=>{
        docs=[{id:name,projectId:'p39',name,path:name,fileType:name.endsWith('.md')?'markdown':'script',content,updatedAt:Date.now()}];
        docId=name;setView('markdown');activeFilePanel='script';render();
      };
    '''
    return html.replace('</body>','<script>'+initial+'</script></body>')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[]
    page.on('pageerror',lambda exc: errors.append(str(exc)))
    page.set_content(app_html(),wait_until='load',timeout=45000)
    assert page.evaluate('appEditorSettings.codeFolding') is False
    page.evaluate('appEditorSettings.codeFolding=true;applyAppEditorPreferences()')
    for name,src in SAMPLES.items():
        page.evaluate('(v)=>loadTestDoc(v[0],v[1])',[name,src])
        md=name.endswith('.md');selector='#source' if md else '#scriptSource'
        gutter='#markdownFoldGutter' if md else '#scriptFoldGutter'
        before=page.locator(selector).input_value()
        assert before==src,(name,before,src)
        buttons=page.locator(gutter+' button')
        assert buttons.count()>0,(name,'no buttons')
        if md:
            assert page.locator(gutter+' button').count()>=3,'headings/list/fences should be detected'
        buttons.first.click()
        short=page.locator(selector).input_value()
        assert len(short)<len(src),(name,short)
        assert 'eingeklappt' in short,(name,short)
        assert page.evaluate('documentNow().content')==src,(name,'content was modified by collapsing')
        # Edit an ordinary, visible line AFTER the placeholder. The hidden source stays intact.
        page.locator(selector).focus()
        page.evaluate('''(id)=>{const input=document.querySelector(id);input.setSelectionRange(input.value.length,input.value.length)}''',selector)
        page.keyboard.type('/* postfix */' if name.endswith(('.css','.js')) else ' visible',delay=7)
        actual=page.evaluate('documentNow().content')
        suffix='/* postfix */' if name.endswith(('.css','.js')) else ' visible'
        assert actual==src+suffix,(name,actual[-100:])
        assert 'eingeklappt' in page.locator(selector).input_value(),(name,'fold unexpectedly lost')
        # Unfold and confirm no code was removed.
        page.locator(gutter+' button.collapsed').first.click()
        assert page.locator(selector).input_value()==actual,(name,'unfold did not restore source')
        print('PASS:',name,'fold, visible edit, preserve hidden data, unfold')
    # Off and back on, using the existing user preference.
    page.evaluate("openAppSettings()")
    assert page.locator('#appCodeFolding').is_checked()
    page.locator('#appCodeFolding').uncheck()
    assert page.evaluate('appEditorSettings.codeFolding') is False
    page.evaluate("(src)=>{closeAppSettings();loadTestDoc('app.js',src)}",SAMPLES['app.js'])
    assert page.locator('#scriptFoldGutter button').count()==0
    assert page.locator('#scriptSource').input_value()==SAMPLES['app.js']
    page.evaluate('openAppSettings()')
    page.locator('#appCodeFolding').check()
    page.evaluate("(src)=>{closeAppSettings();loadTestDoc('app.js',src)}",SAMPLES['app.js'])
    assert page.locator('#scriptFoldGutter button').count()>0
    print('PASS: app settings switch disables/enables folding')
    assert not errors,errors
    browser.close()
