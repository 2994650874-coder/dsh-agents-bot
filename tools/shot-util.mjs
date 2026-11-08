/**
 * 截图落盘：写到 preview/，并复制一份到桌面。
 *
 * 展示方式是**把图贴到回复末尾**（`![](preview/xxx.png)`）—— DSH 的
 * Markdown 图片是内嵌预览，正常撑开文档流。这里再存一份桌面，是为了
 * 图很大、或用户要把原图拖进别的软件时有个入口。
 *
 * 早前这里写着「内嵌图片会压住上下文字，所以只能放桌面」—— 那是误判，
 * 而且因为按那条规则根本不贴图，长期没被证伪。2026-10-29 实测推翻。
 *
 * 通用的「截任意页面」工具在 `workhelp/截图工具/shot-to-desktop.mjs`；
 * 这里的版本只服务 grokbot 自己的验证脚本（它们已经开好了浏览器和页面）。
 *
 * 桌面路径优先读 DSH_DESKTOP 环境变量；未设置时回退到 USERPROFILE 下的
 * Desktop / 桌面。公开发布版不写死任何本机绝对路径。
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const CANDIDATES = [
  process.env.DSH_DESKTOP,
  join(process.env.USERPROFILE ?? '', 'Desktop'),
  join(process.env.USERPROFILE ?? '', '桌面')
].filter(Boolean)

function desktopDir() {
  for (const p of CANDIDATES) {
    if (p && existsSync(p)) return p
  }
  return null
}

/**
 * 把 preview 里的图复制到桌面。
 * @param {string} absPath  preview/ 下的绝对路径
 * @param {string} [asName] 桌面上的文件名，缺省沿用原名
 * @returns {{ desktop: string|null, sizeKB: string }}
 */
export function toDesktop(absPath, asName) {
  const dir = desktopDir()
  if (!dir) return { desktop: null, sizeKB: (statSync(absPath).size / 1024).toFixed(0) }
  const name = asName ?? absPath.split(/[\\/]/).pop()
  const dest = join(dir, name)
  copyFileSync(absPath, dest)
  return { desktop: dest, sizeKB: (statSync(absPath).size / 1024).toFixed(0) }
}

/**
 * 截完一张图后统一报告：路径、尺寸、桌面副本。
 * @param {string} absPath
 * @param {string} [asName]
 */
export function report(absPath, asName) {
  const { desktop, sizeKB } = toDesktop(absPath, asName)
  const name = absPath.split(/[\\/]/).pop()
  if (desktop) {
    console.log(`  ${name}  ${sizeKB}KB  → 桌面\\${desktop.split(/[\\/]/).pop()}`)
  } else {
    console.log(`  ${name}  ${sizeKB}KB  （桌面路径没找到，只在 preview/ 里）`)
  }
  return desktop
}
