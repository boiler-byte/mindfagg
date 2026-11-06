#!/usr/bin/env python3
"""v41 Pretty Code browser regression, adapted to the v42 native GitHub datalist."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent

def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    fixture='''
      projects=[{id:'p41',name:'App v41',created:Date.now(),folders:[]}];projectId='p41';
      githubCredentialAccount='miramax11';githubCredentialToken='test-only';
      saveSource=async()=>{};
      window.repoCalls=[];
      githubApi=async(token,path)=>{
        if(!path.startsWith('/user/repos?'))throw Error('Unexpected endpoint: '+path);
        repoCalls.push({token,path});
        const page=Number(new URL('https://api.github.com'+path).searchParams.get('page'));
        if(page===1)return Array.from({length:100},(_,i)=>({full_name:'miramax11/project'+String(i).padStart(3,'0'),private:i%2===0}));
        if(page===2)return [{full_name:'miramax11/private-space',private:true},{full_name:'team/repo-a',private:false}];
        return [];
      };
      window.load41=(name,content)=>{
        docs=[{id:name,projectId:'p41',name,path:name,fileType:'script',content,updatedAt:Date.now()}];
        docId=name;setView('markdown');activeFilePanel='script';render();
      };
    '''
    return html.replace('</body>','<script>'+fixture+'</script></body>')

samples={
  'demo.html':'<!doctype html><html><head><title>Hello</title></head><body><div><h1>Hi</h1><p>Text</p></div></body></html>',
  'demo.css':'section{color:red; margin: 0;}@media (min-width: 500px){section{padding:8px;}}',
  'demo.js':'function add(a,b){const user={name:"demo",age:1};return a+b+user.age;} const x=`a${1+2}b`;',
  'demo.xml':'<?xml version="1.0"?><root><child id="1">Value</child><item/></root>',
  'demo.svg':'<svg xmlns="http://www.w3.org/2000/svg"><g><circle cx="3" cy="5" r="2"/></g><text>Words</text></svg>'
}

with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1280,'height':800})
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(inline_app(),wait_until='load',timeout=60000)

  # Formatting is a toolbar command, uses canonical text, and does not execute code.
  for name,source in samples.items():
    page.evaluate('(value)=>load41(value[0],value[1])',[name,source])
    assert page.locator('#scriptPrettyCode').is_visible(),name
    page.locator('#scriptPrettyCode').click()
    result=page.evaluate('documentNow().content')
    assert result!=source,(name,'No formatting occurred')
    assert result.count('\n')>=2,(name,result)
    assert 'eingeklappt' not in result,name
    if name.endswith('.js'):
      assert not page.evaluate('(value)=>parseJavascriptCode(value).errors.length',result)
      assert page.evaluate('(value)=>scriptPrettyAstSignature(parseJavascriptCode(value).ast)',result)==page.evaluate('(value)=>scriptPrettyAstSignature(parseJavascriptCode(value).ast)',source)
    if name.endswith('.css'):assert 'color: red;' in result
    if name.endswith('.html'):assert '<title>Hello</title>' in result
    if name.endswith('.xml'):assert '<?xml version="1.0"?>' in result
    if name.endswith('.svg'):assert '<text>Words</text>' in result
  print('PASS: formatting works for HTML, CSS, JS, XML and SVG and retains JS AST')

  # Existing features in script toolbar remain available.
  page.evaluate('(value)=>load41(value[0],value[1])',['demo.js',samples['demo.js']])
  page.locator('#scriptFindToggle').click()
  page.locator('#scriptFindQuery').fill('user')
  assert page.locator('#scriptFindCount').inner_text()=='1 von 2'
  page.locator('#scriptFindClose').click()
  print('PASS: find and replace toolbar remains functional')

  for bad in ('const bad = ;','const str = "unterminated'):
    page.evaluate('(value)=>load41("bad.js",value)',bad)
    page.locator('#scriptPrettyCode').click()
    assert page.evaluate('documentNow().content')==bad
  print('PASS: invalid JS is never overwritten')

  # Folding placeholders cannot be saved as formatted content.
  page.evaluate('appEditorSettings.codeFolding=true;applyAppEditorPreferences()')
  folded='function outer(){\n  const SECRET={a:1,b:2};\n  return SECRET;\n}\n'
  page.evaluate('(s)=>load41("folded.js",s)',folded)
  page.locator('#scriptFoldGutter button').first.click()
  assert 'eingeklappt' in page.locator('#scriptSource').input_value()
  page.locator('#scriptPrettyCode').click()
  result=page.evaluate('documentNow().content')
  assert 'SECRET' in result and 'eingeklappt' not in result
  assert 'eingeklappt' not in page.locator('#scriptSource').input_value()
  print('PASS: Pretty Code works with collapsed blocks without losing their content')

  # Unsupported file types do not expose the action.
  page.evaluate('(s)=>load41("data.json",s)','{"a":1}')
  assert not page.locator('#scriptPrettyCode').is_visible()
  print('PASS: Pretty Code is restricted to requested languages')

  # The API-backed suggestions are fetched with the authenticated token, not project history.
  page.evaluate('openGithubDialog()')
  repo=page.locator('#githubRepository')
  repo.focus()
  page.wait_for_function('repoCalls.length>=2')
  page.wait_for_function("document.querySelector('#githubRepoLookup').textContent.includes('102')")
  assert repo.get_attribute('list')=='githubRepoOptions'
  assert page.locator('#githubRepoOptions option').count()==102
  assert all(call['token']=='test-only' and 'per_page=100' in call['path'] for call in page.evaluate('repoCalls'))
  assert not page.locator('#githubUseAccount').count()
  assert page.locator('#githubRepoSuggestion').count()==0
  assert 'miramax11/private-space' in page.locator('#githubRepoOptions option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
  assert 'team/repo-a' in page.locator('#githubRepoOptions option').evaluate_all('(nodes)=>nodes.map(n=>n.value)')
  repo.fill('miramax11/private-space')  # native datalist performs the filtering
  assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/miramax11/private-space'
  repo.fill('team/repo-a')
  assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/team/repo-a'
  print('PASS: GitHub native datalist loads token-scoped, paginated repositories')

  # API errors are explicit, manual entry is never prevented.
  page.evaluate("githubApi=async()=>{throw Error('Insufficient token permissions')};closeModal();openGithubDialog()")
  repo=page.locator('#githubRepository');repo.focus()
  page.wait_for_function("document.querySelector('#githubRepoLookup').textContent.includes('Insufficient token permissions')")
  repo.fill('other/typed-manually')
  assert page.locator('#githubRepositoryOpen').get_attribute('href')=='https://github.com/other/typed-manually'
  print('PASS: GitHub API errors are shown and manual owner/repo remains available')

  # Mobile toolbar order matches the markdown editor behavior.
  page.evaluate('closeModal();appEditorSettings.codeFolding=false;applyAppEditorPreferences()')
  page.set_viewport_size({'width':390,'height':844})
  page.evaluate('(s)=>load41("mobile.css",s)',samples['demo.css'])
  assert page.locator('#scriptPrettyCode').bounding_box()['y']>page.locator('.script-codeframe').bounding_box()['y']
  page.locator('#scriptPrettyCode').click()
  assert 'color: red' in page.evaluate('documentNow().content')
  print('PASS: mobile Pretty Code toolbar')

  assert not errors,errors
  print('PASS: zero runtime exceptions')
  browser.close()
