import React,{useEffect,useLayoutEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Bot} from '../client/Bot.tsx'
import {EYES_OPEN_AT} from '../bot/face.ts'
import {pickDisplayed} from '../client/dwell.ts'
import {ACTIVITY_PRESENTATION,activityShortLabel} from '../client/activities.ts'
import {ChildBridge} from './protocol.mjs'

// Injected ONLY at build time after actual Desktop origin verification. No URL-derived trust.
const CHILD_ORIGIN=__CHILD_ORIGIN__, PARENT_ORIGIN=__PARENT_ORIGIN__
const useCanvasEffect=typeof document==='undefined'?useEffect:useLayoutEffect
const luminosity=hex=>{const rgb=[1,3,5].map(at=>parseInt(hex.slice(at,at+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function IsolatedView(){
 const [snapshot,setSnapshot]=useState(null),[clock,setClock]=useState(Date.now()),bridge=useRef(null),dwell=useRef(new Map())
 useEffect(()=>{
  if(window.location.origin!==CHILD_ORIGIN||window.parent===window)return
  const child=new ChildBridge({parentSource:window.parent,parentOrigin:PARENT_ORIGIN,send:(target,data,origin)=>target.postMessage(data,origin)})
  bridge.current=child
  const onMessage=e=>{const accepted=child.receive(e);if(accepted||child.phase==='resync'){setSnapshot(child.view().snapshot);setClock(Date.now())}}
  window.addEventListener('message',onMessage)
  let attempts=0;const retry=window.setInterval(()=>{if(child.phase!=='hello'||attempts++>=40){window.clearInterval(retry);return}child.hello()},500)
  child.hello()
  return()=>{window.clearInterval(retry);window.removeEventListener('message',onMessage);bridge.current=null}
 },[])
 const live=!!snapshot&&bridge.current?.view().state==='live'
 const canvas=live?snapshot.ui.canvas??'#f6f8fb':'#f6f8fb'
 useCanvasEffect(()=>{
  const luminance=luminosity(canvas)
  document.documentElement.style.setProperty('--bot-canvas',canvas)
  document.documentElement.style.setProperty('--bot-label-color',luminance>.18?'#171717':'#ffffff')
 },[canvas])
 useEffect(()=>{
  if(!live||!snapshot)return
  const now=Date.now(),deadlines=[snapshot.sentAt+12001]
  for(const row of snapshot.rows){const state=dwell.current.get(row.id);if(state&&state.shown!==row.activity&&state.until>now)deadlines.push(state.until)}
  const timer=window.setTimeout(()=>{setClock(Date.now());if(bridge.current?.view().state!=='live')setSnapshot(null)},Math.max(1,Math.min(...deadlines)-now))
  return()=>window.clearTimeout(timer)
 },[snapshot,clock,live])
 if(!live)return <main className="isolation"><div className="warning" role="status">未同步 · 快照过期或连接未验证；当前不显示实时活动</div></main>
 const rows=snapshot.rows,ui=snapshot.ui,ids=new Set(rows.map(r=>r.id));for(const id of dwell.current.keys())if(!ids.has(id))dwell.current.delete(id)
 return <main className="isolation"><div className="grid" data-count={rows.length} style={{gridTemplateColumns:`repeat(${ui.cols},minmax(0,1fr))`,gridTemplateRows:`repeat(${ui.rows},minmax(0,1fr))`}}>
 {rows.map(row=>{
  const next=row.pose?undefined:pickDisplayed(dwell.current.get(row.id),row.activity,clock,ui.dwellMs)
  const shown=row.pose?'idle':next.shown
  if(row.pose)dwell.current.delete(row.id);else dwell.current.set(row.id,next)
  const rotation=ui.rotation[shown]
    return <article key={row.id} data-activity={shown} data-pose={row.pose?'true':'false'} data-raised={rows.length===2&&row.look.size>=80?'true':'false'} data-spacious={rows.length>=3&&rows.length<=8&&row.look.size>=120?'true':'false'}>
     <div className="isolation-bot" style={{height:row.look.size,marginBottom:rows.length===1?-Math.min(36,Math.round(row.look.size*.2)):undefined}}><Bot state={row.pose?'idle':rotation[0].state} rotation={row.pose?undefined:rotation} look={row.look} fps={ui.fps} paper={canvas} follow={rows.length===1}/></div>
     <strong className="isolation-title" aria-hidden="true">{row.isChild?'└ ':null}{row.name}</strong>
     <small className="isolation-pill isolation-status" title={ACTIVITY_PRESENTATION[row.pose?row.activity:shown].label+(row.pose?' · 静止以调外观':'')}><span className="isolation-activity-dot" data-breathing={!row.pose&&(shown==='waiting'||shown==='error'||shown==='done')?'true':undefined} style={{backgroundColor:ACTIVITY_PRESENTATION[row.pose?row.activity:shown].color}} aria-hidden="true" />{row.pose?activityShortLabel(row.activity)+' · 静止以调外观':activityShortLabel(shown)}</small>
      <div className="isolation-count-slot">{row.childCount>0 ? <span className="isolation-pill isolation-children" title={'此格还有 '+row.childCount+' 个子代理'}>
         <Bot state="idle" look={{shape:'cercle',color:'encre',expression:'neutre',size:12}} paper={canvas} frozenAt={EYES_OPEN_AT}/>
         ×{row.childCount} 子代理
       </span> : null}</div>
    </article>
  })}</div></main>
}
if(typeof document!=='undefined'){const target=document.getElementById('root');if(target)createRoot(target).render(<IsolatedView/>)}
export {IsolatedView}
