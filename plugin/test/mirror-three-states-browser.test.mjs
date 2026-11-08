import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { BotEngine, STATE_BY_ID, SHAPE_BY_ID } = require('../../.test-build/tail-engine.cjs')

// Measure the REAL SVG paths, including the front/back ribbon layers. Numeric
// pose checks alone cannot catch a band renderer that bends the reflected path
// to the wrong side of its centerline.
test('mirrored state paths reflect body and front/back ribbons in browser geometry', async t => {
  const { chromium } = await import('../../node_modules/playwright-core/index.mjs')
  let browser
  try { browser = await chromium.launch({ executablePath: 'D:/百分/CentBrowser/Application/chrome.exe', headless: true }) }
  catch (error) { t.skip('Chromium unavailable: ' + error.message); return }
  try {
    const page = await browser.newPage()
    for (const id of ['idle', 'search', 'waking']) {
      const def = STATE_BY_ID.get(id)
      for (const shape of ['galet', 'goutte']) for (const at of [0.5, 1.2, 2]) {
        const radii = SHAPE_BY_ID.get(shape).radii
        def.mirrorX = false
        const before = new BotEngine(100, id, radii).sample(at)
        def.mirrorX = true
        const after = new BotEngine(100, id, radii).sample(at)
        const pairs = [[before.bodyPath, after.bodyPath, 'body']]
        assert.equal(before.ribbons.length, after.ribbons.length)
        for (let i = 0; i < before.ribbons.length; i++) for (const layer of ['front', 'back']) {
          const original = before.ribbons[i][layer], mirrored = after.ribbons[i][layer]
          assert.equal(Boolean(original), Boolean(mirrored), id + ' ' + i + ' ' + layer + ' visibility')
          if (original) pairs.push([original, mirrored, 'ribbon ' + i + ' ' + layer])
        }
        const bounds = await page.evaluate(paths => {
          const ns = 'http://www.w3.org/2000/svg'
          const svg = document.createElementNS(ns, 'svg')
          document.body.append(svg)
          const bbox = d => {
            const el = document.createElementNS(ns, 'path')
            el.setAttribute('d', d); svg.append(el)
            const b = el.getBBox()
            el.remove()
            return { x: b.x, y: b.y, width: b.width, height: b.height }
          }
          const result = paths.map(([left, right]) => [bbox(left), bbox(right)])
          svg.remove()
          return result
        }, pairs)
        for (let i = 0; i < bounds.length; i++) {
          const [left, right] = bounds[i]
          const error = Math.max(Math.abs(left.x + left.width + right.x),
            Math.abs(left.y - right.y), Math.abs(left.width - right.width), Math.abs(left.height - right.height))
          assert.ok(error < 0.03, id + ' / ' + shape + ' / ' + at + ' / ' + pairs[i][2] + ' did not reflect: ' + error)
        }
      }
    }
  } finally { await browser.close() }
})
