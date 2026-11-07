#!/usr/bin/env python3
"""v57 patch diff: only changed fragments colored, with per-Hunk color reversal."""
import json
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


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                     args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width': 1100, 'height': 800})
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.set_content(inline_app(), wait_until='load', timeout=60000)
        page.evaluate('''() => {
          flushMapInlineEdit = async () => true; flushSource = async () => true;
          projects = [{id:'v57',name:'Test',created:Date.now(),folders:[]}]; projectId = 'v57';
          docs = [{id:'a',projectId:'v57',name:'demo.js',path:'demo.js',fileType:'script',
            content:'alpha old omega\\nremove-only\\nprefix\\nA😀Z\\n'}];
          docId='a';activeFilePanel='script';view='markdown';appSettingsOpen=false;
          render();openPatchTool();
        }''')
        patch = {'patches': [{'operation': 'update', 'file': 'demo.js', 'hunks': [
            {'search': 'alpha old omega', 'replace': 'alpha NEW omega', 'occurrence': 1},
            {'search': 'remove-only', 'replace': '', 'occurrence': 1},
            {'search': 'prefix', 'replace': 'prefix ADD', 'occurrence': 1},
            {'search': 'A😀Z', 'replace': 'A🦊Z', 'occurrence': 1},
        ]}]}
        page.locator('#patchJsonInput').fill(json.dumps(patch, ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        page.locator('[data-patch-file="0"] summary').click()
        rows = page.locator('.patch-preview-operation')
        assert rows.count() == 4

        def snapshot(index):
            return rows.nth(index).evaluate('''el => {
              const style = (selector) => {
                const e = el.querySelector(selector);
                if (!e) return null;
                const c = getComputedStyle(e);
                return {color:c.color, background:c.backgroundColor,
                  strike:c.textDecorationLine.includes('line-through'), text:e.textContent};
              };
              return {active:el.classList.contains('patch-active'),
                search:style('.patch-preview-diff-search .patch-diff-removed'),
                replace:style('.patch-preview-diff-replace .patch-diff-added'),
                searchUnchanged:style('.patch-preview-diff-search .patch-diff-unchanged'),
                replaceUnchanged:style('.patch-preview-diff-replace .patch-diff-unchanged'),
                preColor:style('.patch-preview-diff-search pre').color};
            }''')

        red, green = 'rgb(255, 210, 216)', 'rgb(196, 248, 214)'
        transparent = 'rgba(0, 0, 0, 0)'
        for i in range(4):
            x = snapshot(i)
            assert x['active'], (i, x)
            if x['search']:
                assert x['search']['color'] == red and x['search']['strike'], (i, x)
            if x['replace']:
                assert x['replace']['color'] == green and not x['replace']['strike'], (i, x)
            for key in ('searchUnchanged', 'replaceUnchanged'):
                if x[key]:
                    assert x[key]['color'] == x['preColor'], (i, key, x)
                    assert x[key]['background'] == transparent, (i, key, x)
        assert snapshot(0)['search']['text'] == 'old'
        assert snapshot(0)['replace']['text'] == 'NEW'
        assert snapshot(1)['replace'] is None
        assert snapshot(2)['search'] is None
        assert snapshot(3)['search']['text'] == '😀'
        assert snapshot(3)['replace']['text'] == '🦊'
        print('PASS: active Hunks show red only for search deletions and green only for replace insertions')

        # A single Hunk's selection must flip only its own colors.
        row1before = snapshot(1)
        page.locator('[data-patch-operation="0:0"]').uncheck()
        off = snapshot(0)
        assert not off['active'] and off['search']['color'] == green and not off['search']['strike'], off
        assert off['replace']['color'] == red and off['replace']['strike'], off
        assert snapshot(1) == row1before, (snapshot(1), row1before)
        assert page.locator('[data-patch-file="0"]').get_attribute('open') is not None
        page.locator('[data-patch-operation="0:0"]').check()
        assert snapshot(0)['active'] and snapshot(0)['search']['color'] == red
        assert snapshot(0)['replace']['color'] == green
        for i in (1, 2, 3):
            page.locator(f'[data-patch-operation="0:{i}"]').uncheck()
            x = snapshot(i)
            assert not x['active'], (i, x)
            if x['search']:
                assert x['search']['color'] == green and not x['search']['strike'], (i, x)
            if x['replace']:
                assert x['replace']['color'] == red and x['replace']['strike'], (i, x)
            page.locator(f'[data-patch-operation="0:{i}"]').check()
            assert snapshot(i)['active'], i
        assert page.locator('.patch-preview-total').count() == 1
        assert not errors, errors
        print('PASS: inactive Hunks reverse colors and reactivation restores colors independently')
        browser.close()


if __name__ == '__main__':
    main()
