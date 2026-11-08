import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// G4 is offline fault injection against production G3 root-hook projection.
// No installed bundle, session data, cross-origin child or fake bridge ACK is involved.
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const { build } = createRequire(import.meta.url)('../../node_modules/esbuild')
const chrome = 'D:/百分/CentBrowser/Application/chrome.exe'
const origin = 'http://localhost:49386'
const harness = [
  "import React,{useSyncExternalStore} from 'react'",
  "import {createRoot} from 'react-dom/client'",
  "import {MainOverlayG2} from './MainOverlayG2.tsx'",
  "import {switchToMain} from './mainOverlayMode.ts'",
  "import {patchUi} from './store.ts'",
  "import {STYLE} from './style.ts'",
  "document.head.insertAdjacentHTML('beforeend','<style>'+STYLE+'</style>')",
  "const listeners=new Set();let sessions={phase:'loading',ids:[],byId:{}},statuses,workspaces={archivedSessionIds:[]}",
  "const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};const notify=()=>{for(const fn of listeners)fn()}",
  "const useSessions=sel=>useSyncExternalStore(subscribe,()=>sel(sessions))",
  "const useSessionStatus=sel=>useSyncExternalStore(subscribe,()=>sel(statuses))",
  "const useWorkspaces=sel=>useSyncExternalStore(subscribe,()=>sel(workspaces))",
  "window.fixture={update:patch=>{if('sessions'in patch)sessions=patch.sessions;if('statuses'in patch)statuses=patch.statuses===null?undefined:new Map(patch.statuses);if('workspaces'in patch)workspaces=patch.workspaces;notify()},patchUi,switchToMain}",
  "createRoot(document.getElementById('mount')).render(<MainOverlayG2 useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces}/>)"
].join('\n')
const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><style>body{margin:0;background:#f4f5f7}#mount{position:fixed;inset:0;pointer-events:none}</style><div id="mount"></div><script>window.__g4Intervals=[];const interval=window.setInterval;window.setInterval=function(fn,ms,...args){window.__g4Intervals.push(ms);return interval.call(window,fn,ms,...args)};window.__g4Rafs=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(...args){window.__g4Rafs++;return raf.apply(window,args)}</script><script src="/app.js"></script></html>`
const rows = {
 a:{id:'a',displayTitle:'G4 主会话甲｜真标题不可进子页',retainedBy:{mainView:1},running:false,updatedAt:Date.now()},
 b:{id:'b',displayTitle:'G4 等待会话乙',running:false,updatedAt:Date.now()},
 c:{id:'c',displayTitle:'G4 已选会话丙',running:false,updatedAt:Date.now()}
}
const list = (byId=structuredClone(rows),ids=['a','b','c']) => ({phase:'ready',ids,byId,projectionsBySession:{}})
const statuses = [['a',{pendingInteraction:{kind:'approval'}}],['b',{pendingInteraction:{kind:'approval'}}],['c',{pendingInteraction:{kind:'approval'}}]]

// AvatarPanel §4.7 has a real IsolatedGrid bridge: onTransientDisconnect gates a
// single retry, delays 1s -> max 30s; onBridgeReady resets delay and cancels it;
// focus/pageshow/visibility resume and effect cleanup cancel pending timers. That
// contract belongs to the sidebar iframe only: the inline overlay has neither a
// child bridge nor a legitimate ACK to simulate, so G4 only injects root-hook
// availability and verifies the overlay projection recovers from fresh snapshots.
test('G4 root-hook gaps, recovery, archive and disappear fail closed (offline Chromium)',async t=>{
 if(!existsSync(chrome)){t.skip('CentBrowser missing: '+chrome);return}
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 const js=(await build({stdin:{contents:harness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'main-overlay-g4-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic'})).outputFiles[0].text
 let browser
 try{browser=await chromium.launch({executablePath:chrome,headless:true})}catch(error){t.skip('Chromium unavailable: '+error.message);return}
 try{
  const page=await browser.newPage({viewport:{width:800,height:600},reducedMotion:'reduce'})
  let childRequests=0
  await page.route('**/*',route=>{const url=route.request().url();if(url.includes('49383'))childRequests++;if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
  await page.goto(origin+'/');await page.waitForFunction(()=>!!window.fixture)
  const update=patch=>page.evaluate(value=>window.fixture.update(value),patch)
  const main=page.getByTestId('overlay-main-meta'),message=page.getByTestId('overlay-message-meta')
  const absent=async reason=>{
   await page.waitForFunction(()=>!document.querySelector('[data-testid=overlay-main-meta]')&&!document.querySelector('[data-testid=overlay-message-meta]'))
   assert.equal(await main.count(),0,reason+' must hide current title/activity')
   assert.equal(await message.count(),0,reason+' must hide pending reminders and titles')
   assert.equal(await page.getByTestId('main-overlay-g2').count(),1,'placement remains main while hook data unavailable')
  }
  const ready=async(title,waitIds)=>{
   await main.locator('strong').waitFor()
   await page.waitForFunction((expected)=>document.querySelector('[data-testid=overlay-main-meta] strong')?.getAttribute('title')===expected,title)
   assert.equal(await main.locator('strong').getAttribute('title'),title)
   await page.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('[data-testid=overlay-message-pending] [data-session]')].map(el=>el.getAttribute('data-session')))===JSON.stringify(expected),waitIds)
   const actual=await message.locator('[data-testid=overlay-message-pending] [data-session]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-session')))
   assert.deepEqual(actual,waitIds)
  }
  try{
   await page.evaluate(()=>{window.fixture.patchUi({picked:['a','b','c'],customizer:false});window.fixture.switchToMain({x:100,y:90})})
   await absent('initial loading')
   await update({sessions:list(),statuses:null})
   await absent('missing status Map')
   await update({statuses})
   await ready(rows.a.displayTitle,['b','c'])
   assert.match(await main.innerText(),/等待确认/,'current real activity returned')
   assert.equal(await page.locator('iframe').count(),0,'no real title can be posted to a non-existent child iframe')
   await update({statuses:null})
   await absent('transient missing status Map')
   await update({statuses})
   await ready(rows.a.displayTitle,['b','c'])
   await update({sessions:{...list(),phase:'loading'}})
   await absent('non-ready list carrying stale real titles')
   await update({sessions:list()})
   await ready(rows.a.displayTitle,['b','c'])
   const switched={...structuredClone(rows),a:{...rows.a,retainedBy:{}},b:{...rows.b,retainedBy:{mainView:1}}}
   await update({sessions:list(switched)})
   await ready(rows.b.displayTitle,['a','c'])
   await update({workspaces:{archivedSessionIds:['c']}})
   await ready(rows.b.displayTitle,['a'])
   assert.equal(await message.locator('[data-session=c]').count(),0,'archived picked session never leaks stale pending reminder')
   const withoutA={...switched};delete withoutA.a
   await update({sessions:list(withoutA,['b','c'])})
   await ready(rows.b.displayTitle,[])
   assert.equal(await message.locator('[data-session=a]').count(),0,'disappeared picked session never leaks stale title')
   await update({sessions:list(switched),workspaces:{archivedSessionIds:[]}})
   await ready(rows.b.displayTitle,['a','c'])
   assert.equal(await page.locator('iframe').count(),0,'recovery still has no cross-origin child or title transfer')
   assert.equal(childRequests,0,'overlay never requests the cross-origin child or posts any title to it')
   const firstRafs=await page.evaluate(()=>window.__g4Rafs)
   await page.waitForTimeout(150)
   const lastRafs=await page.evaluate(()=>window.__g4Rafs)
   assert.equal(lastRafs,firstRafs,'reduced-motion canvas has no continuous animation-frame scheduling')
   const intervals=await page.evaluate(()=>window.__g4Intervals)
   assert.deepEqual(intervals,[5000],'only the existing five-second data-age tick; no added continuous canvas scheduler')
  }finally{await page.close()}
 }finally{await browser.close()}
})
