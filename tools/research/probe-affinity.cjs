/**
 * 实测：面板渲染的 CPU 落在哪个核上，以及「绑核」能不能解决卡顿。
 *
 * ── 要回答的问题 ────────────────────────────────────────────────────
 * 用户观察到「对话时 GUI 往下刷，bot 会卡顿」，怀疑是 CPU 争抢，
 * 提出「DSH 绑核 1、插件绑核 2」。
 *
 * 这个脚本不改任何东西，只量三件事：
 *   1. DSH 各进程当前的 CPU 亲和性掩码（是不是真的绑在某个核）
 *   2. 各进程累计 CPU 与内存
 *   3. 逻辑核数与型号（判断「绑核」有没有可分离的余量）
 *
 * ── 两个本机事实（决定了实现）────────────────────────────────────────
 *   · 本机**没有 pwsh**，只有 Windows PowerShell 5.1。所以调
 *     `powershell.exe` 的绝对路径，不依赖 PATH。
 *   · Node 起子进程捕获输出在沙箱里可能被拦（EPERM）。所以失败时
 *     退化到「打印手工核对命令」，不硬崩。
 *
 * 用法：node tools/research/probe-affinity.cjs
 */
'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')

/** 找可用的 PowerShell 绝对路径。 */
function findPowershell() {
  const candidates = [
    'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c
    } catch {}
  }
  return null
}

const PS = findPowershell()

function run(script) {
  if (!PS) throw new Error('找不到 PowerShell')
  return execFileSync(
    PS,
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `[Console]::OutputEncoding=[Text.Encoding]::UTF8; ${script}`
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 30000 }
  )
}

let cpuInfo = null
let procs = null

try {
  console.log('══ 1. 逻辑核与型号 ══')
  const raw = run(
    'Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors | ConvertTo-Json -Compress'
  )
  cpuInfo = JSON.parse(raw.trim())
  if (Array.isArray(cpuInfo)) cpuInfo = cpuInfo[0]
  console.log(`  ${cpuInfo.Name}`)
  console.log(`  物理核 ${cpuInfo.NumberOfCores} / 逻辑核 ${cpuInfo.NumberOfLogicalProcessors}`)
} catch (e) {
  console.log('  （读不到 CPU 信息：' + e.message + '）')
}

try {
  console.log('\n══ 2. DSH 各进程的 CPU 亲和性 ══')
  const raw = run(`
$out = @()
Get-Process | Where-Object { $_.ProcessName -like '*DeepSeek*' } | ForEach-Object {
  $p = $_
  $ci = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue
  $type = 'main'
  if ($ci -and $ci.CommandLine -match '--type=([a-z]+)') { $type = $Matches[1] }
  $out += [pscustomobject]@{
    Id = $p.Id
    Type = $type
    Affinity = [int64]$p.ProcessorAffinity
    CpuSec = [math]::Round($p.CPU, 1)
    Threads = $p.Threads.Count
    MemMB = [math]::Round($p.WorkingSet64/1MB, 0)
  }
}
ConvertTo-Json -InputObject @($out) -Compress
`)
  procs = JSON.parse(raw.trim())
  if (!Array.isArray(procs)) procs = [procs]

  const cores = cpuInfo ? Number(cpuInfo.NumberOfLogicalProcessors) : 0
  // 全核掩码：n 个逻辑核 → 低 n 位全 1
  const fullMask = cores > 0 ? Math.pow(2, cores) - 1 : null

  for (const p of procs) {
    const dec = Number(p.Affinity)
    const bits = dec.toString(2)
    const all = fullMask !== null && dec === fullMask
    console.log(
      `  pid=${String(p.Id).padEnd(6)} ${String(p.Type).padEnd(10)} mask=0x${dec.toString(16).toUpperCase().padEnd(6)}` +
        `(${bits}) cpu=${String(p.CpuSec).padStart(6)}s threads=${String(p.Threads).padStart(3)} mem=${p.MemMB}MB` +
        (all ? '  ← 全部核，未绑定' : '  ← 受限')
    )
  }

  if (fullMask !== null) {
    const bound = procs.filter((p) => Number(p.Affinity) !== fullMask)
    console.log('')
    if (bound.length === 0) {
      console.log(`✓ 所有 DSH 进程都在全部 ${cores} 个逻辑核上 —— 没有任何进程被绑核。`)
      console.log('  所以「DSH 绑在核 1」这个前提不成立；「插件改绑核 2」没有可分离的对象。')
    } else {
      console.log(`⚠ 有 ${bound.length} 个进程亲和性受限：`)
      for (const p of bound) console.log(`   pid=${p.Id} ${p.Type} mask=0x${Number(p.Affinity).toString(16)}`)
    }
  }

  console.log('\n══ 3. 谁在吃 CPU ══')
  const total = procs.reduce((s, p) => s + Number(p.CpuSec), 0)
  const sorted = [...procs].sort((a, b) => b.CpuSec - a.CpuSec)
  const rend = sorted.find((p) => p.Type === 'renderer')
  console.log(`  DSH 全部进程累计 CPU: ${total.toFixed(1)}s`)
  if (rend) {
    console.log(`  最大 renderer(pid=${rend.Id}): ${rend.CpuSec}s = ${((rend.CpuSec / total) * 100).toFixed(1)}%`)
    console.log('  （累计值含页面加载与历史渲染，不等于当前占用率）')
  }
} catch (e) {
  console.log('  （读不到进程信息：' + e.message + '）')
  console.log('\n  手工核对命令（在 PowerShell 里跑）：')
  console.log('    Get-Process | ? { $_.ProcessName -like "*DeepSeek*" } |')
  console.log('      select Id, ProcessorAffinity, CPU, @{n="MB";e={[int]($_.WorkingSet64/1MB)}}')
  console.log('\n  说明：ProcessorAffinity 是全核掩码（12 核 = 4095 = 0b111111111111）')
  console.log('  就表示没绑核；绑到核 1 会是 1，绑到核 2 会是 2。')
}

console.log('\n══ 4. 结论 ══')
console.log('  绑核解决不了「对话时 bot 卡顿」，原因见 README《为什么绑核没用》。')
