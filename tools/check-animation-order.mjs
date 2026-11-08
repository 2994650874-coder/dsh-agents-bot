/**
 * 回归锁：设置页上的**动画列表顺序与名字**（`ANIMATION_OPTIONS` 的顺序就是
 * 用户看到的顺序），以及「某个名字确实不在页面上」。
 *
 * ── 为什么这条要存在 ────────────────────────────────────────────────
 * 第 100 轮用户要求：「把目前的（检索）删掉，然后把（低吟）改成（检索）的
 * 名字，顺序放到（眨眼）后面」。
 * 第 104 轮又要求：「（写文件）的名字改成环流，（出错）的名字改成（写文件），
 * （惊叹）的名字改成（错误）」。
 *
 * 这些都不是改文件名那么简单：`ANIMATION_OPTIONS` 是**手写数组**，
 * `states.ts` 里的 `SEQUENCE` 是另一个手写数组，两者顺序可以不一致。
 * 单元测试只能断 `STATE_BY_ID.has('search')`，断不了「页面上第几个」——
 * 而用户说的恰恰是「第几个」和「叫什么」。
 *
 * 所以这条检查**不开源文件**，直接开真浏览器读渲染后的文字。它测的是用户
 * 眼睛看到的东西，不是我以为代码写成的东西。
 *
 * ── 2026-10-31：改成只读「动画」那一组 ──────────────────────────────
 * 以前读全页文字再按名字过滤。动画映射默认收起以后行名不出现，但「出错」
 * 这两个字仍然出现在别的组（活动名）里 —— 按名字滤会串。现在锚定
 * `data-group="动画"`，读到的就是那一组芯片，语义干净。
 *
 * 用法：node tools/check-animation-order.mjs
 * 退出码 0 = 通过。
 */
import { chromium } from 'playwright-core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

/*
 * 「眨眼 后面紧挨着」是第 100 轮的具体需求。将来用户再调顺序，改这里 ——
 * 改这一行是有意的决定，不是让检查变绿。
 */
const ANCHOR = '眨眼'
const AFTER_IT = '检索'

/**
 * 第 104 轮的三处改名：新名字必须出现、旧名字必须**不在动画组里**。
 *
 * 旧名字（`出错` / `写文件` 里的「写文件」）在别的地方仍然是合法文字
 * （活动的名字），所以只要锚定动画组，这条断言就不会被别处的字碰到。
 */
const RENAMED = [
  ['写文件', '出错'], // alert：旧名「出错」→ 新名「写文件」
  ['错误', '惊叹'], // exclaim：旧名「惊叹」→ 新名「错误」
  ['环流', null] // play：新名「环流」，无名可查（原来叫「写文件」）
]

/** 已经彻底删除、不该再出现在动画组里的名字。 */
const GONE = ['低吟']

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(pathToFileURL(resolve(ROOT, 'preview/settings.html')).href)
await page.waitForTimeout(1500)

const order = await page.$$eval('.davs-group[data-group="动画"] .davs-chip', (els) =>
  els.map((e) => (e.textContent || '').trim()).filter(Boolean)
)

console.log('页面上的动画顺序:', order.join(' > '))
console.log('共 ' + order.length + ' 项')

let ok = true
const iAnchor = order.indexOf(ANCHOR)
const iAfter = order.indexOf(AFTER_IT)
if (iAnchor < 0) {
  console.log(`FAIL 找不到锚点「${ANCHOR}」`)
  ok = false
} else if (iAfter < 0) {
  console.log(`FAIL 找不到「${AFTER_IT}」`)
  ok = false
} else if (iAfter !== iAnchor + 1) {
  console.log(`FAIL 「${AFTER_IT}」应当紧挨在「${ANCHOR}」后面，实测位置 ${iAfter}（锚点 ${iAnchor}）`)
  ok = false
} else {
  console.log(`  ok  「${AFTER_IT}」紧挨在「${ANCHOR}」后面`)
}

for (const [fresh, old] of RENAMED) {
  if (!order.includes(fresh)) {
    console.log(`FAIL 动画组里没有新名字「${fresh}」`)
    ok = false
  } else {
    console.log(`  ok  有新名字「${fresh}」`)
  }
  if (old !== null) {
    /*
     * 旧名字可能**恰好**也是某个新名字（「写文件」既是 alert 的新名、
     * 又是 play 的旧名）。那种情况下「旧名字还在」是正常的 ——
     * 只要求它的位置变了，不要求它消失。
     */
    const stillThere = order.includes(old)
    const sameSlot = fresh === old
    if (!sameSlot && stillThere) {
      console.log(`FAIL 旧名字「${old}」还在动画组里（应改名为「${fresh}」）`)
      ok = false
    } else {
      console.log(`  ok  旧名字「${old}」${sameSlot ? '与新名同字，跳过' : '已不在'}`)
    }
  }
}

for (const name of GONE) {
  if (order.includes(name)) {
    console.log(`FAIL 「${name}」应当已经删除，页面上还有`)
    ok = false
  } else {
    console.log(`  ok  「${name}」已经不在页面上`)
  }
}

if (errors.length) {
  console.log('FAIL 页面 JS 报错:', errors.join(' | '))
  ok = false
} else {
  console.log('  ok  页面没有 JS 报错')
}

console.log(ok ? '\n通过' : '\n有失败')
await browser.close()
process.exit(ok ? 0 : 1)
