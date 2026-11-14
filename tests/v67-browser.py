#!/usr/bin/env python3
"""v67 Chromium regression: minute-precise Markdown dates, editor dialogs, HTML and calendar."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re

ROOT=Path(__file__).resolve().parent.parent


def inline_app():
    html=(ROOT/'index.html').read_text(encoding='utf-8')
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                lambda match:'<style>'+(ROOT/match.group(1)).read_text(encoding='utf-8')+'</style>',html)
    html=re.sub(r'<script src="([^"]+)"></script>',
                lambda match:'' if match.group(1) in ('ui/bindings.js','core/service-worker.js')
                else '<script>'+(ROOT/match.group(1)).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>',html)
    return html


SOURCE=(
    '# Projekt\n'
    '- [date:2026-11-13] Ganztag\n'
    '- [date:2026-11-13:18:00 +30m] Meeting\n'
    '- [date:2026-11-13:18:45 +30m] Spaeter\n'
    '- [date:2026-11-13:23:30 +30m] GenauMitternacht\n'
    '- [date:2026-11-13:23:30 +31m] NachMitternacht\n'
    '- [date:2026-11-13 +1M] Monat\n'
    '- [date:2026-11-13 +1m] EineMinute\n'
    '- [date:2026-11-13 +1d] AlteEinheit\n'
    '- [date:2026-11-13:18:61] UngueltigeMinute\n'
    '- [date:2026-11-14] Morgen\n'
    '- Neue Aufgabe\n'
)


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1190,'height':850})
        page.set_default_timeout(15000)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''source=>{
            projects=[{id:'v67',name:'Kalender',folders:[]}];projectId='v67';
            docs=[{id:'notes',projectId:'v67',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
            docId='notes';
            put=async(store,document)=>{if(store==='docs')docs[0].content=document.content};
            calendarMonth={year:2026,month:11};calendarSelectedDay='2026-11-13';
            view='calendar';render();
        }''',SOURCE)
        assert page.locator('#calendarView').count()==1
        assert page.locator('[data-calendar-cell="2026-11-13"] .calendar-day-count').inner_text()=='7'
        assert page.locator('.calendar-agenda-item').count()==7
        names=page.locator('.calendar-agenda-name').all_inner_texts()
        assert names.index('Meeting')<names.index('Spaeter'),names
        assert '18:00 Uhr – 13.11.2026, 18:30 Uhr' in page.locator('.calendar-agenda-item',has_text='Meeting').inner_text()
        assert '18:45 Uhr – 13.11.2026, 19:15 Uhr' in page.locator('.calendar-agenda-item',has_text='Spaeter').inner_text()
        page.locator('[data-calendar-day="2026-11-14"]').click()
        assert page.locator('.calendar-agenda-item',has_text='GenauMitternacht').count()==0
        assert page.locator('.calendar-agenda-item',has_text='NachMitternacht').count()==1
        assert page.locator('.calendar-agenda-item',has_text='Monat').count()==1
        assert page.locator('.calendar-agenda-item').count()==3
        print('PASS: calendar shows HH:MM, sorts by minute, handles midnight-exclusive end and month range',flush=True)

        page.locator('[data-calendar-day="2026-11-13"]').click()
        page.locator('.calendar-agenda-item',has_text='Meeting').click()
        assert page.locator('#nodeDateHour').input_value()=='18'
        assert page.locator('#nodeDateMinute').input_value()=='0'
        assert page.locator('#nodeDateMinutes').input_value()=='30'
        assert '[date:2026-11-13:18:00 +30m]' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeDateHour').select_option('19')
        page.locator('#nodeDateMinute').select_option('10')
        page.locator('#nodeDateMinutes').select_option('20')
        assert '19:30 Uhr' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:19:10 +20m] Meeting")')
        page.locator('.calendar-agenda-item',has_text='Monat').click()
        assert page.locator('#nodeDateMonths').input_value()=='1'
        assert page.locator('#nodeDateMinutes').input_value()=='0'
        assert page.locator('#nodeDateMinute').is_disabled()
        page.locator('#nodeDateMonths').select_option('2')
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13 +2M] Monat")')
        print('PASS: node edit form preserves explicit :00, edits minutes and distinguishes months M',flush=True)

        page.evaluate("setView('html');render()")
        editor=page.locator('[data-html-date-line="3"]')
        editor.locator('summary').click()
        assert editor.locator('[data-html-date-minute]').input_value()=='45'
        assert editor.locator('[data-html-date-m]').input_value()=='30'
        assert editor.locator('[data-html-date-months]').input_value()=='0'
        editor.locator('[data-html-date-minute]').select_option('55')
        editor.locator('[data-html-date-m]').fill('45')
        editor.locator('[data-html-date-y]').fill('1')
        editor.locator('[data-html-date-months]').fill('1')
        editor.locator('[data-html-date-d]').fill('2')
        editor.locator('[data-html-date-h]').fill('2')
        editor.locator('[data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:18:55 +1Y +1M +2D +2h +45m] Spaeter")')
        assert '18:55 +1Y +1M +2D +2h +45m' in page.locator('[data-html-date-line="3"] summary').inner_text()
        editor=page.locator('[data-html-date-line="7"]')
        editor.locator('summary').click()
        assert editor.locator('[data-html-date-hour]').input_value()==''
        assert editor.locator('[data-html-date-minute]').is_disabled()
        editor.locator('[data-html-date-hour]').select_option('8')
        assert editor.locator('[data-html-date-minute]').is_enabled()
        editor.locator('[data-html-date-minute]').select_option('5')
        editor.locator('[data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:08:05 +1m] EineMinute")')
        print('PASS: HTML date form edits all five units; start minute enabled only with a chosen hour',flush=True)

        page.evaluate("setView('calendar');render();addNode()")
        assert page.locator('#nodeDateMinute').is_disabled()
        assert page.locator('#nodeDateMinutes').is_disabled()
        page.locator('#nodeTitle').fill('Neu mit Minuten')
        page.locator('#nodeDateStart').fill('2026-11-13')
        page.locator('#nodeDateHour').select_option('9')
        page.locator('#nodeDateMinute').select_option('5')
        page.locator('#nodeDateDays').select_option('1')
        page.locator('#nodeDateMinutes').select_option('45')
        assert '[date:2026-11-13:09:05 +1D +45m]' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#addForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:09:05 +1D +45m] Neu mit Minuten")')
        print('PASS: create form writes :HH:MM and uppercase days plus minute duration',flush=True)

        page.evaluate("setView('markdown');render()")
        assert page.locator('.syn-date',has_text='2026-11-13:19:10 +20m').count()==1
        assert page.locator('.syn-date',has_text='2026-11-13:18:55 +1Y +1M +2D +2h +45m').count()==1
        assert page.locator('.syn-date-invalid',has_text='+1d').count()==1
        assert page.locator('.syn-date-invalid',has_text='2026-11-13:18:61').count()==1
        print('PASS: editor highlights new case-sensitive syntax and invalid legacy lowercase days',flush=True)

        page.set_viewport_size({'width':375,'height':770})
        page.evaluate("setView('calendar');render();addNode()")
        page.locator('#nodeDateStart').fill('2026-11-13')  # v69: reveal optional fields
        for control in ('#nodeDateMinute','#nodeDateMinutes','#nodeDateMonths'):
            assert page.locator(control).count()==1
            boxes=page.evaluate('''control=>{
                const modal=document.querySelector('#modal').getBoundingClientRect();
                const field=document.querySelector(control).getBoundingClientRect();
                return [modal.left,modal.right,field.left,field.right];
            }''',control)
            assert boxes[2]>=boxes[0]-1 and boxes[3]<=boxes[1]+1,(control,boxes)
        assert not errors,errors
        print('PASS: minute controls fit mobile dialogs at 375px; no uncaught page errors',flush=True)
        browser.close()


if __name__=='__main__':
    main()
