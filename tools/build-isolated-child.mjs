import {createRequire} from 'node:module'
import {mkdirSync,copyFileSync,writeFileSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../',import.meta.url))
const require=createRequire(import.meta.url)
const {build}=require('../node_modules/esbuild')
const options=Object.fromEntries(process.argv.slice(2).map(arg=>{const match=/^--(child-origin|parent-origin)=(.+)$/.exec(arg);if(!match)throw Error('expected --child-origin=... --parent-origin=...');return [match[1],match[2]]}))
function origin(value){if(!value||value==='null'||value==='*'||!/^[a-z][a-z0-9+.-]*:\/\/[^\/?#@\s]+$/i.test(value)||(/^https?:/i.test(value)&&new URL(value).origin!==value))throw Error('exact pinned origin required');return value}
const child=origin(options['child-origin']),parent=origin(options['parent-origin'])
if(child===parent)throw Error('child and parent MUST have different origins')
const out=resolve(root,'.test-build/isolation');mkdirSync(out,{recursive:true})
await build({entryPoints:[resolve(root,'plugin/src/isolation/main.jsx')],bundle:true,platform:'browser',format:'iife',target:'chrome120',jsx:'automatic',outfile:resolve(out,'app.js'),charset:'utf8',minify:true,define:{__CHILD_ORIGIN__:JSON.stringify(child),__PARENT_ORIGIN__:JSON.stringify(parent)}})
copyFileSync(resolve(root,'plugin/src/isolation/index.html'),resolve(out,'index.html'))
const capability=randomBytes(32).toString('hex')
writeFileSync(resolve(out,'owner.js'),`(()=>{const capability=${JSON.stringify(capability)},origin=${JSON.stringify(parent)};if(window.parent===window)return;let tries=0;const send=()=>{if(tries++>=40){clearInterval(timer);return}window.parent.postMessage({v:1,kind:'G2_OWNER',capability},origin)};const timer=setInterval(send,250);send()})()`)
writeFileSync(resolve(out,'build-meta.json'),JSON.stringify({v:1,childOrigin:child,parentOrigin:parent,capability},null,2))
console.log('Isolated test-only child built: '+out+' (no plugin/lib/profile/server touched)')
