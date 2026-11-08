import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {EventEmitter} from 'node:events'
import {join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {transform}=require('../../node_modules/esbuild')
const src=readFileSync(new URL('../src/host/isolationStatic.ts',import.meta.url),'utf8')
const compiled=await transform(src,{loader:'ts',format:'esm',target:'node20'})
// Compile in-memory only: never touch plugin/lib. Emulate import.meta.url after future Host bundling.
const futureUrl=pathToFileURL(fileURLToPath(new URL('../lib/index.js',import.meta.url))).href
const js=compiled.code.replaceAll('import.meta.url',JSON.stringify(futureUrl))
const {ISOLATION_PORT,ISOLATION_ORIGIN,DEFAULT_ISOLATION_ASSETS,isolationStaticVerdict,createIsolationStaticServer,registerIsolationStatic}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const host='127.0.0.1:49383'
const assetDir=fileURLToPath(new URL('../src/client/',import.meta.url))
function response(){return {code:null,headers:null,body:null,writeHead(code,headers){this.code=code;this.headers=headers},end(body){this.body=body}}}
function fakeServer(){const server=new EventEmitter();server.listening=false;server.calls=[];server.closeCount=0;server.listen=(port,address)=>{server.calls.push([port,address]);return server};server.close=()=>{server.closeCount++;server.listening=false;return server};return server}
function handlerOf(assetDir,readAsset){let handler;const server=createIsolationStaticServer({assetDir,readAsset,createServer:fn=>{handler=fn;return fakeServer()}});return {server,invoke:(method,url,hostValue=host)=>{const res=response();handler({method,url,headers:{host:hostValue}},res);return res}}}

test('no import-time listener and future lib/offscreen path, fixed origin',()=>{
 assert.equal(ISOLATION_PORT,49383);assert.equal(ISOLATION_ORIGIN,'http://'+host)
 assert.equal(DEFAULT_ISOLATION_ASSETS,fileURLToPath(new URL('../lib/offscreen/',import.meta.url)))
 assert.equal(createIsolationStaticServer({assetDir}).listening,false)
 assert.ok(!src.includes("from './index'"))
})
test('reject exact Host, method, traversal, encoding, query and unlisted paths',()=>{
 for(const path of ['/','/app.js','/owner.js'])assert.equal(isolationStaticVerdict('GET',path,host),200)
 for(const h of ['localhost:49383','127.0.0.1','127.0.0.1:49383.evil','[::1]:49383','evil.test:49383'])assert.equal(isolationStaticVerdict('GET','/',h),403)
 for(const method of ['POST','HEAD','OPTIONS','PUT'])assert.equal(isolationStaticVerdict(method,'/',host),405)
 for(const path of ['/index.html','/app.js?x=1','/?x=1','/owner.js#x','/%2e%2e/','/../app.js','//app.js','/app.js/../owner.js','/APP.JS'])assert.equal(isolationStaticVerdict('GET',path,host),404)
})
test('serve only injected static assets with no-store, nosniff and restrictive CSP',()=>{
 const seen=[];const {server,invoke}=handlerOf(assetDir,path=>{seen.push(path);if(path.endsWith('owner.js'))throw Error('missing owner');return Buffer.from(path.endsWith('index.html')?'<html>fixture page</html>'.repeat(10):'// fixture app'.repeat(20))});assert.equal(server.listening,false)
 for(const path of ['/','/app.js']){const res=invoke('GET',path);assert.equal(res.code,200);assert.ok(res.body.byteLength>100);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.headers['X-Content-Type-Options'],'nosniff');assert.match(res.headers['Content-Security-Policy'],/connect-src 'none'/);assert.ok(res.headers['Content-Security-Policy'].includes('frame-ancestors dsh-app://app'))}
 assert.equal(invoke('GET','/owner.js').code,503) // missing optional owner asset fails closed, never leaks another file
 for(const path of ['/app.js?x=1','/../app.js']){const res=invoke('GET',path);assert.equal(res.code,404);assert.equal(res.headers['Cache-Control'],'no-store')}
 assert.equal(invoke('GET','/','localhost:49383').code,403)
 assert.deepEqual(seen,[join(assetDir,'index.html'),join(assetDir,'app.js'),join(assetDir,'owner.js')])
})
test('effect-only activation binds fixed interface, EADDRINUSE fails without fallback',()=>{
 const effects=[];const fake=fakeServer();const errors=[]
 registerIsolationStatic({effect:(fn,label)=>effects.push({fn,label})},{assetDir,createServer:()=>fake,onError:error=>errors.push(error)})
 assert.equal(fake.calls.length,0);assert.equal(effects.length,1)
 const dispose=effects[0].fn();assert.deepEqual(fake.calls,[[49383,'127.0.0.1']])
 const busy=Object.assign(new Error('occupied'),{code:'EADDRINUSE'});fake.emit('error',busy)
 assert.deepEqual(errors,[busy]);assert.equal(fake.calls.length,1);assert.equal(fake.closeCount,0)
 dispose();assert.equal(fake.closeCount,1)
 fake.emit('error',busy);assert.equal(errors.length,1)
})
test('dispose before listening acknowledgement closes pending listener, later dispose is safe',()=>{
 const effects=[];const fake=fakeServer()
 registerIsolationStatic({effect:fn=>effects.push(fn)},{createServer:()=>fake})
 const dispose=effects[0]();assert.equal(fake.listening,false)
 dispose();assert.equal(fake.closeCount,1)
 fake.emit('listening');assert.equal(fake.listening,false);assert.equal(fake.calls.length,1) // late notification cannot restore a listener
})
