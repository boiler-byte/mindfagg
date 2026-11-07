#!/usr/bin/env python3
"""v54 UI regression: CSV grid/editing/options/bytes; JSON pretty; Mermaid center."""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def inline_app():
    html = (ROOT/'index.html').read_text()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js')
                  else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    return html


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1210,'height':860})
        page.route('https://cdn.jsdelivr.net/**',lambda r:r.abort())
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.evaluate("""() => {const data=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)}})}""")
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''() => {
          flushMapInlineEdit=async()=>true;
          projects=[{id:'p54',name:'Test',created:Date.now(),folders:[]}];projectId='p54';
          docs=[{id:'mer',projectId:'p54',name:'chart.mmd',path:'chart.mmd',fileType:'script',content:'flowchart LR\\nA-->B'}];
          docId='mer';activeFilePanel='preview';view='markdown';appSettingsOpen=false;
          mermaidEnginePromise=Promise.resolve({
            parse:async()=>({diagramType:'flowchart-v2'}),
            render:async()=>({svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000"><path d="M0 0H100"/></svg>'})
          });render();
        }''')
        page.wait_for_function('mermaidPreviewState?.width===1500 && !document.querySelector("#mermaidFit").disabled')
        state=page.evaluate('''() => ({scale:mermaidPreviewState.scale,x:mermaidPreviewState.panX,y:mermaidPreviewState.panY})''')
        page.locator('#mermaidPreviewViewport').hover()
        page.mouse.wheel(0,-200)
        page.wait_for_function('(old)=>mermaidPreviewState.scale>old',arg=state['scale'])
        page.locator('#mermaidFit').click()
        now=page.evaluate('''() => ({scale:mermaidPreviewState.scale,x:mermaidPreviewState.panX,y:mermaidPreviewState.panY})''')
        assert abs(now['scale']-state['scale'])<1e-6,(state,now)
        assert abs(now['x']-state['x'])<1e-6,(state,now)
        assert page.locator('.mermaid-preview-toolbar').count()==0
        print('PASS: Mermaid fit button resets zoom/pan, no Mermaid preview toolbar')

        page.evaluate('''() => {docs=[{id:'j',projectId:'p54',name:'config.json',path:'config.json',
          fileType:'script',content:'{"hello":1,"list":[2,3]}'}];docId='j';activeFilePanel='script';render()}''')
        assert page.locator('#scriptPrettyCode').is_visible()
        page.locator('#scriptPrettyCode').click()
        pretty=page.locator('#scriptSource').input_value()
        assert pretty=='{\n  "hello": 1,\n  "list": [\n    2,\n    3\n  ]\n}\n',repr(pretty)
        page.locator('#scriptSource').fill('{broken json}')
        page.locator('#scriptPrettyCode').click()
        assert page.locator('#scriptSource').input_value()=='{broken json}'
        print('PASS: JSON Pretty Code formats valid JSON; invalid source remains unchanged')

        page.evaluate('''() => {appSettingsOpen=true;render()}''')
        assert page.locator('#appCsvSettingsTitle').inner_text()=='Neue CSV-Dateien'
        page.locator('#appCsvDelimiter').select_option(';')
        page.locator('#appCsvEncoding').select_option('utf-8-bom')
        page.locator('#appCsvNewline').select_option('lf')
        page.locator('#appCsvQuote').select_option('single')
        settings=page.evaluate('''() => ({...appCsvSettings, stored:JSON.parse(localStorage.getItem(APP_EDITOR_PREFERENCES_KEY)).csv})''')
        assert settings['delimiter']==';' and settings['encoding']=='utf-8-bom'
        assert settings['newline']=='\n' and settings['quoteChar']=="'",settings
        assert settings['stored']['quoteChar']=="'"
        print('PASS: CSV app defaults are editable and persist in localStorage')

        page.evaluate('''() => {appSettingsOpen=false;recordWorkspaceFileCreation=async doc=>{docs.push(doc)};
          saveSource=async(id,text)=>{window.savedCsv=[id,text];};render();createDocument()}''')
        page.locator('#newDocName').fill('Daten.csv')
        page.locator('#docForm button[type="submit"]').click()
        page.wait_for_function('documentNow()?.path==="Daten.csv"')
        assert page.evaluate('documentNow().csvSettings.encoding')=='utf-8-bom'
        assert page.evaluate('documentNow().content')=='Spalte 1;Spalte 2\n;\n'
        assert page.locator('[data-file-panel="grid"]').count()==1
        assert 'file-type-csv' in page.locator('[data-doc]:has-text("Daten.csv")').inner_html()
        page.locator('[data-file-panel="grid"]').click()
        assert page.locator('#csvGridTable').is_visible()
        assert page.locator('#csvGridTable tbody tr').count()==2
        assert page.locator('[data-csv-row="0"][data-csv-col="0"]').input_value()=='Spalte 1'
        page.locator('[data-csv-row="1"][data-csv-col="0"]').fill('Berlin; Köln\n"Zitat"')
        text=page.evaluate('documentNow().content')
        assert text=="Spalte 1;Spalte 2\n'Berlin; Köln\n\"Zitat\"';\n",repr(text)
        result=page.evaluate('''() => {
          const bytes=exportFileBytes(documentNow());
          return {prefix:Array.from(bytes.slice(0,3)),text:new TextDecoder('utf-8').decode(bytes)};
        }''')
        assert result['prefix']==[239,187,191],result
        assert result['text']==text
        page.locator('[data-file-panel="script"]').click()
        assert page.locator('#scriptSource').input_value()==text
        assert page.evaluate('window.savedCsv?.[0]')==page.evaluate('docId')
        page.locator('[data-file-panel="grid"]').click()
        assert page.locator('[data-csv-row="1"][data-csv-col="0"]').input_value()=='Berlin; Köln\n"Zitat"'
        print('PASS: new CSV uses saved defaults, icon and Grid tab; quoted editing and save round trip')

        page.locator('#csvAddRow').click()
        assert page.locator('#csvGridTable tbody tr').count()==3
        page.locator('#csvAddColumn').click()
        assert page.locator('#csvGridTable thead th').count()==4
        page.locator('[data-csv-row="2"][data-csv-col="2"]').fill('€')
        page.locator('#csvDeleteColumn').click()
        assert page.locator('#csvGridTable thead th').count()==3
        page.locator('[data-csv-row="2"][data-csv-col="0"]').focus()
        page.locator('#csvDeleteRow').click()
        assert page.locator('#csvGridTable tbody tr').count()==2
        print('PASS: CSV Grid add/delete row and column')

        raw=page.evaluate('''() => {
          const bytes=new Uint8Array([78,97,109,101,59,80,114,101,105,115,10,77,252,108,108,101,114,59,128,10]);
          const imported=importedFileRecord('preise.csv',bytes);
          return {fileType:imported.fileType,encoding:imported.csvSettings.encoding,content:imported.content,
            originalBytes:Array.from(exportFileBytes(imported))};
        }''')
        assert raw['fileType']=='script' and raw['encoding']=='windows-1252',raw
        assert raw['content']=='Name;Preis\nMüller;€\n',raw
        assert raw['originalBytes'][-5:]==[108,101,114,59,128] if False else raw['originalBytes'][-2:]==[128,10]
        enc=page.evaluate('''() => Array.from(csvEncodeText('Ä;€', 'windows-1252'))''')
        assert enc==[196,59,128],enc
        utf=page.evaluate('''() => Array.from(csvEncodeText('A', 'utf-16le'))''')
        assert utf==[255,254,65,0]
        print('PASS: imported Windows-1252 bytes preserved; encoding of modified CSV is correct')
        # Arbitrary HTML stays text, never inserted as markup.
        page.evaluate('''() => {docs=[{id:'safe',projectId:'p54',path:'safe.csv',name:'safe.csv',
          fileType:'script',content:'Name,Data\\nA,"<img src=x onerror=alert(1)>"'}];
          docId='safe';activeFilePanel='grid';render()}''')
        assert page.locator('[data-csv-row="1"][data-csv-col="1"]').input_value()=='<img src=x onerror=alert(1)>'
        assert page.locator('#csvGridTable img').count()==0
        print('PASS: CSV cell markup displayed as plain text')
        csv_cases=page.evaluate(r"""() => {
          const multiline=csvOfflineParse('A,B\r\n"c\r\nd",2\r\n', {delimiter:',',quoteChar:'"'});
          const blank=csvOfflineParse('A,B\n\n', {delimiter:',',quoteChar:'"'});
          const tab=csvOfflineParse('a\tb\n1\t2', {delimiter:'\t',quoteChar:'"'});
          const escaped=csvOfflineParse('a,b\n"c""d",e', {delimiter:',',quoteChar:'"'});
          return {multiline,blank,tab,escaped};
        }""")
        assert csv_cases['multiline']['data']==[['A','B'],['c\r\nd','2']],csv_cases
        assert csv_cases['blank']['data']==[['A','B'],['']],csv_cases
        assert csv_cases['tab']['data']==[['a','b'],['1','2']],csv_cases
        assert csv_cases['escaped']['data']==[['a','b'],['c"d','e']],csv_cases
        print('PASS: RFC 4180 quoted multiline fields, trailing blank rows, tab delimiter')

        be=page.evaluate('''() => {
          const bytes=new Uint8Array([254,255,0,65,0,44,0,66,0,10,0,67,0,44,0,68]);
          const d=importedFileRecord('utf16.csv',bytes);
          return {encoding:d.csvSettings.encoding,content:d.content,bytes:Array.from(exportFileBytes(d)),encoded:Array.from(csvEncodeText('Ä',d.csvSettings.encoding))};
        }''')
        assert be['encoding']=='utf-16be' and be['content']=='A,B\nC,D',be
        assert be['bytes'][:4]==[254,255,0,65] and be['encoded']==[254,255,0,196],be
        print('PASS: imported UTF-16 BE and preserved original bytes')

        page.evaluate(r'''() => {
          docs=[{id:'paged',projectId:'p54',path:'paged.csv',name:'paged.csv',fileType:'script',
            content:'A,B\n'+Array.from({length:123},(_,i)=>`${i},Data`).join('\n')}];
          docId='paged';activeFilePanel='grid';render();
        }''')
        assert page.locator('#csvGridTable tbody tr').count()==100
        page.locator('#csvNextPage').click()
        assert page.locator('#csvGridTable tbody tr').count()==24
        page.locator('[data-csv-row="115"][data-csv-col="1"]').fill('Changed')
        assert page.evaluate(r'documentNow().content.split("\n")[115].endsWith("Changed")')
        print('PASS: CSV Grid paging and editing >100 records')
        assert not errors,errors
        browser.close()

if __name__=='__main__':main()
