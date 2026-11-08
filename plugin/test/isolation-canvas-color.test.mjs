import test from 'node:test'
import assert from 'node:assert/strict'
import {canvasColorBehind} from '../src/client/canvasColor.ts'

test('parent-only color sampler composites translucent ancestors and emits hex',()=>{
  const prior=globalThis.getComputedStyle
  globalThis.getComputedStyle=node=>({backgroundColor:node.color})
  try{
    const root={color:'rgb(240, 220, 180)',parentElement:null}
    const middle={color:'rgba(0, 0, 0, 0.5)',parentElement:root}
    const cell={color:'rgba(0, 0, 0, 0)',parentElement:middle}
    assert.equal(canvasColorBehind(cell),'#786e5a')
    middle.color='transparent'
    assert.equal(canvasColorBehind(cell),'#f0dcb4')
    root.color='url(https://invalid.example/pixel)'
    assert.equal(canvasColorBehind(cell),'#f6f8fb')
    assert.equal(canvasColorBehind(null),'#f6f8fb')
  }finally{globalThis.getComputedStyle=prior}
})
