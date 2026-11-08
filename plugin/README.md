# dsh-agents-bot（活动 AI 头像）

DSH Desktop 插件：把 agent / subagent 的实时状态画成 SVG 小 Bot，并监视多个会话。

- **模块 1（已验收）**：DSH 右栏的跨站隔离监视面板，1～9 格，数据与控制留在父页面，连续动画只在独立子页运行。
- **模块 2（功能完成，G4/G5 真机验收待补）**：DSH 主窗口内可拖动、可点击的主 Bot 与消息 Bot，与右栏显式互斥；**不是** Windows 全桌面 Bot。
- **模块 3（调研结论，未立项、非已实现功能）**：三级覆盖第三级 / 原 P4（Windows 全桌面无边框 Bot）的宿主入口取证，结论为「无正式入口、维持封存」；状态说明见仓库顶层 [README.md](../README.md)。

grokbot 是通用底座（上游基础件）；多 Agent 辩论平台是集成 grokbot 作视觉模块的**下游／更高级别项目（消费方）**。

## 安装与回退

本机通过 profile 的 `node_modules/dsh-agents-bot` junction 指向本目录的 `plugin/`。发布产物是**成对的五文件**，不能只替换其中一个：

```
lib/index.js              Host 半侧（Cordis 模块，零外部依赖）
lib/client.js             浏览器半侧（ModuleLoader bundle）
lib/offscreen/index.html  跨站子页 HTML（CSP 由 Host 响应头下发）
lib/offscreen/app.js      子页渲染
lib/offscreen/owner.js    子页归属凭据
```

首次构建或改动 Host 半侧后必须**完整退出 DSH（含托盘进程）再启动**；只关窗口或刷新页面不会重载 Host。

## 从源码构建与验证

```bash
# 在 grokbot/ 下：先暂存构建，不覆盖已装产物
node tools/build.mjs --out-dir=.test-build/release

# 在 grokbot/plugin/ 下：全套离线回归
npm test
```

`npm test` 会在测试专用目录（`.test-build/`）生成纯函数包与预览产物，不写 `plugin/lib/`。浏览器类测试按 `DSH_CHROME_PATH` → 本机 CentBrowser → Playwright 缓存的顺序查找可执行文件，找不到会明确报错而不是静默跳过。

## 文档

完整工程手册、动画改动方法、模块 2 交接与当前交付/回退状态都在仓库的 `grokbot/` 目录：

- `grokbot/README.md`：工程手册（唯一正本）
- `grokbot/交付说明.md`：当前已装五文件哈希、回退入口与未证清单
- `grokbot/docs/动画改造手册.md`：改动画前必读的比例尺与判据
- `grokbot/模块2-主窗口Bot/`：模块 2 的目录索引、实施与审计正本、施工档案
- `grokbot/模块3-全桌面Bot调研/`：模块 3 的目录索引与取证结论唯一正本

## 授权与来源

动画引擎来自 [bloub](https://github.com/jeremy-prt/bloub)（MIT），`src/bot/` 原样引入后本地扩展；上游 MIT 许可原文见 `LICENSE-bloub-MIT.txt`。本项目其余代码按 MIT 授权，见仓库顶层 `LICENSE`。
