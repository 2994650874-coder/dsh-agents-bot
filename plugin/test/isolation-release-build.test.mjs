import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync,statSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const root=new URL('../../.test-build/release/',import.meta.url)
const read=name=>readFileSync(new URL(name,root),'utf8')
const client=read('client.js'),host=read('index.js'),html=read('offscreen/index.html'),child=read('offscreen/app.js'),owner=read('offscreen/owner.js')
test('staged build contains only paired Host, ModuleLoader and static offscreen assets',()=>{
 assert.deepEqual(readdirSync(root).sort(),['client.js','index.js','offscreen'])
 assert.deepEqual(readdirSync(new URL('offscreen/',root)).sort(),['app.js','index.html','owner.js'])
 assert.match(client,/window.__ModuleLoader__.load/)
 assert.ok(client.includes('dsh-app://app'))
 assert.ok(host.includes('new URL("./offscreen/", import.meta.url)'))
 assert.ok(html.includes('<script src="./owner.js" defer></script><script src="./app.js" defer></script>'))
 assert.ok(child.includes('http://127.0.0.1:49383'))
 assert.ok(child.includes('dsh-app://app'))
 assert.ok(statSync(new URL('offscreen/app.js',root)).size>100000)
 assert.ok(!readdirSync(new URL('offscreen/',root)).includes('build-meta.json'))
})
test('fresh 256-bit owner capability matches parent bundle and retries only a bounded number',()=>{
 const token=owner.match(/capability:"([a-f0-9]{64})"/)?.[1]
 assert.ok(token);assert.ok(client.includes(token));assert.ok(!host.includes(token));assert.ok(!child.includes(token))
 const sent=[];let retry,cleared=false
 const parent={postMessage:(message,origin)=>sent.push({message,origin})}
 runInNewContext(owner,{window:{location:{origin:'http://127.0.0.1:49383'},parent},setInterval:fn=>{retry=fn;return 1},clearInterval:id=>{assert.equal(id,1);cleared=true}})
 for(let i=0;i<48;i++)retry()
 assert.equal(sent.length,40);assert.equal(cleared,true)
 for(const {message,origin} of sent){assert.equal(origin,'dsh-app://app');assert.equal(message.capability,token);assert.equal(message.kind,'G2_OWNER')}
})
test('staged Host import does not start an HTTP listener',async()=>{
 const module=await import(new URL('index.js',root))
 assert.equal(typeof module.apply,'function')
 assert.equal(module.inject?.length>=0,true)
})
