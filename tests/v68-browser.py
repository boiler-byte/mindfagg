#!/usr/bin/env python3
"""v68 browser regression for reminder IDs, editor completion and date forms."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT=Path(__file__).resolve().parent.parent

def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda m:'<style>'+(ROOT/m.group(1)).read_text(encoding='utf-8')+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',
                lambda m:'' if m.group(1) in ('ui/bindings.js','core/service-worker.js')
                else '<script>'+(ROOT/m.group(1)).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>',html)
    return html

SOURCE=(
    '# Projekt\n'
    '- [date:2026-11-13:18:00 +1h !a7f3:30m] Existiert\n'
    '- [date:2026-11-13:18 +1h !0m] Auto-ID\n'
    '- Ohne Datum\n'
    '```md\n'
    '- [date:2026-11-13:18 !0m] Im Code\n'
    '```\n'
)

def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1180,'height':800})
        page.set_default_timeout(20000)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''source=>{
            projects=[{id:'v68',name:'Reminder-Test',folders:[]}];projectId='v68';
            docs=[{id:'notes',projectId:'v68',name:'Reminders.md',path:'Reminders.md',fileType:'markdown',content:source}];
            docId='notes';
            put=async(store,document)=>{if(store==='docs'){docs[0].content=document.content;window.__saved=(window.__saved||0)+1}};
            view='markdown';render();
        }''',SOURCE)
        page.wait_for_function(r'''()=>/!([0-9a-f]{4}):0m\] Auto-ID/.test(docs[0].content)''')
        content=page.evaluate('docs[0].content')
        assert '[date:2026-11-13:18:00 +1h !a7f3:30m]' in content
        assert '[date:2026-11-13:18 !0m] Im Code' in content
        auto_id=re.search(r'!([0-9a-f]{4}):0m\] Auto-ID',content).group(1)
        assert auto_id!='a7f3'
        assert page.locator('#source').input_value()==content
        assert page.locator('.syn-date',has_text=f'!{auto_id}:0m').count()==1
        page.evaluate('render()')
        assert re.search(r'!([0-9a-f]{4}):0m\] Auto-ID',page.evaluate('docs[0].content')).group(1)==auto_id
        print('PASS: opening Markdown auto-completes missing ID once; existing and fenced reminders unchanged',flush=True)

        source=page.locator('#source')
        source.fill(content+'- [date:2026-11-14:09 +1h !45m] Eingegeben\n')
        updated=source.input_value()
        typed_id=re.search(r'!([0-9a-f]{4}):45m\] Eingegeben',updated).group(1)
        assert len({auto_id,typed_id,'a7f3'})==3
        assert page.evaluate('docs[0].content')==updated
        assert page.evaluate("document.querySelector('#source').selectionStart")>=updated.index('Eingegeben')
        assert '!45m] Im Code' not in updated
        print('PASS: live input/paste adds collision-free ID, updates textarea and document, preserves caret',flush=True)

        page.evaluate("calendarMonth={year:2026,month:11};calendarSelectedDay='2026-11-13';setView('calendar');render()")
        assert page.locator('.calendar-agenda-item',has_text='Existiert').count()==1
        page.locator('.calendar-agenda-item',has_text='Existiert').click()
        assert page.locator('#nodeDateReminder').is_checked()
        assert page.locator('#nodeDateReminderId').input_value()=='a7f3'
        assert page.locator('#nodeDateReminderAmount').input_value()=='30'
        assert page.locator('#nodeDateReminderUnit').input_value()=='m'
        page.locator('#nodeDateReminderAmount').fill('1')
        page.locator('#nodeDateReminderUnit').select_option('D')
        assert '!a7f3:1D]' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function("docs[0].content.includes('!a7f3:1D] Existiert')")
        assert page.evaluate('parseNodeDatePayload("2026-11-13:18:00 +1h !a7f3:1D").reminder.amount')==1
        print('PASS: node editor keeps stable ID when changing reminder offset and unit',flush=True)

        page.evaluate('addNode()')
        page.locator('#nodeTitle').fill('Neu mit Reminder')
        page.locator('#nodeDateStart').fill('2026-11-13')
        page.locator('#nodeDateHour').select_option('8')
        page.locator('#nodeDateReminder').check()
        assert page.locator('#nodeDateReminderAmount').is_enabled()
        page.locator('#nodeDateReminderAmount').fill('0')
        created_id=page.locator('#nodeDateReminderId').input_value()
        assert re.fullmatch('[0-9a-f]{4}',created_id) and created_id not in {auto_id,typed_id,'a7f3'}
        page.locator('#nodeDateReminderUnit').select_option('h')
        assert page.locator('#nodeDateReminderId').input_value()==created_id
        assert f'!{created_id}:0h]' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#addForm button[type="submit"]').click()
        page.wait_for_function('(id)=>docs[0].content.includes("!"+id+":0h] Neu mit Reminder")',arg=created_id)
        print('PASS: create-node dialog writes reminder including zero offset and a persistent generated ID',flush=True)

        page.evaluate("setView('html');render()")
        row=page.locator('[data-html-date-line="1"]')
        row.locator('summary').click()
        assert row.locator('[data-html-reminder-enable]').is_checked()
        assert row.locator('[data-html-reminder-id]').input_value()=='a7f3'
        assert row.locator('[data-html-reminder-unit]').input_value()=='D'
        row.locator('[data-html-reminder-unit]').select_option('h')
        row.locator('[data-html-reminder-amount]').fill('2')
        row.locator('[data-html-date-save]').click()
        page.wait_for_function("docs[0].content.includes('!a7f3:2h] Existiert')")
        assert 'a7f3:2h' in page.locator('[data-html-date-line="1"] summary').inner_text()
        row=page.locator('[data-html-date-line="2"]')
        row.locator('summary').click()
        assert row.locator('[data-html-reminder-enable]').is_checked()
        row.locator('[data-html-reminder-enable]').uncheck()
        assert row.locator('[data-html-reminder-amount]').is_disabled()
        row.locator('[data-html-date-save]').click()
        page.wait_for_function("docs[0].content.includes('[date:2026-11-13:18 +1h] Auto-ID')")
        print('PASS: HTML date editor edits/removes reminder without altering date or event duration',flush=True)

        # Add date + reminder directly from the HTML view's attribute menu.
        page.locator('.html-md-list-row',has_text='Ohne Datum').hover()
        page.locator('[data-html-menu-toggle="3"]').click()
        page.locator('[data-html-attr-add="date"][data-html-line="3"]').click()
        draft=page.locator('[data-html-date-line="3"]')
        draft.locator('[data-html-date-start]').fill('2026-11-14')
        draft.locator('[data-html-reminder-enable]').check()
        draft.locator('[data-html-reminder-amount]').fill('10')
        assert draft.locator('[data-html-reminder-unit]').input_value()=='m'
        draft.locator('[data-html-date-save]').click()
        page.wait_for_function(r'''()=>/\[date:2026-11-14 ![0-9a-f]{4}:10m\] Ohne Datum/.test(docs[0].content)''')
        assert page.locator('[data-html-date-line="3"] summary').count()==1
        print('PASS: HTML new-date form generates stable reminder ID and saves the attribute',flush=True)

        page.set_viewport_size({'width':375,'height':760})
        page.evaluate('setView("calendar");render();addNode()')
        page.locator('#nodeDateStart').fill('2026-11-14')
        page.locator('#nodeDateReminder').check()
        assert page.locator('#nodeDateReminderAmount').is_visible()
        assert page.locator('#nodeDateReminderUnit').is_visible()
        print('PASS: reminder controls render on small screens',flush=True)

        # Editing a visible heading while its children are folded must never
        # delete hidden Markdown when the missing reminder ID is inserted.
        page.locator('#cancelModal').click()
        page.set_viewport_size({'width':1180,'height':800})
        page.evaluate('''source=>{
            appEditorSettings.codeFolding=true;
            docs[0].content=source;
            setView('markdown');render();
        }''','# Projekt\n- Eins\n  - Zwei\n  - Drei\n- Vier\n- Fuenf')
        fold=page.locator('#markdownFoldGutter .code-fold-toggle').first
        assert fold.count()==1
        page.evaluate("document.querySelector('#markdownFoldGutter .code-fold-toggle').click()")
        assert page.evaluate("codeFoldHasCollapsed(document.querySelector('#source'))")
        page.evaluate('''()=>{
            const source=document.querySelector('#source');
            source.setRangeText(' [date:2026-11-15 !0m]',1,1,'end');
            source.dispatchEvent(new Event('input',{bubbles:true}));
        }''')
        full=page.evaluate('docs[0].content')
        assert re.search(r'^# \[date:2026-11-15 ![0-9a-f]{4}:0m\] Projekt$',full,re.M),full
        assert '- Fuenf' in full and '  - Zwei' in full and '  - Drei' in full
        assert page.evaluate("codeFoldFull(document.querySelector('#source'))")==full
        print('PASS: ID completion with code folding preserves hidden source and canonical editor state',flush=True)
        assert not errors, errors
        browser.close()

if __name__=='__main__':
    main()
