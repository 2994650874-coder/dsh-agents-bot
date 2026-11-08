const fs=require('node:fs');const path=require('node:path');
const HOME=process.env.USERPROFILE;const SESS=path.join(HOME,'.dsh','sessions');
const ZSTD=path.join(HOME,'.dsh','profiles','desktop','node_modules','dsh-chat-export','src','zstd.js');
(async()=>{
const {scanZstdFrames}=await import('file://'+ZSTD.replace(/\\/g,'/'));
const {zstdDecompressSync}=require('node:zlib');
let withTC=0, withoutTC=0, kinds=new Map(); const noTC=[];
function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const e of es){const p=path.join(d,e.name);if(e.isDirectory()){walk(p);continue}
if(!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name))continue;
let buf;try{buf=fs.readFileSync(p)}catch{continue}
let text='';try{const fr=scanZstdFrames(buf);const parts=[];for(const f of fr.frames){try{parts.push(zstdDecompressSync(buf.subarray(f.start,f.end)).toString('utf8'))}catch{}}text=parts.join('')}catch{continue}
for(const line of text.split('\n')){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch{continue}
if(o.type!=='job/registered')continue;
const d0=o.data||{};kinds.set(d0.kind,(kinds.get(d0.kind)||0)+1);
if(d0.toolCall)withTC++;else{withoutTC++;if(noTC.length<3)noTC.push(JSON.stringify(d0).slice(0,300))}
}}}
walk(SESS);
console.log('job/registered 带 toolCall:',withTC,' 不带:',withoutTC);
console.log('kind 分布:',[...kinds.entries()].map(([k,v])=>k+'='+v).join(' '));
console.log('\n不带 toolCall 的样本:\n'+(noTC.join('\n')||'(无)'));
})().catch(e=>{console.error(e);process.exit(1)})
