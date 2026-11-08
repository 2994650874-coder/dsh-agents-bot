/** 引擎基准的构建与运行：node tools/bench.mjs */
import { build } from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(ROOT, '_bench.cjs')

await build({
  entryPoints: [resolve(ROOT, 'tools/bench.ts')],
  bundle: true,
  outfile: out,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning'
})

createRequire(import.meta.url)(out)
