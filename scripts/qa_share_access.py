#!/usr/bin/env python3
"""Run against an isolated Chrome profile; creates one named QA owner and a recipient copy."""
import base64,json,os
from pathlib import Path
from qa_browser import Browser
BASE=os.environ.get('NOVA_QA_URL','http://localhost:5177/').rstrip('/')
b=Browser(int(os.environ.get('NOVA_QA_PORT','9237')),BASE+'/projects')
out=Path(os.environ.get('NOVA_QA_OUTPUT','/tmp/nova-share-access-review'));out.mkdir(exist_ok=True)
def click(selector,count=1):
 p=b.evaluate('(()=>{const e=document.querySelector('+json.dumps(selector)+');if(!e)throw new Error("Missing target: "+'+json.dumps(selector)+');const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()')
 b.call('Input.dispatchMouseEvent',{'type':'mouseMoved',**p})
 for n in range(1,count+1):
  for kind in ['mousePressed','mouseReleased']:b.call('Input.dispatchMouseEvent',{'type':kind,**p,'button':'left','buttons':1 if kind=='mousePressed' else 0,'clickCount':n})
 b.pause(.25)
def key(name,code,modifiers=0):
 for kind in ['keyDown','keyUp']:b.call('Input.dispatchKeyEvent',{'type':kind,'key':name,'code':code,'modifiers':modifiers})
 b.pause(.2)
def visit(url):b.call('Page.navigate',{'url':url});b.wait_ready()
def projects():return b.evaluate("(async()=>{const {listProjects}=await import('/src/lib/localWorkspace.js');return await listProjects()})()",True)
def shot(name):(out/(name+'.png')).write_bytes(base64.b64decode(b.call('Page.captureScreenshot',{'format':'png'})['data']))
def link_access():return b.evaluate("(async()=>{const {readShareLink}=await import('/src/lib/boardShare.js');return (await readShareLink(new URL(document.querySelector('#share-url').value).hash)).access})()",True)
def mode(value):
 click('label:has(input[value="'+value+'"])')
 b.wait_for("!!document.querySelector('#share-url').value")
 assert link_access()==value
 return b.evaluate("document.querySelector('#share-url').value")
def zoom_level():return b.evaluate("document.querySelector('[aria-label=\"Zoom level\"]').textContent")
try:
 b.wait_for("!!document.querySelector('#projects-title')")
 b.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
 b.evaluate("""(async()=>{localStorage.setItem('nova-board-tour-v1','skipped');const {putProject}=await import('/src/lib/localWorkspace.js');const {templates}=await import('/src/data/templates.js');const board=structuredClone(templates.find(t=>t.id==='decision-tree').board);board.nodes[1].comments=[{id:'shared-comment',text:'Please review this option',createdAt:Date.now()}];board.nodes[0].titleHtml='<b>Decision</b>';await putProject({id:'share-owner-review',title:'Shared decision tree',board,updated:Date.now()})})()""",True)
 visit(BASE+'/boards/share-owner-review');b.wait_for("document.querySelectorAll('[data-export-node]').length===7")
 b.pause(.6)
 click('header [aria-label="Share board"]');b.wait_for("!!document.querySelector('#share-url').value")
 assert link_access()=='editable'
 editable=mode('editable');readonly=mode('readonly');shot('share-readonly-desktop')
 # Repeated changes cannot leave a link with a different mode than its radio.
 for value in ['editable','readonly','editable','readonly']:mode(value)
 readonly=b.evaluate("document.querySelector('#share-url').value")
 click('#share-url + button')
 b.wait_for("document.querySelector('#share-url + button').textContent.includes('Copied')")
 mode('editable');assert 'Copied' not in b.evaluate("document.querySelector('#share-url + button').textContent")
 for width,height in [(390,844),(320,740)]:
  b.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False})
  mode('readonly')
  assert b.evaluate("(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()")
  shot('share-'+str(width))
 click('[aria-label="Close share dialog"]');b.pause(.6);before=projects()
 b.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
 visit(readonly);b.wait_for("!!document.querySelector('[data-readonly-board]')");b.wait_for("document.querySelectorAll('[data-export-node]').length===7")
 assert b.evaluate("location.pathname")== '/share'
 assert b.count('[aria-label="Board title"],[aria-label="Add branch right"],[contenteditable=true],[aria-label="Rotate shape"]')==0
 original=b.evaluate("[...document.querySelectorAll('[data-export-node]')].map(e=>[e.dataset.exportNode,e.style.transform,e.textContent])")
 click('[data-export-node="2"] h3',2)
 assert not b.count('[contenteditable=true]')
 assert b.evaluate("document.querySelector('[data-export-node=\"2\"]').getAttribute('aria-label').includes('selected')")
 key('Delete','Delete');key('Backspace','Backspace');key('v','KeyV',4);key('Enter','Enter')
 assert b.count('[data-export-node]')==7
 assert b.evaluate("[...document.querySelectorAll('[data-export-node]')].map(e=>[e.dataset.exportNode,e.style.transform,e.textContent])")==original
 click('[aria-label="Zoom in"]');level=zoom_level();click('[aria-label="Zoom out"]');assert zoom_level()!=level
 world=b.evaluate("document.querySelector('[class*=world_]').style.transform")
 b.mouse_drag({'x':500,'y':600},{'x':610,'y':670});b.pause(.2)
 assert b.evaluate("document.querySelector('[class*=world_]').style.transform")!=world
 click('[aria-label="Fit board"]');click('[data-export-node="2"] h3')
 click('[data-export-node="2"] button[title="Collapse branch"]');assert b.count('[data-export-node]')==5
 click('[data-export-node="2"] button[title="Expand branch"]');assert b.count('[data-export-node]')==7
 click('header [aria-label="Comments"]');b.wait_for("!!document.querySelector('[data-comments-panel]')")
 assert 'Please review this option' in b.text()
 assert b.count('[data-comments-panel] textarea,[data-comments-panel] form,[aria-label="Delete comment"]')==0
 assert not b.evaluate("[...document.querySelectorAll('[data-comments-panel] button')].some(e=>['Resolve','Reopen'].includes(e.textContent.trim()))")
 assert b.evaluate("(()=>{const e=document.querySelector('[aria-label=\"Zoom in\"]'),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)})()"),'Comments panel covers zoom controls'
 shot('readonly-desktop-comments')
 click('[aria-label="Close comments"]');b.pause(.5);assert projects()==before,'Read-only view wrote to workspace'
 b.call('Page.reload');b.wait_ready();b.wait_for("!!document.querySelector('[data-readonly-board]')");assert projects()==before
 for width,height in [(390,844),(320,740)]:
  b.call('Emulation.setDeviceMetricsOverride',{'width':width,'height':height,'deviceScaleFactor':1,'mobile':False});b.pause(.3)
  assert b.evaluate("document.documentElement.scrollWidth<=innerWidth")
  assert b.count('[aria-label="Board title"],[aria-label="Add branch right"]')==0
  shot('readonly-'+str(width));click('header [aria-label="Comments"]');shot('readonly-comments-'+str(width));key('Escape','Escape');b.wait_for("!document.querySelector('[data-comments-panel]')")
 assert projects()==before
 print('PASS access switching/copy state, responsive share dialog, read-only edit prevention, pan/zoom/collapse/comments/reload, no workspace writes',flush=True)
 b.call('Emulation.setDeviceMetricsOverride',{'width':1440,'height':1000,'deviceScaleFactor':1,'mobile':False})
 visit(editable);b.wait_for("!!document.querySelector('[aria-label=\"Board title\"]')")
 copied_id=b.evaluate("location.pathname.split('/').pop()")
 assert copied_id!='share-owner-review'
 click('[data-export-node="2"] h3',2);b.wait_for("!!document.querySelector('[contenteditable=true][data-field=title]')")
 b.evaluate("(()=>{const e=document.querySelector('[contenteditable=true][data-field=title]');e.focus();const r=document.createRange();r.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(r)})()")
 b.call('Input.insertText',{'text':'Recipient changes'});key('Escape','Escape');b.pause(.8)
 current=projects();copy=next(p for p in current if p['id']==copied_id);owner=next(p for p in current if p['id']=='share-owner-review')
 assert any(n['title']=='Recipient changes' for n in copy['board']['nodes'])
 assert owner['board']==next(p for p in before if p['id']=='share-owner-review')['board']
 assert len(current)==len(before)+1
 # A new sparse read-only snapshot must render optional text fields and remain unsaved.
 sparse=b.evaluate("(async()=>{const {createShareUrl}=await import('/src/lib/boardShare.js');return createShareUrl({title:'Minimal board',board:{nodes:[{id:'sparse',x:0,y:0}],edges:[]}},location.origin,{access:'readonly'})})()",True)
 visit(sparse);b.wait_for("document.querySelectorAll('[data-export-node]').length===1")
 assert b.count('[data-readonly-board]')==1
 print('PASS editable copy persists edits without changing owner, read-only sparse boards render',flush=True)
 assert not b.errors,b.errors
finally:b.close()
