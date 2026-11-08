const fs=require('node:fs');const path=require('node:path');
const HOME=process.env.USERPROFILE;const SESS=path.join(HOME,'.dsh','sessions');
const ZSTD=path.join(HOME,'.dsh','profiles','desktop','node_modules','dsh-chat-export','src','zstd.js');
(async()=>{
const {scanZstdFrames}=await import('file://'+ZSTD.replace(/\\/g,'/'));
const {zstdDecompressSync}=require('node:zlib');
const want=new Set(['job/registered','job/settled','compaction/start','compaction/end','compaction/prune','compaction/summary','command/run','command/done','assistant/attempt','deliverables/presented','tool/ptc-dispatch-start','agent/inbox/spliced','workspace/changes','turn/start','turn/end','session/title','model/selection','team/member','subagent/descriptor','permission/preset']);
const seen={};
function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const e of es){const p=path.join(d,e.name);if(e.isDirectory()){walk(p);continue}
if(!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name))continue;
let buf;try{buf=fs.readFileSync(p)}catch{continue}
let text='';try{const fr=scanZstdFrames(buf);const parts=[];for(const f of fr.frames){try{parts.push(zstdDecompressSync(buf.subarray(f.start,f.end)).toString('utf8'))}catch{}}text=parts.join('')}catch{continue}
for(const line of text.split('\n')){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch{continue}
const t=o.type;if(!want.has(t))continue;
if(seen[t]===undefined){seen[t]=[]}
if(seen[t].length<2)seen[t].push(JSON.stringify(o).slice(0,700));
}}}
walk(SESS);
for(const t of want){if(seen[t])console.log('\n=== '+t+'\n'+seen[t].join('\n'))}
})().catch(e=>{console.error(e);process.exit(1)})
