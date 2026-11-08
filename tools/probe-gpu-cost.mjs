/**
 * 绘制成本落在哪个进程：9 个 60fps 的 SVG 头像，会不会把 **gpu-process** 的 CPU 吃掉？
 *
 * 背景：实测 DSH 的 gpu-process 长期占一核的 38%，而 GPU Engine 计数器只有 6%。
 * 「GPU 硬件闲着」与「绘制不花时间」是两件事 —— 后者可能是 CPU 光栅化。
 * 这个探针用同一个页面只换场景，量浏览器自己的 gpu-process CPU。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-contention.mjs
 *   node tools/probe-gpu-cost.mjs
 */
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'contention.html')).href

const ps = (cmd) => {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

/**
 * 用**唯一的 user-data-dir** 标记这次启动，然后按命令行反查它的子进程。
 * Playwright 的 browser 对象不给 pid，但命令行里的这个目录是唯一指纹。
 */
function procsWithTag(tag) {
  const out = ps(
    `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
      `Where-Object { $_.CommandLine -like '*${tag}*' } | ` +
      `ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }`
  )
  const rows = []
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf('|')
    if (i < 0) continue
    const pid = Number(line.slice(0, i))
    const cmd = line.slice(i + 1)
    const m = cmd.match(/--type=([a-z-]+)/)
    rows.push({ pid, type: m ? m[1] : 'main' })
  }
  return rows
}

const cpuOf = (pid) => {
  const s = ps(`(Get-Process -Id ${pid}).CPU`)
  const v = Number(s)
  return Number.isFinite(v) ? v : null
}

async function measure(mode) {
  const tag = mkdtempSync(resolve(tmpdir(), 'dshgpu-')).replace(/\\/g, '/')
  const ctx = await chromium.launchPersistentContext(tag, {
    executablePath: CHROME,
    headless: false, // 无头没有真实合成器，量不到绘制成本
    viewport: { width: 1200, height: 800 },
    args: [
      '--window-position=-2400,-2400',
      '--window-size=1200,800',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  })
  const tab = await ctx.newPage()
  await tab.goto(PAGE + '?mode=' + mode)
  await tab.waitForTimeout(2500) // 进入稳态

  const rows = procsWithTag(tag.split('/').pop())
  const gpuPid = rows.find((r) => r.type === 'gpu-process')?.pid ?? null
  const rendererPid = rows.find((r) => r.type === 'renderer')?.pid ?? null

  let gpu = null
  let ren = null
  if (gpuPid !== null) {
    const a = cpuOf(gpuPid)
    const ar = rendererPid !== null ? cpuOf(rendererPid) : null
    await tab.waitForTimeout(4000)
    const b = cpuOf(gpuPid)
    const br = rendererPid !== null ? cpuOf(rendererPid) : null
    if (a !== null && b !== null) gpu = ((b - a) / 4) * 100
    if (ar !== null && br !== null) ren = ((br - ar) / 4) * 100
  }

  await ctx.close()
  return { mode, gpuPid, gpu, ren }
}

const CASES = [
  ['chat', '只有流式正文'],
  ['bot', '只有头像面板'],
  ['both', '两个一起']
]
console.log('绘制成本：浏览器各进程 CPU（4 秒窗口，一核百分比）\n')
const out = {}
for (const [m, label] of CASES) {
  const r = await measure(m)
  out[m] = r
  console.log(
    `  ${label.padEnd(9)}  gpu-process ${r.gpu === null ? '读不到' : r.gpu.toFixed(0) + '%'}` +
      `    renderer ${r.ren === null ? '读不到' : r.ren.toFixed(0) + '%'}`
  )
}
console.log('')
if (out.bot.gpu !== null && out.chat.gpu !== null) {
  const d = out.bot.gpu - out.chat.gpu
  console.log(`  头像面板相对纯文字，gpu-process：${d >= 0 ? '+' : ''}${d.toFixed(0)} 个百分点`)
}
