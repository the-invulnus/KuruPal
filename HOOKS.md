## KuruPal 插件

当前插件名、市场名和 skill 名均为 `kurupal`，完整 ID 为 `kurupal@kurupal`（插件 0.1.5）。安装与旧版迁移见 [插件说明](codex-plugin-distribution/README.md)。安装后即可生效，无需重启 Codex；自动 Hook 仍由用户审阅信任，已关闭的 Hook 保持关闭。

## Hook 故障隔离（0.1.4 起）

六类装饰性 Hook 统一使用 hooks.json 中的内联 POSIX shell 入口，而不是直接执行版本目录中的脚本：

- Python 不存在或 bridge.py 不可读时跳过；整个旧缓存目录被删除也能正常退出。
- Python 进程内设置1秒 SIGALRM，在脚本执行及输入读取前启动；宿主超时保留3秒作为外层兜底。
- 所有脚本 stdout/stderr 被隔离，外层命令最终 exit 0；Python缺文件常见的退出码2不会再被误认为 Codex 阻断决定，异常文本不会引发Stop反馈循环。
- 故障只丢弃这次桌宠通知，不替 Codex 作批准/拒绝决定，不影响其他插件的安全 Hook。设置 skill 的显式命令仍如实报错，不隐藏配置失败。
- 当前发行平台为 macOS arm64，入口依赖 POSIX shell 和 Python signal.alarm，Windows未支持；不能直接复制过去声称兼容。
- 保护只能作用于新版入口。旧会话仍持有0.1.3或更早命令时，先关闭旧 Hook，并保留旧缓存路径；不要用新安装成功推断旧会话已获修复。
- 保护范围是我们启动的通知脚本；宿主自身错误、shell无法启动或系统级故障不在插件可保证的范围内。

验证：精确执行分发 hooks.json 的命令，覆盖缺目录、缺Python、语法错误、PermissionError、exit 2、伪造block输出、卡住和正常交付；6项入口测试及5项原桥接测试通过。只生成新版分发包，保持用户关闭的 Hook 状态，不在当前会话重新安装/信任插件。

## Skill 设置功能（插件0.1.2 / 桌宠0.3.4+）

可以直接要求 Codex“桌宠调小”“关注 000001 和 600519”“移除 000001”“查看关注股票”。插件通过 settings.py 操作应用数据目录下的 settings.json，与右键设置共用；不是动作 Hook 队列，不会因60秒过期丢失。首次先启动新版桌宠迁移设置，之后即使应用关闭也能修改。

## Codex插件0.1.1：修复Hook未加载

此前0.1.0仅验证插件启用和手动桥接，遗漏自动Hook发现检查。Codex 0.162.0实际plugin/read返回hooks=[]，hooks/list也没有插件事件，无解析报错；不能仅归因未信任。已移除根可移植plugin.json，使用.codex-plugin/plugin.json及hooks/hooks.json。官方命令重装0.1.1后，在用户Home和项目目录均确认6个插件Hook列出且untrusted。用户需重新打开/hooks列表审阅。未改写信任记录。分发包更新为0.1.1，旧包应弃用。

## Codex插件安装（新增）

已提供原生 Hook 插件，见 codex-plugin-distribution/README.md。安装包为 `KuruPal-Codex-Installer-0.1.5.zip`，ID 为 `kurupal@kurupal`；还需用户在 Codex 中审阅信任 Hook，CLI 入口为 /hooks。不能把“已安装”当作“Hook已信任”。下方 shell 脚本仍可单独使用。

# Agent Hook 接口（0.3.0）

启动 KuruPal 后，外部 Agent 的 Hook 可调用随包脚本：

```sh
/path/to/agent-hook.sh task_started
/path/to/agent-hook.sh waiting_for_user
/path/to/agent-hook.sh task_succeeded
/path/to/agent-hook.sh task_failed
```

| 事件 | 动作 |
| --- | --- |
| task_started | 偷偷确认 |
| working | 偷偷确认 / 藏住不安，随机 |
| waiting_for_user | 紧张祈祷 |
| task_succeeded | 手机兴奋 / 捂嘴狂笑，随机 |
| task_failed | 放空 / 抱头崩溃 / 泪崩，等权随机 |
| task_cancelled | 待机 |

每次有效失败事件直接选择一种失败动作，不统计次数，不加额外触发概率。所有事件带有对应的原创陪伴文案，随该动作首帧开始显示约7秒。动作等待期间不会提前替换气泡。

仍支持直接动作：`idle`、`happy`、`celebrate`、`joyfulLaugh`、`sad`、`panic`、`pray`、`tearful`、`idlePeek`、`idleSmug`、`idleNervous`，例如 `agent-hook.sh happy`。直接动作Hook也有对应文案。

右键动作和Hook统一先进先出，不能打断当前动作，包括自动待机小动作。基础idle循环在当前一轮结束时消费下一项；其他动作整段播放完再消费下一项。重复动作仍保留，不合并；取消事件也排队。队列最多64项，超出时界面显示错误，不覆盖已排队动作。无外部事件时，四种待机仍按原来的间隔和权重运行。

脚本仅依赖macOS/Linux系统shell，不需要Python、Node或网络。脚本成功只表示写入成功，不等于应用已播放。

应用读取：

- macOS：`~/Library/Application Support/studio.marketpet.desktop/hooks/`
- Linux：`${XDG_DATA_HOME:-~/.local/share}/studio.marketpet.desktop/hooks/`

每次写入独立JSON，先写临时文件，再原子重命名为`.json`。语义事件示意：

```json
{"event":"task_failed","createdAt":1792454400000}
```

或直接动作：

```json
{"action":"happy","createdAt":1792454400000}
```

时间戳示例需替换为当前Unix毫秒。入站事件有效期60秒，已接受进入队列的动作会完整排队，不受此有效期影响。单文件最多4KB，每轮最多读取32个，间隔约400ms；按文件修改时间读取，同时间戳按文件名排序。队列仅保存在内存，退出应用后清空。

尚未修改Codex、ChatGPT或WorkBuddy配置。不同客户端的真实Hook接口需要独立适配，不能把普通轮次结束当作已确认成功。当前提供的是本地可调用协议及事件到动作/文案的映射。

动作07：`agent-hook.sh joyfulLaugh`，对应仰头含泪大笑，仍按FIFO排队。当前仅新增独立动作入口，未自动改动已有成功/失败随机候选池。

0.3.0新增关注股票采集，与Hook共用FIFO。仅行情项会在播放前剔除已移除股票或排队超过3分钟的报价；Hook事件原有语义和队列规则不变。
