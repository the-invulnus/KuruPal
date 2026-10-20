# 盘伴 · Market Pet 0.1

本机运行的 A 股行情桌宠原型。Tauri 2 + TypeScript + AKShare，Python 被封装为独立采集器，最终用户不需要安装 Python 或开通付费行情账户。

## 使用

打开 Market Pet.app。角色下方「设置」可添加最多 5 只六位股票代码，选择一只驱动角色、配置阈值和刷新间隔。默认关注 000001 与 600519，默认阈值 ±3%，每 60 秒刷新。选择关注股后点击保存。可用「动作试衣间」独立试播全部动作。

真实模式自动请求仅在北京时间工作日 09:30–11:30 / 13:00–15:00，节假日暂未单独识别。非交易时段仍可手动刷新最近报价。启动未取得行情时不显示虚构价格。演示模式有明确标签，模拟数字不会混入真实模式。

拖动角色移动窗口；「设置」在桌宠与控制面板之间切换；「暂停」停止后续行情轮询；× 退出应用。透明窗口始终置顶，没有全窗口鼠标穿透，也没有自动开机启动。本版没有通知、辅助功能或录屏权限需求。

## 素材

见 [ASSETS.md](ASSETS.md)。支持逐动作混用精灵图 PNG/WebP 与 WebM；素材包本机持久化，缺失动作回退 idle。WebM 透明通道依赖系统 WebView，发布前逐平台实测，推荐精灵图作为跨平台主素材。

## 行情与限制

调用 AKShare `stock_bid_ask_em(symbol=...)`，逐个请求自选股，不扫描全市场。界面的“获取于”是客户端获取时间，不代表行情的交易时间。默认按当日涨跌幅触发动作，不是持仓盈亏，也不是买卖建议。

前后端都限制请求频率；采集最多 5 个代码。网络请求设置连接/读取超时，原生进程还设置 75 秒总超时并终止采集器；失败按指数退避，最长 15 分钟。不同情绪至少间隔 60 秒，相同状态不重复触发，大涨/大跌退出带 0.2 个百分点滞后带。失败不会自动切换模拟数据。

AKShare 的上游免费接口可能限流或断连，本版没有稳定性保证。本机实际测试东方财富返回 TLS EOF，尚未完成真实报价成功的端到端验证；错误显示与模拟行情流程已验证。没有关闭 TLS 校验或绕过访问控制。

## 开发与构建

开发机需要 Node.js 22、Rust、Python 3.12，以及 Tauri 对应操作系统的原生构建依赖。按目标平台分别编译，不能直接将 macOS 的采集器用于 Windows。

```sh
npm ci
python3.12 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python scripts/build_sidecar.py
npm run desktop
```

Windows 的 Python 命令改为 `.venv\Scripts\python.exe`。生成侧载采集器后再运行 `npm run desktop`。`npm run bundle` 打包；macOS 可用 `npm run bundle -- --bundles app,dmg`。

```sh
npm test
.venv/bin/python -m unittest discover -s backend
npm run build
```

本次实际构建目标是 macOS Apple Silicon。Windows / Linux 有同一套 Tauri 源码与本机打包脚本，但尚未在对应设备验证；Linux 置顶/透明效果受桌面环境影响。安装包没有开发者证书公证，属于本地原型，未发布应用商店。

## 结构

- `src/engine.ts`：阈值、交易时段、冷却与滞后逻辑。
- `src/media.ts`：素材校验、IndexedDB、精灵与视频渲染。
- `src/main.ts`：界面、行情调度、真实/演示隔离。
- `src-tauri/src/main.rs`：原生调用、输入验证、限流和进程超时。
- `backend/worker.py`：AKShare 请求和统一行情输出。
- `scripts/build_sidecar.py`：将 Python 与依赖封装为目标平台可执行文件。

当前交付范围是独立桌宠，不包含 ChatGPT / WorkBuddy 的 Hook 或 MCP 客户端连接。后续可以把外部事件接到同一动作调度层，无需改素材协议。
