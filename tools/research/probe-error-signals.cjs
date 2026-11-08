const fs=require('node:fs');const path=require('node:path');
const HOME=process.env.USERPROFILE;const SESS=path.join(HOME,'.dsh','sessions');
const ZSTD=path.join(HOME,'.dsh','profiles','desktop','node_modules','dsh-chat-export','src','zstd.js');
(async()=>{
const {scanZstdFrames}=await import('file://'+ZSTD.replace(/\\/g,'/'));
const {zstdDecompressSync}=require('node:zlib');
const turnEnd=new Map(), jobSettled=new Map(), finish=new Map(), compErr=new Map();
let attemptErr=0, toolErr=0, toolOk=0;
function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const e of es){const p=path.join(d,e.name);if(e.isDirectory()){walk(p);continue}
if(!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name))continue;
let buf;try{buf=fs.readFileSync(p)}catch{continue}
let text='';try{const fr=scanZstdFrames(buf);const parts=[];for(const f of fr.frames){try{parts.push(zstdDecompressSync(buf.subarray(f.start,f.end)).toString('utf8'))}catch{}}text=parts.join('')}catch{continue}
for(const line of text.split('\n')){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch{continue}
const t=o.type;
if(t==='turn/end'){const k=o.data?.reason?.kind??'(none)';turnEnd.set(k,(turnEnd.get(k)??0)+1)}
if(t==='job/settled'){const k=o.data?.status??'(none)';jobSettled.set(k,(jobSettled.get(k)??0)+1)}
if(t==='assistant/attempt'){for(const ch of o.data?.stream??[]){if(ch.chunk?.type==='finish'){const k=ch.chunk.reason?.kind??'(none)';finish.set(k,(finish.get(k)??0)+1);if(k==='error')attemptErr++}}}
if(t==='compaction/end'){const k=o.data?.error===undefined?'ok':'has-error';compErr.set(k,(compErr.get(k)??0)+1)}
if(t==='tool/result'){o.data?.message?.isError?toolErr++:toolOk++}
}}}
walk(SESS);
const show=(n,m)=>console.log('\n=== '+n+'\n'+[...m.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>String(v).padStart(7)+'  '+k).join('\n'));
show('turn/end reason.kind',turnEnd);
show('job/settled status',jobSettled);
show('assistant finish reason.kind',finish);
show('compaction/end error',compErr);
console.log('\ntool/result: isError=true '+toolErr+' / false '+toolOk);
})().catch(e=>{console.error(e);process.exit(1)})
