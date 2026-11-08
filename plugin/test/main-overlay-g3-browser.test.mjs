import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const chrome='D:/百分/CentBrowser/Application/chrome.exe'
const origin='http://localhost:49385'
const harness=[
 "import React,{useSyncExternalStore} from 'react'",
 "import {createRoot} from 'react-dom/client'",
 "import {MainOverlayG2,secondaryPosition,SECONDARY_RATIO} from './MainOverlayG2.tsx'",
 "import {switchToMain,switchToSidebar,setSidebarNavigator} from './mainOverlayMode.ts'",
 "import {getUi,patchUi,setMainBotSize,setLook,setMessageLook} from './store.ts'",
 "import {STYLE} from './style.ts'",
 "document.head.insertAdjacentHTML('beforeend','<style>'+STYLE+'</style>')",
 "const listeners=new Set();let sessions={phase:'loading',ids:[],byId:{}},statuses=new Map(),workspaces={archivedSessionIds:[]}",
 "const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};const notify=()=>{for(const fn of listeners)fn()}",
 "const useSessions=sel=>useSyncExternalStore(subscribe,()=>sel(sessions))",
 "const useSessionStatus=sel=>useSyncExternalStore(subscribe,()=>sel(statuses))",
 "const useWorkspaces=sel=>useSyncExternalStore(subscribe,()=>sel(workspaces))",
 "window.fixture={update:(patch)=>{if('sessions'in patch)sessions=patch.sessions;if('statuses'in patch)statuses=new Map(patch.statuses);if('workspaces'in patch)workspaces=patch.workspaces;notify()},getUi,patchUi,setMainBotSize,setLook,setMessageLook,switchToMain,switchToSidebar,setSidebarNavigator,secondaryPosition,SECONDARY_RATIO}",
 "createRoot(document.getElementById('mount')).render(<MainOverlayG2 useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces}/>)"
].join('\n')
const html='<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;font:14px sans-serif;background:#f4f5f7}#chat{position:fixed;inset:0;padding:12px}textarea{position:absolute;left:8px;bottom:8px;width:120px;height:32px}#mount{position:fixed;inset:0;pointer-events:none}</style><div id="chat">聊天区域<textarea aria-label="聊天输入框"></textarea></div><div id="mount"></div><script src="/app.js"></script></html>'
const rows={
 a:{id:'a',displayTitle:'主会话甲：一个较长标题',retainedBy:{mainView:1},running:false,updatedAt:Date.now()},
 b:{id:'b',displayTitle:'等待会话乙乙乙乙',running:false,updatedAt:Date.now()},
 c:{id:'c',displayTitle:'等待会话丙丙丙丙',running:false,updatedAt:Date.now()},
 d:{id:'d',displayTitle:'等待会话丁丁丁丁',running:false,updatedAt:Date.now()},
 kidA:{id:'kidA',displayTitle:'真子代理',parentId:'a',origin:'subagent',updatedAt:Date.now()-20_000},
 kidB:{id:'kidB',displayTitle:'另一子代理',parentId:'b',origin:'subagent',updatedAt:Date.now()-20_000},
 fork:{id:'fork',displayTitle:'普通分叉',parentId:'a',updatedAt:Date.now()-20_000}
}
const list=()=>({phase:'ready',ids:['a','b','c','d','fork'],byId:structuredClone(rows),projectionsBySession:{}})
const waits=()=>[['b',{pendingInteraction:{kind:'approval'}}],['c',{pendingInteraction:{kind:'approval'}}],['d',{pendingInteraction:{kind:'approval'}}]]
const shot=async(page,name)=>{const path=resolve(root,'preview','main-overlay-g3-7-shared-ball-preview-'+name+'.png');await page.screenshot({path});console.log('screenshot',path)}
const pending=page=>page.locator('[data-testid=overlay-message-pending] [data-session]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-session')))
const rect=locator=>locator.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})
const within=(r,w,h)=>r.x>=-.1&&r.y>=-.1&&r.x+r.width<=w+.1&&r.y+r.height<=h+.1
const disjoint=(a,b)=>a.x+a.width<=b.x+.1||b.x+b.width<=a.x+.1||a.y+a.height<=b.y+.1||b.y+b.height<=a.y+.1
const centerX=r=>r.x+r.width/2
const assertSizedLiveLayout=async(page,width,height,size,expectedPending=2)=>{
 const main=page.locator('.davf-g1-entity'),small=page.getByTestId('main-overlay-g2-small')
 const mainSvg=main.locator('svg'),smallSvg=small.locator('svg')
 const mainMeta=page.getByTestId('overlay-main-meta'),messageMeta=page.getByTestId('overlay-message-meta')
 const mainTitle=mainMeta.locator('strong'),messageTitle=messageMeta.locator('strong')
 const mainPills=mainMeta.locator('span[title]'),pendingRows=messageMeta.locator('[data-testid=overlay-message-pending] [data-session]')
 const named=[['main Bot',main],['small Bot',small],['main SVG',mainSvg],['message SVG',smallSvg],
  ['main metadata',mainMeta],['message metadata',messageMeta],['main title',mainTitle],['message title',messageTitle]]
 for(const [name,node] of named){const box=await rect(node);assert.ok(within(box,width,height),name+' outside '+width+'x'+height+' at '+size+'px: '+JSON.stringify(box))}
 assert.equal(await mainPills.count(),2,'main activity and child pills remain visible')
 assert.equal(await pendingRows.count(),expectedPending,'message shows exactly '+expectedPending+' pending rows')
 assert.equal(await messageMeta.locator('span[title]').count(),expectedPending,'message has no extra status or child pill')
 assert.equal(await messageTitle.getAttribute('title'),'监控其他窗口 3','hover keeps complete other-session count')
 assert.equal(await messageTitle.innerText(),size < 160 ? '监控 3' : '监控其他窗口 3','compact title keeps count visible at small Bot sizes')
 const titleA=await rect(mainTitle),titleB=await rect(messageTitle),svgA=await rect(mainSvg),svgB=await rect(smallSvg)
 assert.ok(Math.abs(centerX(titleA)-centerX(svgA))<=1,'main title center must follow main SVG at '+size+'px')
 assert.ok(Math.abs(centerX(titleB)-centerX(svgB))<=1,'message title center must follow visually shifted SVG at '+size+'px')
 const a=await rect(mainMeta),b=await rect(messageMeta)
 assert.ok(disjoint(a,b),'metadata overlap at '+width+'x'+height+' size '+size+': main '+JSON.stringify(a)+' message '+JSON.stringify(b))
 assert.ok(disjoint(a,svgB)&&disjoint(b,svgA),'metadata cannot cross over opposite SVG at '+width+'x'+height+' size '+size+': mainMeta='+JSON.stringify(a)+' messageSvg='+JSON.stringify(svgB)+' messageMeta='+JSON.stringify(b)+' mainSvg='+JSON.stringify(svgA))
 const big=await rect(main),tiny=await rect(small)
 assert.ok(Math.abs(big.width-size)<.02&&Math.abs(tiny.width-size*.6)<.02,'both Bot boxes track '+size+'px')
 const lateral=tiny.x>=big.x+big.width-.1||tiny.x+tiny.width<=big.x+.1
 if(lateral)assert.ok(Math.abs(titleA.y-titleB.y)<1,'side-by-side titles share top baseline at '+size+'px')
 for(let i=0;i<2;i++){
  const pill=await rect(mainPills.nth(i));assert.ok(within(pill,width,height),'main pill '+i+' outside '+size+'px')
  assert.ok(Math.abs(centerX(pill)-centerX(svgA))<=1,'main pill '+i+' centered at '+size+'px')
  if(i===1)assert.ok(pill.y>=(await rect(mainPills.first())).y+16,'main activity and child pills stack vertically')
 }
 for(let i=0;i<expectedPending;i++){
  const pill=await rect(pendingRows.nth(i));assert.ok(within(pill,width,height),'pending '+i+' outside '+size+'px')
  assert.ok(Math.abs(centerX(pill)-centerX(svgB))<=1,'pending '+i+' centered below message SVG')
  if(i>0){const prev=await rect(pendingRows.nth(i-1));assert.ok(pill.y>=prev.y+prev.height,'pending rows stack vertically')}
 }
}

test('G3 floating twin Bot reads root hooks and renders parent-only labels',async t=>{
 if(!existsSync(chrome)){t.skip('CentBrowser missing: '+chrome);return}
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 const js=(await build({stdin:{contents:harness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'main-overlay-g3-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic'})).outputFiles[0].text
 let browser
 try{browser=await chromium.launch({executablePath:chrome,headless:true})}catch(error){t.skip('Chromium unavailable: '+error.message);return}
 mkdirSync(resolve(root,'preview'),{recursive:true})
 const pageFor=async(width,height,motion='reduce',observePointer=false)=>{
  const context=await browser.newContext({viewport:{width,height},reducedMotion:motion})
  const page=await context.newPage()
   if(observePointer)await page.addInitScript(()=>{
    const add=window.addEventListener,remove=window.removeEventListener,raf=window.requestAnimationFrame
    window.__overlayPointerListeners=0;window.__overlayPointerRemoved=0;window.__overlayRafCallbacks=0
    window.addEventListener=function(type,...args){if(type==='pointermove')window.__overlayPointerListeners++;return add.call(this,type,...args)}
    window.removeEventListener=function(type,...args){if(type==='pointermove')window.__overlayPointerRemoved++;return remove.call(this,type,...args)}
    window.requestAnimationFrame=function(callback){return raf.call(this,time=>{window.__overlayRafCallbacks++;callback(time)})}
   })
  await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
  await page.goto(origin+'/');await page.waitForFunction(()=>!!window.fixture)
  return {context,page}
 }
 try{
  for(const [width,height] of [[300,600],[537,437],[1280,800]])await t.test(width+'x'+height+' real activity, queue and visibility',async()=>{
   const {context,page}=await pageFor(width,height)
   try{
    await page.evaluate(data=>{window.fixture.patchUi({picked:['a','b','c','d'],customizer:false});window.fixture.update({sessions:data.list,statuses:data.status});window.fixture.switchToMain({x:Math.min(175,innerWidth-110),y:90})},{list:list(),status:[['a',{pendingInteraction:{kind:'approval'}}],...waits()]})
    const main=page.getByTestId('overlay-main-meta'),message=page.getByTestId('overlay-message-meta')
    await main.waitFor();await message.waitFor()
    assert.equal(await main.locator('strong').getAttribute('title'),rows.a.displayTitle,'real title stays parent-side')
    assert.match(await main.innerText(),/等待确认/,'main activity capsule reflects live status')
    assert.match(await main.innerText(),/1 子代理/,'catalog-only child counted, ordinary fork excluded')
    assert.equal(await message.locator('strong').getAttribute('title'),'监控其他窗口 3','active session excluded from other count')
    assert.equal(await message.locator('span[title]').count(),2,'pending=3 shows exactly two reminder pills, no child/status pills')
    assert.deepEqual(await pending(page),['b','c'],'only two reminders occupy visible slots')
    assert.equal(await page.locator('iframe').count(),0,'real titles never sent to isolated child')
    const mb=await rect(page.locator('.davf-g1-entity')),sb=await rect(page.getByTestId('main-overlay-g2-small'))
    assert.ok(Math.abs(sb.width-mb.width*.6)<.02,'companion remains sixty percent')
    assert.ok(within(sb,width,height),'companion stays inside viewport')
    const hit=await rect(page.getByTestId('main-overlay-g2-hit'))
    assert.ok(sb.x+sb.width<=hit.x || sb.x>=hit.x+hit.width || sb.y+sb.height<=hit.y || sb.y>=hit.y+hit.height,'companion box never covers main circular hit')
    for(const meta of [main,message]){
     const title=await rect(meta.locator('strong'))
     const pill=await rect(meta.locator('span[title]').first())
     assert.ok(within(title,width,height)&&within(pill,width,height),'real title and activity pill remain visible at '+width)
    }
    await shot(page,width+'x'+height+'-ready')
    const metaA=await rect(main),metaB=await rect(message)
    assert.ok(disjoint(metaA,metaB),'main and message metadata cannot overlap at '+width+'px')
    for(const size of [192,96,64]){
     await page.evaluate(value=>window.fixture.setMainBotSize(value),size)
     await page.waitForFunction(value=>document.querySelector('.davf-g1-entity svg')?.getAttribute('width')===String(value),size)
     if(size!==64)await shot(page,width+'x'+height+'-size-'+size)
     await assertSizedLiveLayout(page,width,height,size)
    }
    await page.evaluate(()=>window.fixture.setMainBotSize(96))
    await page.waitForFunction(()=>document.querySelector('.davf-g1-entity svg')?.getAttribute('width')==='96')
    await page.evaluate(()=>window.fixture.update({statuses:[]}))
    await page.waitForFunction(()=>!document.querySelector('[data-testid=overlay-message-pending]'))
    await assertSizedLiveLayout(page,width,height,96,0)
    await shot(page,width+'x'+height+'-idle-message')
    await page.evaluate(()=>window.fixture.update({statuses:[['b',{pendingInteraction:true}]]}))
    await page.waitForFunction(()=>document.querySelectorAll('[data-testid=overlay-message-pending] [data-session]').length===1)
    assert.deepEqual(await pending(page),['b'])
    await assertSizedLiveLayout(page,width,height,96,1)
    await page.evaluate(()=>window.fixture.update({statuses:[['b',{pendingInteraction:true}],['c',{pendingInteraction:true}]]}))
    await page.waitForFunction(()=>document.querySelectorAll('[data-testid=overlay-message-pending] [data-session]').length===2)
    assert.deepEqual(await pending(page),['b','c'])
    await assertSizedLiveLayout(page,width,height,96,2)
    await page.evaluate(statuses=>window.fixture.update({statuses}),waits())
    await assertSizedLiveLayout(page,width,height,96,2)
    assert.deepEqual(await pending(page),['b','c'],'three pending still capped at two')
    await page.evaluate(()=>window.fixture.update({statuses:[['c',{pendingInteraction:{kind:'approval'}}],['d',{pendingInteraction:{kind:'approval'}}]]}))
    await page.waitForFunction(()=>document.querySelector('[data-testid=overlay-message-pending] [data-session=d]'))
    assert.deepEqual(await pending(page),['c','d'],'third reminder fills vacated slot in queue order')
    assert.equal(await page.getByTestId('overlay-message-pending').locator('[data-session=b]').count(),0)
    await shot(page,width+'x'+height+'-filled')
    await page.evaluate(()=>{window.fixture.setSidebarNavigator(()=>{});window.fixture.switchToSidebar()})
    await page.waitForFunction(()=>!document.querySelector('[data-testid=main-overlay-g2]'))
    await page.evaluate(data=>{window.fixture.update({sessions:data});window.fixture.switchToMain({x:175,y:90})},{...list(),byId:{...structuredClone(rows),a:{...rows.a,retainedBy:{}},b:{...rows.b,retainedBy:{mainView:1}}}})
    await message.waitFor();assert.equal(await main.locator('strong').getAttribute('title'),rows.b.displayTitle,'main session follows root hook even after sidebar is unmounted')
    assert.equal(await message.locator('strong').getAttribute('title'),'监控其他窗口 3','new current session still excluded')
    await shot(page,width+'x'+height+'-switched')
   }finally{await context.close()}
  })
  await t.test('normal motion slides newly promoted pending reminder upward',async()=>{
   const {context,page}=await pageFor(1280,800,'no-preference',true)
   try{
    const errored={...list(),projectionsBySession:{b:{values:{agentsBot:{tool:null,tools:0,bg:0,compacting:false,errorAt:Date.now()}}}}}
    await page.evaluate(data=>{window.fixture.patchUi({picked:['b','c','d'],customizer:true});window.fixture.update({sessions:data,statuses:[['b',{pendingInteraction:true}],['c',{pendingInteraction:true}],['d',{pendingInteraction:true}]]});window.fixture.switchToMain({x:275,y:125})},errored)
    await page.getByTestId('overlay-message-pending').waitFor()
    assert.deepEqual(await pending(page),['b','c'])
    assert.equal(await page.evaluate(()=>window.__overlayPointerListeners),1,'only main Bot installs mouse-follow listener, not static companion')
    const mainAtOpen=await page.locator('.davf-g1-entity svg').evaluate(svg=>svg.outerHTML)
    await page.waitForFunction(initial=>document.querySelector('.davf-g1-entity svg')?.outerHTML!==initial,mainAtOpen,{timeout:2000})
    const gaze=async selector=>page.locator(selector+' svg mask path[transform]').first().getAttribute('transform')
    await page.mouse.move(10,10);await page.waitForTimeout(250)
    const left=[await gaze('.davf-g1-entity'),await gaze('[data-testid=main-overlay-g2-small]')]
    await page.mouse.move(1250,780);await page.waitForTimeout(250)
    const right=[await gaze('.davf-g1-entity'),await gaze('[data-testid=main-overlay-g2-small]')]
    for(let i=0;i<2;i++)assert.ok(left[i]&&right[i]&&left[i]!==right[i],'visible Bot '+i+' eye transform follows the mouse across chat')
    await page.waitForFunction(()=>document.querySelector('.davf-g1-entity svg')?.getAttribute('data-state')==='wink'&&
      document.querySelector('[data-testid=main-overlay-g2-small] svg')?.getAttribute('data-state')==='wink',null,{timeout:9000})
    const movingCompanion=await page.getByTestId('main-overlay-g2-small').locator('svg').evaluate(el=>el.outerHTML)
    await page.evaluate(()=>{window.__animations=[];Element.prototype.animate=function(frames,options){window.__animations.push({frames,options});return {cancel(){}}}})
    await page.evaluate(()=>window.fixture.update({statuses:[['b',{completionUnread:true}],['c',{pendingInteraction:true}],['d',{pendingInteraction:true}]]}))
    await page.waitForFunction(()=>document.querySelector('[data-testid=overlay-message-pending] [data-session=d]'))
    assert.deepEqual(await pending(page),['c','d'])
    await page.waitForFunction(initial=>document.querySelector('[data-testid=main-overlay-g2-small] svg')?.outerHTML!==initial,movingCompanion,{timeout:1000})
    assert.equal(await page.evaluate(()=>window.__overlayPointerListeners),1,'two animated Bots share one pointer listener')
    const animations=await page.evaluate(()=>window.__animations)
    assert.ok(animations.some(a=>a.frames[0].transform==='translateY(20px)'&&a.frames[1].transform==='translateY(0)'&&a.options.duration===250),'replacement reminder slides upward once')
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.waitForFunction(()=>window.__overlayPointerRemoved>=1)
    await page.waitForTimeout(160)
    const stopped=await page.evaluate(()=>window.__overlayRafCallbacks)
    await page.waitForTimeout(180)
    assert.equal(await page.evaluate(()=>window.__overlayRafCallbacks),stopped,'reduce-motion stops the only two-Bot frame pump')
    await page.emulateMedia({reducedMotion:'no-preference'})
    await page.waitForFunction(()=>window.__overlayPointerListeners>=2)
    await page.waitForFunction(before=>window.__overlayRafCallbacks>before,stopped)
    await shot(page,'1280x800-promotion-motion')
   }finally{await context.close()}
  })
  await t.test('both Bots look down when the cursor moves down',async()=>{
   const {context,page}=await pageFor(1280,800,'no-preference')
   try{
    await page.evaluate(data=>{
     const ui=window.fixture.getUi()
     window.fixture.patchUi({picked:['b'],rotation:{...ui.rotation,idle:[{state:'idle',plays:1}]}})
     window.fixture.update({sessions:data,statuses:[]})
     window.fixture.switchToMain({x:275,y:125})
    },list())
    await page.getByTestId('main-overlay-g2-small').locator('svg').waitFor()
    const eyeY=()=>page.evaluate(()=>[...document.querySelectorAll('.davf-g1-entity svg, [data-testid=main-overlay-g2-small] svg')]
      .map(svg=>Number(svg.querySelector('mask path[transform]')?.getAttribute('transform')?.match(/^matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,([^)]*)\)$/)?.[1])))
    await page.mouse.move(640,20);await page.waitForTimeout(420)
    const up=await eyeY()
    await page.mouse.move(640,780);await page.waitForTimeout(420)
    const down=await eyeY()
    assert.equal(up.length,2,'one overlay still contains both Bot figures')
    for(let i=0;i<2;i++)assert.ok(Number.isFinite(up[i])&&Number.isFinite(down[i])&&down[i]>up[i]+2,
      'Bot '+i+' eye must move down in SVG coordinates when cursor moves down: '+JSON.stringify({up:up[i],down:down[i]}))
    const eyeX=()=>page.evaluate(()=>[...document.querySelectorAll('.davf-g1-entity svg, [data-testid=main-overlay-g2-small] svg')]
      .map(svg=>[...svg.querySelectorAll('mask path[transform]')].reduce((total,eye)=>total+Number(eye.getAttribute('transform')?.match(/^matrix\(([^)]*)\)$/)?.[1].split(',')[4]),0)))
    await page.mouse.move(100,400);await page.waitForTimeout(420)
    const left=await eyeX()
    await page.mouse.move(1180,400);await page.waitForTimeout(420)
    const right=await eyeX()
    for(let i=0;i<2;i++)assert.ok(Number.isFinite(left[i])&&Number.isFinite(right[i])&&right[i]>left[i]+2,
      'mirrored idle Bot '+i+' must still look right for a rightward cursor: '+JSON.stringify({left:left[i],right:right[i]}))
   }finally{await context.close()}
  })
  await t.test('motion reduction, independent looks, spacing and fail-closed state',async()=>{
   const {context,page}=await pageFor(1280,800)
   try{
    await page.evaluate(data=>{window.fixture.patchUi({picked:['b','c','d'],customizer:false});window.fixture.update({sessions:data,statuses:[['b',{pendingInteraction:{kind:'approval'}}],['c',{pendingInteraction:{kind:'approval'}}],['d',{pendingInteraction:{kind:'approval'}}]]});window.fixture.switchToMain({x:275,y:125})},list())
    await page.getByTestId('overlay-message-pending').waitFor()
    const separation=await page.evaluate(()=>{const a=document.querySelector('.davf-g1-entity').getBoundingClientRect(),b=document.querySelector('[data-testid=main-overlay-g2-small]').getBoundingClientRect();return b.x>=a.right?b.x-a.right:a.x>=b.right?a.x-b.right:null})
    const placement=await page.evaluate(()=>{const a=document.querySelector('.davf-g1-entity').getBoundingClientRect(),b=document.querySelector('[data-testid=main-overlay-g2-small]').getBoundingClientRect();return {main:{x:a.x,y:a.y,width:a.width,height:a.height},small:{x:b.x,y:b.y,width:b.width,height:b.height},baseline:{main:a.y+a.height*.85,small:b.y+b.height*.85}}})
    if(separation!==null){
     assert.ok(Math.abs(separation-5.6)<.1,'lateral box gap is thirty percent smaller than G2.3 8px gap')
     assert.ok(Math.abs(placement.baseline.main-placement.baseline.small)<.1,'lateral silhouettes align at the same visible-bottom baseline')
    }else assert.ok(disjoint(placement.main,placement.small),'when metadata prevent lateral grouping, vertical Bot boxes stay separate')
    const before=await page.evaluate(()=>[...document.querySelectorAll('.davf-g1-shell svg')].map(el=>el.outerHTML))
    await page.evaluate(()=>window.fixture.setMessageLook({...window.fixture.getUi().messageLook,color:'rouge'}))
    const after=await page.evaluate(()=>[...document.querySelectorAll('.davf-g1-shell svg')].map(el=>el.outerHTML))
    assert.equal(before[0],after[0],'message look does not mutate main SVG')
    assert.notEqual(before[1],after[1],'message look changes only small SVG')
    await page.evaluate(()=>window.fixture.setLook(undefined,{...window.fixture.getUi().look,color:'bleu'}))
    const afterMain=await page.evaluate(()=>[...document.querySelectorAll('.davf-g1-shell svg')].map(el=>el.outerHTML))
    assert.notEqual(afterMain[0],after[0],'main look changes main SVG')
    assert.equal(afterMain[1],after[1],'main look does not mutate message SVG')
    assert.equal(await page.getByTestId('main-overlay-g2-small').getAttribute('aria-hidden'),'true')
    await page.evaluate(()=>{window.__animations=[];Element.prototype.animate=function(frames,options){window.__animations.push({frames,options});return {cancel(){}}}})
    await page.evaluate(()=>window.fixture.update({statuses:[['b',{completionUnread:true}],['c',{pendingInteraction:true}],['d',{pendingInteraction:true}]]}))
    await page.waitForFunction(()=>document.querySelector('[data-testid=overlay-message-pending] [data-session=d]'))
    assert.deepEqual(await page.evaluate(()=>window.__animations),[],'reduced motion disables sliding')
    await page.evaluate(()=>window.fixture.update({sessions:{phase:'loading',ids:[],byId:{}}}))
    await page.waitForFunction(()=>!document.querySelector('[data-testid=overlay-main-meta]'))
    assert.equal(await page.getByTestId('overlay-message-meta').count(),0,'unavailable root hook fails closed')
    await shot(page,'1280x800-unavailable')
   }finally{await context.close()}
  })
 }finally{await browser.close()}
})
