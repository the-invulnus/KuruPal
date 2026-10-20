# KuruPal Codex 插件 0.1.5

插件名、市场名和 skill 名均为 `kurupal`，完整安装 ID 为 `kurupal@kurupal`。显示名称为 KuruPal，图标为韭留美头像。

## 安装

先启动 KuruPal 桌面应用，将 `KuruPal-Codex-Installer-0.1.5.zip` 解压到长期保留的目录，再运行：

```sh
sh install.command
```

需要 Python 3 和支持 `plugin` 命令的 Codex CLI。安装脚本注册随包市场并安装 `kurupal@kurupal`，安装后即可生效，无需重启 Codex。保留解压目录供后续更新。

自动 Hook 需由用户在 **Plugins → KuruPal → Hooks → Review / Trust all** 或聊天输入框的 **Review hooks** 中审阅。安装脚本不修改 Hook 信任记录；用户已关闭的 Hook 保持关闭。设置大小和关注股票不依赖 Hook 信任。

## 从旧名称迁移

如果已安装 `market-pet@market-pet-local`，先在 Codex 插件管理中停用旧插件，再运行新版安装脚本。安装脚本发现旧插件仍启用时会停止，避免两份插件同时响应。

停用时保留旧缓存和源目录，避免旧会话的 Hook 路径失效；尤其不要直接删除 0.1.3 及更早版本的缓存。确认旧会话不再引用后，可用 `codex plugin remove market-pet@market-pet-local` 卸载旧插件，再按需移除旧市场。不要把旧 Hook 的信任记录复制给新插件，也不要重新开启用户已关闭的 Hook。

桌宠设置和关注股票继续使用原应用数据目录，迁移不清空这些数据。

## 功能

- `kurupal` skill：查看或调整大、中、小三档大小，查看、添加、移除、替换最多 5 只六位 A 股代码；诊断连接并发送已验证的任务反馈。
- `UserPromptSubmit` → 开始任务；`PreToolUse` → 工作中（同会话 30 秒节流）或等待输入。
- `PermissionRequest` → 等待用户；只通知，不批准或拒绝权限。
- `PostToolUse` → 仅结构化失败触发失败动作，每次随机选择，不累计失败次数。
- `Stop` → 中性待机，不代表任务成功；`Interrupt` → 取消。明确验证的成功由 skill 发送。

诊断：`python3 <插件目录>/scripts/bridge.py --status`。设置：`python3 <插件目录>/scripts/settings.py`。发送测试事件只证明写入收件箱，不等于屏幕已播放。

## Hook 故障隔离

六类 Hook 共用内联 POSIX shell 入口：缺少 Python、脚本或整个缓存目录时跳过；Python 内部 1 秒超时，宿主 3 秒兜底；通知脚本输出被隔离，外层始终正常退出。缺文件、异常、退出码 2 或卡住只丢弃当次桌宠通知，不阻断 agent。该保护不覆盖旧版本入口及宿主自身故障。设置 skill 的显式命令仍如实报错。

不读取对话、提示词或凭证，不联网，不修改审批。仅写桌宠收件箱与插件事件日志/节流状态。macOS 收件箱为 `~/Library/Application Support/studio.marketpet.desktop/hooks/`；旧目录名用于保留桌宠数据。日志约 512 KB 轮转，收件箱最多 256 条，事件有效期 60 秒。

当前分发适用于 macOS Apple Silicon。Hook 依赖 POSIX shell 和 Python `signal.alarm`，尚未支持 Windows。

卸载新版：`codex plugin remove kurupal@kurupal`；按需移除市场：`codex plugin marketplace remove kurupal`。不会卸载桌宠应用。
