#!/usr/bin/env python3
"""v69 browser regression: progressive date/reminder fields in node edit/create."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def inline_app():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '' if m.group(1) in ('ui/bindings.js', 'core/service-worker.js')
                  else '<script>' + (ROOT / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>', html)
    return html


SOURCE = (
    '# Projekt\n'
    '- Ohne Datum\n'
    '- [date:2026-11-13:18:00 +1h !a7f3:30m] Mit Reminder\n'
    '- [date:2026-11-13:09 +20m] Ohne Reminder\n'
)


def edit_by_title(page, title):
    page.evaluate('''title=>{
        const node=flattened(currentModel).find(n=>n.title===title);
        if(!node)throw Error('Knoten nicht gefunden: '+title);
        editNode(node.path);
    }''', title)
    assert page.locator('#nodeForm').is_visible()


def check_hidden_without_start(page):
    assert page.locator('#nodeDateStart').is_visible()
    assert page.locator('#nodeDateTimeFields').is_hidden()
    assert page.locator('#nodeDateDurations').is_hidden()
    assert page.locator('#nodeDateReminderFields').is_hidden()
    assert page.locator('#nodeDatePreview').is_hidden()
    assert page.locator('#nodeDateHour').is_disabled()
    assert page.locator('#nodeDateReminder').is_disabled()
    assert page.locator('#nodeDateReminderAmount').is_disabled()
    assert page.locator('.node-date-layout').evaluate('el=>el.classList.contains("node-date-empty")')


def check_visible_with_start(page, reminder=False):
    assert page.locator('#nodeDateTimeFields').is_visible()
    assert page.locator('#nodeDateDurations').is_visible()
    assert page.locator('#nodeDateReminderFields').is_visible()
    assert page.locator('#nodeDatePreview').is_visible()
    assert page.locator('#nodeDateHour').is_enabled()
    assert page.locator('#nodeDateReminder').is_enabled()
    assert page.locator('#nodeDateReminderOptions').is_visible() == reminder
    assert page.locator('#nodeDateReminderInfo').is_visible() == reminder
    assert page.locator('#nodeDateReminderAmount').is_enabled() == reminder
    assert not page.locator('.node-date-layout').evaluate('el=>el.classList.contains("node-date-empty")')


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                     args=['--no-sandbox','--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1100, 'height': 900})
        page.set_default_timeout(16000)
        errors=[]
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(inline_app(), wait_until='load', timeout=60000)
        page.evaluate('''source=>{
            projects=[{id:'v69',name:'Datumstest',folders:[]}];projectId='v69';
            docs=[{id:'notes',projectId:'v69',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
            docId='notes';
            put=async(store,document)=>{if(store==='docs')docs[0].content=document.content};
            view='mindmap';render();
        }''', SOURCE)

        # A node without date initially displays only the start-date picker.
        edit_by_title(page, 'Ohne Datum')
        check_hidden_without_start(page)
        page.locator('#nodeDateStart').fill('2026-11-15')
        check_visible_with_start(page)
        assert page.locator('#nodeDateReminderOptions').is_hidden()
        page.locator('#nodeDateHour').select_option('18')
        page.locator('#nodeDateMinute').select_option('25')
        page.locator('#nodeDateMinutes').select_option('30')
        assert '[date:2026-11-15:18:25 +30m]' in page.locator('#nodeDatePreview').inner_text()

        # Reminder detail form is a disclosure; ID survives toggling.
        page.locator('#nodeDateReminder').check()
        check_visible_with_start(page, True)
        page.locator('#nodeDateReminderAmount').fill('10')
        generated_id=page.locator('#nodeDateReminderId').input_value()
        assert re.fullmatch('[0-9a-f]{4}', generated_id), generated_id
        assert f'!{generated_id}:10m' in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeDateReminder').uncheck()
        check_visible_with_start(page)
        assert '!' not in page.locator('#nodeDatePreview').inner_text()
        page.locator('#nodeDateReminder').check()
        check_visible_with_start(page, True)
        assert page.locator('#nodeDateReminderId').input_value() == generated_id
        assert page.locator('#nodeDateReminderAmount').input_value() == '10'

        # Clearing and restoring start date hides/shows sections without losing user input.
        page.locator('#nodeDateStart').fill('')
        check_hidden_without_start(page)
        page.locator('#nodeDateStart').fill('2026-11-15')
        check_visible_with_start(page, True)
        assert page.locator('#nodeDateHour').input_value() == '18'
        assert page.locator('#nodeDateMinutes').input_value() == '30'
        assert page.locator('#nodeDateReminderId').input_value() == generated_id
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('(id)=>docs[0].content.includes("[date:2026-11-15:18:25 +30m !"+id+":10m] Ohne Datum")', arg=generated_id)
        print('PASS: missing start collapses date form; entering/toggling/restoring date retains fields and stable reminder ID', flush=True)

        edit_by_title(page, 'Mit Reminder')
        check_visible_with_start(page, True)
        assert page.locator('#nodeDateReminderId').input_value() == 'a7f3'
        assert page.locator('#nodeDateReminderAmount').input_value() == '30'
        assert page.locator('#nodeDateReminderInfo').is_visible()
        page.locator('#nodeDateReminder').uncheck()
        check_visible_with_start(page)
        assert page.locator('#nodeDateReminderId').input_value() == 'a7f3'
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-13:18:00 +1h] Mit Reminder")')
        assert '!a7f3:' not in page.evaluate('docs[0].content')
        print('PASS: existing reminder is visible on edit, can be removed without changing date or duration', flush=True)

        edit_by_title(page, 'Ohne Reminder')
        check_visible_with_start(page)
        assert not page.locator('#nodeDateReminder').is_checked()
        assert page.locator('#nodeDateReminderInfo').is_hidden()
        assert page.locator('#nodeDateMinutes').input_value() == '20'
        # Removing a date drops its metadata, rather than saving hidden controls.
        page.locator('#nodeDateStart').fill('')
        check_hidden_without_start(page)
        page.locator('#nodeForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("- Ohne Reminder")')
        assert '[date:2026-11-13:09 +20m]' not in page.evaluate('docs[0].content')
        print('PASS: clearing date removes tag and hides entire remainder of date controls', flush=True)

        # The shared date widget is also used by the create-node form.
        page.evaluate('addNode()')
        assert page.locator('#addForm').is_visible()
        check_hidden_without_start(page)
        page.locator('#nodeTitle').fill('Neu ohne Erinnerung')
        page.locator('#nodeDateStart').fill('2026-11-20')
        check_visible_with_start(page)
        page.locator('#addForm button[type="submit"]').click()
        page.wait_for_function('docs[0].content.includes("[date:2026-11-20] Neu ohne Erinnerung")')
        print('PASS: create-node form reuses the same progressive disclosure and saves date without reminder', flush=True)

        page.set_viewport_size({'width':375,'height':760})
        page.evaluate('addNode()')
        check_hidden_without_start(page)
        page.locator('#nodeDateStart').fill('2026-11-21')
        check_visible_with_start(page)
        page.locator('#nodeDateReminder').check()
        check_visible_with_start(page, True)
        assert page.locator('#nodeDateReminderUnit').is_visible()
        print('PASS: mobile form expands correctly', flush=True)

        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    main()
