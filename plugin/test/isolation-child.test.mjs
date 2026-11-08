import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {ACTIVITY,ANIMATION,ParentBridge,ChildBridge,createOpaqueIds,displayRows,validateSnapshot} from '../src/isolation/protocol.mjs'
import {ACTIVITY_ORDER,DEFAULT_ROTATION} from '../src/client/activities.ts'
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const childOrigin='http://127.0.0.1:49382',parentOrigin='http://127.0.0.1:49383'
const look={shape:'cercle',color:'encre',expression:'neutre',size:96}
const ui={fps:45,dwellMs:1600,rotation:DEFAULT_ROTATION,cols:2,rows:1}
const aliases=createOpaqueIds(),row=displayRows([{id:'real-session-/path',name:'private title',activity:'thinking',changedAt:1700000000000,isChild:false,childCount:0,pose:false,look}],aliases)[0]
const token='a'.repeat(32),epoch='b'.repeat(32)
const snapshot=(more={})=>({v:1,kind:'SNAPSHOT',nonce:token,epoch,seq:1,sentAt:1700000000000,rows:[row],ui,...more})
test('state vocabularies match production exactly',()=>{assert.deepEqual(ACTIVITY,ACTIVITY_ORDER);const source=readFileSync(resolve(root,'plugin/src/bot/states.ts'),'utf8');const ids=[...source.split('export type StateId =')[1].split('export interface StateDef')[0].matchAll(/'([a-z]+)'/g)].map(m=>m[1]);assert.deepEqual(new Set(ANIMATION),new Set(ids));assert.equal(ANIMATION.length,24)})
test('identity projection excludes raw IDs and names; snapshot exactness',()=>{
 assert.match(row.id,/^[a-f0-9]{32}$/);assert.equal(row.name,'当前会话');assert.equal(aliases.get('real-session-/path'),row.id)
 assert.equal(JSON.stringify(row).includes('private'),false);assert.equal(JSON.stringify(row).includes('/path'),false)
 assert.ok(validateSnapshot(snapshot(),1700000000000));assert.equal(validateSnapshot(snapshot({ui:{...ui,canvas:'#e8dfc8'}}),1700000000000)?.ui.canvas,'#e8dfc8');const invalid=[{rows:[{...row,id:'real-session'}]},{rows:[{...row,name:'C:/secret/file'}]},{rows:[{...row,name:'监控 1'}]},{rows:[{...row,pose:'false'}]},{rows:[{...row,look:{...look,evil:1}}]},{ui:{...ui,cols:0}},{ui:{...ui,canvas:'url(https://evil.example/pixel)'}},{ui:{...ui,canvas:'#fff'}},{ui:{...ui,canvas:'#e8dfc8',extra:'private'}},{ui:{...ui,cols:1,rows:1},rows:[row,{...row,id:'c'.repeat(32),name:'监控 2'}]},{ui:{...ui,rotation:{idle:[{state:'idle',plays:1}]}}},{extra:'leak'},{rows:[row,row]},{rows:new Array(10).fill(row)}]
 for(const mutation of invalid)assert.equal(validateSnapshot(snapshot(mutation),1700000000000),null,JSON.stringify(mutation).slice(0,80))
 assert.equal(validateSnapshot(snapshot({sentAt:1699999987000}),1700000000000),null)
 assert.equal(validateSnapshot(snapshot({sentAt:1700000001001}),1700000000000),null)
 assert.equal(validateSnapshot(snapshot({rows:[{...row,name:'<script>'}]}),1700000000000),null)
 assert.equal(validateSnapshot(snapshot({rows:[{...row,activity:'__proto__'}]}),1700000000000),null)
 assert.equal(validateSnapshot(snapshot({rows:[{...row,look:{...look,size:Infinity}}]}),1700000000000),null)
 assert.equal(validateSnapshot(snapshot({rows:[{...row,look:{...look,color:'foo'}}]}),1700000000000),null)
 for(const fps of [45,60,90,120])assert.ok(validateSnapshot(snapshot({ui:{...ui,fps}}),1700000000000),fps+' fps must pass strict child validation')
 for(const fps of [0,30,61,144])assert.equal(validateSnapshot(snapshot({ui:{...ui,fps}}),1700000000000),null,fps+' fps must stay rejected')
})
test('pinned source and origin, contiguous sequence and fresh resync',()=>{
 const parentSource={},childSource={},pToC=[],cToP=[],sendParent=(target,msg,origin)=>pToC.push({target,msg,origin}),sendChild=(target,msg,origin)=>cToP.push({target,msg,origin});let now=1700000000000
 assert.throws(()=>new ParentBridge({childSource,childOrigin:'*',send:sendParent}),/origin/)
 const parent=new ParentBridge({childSource,childOrigin,send:sendParent,now:()=>now}),child=new ChildBridge({parentSource,parentOrigin,send:sendChild,now:()=>now})
 const toParent=()=>parent.receive({source:childSource,origin:childOrigin,data:cToP.pop().msg})
 const toChild=()=>child.receive({source:parentSource,origin:parentOrigin,data:pToC.pop().msg})
 assert.equal(parent.publish([row],ui),true)
 child.hello();assert.equal(parent.receive({source:{},origin:childOrigin,data:cToP.at(-1).msg}),false);assert.equal(toParent(),true)
 assert.equal(toChild(),true);assert.equal(toParent(),true);assert.equal(toChild(),true);assert.equal(child.view().state,'live');assert.equal(parent.lastAckSeq,0);assert.equal(toParent(),true);assert.equal(parent.lastAckSeq,1);assert.equal(parent.lastAckAt,now)
 const oldEpoch=parent.epoch;parent.seq++ // simulate missing seq 2
 parent.publish([{...row,activity:'reading'}],ui);assert.equal(toChild(),false);assert.equal(child.view().state,'unsynced');assert.equal(toParent(),true)
 assert.notEqual(parent.epoch,oldEpoch);assert.equal(toChild(),true);assert.equal(toParent(),true);assert.equal(toChild(),true)
 assert.equal(child.view().snapshot.rows[0].activity,'reading');assert.equal(child.seq,1);assert.equal(toParent(),true);assert.equal(parent.lastAckSeq,1)
 const replay=child.current;assert.equal(child.receive({source:parentSource,origin:parentOrigin,data:replay}),false)
 now+=12001;assert.equal(child.view().state,'unsynced')
})
test('test-only build and server-side render have no DSH runtime import',async()=>{
 execFileSync(process.execPath,['tools/build-isolated-child.mjs','--child-origin='+childOrigin,'--parent-origin='+parentOrigin],{cwd:root,stdio:'pipe'})
 const meta=JSON.parse(readFileSync(resolve(root,'.test-build/isolation/build-meta.json'),'utf8'));const beacon=readFileSync(resolve(root,'.test-build/isolation/owner.js'),'utf8');assert.match(meta.capability,/^[a-f0-9]{64}$/);assert.ok(beacon.includes(meta.capability));assert.ok(beacon.includes(parentOrigin));assert.match(beacon,/G2_OWNER/);const js=readFileSync(resolve(root,'.test-build/isolation/app.js'),'utf8')
 assert.doesNotMatch(js,/_work[\/]|localStorage|sessionManager|fetch\(/)
 const {build}=await import('../../node_modules/esbuild/lib/main.js')
 const result=await build({entryPoints:[resolve(root,'plugin/src/isolation/main.jsx')],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:resolve(root,'.test-build/isolation/ssr.mjs'),external:['react','react-dom/client','react/jsx-runtime'],define:{__CHILD_ORIGIN__:JSON.stringify(childOrigin),__PARENT_ORIGIN__:JSON.stringify(parentOrigin)}})
 // SSR safety: bundle loads without document/window and React renderToString runs effects nowhere.
 const code=readFileSync(resolve(root,'.test-build/isolation/ssr.mjs'),'utf8');assert.doesNotMatch(code,/_work[\/]/);assert.match(code,/typeof document/);const {IsolatedView}=await import(pathToFileURL(resolve(root,'.test-build/isolation/ssr.mjs')).href);const React=await import('../../node_modules/react/index.js');const {renderToString}=await import('../../node_modules/react-dom/server.js');assert.match(renderToString(React.createElement(IsolatedView)),/未同步/)
})
test('offline Chromium renders real Bot, pose freeze, and visible unsynced fallback',async t=>{
 const {chromium}=await import('../../node_modules/playwright-core/index.mjs')
 let browser;try{browser=await chromium.launch({executablePath:'D:/百分/CentBrowser/Application/chrome.exe',headless:true})}catch(error){t.skip('Chromium unavailable: '+error.message);return}
 try{
  const page=await browser.newPage();await page.clock.install();
   // The Playwright virtual clock may return fractional Date.now(); the real Date.now() and bridge timestamps are integers.
   await page.addInitScript({content:"const clockNow=Date.now.bind(Date);Date.now=()=>Math.trunc(clockNow());"})
  const html=readFileSync(resolve(root,'.test-build/isolation/index.html'),'utf8'),script=readFileSync(resolve(root,'.test-build/isolation/app.js'),'utf8'),beacon=readFileSync(resolve(root,'.test-build/isolation/owner.js'),'utf8'),meta=JSON.parse(readFileSync(resolve(root,'.test-build/isolation/build-meta.json'),'utf8'))
  await page.route('**/*',route=>{const u=route.request().url();if(u===childOrigin+'/index.html')return route.fulfill({contentType:'text/html',body:html});if(u===childOrigin+'/app.js')return route.fulfill({contentType:'text/javascript',body:script});if(u===childOrigin+'/owner.js')return route.fulfill({contentType:'text/javascript',body:beacon});if(u===parentOrigin+'/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0}iframe{width:100%;height:100vh;border:0}</style><iframe src="'+childOrigin+'/index.html"></iframe>'});return route.abort()})
  await page.goto(parentOrigin+'/')
  const frame=page.frameLocator('iframe');await assert.doesNotReject(()=>frame.getByRole('status').waitFor())
  await page.evaluate(({childOrigin,row,ui,meta})=>{
   const target=document.querySelector('iframe').contentWindow,nonce='a'.repeat(32),epoch='b'.repeat(32);window.ownerVerified=false;window.acked=false
   window.addEventListener('message',e=>{if(e.source!==target||e.origin!==childOrigin)return;if(e.data.kind==='G2_OWNER'&&e.data.capability===meta.capability)window.ownerVerified=true;if(e.data.kind==='ACK'&&e.data.seq===1)window.acked=true;if(e.data.kind==='HELLO'&&window.ownerVerified)target.postMessage({v:1,kind:'INIT',nonce,epoch},childOrigin);if(e.data.kind==='READY')target.postMessage({v:1,kind:'SNAPSHOT',nonce,epoch,seq:1,sentAt:Date.now(),rows:[{...row,pose:true,isChild:true,childCount:2}],ui},childOrigin)})
  },{childOrigin,row,ui,meta})
  await frame.locator('article[data-pose="true"] svg').first().waitFor({timeout:5000});assert.equal(await page.evaluate(()=>window.ownerVerified&&window.acked),true)
  assert.equal(await frame.locator('article').count(),1)
  assert.equal(await frame.locator('article').getAttribute('data-activity'),'idle')
  assert.match(await frame.locator('article strong').innerText(),/└/)
  assert.match(await frame.locator('article').innerText(),/×2 子代理/)
  assert.equal(await frame.locator('article svg').count(),2) // second SVG is a frozen child badge
  const one=await frame.locator('article').evaluate(card=>{const rect=selector=>card.querySelector(selector).getBoundingClientRect();return {bot:rect('.isolation-bot svg'),title:rect('strong'),status:rect('.isolation-status'),children:rect('.isolation-children')}})
  assert.ok(one.title.top>=one.bot.top+one.bot.height*.8&&one.title.bottom<=one.status.top+2&&one.status.bottom<=one.children.top+2,'portrait, title, status, children stack in that order '+JSON.stringify(one))
  assert.ok(Math.abs(one.status.width-one.children.width)<=1,'status and child-count capsules must have equal width')
  await page.setViewportSize({width:300,height:600})
  assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth<=300),true)
  await page.evaluate(({childOrigin,row,ui})=>{const target=document.querySelector('iframe').contentWindow;target.postMessage({v:1,kind:'SNAPSHOT',nonce:'a'.repeat(32),epoch:'b'.repeat(32),seq:2,sentAt:Date.now(),rows:Array.from({length:9},(_,i)=>({...row,id:(i+1).toString(16).padStart(32,'0'),name:i?'监控 '+(i+1):'当前会话',pose:false,childCount:i%2?0:2,activity:i===0?'idle':i===1?'error':i===2?'waiting':i===3?'done':'reading'})),ui:{...ui,cols:3,rows:3,canvas:'#e8dfc8'}},childOrigin)},{childOrigin,row,ui})
  await frame.locator('article').nth(8).waitFor({timeout:3000})
  assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth<=300),true)
  assert.ok(await frame.locator('article').evaluateAll(cards=>cards.every(card=>{const box=card.getBoundingClientRect(),status=card.querySelector('.isolation-status').getBoundingClientRect(),children=card.querySelector('.isolation-children')?.getBoundingClientRect();return status.left>=box.left&&status.right<=box.right&&(!children||Math.abs(status.width-children.width)<=1&&children.bottom<=box.bottom)})),'nine narrow cells retain equal-width badges inside their cards')
  assert.equal(await frame.locator('article .isolation-children').count(),5,'cells with no children omit the third capsule')
  const levels=await frame.locator('article').evaluateAll(cards=>cards.slice(0,2).map(card=>({title:card.querySelector('.isolation-title').getBoundingClientRect().top,status:card.querySelector('.isolation-status').getBoundingClientRect().top})))
  assert.ok(Math.abs(levels[0].title-levels[1].title)<=1&&Math.abs(levels[0].status-levels[1].status)<=1,'hidden child capsule keeps title and status baselines fixed')
  assert.deepEqual(await frame.locator('article').evaluateAll(cards=>cards.slice(0,5).map(card=>getComputedStyle(card.querySelector('.isolation-activity-dot')).backgroundColor)),['rgb(141, 182, 160)','rgb(224, 86, 63)','rgb(240, 180, 41)','rgb(90, 169, 230)','rgb(90, 169, 230)'],'idle/error/waiting/done/other lamps keep green/red/amber/blue colors')
  assert.deepEqual(await frame.locator('article').evaluateAll(cards=>cards.map(card=>getComputedStyle(card.querySelector('.isolation-activity-dot')).animationName)),['none','status-lamp-breathe','status-lamp-breathe','status-lamp-breathe',...Array(5).fill('none')],'only error/waiting/done lamps breathe')
  assert.ok(await frame.locator('article').evaluateAll(cards=>cards.every(card=>getComputedStyle(card.querySelector('.isolation-status')).animationName==='none')),'status capsules and other UI never breathe')
  await page.emulateMedia({reducedMotion:'reduce'})
  assert.ok(await frame.locator('article').evaluateAll(cards=>cards.every(card=>getComputedStyle(card.querySelector('.isolation-activity-dot')).animationName==='none')),'reduced-motion disables all lamp animation')
  await page.emulateMedia({reducedMotion:'no-preference'})
  assert.deepEqual(await frame.locator('article').evaluateAll(cards=>cards.map(card=>getComputedStyle(card).backgroundColor)),Array(9).fill('rgb(232, 223, 200)'))
  assert.ok(await frame.locator('article svg path[fill="#e8dfc8"]').count()>0,'Bot paper/depth mask must use same safe canvas color')
  assert.deepEqual(await frame.locator('article').first().evaluate(card=>[getComputedStyle(card).backgroundColor,getComputedStyle(card.querySelector('.isolation-status')).backgroundColor,getComputedStyle(card.querySelector('.isolation-children')).backgroundColor]),Array(3).fill('rgb(232, 223, 200)'),'both capsules reuse the exact sampled beige canvas')
  const palette=[['encre','#0a0a0c'],['brun','#8b5e3c'],['rouge','#e8483f'],['orange','#f08a24'],['ambre','#f0b429'],['vert','#3ecf8e'],['turquoise','#2fbfa0'],['bleu','#3b93f0'],['violet','#8b5cf6'],['rose','#e152b0'],['gris','#a3a3a3'],['creme','#f1efe9']]
  for(const [index,[color,hex]] of palette.entries()){
   await page.evaluate(({childOrigin,row,ui,color,seq})=>{document.querySelector('iframe').contentWindow.postMessage({v:1,kind:'SNAPSHOT',nonce:'a'.repeat(32),epoch:'b'.repeat(32),seq,sentAt:Date.now(),rows:[{...row,pose:false,isChild:false,childCount:0,look:{...row.look,color}}],ui:{...ui,cols:1,rows:1,canvas:'#e8dfc8'}},childOrigin)},{childOrigin,row,ui,color,seq:index+3})
   try{await frame.locator('article svg rect[fill="'+hex+'"]').first().waitFor({state:'attached',timeout:3000})}
   catch(error){const current=await frame.locator('article').first().evaluate(el=>({activity:el.getAttribute('data-activity'),fills:[...el.querySelectorAll('svg rect')].map(node=>node.getAttribute('fill'))})).catch(()=>null);throw new Error('palette '+color+' expected '+hex+' but saw '+JSON.stringify(current),{cause:error})}
  }
  await page.setViewportSize({width:565,height:1248})
  await page.evaluate(({childOrigin,row,ui})=>{document.querySelector('iframe').contentWindow.postMessage({v:1,kind:'SNAPSHOT',nonce:'a'.repeat(32),epoch:'b'.repeat(32),seq:15,sentAt:Date.now(),rows:Array.from({length:6},(_,i)=>({...row,id:(i+1).toString(16).padStart(32,'0'),pose:false,childCount:i%2?0:2,look:{...row.look,size:260}})),ui:{...ui,cols:2,rows:3,canvas:'#e8dfc8'}},childOrigin)},{childOrigin,row,ui})
  await frame.locator('article').nth(8).waitFor({state:'detached',timeout:5000})
  const spacious=await frame.locator('article').evaluateAll(cards=>cards.map(card=>{const cell=card.getBoundingClientRect(),title=card.querySelector('.isolation-title').getBoundingClientRect(),status=card.querySelector('.isolation-status').getBoundingClientRect(),slot=card.querySelector('.isolation-count-slot').getBoundingClientRect();return {rise:card.dataset.spacious,offset:getComputedStyle(card.querySelector('.isolation-title')).transform,title:title.top-cell.top,gap:status.top-title.bottom,countVisible:!!card.querySelector('.isolation-children'),slotBottom:slot.bottom-cell.top,cardHeight:cell.height}}))
  assert.equal(spacious.length,6)
  assert.ok(spacious.every(card=>card.rise==='true'&&card.offset==='matrix(1, 0, 0, 1, 0, -40)'&&card.title>=240&&card.title<=290&&Math.abs(card.gap-8)<=2&&card.slotBottom<card.cardHeight),'six-card titles rise to screenshot red line while pills remain inside cells: '+JSON.stringify(spacious))
  assert.ok(Math.abs(spacious[0].title-spacious[1].title)<=1&&spacious[0].countVisible&&!spacious[1].countVisible,'mixed child counts keep side-by-side titles level')
  await page.clock.fastForward(13000)
  await frame.getByRole('status').waitFor({timeout:3000})
  assert.match(await frame.getByRole('status').innerText(),/未同步/)
 }finally{await browser.close()}
})
