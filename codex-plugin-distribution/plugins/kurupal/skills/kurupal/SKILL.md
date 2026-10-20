---
name: kurupal
description: 设置 KuruPal 桌宠大小、查看或增删关注股票列表；诊断桌宠连接或发送已确认的任务反馈。Use when the user asks to configure the pet size or watched stocks, or test its connection.
---

## 设置大小与关注股票

使用相对此 skill 目录的 `../../scripts/settings.py`，将实际绝对路径带引号传给 Python。按用户请求直接执行，无需让用户打开右键设置。

- 查看当前设置：`python3 "<settings-script>"`
- 大小：`python3 "<settings-script>" --size small`，可选 `small`（小，220）、`medium`（中，320）、`large`（大，420）；数字为角色区域逻辑像素。用户说“大一点/小一点”时先读取现有档位，再调整一档；已到边界则说明。仅支持三档，不声称支持任意缩放比例。
- 添加关注：`python3 "<settings-script>" --add 000001 600519`
- 移除关注：`python3 "<settings-script>" --remove 000001`
- 用户明确要替换整个列表：`python3 "<settings-script>" --replace 600519 002594`
- 用户明确要清空关注：`python3 "<settings-script>" --replace`
- 大小可以和一项股票操作放在同一次调用中。添加保留其他股票，移除保留其余股票，重复添加不会重复占位。

只支持最多5只六位A股代码，保留前导零。用户只给股票名称且无法确认代码时，查证或澄清具体股票，不猜测代码、不自行推荐股票。超过5只时说明限制，让用户选择要保留的股票，不悄悄删除旧关注。

脚本的非零退出码代表失败，不能报告成功。成功后用返回的 settings 概括当前大小和完整关注列表；`saved` 仅确认已落盘，不代表已在屏幕上生效。运行中的 KuruPal 0.3.4+ 约1秒同步，关闭时下次启动应用。首次需启动新版桌宠完成旧设置迁移；脚本会明确报告未迁移，遇到此提示不要自行创建空配置覆盖旧设置。

该设置通道不依赖 Hook 信任；不要直接编辑 WebKit 数据库、localStorage 或其他 Codex 配置。股票设置只决定关注对象，不修改行情频率、阈值或执行任何交易。

## 连接和动作反馈

Use the bundled `../../scripts/bridge.py` relative to this skill directory.

- Run `python3 <resolved-script-path> --status` to show local inbox/runtime paths.
- When the user requests a connection test, run with `--event task_started`.
- For explicitly verified task success, use `--event task_succeeded`. Never infer success merely because a turn ends or a command exits zero.
- Other allowed semantic events are working, waiting_for_user, task_failed, task_cancelled.
- The desktop app must be running separately on the same machine; file delivery does not prove on-screen playback.
- Native plugin hooks handle prompt submission, tool execution, structured tool failures, permission requests, interruption and neutral turn completion automatically. Do not duplicate these through per-tool manual calls.
- Read ../../README.md for installation, hook trust and limitations. Do not modify hook-trust records or bypass trust checks. A hook-enabled installation needs the user's review in Codex.
- Do not read transcripts, prompts or credentials to diagnose this integration. The local bridge log stores event names only.
