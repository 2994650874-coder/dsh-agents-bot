import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'

// No listener: both origins and all assets are supplied by Playwright route in memory.
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const parentOrigin='http://localhost:49384',childOrigin='http://127.0.0.1:49383'
const firstId='FAKE_FIRST_SESSION_PRIVATE_521',secondId='FAKE_SECOND_SESSION_PRIVATE_522'
const firstTitle='FAKE_FIRST_TITLE_PRIVATE_521',secondTitle='FAKE_SECOND_TITLE_PRIVATE_522',teamName='FAKE_TEAM_NAME_PRIVATE_523'
const parentHarness=`
import React,{useCallback,useMemo,useState}from'react'
import{createRoot}from'react-dom/client'
import{AvatarPanel}from './AvatarPanel.tsx'
import{STYLE}from './style.ts'
import{patchUi,getUi}from './store.ts'
const first=${JSON.stringify(firstId)},second=${JSON.stringify(secondId)}
const titleFirst=${JSON.stringify(firstTitle)},titleSecond=${JSON.stringify(secondTitle)},memberName=${JSON.stringify(teamName)}
patchUi({picked:[second],dwellMs:0})
window.__getEditTarget=()=>getUi().editTarget
const style=document.createElement('style');style.textContent=STYLE;document.head.appendChild(style)
function Parent(){
 const [tool,setTool]=useState('read');window.__setTool=setTool
 const list=useMemo(()=>({ids:[first,second],byId:{
  [first]:{id:first,displayTitle:titleFirst,retainedBy:{mainView:1},running:true,updatedAt:Date.now()},
  [second]:{id:second,displayTitle:titleSecond,retainedBy:{mainView:0},running:true,updatedAt:Date.now()}
 },projectionsBySession:{
  [first]:{values:{agentsBot:{tool:'read',tools:1,bg:0,compacting:false,errorAt:0},agentTeam:{members:[{id:first,name:'lead',role:'lead',phase:'active'},{id:second,name:memberName,role:'teammate',phase:'active'}]}}},
  [second]:{values:{agentsBot:{tool,tools:1,bg:0,compacting:false,errorAt:0}}}
 }}),[tool])
 const status=useMemo(()=>new Map([[first,{running:true}],[second,{running:true}]]),[])
 const useSessions=useCallback(selector=>selector(list),[list])
 const useSessionStatus=useCallback(selector=>selector(status),[status])
 const useWorkspaces=useCallback(selector=>selector({ids:[],byId:{}}),[])
 return <div style={{width:'100%',height:'100vh',display:'flex',flexDirection:'column'}}><AvatarPanel useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces}/></div>
}
createRoot(document.getElementById('root')).render(<Parent/>)
`
function owner(capability){return `(()=>{const cap=${JSON.stringify(capability)},origin=${JSON.stringify(parentOrigin)};if(window.parent===window)return;let n=0;const send=()=>{if(n++>=40){clearInterval(timer);return}window.parent.postMessage({v:1,kind:'G2_OWNER',capability:cap},origin)};const timer=setInterval(send,250);send()})();`}
async function bundles(){
 const capability=randomBytes(32).toString('hex')
 const [parent,child]=await Promise.all([
  build({stdin:{contents:parentHarness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'isolation-controls-browser-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__BOT_ISOLATION_PARENT_ORIGIN__:JSON.stringify(parentOrigin),__BOT_ISOLATION_CAPABILITY__:JSON.stringify(capability)}}),
  build({entryPoints:[resolve(root,'plugin/src/isolation/main.jsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__CHILD_ORIGIN__:JSON.stringify(childOrigin),__PARENT_ORIGIN__:JSON.stringify(parentOrigin)}})
 ])
 return {parent:parent.outputFiles[0].text,child:child.outputFiles[0].text,html:readFileSync(resolve(root,'plugin/src/isolation/index.html'),'utf8'),owner:owner(capability)}
}
const parentHtml='<!doctype html><html lang="zh"><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%}body{background:#e8dfc8}</style><div id="root"></div><script src="/parent.js"></script></html>'
test('two-cell real AvatarPanel keeps edit and remove controls in parent origin',async()=>{
 const files=await bundles()
 for(const secret of [firstId,secondId,firstTitle,secondTitle,teamName])assert.equal(files.child.includes(secret),false)
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 let browser
 try{browser=await chromium.launch({executablePath:'D:/百分/CentBrowser/Application/chrome.exe',headless:true})}
 catch(error){throw new Error('Chromium required for controls browser regression: '+error.message)}
 let releaseOwner=()=>{}
 try{
  const page=await browser.newPage({viewport:{width:300,height:600}})
  await page.addInitScript({content:"window.__isolationPayloads=[];window.addEventListener('message',e=>{if(e.data?.kind==='SNAPSHOT')window.__isolationPayloads.push(JSON.stringify(e.data))})"})
  const unknown=[]
  const gatedOwner=new Promise(resolve=>{releaseOwner=resolve})
  const routes=new Map([[parentOrigin+'/',[parentHtml,'text/html']],[parentOrigin+'/parent.js',[files.parent,'text/javascript']],[childOrigin+'/',[files.html,'text/html']],[childOrigin+'/owner.js',[files.owner,'text/javascript']],[childOrigin+'/app.js',[files.child,'text/javascript']]])
  await page.route('**/*',async route=>{
   const url=route.request().url(),asset=routes.get(url)
   if(!asset){unknown.push(url);await route.abort();return}
   if(url===childOrigin+'/owner.js')await gatedOwner
   const headers=url===childOrigin+'/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-ancestors http://localhost:49384",'X-Content-Type-Options':'nosniff'}:{}
   await route.fulfill({status:200,body:asset[0],contentType:asset[1],headers})
  })
  await page.goto(parentOrigin+'/',{waitUntil:'domcontentloaded'})
   assert.equal(await page.locator('.davf-grid').count(),0,'legacy grid must never mount')
   assert.equal(await page.getByRole('button',{name:'隔离',exact:true}).count(),0)
  const iframe=page.locator('iframe[title="隔离活动 AI"]')
  await iframe.waitFor({state:'attached',timeout:5000})
  assert.equal(await page.locator('[aria-label="隔离画面操作"]').count(),0,'pre-ACK overlay must stay hidden')
  assert.equal(await page.locator('.davf-grid').count(),0,'old grid unmounts before ACK')
  assert.equal(await iframe.evaluate(el=>getComputedStyle(el).display),'none','real child never opens before owner and snapshot ACK')
  const startup=page.locator('.davf-isolation-startup')
  await startup.waitFor({timeout:5000})
  assert.equal(await startup.locator('svg').count(),1,'only one short-lived parent startup Bot may animate')
  assert.equal(await startup.locator('.davf-isolation-startup-note').innerText(),'正在验证独立画面…')
  assert.equal(await startup.locator('.davf-isolation-startup-pill').innerText(),'启动中')
  assert.equal(await startup.locator('.davf-isolation-startup-pill').evaluate(el=>getComputedStyle(el).borderTopStyle),'solid','startup text must be inside a visible capsule')
  const rects=await startup.evaluate(el=>['svg','.davf-isolation-startup-note','.davf-isolation-startup-pill'].map(selector=>{const r=el.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
  assert.ok(rects[0].bottom<=rects[1].top+3&&rects[1].bottom<=rects[2].top,'verify text must sit below Bot and above startup capsule: '+JSON.stringify(rects))
  const backdrop=await startup.evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el.querySelector('.davf-isolation-startup-pill')).backgroundColor])
  assert.deepEqual(backdrop,['rgb(232, 223, 200)','rgb(232, 223, 200)'],'parent startup backdrop and badge must use the same sampled sidebar canvas')
  await page.evaluate(()=>{document.body.style.backgroundColor='#171920';window.__setTool('pwsh')})
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.davf-isolation-startup')).backgroundColor==='rgb(23, 25, 32)')
  const dark=await startup.evaluate(el=>[getComputedStyle(el.querySelector('.davf-isolation-startup-pill')).backgroundColor,getComputedStyle(el.querySelector('.davf-isolation-startup-pill')).color])
  assert.deepEqual(dark,['rgb(23, 25, 32)','rgb(255, 255, 255)'],'dark sidebar canvas and capsule must retain readable sampled contrast')
  await page.evaluate(()=>{document.body.style.backgroundColor='#e8dfc8';window.__setTool('read')})
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.davf-isolation-startup')).backgroundColor==='rgb(232, 223, 200)')
  if(process.env.BOT_STARTUP_PREVIEW){await page.waitForTimeout(2600);await page.screenshot({path:resolve(root,'_work/startup-preview.png')})}
  releaseOwner()
  const child=page.frameLocator('iframe[title="隔离活动 AI"]')
  await child.locator('article').nth(1).waitFor({timeout:12000})
  await iframe.waitFor({state:'visible',timeout:5000})
  await startup.waitFor({state:'detached',timeout:5000})
  assert.equal(await child.locator('article svg').count(),2)
  assert.equal(await page.locator('.davf-grid').count(),0)
  assert.deepEqual(await page.locator('.davf-isolated-name').allTextContents(),[firstTitle,'└ '+teamName],'real names remain in parent origin')
  assert.equal(await child.locator('article strong').nth(1).innerText(),'└ 监控 2')
  const names=await page.locator('.davf-isolated-name').evaluateAll(nodes=>nodes.map(node=>({top:node.getBoundingClientRect().top-node.closest('.davf-isolated-cell').getBoundingClientRect().top,weight:Number(getComputedStyle(node).fontWeight)})))
  const rows=await child.locator('article').evaluateAll(cards=>cards.map(card=>{const top=card.getBoundingClientRect().top,title=card.querySelector('.isolation-title').getBoundingClientRect(),status=card.querySelector('.isolation-status').getBoundingClientRect();return {title:{top:title.top-top,bottom:title.bottom-top},status:{top:status.top-top}}}))
  assert.ok(Math.abs(names[0].top-names[1].top)<=1&&Math.abs(rows[0].status.top-rows[1].status.top)<=1,'paired titles and status pills share fixed card-relative baselines '+JSON.stringify({names,rows}))
  assert.ok(names.every((name,index)=>name.weight>=600&&Math.abs(name.top-rows[index].title.top)<=2),'bold private titles match hidden child placeholders')
  assert.ok(rows.every(row=>Math.abs(row.status.top-row.title.bottom-8)<=2),'title-to-status gap equals half a 16px capsule')
  const typography=await page.locator('.davf-title, .davf-isolated-name').evaluateAll(nodes=>nodes.map(node=>{const css=getComputedStyle(node);return {fontSize:css.fontSize,fontWeight:css.fontWeight,letterSpacing:css.letterSpacing,color:css.color}}))
  assert.deepEqual(typography[1],typography[0],'card title uses the Activity AI header type and theme color')
  assert.equal(typography[0].fontSize,'12.5px')
  await page.setViewportSize({width:537,height:437})
  await child.locator('.grid[style*="grid-template-columns: repeat(2"]').waitFor({timeout:5000})
  const sideBySide=await page.locator('.davf-isolated-name').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()))
  const pairedStatus=await child.locator('article .isolation-status').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()))
  assert.ok(Math.abs(sideBySide[0].y-sideBySide[1].y)<=1&&Math.abs(pairedStatus[0].y-pairedStatus[1].y)<=1,'screenshot-sized side-by-side cards must share one title/status baseline')
  assert.equal(await child.locator('article').first().getAttribute('data-raised'),'true','large paired cards raise titles two capsule heights')
  await page.setViewportSize({width:300,height:600})
  await child.locator('.grid[style*="grid-template-rows: repeat(2"]').waitFor({timeout:5000})
  assert.deepEqual(await child.locator('body').evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el.querySelector('article')).backgroundColor]),['rgb(232, 223, 200)','rgb(232, 223, 200)'],'canvas and every cell must match custom sidebar background')
  assert.equal(await page.locator('.davf-isolated-name').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(232, 223, 200)')
  await page.evaluate(()=>{document.body.style.backgroundColor='#c7ab74'})
  await child.locator('html[style*="#c7ab74"]').waitFor({timeout:6000})
  assert.equal(await child.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(199, 171, 116)','theme change must reach card on bounded heartbeat')
  await page.evaluate(()=>{document.body.style.backgroundColor='#171920'})
  await child.locator('html[style*="#171920"]').waitFor({timeout:6000})
  assert.equal(await child.locator('article').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 25, 32)')
  assert.equal(await child.locator('article strong').first().evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','dark backgrounds keep labels readable')
  assert.equal(await child.locator('article .isolation-status').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(23, 25, 32)','dark capsules reuse the exact sampled canvas')
  const nameRect=await page.locator('.davf-isolated-name').nth(1).boundingBox()
  const cellRect=await child.locator('article').nth(1).boundingBox()
  assert.ok(nameRect&&cellRect&&cellRect.width>0&&cellRect.height>0)
  assert.ok(nameRect.x>=cellRect.x&&nameRect.x+nameRect.width<=cellRect.x+cellRect.width,'parent label must stay within child cell')
  const remove=page.getByRole('button',{name:'取消第2格监视'})
  await remove.waitFor({timeout:5000})
  assert.equal(await child.getByRole('button').count(),0,'controls must never enter child document')
  const text=await child.locator('body').innerText()
  for(const secret of [firstId,secondId,firstTitle,secondTitle,teamName])assert.equal(text.includes(secret),false)
  const sent=await child.locator('body').evaluate(()=>window.__isolationPayloads.join('\n'))
  assert.ok(sent.includes('SNAPSHOT'),'child must receive validated snapshot')
  for(const secret of [firstId,secondId,firstTitle,secondTitle,teamName])assert.equal(sent.includes(secret),false,'private identity cannot enter cross-origin messages')
  await page.getByRole('button',{name:'外观',exact:true}).click()
  const edit=page.getByRole('button',{name:'修改第2格外观'})
  await edit.waitFor({timeout:3000})
  const nameWhenEditing=await page.locator('.davf-isolated-name').nth(1).boundingBox()
  const editRect=await edit.boundingBox()
  assert.ok(nameWhenEditing&&editRect&&nameWhenEditing.y>=editRect.y+editRect.height,'title below portrait must not cover the edit control')
   const botRect=await child.locator('article').nth(1).locator('.isolation-bot svg').boundingBox()
   const statusRect=await child.locator('article').nth(1).locator('.isolation-status').boundingBox()
   assert.ok(botRect&&statusRect&&nameWhenEditing.y>=botRect.y+botRect.height-2,'real name must sit under the Bot '+JSON.stringify({name:nameWhenEditing,bot:botRect,status:statusRect,childTitle:await child.locator('article').nth(1).locator('strong').boundingBox(),card:await child.locator('article').nth(1).boundingBox(),parentCell:await page.locator('.davf-isolated-cell').nth(1).boundingBox(),portrait:await page.locator('.davf-isolated-portrait-space').nth(1).boundingBox()}))
   assert.ok(nameWhenEditing.y+nameWhenEditing.height<=statusRect.y+2,'status badge must follow the real name')
  await edit.click()
  await child.locator('article[data-pose="true"]').waitFor({timeout:5000})
  assert.equal(await child.locator('article').nth(1).getAttribute('data-pose'),'true')
  assert.equal(await child.locator('article').first().getAttribute('data-pose'),'false')
  assert.equal(await page.evaluate(()=>window.__getEditTarget()),secondId)
  assert.equal(await edit.innerText(),'修改中')
  for(const [label,hex] of [['橙','#f08a24'],['琥珀','#f0b429'],['绿','#3ecf8e'],['青绿','#2fbfa0'],['蓝','#3b93f0'],['灰','#a3a3a3'],['奶油','#f1efe9']]){
   await page.locator('.davf-colors button[title="'+label+'"]').click()
   await child.locator('article').nth(1).locator('svg rect[fill="'+hex+'"]').waitFor({timeout:5000})
  }
  await page.getByRole('button',{name:'外观',exact:true}).click()
  const removeAgain=page.getByRole('button',{name:'取消第2格监视'})
  await removeAgain.waitFor({timeout:3000})
  await removeAgain.focus()
  assert.equal(await removeAgain.evaluate(el=>el===document.activeElement),true,'parent-origin control must be keyboard focusable')
  await page.keyboard.press('Enter')
  await child.locator('article').nth(1).waitFor({state:'detached',timeout:5000})
  assert.equal(await child.locator('article').count(),1)
  assert.equal(await page.locator('.davf-grid svg').count(),0)
  assert.equal(await page.getByRole('button',{name:'取消第2格监视'}).count(),0)
  await child.locator('body').evaluate((_,origin)=>window.parent.postMessage({v:1,kind:'G2_OWNER',capability:'0'.repeat(64)},origin),parentOrigin)
   await page.getByRole('status').filter({hasText:'独立画面暂不可用'}).waitFor({timeout:5000})
   assert.equal(await page.locator('iframe').count(),0)
   assert.equal(await page.locator('.davf-grid svg').count(),0)
   await page.getByRole('button',{name:'重试'}).click()
   await child.locator('article').first().waitFor({timeout:12000})
  assert.deepEqual(unknown,[])
 }finally{releaseOwner();await browser.close()}
})
