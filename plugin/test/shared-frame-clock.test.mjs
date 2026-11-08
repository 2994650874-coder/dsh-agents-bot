import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)))
const require=createRequire(import.meta.url)
const {build}=require('../../node_modules/esbuild')
const js=(await build({entryPoints:[resolve(root,'plugin/src/client/sharedFrameClock.ts')],bundle:true,write:false,platform:'node',format:'esm'})).outputFiles[0].text
const {subscribeSharedFrames,subscribeSharedPointer}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))

test('one overlay clock fans out frames and one pointer source, then releases every wakeup',()=>{
 const original=new Map(['performance','window','document','requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]))
 let now=0,nextId=1,peak=0
 const rafs=new Map(),timers=new Map(),windowListeners=new Map(),documentListeners=new Map()
 const eventTarget=map=>({
  addEventListener(type,callback){if(!map.has(type))map.set(type,new Set());map.get(type).add(callback)},
  removeEventListener(type,callback){map.get(type)?.delete(callback)}
 })
 const win=eventTarget(windowListeners),doc=eventTarget(documentListeners)
 win.setTimeout=(callback,ms)=>{const id=nextId++;timers.set(id,{callback,due:now+ms});peak=Math.max(peak,rafs.size+timers.size);return id}
 win.clearTimeout=id=>timers.delete(id)
 const flush=(millis)=>{
  now+=millis
  for(const [id,timer] of [...timers])if(timer.due<=now){timers.delete(id);timer.callback()}
  const due=[...rafs];rafs.clear()
  for(const [,callback] of due)callback(now)
  assert.ok(rafs.size+timers.size<=1,'at most one next rAF OR one sleeping timeout')
 }
 for(const [key,value] of Object.entries({performance:{now:()=>now},window:win,document:doc,
  requestAnimationFrame:callback=>{const id=nextId++;rafs.set(id,callback);peak=Math.max(peak,rafs.size+timers.size);return id},
  cancelAnimationFrame:id=>rafs.delete(id)}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true})
 try{
  const a=[],b=[]
  const stopA=subscribeSharedFrames('main-overlay-test',60,at=>a.push(at))
  const stopB=subscribeSharedFrames('main-overlay-test',60,at=>b.push(at))
  assert.equal(rafs.size,1,'two active Bots initially share one scheduled frame')
  for(let i=0;i<8;i++)flush(17)
  assert.deepEqual(a,b,'both independent engines receive the same display timestamp')
  assert.ok(a.length>=7,'both Bots remain animated rather than frozen')
  const nextA=a.length;stopA();flush(17)
  assert.equal(a.length,nextA,'unmounted Bot stops receiving frames')
  assert.ok(b.length>nextA,'remaining Bot continues')
  stopB();assert.equal(rafs.size+timers.size,0,'last Bot cancels scheduled work')
  flush(300);assert.equal(b.length,nextA+1,'no orphan callback after last unsubscribe')
  assert.equal(peak,1,'never two scheduled animation wakeups even with two Bots')
  const holdPointer=subscribeSharedPointer('rebind',()=>{})
  let stopOld,stopNew
  stopOld=subscribeSharedFrames('rebind',60,()=>{
   stopOld()
   stopNew=subscribeSharedFrames('rebind',60,()=>{})
  })
  flush(17)
  assert.equal(rafs.size+timers.size,1,'synchronous unmount/remount during a frame does not fork the chain')
  stopNew();holdPointer()
  assert.equal(rafs.size+timers.size,0,'strict-mode style rebind tears down completely')

  const gazeA=[],gazeB=[]
  const leaveA=subscribeSharedPointer('main-overlay-test',point=>gazeA.push({...point}))
  const leaveB=subscribeSharedPointer('main-overlay-test',point=>gazeB.push({...point}))
  assert.equal(windowListeners.get('pointermove')?.size,1,'two Bot gazes share one global pointermove listener')
  for(const callback of windowListeners.get('pointermove'))callback({pointerType:'mouse',clientX:100,clientY:200})
  assert.deepEqual(gazeA.at(-1),{x:100,y:200,seen:true})
  assert.deepEqual(gazeB.at(-1),gazeA.at(-1))
  for(const callback of windowListeners.get('pointermove'))callback({pointerType:'touch',clientX:999,clientY:999})
  assert.equal(gazeB.at(-1).x,100,'touch does not hijack gaze')
  for(const callback of documentListeners.get('pointerleave'))callback()
  assert.equal(gazeA.at(-1).seen,false,'pointerleave removes cursor ownership')
  leaveA()
  assert.equal(windowListeners.get('pointermove').size,1,'one remaining Bot retains shared listener')
  for(const callback of windowListeners.get('pointermove'))callback({pointerType:'mouse',clientX:300,clientY:400})
  assert.deepEqual(gazeB.at(-1),{x:300,y:400,seen:true},'second Bot keeps following after first unmounts')
  leaveB()
  assert.equal(windowListeners.get('pointermove').size,0,'last Bot removes global pointer listener')
  assert.equal(documentListeners.get('pointerleave').size,0,'last Bot removes pointerleave listener')

  const c=[],d=[]
  const stopC=subscribeSharedFrames('fps-test',45,at=>c.push(at))
  const stopD=subscribeSharedFrames('fps-test',45,at=>d.push(at))
  flush(17)
  assert.equal(rafs.size,0,'45fps cap sleeps between frames instead of polling every rAF')
  assert.equal(timers.size,1,'both Bots share the same due-time timer')
  flush(6)
  assert.deepEqual(c,d,'fps cap never drifts one Bot relative to the other')
  stopC();stopD()
  assert.equal(rafs.size+timers.size,0,'reduce-motion/unmount can stop the only wakeup')
 }finally{for(const [key,descriptor] of original){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}
})
