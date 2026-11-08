/** Offline parent compilation only. Never writes plugin/lib or activates the Host. */
import {createRequire} from 'node:module'
import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const require=createRequire(import.meta.url)
const {build}=require('../node_modules/esbuild')
const meta=JSON.parse(readFileSync(new URL('../.test-build/isolation/build-meta.json',import.meta.url),'utf8'))
if(meta.childOrigin!=='http://127.0.0.1:49383'||meta.parentOrigin!=='dsh-app://app'||!/^[a-f0-9]{64}$/.test(meta.capability))throw Error('child build owner pin or Desktop origin unverified')
const PLATFORM=['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/cordis','zod','@tanstack/react-virtual','@deepseek-ai/dsh-client-store','@deepseek-ai/dsh-client-ui-slots','@deepseek-ai/dsh-client-ui-primitives','@deepseek-ai/dsh-client-ui-dockkit']
const result=await build({entryPoints:[fileURLToPath(new URL('../plugin/src/client/index.tsx',import.meta.url))],bundle:true,write:false,format:'cjs',platform:'browser',target:'chrome120',jsx:'automatic',charset:'utf8',external:PLATFORM,define:{__BOT_ISOLATION_CAPABILITY__:JSON.stringify(meta.capability),__BOT_ISOLATION_PARENT_ORIGIN__:JSON.stringify(meta.parentOrigin)}})
writeFileSync(new URL('../.test-build/isolation-parent.js',import.meta.url),result.outputFiles[0].text)
console.log('Compiled source-only parent with same owner build as isolated child; no plugin/lib write.')
