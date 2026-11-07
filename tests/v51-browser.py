#!/usr/bin/env python3
"""v51 browser regression: Markdown HTML rendering, TOC, editable metadata and mobile tabs."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m.group(1)).read_text()+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js') else '<script>'+(ROOT/m.group(1)).read_text().replace('</script','<\\/script')+'</script>',html)
    return html


SOURCE=(
    '# [ ] [status:doing] Projekt **Start**\n'
    'Ein Absatz mit **Fettdruck**, *kursiv* und `inline code`.\n\n'
    '## [date:2026-11-07 +2d] Planung\n'
    '- [ ] Erstes Element\n'
    '  - [x] Unterpunkt\n'
    '- [status:todo] Offene Aufgabe\n\n'
    '## Bericht\n'
    '| Name | Wert |\n'
    '| --- | --- |\n'
    '| Eintrag | 42 |\n\n'
    '> Ein Hinweis mit **Markierung**.\n\n'
    '```js\nconst x = "<unsafe>";\n```\n\n'
    '<img src=x onerror=alert(1)>\n'
    '[Unsafe](javascript:alert(1))\n'
)


def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1160,'height':800})
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''(source) => {
            projects=[{id:'p51',name:'Testprojekt',created:Date.now(),folders:[]}];projectId='p51';
            docs=[{id:'md1',projectId:'p51',path:'README.md',name:'README',fileType:'markdown',content:source}];
            docId='md1';view='html';appSettingsOpen=false;
            window.testWrites=[];
            put=async(store,value,options={})=>{
                if(store!=='docs')return;
                const old=persistedDocSnapshots.get(value.id);
                if(old&&!equalDocSnapshot(old,docSnapshot(value))&&options.record!==false){
                    docHistoryFor(value.id).undo.push({...old,stamp:++historySerial});
                    docHistoryFor(value.id).redo.length=0;
                }
                persistedDocSnapshots.set(value.id,docSnapshot(value));
                testWrites.push(value.content);
                updateHistoryButtons();
            };
            persistedDocSnapshots.set('md1',docSnapshot(docs[0]));
            render();
        }''',SOURCE)
        assert not errors, errors
        assert page.locator('#markdownTabs [data-view]').count()==5
        assert page.locator('[data-view="html"]').get_attribute('aria-selected')=='true'
        assert page.locator('.html-md-heading').count()==3
        assert page.locator('.html-md-toc-entry').count()==3
        assert page.locator('.html-md-list li').count()==3
        assert page.locator('article strong').count()>=2
        assert page.locator('.html-md-table-wrap table tr').count()==2
        assert page.locator('article blockquote').count()==1
        assert page.locator('.html-md-code code').count()==1
        assert page.locator('article img').count()==0, 'Raw HTML must not become live image markup'
        assert page.locator('article [onerror]').count()==0
        assert page.locator('article a[href^="javascript:"]').count()==0
        assert not errors,errors
        page.locator('[data-html-task="0"]').check()
        page.wait_for_function('docs[0].content.startsWith("# [x]")')
        assert page.locator('[data-html-task="0"]').is_checked()
        page.locator('[data-html-status="0"]').select_option('review')
        page.wait_for_function('docs[0].content.includes("[status:review]")')
        assert '[status:doing]' not in page.evaluate('docs[0].content.split("\\n")[0]')
        page.locator('[data-html-task-add="6"]').click() # on list item with status but no checkbox
        page.wait_for_function('docs[0].content.includes("- [ ] [status:todo] Offene Aufgabe")')
        page.locator('[data-html-task="6"]').check()
        page.wait_for_function('docs[0].content.includes("- [x] [status:todo] Offene Aufgabe")')
        page.locator('[data-html-date-line="3"] summary').click()
        page.locator('[data-html-date-line="3"] [data-html-date-start]').fill('2026-11-08')
        page.locator('[data-html-date-line="3"] [data-html-date-d]').fill('5')
        page.locator('[data-html-date-line="3"] [data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-08 +5d]")')
        page.locator('[data-html-date-line="3"] summary').click()
        page.locator('[data-html-date-line="3"] [data-html-date-remove]').click()
        page.wait_for_function('!docs[0].content.includes("[date:")')
        assert len(page.evaluate('testWrites'))>=5
        assert page.evaluate('docHistoryFor("md1").undo.length')>=5
        page.evaluate("changeHistory('undo')")
        page.wait_for_function('docs[0].content.includes("[date:2026-11-08 +5d]")')
        page.evaluate("changeHistory('redo')")
        page.wait_for_function('!docs[0].content.includes("[date:")')
        assert not errors, errors
        print('PASS: HTML headings, TOC, lists, inline markup, tables, code, XSS isolation, metadata edits and undo snapshots')
        # Reuse the real setView/render path; other views remain available.
        page.evaluate("setView('markdown');render()")
        assert page.locator('#source').count()==1
        assert page.locator('#source').input_value()==page.evaluate('docs[0].content')
        page.evaluate("setView('html');render()")
        assert page.locator('.html-md-heading').count()==3
        page.evaluate("setView('calendar');render()")
        assert page.locator('#calendarView').count()==1
        page.evaluate("setView('html');render()")
        page.locator('.html-md-toc-entry').last.click()
        assert not errors,errors
        print('PASS: view switching and TOC navigation')
        page.set_viewport_size({'width':390,'height':790})
        page.evaluate('render()')
        assert page.locator('.html-md-toc details').get_attribute('open') is None
        page.locator('.html-md-toc summary').click()
        assert page.locator('.html-md-toc-entry').first.is_visible()
        for tab in ['markdown','mindmap','html']:
            assert page.locator(f'#markdownTabs [data-view="{tab}"] .tab-label').is_visible(),tab
        for tab in ['kanban','calendar']:
            assert not page.locator(f'#markdownTabs [data-view="{tab}"] .tab-label').is_visible(),tab
            assert page.locator(f'#markdownTabs [data-view="{tab}"] .tab-icon svg').is_visible()
        for tab in ['mindmap','kanban','calendar','html']:
            assert page.locator(f'#markdownTabs [data-view="{tab}"] .tab-icon svg').count()==1
        for width in [390,320]:
            page.set_viewport_size({'width':width,'height':790})
            boxes=page.locator('#markdownTabs .tab').evaluate_all('els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.left,r.right]})')
            labels=page.locator('#markdownTabs .tab-label').evaluate_all('els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.left,r.right,getComputedStyle(el).display]})')
            assert all(boxes[i][1]<=boxes[i+1][0]+1 for i in range(4)),(width,boxes)
            assert labels[0][1]<=boxes[1][0]+5,(width,labels,boxes)
            assert labels[1][1]<=boxes[2][0]+5,(width,labels,boxes)
        assert not errors,errors
        print('PASS: mobile TOC, icons and compact view tabs at 390px and 320px')
        browser.close()


if __name__=='__main__':
    run()
