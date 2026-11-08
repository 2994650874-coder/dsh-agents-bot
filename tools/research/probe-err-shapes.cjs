const fs=require('node:fs');const path=require('node:path');
const HOME=process.env.USERPROFILE;const SESS=path.join(HOME,'.dsh','sessions');
const ZSTD=path.join(HOME,'.dsh','profiles','desktop','node_modules','dsh-chat-export','src','zstd.js');
(async()=>{
const {scanZstdFrames}=await import('file://'+ZSTD.replace(/\\/g,'/'));
const {zstdDecompressSync}=require('node:zlib');
let turnErr=null, attErr=null, compErr=null, toolErrMsg=null;
function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const e of es){const p=path.join(d,e.name);if(e.isDirectory()){walk(p);continue}
if(!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name))continue;
let buf;try{buf=fs.readFileSync(p)}catch{continue}
let text='';try{const fr=scanZstdFrames(buf);const parts=[];for(const f of fr.frames){try{parts.push(zstdDecompressSync(buf.subarray(f.start,f.end)).toString('utf8'))}catch{}}text=parts.join('')}catch{continue}
for(const line of text.split('\n')){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch{continue}
const t=o.type;
if(t==='turn/end'&&o.data?.reason?.kind==='error'&&!turnErr)turnErr=JSON.stringify(o).slice(0,600);
if(t==='assistant/attempt'&&!attErr){for(const ch of o.data?.stream??[]){if(ch.chunk?.type==='finish'&&ch.chunk.reason?.kind==='error'){attErr=JSON.stringify(ch.chunk.reason).slice(0,600)}}}
if(t==='compaction/end'&&o.data?.error&&!compErr)compErr=JSON.stringify(o.data).slice(0,400);
if(t==='tool/result'&&o.data?.message?.isError===true&&!toolErrMsg)toolErrMsg=JSON.stringify(o.data.message).slice(0,500);
}}}
walk(SESS);
console.log('=== turn/end error\n'+(turnErr??'(无)'));
console.log('\n=== assistant finish error\n'+(attErr??'(无)'));
console.log('\n=== compaction/end error\n'+(compErr??'(无)'));
console.log('\n=== tool/result isError 样本\n'+(toolErrMsg??'(无)'));
})().catch(e=>{console.error(e);process.exit(1)})
