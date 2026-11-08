/** Capture source-only frozen real SVG frames, without writing plugin/lib. */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const browser = await chromium.launch({ executablePath: 'D:/百分/CentBrowser/Application/chrome.exe', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 970 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(resolve('preview/small-ball-family.html')).href)
  await page.waitForFunction(() => document.querySelectorAll('figure svg').length === 12)
  const output = resolve('preview/small-ball-family-front-option-preview-20261105.png')
  await page.screenshot({ path: output, fullPage: true })
  console.log(output)
} finally { await browser.close() }
