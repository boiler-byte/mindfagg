#!/usr/bin/env python3
"""Test the actual locally vendored Mermaid renderer in an offline browser.
Import maps with data URLs avoid navigation/server dependencies in CI.
"""
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
VENDOR=ROOT/'vendor/mermaid'


def run():
    names={file.name for file in VENDOR.glob('*.js')}
    pattern=re.compile(r'(["\'])\./([A-Za-z0-9_.\-]+\.js)\1')
    entries={}
    for file in sorted(VENDOR.glob('*.js')):
        source=file.read_text()
        def change(match):
            name=match.group(2)
            if name not in names:raise AssertionError(f'Missing Mermaid dependency: {name} imported by {file.name}')
            return match.group(1)+'@mf/'+name+match.group(1)
        rewritten=pattern.sub(change,source)
        entries['@mf/'+file.name]='data:text/javascript;base64,'+base64.b64encode(rewritten.encode()).decode()
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1100,'height':750})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content('<html><head><script type="importmap">'+json.dumps({'imports':entries})+'</script></head><body></body></html>',wait_until='load',timeout=60000)
        result=page.evaluate('''async () => {
          const {default:mermaid}=await import('@mf/mermaid-entry.js');
          if(!mermaid||typeof mermaid.parse!=='function')throw Error('Mermaid API missing');
          mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'dark',flowchart:{htmlLabels:false}});
          const examples={
            flow:'flowchart TD\\n  A[Start] --> B[Ende]',
            sequence:'sequenceDiagram\\n  Alice->>Bob: Hallo',
            cls:'classDiagram\\n  Animal <|-- Duck',
            state:'stateDiagram-v2\\n  [*] --> Ready'
          };
          const results={};
          for(const [name,source] of Object.entries(examples)){
            await mermaid.parse(source,{suppressErrors:false});
            const {svg}=await mermaid.render('v52-'+name,source);
            results[name]={length:svg.length,svg:svg.startsWith('<svg')||svg.startsWith('<svg '),hasScript:/<script\\b/i.test(svg)};
          }
          try{await mermaid.parse('flowchart TD\\n  A[Start --> B[Ende]',{suppressErrors:false});results.invalid=false}
          catch(e){results.invalid={error:String(e.message||e).slice(0,220),line:e?.hash?.loc?.first_line??null,loc:e?.hash?.loc??null}}
          return results;
        }''')
        assert all(result[k]['length']>500 and result[k]['svg'] and not result[k]['hasScript'] for k in ['flow','sequence','cls','state']),result
        assert result['invalid'] and result['invalid']['error'],result
        assert not errors,errors
        print('PASS: Real local Mermaid ESM renders Flowchart, Sequence, Class and State; malformed Mermaid triggers parser error')
        print('Parser diagnostic:',result['invalid'])
        browser.close()


if __name__=='__main__':run()
