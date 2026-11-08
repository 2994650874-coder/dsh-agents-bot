/**
 * 改后观感确认：写文件（1 条）与跑命令（4 条，未动）并排。
 *
 * 用法（在 grokbot 下）：node tools/shoot-arc-final.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 480 } })
const tab = await ctx.newPage()
await tab.goto(PAGE + '?plain=1')
await tab.waitForTimeout(900)

async function svgOf(state) {
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const rotation = {}
  for (const a of acts) rotation[a] = [{ state, plays: 1 }]
  await tab.evaluate(({ rotation }) => {
    localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps: 45, rotation }))
  }, { rotation })
  await tab.reload()
  await tab.waitForTimeout(1400)
  return tab.evaluate(() => {
    const svg = document.querySelector('.davf-cell svg')
    return svg ? svg.outerHTML : null
  })
}

const play = await svgOf('play')
const comet = await svgOf('comet')
const orbit = await svgOf('orbit')

const panel = (title, sub, svg, small) => `
  <div class="box">
    <h3>${title}</h3>
    <p class="sub">${sub}</p>
    <div class="${small ? 'small' : 'slot'}">${svg}</div>
  </div>`

await tab.setContent(`<!doctype html><html><head><meta charset="utf-8">
<style>
  html,body{margin:0;background:#eef1f6;font-family:-apple-system,"Segoe UI",sans-serif}
  .wrap{display:flex;gap:14px;padding:16px;align-items:flex-start;flex-wrap:wrap}
  .box{background:#fff;border-radius:12px;padding:10px;text-align:center;
       box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .box h3{margin:0 0 2px;font-size:13px;color:#1c1f24}
  .box .sub{margin:0 0 6px;font-size:11px;color:#8b929e;height:30px}
  .slot{width:300px;height:300px;display:grid;place-items:center}
  .slot svg{width:300px;height:300px}
  .small{width:96px;height:96px;display:grid;place-items:center}
  .small svg{width:96px;height:96px}
</style></head><body><div class="wrap">
  ${panel('写文件 play · 改后', '1 条弧 · 11 元素', play, false)}
  ${panel('写文件 · 实际 96px', '面板里看到的大小', play, true)}
  ${panel('跑命令 comet · 未动', '4 条弧 · 27 元素（你的参考）', comet, false)}
  ${panel('检索 orbit · 未动', '6 条弧 · 41 元素', orbit, false)}
</div></body></html>`)
await tab.waitForTimeout(600)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'arc-final.png') })
report(resolve(ROOT, 'preview', 'arc-final.png'))

await browser.close()
