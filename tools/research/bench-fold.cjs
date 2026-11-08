// 量一下「投影折叠」本身有多贵：把本机全部事件按提案里的 apply 跑一遍，计时。
const fs=require('node:fs');const path=require('node:path');
const HOME=process.env.USERPROFILE;const SESS=path.join(HOME,'.dsh','sessions');
const ZSTD=path.join(HOME,'.dsh','profiles','desktop','node_modules','dsh-chat-export','src','zstd.js');

// 提案里的折叠逻辑（未接线的草稿）
function init(){return {tool:null,toolSince:0,lastErrorAt:0,compacting:false,jobs:0,lastToolOkAt:0}}
function apply(s,e){
  switch(e.type){
    case 'tool/call': {
      if(s.tool!==null) return s; // 已经在跑一个，忽略并发
      return {...s,tool:e.data.name,toolSince:e.time}
    }
    case 'tool/result': {
      const err=e.data.message?.isError===true;
      const next={...s,tool:null,lastToolOkAt:err?s.lastToolOkAt:e.time}
      if(err) next.lastErrorAt=e.time
      return next
    }
    case 'compaction/start': return {...s,compacting:true}
    case 'compaction/end': {
      const next={...s,compacting:false}
      if(e.data?.error!==undefined) next.lastErrorAt=e.time
      return next
    }
    case 'job/registered': return {...s,jobs:s.jobs+1}
    case 'job/settled': return {...s,jobs:Math.max(0,s.jobs-1)}
    case 'turn/end': {
      const k=e.data?.reason?.kind
      if(k==='error') return {...s,lastErrorAt:e.time}
      if(k==='aborted') return {...s,lastErrorAt:e.time}
      return s
    }
    case 'assistant/attempt': {
      for(const ch of e.data?.stream??[]) if(ch.chunk?.type==='finish'&&ch.chunk.reason?.kind==='error') return {...s,lastErrorAt:e.time}
      return s
    }
    default: return s
  }
}

(async()=>{
const {scanZstdFrames}=await import('file://'+ZSTD.replace(/\\/g,'/'));
const {zstdDecompressSync}=require('node:zlib');
const all=[];
function walk(d){let es;try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
for(const e of es){const p=path.join(d,e.name);if(e.isDirectory()){walk(p);continue}
if(!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name))continue;
let buf;try{buf=fs.readFileSync(p)}catch{continue}
let text='';try{const fr=scanZstdFrames(buf);const parts=[];for(const f of fr.frames){try{parts.push(zstdDecompressSync(buf.subarray(f.start,f.end)).toString('utf8'))}catch{}}text=parts.join('')}catch{continue}
for(const line of text.split('\n')){if(!line.trim())continue;let o;try{o=JSON.parse(line)}catch{continue}all.push(o)}
}}
walk(SESS);
console.log('事件总数',all.length);

// 热身后计时
for(let i=0;i<3;i++){let s=init();for(const e of all)s=apply(s,e)}
const runs=10;const t0=process.hrtime.bigint();
for(let i=0;i<runs;i++){let s=init();for(const e of all)s=apply(s,e)}
const t1=process.hrtime.bigint();
const totalMs=Number(t1-t0)/1e6/runs;
console.log(`折叠 ${all.length} 条事件耗时 ${totalMs.toFixed(2)} ms（${runs} 次平均）`);
console.log(`每条事件 ${(totalMs*1000/all.length).toFixed(2)} 微秒`);

// 单事件最坏情况（含对象展开）
const t2=process.hrtime.bigint();
let s=init();
for(let i=0;i<100000;i++) s=apply(s,{type:'tool/call',time:i,data:{name:'read'}});
const t3=process.hrtime.bigint();
console.log(`纯 tool/call 10 万次 ${(Number(t3-t2)/1e6).toFixed(1)} ms`);
})().catch(e=>{console.error(e);process.exit(1)})
