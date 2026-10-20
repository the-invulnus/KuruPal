# 验证记录

- TypeScript / Vite 生产构建通过。
- 行情阈值、冷却、滞后、沪深时段与素材配置：4 项自动测试通过。
- Python 行情归一化与非法输入：2 项测试通过。
- 隔离 Chromium：设置、动作试播、精灵图导入、IndexedDB 重载恢复、WebM 解码测试通过。
- macOS Apple Silicon：Tauri release 编译、原生应用启动、设置展开、窗口边界修复及欢呼动作试播已验证。
- AKShare 源码运行与打包后的采集器均能返回结构化结果；本机上游返回 SSLError / TLS EOF，未取得有效真实报价，不宣称真实行情端到端成功。
- 36 MiB DMG 镜像通过 hdiutil verify。应用约 41.63 MiB。
- 未验证 Windows、Linux、Intel Mac；未验证 macOS 系统 WebView 对用户自制透明 WebM 的具体编码兼容性。
- 目前无外部 Agent 连接、系统托盘、点击穿透、开机自启与交易所节假日表。
