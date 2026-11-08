/** Display-only protocol v1. No DSH state, hooks, storage, or runtime _work dependencies. */
export const ACTIVITY = Object.freeze(['idle','thinking','reading','searching','running','writing','compacting','background','waiting','done','error','spawning','sleep'])
export const ANIMATION = Object.freeze(['idle','thinking','wink','search','wide','alert','notify','exclaim','bounce','hexagon','play','orbit','radar','progress','celebrate','loading','waking','sleeping','sending','receiving','uploading','burst','comet'])
const SHAPE=new Set(['cercle','galet','squircle','capsule','triangle','hexagone','nuage','goutte','bouclier','dome','arche','cylindre','gemme','cristal','oeuf'])
const COLOR=new Set(['encre','brun','rouge','orange','ambre','vert','turquoise','bleu','violet','rose','gris','creme'])
const EXPRESSION=new Set(['neutre','attentif','surpris','excite','heureux','hilare','colere','triste','effraye','mefiant','confus','curieux','fier','timide','blase','somnolent'])
const MAX_BYTES=16384, MAX_AGE_MS=12000, MAX_FUTURE_MS=1000
const owns=(x,k)=>Object.prototype.hasOwnProperty.call(x,k)
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype
const exact=(x,keys)=>obj(x)&&Object.keys(x).length===keys.length&&keys.every(k=>owns(x,k))
const integer=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi
const token=x=>typeof x==='string'&&/^[a-f0-9]{32}$/.test(x)
const origin=x=>typeof x==='string'&&x!=='null'&&x!=='*'&&/^[a-z][a-z0-9+.-]*:\/\/[^\/?#@\s]+$/i.test(x)&&(!/^https?:/i.test(x)||new URL(x).origin===x)
const look=x=>exact(x,['shape','color','expression','size'])&&SHAPE.has(x.shape)&&COLOR.has(x.color)&&EXPRESSION.has(x.expression)&&integer(x.size,16,512)
const rotation=x=>Array.isArray(x)&&x.length>=1&&x.length<=2&&x.every(i=>exact(i,['state','plays'])&&ANIMATION.includes(i.state)&&integer(i.plays,1,20))
const canvas=x=>typeof x==='string'&&/^#[a-f0-9]{6}$/i.test(x)
const ui=x=>(exact(x,['fps','dwellMs','rotation','cols','rows'])||(exact(x,['fps','dwellMs','rotation','cols','rows','canvas'])&&canvas(x.canvas)))&&[45,60,90,120].includes(x.fps)&&[0,1200,1600,3000].includes(x.dwellMs)&&integer(x.cols,1,3)&&integer(x.rows,1,3)&&exact(x.rotation,ACTIVITY)&&ACTIVITY.every(a=>rotation(x.rotation[a]))
const row=x=>exact(x,['id','name','activity','changedAt','isChild','childCount','look','pose'])&&token(x.id)&&(x.name==='当前会话'||/^监控 [2-9]$/.test(x.name))&&ACTIVITY.includes(x.activity)&&integer(x.changedAt,0,8640000000000000)&&typeof x.isChild==='boolean'&&integer(x.childCount,0,999)&&typeof x.pose==='boolean'&&look(x.look)
const snapshot=x=>exact(x,['v','kind','nonce','epoch','seq','sentAt','rows','ui'])&&x.v===1&&x.kind==='SNAPSHOT'&&token(x.nonce)&&token(x.epoch)&&integer(x.seq,1,Number.MAX_SAFE_INTEGER)&&integer(x.sentAt,0,8640000000000000)&&Array.isArray(x.rows)&&x.rows.length>=1&&x.rows.length<=9&&x.rows.every(row)&&new Set(x.rows.map(r=>r.id)).size===x.rows.length&&ui(x.ui)&&x.ui.cols*x.ui.rows>=x.rows.length
function bounded(value){try{const clone=structuredClone(value),json=JSON.stringify(clone);return typeof json==='string'&&new TextEncoder().encode(json).length<=MAX_BYTES?clone:null}catch{return null}}
export function validateSnapshot(value,now){const x=bounded(value);return x&&snapshot(x)&&integer(now,0,8640000000000000)&&x.sentAt<=now+MAX_FUTURE_MS&&now-x.sentAt<=MAX_AGE_MS?x:null}
const hello=x=>exact(x,['v','kind'])&&x.v===1&&x.kind==='HELLO'
const handshake=(x,kind)=>exact(x,['v','kind','nonce','epoch'])&&x.v===1&&x.kind===kind&&token(x.nonce)&&token(x.epoch)
const ack=x=>exact(x,['v','kind','nonce','epoch','seq'])&&x.v===1&&x.kind==='ACK'&&token(x.nonce)&&token(x.epoch)&&integer(x.seq,1,Number.MAX_SAFE_INTEGER)
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')
function endpoint(source,targetOrigin){if(!source||(typeof source!=='object'&&typeof source!=='function')||!origin(targetOrigin))throw Error('exact origin and window source required')}
/** Caller MUST rotate on iframe navigation/replacement; never provide raw session IDs or titles. */
export class ParentBridge{
 constructor({childSource,childOrigin,send,now=Date.now}){endpoint(childSource,childOrigin);if(typeof send!=='function'||typeof now!=='function')throw Error('send and clock required');Object.assign(this,{send,now});this.rotate(childSource,childOrigin)}
 rotate(childSource,childOrigin){endpoint(childSource,childOrigin);this.childSource=childSource;this.childOrigin=childOrigin;this.nonce=randomToken();this.epoch=randomToken();this.seq=0;this.lastAckSeq=0;this.lastAckAt=0;this.phase='hello';this.latest=null}
 publish(rows,settings){const data={v:1,kind:'SNAPSHOT',nonce:this.nonce,epoch:this.epoch,seq:1,sentAt:this.now(),rows,ui:settings};const clean=validateSnapshot(data,this.now());if(!clean)return false;this.latest={rows:clean.rows,ui:clean.ui};if(this.phase==='ready')this.flush();return true}
 flush(){if(!this.latest||this.seq===Number.MAX_SAFE_INTEGER)return false;const clean=validateSnapshot({v:1,kind:'SNAPSHOT',nonce:this.nonce,epoch:this.epoch,seq:this.seq+1,sentAt:this.now(),...this.latest},this.now());if(!clean)return false;this.send(this.childSource,clean,this.childOrigin);this.seq++;return true}
 receive(event){if(!event||event.source!==this.childSource||event.origin!==this.childOrigin)return false;const x=bounded(event.data);if(!x)return false;
  if(this.phase==='hello'&&hello(x)){this.phase='init';this.send(this.childSource,{v:1,kind:'INIT',nonce:this.nonce,epoch:this.epoch},this.childOrigin);return true}
  if(this.phase==='init'&&handshake(x,'READY')&&x.nonce===this.nonce&&x.epoch===this.epoch){this.phase='ready';this.flush();return true}
  if(this.phase==='ready'&&ack(x)&&x.nonce===this.nonce&&x.epoch===this.epoch&&x.seq>this.lastAckSeq&&x.seq<=this.seq){this.lastAckSeq=x.seq;this.lastAckAt=this.now();return true}
  if(this.phase==='ready'&&handshake(x,'RESYNC')&&x.nonce===this.nonce&&x.epoch===this.epoch){this.nonce=randomToken();this.epoch=randomToken();this.seq=0;this.lastAckSeq=0;this.lastAckAt=0;this.phase='init';this.send(this.childSource,{v:1,kind:'INIT',nonce:this.nonce,epoch:this.epoch},this.childOrigin);return true}
  return false
 }
}
export class ChildBridge{
 constructor({parentSource,parentOrigin,send,now=Date.now}){endpoint(parentSource,parentOrigin);if(typeof send!=='function'||typeof now!=='function')throw Error('send and clock required');Object.assign(this,{parentSource,parentOrigin,send,now});this.phase='hello';this.nonce=null;this.epoch=null;this.seq=0;this.current=null}
 hello(){if(this.phase!=='hello')return false;this.send(this.parentSource,{v:1,kind:'HELLO'},this.parentOrigin);return true}
 receive(event){if(!event||event.source!==this.parentSource||event.origin!==this.parentOrigin)return false;const x=bounded(event.data);if(!x)return false
  if(handshake(x,'INIT')&&(this.phase==='hello'||this.phase==='resync')){this.nonce=x.nonce;this.epoch=x.epoch;this.phase='ready';this.seq=0;this.current=null;this.send(this.parentSource,{v:1,kind:'READY',nonce:this.nonce,epoch:this.epoch},this.parentOrigin);return true}
  if(this.phase!=='ready'||x.kind!=='SNAPSHOT')return false
  const clean=validateSnapshot(x,this.now());if(!clean||clean.nonce!==this.nonce||clean.epoch!==this.epoch)return false
  if(clean.seq!==this.seq+1){if(clean.seq>this.seq+1){this.phase='resync';this.current=null;this.send(this.parentSource,{v:1,kind:'RESYNC',nonce:this.nonce,epoch:this.epoch},this.parentOrigin)}return false}
  this.seq=clean.seq;this.current=clean;this.send(this.parentSource,{v:1,kind:'ACK',nonce:this.nonce,epoch:this.epoch,seq:this.seq},this.parentOrigin);return true
 }
 view(){return this.current&&this.now()-this.current.sentAt<=MAX_AGE_MS&&this.current.sentAt<=this.now()+MAX_FUTURE_MS?{state:'live',snapshot:this.current}:{state:'unsynced',snapshot:null}}
}
/** Generate independently random per-window aliases; caller maps real IDs privately in the parent. */
export function createOpaqueIds(){const ids=new Map();return {get(realId){if(typeof realId!=='string'||!realId)throw Error('parent-only identity required');if(!ids.has(realId))ids.set(realId,randomToken());return ids.get(realId)},clear(){ids.clear()}}}
/** Explicit allowlist; names are generated, never read from source cells. */
export function displayRows(cells,aliases){if(!Array.isArray(cells)||cells.length<1||cells.length>9||!aliases||typeof aliases.get!=='function')return null;try{const rows=cells.map((c,i)=>({id:aliases.get(c.id),name:i===0?'当前会话':'监控 '+(i+1),activity:c.activity,changedAt:c.changedAt,isChild:c.isChild,childCount:c.childCount,pose:c.pose,look:{shape:c.look?.shape,color:c.look?.color,expression:c.look?.expression,size:c.look?.size}}));return rows.every(row)&&new Set(rows.map(r=>r.id)).size===rows.length?rows:null}catch{return null}}
