# 安装 KuruPal（macOS Apple Silicon）

ZIP 解压后包含完整 `KuruPal.app`。解压到准备长期保留的目录后即可直接运行，不需要 DMG、PKG、复制到 Applications 或手动拖拽。

## Agent 执行流程

1. 确认 `uname -m` 是 `arm64`。此包不能直接用于 Intel Mac。
2. 下载对应版本 ZIP 和 `SHA256SUMS.txt`，核对 ZIP 的 SHA-256。若只下载了桌面包，只验证对应一行，不要求用户下载插件包。
3. 使用 `ditto -x -k <zip> <解压目录>` 解压，找到内层 `KuruPal.app`。
4. 升级时先退出旧 KuruPal / Market Pet，保留旧 bundle 和应用数据目录。使用单独的新版本目录，避免把新文件叠加到旧 bundle 中。
5. 直接启动：

```sh
open "<解压目录>/KuruPal-<版本>-macOS-arm64/KuruPal.app"
```

将占位符替换为实际路径，并保留解压目录。先确认旧应用已退出；如果无法正常退出，明确告知用户后处理，不同时启动两份桌宠。

6. 检查应用进程及设置读取，不能只把 `open` 命令成功当作应用已正常运行。

## 签名状态

当前包使用本地 ad-hoc 签名以校验 bundle 完整性，**不是 Developer ID 签名，也未经过 Apple 公证**。其他用户从互联网下载后，macOS 可能要求手动确认或拦截。遇到拦截，引导用户使用系统提供的打开/安全性确认入口；不要自动清除 quarantine、关闭 Gatekeeper 或把 ad-hoc 签名描述为 Apple 信任认证。

ZIP 与 DMG 都不能替代签名、公证。正式面向普通用户发布且希望减少系统拦截，需要另行配置开发者证书、签名及公证流程。

## Codex 插件

桌面应用和 Codex 插件是两个包。需要任务联动与自然语言设置时，再安装 `KuruPal-Codex-Installer-<版本>.zip`；完整流程见项目根 README。插件 ID 为 `kurupal@kurupal`，仍需 Python 3。安装后即可生效，无需重启 Codex；Hook 信任由用户在客户端审阅，不能由安装脚本代替。
