import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'

// Real production AvatarPanel + child, in-memory bundles and routed fake origins only.
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const parentOrigin='http://localhost:49384',childOrigin='http://127.0.0.1:49383'
const fakeId='FAKE_SESSION_SECRET_3171',fakeTitle='FAKE_TITLE_SECRET_3171'
const harness=`
import React,{useCallback,useMemo,useState}from'react'
import{createRoot}from'react-dom/client'
import{AvatarPanel}from './AvatarPanel.tsx'
import{togglePicked,monitoredList,getUi,presetPositionFor}from './store.ts'
import{STYLE}from './style.ts'
const id=${JSON.stringify(fakeId)},title=${JSON.stringify(fakeTitle)},others=['FAKE_B','FAKE_C','FAKE_D','FAKE_E','FAKE_F']
const style=document.createElement('style');style.textContent=STYLE;document.head.appendChild(style)
function Parent(){
 const [tool,setTool]=useState('read');window.__testSetTool=setTool
 const [active,setActive]=useState(id);window.__testSetActive=setActive
 const [suppressActive,setSuppressActive]=useState(false);window.__testSuppressActive=setSuppressActive
 const [archived,setArchived]=useState([]);window.__testSetArchived=setArchived
 const ids=[id,...others]
 const list=useMemo(()=>({phase:'ready',ids,byId:{FAKE_CHILD:{id:'FAKE_CHILD',parentId:'FAKE_C',origin:'subagent',retainedBy:{mainView:1}},...Object.fromEntries(ids.map(s=>[s,{id:s,displayTitle:s===id?title:s,parentId:s==='FAKE_C'?id:undefined,retainedBy:{mainView:!suppressActive&&s===active?1:0},running:s===id,updatedAt:Date.now()}]))},projectionsBySession:{[id]:{values:{agentsBot:{tool,tools:1,bg:0,compacting:false,errorAt:0}}}}}),[tool,active,suppressActive])
 const status=useMemo(()=>new Map([[id,{running:true}]]),[])
 const useSessions=useCallback(selector=>selector(list),[list])
 const useSessionStatus=useCallback(selector=>selector(status),[status])
 const workspaces=useMemo(()=>({ids:[],byId:{},archivedSessionIds:archived}),[archived])
 const useWorkspaces=useCallback(selector=>selector(workspaces),[workspaces])
 window.__testPick=togglePicked
 window.__testRead=()=>({order:monitoredList(active,getUi().picked),picked:getUi().picked})
 window.__testPreset=(sessionId)=>presetPositionFor(sessionId,99)
 return <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100vh'}}><AvatarPanel key={active} useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces}/></div>
}
createRoot(document.getElementById('root')).render(<Parent/>)
`
function beacon(capability){return `(()=>{const cap=${JSON.stringify(capability)},origin=${JSON.stringify(parentOrigin)};if(window.parent===window)return;let n=0;const send=()=>{if(n++>=40){clearInterval(timer);return}window.parent.postMessage({v:1,kind:'G2_OWNER',capability:cap},origin)};const timer=setInterval(send,250);send()})();`}
async function compiled(){
 const capability=randomBytes(32).toString('hex')
 const [parent,child]=await Promise.all([
  build({stdin:{contents:harness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'avatar-panel-browser-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__BOT_ISOLATION_PARENT_ORIGIN__:JSON.stringify(parentOrigin),__BOT_ISOLATION_CAPABILITY__:JSON.stringify(capability)}}),
  build({entryPoints:[resolve(root,'plugin/src/isolation/main.jsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__CHILD_ORIGIN__:JSON.stringify(childOrigin),__PARENT_ORIGIN__:JSON.stringify(parentOrigin)}})
 ])
 return {parent:parent.outputFiles[0].text,child:child.outputFiles[0].text,html:readFileSync(resolve(root,'plugin/src/isolation/index.html'),'utf8'),owner:beacon(capability)}
}
const parentHtml='<!doctype html><html lang="zh"><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%}</style><div id="root"></div><script src="/parent.js"></script></html>'
test('real AvatarPanel starts isolated, updates activity and fails closed with retry',async()=>{
 const files=await compiled()
 for(const secret of [fakeId,fakeTitle])assert.equal(files.child.includes(secret),false)
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 let browser
 try{browser=await chromium.launch({executablePath:'D:/百分/CentBrowser/Application/chrome.exe',headless:true})}
 catch(error){throw new Error('Chromium required for this browser regression: '+error.message)}
 try{
  const page=await browser.newPage({viewport:{width:300,height:600}})
   await page.addInitScript({content:"window.__aliases=[];window.addEventListener('message',e=>{if(e.data?.kind==='SNAPSHOT')window.__aliases.push(e.data.rows?.[0]?.id)})"})
  const unexpected=[]
  const routes=new Map([[parentOrigin+'/',[parentHtml,'text/html']],[parentOrigin+'/parent.js',[files.parent,'text/javascript']],[childOrigin+'/',[files.html,'text/html']],[childOrigin+'/owner.js',[files.owner,'text/javascript']],[childOrigin+'/app.js',[files.child,'text/javascript']]])
  await page.route('**/*',async route=>{
   const url=route.request().url(),asset=routes.get(url)
   if(!asset){unexpected.push(url);await route.abort();return}
   const headers=url===childOrigin+'/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-ancestors http://localhost:49384",'X-Content-Type-Options':'nosniff'}:{}
   await route.fulfill({status:200,body:asset[0],contentType:asset[1],headers})
  })
  await page.goto(parentOrigin+'/')
   assert.equal(await page.getByRole('button',{name:'隔离',exact:true}).count(),0,'legacy switch must not render')
   assert.equal(await page.locator('.davf-grid').count(),0,'legacy Bot grid must never mount')
  const iframe=page.locator('iframe[title="隔离活动 AI"]')
  const child=page.frameLocator('iframe[title="隔离活动 AI"]')
  await child.locator('article[data-activity="reading"] svg').waitFor({timeout:12000})
  await iframe.waitFor({state:'visible',timeout:5000}) // opens only after snapshot ACK
  assert.equal(await page.locator('.davf-grid svg').count(),0)
  assert.equal(await child.locator('article').count(),1)
  const childText=await child.locator('body').innerText()
  for(const secret of [fakeId,fakeTitle])assert.equal(childText.includes(secret),false)
  assert.equal(await child.locator('article strong').innerText(),'当前会话')
  await page.setViewportSize({width:300,height:780})
  const card=await child.locator('article').boundingBox(),portrait=await child.locator('.isolation-bot svg').boundingBox(),title=await page.locator('.davf-isolated-name').boundingBox(),pill=await child.locator('.isolation-status').boundingBox()
  assert.ok(card&&portrait&&title&&pill&&title.y>=portrait.y+portrait.height*.8&&title.y+title.height<=pill.y+2,'title must occupy marked space beneath the Bot')
  const centered=await child.locator('article').evaluate(el=>{const box=el.getBoundingClientRect(),bot=el.querySelector('.isolation-bot').getBoundingClientRect(),last=el.querySelector('.isolation-count-slot').getBoundingClientRect();return {fraction:((bot.top+last.bottom)/2-box.top)/box.height,justify:getComputedStyle(el).justifyContent}})
  assert.ok(Math.abs(centered.fraction-.5)<.07&&centered.justify==='center','single Bot visual stack must be vertically centered: '+JSON.stringify(centered))
  assert.equal(await page.locator('.davf-isolated-cell').first().evaluate(el=>getComputedStyle(el).justifyContent),'center','parent title overlay must use the same centered layout')
   const firstAlias=await child.locator('body').evaluate(()=>window.__aliases.at(-1))
   assert.match(firstAlias,/^[a-f0-9]{32}$/)
  await page.evaluate(()=>window.__testSetTool('pwsh'))
  await child.locator('article[data-activity="running"] svg').waitFor({timeout:5000})
  assert.equal(await page.locator('.davf-grid').count(),0)
  await child.locator('body').evaluate((_,origin)=>window.parent.postMessage({v:1,kind:'G2_OWNER',capability:'0'.repeat(64)},origin),parentOrigin)
   const error=page.getByRole('status').filter({hasText:'独立画面暂不可用'})
   await error.waitFor({timeout:5000})
   assert.equal(await page.locator('iframe').count(),0)
   assert.equal(await page.locator('.davf-grid svg').count(),0,'failure must not start old animation loop')
   await page.getByRole('button',{name:'重试'}).click()
   await child.locator('article[data-activity="running"] svg').waitFor({timeout:12000})
   assert.notEqual(await child.locator('body').evaluate(()=>window.__aliases.at(-1)),firstAlias,'recreated iframe must use fresh opaque aliases')
   assert.equal(await page.locator('.davf-grid').count(),0)
   await page.evaluate(()=>window.__testPick('FAKE_B'))
   await child.locator('article').nth(1).waitFor({timeout:12000})
   assert.deepEqual(await child.locator('article').evaluateAll(cards=>cards.map(el=>getComputedStyle(el).justifyContent)),['center','center'],'two Bot cells must keep the centered layout')
   await page.evaluate(()=>['FAKE_C','FAKE_D','FAKE_E'].forEach(window.__testPick))
   await child.locator('article').nth(4).waitFor({timeout:12000})
   assert.deepEqual((await page.evaluate(()=>window.__testRead())).order,[fakeId,'FAKE_B','FAKE_C','FAKE_D','FAKE_E'])
   const cPreset=await page.evaluate(()=>window.__testPreset('FAKE_C'))
   assert.equal(cPreset,2,'manual picks must receive distinct first-seen preset positions')
   const saved=await page.evaluate(()=>Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))]))
   await page.evaluate(()=>window.__testSetActive('FAKE_C'))
   await page.waitForFunction((expected)=>JSON.stringify(window.__testRead().order)===JSON.stringify(expected),['FAKE_C',fakeId,'FAKE_B','FAKE_D','FAKE_E'],{timeout:5000})
   assert.equal(await page.locator('.davf-isolated-name').first().innerText(),'FAKE_C','ordinary fork with a parent must be the first visible Bot')
   await child.locator('article').nth(4).waitFor({timeout:12000})
   assert.equal(await page.evaluate(()=>window.__testPreset('FAKE_C')),cPreset,'automatic look must follow conversation ID instead of new position')
   await page.evaluate(()=>window.__testSetArchived(['FAKE_B']))
   await page.evaluate(()=>window.__testSetActive('FAKE_F'))
   await page.waitForFunction((expected)=>JSON.stringify(window.__testRead().order)===JSON.stringify(expected),['FAKE_F','FAKE_C',fakeId,'FAKE_D','FAKE_E'])
   await child.locator('article').nth(4).waitFor({timeout:12000})
   assert.deepEqual(await page.evaluate(()=>Array.from({length:localStorage.length},(_,i)=>[localStorage.key(i),localStorage.getItem(localStorage.key(i))])),saved,'automatic switches must not write settings to disk')
   await page.evaluate(()=>window.__testSuppressActive(true))
   await page.getByRole('status').filter({hasText:'当前窗口未识别到对话'}).waitFor({timeout:5000})
   assert.equal(await page.locator('iframe').count(),0,'unknown current conversation must never reuse the previous Bot')
   await page.evaluate(()=>window.__testSuppressActive(false))
   await child.locator('article').nth(4).waitFor({timeout:12000})
   assert.equal(await page.locator('.davf-isolated-name').first().innerText(),'FAKE_F','restored authoritative current conversation should recover the retained queue')
  assert.deepEqual(unexpected,[])
 }finally{await browser.close()}
})

test('stalled Bot handshake remounts its panel and retries owner verification automatically',async()=>{
 const files=await compiled()
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 const browser=await chromium.launch({executablePath:'D:/百分/CentBrowser/Application/chrome.exe',headless:true})
 try{
  const page=await browser.newPage({viewport:{width:300,height:600}})
  let appLoads=0
  const routes=new Map([[parentOrigin+'/',[parentHtml,'text/html']],[parentOrigin+'/parent.js',[files.parent,'text/javascript']],[childOrigin+'/',[files.html,'text/html']],[childOrigin+'/owner.js',[files.owner,'text/javascript']]])
  await page.route('**/*',async route=>{
   const url=route.request().url()
   if(url===childOrigin+'/app.js'){
    appLoads++
    await route.fulfill({status:200,body:appLoads===1?'/* temporarily suspended child */':files.child,contentType:'text/javascript'})
    return
   }
   const asset=routes.get(url)
   if(!asset){await route.abort();return}
   const headers=url===childOrigin+'/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-ancestors http://localhost:49384",'X-Content-Type-Options':'nosniff'}:{}
   await route.fulfill({status:200,body:asset[0],contentType:asset[1],headers})
  })
  await page.goto(parentOrigin+'/')
  await page.bringToFront()
  assert.equal(await page.evaluate(()=>document.hasFocus()),true,'simulate foreground Bot tab with stalled child')
  const child=page.frameLocator('iframe[title="隔离活动 AI"]')
  await child.locator('article[data-activity="reading"] svg').waitFor({timeout:22000})
  assert.ok(appLoads>=2,'timed-out child must reload with full script and owner beacon')
  assert.equal(await page.locator('.davf-isolated-name').first().innerText(),fakeTitle)
  assert.equal((await child.locator('body').innerText()).includes(fakeId),false)
  assert.equal(await page.getByText('独立画面暂不可用').count(),0)
 }finally{await browser.close()}
})
