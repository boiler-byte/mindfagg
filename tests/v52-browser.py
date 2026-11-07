#!/usr/bin/env python3
"""v52 offline browser integration: Mermaid .mmd file views and diagnostics.
The ESM diagram engine is stubbed: browser navigation to file/http is restricted
in this test environment, whereas inline classic-script testing is supported.
"""
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


def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1150,'height':800})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''() => {
          flushSource=async()=>{};
          mermaidEnginePromise=Promise.resolve({
            async parse(code){
              if(code.includes('A[Start -->')){
                const err=Error('Parse error on line 2: expected closing bracket');
                err.hash={loc:{first_line:2,first_column:4}};throw err;
              }
              return {diagramType:'flowchart-v2'};
            },
            async render(id,code){
              return {svg:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#64aaff"/></svg>'};
            }
          });
          projects=[{id:'p52',name:'Mermaid Browser-Test',created:Date.now(),folders:[]}];projectId='p52';
          docs=[{id:'d52',projectId:'p52',name:'test.mmd',path:'charts/test.mmd',fileType:'script',
            content:'flowchart TD\\n  A[Start] --> B[Ende]\\n'}];
          docId='d52';activeFolderPath='';activeFilePanel='script';view='markdown';appSettingsOpen=false;
          render();
        }''')
        assert page.locator('#scriptSource').input_value().startswith('flowchart TD')
        assert page.locator('[data-file-panel="preview"]').count()==1
        assert page.locator('[data-file-panel="preview"]').inner_text().strip().endswith('Mermaid')
        assert page.evaluate('knownTextPath("charts/test.mmd")')
        assert page.evaluate('fileKind(documentNow())')=='script'
        assert page.evaluate('scriptLanguage(documentNow())')=='mermaid'
        assert page.locator('#scriptSyntax .token.keyword').count()>0,'Prism highlighting missing'
        page.wait_for_function("document.querySelector('#scriptValidationBar')?.textContent.includes('keine Syntaxfehler')",timeout=10000)
        page.locator('[data-file-panel="preview"]').click()
        page.locator('#mermaidPreviewStage img').wait_for(state='attached',timeout=10000)
        page.wait_for_function("document.querySelector('#mermaidPreviewStage img')?.naturalWidth>0",timeout=10000)
        assert 'keine Syntaxfehler' in page.locator('#mermaidPreviewDiagnostics').inner_text()
        assert page.evaluate('Boolean(workspacePreviewURL?.startsWith("blob:"))')
        assert page.locator('#mermaidPreviewStage svg').count()==0,'SVG must stay an inert image'
        print('PASS: .mmd script editor, Prism highlighting, Mermaid image preview')
        page.locator('#mermaidEditSource').click()
        page.locator('#scriptSource').fill('flowchart TD\n  A[Start --> B[Ende]')
        page.wait_for_function("document.querySelector('#scriptValidationBar')?.textContent.includes('Fehler')",timeout=10000)
        assert page.locator('.script-invalid-line').count()>0
        assert page.locator('.script-diagnostic-link').count()>0
        page.locator('[data-file-panel="preview"]').click()
        page.wait_for_function("document.querySelector('#mermaidPreviewDiagnostics')?.textContent.includes('Fehler')",timeout=10000)
        assert page.locator('#mermaidPreviewStage img').count()==0
        page.locator('#mermaidPreviewDiagnostics .script-diagnostic-link').first.click()
        assert page.locator('#scriptSource').is_visible()
        page.wait_for_function("document.querySelector('#scriptSource')===document.activeElement",timeout=5000)
        print('PASS: syntax errors, inline editor marker, jumping to error location')
        imported=page.evaluate('''() => {
          const bytes=new TextEncoder().encode('sequenceDiagram\\n  Alice->>Bob: Hallo');
          const d=importedFileRecord('uml/sequence.mmd',bytes);
          return {type:d.fileType,text:d.content,bytes:Array.from(exportFileBytes(d)),mime:workspaceMimeFor(d.path)};
        }''')
        assert imported['type']=='script' and 'sequenceDiagram' in imported['text']
        assert imported['bytes']==list('sequenceDiagram\n  Alice->>Bob: Hallo'.encode())
        assert imported['mime']=='text/plain'
        page.evaluate('''() => {recordWorkspaceFileCreation=async d=>{docs.push(d);};}''')
        page.evaluate('createDocument()')
        page.locator('#newDocName').fill('new-diagram.mmd')
        page.locator('#docForm button[type="submit"]').click()
        page.wait_for_function("documentNow()?.path.endsWith('new-diagram.mmd')",timeout=8000)
        assert page.locator('#scriptSource').input_value().startswith('flowchart TD')
        print('PASS: import/export, new .mmd creation with example diagram')
        assert not errors,errors
        browser.close()


if __name__=='__main__':run()
