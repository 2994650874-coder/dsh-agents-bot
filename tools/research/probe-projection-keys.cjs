// 直接从 asar 解出的 typert.host.js 里读 SessionProjectionMap 的完整声明。
// grep 是按行输出的，那条 declaration 很长、被行尾截断，所以这里直接读全文再切。
// 用法: node tools\research\probe-projection-keys.cjs
'use strict'
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')
const TMP = path.join(ROOT, '_work', '_typert.host.js')

const target = '/dsh/node_modules/@deepseek-ai/dsh-api-session-controller/lib/typert.host.js'
if (!fs.existsSync(TMP)) {
  const txt = execFileSync(process.execPath, [path.join(ROOT, '_work', 'asar-extract.cjs'), target], {
    encoding: 'utf8',
    maxBuffer: 1e8
  })
  fs.writeFileSync(TMP, txt, 'utf8')
  console.log(`已解出 ${(txt.length / 1024).toFixed(0)} KB → _work/_typert.host.js\n`)
}

const src = fs.readFileSync(TMP, 'utf8')
const anchor = '"name": "SessionProjectionMap"'
const at = src.indexOf(anchor)
if (at < 0) {
  console.log('没找到 SessionProjectionMap')
  process.exit(1)
}
const chunk = src.slice(at, at + 4000)
const m = /"declaration":\s*"([\s\S]*?)"\s*\}\s*,?\s*(?:"|$)/.exec(chunk)
const raw = m ? m[1] : chunk.slice(0, 3000)
const decl = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"')
console.log(decl.slice(0, 3000))

const keys = [...decl.matchAll(/^\s*(?:readonly\s+)?([a-zA-Z][\w]*)\??:/gm)].map((x) => x[1])
console.log('\n=== 键名清单（' + keys.length + ' 个）===')
console.log(keys.join(', '))
