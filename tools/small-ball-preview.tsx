/** Source-only visual board of the shared small-ball body, face and unique effects. */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { DEFAULT_LOOK } from '../plugin/src/client/look'
import type { StateId } from '../plugin/src/bot/states'

const look = { ...DEFAULT_LOOK, size: 174 }
const items: { name: string; state: StateId; t: number }[] = [
  { name: '检索 · 参照', state: 'search', t: 1.2 },
  { name: '环绕', state: 'orbit', t: 1.2 },
  { name: '雷达', state: 'radar', t: 1.2 },
  { name: '进度', state: 'progress', t: 1.2 },
  { name: '庆祝', state: 'celebrate', t: 1.2 },
  { name: '加载', state: 'loading', t: 1.2 },
  { name: '发送', state: 'sending', t: 1.2 },
  { name: '接收', state: 'receiving', t: 1.2 },
  { name: '上传', state: 'uploading', t: 1.2 },
  { name: '爆发 · 小球阶段', state: 'burst', t: 1.0 },
  { name: '爆发 · 收尾目光', state: 'burst', t: 2.55 },
  { name: '空闲 · 镜像参照', state: 'idle', t: 1.2 }
]
createRoot(document.getElementById('root')!).render(<main>
  <h1>共用「小球」外观 · 源码预览</h1>
  <p>每格是同一套真实 Bot 渲染器的指定瞬间；彩带、环、烟花与运动仍由各自动画控制。未装机。</p>
  <section>{items.map(item => <figure key={item.name} data-state={item.state}><Bot state={item.state} look={look} frozenAt={item.t}/><figcaption>{item.name}</figcaption></figure>)}</section>
</main>)
