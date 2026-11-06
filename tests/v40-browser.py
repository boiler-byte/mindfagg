#!/usr/bin/env python3
"""v40/v41 browser regression: default folding, GitHub API suggestions, find/replace."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent

def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    fixture='''
      projects=[{id:'p40',name:'App v40',created:Date.now(),folders:[]}];projectId='p40';
      githubCredentialAccount='miramax11';githubCredentialToken='test-only';
      githubApi=async()=>[{full_name:'miramax11/demo',private:true},{full_name:'miramax11/examples',private:false}];
      saveSource=async()=>{};
      window.loadV40=(name,content)=>{
        docs=[{id:name,projectId:'p40',name,path:name,fileType:'script',content,updatedAt:Date.now()}];
        docId=name;setView('markdown');activeFilePanel='script';render();
      };
    '''
    return html.replace('</body>','<script>'+fixture+'</script></body>')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=50000)
    assert page.evaluate('appEditorSettings.codeFolding') is False
    page.evaluate('openAppSettings()')
    assert not page.locator('#appCodeFolding').is_checked()
    page.locator('#appCodeFolding').check()
    assert page.evaluate('appEditorSettings.codeFolding') is True
    page.locator('#resetAppSettings').click()
    assert not page.locator('#appCodeFolding').is_checked()
    assert page.evaluate('appEditorSettings.codeFolding') is False
    page.evaluate('closeAppSettings()')
    print('PASS: Code Folding default and reset both off')

    page.evaluate('openGithubDialog()')
    repository=page.locator('#githubRepository')
    repository.focus()
    page.wait_for_function("document.querySelector('#githubRepoOptions option') !== null")
    assert repository.get_attribute('list')=='githubRepoOptions'
    assert page.locator('#githubRepoOptions option').count()==2
    assert page.locator('#githubRepoOptions option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')==['miramax11/demo','miramax11/examples']
    repository.fill('miramax11/examples')  # native datalist values can be entered or selected
    assert repository.input_value()=='miramax11/examples'
    assert page.locator('#githubRepoSuggestion').count()==0
    repository.fill('miramax11/demo')
    assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/miramax11/demo'
    repository.fill('somebody/repo')
    assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/somebody/repo'
    page.locator('#cancelModal').click()
    print('PASS: native GitHub datalist and unrestricted owner/repo entry')

    samples={
        'index.html':'<section>\n  Alpha\n  Alpha\n</section>\n',
        'styles.css':'div {\n  Alpha: 1;\n  Alpha: 2;\n}\n',
        'logic.js':'function hello() {\n  const Alpha = 1;\n  const Alpha2 = 2;\n}\n',
        'doc.xml':'<root>\n  <Alpha/>\n  <Alpha/>\n</root>\n',
        'graphic.svg':'<svg>\n  <text>Alpha</text>\n  <text>Alpha</text>\n</svg>\n'
    }
    for name,source in samples.items():
        page.evaluate('(v)=>loadV40(v[0],v[1])',[name,source])
        assert page.locator('#scriptFindToggle').is_visible(),name
        assert not page.locator('#scriptFindWidget').is_visible(),name
        page.locator('#scriptFindToggle').click()
        assert page.locator('#scriptFindWidget').is_visible(),name
        assert not page.locator('#scriptReplaceRow').is_visible(),name
        page.locator('#scriptFindQuery').fill('alpha')
        assert page.locator('#scriptFindCount').inner_text()=='1 von 2',name
        page.locator('#scriptFindCase').click()
        assert page.locator('#scriptFindCount').inner_text()=='0 Treffer',name
        page.locator('#scriptFindCase').click()
        assert page.locator('#scriptFindCount').inner_text()=='1 von 2',name
        page.locator('#scriptFindNext').click()
        assert page.locator('#scriptFindCount').inner_text()=='2 von 2',name
        assert page.locator('.script-find-highlight').count()==2,name
        page.locator('#scriptFindExpand').click()
        assert page.locator('#scriptReplaceRow').is_visible(),name
        page.locator('#scriptReplaceText').fill('Beta')
        page.locator('#scriptReplaceOne').click()
        assert page.evaluate('documentNow().content').count('Beta')==1,name
        assert page.evaluate('documentNow().content').count('Alpha')==1,name
        page.locator('#scriptReplaceAll').click()
        after=page.evaluate('documentNow().content')
        assert after==source.replace('Alpha','Beta'),(name,repr(after))
        page.locator('#scriptFindClose').click()
        assert not page.locator('#scriptFindWidget').is_visible(),name
    print('PASS: HTML, CSS, JS, XML and SVG: literal case toggle, next/previous, replace and replace-all')

    # Multiline find and replace (both source query and replacement contain newlines).
    text='one\nTWO\nend\none\nTWO\nend\n'
    page.evaluate('(t)=>loadV40("multiline.js",t)',text)
    page.keyboard.press('Control+f')
    assert page.locator('#scriptFindWidget').is_visible()
    page.locator('#scriptFindQuery').fill('one\nTWO')
    assert page.locator('#scriptFindCount').inner_text()=='1 von 2'
    page.locator('#scriptFindExpand').click()
    page.locator('#scriptReplaceText').fill('new\nVALUE\nmore')
    page.locator('#scriptReplaceAll').click()
    actual=page.evaluate('documentNow().content')
    assert actual=='new\nVALUE\nmore\nend\nnew\nVALUE\nmore\nend\n',repr(actual)
    page.locator('#scriptFindQuery').fill('new\nVALUE')
    assert page.locator('#scriptFindCount').inner_text()=='1 von 2'
    page.locator('#scriptFindQuery').focus()
    page.keyboard.press('Shift+Enter')
    assert page.locator('#scriptFindQuery').input_value().endswith('\n')
    page.locator('#scriptFindQuery').fill('a.*b')
    assert page.locator('#scriptFindCount').inner_text()=='0 Treffer'
    page.keyboard.press('Escape')
    assert not page.locator('#scriptFindWidget').is_visible()
    page.keyboard.press('Control+h')
    assert page.locator('#scriptReplaceRow').is_visible()
    page.keyboard.press('Escape')
    print('PASS: Ctrl+F/Ctrl+H, literal no-regex search, multiline search/replace, Shift+Enter, Escape')

    # Code Folding is OFF by default, but search/replace must preserve hidden content if enabled.
    page.evaluate('appEditorSettings.codeFolding=true;applyAppEditorPreferences()')
    folded='function outer() {\n  const secret = "inside";\n  console.log(secret);\n}\nconst after = 9;\n'
    page.evaluate('(s)=>loadV40("folded.js",s)',folded)
    assert page.locator('#scriptFoldGutter button').count()>0
    page.locator('#scriptFoldGutter button').first.click()
    assert 'eingeklappt' in page.locator('#scriptSource').input_value()
    page.locator('#scriptFindToggle').click()
    page.locator('#scriptFindQuery').fill('secret')
    assert page.locator('#scriptFindCount').inner_text()=='1 von 2'
    assert 'eingeklappt' not in page.locator('#scriptSource').input_value()
    page.locator('#scriptFindExpand').click()
    page.locator('#scriptReplaceText').fill('renamed')
    page.locator('#scriptReplaceAll').click()
    assert page.evaluate('documentNow().content')==folded.replace('secret','renamed')
    print('PASS: search reveals folded match and replaces canonical content losslessly')

    # Mobile editor: bottom toolbar; search widget remains visible and replacement controls usable.
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('(s)=>loadV40("mobile.html",s)',samples['index.html'])
    assert page.locator('.app').evaluate('(el)=>el.classList.contains("mobile-script-active")')
    toolbar=page.locator('.script-editor-tools');frame=page.locator('.script-codeframe')
    assert toolbar.evaluate('(el)=>Number(getComputedStyle(el).order)')>frame.evaluate('(el)=>Number(getComputedStyle(el).order)')
    assert toolbar.bounding_box()['y']>frame.bounding_box()['y']
    toolbar.locator('#scriptFindToggle').click()
    page.locator('#scriptFindQuery').fill('Alpha')
    page.locator('#scriptFindExpand').click()
    page.locator('#scriptReplaceText').fill('Mobile')
    page.locator('#scriptReplaceAll').click()
    assert page.evaluate('documentNow().content')==samples['index.html'].replace('Alpha','Mobile')
    page.screenshot(path=str(ROOT.parent/'v40-mobile.png'))
    print('PASS: mobile toolbar below text area, search panel and replace-all on narrow screen')

    assert not errors,errors
    print('PASS: no runtime JavaScript errors')
    browser.close()
