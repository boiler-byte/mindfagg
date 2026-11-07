#!/usr/bin/env python3
"""v60: CSV insertion dropdowns and removal of app-wide CSV creation settings."""
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


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1080,'height':800})
        page.set_default_timeout(6000)
        page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        # Old versions stored CSV creation preferences. They must no longer take effect.
        page.evaluate('''() => {
          const storage=new Map([['mfEditorPreferencesV28',JSON.stringify({
            fontSize:15,wordWrap:true,csv:{delimiter:';',encoding:'utf-8-bom',newline:'\\n',quoteChar:"'"}
          })]]);
          Object.defineProperty(window,'localStorage',{configurable:true,value:{
            getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)
          }});
        }''')
        page.set_content(inline_app(),wait_until='load',timeout=30000)
        page.evaluate('''() => {
          projects=[{id:'p60',name:'Test',created:Date.now(),folders:[]}];projectId='p60';
          docs=[{id:'csv',projectId:'p60',name:'daten.csv',path:'daten.csv',fileType:'script',
            content:'A,B\\n1,one\\n2,two'}];
          docId='csv';view='markdown';activeFilePanel='grid';
          saveSource=async()=>{};put=async()=>{};render();
        }''')
        assert page.locator('#csvAddRow').evaluate('(e)=>e.tagName')=='SELECT'
        assert page.locator('#csvAddColumn').evaluate('(e)=>e.tagName')=='SELECT'
        assert page.locator('#csvAddRow option:not([value=""])').all_text_contents()==['Zeile darüber','Zeile darunter']
        assert page.locator('#csvAddColumn option:not([value=""])').all_text_contents()==['Spalte links','Spalte rechts']
        assert page.locator('#csvAddRow').input_value()==''
        assert page.locator('#csvAddColumn').input_value()==''

        # Insert above the selected row; select resets to the + label afterward.
        page.locator('[data-csv-row="1"][data-csv-col="0"]').focus()
        page.locator('#csvAddRow').select_option('above')
        assert page.evaluate('csvGridState.rows')==[['A','B'],['',''],['1','one'],['2','two']]
        assert page.locator('#csvAddRow').input_value()==''
        assert page.evaluate('csvGridState.focusRow')==1
        # Insert *below* the row containing 1, one.
        page.locator('[data-csv-row-header="2"]').click()
        page.locator('#csvAddRow').select_option('below')
        assert page.evaluate('csvGridState.rows')==[['A','B'],['',''],['1','one'],['',''],['2','two']]
        assert page.evaluate('csvGridState.focusRow')==3
        assert page.locator('#csvAddRow').input_value()==''
        # No row selected: either dropdown choice appends.
        for choice in ['above','below']:
            page.evaluate('csvGridSelect(csvGridState,-1,-1)')
            before=page.evaluate('csvGridState.rows.length')
            page.locator('#csvAddRow').select_option(choice)
            assert page.evaluate('csvGridState.rows.length')==before+1
            assert page.evaluate('csvGridState.focusRow')==before
        print('PASS: row dropdown above/below, row headers, no-selection append, reset')

        page.evaluate('''() => {docs[0].content='A,B,C\\nshort\\nx,y';activeFilePanel='grid';render()}''')
        page.locator('[data-csv-col-header="1"]').click()
        page.locator('#csvAddColumn').select_option('left')
        assert page.evaluate('csvGridState.rows')==[['A','','B','C'],['short','','',''],['x','','y','']]
        assert page.evaluate('csvGridState.focusCol')==1
        assert page.locator('#csvAddColumn').input_value()==''
        # Right of column B (now at index 2).
        page.locator('[data-csv-row="0"][data-csv-col="2"]').focus()
        page.locator('#csvAddColumn').select_option('right')
        assert page.evaluate('csvGridState.rows')==[['A','','B','','C'],['short','','','',''],['x','','y','','']]
        assert page.evaluate('csvGridState.focusCol')==3
        assert page.locator('#csvAddColumn').input_value()==''
        for choice in ['left','right']:
            page.evaluate('csvGridSelect(csvGridState,-1,-1)')
            before=page.evaluate('csvGridState.rows[0].length')
            page.locator('#csvAddColumn').select_option(choice)
            assert page.evaluate('csvGridState.rows[0].length')==before+1
            assert page.evaluate('csvGridState.focusCol')==before
        print('PASS: column dropdown left/right, column headers, ragged data, no-selection append, reset')

        # Paging: inserting below the last visible row must switch to the next page.
        page.evaluate('''() => {
          docs[0].content='H,V\\n'+Array.from({length:101},(_,i)=>`${i},v`).join('\\n');
          activeFilePanel='grid';render();
        }''')
        page.locator('[data-csv-row-header="99"]').click()
        page.locator('#csvAddRow').select_option('below')
        assert page.evaluate('csvGridState.page')==1
        assert page.evaluate('csvGridState.rows[100]')==['','']
        assert page.evaluate('csvGridState.rows[101]')==['99','v']
        assert page.locator('[data-csv-row="100"][data-csv-col="0"]').is_visible()
        print('PASS: below-insertion crosses 100-row page boundary')

        page.evaluate('''() => {appSettingsOpen=true;render()}''')
        assert page.locator('#appCsvSettingsTitle,#appCsvDelimiter,#appCsvEncoding,#appCsvNewline,#appCsvQuote').count()==0
        assert page.locator('#appSettingsTitle').is_visible()
        assert page.evaluate('appEditorSettings.fontSize')==15
        assert page.evaluate('typeof appCsvSettings')=='undefined'
        page.locator('#appWordWrap').uncheck()
        stored=page.evaluate('JSON.parse(localStorage.getItem(APP_EDITOR_PREFERENCES_KEY))')
        assert 'csv' not in stored and stored['wordWrap'] is False and stored['fontSize']==15,stored
        assert page.evaluate('''() => {
          const d={path:'created.csv',name:'created.csv',fileType:'script',content:csvNewFileContent(CSV_DEFAULT_SETTINGS)};
          return [csvNormalizeOptions(CSV_DEFAULT_SETTINGS),d.content];
        }''')==[{'delimiter':',','encoding':'utf-8','newline':'\r\n','quoteChar':'"'},'Spalte 1,Spalte 2\r\n,\r\n'], 'Built-in defaults changed'
        print('PASS: CSV settings section removed; legacy settings ignored and dropped on save')
        assert not errors,errors
        browser.close()


if __name__=='__main__':
    main()
