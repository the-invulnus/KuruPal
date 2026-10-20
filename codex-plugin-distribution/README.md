## Hook 故障隔离（插件0.1.4）

六类装饰性 Hook 统一使用 hooks.json 中的内联 POSIX shell 入口，而不是直接执行版本目录中的脚本：

- Python 不存在或 bridge.py 不可读时跳过；整个旧缓存目录被删除也能正常退出。
- Python 进程内设置1秒 SIGALRM，在脚本执行及输入读取前启动；宿主超时保留3秒作为外层兜底。
- 所有脚本 stdout/stderr 被隔离，外层命令最终 exit 0；Python缺文件常见的退出码2不会再被误认为 Codex 阻断决定，异常文本不会引发Stop反馈循环。
- 故障只丢弃这次桌宠通知，不替 Codex 作批准/拒绝决定，不影响其他插件的安全 Hook。设置 skill 的显式命令仍如实报错，不隐藏配置失败。
- 当前发行平台为 macOS arm64，入口依赖 POSIX shell 和 Python signal.alarm，Windows未支持；不能直接复制过去声称兼容。
- 保护只能作用于新版入口。旧会话仍持有0.1.3或更早命令时，先关闭旧 Hook、更新插件、完全重启 Codex，再由用户审阅新版 Hook。不要用新安装成功推断旧会话已获修复。
- 保护范围是我们启动的通知脚本；宿主自身错误、shell无法启动或系统级故障不在插件可保证的范围内。

验证：精确执行分发 hooks.json 的命令，覆盖缺目录、缺Python、语法错误、PermissionError、exit 2、伪造block输出、卡住和正常交付；6项入口测试及5项原桥接测试通过。只生成新版分发包，保持用户关闭的 Hook 状态，不在当前会话重新安装/信任插件。

## KuruPal 0.1.3

显示名称统一为 KuruPal，内部 market-pet ID 保留以兼容旧安装。Hook 可在客户端 Plugins → KuruPal → Hooks → Review / Trust all，或聊天输入框 Review hooks 入口信任；CLI /hooks 是备选入口。更新后请刷新会话，避免旧 Hook 指向已删除的缓存。用户主动关闭 Hook 时保持关闭。

# KuruPal Codex Plugin 0.1.3

本地生命周期Hook插件。依赖Python 3，以及同一台机器上运行的KuruPal桌宠。当前提供的桌宠应用包为macOS Apple Silicon；桥接脚本也识别Linux/Windows数据目录，但未提供/验证这些平台的应用安装包。插件不包含角色图像或桌宠可执行程序。

## 安装与分享

使用外层MarketPet-Codex-Installer安装包：解压到固定目录，运行install.command。它通过受支持的codex plugin marketplace add和codex plugin add命令安装，不覆盖现有配置。需要支持plugin命令的Codex CLI在PATH中。

安装后在Codex的Hooks管理中审阅并信任当前定义；CLI可输入/hooks。每位接收者需自行信任，更新定义后可能需要重新审阅。若当前会话尚未加载插件，重启客户端或新开会话。桌宠必须单独启动。

整个安装包可直接转发；亦可将外层目录发布为Git仓库，让用户运行codex plugin marketplace add <实际仓库URL>，再安装market-pet@market-pet-local。没有预设或创建远程仓库。单插件ZIP用于手动导入/其他本地插件源，不要将包含市场目录的外层安装包当作单插件上传。

含生命周期Hook的插件目前不符合公共插件目录上架要求；这里是本地/自建源分发。

## 映射

- UserPromptSubmit → task_started。
- PreToolUse → working，同会话30秒限一次，避免每次工具调用都排队。输入询问工具映射waiting_for_user。
- PermissionRequest → waiting_for_user，仅通知，不批准或拒绝权限。
- PostToolUse → 仅当exit_code/exitCode非零、isError/is_error为true或标准shell结束状态行明确非零时触发task_failed。每个失败独立触发，不累计失败次数。任意工具输出中的“error”文字不当成失败。
- Stop → idle中性收尾，不能代表任务成功。明确验证后的成功可通过market-pet技能发送task_succeeded。
- Interrupt → task_cancelled。

没有“正在思考”原生事件。工具执行反馈不等同于覆盖所有推理过程；未知工具结果格式不能可靠判失败，不读取/推断最终回复。已由其他Hook继续的Stop不触发收尾。

## 文件与隐私

命令为python3 "${PLUGIN_ROOT}/scripts/bridge.py"，每次超时3秒。JSON经stdin传入，不拼接为shell命令；不读transcript_path、不保存提示词/工具参数/正文、不访问网络、不改变审批或模型上下文。异常静默，返回空JSON，不阻断Codex。

只写桌宠hooks目录和PLUGIN_DATA下的事件日志/节流状态。macOS收件箱：~/Library/Application Support/studio.marketpet.desktop/hooks/。bridge.jsonl达到约512KB保留一份previous；未运行桌宠时只清理插件自己的过期消息，最多256条。桌宠接受60秒内的事件。

诊断：python3 <插件路径>/scripts/bridge.py --status。发送测试：同命令加--event task_started。写入成功仅证明桥接到收件箱，不等于实际播放。

卸载：codex plugin remove market-pet@market-pet-local。删除插件源前，可运行codex plugin marketplace remove market-pet-local；不会卸载桌宠。

文档核对：
- https://developers.openai.com/plugins/build/plugins
- https://learn.chatgpt.com/docs/hooks

## 0.1.3加载兼容性修复

实测Codex CLI 0.162.0加载根plugin.json时未发现本插件的Hook，且不报告错误。当前改用.codex-plugin/plugin.json兼容清单，不同时包含根plugin.json。安装后已通过app-server hooks/list验证6个Hook均可见、enabled=true、trustStatus=untrusted。安装启用与用户信任是不同步骤。必须重开/hooks列表；如果旧CLI仍缓存结果，退出CLI后重新启动。

## Skill 设置（0.1.3 新增）

搭配 KuruPal 0.3.4+，可直接告诉 Codex“把桌宠调小”“关注 000001 和 600519”“移除 000001”或“查看关注股票”。Skill 调用随包 settings.py，修改共享 settings.json，桌宠约1秒同步，无需右键操作或 Hook 信任。首次启动新版应用迁移旧设置；应用关闭后仍可改配置，下次启动应用。大中小三档，A股六位代码最多5只；操作不涉及交易。
