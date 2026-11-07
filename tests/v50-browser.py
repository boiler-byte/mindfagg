#!/usr/bin/env python3
"""v50 browser regression: file-extension icons and renamed patch shortcut."""
from pathlib import Path
from runpy import run_path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
inline_app=run_path(str(ROOT/'v48-browser.py'))['inline_app']


def run():
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                                           args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1180,'height':820},device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        page.evaluate('''() => {
          projects=[{id:'p48',name:'Typ-Icons',created:Date.now(),folders:['src','src/deep','assets']}];projectId='p48';
          const entries=[
            ['js','src/app.js','script'],['mjs','lib.mjs','script'],['cjs','mod.cjs','script'],
            ['jsx','component.jsx','script'],['css','src/theme.css','script'],
            ['htm','src/deep/template.htm','script'],['html','index.html','script'],
            ['xhtml','old.xhtml','script'],['md','README.md','markdown'],
            ['markdown','src/notes.markdown','markdown'],['mdown','task.mdown','markdown'],
            ['txt','text.txt','script'],['png','assets/image.png','image'],
            ['audio','assets/sound.mp3','audio']
          ];
          docs=entries.map(([id,path,fileType])=>({id,projectId:'p48',path,name:path.split('/').pop(),fileType,
            content:fileType==='markdown'?'# Demo\\n':'Example',data:[] }));
          docId='js';activeFolderPath='';render();
        }''')
        assert not errors, errors
        assert page.locator('#workspacePatchQuick span').inner_text()=='Patchen'
        assert page.locator('#workspacePatchQuick').get_attribute('title')=='Patchen'
        assert page.locator('#workspaceShareQuick').bounding_box()['x'] < page.locator('#workspacePatchQuick').bounding_box()['x']
        expected={'js':'file-type-js','mjs':'file-type-js','cjs':'file-type-js','jsx':'file-type-js',
                  'css':'file-type-css','htm':'file-type-html','html':'file-type-html','xhtml':'file-type-html',
                  'md':'file-type-markdown','markdown':'file-type-markdown','mdown':'file-type-markdown'}
        for key,kind in expected.items():
            icon=page.locator(f'[data-doc="{key}"] .sym svg')
            assert icon.count()==1, (key,'SVG icon missing')
            assert kind in icon.get_attribute('class'),(key,icon.get_attribute('class'))
        assert page.locator('[data-doc="js"] .file-type-js rect').get_attribute('fill')=='#f7df1e'
        assert page.locator('[data-doc="js"] .file-type-js text').text_content()=='JS'
        assert page.locator('[data-doc="css"] .file-type-css').evaluate('el=>getComputedStyle(el).color')=='rgb(74, 168, 255)'
        assert page.locator('[data-doc="html"] .file-type-html').evaluate('el=>getComputedStyle(el).color')=='rgb(250, 143, 66)'
        assert page.locator('[data-doc="md"] .file-type-markdown').evaluate('el=>getComputedStyle(el).color')=='rgb(74, 168, 255)'
        for key in ['txt','png','audio']:
            assert page.locator(f'[data-doc="{key}"] .sym svg').count()==0
            assert page.locator(f'[data-doc="{key}"] .sym').inner_text()
        assert page.locator('.folder-name .file-icon svg').count()>=1
        assert page.locator('[data-doc="js"] .sym svg').bounding_box()['width']>=18
        page.locator('#workspacePatchQuick').click()
        assert page.locator('#patchTool').is_visible()
        page.locator('#patchClose').click()
        page.locator('[data-doc="css"]').click()
        assert page.locator('[data-doc="css"]').get_attribute('class').find('active')>=0
        assert not errors,errors
        print('PASS: v50 extensions, icon colors, patch shortcut, file selection')
        page.set_viewport_size({'width':390,'height':780})
        page.evaluate('setMobileMenu(true)')
        assert page.locator('#workspacePatchQuick').is_visible()
        assert page.locator('#workspacePatchQuick span').inner_text()=='Patchen'
        assert page.locator('[data-doc="css"] .file-type-css').is_visible()
        assert page.locator('[data-doc="md"] .file-type-markdown').is_visible()
        assert not errors,errors
        print('PASS: v50 mobile sidebar icon visibility')
        browser.close()


if __name__=='__main__':
    run()
