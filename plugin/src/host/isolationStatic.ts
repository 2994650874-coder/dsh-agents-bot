/** Candidate static offscreen Host only. Not imported by host/index.ts and never starts on import. */
import {createServer, type Server, type IncomingMessage, type ServerResponse} from 'node:http'
import {readFileSync} from 'node:fs'
import {resolve, sep} from 'node:path'
import {fileURLToPath} from 'node:url'

export const ISOLATION_PORT = 49383
export const ISOLATION_ORIGIN = 'http://127.0.0.1:49383'
const HOST = '127.0.0.1:49383'
const ASSETS = Object.freeze({'/':'index.html','/app.js':'app.js','/owner.js':'owner.js'})
export const DEFAULT_ISOLATION_ASSETS = fileURLToPath(new URL('./offscreen/',import.meta.url))

/** No URL parsing/normalization: query, percent escapes, slash tricks and traversals are rejected. */
export function isolationStaticVerdict(method: string | undefined, url: string | undefined, host: string | undefined): number {
  if(host!==HOST)return 403
  if(method!=='GET')return 405
  return Object.prototype.hasOwnProperty.call(ASSETS,url ?? '')?200:404
}
export type IsolationStaticOptions = {assetDir?: string;readAsset?:(path:string)=>Buffer;onError?:(error: Error)=>void;createServer?: typeof createServer}

/** Factory returns an UNBOUND server. Asset root is lib/offscreen relative to future lib/index.js. */
export function createIsolationStaticServer(options: IsolationStaticOptions = {}): Server {
  const assetDir=resolve(options.assetDir ?? DEFAULT_ISOLATION_ASSETS)
  const factory=options.createServer ?? createServer
  return factory((req: IncomingMessage,res: ServerResponse)=>{
    const verdict=isolationStaticVerdict(req.method,req.url,req.headers.host)
    if(verdict!==200){res.writeHead(verdict,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end('not available');return}
    const name=ASSETS[req.url as keyof typeof ASSETS]
    // Whitelist is already exact; this second boundary protects against later map edits.
    const full=resolve(assetDir,name)
    if(!full.startsWith(assetDir+sep)){res.writeHead(503,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end('asset unavailable');return}
    let body: Buffer
    try{body=(options.readAsset ?? readFileSync)(full)}catch{res.writeHead(503,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end('asset unavailable');return}
    res.writeHead(200,{
      'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8',
      'Content-Length':body.byteLength,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors dsh-app://app",
      'Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'cross-origin'
    })
    res.end(body)
  })
}

/** Explicit opt-in for a future Host apply; caller must invoke this under ctx.effect. */
export function registerIsolationStatic(ctx: {effect:(callback:()=>()=>void,description:string)=>unknown},options: IsolationStaticOptions = {}): void {
  ctx.effect(()=>{
    const server=createIsolationStaticServer(options)
    let disposed=false
    server.on('error',(error: Error)=>{
      if(disposed)return
      // EADDRINUSE and every other bind error fail closed: no alternate port or kill.
      options.onError?.(error)
      if(server.listening)server.close()
    })
    server.listen(ISOLATION_PORT,'127.0.0.1')
    return ()=>{
      disposed=true
      // close() is valid even while listen() has not emitted 'listening'.
      try{server.close()}catch(error){if((error as NodeJS.ErrnoException).code!=='ERR_SERVER_NOT_RUNNING')throw error}
    }
  },'offscreen static loopback lifecycle')
}
