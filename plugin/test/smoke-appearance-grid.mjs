/** Browser-only appearance layout probe; no production artifacts are changed. */
import { chromium } from 'playwright-core'
import { resolveBrowserExecutable } from './browser-executable.mjs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const browser = await chromium.launch({
  executablePath: resolveBrowserExecutable(chromium), headless: true,
})
let failures = 0
const assert = (ok, message) => { if (!ok) { failures++; console.error('FAIL ' + message) } }
const rows = (tops) => [...new Set(tops.map(Math.round))].map((top) => tops.filter((t) => Math.round(t) === top).length)
try {
  for (const width of [116, 220, 260, 264, 280, 360, 562]) {
    // Each context is an independent, ephemeral browser profile: no personal CentBrowser data.
    const context = await browser.newContext({ viewport: { width: Math.max(width + 40, 720), height: 950 } })
    const page = await context.newPage()
    await page.goto(pathToFileURL(resolve(root, 'preview/panel.html')).href + '?w=' + width + '&h=900')
    await page.getByRole('button', { name: '外观', exact: true }).click()
    await page.locator('.davf-shapes .davf-shape').first().waitFor()
    const m = await page.evaluate(() => {
      const q = (s) => document.querySelector(s)
      const metrics = (s) => { const e = q(s); return [e.clientWidth, e.scrollWidth] }
      const shape = [...document.querySelectorAll('.davf-shapes .davf-shape')]
      const expression = [...document.querySelectorAll('.davf-expressions .davf-chip')]
      return {
        labels: [...document.querySelectorAll('.davf-cust-label')].map((e) => e.textContent.trim()),
        shapeCount: shape.length, expressionCount: expression.length,
        shapeRows: shape.map((e) => e.getBoundingClientRect().top),
        expressionRows: expression.map((e) => e.getBoundingClientRect().top),
        widths: Object.fromEntries(['.fake-right','.davf-picker','.davf-custbody','.davf-shapes','.davf-expressions'].map((s) => [s, metrics(s)])),
        clippedShapes: shape.filter((e) => e.querySelector('span').scrollWidth > e.querySelector('span').clientWidth + 1).map((e) => e.textContent.trim()),
        clippedExpressions: expression.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()),
      }
    })
    const shapeRows = rows(m.shapeRows), expressionRows = rows(m.expressionRows)
    console.log(JSON.stringify({width, shapeRows, expressionRows, widths:m.widths, clippedShapes:m.clippedShapes, clippedExpressions:m.clippedExpressions}))
    assert(m.labels.includes('形状') && m.labels.includes('表情'), width + ': labels')
    assert(m.shapeCount === 15 && m.expressionCount === 16, width + ': 15/16 counts')
    const narrow = width <= 264
    assert(JSON.stringify(shapeRows) === (narrow ? '[2,2,2,2,2,2,2,1]' : '[5,5,5]'), width + ': shape rows ' + shapeRows)
    assert(JSON.stringify(expressionRows) === (narrow ? '[2,2,2,2,2,2,2,2]' : '[6,5,5]'), width + ': expression rows ' + expressionRows)
    assert(m.clippedShapes.length === 0, width + ': clipped shapes ' + m.clippedShapes)
    assert(m.clippedExpressions.length === 0, width + ': clipped expressions ' + m.clippedExpressions)
    for (const [key, [client, scroll]] of Object.entries(m.widths))
      assert(scroll <= client + 1, width + ': horizontal overflow ' + key + ' ' + scroll + '/' + client)
    for (const selector of ['.davf-shapes .davf-shape', '.davf-expressions .davf-chip']) {
      const buttons = page.locator(selector)
      const n = await buttons.count()
      for (let i = 0; i < n; i++) {
        await buttons.nth(i).click()
        assert(await buttons.nth(i).evaluate((el) => el.classList.contains('is-on')), width + ': click ' + selector + ' #' + (i + 1))
        assert(await page.locator(selector + '.is-on').count() === 1, width + ': unique selected ' + selector + ' #' + (i + 1))
      }
    }
    await context.close()
  }
  const context = await browser.newContext({ viewport: {width: 1100,height: 900} })
  const page = await context.newPage()
  await page.goto(pathToFileURL(resolve(root, 'preview/settings.html')).href + '?w=850')
  const text = await page.locator('body').innerText()
  const titles = await page.locator('.davs-group').evaluateAll((groups) => groups.map((g) => g.dataset.group))
  console.log('settings preview group titles: ' + JSON.stringify(titles))
  assert(titles.includes('形状') && !titles.includes('图案'), 'settings preview shape title')
  assert(text.includes('形状、配色、表情'), 'settings shape explanatory text')
  await context.close()
} finally { await browser.close() }
if (failures) process.exitCode = 1
else console.log('appearance grid PASS')
