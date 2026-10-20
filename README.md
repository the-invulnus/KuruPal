# KuruPal

透明桌宠，支持角色动作与语录、A 股行情提醒，以及 agent 任务反馈。可以通过 Codex 调整桌宠大小、管理关注股票。

## 安装：把这段话发给你的 agent

复制以下内容，发送给 Codex 或你正在使用的其他 agent：

```text
请帮我安装 KuruPal：https://github.com/the-invulnus/KuruPal
先阅读仓库 README，检查我的操作系统、芯片架构和正在使用的 agent 客户端。
优先下载 GitHub Releases 中匹配的现成安装包，先安装并启动桌面应用，再安装 Codex 插件。
请直接完成可自动执行的步骤；需要我确认系统安全提示或信任 Hook 时再告诉我。
如果系统或 agent 客户端不受现成安装包支持，请参考仓库代码和资源，为我的环境适配并构建。
```

当前提供 **macOS Apple Silicon（arm64）桌面包**和 **Codex 插件包**：[下载最新版本](https://github.com/the-invulnus/KuruPal/releases/latest)。应用未经过 Apple 公证，首次打开可能需要系统安全确认。

## 给 agent：使用发布包安装

1. **检查环境。** 确认系统、芯片架构、agent 客户端及已有安装；不匹配时转到下一节。保留已有桌宠设置和关注股票。
2. **下载并校验。** 从 [GitHub Releases](https://github.com/the-invulnus/KuruPal/releases/latest) 获取桌面 ZIP、Codex 插件 ZIP 和 `SHA256SUMS.txt`，核对校验和。使用实际存在的附件，不猜测文件名或下载地址。
3. **先启动桌面应用。** 解压桌面 ZIP，将 `KuruPal.app` 复制到 `~/Applications/`，再用 `open` 启动并确认进程正常。更新前退出旧应用并备份旧 bundle。无需 DMG 或手动拖拽；若被系统拦截，引导用户通过系统安全入口确认，不关闭 Gatekeeper。
4. **再安装 Codex 插件。** 确保 `python3` 和支持 `plugin` 命令的 Codex CLI 可用。将插件 ZIP 解压到持久目录，执行其中的 `sh install.command`，并保留该目录供后续更新。插件显示名为 KuruPal，兼容 ID 为 `market-pet@market-pet-local`。
5. **验证并交付。** 从实际安装目录执行 `python3 <installedPath>/scripts/bridge.py --status` 和 `python3 <installedPath>/scripts/settings.py`，确认连接与设置可读。更新插件后提醒用户重启 Codex，再到 **Plugins → KuruPal → Hooks → Review / Trust all** 审阅；聊天输入框的 **Review hooks** 也可使用。不要代写信任配置；用户已关闭 Hook 时保持关闭。

安装完成后，用户可以直接说“把桌宠调小一点”“关注 000001 和 600519”“移除 000001”。大小和关注列表设置不依赖 Hook 信任。不要把插件安装成功当作自动 Hook 已验证。

## 其他系统或 agent 客户端

如果用户使用 Windows、Intel Mac、Linux，或 Claude Code、WorkBuddy 等其他客户端，请由其 agent 基于本仓库自行适配和构建，不安装不匹配的发行包，也不假设 Codex 插件可直接通用。

代码入口：前端 `src/`、桌面层 `src-tauri/`、行情采集器 `backend/`、Codex 插件与桥接脚本 `codex-plugin-distribution/`。运行所需的角色图集位于 `public-app/kurumi/`，头像位于 `assets/branding/`，任务事件协议见 [HOOKS.md](HOOKS.md)。请阅读相关代码，复用资源，按目标平台和客户端的机制完成适配与验证；可选 Hook 的失败不得阻塞 agent 正常工作。
