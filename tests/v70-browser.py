#!/usr/bin/env python3
"""v70: mobile inline mindmap editors stay clear of controls/keyboard."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SOURCE = '# Projekt\n- Vorhandener Knoten\n- Weiterer Knoten\n'


def inline_app():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>' + (ROOT / m.group(1)).read_text(encoding='utf-8') + '</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '' if m.group(1) in ('ui/bindings.js', 'core/service-worker.js')
                  else '<script>' + (ROOT / m.group(1)).read_text(encoding='utf-8').replace('</script', '<\\/script') + '</script>', html)
    return html


def setup(page):
    page.set_content(inline_app(), wait_until='load', timeout=60000)
    page.evaluate('''source=>{
      projects=[{id:'v70',name:'Mobile Mindmap',folders:[]}];projectId='v70';
      docs=[{id:'notes',projectId:'v70',name:'Test.md',path:'Test.md',fileType:'markdown',content:source}];
      docId='notes';
      put=async()=>true;
      view='mindmap';render();
    }''', SOURCE)


def editor_safe(page):
    return page.evaluate('''()=>{
      const input=document.querySelector('.mm-inline-input');
      if(!input)return {safe:false,reason:'no input'};
      const r=input.getBoundingClientRect();
      const v=activeMap.viewport.getBoundingClientRect();
      const c=document.querySelector('.mm-controls').getBoundingClientRect();
      const visual=window.visualViewport;
      const maxBottom=Math.min(v.bottom,(visual?.offsetTop??0)+(visual?.height??window.innerHeight),
        c.top<Math.min(v.bottom,(visual?.offsetTop??0)+(visual?.height??window.innerHeight))?c.top:Infinity);
      return {safe:r.left>=v.left+17&&r.right<=v.right-17&&
          r.top>=Math.max(v.top,visual?.offsetTop??0)+17&&r.bottom<=maxBottom-17,
        input:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
        controlsTop:c.top,viewportBottom:v.bottom,visualBottom:(visual?.offsetTop??0)+(visual?.height??window.innerHeight)};
    }''')


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                     args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page(viewport={'width':375,'height':760})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_default_timeout(15000)
        setup(page)
        # A visible existing node should remain where it was, without needless recentering.
        before=page.evaluate('''()=>{
          const state=activeMap,row=state.rows.find(r=>r.node.title==='Vorhandener Knoten');
          const b=row.el.getBoundingClientRect(),v=state.viewport.getBoundingClientRect();
          state.panX+=v.left+45-b.left;state.panY+=v.top+165-b.top;
          applyMapView(state);beginMapInlineEdit(state,row.path);
          return {panX:state.panX,panY:state.panY};
        }''')
        page.wait_for_timeout(80)
        assert editor_safe(page)['safe'],editor_safe(page)
        after=page.evaluate('''()=>({panX:activeMap.panX,panY:activeMap.panY})''')
        assert abs(after['panX']-before['panX'])<1 and abs(after['panY']-before['panY'])<1,(before,after)
        print('PASS: visible existing editor remains stationary',flush=True)

        # When placed behind the bottom-right controls, an existing input pans above them.
        page.evaluate('''()=>{
          const state=activeMap,row=state.inlineEdit.row,box=row.el.getBoundingClientRect();
          const c=document.querySelector('.mm-controls').getBoundingClientRect();
          closeMapInlineEdit(state);
          state.panX+=c.left+27-box.left;
          state.panY+=c.top+8-box.top;
          applyMapView(state);beginMapInlineEdit(state,row.path);
        }''')
        page.wait_for_function('''()=>{
          const i=document.querySelector('.mm-inline-input'),c=document.querySelector('.mm-controls');
          return i&&i.getBoundingClientRect().bottom<=c.getBoundingClientRect().top-17;
        }''')
        assert editor_safe(page)['safe'],editor_safe(page)
        print('PASS: existing mobile input moves away from overlapping map controls',flush=True)

        # Use a controllable VisualViewport to simulate asynchronous mobile keyboard opening.
        page.evaluate('''()=>{
          closeMapInlineEdit(activeMap);
          const visual=new EventTarget();
          visual.offsetTop=0;visual.offsetLeft=0;
          visual.width=window.innerWidth;visual.height=window.innerHeight;
          Object.defineProperty(window,'visualViewport',{configurable:true,value:visual});
          window.__testVisual=visual;
          selectMapNode(activeMap,activeMap.rootRow.path);
        }''')
        page.evaluate('''async()=>{await createMapNode('child')}''')
        page.wait_for_function('''()=>{
          const i=document.querySelector('.mm-inline-input');return !!i&&activeMap.inlineEdit?.centerNew===true;
        }''')
        page.wait_for_timeout(80)
        assert editor_safe(page)['safe'],editor_safe(page)
        center=page.evaluate('''()=>{
          const r=document.querySelector('.mm-inline-input').getBoundingClientRect();
          const v=activeMap.viewport.getBoundingClientRect();
          const c=document.querySelector('.mm-controls').getBoundingClientRect();
          return {actual:(r.top+r.bottom)/2,wanted:(v.top+c.top)/2};
        }''')
        assert abs(center['actual']-center['wanted'])<=2,center
        print('PASS: newly created node is centered in the unobstructed area',flush=True)

        before_keyboard=page.evaluate('activeMap.panY')
        page.evaluate('''()=>{
          window.__testVisual.height=410;
          window.__testVisual.dispatchEvent(new Event('resize'));
        }''')
        page.wait_for_function('''()=>{
          const i=document.querySelector('.mm-inline-input');
          return i&&i.getBoundingClientRect().bottom<=window.__testVisual.height-17;
        }''')
        assert editor_safe(page)['safe'],editor_safe(page)
        assert page.evaluate('activeMap.panY')<before_keyboard
        print('PASS: opening the virtual keyboard repositions the focused input',flush=True)

        page.evaluate('''()=>{
          window.__testVisual.offsetTop=200;
          window.__testVisual.height=215;
          window.__testVisual.dispatchEvent(new Event('scroll'));
        }''')
        page.wait_for_function('''()=>{
          const r=document.querySelector('.mm-inline-input').getBoundingClientRect();
          return r.top>=217&&r.bottom<=397;
        }''')
        assert editor_safe(page)['safe'],editor_safe(page)
        print('PASS: visual viewport scroll/offset also respects the available area',flush=True)

        page.locator('.mm-inline-input').fill('Titel v70')
        page.locator('.mm-inline-input').press('Enter')
        page.wait_for_function('''()=>activeMap.inlineEdit===null''')
        assert 'Titel v70' in page.evaluate('docs[0].content')
        assert not errors,errors
        print('PASS: after recentering, editing and saving still work',flush=True)
        page.close()

        desktop=browser.new_page(viewport={'width':1180,'height':800})
        desktop_errors=[]
        desktop.on('pageerror',lambda e:desktop_errors.append(str(e)))
        setup(desktop)
        desktop_before=desktop.evaluate('''()=>{
          const state=activeMap,row=state.rows.find(r=>r.node.title==='Vorhandener Knoten');
          const b=row.el.getBoundingClientRect(),c=document.querySelector('.mm-controls').getBoundingClientRect();
          state.panX+=c.left+20-b.left;state.panY+=c.top+10-b.top;
          applyMapView(state);beginMapInlineEdit(state,row.path);
          return {x:state.panX,y:state.panY};
        }''')
        desktop.wait_for_timeout(100)
        desktop_after=desktop.evaluate('''()=>({x:activeMap.panX,y:activeMap.panY})''')
        assert desktop_after==desktop_before,(desktop_before,desktop_after)
        assert not desktop_errors,desktop_errors
        print('PASS: desktop map positioning is unchanged',flush=True)
        desktop.close()
        browser.close()


if __name__=='__main__':
    main()
