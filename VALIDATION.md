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

## KuruPal 0.3.7

已对用户卡死进程采样，并对照Tauri源码确认 popup持有资源表锁 / set_checked重入等待的死锁。修复菜单IPC串行化及无变化的重复更新；菜单文案简化。29项TS测试（含2项菜单并发回归）及应用release构建通过，确认产物版本0.3.7。未做UI视觉检查。

## KuruPal 0.3.6

点击穿透与菜单栏恢复入口已完成，TypeScript/Vite及Rust release构建通过，确认应用版本0.3.6。原生主线程串行切换，重启默认关闭。按用户约定未进行UI视觉验收；需用户确认本机穿透与菜单栏取消体验。

## KuruPal 0.3.5 / 插件0.1.3

应用构建通过；检查产物 CFBundleName=KuruPal、版本0.3.5、ICNS 与新生成图标一致。5项插件测试通过，README 本地链接、skill 图标路径与插件头像字段验证通过。生成 KuruPal-Codex-Installer-0.1.3.zip、KuruPal-Codex-Plugin-0.1.3.zip 和 KuruPal-0.3.5-macOS-arm64.zip。未做前端视觉验证；保留用户关闭 Hook 的状态，未重新安装当前会话插件。

## 2026-10-20 · 桌宠 0.3.4 / Codex 插件 0.1.2：Skill 管理设置

- Skill 支持查看大小与关注列表、三档大小修改、增删/替换/清空六位 A 股代码（最多5只）。脚本 scripts/settings.py，标准库实现；不依赖自动 Hook 信任。
- 桌宠启动将 localStorage 的 pet-size/watchlist 迁移至 app_data_dir/settings.json；已有共享配置优先，不覆盖。之后右键和 skill 共用该配置，约1秒自动同步，关闭期间修改在下次启动生效。首次迁移前脚本明确失败，不创建默认空列表覆盖旧设置。
- 原子替换配置、settings.lock 目录锁协调两个写入端、无效输入不写入；异常退出遗留锁时明确报错，需排查持锁进程后处理。脚本 saved 表示配置落盘，不宣称前端已应用。
- 27项 TS 测试、5项原插件测试、3项 Python 设置测试、1项 Rust 迁移/合并/锁测试通过。未检查前端视觉效果。
- 插件 0.1.2 已通过官方 CLI 安装，重新验证 skill 描述及6个 Hook 均可发现；Hook 仍待信任，设置功能不受此影响。

## Codex插件0.1.1：修复Hook未加载

此前0.1.0仅验证插件启用和手动桥接，遗漏自动Hook发现检查。Codex 0.162.0实际plugin/read返回hooks=[]，hooks/list也没有插件事件，无解析报错；不能仅归因未信任。已移除根可移植plugin.json，使用.codex-plugin/plugin.json及hooks/hooks.json。官方命令重装0.1.1后，在用户Home和项目目录均确认6个插件Hook列出且untrusted。用户需重新打开/hooks列表审阅。未改写信任记录。分发包更新为0.1.1，旧包应弃用。

## 2026-10-20 · Codex插件0.1.0

已创建codex-plugin-distribution：可移植plugin.json、兼容manifest、6种生命周期Hook、Python标准库桥接、诊断技能、自建市场和安装脚本。codex-cli 0.162.0官方命令安装market-pet@market-pet-local，查询确认installed=true、enabled=true，安装缓存0.1.0。未改写Hook信任记录，用户须在Codex Hook审阅界面或CLI /hooks信任后自动运行，未声称自动事件端到端已验证。

已验证5项桥接测试；安装后手动发送task_started，事件写入桌宠收件箱，一秒后被桌宠轮询消费。不检查UI效果。Stop仅中性idle，不等同任务成功；结构化工具失败各自触发task_failed；working每会话30秒节流。明确成功可通过插件技能显式发送。

分发包：releases/MarketPet-Codex-Installer-0.1.0.zip（包含自建市场与install.command，需Codex CLI和Python3）；单插件包：releases/MarketPet-Codex-Plugin-0.1.0.zip。两包均验证ZIP和JSON。桌宠App单独分发并运行，同机通信不需要网络。含Hook插件官方暂不支持公共目录上架；可本地或Git市场分发。正式分发的图像/角色授权仍独立于此纯代码插件包。

## 2026-10-20 · 0.3.3 行情诊断日志

新增本地JSONL日志：~/Library/Application Support/studio.marketpet.desktop/logs/market.jsonl。记录采集开始、耗时、报价/错误、交易时段过滤、逐股票阈值/冷却/断档基准重置、动作入队和开始播放。单文件约2MB轮转，保留一份previous；不记录代理凭证或采集器stderr，前端继续静默。旧版本没有落盘日志，无法追溯每次播放。

本次在正常网络环境复测000001成功，约14.51秒返回11.44元、日涨幅-1.8%，随后同样环境查询600519和002594，约15.46秒返回两只均ProxyError、无报价。说明采集链路当前仍有失败，单只一次成功不代表稳定。只读检查旧版WebKit本地状态：关注600519和002594，均有报价样本，002594有13:38:37提醒判定时间，但旧版无法确认实际播放。27项测试及构建通过；未做UI视觉检查。交付releases/MarketPet-0.3.3-Transparent-macOS-arm64.zip。

## 2026-10-20 · 0.3.2 扩充随机语录

随机闲聊从4句扩充为8句，新增此前确认加入的四条作品/社区梗，分类和核查限制见DIALOGUE.md。保留30～60秒间隔、不连续重复、7秒显示、动作排队及股票策略；保留移除角色悬停提示的修复。发布包：releases/MarketPet-0.3.2-Transparent-macOS-arm64.zip。未做UI视觉检查。

## 2026-10-20 · 0.3.1 近期价格变化提醒

- 每分钟采集，按上海时间周一至周五09:30–11:30、13:00–15:00运行；午休/夜间/周末暂停。尚未接入节假日日历，节假日工作日仍可能查询旧报价；接口无上游交易时间，不能据本地采集时间确认实时性。
- 每只股票当天第一次有效报价与昨收比较，绝对涨跌幅达到1%提醒。随后按本次价/基准价−1计算：相邻连续采样约1分钟达到0.5%，或约5分钟窗口达到1%才提醒；小波动静默。
- 每只股票提醒冷却5分钟。价格基准、窗口和冷却本地保存，同日重启不会重新触发“首次”；上海自然日变化重置，移除股票清除状态。采样间隔超过90秒重建短期基准，不把断线、午休或休眠后的变化标成一分钟涨跌。
- 气泡显示代码、最新价和明确比较区间“较昨收/近1分钟/近5分钟”，颜色和动作使用该区间变化，原始日涨幅独立保留。首次日变化3%、短期变化1.5%使用更强烈动作，其余使用普通动作；均随机选择并按FIFO播放。
- 失败继续静默重试。行情数据源与采集器未修改；先前真实查询返回ProxyError的问题仍未验证解决。阈值是桌宠通知默认值，未经行情回测，不是投资判断标准。
- 27项逻辑测试通过；未进行UI视觉检查。发布包：releases/MarketPet-0.3.1-Transparent-macOS-arm64.zip。
- 字段依据：https://github.com/akfamily/akshare/blob/main/docs/data/stock/stock.md 。时段依据：https://one.sse.com.cn/onething/gptz/ 。下方为历史记录，以上方最新行为为准。

## 2026-10-20 · 0.3.0 关注股票联动

- 右键“设置关注股票…”打开轻量编辑窗口，可增删六位代码、最多5只；即时保存到本机，重启恢复，默认空列表。删除全部后不再发起查询。
- 关注非空时立即尝试首轮，然后按每60秒启动一轮，逐只调用stock_bid_ask_em。每轮不重叠，原生采集器总超时55秒；修改列表不绕过频率限制，旧在途结果丢弃。当前按用户要求持续每分钟查询，未按交易日历暂停。
- 气泡显示代码、最新价及相对昨收的“当日涨跌幅”，上涨红色、下跌绿色、持平灰色；首次快照展示一次，随后价格和涨幅均未变化则不重复表演。
- 日涨幅≥3%：捂嘴狂笑/仰头含泪大笑；0～3%：手机兴奋/脑内小赚；-3%～0：放空/藏住不安；≤-3%：抱头崩溃/泪崩。每组随机选一个，持平为偷偷确认。这是角色表现规则，不是交易所涨跌停判定。
- 行情和Hook共用FIFO，不打断当前动作。待播行情超过3分钟或股票已移除时跳过，避免展示陈旧报价；正在播放的动作仍完整结束。
- 采集失败静默处理，下一分钟重试，不显示错误气泡、错误状态或触发动作；保留上次有效快照用于去重。采集时间仅是本机获取时间，非交易所时间。
- 已重新携带macOS arm64 market-data采集器，用户无需安装Python。未修改上游接口或关闭TLS/代理校验。
- 验证：19项TypeScript测试、2项Python测试及macOS打包通过。随包采集器一次真实调用约20.91秒返回合法JSON，但000001查询失败为ProxyError，尚未验证真实报价成功。不做UI视觉检查，交由用户验收。
- 交付：releases/MarketPet-0.3.0-Transparent-macOS-arm64.zip。

## 2026-10-20 · 0.2.3 更新

13项测试、TypeScript/Vite及macOS arm64应用构建通过。

- 气泡按文案自然宽度收缩、水平居中，最长为窗口宽度减20逻辑像素，长句自动换行；不再整条铺满。
- 随机闲聊间隔缩短至30～60秒（在下一次基础待机循环边界显示），仍显示7秒、不连续重复；Hook或手动动作会推迟闲聊。
- 现有采集器stock_bid_ask_em获取行情快照，并只提取最新价/当日涨幅/代码/本地采集时间/来源。它未返回或保存历史价格序列，涨幅不是相邻两次采集之间的涨幅。
- 交付：releases/MarketPet-0.2.3-Transparent-macOS-arm64.zip。按用户约定不做前端视觉检查。

## 2026-10-20 · 0.2.2 更新

13项测试、TypeScript/Vite和macOS arm64构建通过；dist包含11项动作，新图集与源文件字节一致。

- 接入画布“动作07透明版｜仰头含泪大笑·无包开衫Q版”，卡片dc0dbf18e9504d83bb4ed923dc15105d；新增稳定ID `joyfulLaugh`，右键标签“仰头含泪大笑”，直接Hook也可调用。
- 原透明视频保存至assets/transparent/joyful-laugh.webm，来源更新到sources.json。生成320像素RGBA图集，121帧、24fps、约5.04秒，Alpha实际解码校验见qa/action07-alpha-report.json。
- 现有动作ID、FIFO、待机频率和气泡规则不变。不进行UI视觉检查。
- `scripts/build_transparent.py --action joyfulLaugh` 可仅重建单个动作，其他图集不重新生成。
- AKShare本次只评估联动方案，未重新启用自动行情采集。本机一次现有worker采样返回ProxyError，不能推导接口整体故障率。
- 交付：releases/MarketPet-0.2.2-Transparent-macOS-arm64.zip。

## 2026-10-20 · 0.2.1 更新（覆盖此前行为说明）

- 所有右键和Hook动作统一FIFO排队，含idle、取消、重复动作；当前动作或待机循环结束后再播放下一项，不再打断或清空队列。上限64，超出显式提示。
- Hook支持语义事件，详见HOOKS.md；每次失败等权随机选择sad/panic/tearful，不统计失败次数。
- 增加角色上方气泡：闲聊90～180秒一次，显示7秒，不连续重复；Hook文案随动作首帧显示。语录来源和原创文案区分见DIALOGUE.md。为气泡保留90逻辑像素透明空间，三档角色尺寸不变。
- 修复切换闪屏：保留已显示画面，下一段首帧离屏绘制后原子替换；加载失败保留上一帧；队列动作之间不先插播idle。
- 13项TypeScript测试通过；TypeScript/Vite和macOS arm64原生app构建成功，脚本语法及无效事件拒绝检查通过。未进行前端视觉验收，按用户要求交由用户直接查看。
- 当前交付为releases/MarketPet-0.2.1-Transparent-macOS-arm64.zip；客户端实际Hook配置仍未自动安装。

## 2026-10-20 · 0.2.0 透明桌宠

- `npm test`：11项通过，涵盖素材协议、待机间隔/权重/去重、Hook事件校验与队列、帧图播放结束/循环/取消。
- `npm run bundle -- --bundles app`：TypeScript、Vite和macOS arm64原生构建成功，app约89MiB。
- 10张RGBA图集的模式、尺寸、Alpha范围(0..255)、清单引用及dist文件一致性校验通过；dist不含白底MP4。
- `sh -n scripts/agent-hook.sh`通过。Hook尚未做客户端端到端联动验收。
- 用户要求停止前端效果检查。此前仅启动过精简版，不将截图或编译结果视为透明显示、右键菜单、尺寸切换的最终视觉验收。最新大小菜单及随机待机交由用户直接检查。
- 交付：`releases/MarketPet-0.2.0-Transparent-macOS-arm64.zip`，含app、调用脚本和HOOKS.md。未进行其他平台构建或签名公证验收。

---

# 验证记录

## 2026-10-20：迁移后验证

工程根目录：`/Users/zzbin/developer/codebase/market-pet`。

- 源工程重命名移动前后，136个源文件/制作素材的SHA-256一致，记录见 `archive/migration.json`。此校验发生在交接文档更新、画布快照分片合并之前。
- 虚拟环境23个文本文件中的旧绝对路径已修正；`.venv/bin/python -m unittest discover -s backend`：2项通过。
- `npm run build`：TypeScript / Vite生产构建通过。
- `npm test`：8项通过，覆盖行情阈值、冷却、滞后、交易时段、素材协议、随机待机间隔/权重/重复抑制/中断。
- 白底和透明两份manifest各10条引用，所有文件存在。
- 两个画布快照分别36、33张卡片，含完整generation参数与稳定媒体引用。
- 本次没有启动浏览器或重新做原生界面验收，也没有重新测试网络行情。

## 透明素材阶段的历史验证

十条VP9 WebM由画布去背景生成，已用libvpx显式解码Alpha、检查整段与首/中/尾采样。报告见 `assets/transparent/qa/alpha-report.json`，复核脚本见同目录 `check_alpha.py`。部分发丝/手臂夹角仍存在白底残留。

Alpha存在不等于系统WebView显示已验证；透明素材尚未替换到应用默认包或最新白底安装包。

## 原型与打包阶段的历史验证

早期原型做过部分Chromium与macOS原生UI检查，详细原记录保留在 `archive/legacy-docs/VALIDATION.md`，不能视为当前每轮素材都经过同样的端到端验收。

最新白底应用 `releases/MarketPet-Kurumi-Idle-r2-macOS-arm64.zip` 已成功release构建与ZIP校验；本次迁移未重新打包。较新的DMG构建曾因hdiutil“设备未配置”失败；早期36MB旧DMG曾验证通过，两者是不同阶段产物。

未完成：真实行情有效报价端到端成功、外部Agent事件、跨平台原生WebView透明显示与打包、全窗口点击穿透、托盘、开机自启、节假日表。当前最强泪崩仅有手动预览，不能宣称连续错误自动触发已经实现。
