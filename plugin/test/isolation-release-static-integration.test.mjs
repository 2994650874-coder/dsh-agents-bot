import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:net'

// This bounded integration test uses the staged Host bundle and real loopback port only.
// Never invoke it while another process owns 49383; never kill an existing listener.
test('staged Host serves paired static assets and releases its listener',async()=>{
  // Fail closed if the live Desktop already owns this fixed port: never claim its response as ours.
  const probe=createServer()
  await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(49383,'127.0.0.1',resolve)})
  await new Promise((resolve,reject)=>probe.close(error=>error?reject(error):resolve()))
  const host=await import(new URL('../../.test-build/release/index.js',import.meta.url))
  let dispose
  host.apply({
    effect(start){dispose=start()},
    inject(){}
  })
  assert.equal(typeof dispose,'function')
  const origin='http://127.0.0.1:49383'
  try{
    let page
    for(let attempt=0;attempt<20;attempt++){
      try{page=await fetch(origin+'/',{signal:AbortSignal.timeout(1500)});break}
      catch(error){if(attempt===19)throw error;await new Promise(resolve=>setTimeout(resolve,50))}
    }
    assert.equal(page.status,200)
    assert.ok(page.headers.get('content-security-policy')?.includes('frame-ancestors dsh-app://app'))
    const html=await page.text()
    assert.match(html,/owner.js/)
    for(const asset of ['app.js','owner.js']){
      const res=await fetch(origin+'/'+asset,{signal:AbortSignal.timeout(1500)})
      assert.equal(res.status,200)
      assert.ok((await res.text()).length>100)
    }
    assert.equal((await fetch(origin+'/client.js',{signal:AbortSignal.timeout(1500)})).status,404)
  }finally{dispose()}
})
