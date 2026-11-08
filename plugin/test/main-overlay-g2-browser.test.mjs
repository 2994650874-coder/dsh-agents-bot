import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { report } from '../../tools/shot-util.mjs'

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const chrome='D:/百分/CentBrowser/Application/chrome.exe'
const origin='http://localhost:49384'
const harness=[
 "import React from 'react'",
 "import {createRoot} from 'react-dom/client'",
 "import {MainOverlayG2,readPosition,POSITION_KEY,secondaryPosition,SECONDARY_RATIO} from './MainOverlayG2.tsx'",
 "import {setFps,setMainBotSize,getUi,readMainBotSize} from './store.ts'",
 "import {SettingsPage} from './Settings.tsx'",
 "import {switchToMain,switchToSidebar,setSidebarNavigator,useMainOverlayMode} from './mainOverlayMode.ts'",
 "import {STYLE} from './style.ts'",
 "const style=document.createElement('style');style.textContent=STYLE;document.head.append(style)",
 "window.g2={readPosition,POSITION_KEY,secondaryPosition,SECONDARY_RATIO,switchToMain,switchToSidebar,setSidebarNavigator,setFps,setMainBotSize,getUi,readMainBotSize,mountSettings:()=>{const target=document.createElement('div');target.id='settings';document.body.append(target);createRoot(target).render(<SettingsPage/>)}}",
 "function Sidebar(){const m=useMainOverlayMode();return <div id='sidebar'><button id='switch' role='switch' aria-checked={m.place==='main'} onClick={()=>m.place==='main'?switchToSidebar():switchToMain({x:210,y:125},'pane-original')}>{m.place==='main'?'切回侧栏 Bot':'切到 DSH 主窗口'}</button>{m.place==='main'?<div id='placeholder'>我在 DSH 桌面活动</div>:<div id='canvas' data-active='true'>活动侧栏画布</div>}</div>}",
 "createRoot(document.getElementById('mount')).render(<><Sidebar/><MainOverlayG2/></>)"
].join('\n')
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif;background:#f5f6f8}#sidebar{position:absolute;right:0;top:40px;width:170px;min-height:160px;background:#d9e3f2}#chat{height:100vh;overflow:auto;padding:20px;box-sizing:border-box}#content{height:1500px}#chat input{display:block;margin-top:24px}</style><div id="chat"><div id="content"><p>聊天区可点击/选字/滚动</p><input id="input" aria-label="聊天输入" placeholder="聊天输入"><button id="other">其它页签</button></div></div><div id="mount"></div><script src="/app.js"></script></html>`
const sizes=[[300,600],[537,437],[1280,800]]
const pos=page=>page.locator('.davf-g1-entity').evaluate(el=>({x:+el.dataset.x,y:+el.dataset.y}))
const shot=async(page,label,state)=>{const path=resolve(root,'preview','main-overlay-shared-ball-preview-'+label+'-'+state+'.png');await page.screenshot({path});report(path)}
const geometry=page=>page.evaluate(()=>{
 const main=document.querySelector('.davf-g1-entity').getBoundingClientRect()
 const small=document.querySelector('[data-testid=main-overlay-g2-small]').getBoundingClientRect()
 const hit=document.querySelector('[data-testid=main-overlay-g2-hit]').getBoundingClientRect()
 return {main:{x:main.x,y:main.y,width:main.width,height:main.height},small:{x:small.x,y:small.y,width:small.width,height:small.height},hit:{x:hit.x,y:hit.y,width:hit.width,height:hit.height},width:innerWidth,height:innerHeight}
})
const assertCompanion=async(page,expected)=>{
 const {main,small,hit,width,height}=await geometry(page)
 assert.ok(Math.abs(small.width-main.width*.6)<.02 && Math.abs(small.height-expected*.6)<.02,'small Bot is exactly 60% of main Bot')
 assert.ok(small.x>=0&&small.y>=0&&small.x+small.width<=width+.02&&small.y+small.height<=height+.02,'small Bot fits full viewport')
 assert.ok(small.x+small.width<=hit.x || small.x>=hit.x+hit.width || small.y+small.height<=hit.y || small.y>=hit.y+hit.height,'small Bot cannot cover main circular hit region')
 assert.ok(Math.abs(Number(await page.getByTestId('main-overlay-g2-small').locator('svg').getAttribute('width'))-expected*.6)<.02)
}
test('G2 explicit switch, persistence, keyboard and three viewports (offline Chromium)',async t=>{
 if(!existsSync(chrome)){t.skip('CentBrowser missing: '+chrome);return}
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 const js=(await build({stdin:{contents:harness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'main-overlay-g2-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic'})).outputFiles[0].text
 let browser
 try{browser=await chromium.launch({executablePath:chrome,headless:true})}catch(error){t.skip('Chromium unavailable: '+error.message);return}
 mkdirSync(resolve(root,'preview'),{recursive:true})
 try{for(const [width,height] of sizes){
  await t.test(width+'x'+height,async()=>{
   const label=width+'x'+height
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'})
   const page=await context.newPage()
   await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
   try{
    await page.goto(origin+'/')
    assert.equal(await page.getByTestId('main-overlay-g2').count(),0)
    assert.equal(await page.locator('#canvas').count(),1)
    await page.evaluate(()=>{window.calls=[];window.g2.setSidebarNavigator((kind,options)=>{window.calls.push({kind,options});if(options?.paneId)throw Error('stale pane')})})
    await page.locator('#switch').click()
    const hit=page.getByTestId('main-overlay-g2-hit');await hit.waitFor()
    assert.equal(await page.locator('#canvas').count(),0,'inactive sidebar canvas unmounted')
    assert.equal(await page.locator('#placeholder').count(),1,'static sidebar placeholder')
    await assertCompanion(page,96)
    const initial=await pos(page)
    assert.ok(initial.x>=0&&initial.y>=48,'first-cell origin clamped safely')
    assert.ok(Math.abs(initial.x-Math.max(0,Math.min(210,width-96)))<1,'own first-cell x origin, except clamp')
    await shot(page,label,'switch')
    const beforeDrag=await geometry(page)
    if(width===1280)await page.evaluate(()=>{window.__inputQueries=0;const original=document.querySelectorAll.bind(document);document.querySelectorAll=(s)=>{if(String(s).startsWith('textarea, input'))window.__inputQueries++;return original(s)}})
    const dragStarted=performance.now()
    const dx=initial.x>24?-18:18
    await page.mouse.move(beforeDrag.hit.x+48,beforeDrag.hit.y+48)
    await page.mouse.down();await page.mouse.move(beforeDrag.hit.x+48+dx,beforeDrag.hit.y+64,{steps:width===1280?40:4});await page.mouse.up()
    if(width===1280){const queries=await page.evaluate(()=>window.__inputQueries);console.log('40-step drag input geometry reads',queries,'elapsedMs',+(performance.now()-dragStarted).toFixed(1));assert.ok(queries<=4,'drag caches input geometry rather than scanning DOM each pointer update')}
    assert.ok(Math.abs((await pos(page)).x-initial.x)>1,'main disc drag moves group origin')
    await assertCompanion(page,96)
    await hit.focus();await page.keyboard.press('ArrowLeft');assert.ok((await pos(page)).x<=initial.x,'focused Bot moves on arrow')
    await page.keyboard.press('Enter');assert.equal(await hit.getAttribute('data-clicks'),null,'no inert click counter')
    assert.equal(await page.getByTestId('main-overlay-g2-small').getAttribute('aria-hidden'),'true','visual-only companion')
    assert.equal(await page.getByText(/Bot 已点/).count(),0)
    await shot(page,label,'focus')
    await page.locator('#input').fill('测试 Esc ← Enter')
    await page.locator('#input').focus()
    for(const key of ['Escape','ArrowLeft','ArrowRight','Enter'])await page.keyboard.press(key)
    assert.equal(await page.getByTestId('main-overlay-g2').count(),1,'chat keyboard never switches mode')
    assert.equal(await hit.getAttribute('data-clicks'),null,'chat Enter does not create click feedback')
    await page.locator('#input').fill('聊天输入保留')
    await page.evaluate(()=>document.documentElement.style.setProperty('--dsh-frame-overlay-top','105px'))
    await page.setViewportSize({width:width+1,height})
    await page.waitForFunction(()=>+document.querySelector('.davf-g1-entity').dataset.y>=113)
    await shot(page,label,'titlebar-blocked')
    await hit.focus()
    for(let n=0;n<100;n++)await page.keyboard.press('ArrowDown')
    const bottom=await hit.boundingBox()
    assert.ok(bottom && bottom.x>=0 && bottom.x+bottom.width<=width+1 && bottom.y>=0 && bottom.y+bottom.height<=height+1,'resized Bot stays within viewport')
    await assertCompanion(page,96)
    assert.equal(await page.locator('.davf-g1-entity button').count(),1,'floating Bot has no return control')
    assert.equal(await hit.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+48,b.y+78)===el}),true,'Bot lower hit contour remains draggable')
    await page.evaluate(()=>localStorage.setItem(window.g2.POSITION_KEY,'{"x":"wrong","y":-100}'))
    assert.equal(await page.evaluate(()=>window.g2.readPosition(localStorage.getItem(window.g2.POSITION_KEY))),null,'bad persisted type rejected')
    await hit.focus();await page.keyboard.press('Escape')
    assert.equal(await page.getByTestId('main-overlay-g2').count(),1,'Escape on Bot only exits focus; sidebar switch owns placement')
    assert.equal(await hit.evaluate(el=>document.activeElement===el),false,'Escape releases Bot keyboard focus')
    await page.locator('#switch').click()
    assert.equal(await page.getByTestId('main-overlay-g2').count(),0,'sidebar switch unmounts main canvas')
    assert.equal(await page.locator('#canvas').count(),1,'sidebar canvas resumes')
    assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(window.calls))),[{kind:'agentsBot',options:{paneId:'pane-original'}},{kind:'agentsBot'}],'stale pane falls back without replacing tabs')
    await shot(page,label,'returned')
    await page.locator('#switch').click();await hit.waitFor()
    assert.equal(await hit.evaluate(el=>el.getBoundingClientRect().width),96,'default main Bot is 96px')
    await page.evaluate(()=>window.g2.setMainBotSize(192))
    await page.waitForFunction(()=>document.querySelector('.davf-g1-entity svg').getAttribute('width')==='192')
    assert.equal(await hit.evaluate(el=>el.getBoundingClientRect().width),192,'hit and svg resize together')
    await assertCompanion(page,192)
    if(width===300){const boxes=await geometry(page);assert.ok(boxes.small.y>=boxes.main.y+boxes.main.height || boxes.small.y+boxes.small.height<=boxes.main.y,'narrow viewport uses vertical side')}
    // The component clamps to window.innerWidth, which can differ slightly from Playwright's requested viewport.
    const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight}))
    await page.waitForFunction(({w,h})=>{const el=document.querySelector('.davf-g1-entity');return el&&+el.dataset.x<=Math.max(0,w-192)&&+el.dataset.y<=Math.max(113,h-192)},viewport,{timeout:2000})
    await shot(page,label,'large-vertical-edge')
    const big=await pos(page);assert.ok(big.x<=Math.max(0,viewport.w-192)&&big.y<=Math.max(113,viewport.h-192),'192px Bot reclamps to viewport/chrome')
    await page.evaluate(()=>window.g2.setMainBotSize(64))
    await page.waitForFunction(()=>document.querySelector('.davf-g1-entity svg').getAttribute('width')==='64')
    assert.equal(await hit.evaluate(el=>el.getBoundingClientRect().width),64,'small hit follows 64px SVG')
    await assertCompanion(page,64)
    await hit.focus();await page.keyboard.press('ArrowDown')
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(window.g2.POSITION_KEY)))
    await page.reload();assert.equal(await page.getByTestId('main-overlay-g2').count(),0,'mode is window memory not localStorage')
    await page.locator('#switch').click();await hit.waitFor()
    assert.deepEqual(await pos(page),saved,'reopened Bot restores persisted geometry')
    assert.equal(await hit.evaluate(el=>el.getBoundingClientRect().width),64,'size persists across reload')
    await assertCompanion(page,64)
    assert.equal(await page.evaluate(()=>window.g2.getUi().mainBotSize),64)
    assert.deepEqual(await page.evaluate(()=>[window.g2.readMainBotSize(-1),window.g2.readMainBotSize('bad'),window.g2.readMainBotSize(193)]),[96,96,96],'corrupt persisted sizes fall back to 96')
    await shot(page,label,'reopen-reduced-motion')
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true)
    await page.evaluate(()=>window.g2.setSidebarNavigator(()=>{throw Error('no mounted session')}))
    await page.locator('#switch').click()
    assert.equal(await page.getByTestId('main-overlay-g2-hit').count(),1,'double failure preserves main canvas')
    assert.match(await page.getByRole('status').innerText(),/当前没有可用的侧栏会话/,'failure explains recovery')
    await shot(page,label,'no-session-failure')
    await page.evaluate(()=>window.g2.setSidebarNavigator(()=>{}))
    await page.locator('#switch').click()
    assert.equal(await page.getByTestId('main-overlay-g2').count(),0,'return is retryable')
   }finally{await context.close()}
  })
  }
  await t.test('120 setting cadence and callback/paint proxies (headless display cap)',async()=>{
   const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'no-preference'})
   await context.addInitScript(()=>{
    const raf=window.requestAnimationFrame.bind(window)
    window.__metrics={callbacks:0,callbackMs:0,mutations:0}
    window.requestAnimationFrame=fn=>raf(time=>{const start=performance.now();try{fn(time)}finally{window.__metrics.callbacks++;window.__metrics.callbackMs+=performance.now()-start}})
    new MutationObserver(records=>{window.__metrics.mutations+=records.length}).observe(document,{subtree:true,attributes:true,childList:true,characterData:true})
   })
   const page=await context.newPage()
   await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
   try{
    await page.goto(origin+'/');await page.locator('#switch').click();await page.getByTestId('main-overlay-g2-hit').waitFor()
    const companionBefore=await page.getByTestId('main-overlay-g2-small').locator('svg').evaluate(el=>el.outerHTML)
    const samples=[]
    for(const fps of [45,60,90,120]){
     await page.evaluate(rate=>window.g2.setFps(rate),fps)
     await page.waitForTimeout(160)
     const first=await page.evaluate(()=>({...window.__metrics,time:performance.now()}))
     await page.waitForTimeout(1200)
     const last=await page.evaluate(()=>({...window.__metrics,time:performance.now()}))
     samples.push({setting:fps,callbacksPerSec:+((last.callbacks-first.callbacks)*1000/(last.time-first.time)).toFixed(1),mutationRecordsPerSec:+((last.mutations-first.mutations)*1000/(last.time-first.time)).toFixed(1),callbackMsPerSec:+((last.callbackMs-first.callbackMs)*1000/(last.time-first.time)).toFixed(2)})
    }
    console.log('headless cadence/paint/CPU proxies',JSON.stringify(samples))
    assert.equal(await page.evaluate(()=>window.g2.getUi().fps),120,'floating Bot receives selected 120 setting')
     assert.notEqual(await page.getByTestId('main-overlay-g2-small').locator('svg').evaluate(el=>el.outerHTML),companionBefore,'companion now receives real animated SVG frames')
     assert.equal(await page.getByTestId('main-overlay-g2').locator('svg').count(),2,'two animated SVG figures share one overlay shell')
    assert.ok(samples.at(-1).callbacksPerSec>samples[0].callbacksPerSec,'120 cap requests more real callbacks than 45, without idle rAF polling')
    assert.ok(samples.every(s=>s.callbacksPerSec<=s.setting*1.25),'callbacks remain capped around requested settings')
   }finally{await context.close()}
  })
  await t.test('reduced-motion has no continuous rAF and companion passes clicks through',async()=>{
   const context=await browser.newContext({viewport:{width:537,height:437},reducedMotion:'reduce'})
   await context.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.__rafCount=0;window.requestAnimationFrame=fn=>raf(time=>{window.__rafCount++;fn(time)})})
   const page=await context.newPage()
   await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
   try{
    await page.goto(origin+'/');await page.locator('#switch').click();await page.getByTestId('main-overlay-g2-small').waitFor()
    await page.waitForTimeout(180);const before=await page.evaluate(()=>window.__rafCount)
    await page.waitForTimeout(220);assert.equal(await page.evaluate(()=>window.__rafCount),before,'both Bots stop continuous rAF when motion reduced')
    const target=await page.getByTestId('main-overlay-g2-small').evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('[data-testid=main-overlay-g2-small]')===el})
    assert.equal(target,false,'companion is visual only and has no input hit area')
   }finally{await context.close()}
  })
  await t.test('companion chooses free sides and avoids input geometry',async()=>{
   const context=await browser.newContext({viewport:{width:300,height:600}})
   const page=await context.newPage()
   await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
   try{
    await page.goto(origin+'/');await page.locator('#switch').click();await page.getByTestId('main-overlay-g2-hit').waitFor()
    const result=await page.evaluate(()=>{
     const layout=window.g2.secondaryPosition,view={x:0,y:0,width:300,height:600},main={x:108,y:200}
     const vertical=layout(main,192,view,48)
     const lateral=layout({x:150,y:200},96,view,48)
     const avoid=layout({x:150,y:200},96,view,48,[{x:lateral.x,y:lateral.y,width:57.6,height:57.6}])
     return {vertical,lateral,avoid}
    })
    assert.ok(result.vertical.y<200||result.vertical.y>=392,'300px width forces vertical layout at size 192')
    assert.notDeepEqual(result.avoid,result.lateral,'chat input in first candidate makes small Bot choose another free side')
    const initialSmall=(await geometry(page)).small
    await page.locator('#input').evaluate((el,box)=>{el.style.position='fixed';el.style.left=box.x+'px';el.style.top=box.y+'px';el.style.width=box.width+'px';el.style.height=box.height+'px';el.style.margin='0'},initialSmall)
    const hit=page.getByTestId('main-overlay-g2-hit');await hit.focus();await page.keyboard.press('ArrowLeft')
    const moved=(await geometry(page)).small
    const input=await page.locator('#input').boundingBox()
    assert.ok(moved.x+moved.width<=input.x||moved.x>=input.x+input.width||moved.y+moved.height<=input.y||moved.y>=input.y+input.height,'actual input box remains uncovered after movement')
    assert.equal(await page.getByTestId('main-overlay-g2-small').locator('button').count(),0,'small Bot has no bogus click target')
   }finally{await context.close()}
  })
  await t.test('settings no longer duplicates the sidebar-only size slider',async()=>{
   const context=await browser.newContext({viewport:{width:537,height:437}})
   const page=await context.newPage()
   await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
   try{
    await page.goto(origin+'/');await page.evaluate(()=>window.g2.mountSettings())
    await page.locator('#settings .davs-section').first().waitFor()
    assert.equal(await page.locator('#settings [data-block=main-bot-size]').count(),0)
    assert.equal(await page.locator('#settings input[type=range]').count(),0)
    await page.evaluate(()=>window.g2.setMainBotSize(192))
    assert.equal(await page.evaluate(()=>window.g2.getUi().mainBotSize),192)
    assert.equal(await page.locator('#canvas').count(),1,'sidebar sizing remains independent of floating size')
   }finally{await context.close()}
  })
 }finally{await browser.close()}
})
