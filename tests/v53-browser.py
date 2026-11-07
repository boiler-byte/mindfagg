#!/usr/bin/env python3
"""v53 browser regression: Mermaid pan/zoom, clipboard, map truncation, patch deltas."""
import json
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


def run():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                                   args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1200,'height':800})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(inline_app(),wait_until='load',timeout=60000)
        order=page.locator('#markdownTabs [data-view]').evaluate_all(
            '(nodes)=>nodes.map(n=>n.dataset.view)')
        assert order==['markdown','mindmap','html','kanban','calendar'],order
        assert page.evaluate('workspaceSuggestTextName("sequenceDiagram\\n Alice->>Bob: Hi")')=='clipboard.mmd'
        assert page.evaluate('workspaceSuggestTextName("flowchart TD\\n A-->B")')=='clipboard.mmd'
        assert page.evaluate('workspaceSuggestTextName("%% example\\nstateDiagram-v2\\n A-->B")')=='clipboard.mmd'
        assert page.evaluate('workspaceSuggestTextName("---\\ntitle: Demo\\n---\\nclassDiagram\\n class Animal")')=='clipboard.mmd'
        assert page.evaluate('workspaceSuggestTextName("const answer=42;")')=='clipboard.js'
        descriptor=page.evaluate('''() => workspaceClipboardFromEvent({clipboardData:{
          items:[],getData:type=>type==='text/plain'?'graph LR\\nA-->B':''}})[0]''')
        assert descriptor['path']=='clipboard.mmd' and descriptor['mime']=='text/plain',descriptor
        print('PASS: tab order and Mermaid clipboard detection (including comments/front matter)')
        page.evaluate('''() => {
          flushSource=async()=>true;flushMapInlineEdit=async()=>true;
          mermaidEnginePromise=Promise.resolve({
            async parse(){return {diagramType:'flowchart-v2'}},
            async render(){return {svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 900" width="100%" height="900"><rect width="1800" height="900" fill="#4682b4"/></svg>'}}
          });
          projects=[{id:'p53',name:'Testprojekt',created:Date.now(),folders:[]}];projectId='p53';
          docs=[{id:'mermaid',projectId:'p53',name:'test.mmd',path:'test.mmd',fileType:'script',
            content:'flowchart TD\\n A-->B'}];
          docId='mermaid';activeFilePanel='preview';view='markdown';appSettingsOpen=false;
          render();
        }''')
        page.wait_for_function('mermaidPreviewState?.width===1800 && mermaidPreviewState?.scale>0',timeout=12000)
        assert page.locator('.mermaid-preview-toolbar').count()==0
        assert page.locator('#mermaidEditSource').count()==0
        assert page.locator('#mermaidPreviewStage img').count()==1
        assert page.locator('#mermaidPreviewStage svg').count()==0
        initial=page.evaluate('''() => ({x:mermaidPreviewState.panX,y:mermaidPreviewState.panY,s:mermaidPreviewState.scale})''')
        viewport=page.locator('#mermaidPreviewViewport').bounding_box()
        cx=viewport['x']+viewport['width']*.5
        cy=viewport['y']+viewport['height']*.5
        page.mouse.move(cx,cy)
        page.mouse.wheel(0,-320)
        page.wait_for_function('(s)=>mermaidPreviewState.scale>s',arg=initial['s'],timeout=5000)
        zoom=page.evaluate('mermaidPreviewState.scale')
        page.mouse.move(cx,cy)
        page.mouse.down()
        page.mouse.move(cx+105,cy+65,steps=6)
        page.mouse.up()
        moved=page.evaluate('''() => ({x:mermaidPreviewState.panX,y:mermaidPreviewState.panY,s:mermaidPreviewState.scale})''')
        assert moved['x']!=initial['x'] and moved['y']!=initial['y'],(initial,moved)
        # A pinch increases scale relative to the last zoom, without adding UI controls.
        page.evaluate('''() => {
          const viewport=document.querySelector('#mermaidPreviewViewport');
          const event=(type,id,x,y)=>viewport.dispatchEvent(new PointerEvent(type,{
            pointerId:id,pointerType:'touch',isPrimary:id===11,bubbles:true,clientX:x,clientY:y}));
          const box=viewport.getBoundingClientRect(),x=box.left+200,y=box.top+200;
          event('pointerdown',11,x,y);event('pointerdown',12,x+100,y);
          event('pointermove',12,x+190,y);
          event('pointerup',12,x+190,y);event('pointerup',11,x,y);
        }''')
        assert page.evaluate('mermaidPreviewState.scale')>zoom*1.4
        page.locator('#mermaidPreviewViewport').focus()
        page.locator('#mermaidPreviewViewport').press('0')
        fitted=page.evaluate('''() => ({x:mermaidPreviewState.panX,y:mermaidPreviewState.panY,s:mermaidPreviewState.scale})''')
        assert abs(fitted['s']-initial['s'])<1e-6,(initial,fitted)
        # Saved view should survive switching file views for unchanged source.
        page.mouse.move(cx,cy)
        page.mouse.wheel(0,-160)
        expected=page.evaluate('mermaidPreviewState.scale')
        page.locator('[data-file-panel="script"]').click()
        page.locator('[data-file-panel="preview"]').click()
        page.wait_for_function('(s)=>mermaidPreviewState?.scale===s',arg=expected,timeout=8000)
        print('PASS: Mermaid fit, wheel zoom, drag pan, pinch zoom, keyboard reset and remembered view')
        # Test truncation in rendered mindmap, without truncating persisted source.
        longtitle='\u00dc'*132
        page.evaluate('''(title) => {
          docs=[{id:'md',projectId:'p53',path:'note.md',name:'note',fileType:'markdown',
            content:'# Root\\n## '+title+'\\n'}];
          docId='md';view='mindmap';render();
        }''',longtitle)
        label=page.locator('.mm-node .node-text').last.inner_text()
        assert len(label)==120 and label.endswith('\u2026'),(len(label),label)
        assert longtitle in page.locator('.mm-node').last.get_attribute('aria-label')
        page.locator('.mm-node .node-text').last.click()
        assert page.locator('.mm-inline-input').input_value()==longtitle
        assert longtitle in page.evaluate('docs[0].content')
        print('PASS: visible Mindmap title limited to 120 characters, original text editable')
        # Multi-operation patch preview, byte-accurate deltas and all three save modes.
        patch={'patches':[
          {'operation':'update','file':'a.txt','hunks':[
            {'search':'\u00e4','replace':'\u20ac\u20ac','occurrence':1},
            {'search':'A','replace':'AA','occurrence':1}]},
          {'operation':'create','file':'new.txt','content':'Hello'},
          {'operation':'delete','file':'old.txt'}]}
        page.evaluate('''() => {
          docs=[{id:'a',projectId:'p53',path:'a.txt',name:'a.txt',fileType:'script',content:'\u00e4A'},
            {id:'old',projectId:'p53',path:'old.txt',name:'old.txt',fileType:'script',content:'xyz'}];
          docId='a';activeFilePanel='script';view='markdown';render();
          window.testCommitted=null;
          workspaceCommitChanges=async (changes,deleted,folders)=>{testCommitted={changes,deleted,folders};};
          openPatchTool();
        }''')
        assert page.locator('#patchSave').evaluate('(el)=>el.tagName')=='SELECT'
        options=page.locator('#patchSave option').all_inner_texts()
        assert options==['Patch nicht speichern','Patch vollst\u00e4ndig speichern','Patch-Auswahl speichern'],options
        assert page.locator('#patchSave').input_value()=='none'
        page.locator('#patchJsonInput').fill(json.dumps(patch,ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        assert page.locator('[data-patch-file="0"] .patch-preview-file-counts .patch-size-delta').inner_text()=='+5 B'
        assert page.locator('.patch-preview-total .patch-size-delta').inner_text()=='+7 B'
        page.locator('[data-patch-file="0"] summary').click()
        assert '+4 B' in page.locator('[data-patch-file="0"] .patch-preview-diff').first.inner_text()
        page.locator('[data-patch-operation="0:1"]').uncheck()
        assert page.locator('[data-patch-file="0"] .patch-preview-file-counts .patch-size-delta').inner_text()=='+4 B'
        assert page.locator('.patch-preview-total .patch-size-delta').inner_text()=='+6 B'
        page.locator('#patchSave').select_option('full')
        page.locator('#patchApply').click()
        page.wait_for_function('window.testCommitted?.changes?.some(d=>d.path.endsWith(".patch.json"))',timeout=5000)
        record=page.evaluate('''() => ({
          source:testCommitted.changes.find(d=>d.path==='a.txt').content,
          saved:JSON.parse(testCommitted.changes.find(d=>d.path.endsWith('.patch.json')).content)
        })''')
        assert record['source']=='\u20ac\u20acA'
        assert len(record['saved']['patches'][0]['hunks'])==2
        print('PASS: preview byte deltas react to selection and full-save mode preserves unchecked hunks')
        page.evaluate('''() => {window.testCommitted=null;openPatchTool()}''')
        page.locator('#patchJsonInput').fill(json.dumps(patch,ensure_ascii=False))
        page.locator('.patch-validate-link').click()
        page.locator('[data-patch-file="0"] summary').click()
        page.locator('[data-patch-operation="0:1"]').uncheck()
        page.locator('#patchSave').select_option('selected')
        page.locator('#patchApply').click()
        page.wait_for_function('window.testCommitted?.changes?.some(d=>d.path.endsWith(".patch.json"))',timeout=5000)
        saved=page.evaluate('''() => JSON.parse(testCommitted.changes.find(d=>d.path.endsWith('.patch.json')).content)''')
        assert len(saved['patches'][0]['hunks'])==1
        print('PASS: selected-save mode retains only active hunks')
        assert not errors,errors
        browser.close()


if __name__=='__main__':run()
