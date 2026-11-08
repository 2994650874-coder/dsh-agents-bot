import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'

// Entire harness exists in memory; page.route fulfills every URL, never binds a port.
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const parentOrigin='http://localhost:49384',childOrigin='http://127.0.0.1:49383'
const privateId='PRIVATE_REAL_SESSION_ID_984721',privateTitle='PRIVATE_REAL_SESSION_TITLE_984721'
const parentHarness=`
import React,{useCallback,useState} from 'react'
import{createRoot}from'react-dom/client'
import{IsolatedGrid}from './IsolatedGrid.tsx'
import{snapshotForChild}from './bridgeSnapshot.ts'
import{createOpaqueIds}from '../isolation/protocol.mjs'
import{DEFAULT_ROTATION}from './activities.ts'
const realId=${JSON.stringify(privateId)},title=${JSON.stringify(privateTitle)},aliases=createOpaqueIds()
const look={shape:'cercle',color:'encre',expression:'neutre',size:96}
function App(){
 const[activity,setActivity]=useState('reading'),[failed,setFailed]=useState('')
 window.__setActivity=setActivity
 const onUnavailable=useCallback(reason=>setFailed(reason),[])
 const snapshot=snapshotForChild({shownIds:[realId],agentById:new Map([[realId,{id:realId,name:title,activity,changedAt:Date.now(),isChild:false}]]),kidsCount:new Map(),tokenFor:id=>aliases.get(id),lookFor:()=>look,botSize:96,customizer:false,fps:45,dwellMs:0,rotation:DEFAULT_ROTATION,cols:1,rows:1})
 return failed?<div id="error" role="status" data-reason={failed}>独立画面暂不可用</div>:<IsolatedGrid snapshot={snapshot} onUnavailable={onUnavailable}/>
}
createRoot(document.getElementById('root')).render(<App/>)
`
function ownerScript(capability){return `(()=>{const capability=${JSON.stringify(capability)},origin=${JSON.stringify(parentOrigin)};if(window.parent===window)return;let count=0;const send=()=>{if(count++>=40){clearInterval(timer);return}window.parent.postMessage({v:1,kind:'G2_OWNER',capability},origin)};const timer=setInterval(send,250);send()})();`}
async function bundles(){
 const capability=randomBytes(32).toString('hex')
 const child=await build({entryPoints:[resolve(root,'plugin/src/isolation/main.jsx')],bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__CHILD_ORIGIN__:JSON.stringify(childOrigin),__PARENT_ORIGIN__:JSON.stringify(parentOrigin)}})
 const parent=await build({stdin:{contents:parentHarness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'isolation-browser-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',define:{__BOT_ISOLATION_PARENT_ORIGIN__:JSON.stringify(parentOrigin),__BOT_ISOLATION_CAPABILITY__:JSON.stringify(capability)}})
 const html=readFileSync(resolve(root,'plugin/src/isolation/index.html'),'utf8')
 return {capability,parent:parent.outputFiles[0].text,child:child.outputFiles[0].text,html,owner:ownerScript(capability)}
}
const parentHtml='<!doctype html><html lang="zh"><meta charset="utf-8"><style>html,body,#root{height:100%;margin:0}</style><div id="root"></div><script src="/parent.js"></script></html>'
test('real isolated parent and child handshake, activity update and owner-failure fail-closed (offline Chromium)',async t=>{
 const files=await bundles()
 assert.equal(files.parent.includes(privateTitle),true) // parent-only fixture may have raw data
 assert.equal(files.child.includes(privateId),false)
 assert.equal(files.child.includes(privateTitle),false)
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 let browser
 try{browser=await chromium.launch({executablePath:'D:/百分/CentBrowser/Application/chrome.exe',headless:true})}
 catch(error){t.skip('Chromium unavailable: '+error.message);return}
 try{
  const page=await browser.newPage({viewport:{width:420,height:680}})
  await page.clock.install()
  const blocked=[]
  await page.route('**/*',async route=>{
   const url=route.request().url()
   const contents=new Map([[parentOrigin+'/',[parentHtml,'text/html']],[parentOrigin+'/parent.js',[files.parent,'text/javascript']],[childOrigin+'/',[files.html,'text/html']],[childOrigin+'/app.js',[files.child,'text/javascript']],[childOrigin+'/owner.js',[files.owner,'text/javascript']]])
   const match=contents.get(url)
   if(!match){blocked.push(url);await route.abort();return}
   const headers= url===childOrigin+'/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-ancestors http://localhost:49384",'X-Content-Type-Options':'nosniff'}:{}
   await route.fulfill({status:200,body:match[0],contentType:match[1],headers})
  })
  await page.goto(parentOrigin+'/')
  const iframe=page.locator('iframe[title="隔离活动 AI"]')
  await iframe.waitFor({timeout:12000})
  const child=page.frameLocator('iframe[title="隔离活动 AI"]')
  await child.locator('article[data-activity="reading"] svg').waitFor({timeout:12000})
  await assert.doesNotReject(async()=>{await iframe.waitFor({state:'visible',timeout:2000})})
  assert.equal(await page.locator('#error svg').count(),0)
  assert.equal(await page.locator('body > #root > div > svg').count(),0)
  const childText=await child.locator('body').innerText()
  for(const secret of [privateId,privateTitle])assert.equal(childText.includes(secret),false)
  assert.equal(await child.locator('article strong').innerText(),'当前会话')
  assert.match(await child.locator('article').getAttribute('data-activity'),/^reading$/)
  await page.evaluate(()=>window.__setActivity('running'))
  // The switch crosses HELLO/INIT/READY plus a dwell guard; the old 4s wait flaked
  // under a cold CentBrowser start (observed 2026-11-03, passed on rerun). 12s matches
  // the first-handshake wait above and still fails fast on a real stall.
  await child.locator('article[data-activity="running"] svg').waitFor({timeout:12000})
  assert.equal(await child.locator('article').count(),1)
  assert.equal(await page.locator('#error svg').count(),0)
  await page.clock.fastForward(3_600_000) // hour-long background gap exceeds both ACK and child snapshot limits
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await page.evaluate(()=>window.__setActivity('searching'))
  try { await child.locator('article[data-activity="searching"] svg').waitFor({timeout:7000}) }
  catch(error) { const state={reason:await page.locator('#error').getAttribute('data-reason').catch(()=>null),iframe:await page.locator('iframe').count(),child:await child.locator('body').innerText().catch(()=>null),blocked};throw new Error('failed wake state '+JSON.stringify(state)+' '+error.message) }
  assert.equal(await page.locator('#error').count(),0,'late timers must not permanently latch disconnect')
  // Correct source/origin but incorrect owner: fail closed without a parent-side Bot.
  await child.locator('body').evaluate((_,origin)=>window.parent.postMessage({v:1,kind:'G2_OWNER',capability:'0'.repeat(64)},origin),parentOrigin)
  await page.locator('#error').waitFor({timeout:4000})
  assert.equal(await page.locator('#error svg').count(),0)
  assert.equal(await page.locator('iframe').count(),0)
  assert.match(await page.locator('#error').getAttribute('data-reason'),/归属/)
  assert.deepEqual(blocked,[])
 }finally{await browser.close()}
})
