# KuruPal

项目仓库：[the-invulnus/KuruPal](https://github.com/the-invulnus/KuruPal)。本次仅同步源码与素材，暂不发布预编译安装包；安装时按下文从源码构建。

透明桌宠，支持随机待机、角色语录、Codex 任务反馈和 A 股行情提醒。用户可以直接通过 Codex 设置桌宠大小和关注股票。

**本文面向代用户安装项目的 agent。** 用户要求安装时，执行下面的步骤并验证结果，不只返回一份操作教程。用户只要求解释或审阅时，不执行安装。使用用户提供的真实仓库链接；本文不预设 GitHub 账号或 Release URL。

当前桌面版本 **0.3.8**、插件版本 **0.1.4**。目前验证的平台为 **macOS Apple Silicon（arm64）**；其他平台尚未验证，不安装不匹配架构的包。

## 1. 获取项目与检查环境

- 如尚未克隆，将用户提供的仓库克隆到持久目录，进入仓库根目录。插件市场依赖这个路径，不要使用临时目录。
- 检查系统、架构及已有 KuruPal / Market Pet 安装。macOS 可运行 `uname -s`、`uname -m`。
- 检查 `python3 --version`、`codex --version`、`codex plugin --help`。预编译桌面包包含行情采集器，但 **Codex 插件仍需要 PATH 中的 Python 3**。
- 如没有 Codex CLI，使用现有 Node.js/npm 安装 `npm install -g @openai/codex`；若 CLI 无 plugin 子命令则更新后验证。不要覆盖用户登录信息或其他插件配置。仅安装桌面客户端不保证 CLI 可用。
- 缺少系统依赖时，按系统官方安装方式补齐并遵守执行环境授权要求。不要把工具未安装误报成项目故障。

## 2. 安装桌面应用

### 优先使用对应平台发行包

先检查本地 `releases/KuruPal-0.3.8-macOS-arm64.zip`，或用户真实仓库的 Release 中对应平台资产。只下载实际存在的资产；有校验和时核对后解压。没有发行包则从源码构建，不猜测下载 URL。

### 从源码构建（macOS arm64）

需要 Node.js/npm、Rust stable/Cargo、Xcode Command Line Tools、Python 3/venv。先检查现有环境；缺少 Xcode 工具时运行 `xcode-select --install` 并等用户完成系统窗口。

在仓库根目录执行：

```sh
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python scripts/build_sidecar.py
npm run bundle -- --bundles app
```

- 先构建 sidecar，再构建桌面。`build_sidecar.py` 根据当前 Rust 主机 target 生成 `src-tauri/binaries/market-data-<target>`，不要复用其他架构二进制。
- 正常构建使用 `public-app/kurumi/` 中已经生成的透明图集，无需 FFmpeg、生成视频或 AI 服务。确保 manifest 及全部 PNG 存在；若仓库使用 Git LFS，先执行 `git lfs pull`，不能拿 LFS 指针文件打包。
- 产物为 `src-tauri/target/release/bundle/macos/KuruPal.app`。任何一步失败，记录具体错误、修复后重试，不宣称安装完成。

### 复制并启动

将实际解压或构建得到的 `KuruPal.app` 安装至 `~/Applications/KuruPal.app`。更新时先退出正在运行的旧桌宠，将旧应用移到备份路径，再复制新应用；保留用户数据。避免新旧应用同时消费事件。

```sh
mkdir -p "$HOME/Applications"
# <app-source> 必须替换为实际存在的 KuruPal.app 完整路径。
ditto "<app-source>" "$HOME/Applications/KuruPal.app"
open "$HOME/Applications/KuruPal.app"
```

发行包不保证 Apple 签名或公证。若系统拦截，提示用户通过系统提供的“打开”或安全性确认入口审阅，不自动移除 quarantine 或关闭 Gatekeeper。

首次启动自动迁移旧版大小和关注列表。确认应用进程启动后继续，不必替用户检查动画视觉效果。

## 3. 安装 Codex 插件

在仓库根目录执行：

```sh
codex plugin marketplace add "$PWD/codex-plugin-distribution"
codex plugin add market-pet@market-pet-local --json
```

也可运行 `sh codex-plugin-distribution/install.command`。确认成功退出，返回版本为 **0.1.4**，保存实际 `installedPath` 用于下一步。

显示名称为 **KuruPal**；内部插件 ID 保持 `market-pet@market-pet-local`，用于兼容旧安装。不要额外安装一个同功能插件。配置源为 `codex-plugin-distribution/plugins/market-pet/.codex-plugin/plugin.json`，不要直接编辑插件缓存或添加会遮蔽兼容清单的根级 `plugin.json`。

**更新插件后刷新会话，再信任 Hook。** 正在运行的会话可能缓存旧版本脚本路径；旧缓存被清理时会报 `can't open file .../bridge.py`，并阻塞工具调用甚至重复触发 Stop 错误。遇到此情况，提示用户在客户端暂时关闭旧 Hook，完全退出并重开 Codex，再审阅当前版本。不要通过补假脚本、写信任哈希或重复重试来掩盖问题。

插件0.1.4内联入口在脚本或Python缺失时跳过，执行错误静默返回成功，卡住约1秒终止；不会把缺文件的退出码2交给Codex误判为阻断。只隔离本插件的可选通知，不更改其他Hook或审批规则。旧会话缓存的旧命令不受新保护，必须刷新会话；POSIX入口仅用于当前macOS发行版。

## 4. 用户审阅 Hook

客户端已有两个入口：

- **Plugins → KuruPal → Hooks → Review / Trust all**。
- **聊天输入框中的 Review hooks** 提示。

CLI 的 `/hooks` 是备选入口，不要求桌面用户必须使用它。先完成可自动执行的安装和验证，再简短引导用户点击。不要替用户伪造信任或改写 `hooks.state`；若用户明确关闭 Hook，保持关闭。

应发现六类插件 Hook：`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`PermissionRequest`、`Stop`、`Interrupt`。如果 Installed 为0，检查插件启用状态、清单和会话刷新；“未发现”与“已发现但待信任”是不同问题。安装成功不等于 Hook 自动触发成功。

## 5. 验证与交付

使用安装命令返回的真实路径，不能硬编码开发者用户名：

```sh
python3 "<installedPath>/scripts/bridge.py" --status
python3 "<installedPath>/scripts/settings.py"
```

设置脚本应返回 `status: current`、大小和关注列表。如果提示先启动新版应用，先启动再重试；不要创建空配置覆盖尚未迁移的旧列表。

安装验证可发送一次 `python3 "<installedPath>/scripts/bridge.py" --event task_started`，检查事件文件被应用消费。文件消费不等于视觉验收，手动发送成功也不等于自动 Hook 已获信任。用户信任后，可用一条普通消息确认自动触发。

交付时报告：桌面安装路径和版本、插件版本、设置是否可读，以及 Hook 已发现/待信任/已验证自动触发的实际状态。不要声称未验证的效果。

## 点击穿透

右键桌宠，勾选“点击穿透”。开启后鼠标点击和拖动落到下方应用，桌宠自身不再接收右键。要取消，在 macOS 菜单栏右键 KuruPal 头像，取消勾选“点击穿透”；左键菜单栏头像也可打开菜单。两处均明确显示“点击穿透：已开启”或“点击穿透：已关闭”，文字与勾选状态同步。重启默认关闭，不改变大小或关注列表，也不影响动作、气泡、行情或 Hook。

## 用户可以直接这样说

- “把桌宠调小一点” / “把桌宠设为大号”
- “关注 000001 和 600519”
- “移除 000001” / “查看关注股票” / “清空关注列表”

Skill 显示名是 KuruPal，兼容调用名为 `$market-pet:market-pet`。大小为小220、中320、大420逻辑像素；A股代码为六位数字，保留前导零，最多5只。示例代码仅说明输入格式。

设置功能不依赖 Hook 信任。运行中约1秒同步，关闭时修改下次启动生效；脚本 `saved` 只确认落盘。用户未指定股票和大小时，保留默认值或已有设置。

## 数据与诊断

为保留旧设置，bundle identifier 和 macOS 数据目录仍使用 `studio.marketpet.desktop`：

`~/Library/Application Support/studio.marketpet.desktop/`

| 路径 | 用途 |
| --- | --- |
| `settings.json` | 大小与关注列表；右键和 skill 共用 |
| `settings.lock/` | 配置写入锁；持续报忙先检查写入进程，不盲删 |
| `hooks/` | 事件队列，消费后删除 |
| `logs/market.jsonl` | 行情请求、阈值过滤、动作日志，自动轮转 |
| `codex-plugin/bridge.jsonl` | 默认桥接日志；设置了 PLUGIN_DATA 时以 `--status` 为准 |

插件不向外部发送对话、命令或日志。行情采集器通过 AKShare 请求股票报价，失败时前端静默，通过本地日志排查。

工作日上海时间09:30–11:30、13:00–15:00按分钟采集，尚无节假日日历。当天首次有效报价与昨收相比绝对变化≥1%提醒；随后约1分钟≥0.5%或约5分钟≥1%提醒，每只股票冷却5分钟。行情可能延迟或失败，不进行证券交易。

所有动作排队播放。Stop 只恢复待机，不把“回合结束”当成任务成功。详细映射见 [HOOKS.md](HOOKS.md)，素材和语录见 [ASSETS.md](ASSETS.md)、[DIALOGUE.md](DIALOGUE.md)。

## 开发与发布

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
cargo test --manifest-path src-tauri/Cargo.toml settings::tests
npm run build
```

- 前端 `src/`，原生层 `src-tauri/src/`，行情 worker `backend/`，插件 `codex-plugin-distribution/`。
- 应用与插件共用头像源 `assets/branding/kurupal-avatar.png`。应用多尺寸图标通过 Tauri CLI 生成，插件头像随包存放于 `plugins/market-pet/assets/avatar.png`。
- 发布必须携带 `public-app/kurumi/` 全部运行时图集、插件隐藏目录 `.codex-plugin/` 和市场目录 `.agents/`。桌面 ZIP 建议上传真实仓库 Release。
- 更新插件修改源目录并递增版本，然后用官方安装命令；不要直接改缓存，更新后提醒刷新会话。
- 当前未指定代码许可证；公开发布前由维护者确定代码和角色素材的授权范围，不将源码可下载等同于无限制授权。
- 历史记录见 [handoff.md](handoff.md)；旧 README 在 `archive/README-before-kurupal.md`，安装以本文为准。

命令依据：[Codex 官方插件 CLI 源码](https://github.com/openai/codex/blob/main/codex-rs/cli/src/plugin_cmd.rs)、[插件清单定义](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/manifest.rs)。客户端信任入口依据本项目用户提供的截图，具体文字可能随客户端版本变化。
