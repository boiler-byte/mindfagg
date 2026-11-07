#!/usr/bin/env python3
"""v37 Chromium: editable Kanban status, common dialog and map spacing.
Mocks only persistence and inlines local scripts so no HTTP server is required.
"""
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent.parent
INIT=r'''
const p={id:'p37',name:'Testprojekt',created:Date.now(),folders:[]};
projects=[p];docs=[{id:'initial',projectId:p.id,name:'Projekt',path:'Projekt.md',fileType:'markdown',content:'# Projekt\n- [ ] [status:todo] Aufgabe A\n- [ ] [status:todo] Aufgabe B\n',updatedAt:Date.now()}];
projectId=p.id;docId='initial';persistedDocSnapshots.set('initial',docSnapshot(docs[0]));
put=async (name,value)=>{
  if(name==='projects')Object.assign(p,value);
  else if(name==='docs'){
    const i=docs.findIndex(d=>d.id===value.id);
    if(i<0)docs.push(value);else docs[i]={...value};
    persistedDocSnapshots.set(value.id,docSnapshot(value));
  }
  return value.id;
};
saveSource=async()=>{};
render();
'''

def inline_app():
    html=(ROOT/'index.html').read_text()
    def css(match):return '<style>'+(ROOT/match.group(1)).read_text()+'</style>'
    def js(match):
        src=match.group(1)
        if src in ('ui/bindings.js','core/service-worker.js'):return ''
        return '<script>'+(ROOT/src).read_text().replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',css,html)
    html=re.sub(r'<script src="([^"]+)"></script>',js,html)
    return html.replace('</body>','<script>'+INIT+'</script></body>')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':800})
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.set_content(inline_app(),wait_until='load',timeout=30000)
    page.evaluate("setView('kanban');render()")
    tickets=page.locator('.lane[data-lane-status="todo"] .ticket')
    assert tickets.count()==2,tickets.count()
    tickets.first.click()
    assert page.locator('#modal h2').inner_text()=='Knoten bearbeiten'
    assert page.locator('#nodeStatus').is_visible()
    assert page.locator('#nodeStatus').input_value()=='todo'
    fields=lambda:page.evaluate("Array.from(document.querySelectorAll('#nodeForm [id]')).map(el=>el.id)")
    kanban_fields=fields()
    page.select_option('#nodeStatus','doing')
    page.locator('#nodeForm button[type="submit"]').click()
    page.wait_for_function("documentNow().content.includes('[status:doing] Aufgabe A')")
    assert page.locator('.lane[data-lane-status="doing"] .ticket').count()==1
    assert page.locator('.lane[data-lane-status="todo"] .ticket').count()==1
    print('PASS: Kanban dialog exposes status and moves the card after save')
    path=page.evaluate("flattened(currentModel).find(n=>n.title==='Aufgabe A').path")
    for tab in ('mindmap','calendar'):
        page.evaluate("tab=>{setView(tab);render();editNode(%s)}"%repr(path),tab)
        assert page.locator('#modal h2').inner_text()=='Knoten bearbeiten'
        assert fields()==kanban_fields,(tab,fields(),kanban_fields)
        assert page.locator('#nodeStatus').input_value()=='doing'
        page.locator('#cancelModal').click()
    print('PASS: identical edit form across Kanban, Mindmap and Calendar')
    layout=page.evaluate('''()=>{
      const leaf=(path)=>({path,children:[]});
      const block=name=>({path:name,children:[0,1,2].map(i=>leaf(name+'-'+i))});
      const tree=mapLayout({path:'root',children:[block('a'),block('b')]},new Set());
      for(const row of tree.rows)row.el={offsetWidth:205,offsetHeight:70,style:{}};
      positionMapRows(tree);
      const r=Object.fromEntries(tree.rows.map(row=>[row.path,row]));
      const gap=(a,b)=>r[b].y-(r[a].y+r[a].height);
      return {sibling:gap('a-0','a-1'),between:gap('a-2','b-0')};
    }''')
    assert layout=={'sibling':24,'between':24},layout
    print('PASS: measured Mindmap gaps',layout)
    assert not errors,errors
    browser.close()
