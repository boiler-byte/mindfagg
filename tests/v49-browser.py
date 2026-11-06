#!/usr/bin/env python3
"""v49: sidebar order, rejected-patch clipboard interaction, literal JSON escapes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from runpy import run_path
inline_app=run_path(str(Path(__file__).with_name("v48-browser.py")))["inline_app"]


def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1170,'height':840})
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        assert not errors,errors
        assert page.locator('#workspaceShareQuick').bounding_box()['x'] < page.locator('#workspacePatchQuick').bounding_box()['x']
        assert page.locator('#workspaceShareQuick').bounding_box()['y'] == page.locator('#workspacePatchQuick').bounding_box()['y']
        page.evaluate('''() => {
            window.copied=[];
            Object.defineProperty(navigator,'clipboard', {configurable:true,value:{writeText: async text=>{window.copied.push(text)}}});
        }''')
        page.locator('#workspacePatchQuick').click()
        page.locator('#patchTool').wait_for()
        phrase=page.locator('#patchPromptPhrase').inner_text()
        assert 'Anführungszeichen \\"' in phrase,repr(phrase)
        assert 'Backslashes \\\\' in phrase,repr(phrase)
        assert 'Zeilenumbrüche als \\n' in phrase,repr(phrase)
        assert page.evaluate('PATCH_TOOL_PROMPT')==phrase
        assert page.locator('#patchToolMessage').locator('button').count()==0

        page.locator('#patchJsonInput').fill('{"patches":[]}')
        assert page.locator('.patch-validate-link').count()==1
        page.locator('.patch-validate-link').click()
        rejected=page.locator('.patch-rejected-copy')
        assert rejected.count()==1
        full_error=rejected.inner_text()
        assert full_error.startswith('Patch abgelehnt: '),full_error
        assert page.locator('#patchToolMessage').get_attribute('data-kind')=='error'
        assert rejected.evaluate('el=>getComputedStyle(el).color')=='rgb(255, 213, 221)'
        rejected.click()
        page.wait_for_function('window.copied.length===1')
        assert page.evaluate('window.copied[0]')==full_error
        assert page.locator('#toast').inner_text()=='Fehlermeldung kopiert'
        assert rejected.inner_text()==full_error

        rejected.focus()
        rejected.press('Enter')
        page.wait_for_function('window.copied.length===2')
        rejected.press('Space')
        page.wait_for_function('window.copied.length===3')
        assert page.evaluate('window.copied')==[full_error]*3
        print('PASS: click, Enter and Space copy full rejected-patch text')

        # Denied Clipboard API must use the same fallback as the mindmap.
        page.evaluate('''() => {
            navigator.clipboard.writeText=async () => {throw new Error('permission denied')};
            document.execCommand=cmd=>{
              if(cmd!=='copy')return false;
              window.copied.push(document.activeElement.value);
              return true;
            };
        }''')
        rejected.click()
        page.wait_for_function('window.copied.length===4')
        assert page.evaluate('window.copied[3]')==full_error
        assert page.locator('#toast').inner_text()=='Fehlermeldung kopiert'
        page.evaluate('document.execCommand=()=>false')
        rejected.click()
        page.wait_for_function('document.querySelector("#toast").textContent==="Fehlermeldung konnte nicht kopiert werden"')
        assert page.evaluate('window.copied.length')==4
        print('PASS: permission fallback and honest copy-failure message')

        # Only the specific rejected-JSON message is clickable. Others stay informational.
        page.evaluate("patchToolMessage('Fehler bei der Vorschau.','error')")
        assert page.locator('.patch-rejected-copy').count()==0
        page.locator('#patchJsonInput').fill(json.dumps({'patches':[{'operation':'create','file':'new.js','content':'OK'}]}))
        page.locator('.patch-validate-link').click()
        assert page.locator('#patchPreview').is_visible()
        assert page.locator('#patchApply').is_enabled()
        page.locator('#patchClose').click()

        # The share dialog uses the central prompt (no stale duplicate).
        page.evaluate('''() => {navigator.clipboard.writeText=async text=>{window.copied.push(text)}}''')
        page.locator('#workspaceShareQuick').click()
        page.locator('#workspaceShareDialog').wait_for()
        page.locator('#workspaceShareCopyPatch').click()
        page.wait_for_function('window.copied.length===5')
        assert page.evaluate('window.copied[4]')==phrase
        page.locator('#workspaceShareCancel').click()
        print('PASS: prompt escapes and shared copy action')

        page.set_viewport_size({'width':390,'height':800})
        page.evaluate('setMobileMenu(true)')
        share=page.locator('#workspaceShareQuick').bounding_box()
        patch=page.locator('#workspacePatchQuick').bounding_box()
        assert share['x']<patch['x'] and share['y']==patch['y']
        assert not errors,errors
        print('PASS: v49 desktop and mobile sidebar order without runtime errors')
        browser.close()

if __name__=='__main__':run()
