# ROCKNIX 启动器 Switch 风格重构 — 实机验收截图

本目录收录 RG34XX 实机 LCD 帧，包含源码包 overlay 阶段及完整 SYSTEM 镜像阶段。文件名按阶段说明：

- `01`–`05`：第一版五个页面截图；`06-current` 为当时观察到的画面。
- `10`–`11`：更换宿主二进制后的状态栏首页和短时 probe 帧。
- `20`–`24`：逐屏切换尝试的画面；这组早期按键链路尚未恢复，不能据此声称成功切换。
- `30`–`41`、`50`–`D2`：输入诊断和修复前后帧，包括旧宿主对照、卡住 guest 的黑屏帧及修复后的重新绘制。
- `E0`–`E5`：修复后的连续 START 切页帧。
- `F0`–`F4`：SYSTEM 更新并重启后的页面截图，展示首页、媒体、游戏、设置和系统页。
- `POSTBOOT*`、`FORMAL-SYSTEM.png`、`FINAL-P*`：移除临时 `/storage` 宿主覆盖后，确认由镜像内 `/usr/libexec/pocketjs-session` 和镜像内正式二进制启动的最终实机截图；`FINAL-P1` 到 `FINAL-P5` 连续展示五页，`FINAL-P1-wrap` 证明回到首页。

## 实机验证结果

- 状态栏的 IP `192.168.3.57` 来自真实网络接口读取；电量 `100%` 来自 `/sys/class/power_supply`。
- 首页卡片完整显示，没有被右边缘裁切或省略标题。
- 完整镜像重启后，五页可通过 START 连续切换并循环回首页；正式宿主 PID 在验收过程中未变化，`pocketjs-kms` 保持 active。
- 底部提示栏的方框字形已消失。设置页部分内容仍被底部操作栏遮挡/裁切，见 `FINAL-P4.png`；这是未解决的 UI 问题。
- 本次设备安装仅更新 `/flash/SYSTEM` 与 `SYSTEM.md5`，设备树、KERNEL、U-Boot、STORAGE 未替换。新 SYSTEM 的 MD5 为 `5331af8fa1402966ec95643fc02b64d4`，与镜像 tar 中的 `SYSTEM.md5` 和设备 `/flash/SYSTEM` 一致。

镜像构建机产物：`ROCKNIX-H700.aarch64-20261029-DDR4.img.gz`，SHA-256：`99bdf636c036004427411a0c4cb264300791b7e50bc25d110129652fc687e20e`。完整镜像已构建并验证 SYSTEM 部署与启动；手工 `/storage` 宿主覆盖已移除，最终验收使用镜像内正式宿主和应用包。
