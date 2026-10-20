## 2026-10-20 · 0.2.2 更新

- 接入画布“动作07透明版｜仰头含泪大笑·无包开衫Q版”，卡片dc0dbf18e9504d83bb4ed923dc15105d；新增稳定ID `joyfulLaugh`，右键标签“仰头含泪大笑”，直接Hook也可调用。
- 原透明视频保存至assets/transparent/joyful-laugh.webm，来源更新到sources.json。生成320像素RGBA图集，121帧、24fps、约5.04秒，Alpha实际解码校验见qa/action07-alpha-report.json。
- 现有动作ID、FIFO、待机频率和气泡规则不变。不进行UI视觉检查。
- `scripts/build_transparent.py --action joyfulLaugh` 可仅重建单个动作，其他图集不重新生成。
- AKShare本次只评估联动方案，未重新启用自动行情采集。本机一次现有worker采样返回ProxyError，不能推导接口整体故障率。
- 交付：releases/MarketPet-0.2.2-Transparent-macOS-arm64.zip。

## 2026-10-20 · 0.2.0 接管更新（优先于下方历史记录）

- 新应用只显示透明角色，右键菜单提供十个动作、桌宠大小（小220 / 中320 / 大420逻辑像素）和退出。默认中档，尺寸本地保存，重启恢复；调整时保持底部位置并限制在当前屏幕工作区。
- 四种待机：基础呼吸眨眼持续循环；25～55秒后在下一次循环边界，按4:3:1权重选择偷偷确认、脑内小赚、藏住不安，排除上一次自动候选。权重不是长期固定百分比。播放完重新计时。Hook可中断自动待机小动作。
- 删除前端设置面板、行情轮询、台词气泡、轮播、双击动作和导入入口。旧行情/导入代码与白底源素材保留在源码中，不随当前应用启用；包不再携带Python采集器。
- 默认资源改为 `public-app/kurumi/` 的十张RGBA PNG动画图集。由 `scripts/build_transparent.py` 用libvpx-vp9实际解码现有透明视频生成，每帧320×320、24fps，保留121/145帧长度。Vite只打包public-app，原public白底素材保留。播放器按实际帧数结束，并支持循环边界回调。大档由320帧图放大，清晰度需用户验收。
- 本地通用Hook入口及调用脚本见 `HOOKS.md`、`scripts/agent-hook.sh`。有事件有效期、队列上限、相邻待播去重。未修改Codex/ChatGPT/WorkBuddy配置，客户端状态映射与低概率泪崩策略仍需独立适配。
- 构建：`npm test`、`npm run bundle -- --bundles app`。资源重建需系统ffmpeg、Python Pillow，运行 `python3 scripts/build_transparent.py`；普通构建使用已生成图集即可。
- 按用户要求，不继续做前端视觉检查，由用户直接验收。不能把编译通过当作透明窗口、右键或所有动画视觉效果的验收。

---

以下为此前版本的记录，其中界面、默认素材、自动行情及打包方式以本节为准。

# 当前素材与播放约定

完整的角色标准、参考图分工、分镜模板及制作历程见 [handoff.md](handoff.md) 第5～10节。实际生成提示词存于 `production/canvas/cardigan.json`。

## 两套素材

- `public/kurumi/`：当前内置白底MP4、静态基准和清单。
- `assets/transparent/`：通过画布去背景得到的十条VP9 Alpha WebM及清单、来源、离线验证报告。

白底与透明素材使用同一组动作ID。应用启动默认包由 `src/media.ts` 的 builtinPack() 决定，并非自动读取透明目录。修改默认包时同步维护 `public/kurumi/manifest.json`。当前导入包写入IndexedDB，但应用启动尚未恢复它，不能宣称重启自动沿用。

| ID | 文件基名 | 用途 |
|---|---|---|
| idle | idle-loop | 基础呼吸眨眼循环 |
| idlePeek | idle-peek | 想看行情又忍住 |
| idleSmug | idle-smug | 脑内小赚、收住笑意 |
| idleNervous | idle-nervous | 捏袖口藏住不安 |
| panic | panic | 抱头崩溃 |
| happy | excited | 手机兴奋 |
| celebrate | laugh | 双手捂嘴狂笑 |
| pray | pray | 低头跪坐祈祷 |
| sad | vacant | 泄气放空 |
| tearful | tearful | 原作失神泪崩修订版 |

白底后缀为 `.mp4`，透明后缀为 `.webm`。sleep/offline/hello只有协议入口，没有专用视频，回退idle。

## 导入协议

解压素材ZIP后，在设置里同时选择 `manifest.json` 和其引用的媒体。当前不直接导入ZIP，不支持子目录文件名，总大小上限100MB。

Clip支持 `image`（PNG/WebP）、`sprite`（PNG/WebP网格）及 `video`（MP4/WebM）。精灵需要frameWidth、frameHeight、columns、frames、fps正整数，frames最多600，fps最高60。durationMs可选500～30000ms。文件类型与扩展名必须对应。

事件视频默认不循环，以实际ended切回休息状态；不要在视频里安排回正或硬切。静态/精灵临时动作仍由durationMs/默认4500ms返回。待机基础循环应衔接首尾；随机小动作最终恢复基准站姿。

## 画面约束

无包米黄色开衫、原作头脸、约3头身短躯干短四肢。事件开场复现基准站姿，后续允许侧面、近景和特写，不要求全程全身；待机则固定全身、大小位置稳定。素材里不写字幕、股价、UI。

透明输出已用libvpx实际验证Alpha，不能凭普通ffprobe显示yuv420p或播放器黑底断言不透明。原生WebView的Alpha显示仍需在目标系统验证；部分发丝/手臂夹角有少量白底残留。

早期精灵样例与历史占位素材说明保存在 `archive/legacy-docs/ASSETS.md`，不作为最新演出约束。
