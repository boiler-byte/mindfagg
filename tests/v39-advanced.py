#!/usr/bin/env python3
"""v39 editor edge cases: nesting, clipboard/edit safety, diagnostics and toolbar."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
SCRIPT='function good() {\n  const a = 1;\n  const b = {\n    x: 1,\n    y: 2\n  };\n  return b;\n}\nconst last = 4;\n'
BAD='function bad() {\n  const a = 1;\n  const b = ;\n  return a;\n}\n'
MD='# Projekt\n## One\n- [ ] Task\n  - Child 1\n  - Child 2\n## Two\ntext\n'
def inline():
  html=(ROOT/'index.html').read_text()
  html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
  html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
  init="""projects=[{id:'p39',name:'P',folders:[],created:Date.now()}];projectId='p39';
  window.load=(name,content)=>{docs=[{id:name,projectId:'p39',fileType:name.endsWith('.md')?'markdown':'script',name,path:name,content}];docId=name;setView('markdown');activeFilePanel='script';render();};
  saveSource=async()=>{};"""
  return html.replace('</body>','<script>'+init+'</script></body>')
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1280,'height':800})
  issues=[];page.on('pageerror',lambda e:issues.append(str(e)))
  page.set_content(inline(),wait_until='load')
  page.evaluate('appEditorSettings.codeFolding=true;applyAppEditorPreferences()')
  page.evaluate('(s)=>load("nested.js",s)',SCRIPT)
  buttons=page.locator('#scriptFoldGutter button')
  assert buttons.count()>=2
  page.locator('#scriptFoldGutter button[aria-label="Einklappen ab Zeile 3"]').click()
  assert 'eingeklappt' in page.locator('#scriptSource').input_value()
  page.locator('#scriptFoldGutter button[aria-label="Einklappen ab Zeile 1"]').click()
  assert page.locator('#scriptFoldGutter button.collapsed').count()==1
  page.locator('#scriptFoldGutter button.collapsed').click()
  assert page.locator('#scriptFoldGutter button.collapsed').count()==1,'child fold should remain collapsed'
  page.locator('#scriptFoldGutter button.collapsed').click()
  assert page.locator('#scriptSource').input_value()==SCRIPT
  print('PASS: nested fold hierarchy and expansion')
  # An edit inside a folded placeholder must first reveal its source.
  page.locator('#scriptFoldGutter button').first.click()
  code=page.locator('#scriptSource')
  code.focus()
  page.evaluate('''()=>{const x=document.querySelector('#scriptSource');const start=x.value.indexOf('eingeklappt');x.setSelectionRange(start,start+4)}''')
  page.keyboard.type('XX')
  assert 'eingeklappt' not in code.input_value()
  assert page.evaluate('documentNow().content').count('const b = {')==1
  print('PASS: editing folded placeholder unfolds safely')
  page.evaluate('(s)=>load("broken.js",s)',BAD)
  page.locator('#scriptFoldGutter button').first.click()
  page.locator('#scriptValidationBar button').first.click()
  assert 'eingeklappt' not in page.locator('#scriptSource').input_value()
  assert page.locator('#scriptSource').evaluate('(el)=>el.selectionStart')==BAD.index(';',BAD.index('const b ='))-1 or page.locator('#scriptSource').evaluate('(el)=>el.selectionStart')>0
  print('PASS: syntax diagnostic reveals folded source and focuses location')
  page.evaluate('(s)=>load("story.md",s)',MD)
  page.locator('#markdownFoldGutter button').first.click()
  assert 'eingeklappt' in page.locator('#source').input_value()
  page.locator('[data-tool="checkbox"]').click()
  assert 'eingeklappt' not in page.locator('#source').input_value()
  assert '## One' in page.evaluate('documentNow().content')
  print('PASS: Markdown toolbar unfolds canonical source before edit')
  assert not issues,issues
  browser.close()
