#!/usr/bin/env python3
"""v62: floating Markdown HTML plus menus cannot cause hover layout shifts."""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def inline_app():
    html = (ROOT / 'index.html').read_text()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>' + (ROOT / m.group(1)).read_text() + '</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '' if m.group(1) in ('ui/bindings.js', 'core/service-worker.js')
                  else '<script>' + (ROOT / m.group(1)).read_text().replace('</script', '<\\/script') + '</script>', html)
    return html


def render_source(page, source):
    page.evaluate('''source => {
      projects=[{id:'p62',name:'Test',created:Date.now(),folders:[]}];projectId='p62';
      docs=[{id:'md',projectId:'p62',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
      docId='md';view='html';put=async()=>{};render();
    }''', source)


def bounds(page, selectors):
    return page.evaluate('''selectors => {
      const article = document.querySelector('.html-md-article').getBoundingClientRect();
      return Object.fromEntries(selectors.map(selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return [selector, {x:rect.x-article.x,y:rect.y-article.y,width:rect.width,height:rect.height}];
      }));
    }''', selectors)


def nearly_equal(a, b, selectors):
    for selector in selectors:
        for dimension in ('x', 'y', 'width', 'height'):
            assert abs(a[selector][dimension] - b[selector][dimension]) < .6, (selector, dimension, a[selector], b[selector])


def main():
    source = ('# Ohne Attribute\n'
              '## [status:doing] Mit Status\n'
              '### [date:2026-11-08] Mit Datum\n'
              '- Listenpunkt\n'
              '  - Verschachtelter Knoten\n'
              '- [ ] Aufgabe ohne Status und Datum\n'
              '- [status:done] Mit Statusliste\n'
              '## Eine lange Überschrift mit sehr langem Text, die auf kleineren Bildschirmen umbrechen muss, ohne beim Hover ihre Höhe zu ändern\n'
              '- Ein sehr langer Listenknoten, dessen Text am Zeilenende umbrechen kann und dessen Plus-Schaltfläche trotzdem ohne Layoutsprung bedienbar bleibt')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',
                                     args=['--no-sandbox', '--disable-dev-shm-usage'])
        for width in (1100, 390):
            page = browser.new_page(viewport={'width':width,'height':900})
            page.set_default_timeout(8000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.set_content(inline_app(), wait_until='load', timeout=30000)
            render_source(page, source)
            page.mouse.move(5, 5)
            selectors = ['#html-md-heading-0', '#html-md-heading-1', '#html-md-heading-2',
                         '#html-md-heading-7', '.html-md-list-row:nth-child(1)',
                         '.html-md-article']
            # The list selector must reference an actual node, not a nested li structure.
            selectors = [s for s in selectors if page.locator(s).count() == 1]
            before = bounds(page, selectors)
            heading = page.locator('#html-md-heading-0')
            heading.locator('h1').hover()
            toggle = heading.locator('[data-html-menu-toggle]')
            assert toggle.is_visible()
            assert toggle.evaluate('(el)=>getComputedStyle(el.closest(".html-md-node-controls")).position') == 'absolute'
            assert page.locator('#html-md-heading-1 .html-md-node-controls').evaluate('(el)=>getComputedStyle(el).position') == 'relative'
            nearly_equal(before, bounds(page, selectors), selectors)
            title_box = heading.locator('.html-md-heading-title').bounding_box()
            button_box = toggle.bounding_box()
            assert 0 <= button_box['x'] - (title_box['x'] + title_box['width']) <= 12
            # Cursor must be able to cross the space between title and plus.
            page.mouse.move(button_box['x'] + button_box['width']/2, button_box['y'] + button_box['height']/2)
            assert toggle.is_visible(), 'Plus vanished while moving from title to button'
            toggle.click()
            assert heading.locator('[data-html-attr-add="status"]').is_visible()
            nearly_equal(before, bounds(page, selectors), selectors)
            page.locator('.html-md-toc summary').click()
            page.mouse.move(5,5)
            # List nodes without status/date float; metadata-bearing rows stay in flow.
            row = page.locator('.html-md-list-row').first
            row.locator('.html-md-list-text').hover()
            assert row.locator('[data-html-menu-toggle]').is_visible()
            assert row.locator('.html-md-node-controls').evaluate('(el)=>getComputedStyle(el).position') == 'absolute'
            nearly_equal(before, bounds(page, selectors), selectors)
            for row_number in (1, 2, 3):
                line = page.locator('.html-md-list-row').nth(row_number)
                if row_number == 3:
                    assert line.locator('.html-md-node-controls').evaluate('(el)=>getComputedStyle(el).position') == 'relative'
            # Long heading and list must not change line wraps when plus becomes visible.
            page.mouse.move(5,5)
            long_title = page.locator('#html-md-heading-7')
            initial_h = long_title.bounding_box()['height']
            long_title.locator('h2').hover()
            assert abs(long_title.bounding_box()['height'] - initial_h) < .6
            long_title.locator('[data-html-menu-toggle]').click()
            # Floating controls near the right edge must keep their menu onscreen.
            menu = long_title.locator('.html-md-attr-options')
            box = menu.bounding_box()
            clip = page.locator('#htmlMdScroll').bounding_box()
            assert box['x'] >= clip['x'] + 2 and box['x'] + box['width'] <= clip['x'] + clip['width'] - 2, (box, clip)
            long_row = page.locator('.html-md-list-row').last
            page.mouse.move(5,5)
            initial_h = long_row.bounding_box()['height']
            long_row.locator('.html-md-list-text').hover()
            assert abs(long_row.bounding_box()['height'] - initial_h) < .6
            assert not errors, errors
            print(f'PASS: width {width}px; absolute plus, no hover/menu reflow, long-text wrapping, metadata controls')
            page.close()
        browser.close()


if __name__ == '__main__':
    main()
