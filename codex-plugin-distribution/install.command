#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null || { echo '请先安装 Python 3。'; exit 1; }
command -v codex >/dev/null || { echo '请先安装支持 plugin 命令的 Codex CLI，并使 codex 可从终端运行。'; exit 1; }
codex plugin marketplace add "$ROOT"
codex plugin add market-pet@market-pet-local
echo '插件已安装。升级后请完全重启 Codex，防止旧会话继续执行已删除版本路径；若旧 Hook 已出错，先在客户端关闭旧 Hook。请在 Codex 客户端 Plugins → KuruPal → Hooks → Review / Trust all，或聊天输入框的 Review hooks 入口审阅并信任；CLI 也可输入 /hooks。桌宠需单独运行。请保留此目录用于后续更新。'
