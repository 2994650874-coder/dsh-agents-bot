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
 "import {MainOverlayG1} from './MainOverlayG1.tsx'",
 "import {STYLE} from './style.ts'",
 "const style=document.createElement('style');style.textContent=STYLE;document.head.append(style)",
 "createRoot(document.getElementById('mount')).render(<MainOverlayG1/>)"
].join('\n')
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><style>
body{margin:0;font:16px sans-serif;background:#f5f6f8}.chrome{height:40px;background:#cad5e9;-webkit-app-region:drag}.chrome button{float:right;height:34px;-webkit-app-region:no-drag}
#chat{height:calc(100vh - 40px);overflow:auto;padding:16px;box-sizing:border-box}#content{height:1800px}#chat p{max-width:80%}
</style><div class="chrome"><button id="close" type="button">窗口按钮区</button>模拟 Windows 标题栏</div>
<div id="chat"><div id="content"><p id="select">聊天内容可以点击选择文字并滚动，此处经过透明外壳</p><button id="chat-button">聊天区可点击</button></div></div><div id="mount"></div>
<script>window.chromeDrags=0;document.querySelector('.chrome').addEventListener('pointerdown',()=>window.chromeDrags++)</script><script src="/app.js"></script></html>`
const sizes=[[300,600],[537,437],[1280,800]]
const pos=page=>page.locator('.davf-g1-entity').evaluate(el=>({x:+el.dataset.x,y:+el.dataset.y}))
const shot=async(page,label,state)=>{const path=resolve(root,'preview',`main-overlay-g1-`+label+'-'+state+'.png');await page.screenshot({path});report(path)}
test('G1 inline hit area, drag semantics and three viewport evidence (offline Chromium)',async t=>{
 if(!existsSync(chrome)){t.skip('CentBrowser missing: '+chrome);return}
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 const js=(await build({stdin:{contents:harness,resolveDir:resolve(root,'plugin/src/client'),sourcefile:'main-overlay-g1-harness.jsx',loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic'})).outputFiles[0].text
 let browser
 try{browser=await chromium.launch({executablePath:chrome,headless:true})}catch(error){t.skip('Chromium unavailable: '+error.message);return}
 mkdirSync(resolve(root,'preview'),{recursive:true})
 try{for(const [width,height] of sizes){
  const label=width+'x'+height
  await t.test(label,async()=>{
   const page=await browser.newPage({viewport:{width,height}})
   try{
    await page.route('**/*',route=>{const url=route.request().url();if(url===origin+'/')return route.fulfill({status:200,body:html,contentType:'text/html'});if(url===origin+'/app.js')return route.fulfill({status:200,body:js,contentType:'text/javascript'});return route.abort()})
    await page.goto(origin+'/')
    const hit=page.getByTestId('main-overlay-g1-hit')
    await hit.waitFor()
    assert.equal(await page.locator('.davf-g1-shell').evaluate(el=>getComputedStyle(el).pointerEvents),'none','full shell passes pointer input')
    const start=await pos(page)
    const center={x:start.x+48,y:start.y+48}
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#chat')?.id, {x:start.x+3,y:start.y+3}),'chat','outside clipped Bot disc hits chat')
    await page.mouse.click(center.x,center.y)
    assert.equal(await hit.getAttribute('data-clicks'),'1','Bot click reacts')
    await shot(page,label,'click')
    await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x-44,center.y+90,{steps:8})
    await shot(page,label,'drag');await page.mouse.up()
    const end=await pos(page)
    assert.ok(end.x<start.x-20&&end.y>start.y+40,'drag moves Bot entity')
    assert.equal(await hit.getAttribute('data-clicks'),'1','drag does not count as click')
    assert.equal(await page.evaluate(()=>window.chromeDrags),0,'dragging Bot never starts chrome/window drag in fixture')
    await page.locator('#chat-button').click();assert.equal(await page.locator('#chat-button').evaluate(el=>document.activeElement===el),true,'chat button reachable')
    const textBox=await page.locator('#select').boundingBox()
    assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#select')?.id,{x:textBox.x+20,y:textBox.y+8}),'select','text area receives pointer hit')
    await page.mouse.move(textBox.x+5,textBox.y+8);await page.mouse.down();await page.mouse.move(textBox.x+Math.min(textBox.width-5,160),textBox.y+8,{steps:8});await page.mouse.up()
    assert.match(await page.evaluate(()=>getSelection().toString()),/聊天内容可以点击/,'transparent shell does not block mouse text selection')
    await shot(page,label,'selection')
    const chat=page.locator('#chat');await chat.hover({position:{x:20,y:Math.min(140,height-80)}});await page.mouse.wheel(0,300)
    await page.waitForFunction(()=>document.querySelector('#chat').scrollTop>0)
    assert.ok(await chat.evaluate(el=>el.scrollTop)>0,'transparent shell permits scrolling')
    await page.evaluate(()=>document.documentElement.style.setProperty('--dsh-frame-overlay-top','105px'))
    await page.setViewportSize({width:width+1,height}) // forces late chrome clearance re-clamp
    await hit.evaluate(el=>{const box=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:10,button:0,clientX:box.x+48,clientY:box.y+48}));el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:10,button:0,clientX:box.x+48,clientY:0}));el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:10,button:0,clientX:box.x+48,clientY:0}))})
    await page.waitForTimeout(50)
    assert.ok((await pos(page)).y>=113,'titlebar failure state: Bot cannot enter chrome/button area')
    assert.equal(await page.evaluate(()=>window.chromeDrags),0,'failed titlebar drag still never drags window')
    await page.setViewportSize({width,height})
    await chat.evaluate(el=>{el.scrollTop=0})
    await shot(page,label,'titlebar-blocked')
   }finally{await page.close()}
  })
 }}finally{await browser.close()}
})
