# 构建与运行素材

仓库仅保留当前应用和插件使用的素材：

| 路径 | 用途 |
| --- | --- |
| `public-app/kurumi/manifest.json` | 11 个动作的帧数、尺寸、帧率和文件映射 |
| `public-app/kurumi/*.png` | 运行时透明 RGBA 动画图集 |
| `assets/branding/kurupal-avatar.png` | KuruPal 头像源，用于生成图标 |
| `src-tauri/icons/` | Tauri 原生应用图标 |
| `codex-plugin-distribution/plugins/market-pet/assets/avatar.png` | Codex 插件及 skill 图标 |

Vite 的 `publicDir` 为 `public-app`，播放器通过 `src/media.ts` 加载其中的动作清单。普通构建直接使用已生成图集，不需要原视频、参考图、FFmpeg 或 AI 服务。

参考图、原始透明视频、白底视频、制作中间文件、质量检查截图及历史输出仅保留在维护者本地，已从 Git 跟踪中移除并加入 `.gitignore`。`scripts/build_transparent.py` 是维护者使用本地原视频重新生成图集的可选工具，不属于安装或普通构建步骤。

文档中的历史制作记录可能提到这些本地路径，不代表它们仍随仓库分发。角色设定与语录说明见 `handoff.md`、`DIALOGUE.md`；代码和角色素材的授权范围需分别确认。
