/** Browser regression against the real Bot component and its rendered SVG. */
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { resolveBrowserExecutable } from './browser-executable.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const entry = [
  "import React from 'react'",
  "import { createRoot } from 'react-dom/client'",
  "import { flushSync } from 'react-dom'",
  "import { Bot } from './plugin/src/client/Bot'",
  "import { BotEngine } from './plugin/src/bot/engine'",
  "import { shapeRadiiOf, expressionOf, DEFAULT_LOOK } from './plugin/src/client/look'",
  "const root = createRoot(document.getElementById('app'))",
  "const look = DEFAULT_LOOK",
  "window.botTest = { render(plays, frozenAt, first = 'orbit', follow = false) { flushSync(() => root.render(React.createElement(Bot, { state: 'orbit', rotation: Array.isArray(plays) ? plays : [{ state: first, plays }], look, frozenAt, follow }))) }, expected(state, origin, now) { const e = new BotEngine(100, state, shapeRadiiOf(look.shape), expressionOf(look.expression)); e.reset(state, origin); const f = e.sample(now); return { body: f.bodyPath, dots: f.dots.filter(d => !d.d).map(d => [String(d.x), String(d.y), String(d.r)]) } }, eyeY() { const t = document.querySelector('svg mask path[transform]')?.getAttribute('transform'); return Number(t?.match(/^matrix\\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,([^)]*)\\)$/)?.[1]) }, actual() { const svg = document.querySelector('svg'); return { body: svg.querySelector('mask path:first-child').getAttribute('d'), dots: [...svg.querySelectorAll('circle')].map(d => [d.getAttribute('cx'), d.getAttribute('cy'), d.getAttribute('r')]) } } }"
].join(';\n')
const bundled = await build({ stdin: { contents: entry, resolveDir: root, loader: 'js' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent' })
const browser = await chromium.launch({ executablePath: resolveBrowserExecutable(chromium), headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    let now = 1000
    let nextId = 0
    const pending = new Map()
    Object.defineProperty(performance, 'now', { configurable: true, value: () => now })
    window.requestAnimationFrame = (cb) => { const id = ++nextId; pending.set(id, cb); return id }
    window.cancelAnimationFrame = (id) => pending.delete(id)
    window.tick = (at) => { now = at; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(cb => cb(at)) }
  })
  await page.goto('about:blank')
  await page.setContent('<div id="app"></div>')
  await page.addScriptTag({ content: bundled.outputFiles[0].text })
  const snapshot = async () => page.evaluate(() => window.botTest.actual())
  const expected = async (state, origin, now) => page.evaluate(([a, b, c]) => window.botTest.expected(a, b, c), [state, origin, now])
  const tick = async (at) => { await page.evaluate(t => window.tick(t), at); await page.waitForTimeout(0) }
  const assertFrame = (actual, wanted, msg) => {
    assert.equal(actual.body, wanted.body, msg + ': body path')
    assert.equal(actual.dots.length, wanted.dots.length, msg + ': particle count')
    for (let i = 0; i < actual.dots.length; i++) {
      for (let j = 0; j < 3; j++) {
        // slotAt modulo introduces sub-ulp rounding into the computed reset timestamp.
        assert.ok(Math.abs(Number(actual.dots[i][j]) - Number(wanted.dots[i][j])) < 1e-7, msg + ': particle ' + i + '/' + j)
      }
    }
  }
  await page.evaluate(() => window.botTest.render(1))
  await tick(1000)
  await tick(3200)
  const oldFrame = await snapshot()
  await page.evaluate(() => window.botTest.render(2))
  await tick(3320)
  const restarted = await snapshot()
  assertFrame(restarted, await expected('orbit', 2.2, 2.32), 'same first state must restart at new rotation origin, including delayed frame phase')
  assert.notDeepEqual(restarted, oldFrame, 'visible SVG must change from old phase')
  console.log('ok: orbit x1 -> x2 same first state restarts at new origin')
  await page.evaluate(() => window.botTest.render(2))
  await tick(3400)
  assertFrame(await snapshot(), await expected('orbit', 2.2, 2.4), 'same signature / fresh array must not restart each render')
  console.log('ok: unchanged rotation content does not continually reset')
  await page.evaluate(() => window.botTest.render(1, undefined, 'idle'))
  await tick(3520)
  assertFrame(await snapshot(), await expected('idle', 2.4, 2.52), 'different first state must start without stale orbit morph')
  console.log('ok: changed first state starts from new origin without old-state morph')
  // Skip the first draw after a config change: orbit(3s) has ended and celebrate is 0.40s in.
  await page.evaluate(() => window.botTest.render([{ state: 'orbit', plays: 1 }, { state: 'celebrate', plays: 1 }]))
  await tick(6920)
  assertFrame(await snapshot(), await expected('celebrate', 5.52, 5.92), 'delayed first draw in second item must use that item start')
  console.log('ok: delayed first draw crosses into second item with local phase')
  // First draw after changing again skips orbit pass 0 and enters pass 1 at 0.18s.
  await page.evaluate(() => window.botTest.render(2))
  await tick(10080)
  assertFrame(await snapshot(), await expected('orbit', 8.92, 9.08), 'delayed first draw in second pass must use pass start')
  console.log('ok: delayed first draw crosses into second pass with local phase')
  await page.evaluate(() => window.botTest.render(2, 0.7))
  const frozen = await snapshot()
  await page.evaluate(() => window.botTest.render(3, 0.7))
  await tick(3900)
  assert.deepEqual(await snapshot(), frozen, 'frozen component must not enter animation loop')
  console.log('ok: frozen preview remains frozen after rotation change')
  await page.evaluate(() => window.botTest.render(1, undefined, 'idle', true))
  await page.mouse.move(40, 20); await tick(12000); await tick(12350)
  const upEye = await page.evaluate(() => window.botTest.eyeY())
  await page.mouse.move(40, 420); await tick(12700); await tick(13050)
  const downEye = await page.evaluate(() => window.botTest.eyeY())
  assert.ok(Number.isFinite(upEye) && Number.isFinite(downEye) && downEye > upEye + 2,
    'legacy single-Bot follow also looks down as pointer moves down: ' + JSON.stringify({upEye, downEye}))
  console.log('ok: legacy single-Bot pointer follow uses natural vertical direction')
} finally {
  await browser.close()
}
