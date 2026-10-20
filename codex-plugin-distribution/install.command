#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null || { echo '请先安装 Python 3。'; exit 1; }
command -v codex >/dev/null || { echo '请先安装支持 plugin 命令的 Codex CLI，并使 codex 可从终端运行。'; exit 1; }
# Keep legacy caches intact: older in-flight hooks can still reference them.
INSTALLED=$(codex plugin list --json --marketplace market-pet-local)
printf '%s' "$INSTALLED" | python3 -c '
import json, sys
data = json.load(sys.stdin)
plugins = data["installed"]
if not isinstance(plugins, list):
    raise SystemExit("无法读取已安装插件，安装已停止。")
if any(p["pluginId"] == "market-pet@market-pet-local" and p.get("enabled") is not False for p in plugins):
    raise SystemExit("请先在 Codex 插件管理中停用旧版 market-pet@market-pet-local，再运行安装。请保留旧缓存，避免旧会话 Hook 路径失效。")
'
codex plugin marketplace add "$ROOT"
codex plugin add kurupal@kurupal
echo 'KuruPal 插件已安装，无需重启 Codex。自动 Hook 需由用户在 Plugins → KuruPal → Hooks → Review / Trust all 或聊天输入框的 Review hooks 中审阅；已关闭的 Hook 保持关闭。桌宠需单独运行。请保留此目录用于后续更新。'
