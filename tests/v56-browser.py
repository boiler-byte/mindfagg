#!/usr/bin/env python3
"""v56 regressions: CSV position-aware insertion and compact HTML node properties."""
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
        page=browser.new_page(viewport={'width':1130,'height':840})
        page.route('https://cdn.jsdelivr.net/**',lambda route:route.abort())
        page.set_default_timeout(6000)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(inline_app(),wait_until='load',timeout=30000)
        page.evaluate('''() => {
          projects=[{id:'p56',name:'Test',created:Date.now(),folders:[]}];projectId='p56';
          docs=[{id:'csv',projectId:'p56',name:'daten.csv',path:'daten.csv',fileType:'script',
            content:'A,B\\nx,y\\np,q'}];
          docId='csv';activeFilePanel='grid';view='markdown';
          saveSource=async()=>{};
          put=async()=>{};
          render();
        }''')
        assert page.locator('#csvGridTable tbody tr').count()==3
        # Selecting a cell inserts the new row above that row, even though toolbar takes focus.
        page.locator('[data-csv-row="1"][data-csv-col="0"]').focus()
        assert 'Zeile 2' in page.locator('#csvGridSelection').inner_text()
        page.locator('#csvAddRow').select_option('above')
        assert page.locator('[data-csv-row="1"][data-csv-col="0"]').input_value()==''
        assert page.locator('[data-csv-row="2"][data-csv-col="0"]').input_value()=='x'
        assert page.evaluate('csvGridState.focusRow')==1
        assert page.evaluate('csvGridState.rows')==[['A','B'],['',''],['x','y'],['p','q']]
        # Selecting a column by its header inserts immediately before it.
        page.locator('[data-csv-col-header="1"]').click()
        assert page.locator('#csvGridSelection').inner_text()=='Spalte B'
        page.locator('#csvAddColumn').select_option('left')
        assert page.evaluate('csvGridState.rows')==[['A','','B'],['','',''],['x','','y'],['p','','q']]
        assert page.evaluate('csvGridState.focusCol')==1
        # Both buttons append when neither row nor column is selected.
        page.evaluate('csvGridSelect(csvGridState,-1,-1)')
        page.locator('#csvAddRow').select_option('below')
        assert page.evaluate('csvGridState.rows.at(-1)')==['','','']
        page.evaluate('csvGridSelect(csvGridState,-1,-1)')
        page.locator('#csvAddColumn').select_option('right')
        assert page.evaluate('csvGridState.rows[0]')==['A','','B','']
        # Ragged records are padded before inserting a column in the middle.
        page.evaluate('''() => {
          docs[0].content='A,B,C\\nshort\\nx,y';activeFilePanel='grid';render();
        }''')
        page.locator('[data-csv-row="0"][data-csv-col="1"]').focus()
        page.locator('#csvAddColumn').select_option('left')
        assert page.evaluate('csvGridState.rows')==[['A','','B','C'],['short','','',''],['x','','y','']]
        print('PASS: CSV row/column insertion before selected position, append, header selection, ragged records',flush=True)
        # Page boundaries: insertion above row 110 must remain on the right page.
        page.evaluate('''() => {
          docs[0].content='H,V\\n'+Array.from({length:120},(_,i)=>`${i},val`).join('\\n');
          activeFilePanel='grid';render();
        }''')
        page.locator('#csvNextPage').click()
        page.locator('[data-csv-row-header="110"]').click()
        page.locator('#csvAddRow').select_option('above')
        assert page.evaluate('csvGridState.rows[110]')==['','']
        assert page.evaluate('csvGridState.rows[111]')==['109','val']
        assert page.evaluate('csvGridState.page')==1
        assert page.locator('[data-csv-row="110"][data-csv-col="0"]').is_visible()
        print('PASS: selected row insertion across CSV pagination',flush=True)
        source='# Titel\n## [ ] [status:doing] [date:2026-11-07] Komplett\n- [ ] Aufgabe\n- [status:todo] Statusknoten\n- Ohne Attribute'
        page.evaluate('''(source) => {
          docs=[{id:'md',projectId:'p56',name:'Notizen.md',path:'Notizen.md',fileType:'markdown',content:source}];
          docId='md';view='html';appSettingsOpen=false;
          put=async()=>{};
          render();
        }''',source)
        assert page.locator('.html-md-heading').count()==2
        assert page.locator('[data-html-task="1"]').is_checked()==False
        assert page.locator('#html-md-heading-1 .html-md-heading-title').locator('input').count()==1
        assert page.locator('[data-html-task="2"]').count()==1
        assert page.locator('[data-html-task="2"] + .html-md-list-text').count()==1
        assert page.locator('[data-html-task-remove],.html-md-remove-task,.html-md-add-task').count()==0
        assert page.locator('#html-md-heading-1 [data-html-menu-toggle]').count()==0
        assert page.locator('#html-md-heading-1 [data-html-status]').count()==1
        assert page.locator('#html-md-heading-1 .html-md-date summary').count()==1
        assert page.locator('#html-md-heading-0 [data-html-status]').count()==0
        assert page.locator('#html-md-heading-0 .html-md-date').count()==0
        assert page.locator('#html-md-heading-0 [data-html-menu-toggle]').count()==1
        assert page.locator('#html-md-heading-0 [data-html-attr-add]').count()==3
        assert not page.locator('#html-md-heading-0 [data-html-attr-add]').first.is_visible()
        page.locator('#html-md-heading-0 [data-html-menu-toggle]').click()
        assert page.locator('#html-md-heading-0 [data-html-attr-add="task"]').is_visible()
        page.locator('#html-md-heading-0 [data-html-attr-add="task"]').click()
        page.wait_for_function('docs[0].content.startsWith("# [ ] Titel")')
        assert page.locator('[data-html-task="0"]').count()==1
        assert page.locator('#html-md-heading-0 .html-md-heading-title > input').count()==1
        page.locator('[data-html-task="0"]').check()
        page.wait_for_function('docs[0].content.startsWith("# [x] Titel")')
        page.locator('#html-md-heading-0 [data-html-menu-toggle]').click()
        assert page.locator('#html-md-heading-0 [data-html-attr-add="task"]').count()==0
        page.locator('#html-md-heading-0 [data-html-attr-add="status"]').click()
        assert page.locator('#html-md-heading-0 [data-html-editor="status"]').is_visible()
        page.locator('#html-md-heading-0 [data-html-status-new]').select_option('review')
        page.wait_for_function('docs[0].content.startsWith("# [x] [status:review]")')
        assert page.locator('#html-md-heading-0 [data-html-status]').input_value()=='review'
        page.locator('#html-md-heading-0 [data-html-menu-toggle]').click()
        assert page.locator('#html-md-heading-0 [data-html-attr-add="status"]').count()==0
        page.locator('#html-md-heading-0 [data-html-attr-add="date"]').click()
        assert page.locator('#html-md-heading-0 [data-html-editor="date"]').is_visible()
        page.locator('#html-md-heading-0 [data-html-date-start]').fill('2026-11-09')
        page.locator('#html-md-heading-0 [data-html-date-d]').fill('2')
        page.locator('#html-md-heading-0 [data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-09 +2d]")')
        assert page.locator('#html-md-heading-0 [data-html-menu-toggle]').count()==0
        assert page.locator('#html-md-heading-0 .html-md-date summary').count()==1
        assert page.locator('#html-md-heading-0 [data-html-editor="date"]').count()==0
        # Remove date and status using their existing controls; missing controls return to plus-menu.
        page.locator('#html-md-heading-0 .html-md-date summary').click()
        page.locator('#html-md-heading-0 [data-html-date-remove]').click()
        page.wait_for_function('!docs[0].content.includes("[date:2026-11-09")')
        assert page.locator('#html-md-heading-0 .html-md-date').count()==0
        assert page.locator('#html-md-heading-0 [data-html-menu-toggle]').count()==1
        page.locator('#html-md-heading-0 [data-html-status]').select_option('')
        page.wait_for_function('!docs[0].content.includes("[status:review]")')
        assert page.locator('#html-md-heading-0 [data-html-status]').count()==0
        print('PASS: HTML inline unlabeled checkbox, compact metadata, add-menu, status/date editing and removal',flush=True)
        # Responsive view labels: only HTML label disappears, icon and accessible name stay.
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':740})
            assert not page.locator('#markdownTabs [data-view="html"] .tab-label').is_visible()
            assert page.locator('#markdownTabs [data-view="html"] .tab-icon').is_visible()
            assert page.locator('#markdownTabs [data-view="html"]').get_attribute('aria-label')=='HTML'
        page.set_viewport_size({'width':1080,'height':840})
        assert page.locator('#markdownTabs [data-view="html"] .tab-label').is_visible()
        print('PASS: HTML label hidden only on small screens; icon and accessible label remain',flush=True)
        assert not errors,errors
        browser.close()

if __name__=='__main__':main()
