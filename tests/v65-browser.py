#!/usr/bin/env python3
"""v65 Chromium integration: dates with hours in editor, forms and calendar."""
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
    '- [date:2026-11-13] Ganztag\n'
    '- [date:2026-11-13:18] Fixer Termin\n'
    '- [date:2026-11-13:18 +6h] Bis Mitternacht\n'
    '- [date:2026-11-13:23 +2h] Nachtschicht\n'
    '- [date:2026-11-13:25] Ungueltige Stunde\n'
    '- [date:2026-11-14] Morgen\n'
)


def main():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1190,'height':850})
        page.set_default_timeout(12000)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''source=>{
            projects=[{id:'v65',name:'Kalender',folders:[]}];projectId='v65';
            docs=[{id:'notes',projectId:'v65',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
            docId='notes';
            put=async(store,document)=>{if(store==='docs')docs[0].content=document.content};
            calendarMonth={year:2026,month:11};calendarSelectedDay='2026-11-13';
            view='calendar';render();
        }''',SOURCE)
        assert page.locator('#calendarView').count()==1
        assert page.locator('[data-calendar-cell="2026-11-13"] .calendar-day-count').inner_text()=='4'
        assert page.locator('.calendar-agenda-item').count()==4
        assert '18:00 Uhr' in page.locator('.calendar-agenda-item',has_text='Fixer Termin').inner_text()
        assert '14.11.2026, 00:00 Uhr' in page.locator('.calendar-agenda-item',has_text='Bis Mitternacht').inner_text()
        assert '18:00' in page.locator('[data-calendar-cell="2026-11-13"] .calendar-event-stack').inner_text()
        page.locator('[data-calendar-day="2026-11-14"]').click()
        assert page.locator('.calendar-agenda-item').count()==2
        assert page.locator('.calendar-agenda-item',has_text='Nachtschicht').count()==1
        assert page.locator('.calendar-agenda-item',has_text='Bis Mitternacht').count()==0
        print('PASS: calendar hours, chronological events, midnight-exclusive range and day selection',flush=True)
        page.locator('[data-calendar-day="2026-11-13"]').click()
        page.locator('.calendar-agenda-item',has_text='Bis Mitternacht').click()
        assert page.locator('#nodeDateHour').input_value()=='18'
        assert page.locator('#nodeDateHours').input_value()=='6'
        assert '[date:2026-11-13:18 +6h]' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeDateHour').select_option('20')
        page.locator('#nodeDateHours').select_option('9')
        assert '2026-11-14, 05:00 Uhr' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:20 +9h] Bis Mitternacht")')
        page.locator('[data-calendar-day="2026-11-14"]').click()
        assert page.locator('.calendar-agenda-item',has_text='Bis Mitternacht').count()==1
        print('PASS: edit form round trip for start hour and hour duration',flush=True)
        page.evaluate("setView('html');render()")
        editor=page.locator('[data-html-date-line="4"]')
        editor.locator('summary').click()
        assert editor.locator('[data-html-date-hour]').input_value()=='23'
        assert editor.locator('[data-html-date-h]').input_value()=='2'
        editor.locator('[data-html-date-hour]').select_option('22')
        editor.locator('[data-html-date-h]').fill('5')
        editor.locator('[data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:22 +5h] Nachtschicht")')
        assert ':22 +5h' in page.locator('[data-html-date-line="4"] summary').inner_text()
        page.locator('[data-html-date-line="2"] summary').click()
        page.locator('[data-html-date-line="2"] [data-html-date-hour]').select_option('')
        page.locator('[data-html-date-line="2"] [data-html-date-h]').fill('6')
        page.locator('[data-html-date-line="2"] [data-html-date-save]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13 +6h] Fixer Termin")')
        print('PASS: HTML view supports adding/removing an optional hour and editing hourly duration',flush=True)
        page.evaluate("setView('calendar');render();addNode()")
        assert page.locator('#nodeDateHour').is_visible()
        assert page.locator('#nodeDateHour').is_disabled()
        page.locator('#nodeTitle').fill('Neue Zeitaufgabe')
        page.locator('#nodeDateStart').fill('2026-11-13')
        page.locator('#nodeDateHour').select_option('9')
        page.locator('#nodeDateHours').select_option('3')
        page.locator('#addForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:09 +3h] Neue Zeitaufgabe")')
        print('PASS: creation form, optional start hour and hourly duration',flush=True)
        page.evaluate("setView('markdown');render()")
        assert page.locator('.syn-date-invalid',has_text='2026-11-13:25').count()==1
        assert page.locator('.syn-date',has_text='2026-11-13:09 +3h').count()==1
        print('PASS: syntax highlighting accepts valid new tags and flags invalid hours',flush=True)
        page.set_viewport_size({'width':375,'height':770})
        page.evaluate("setView('calendar');render();addNode()")
        assert page.locator('#nodeDateHour').is_visible()
        assert page.locator('#nodeDateHours').count()==1
        widths=page.evaluate('''()=>{
           const shell=document.querySelector('#modal').getBoundingClientRect();
           const hour=document.querySelector('#nodeDateHours').getBoundingClientRect();
           return {shellLeft:shell.left,shellRight:shell.right,hourLeft:hour.left,hourRight:hour.right};
        }''')
        assert widths['hourLeft']>=widths['shellLeft']-1,widths
        assert widths['hourRight']<=widths['shellRight']+1,widths
        assert not errors,errors
        print('PASS: responsive node form at 375px; no page errors',flush=True)
        browser.close()

if __name__=='__main__':
    main()
