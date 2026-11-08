/** Capture deterministic real SVG frames; target suffix is only before or after. */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const version = process.argv[2]
if (!['before', 'after', 'after-v2', 'proportional'].includes(version)) throw Error('Use before, after or after-v2')
const browser = await chromium.launch({ executablePath: 'D:/百分/CentBrowser/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1220 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(resolve('preview/particle-visibility.html')).href)
  await page.waitForFunction(() => document.querySelectorAll('figure svg').length === 30)
  const output = resolve('preview/particle-visibility-' + version + '-20261105.png')
  await page.screenshot({ path: output, fullPage: true })
  console.log(output)
} finally { await browser.close() }
