/** Real Bot renderer, frozen times; preserves behind-body occlusion for comparisons. */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { DEFAULT_LOOK } from '../plugin/src/client/look'
import type { StateId } from '../plugin/src/bot/states'

const look = { ...DEFAULT_LOOK, size: 160 }
const rows: { title: string; state: StateId; times: number[] }[] = [
  { title: '爆发 · 深色粒子吸入', state: 'burst', times: [.25, .48, .7, .95, 1.2, 1.6] },
  { title: '环绕 · 五点融入', state: 'orbit', times: [.6, 1.2, 2.15, 2.45, 2.7, 2.88] },
  { title: '加载 · 彩球吸入', state: 'loading', times: [.45, .9, 1.5, 1.8, 2.05, 2.35] },
  { title: '发送 · 从球心飞出', state: 'sending', times: [.3, .7, 1, 1.3, 1.6, 2] },
  { title: '接收 · 融入球心', state: 'receiving', times: [.15, .35, .6, .85, 1.05, 1.35] }
]
createRoot(document.getElementById('root')!).render(<main>
  <h1>五态外部小点 · 源码逐帧对照</h1>
  <p>使用真正的 Bot SVG 渲染器；爆发与加载的粒子在球后，被遮挡的效果也如实显示。本页不装机。</p>
  {rows.map(row => <section key={row.state} data-state={row.state}>
    <h2>{row.title}</h2><div className="frames">{row.times.map(t => <figure key={t}><Bot state={row.state} look={look} frozenAt={t}/><figcaption>{t.toFixed(2)} 秒</figcaption></figure>)}</div>
  </section>)}
</main>)
