# DECISIONS_PENDING — 需用户决定的事项

## DEC-001 | K3「全黑截图」与「只写 backlight、不许动 fb/DRM」约束冲突
- 现状：`pocketjs-sleep` 关屏仅写 `/sys/class/backlight/backlight/brightness=0`（严格按 J10 约束）。实测 backlight 1249→0 成功、物理面板背光熄灭。但 `/device/frame.rgb` 只是跑 `/storage/pocketshell-dev/capture` 读取 KMS framebuffer，**backlight=0 不会清空 framebuffer**，故抓到的仍是旧画面（实测 mean≈18.5，非全黑）。
- 风险：若为了「全黑截图」而去 DPMS/fb blanking，违反 J10「关屏只能通过写 backlight，不许改 DRM/KMS、不许改内核 fb」。
- 选项：
  - A（推荐）：接受 `backlight=0` 作为关屏证据，截图保留 framebuffer 现状并注明；符合约束。
  - B：允许加一次 DRM DPMS off / fb blanking，以获得真正的全黑帧；需放宽约束。
  - C：改 `/device/frame.rgb` 端点，在 backlight=0 时返回全黑（改的是 Dev Center 采集工具，非 DRM/KMS/fb 驱动）；需重建 pocketshell-dev。
- 影响范围：K3 截图证据；B 组镜像在关屏时的显示。
- 状态: DECIDED（A）— J10 的「只写 backlight、不动 DRM/KMS/fb」是硬约束，不为一张更黑的图放宽；K3 以 backlight 1249→0 + 面板实测熄灭为证据，截图注明「backlight=0，framebuffer 保留旧帧」。C 需重建 pocketshell-dev 换观感，不做。

## DEC-002 | pocketshell-dev 未设为开机自启
- 现状：`systemctl is-enabled pocketshell-dev` = `disabled`。设备重启后 pocketshell-dev 不自启，`:8080` Dev Center 不可用（K7 重启后实测 inactive，需手动 `systemctl start`）。此为既有配置，非本次 sleep 改动引入。
- 风险：冷启动后 Dev Center / 远程开发入口不可用；D6/F4 冷启动相关验收受影响。
- 选项：
  - A（推荐）：在镜像里 `systemctl enable pocketshell-dev`（或加 WantedBy=multi-user.target 的 enable 逻辑）。
  - B：保持手动启动，文档注明需手动起。
- 影响范围：D6、F4、E、I 的冷启动验收；日常使用。
- 状态: DECIDED（A）— 镜像内 `systemctl enable pocketshell-dev`（WantedBy=multi-user.target），否则 D6/F4/E/I 的冷启动项永远不可验；这是配置补齐，不是行为变更。

## DEC-003 | P3「rquickjs-sys 编译失败」前提与实测不符
- 现状：目标文档称 `make H700` 因 `rquickjs-sys` C 编译失败而失败。实测 HX90 `.buildlog/*` 显示 `rquickjs-sys v0.12.0` 编译通过、pocketjs-runtime 产物生成、integration-20261028 已成功出 `ROCKNIX-H700.aarch64-20261028-DDR4.img`。当前重建（`make docker-package PACKAGE=pocketjs-runtime`）仍在跑（编译 LLVM/工具链阶段），尚未到 rquickjs-sys。
- 风险：若按错误前提去改代码，可能引入不必要改动。
- 选项：
  - A（推荐）：等本次重建跑完，以实际日志为准；若通过则记录「前提不成立、构建正常」。
  - B：若确实在干净构建下失败，再按真实报错修复。
- 影响范围：P3/P4/G 结论。
- 状态: DECIDED（A）— 以实际构建日志为准：rquickjs-sys v0.12.0 已编译通过、20261028 镜像成功产出，前提证伪；不按错误前提改代码，结论写进 REPORT（已有 P3-evidence）。

## DEC-004 | pocketshell-mirror 去留
- 现状：`tools/pocketshell-mirror` 已实测可用（H1：JPEG 720×480 抓帧 + 经 HX90 adb 注入真实 Gamepad evdev）。但与 pocketshell-dev 的 `/device/frame.rgb` + `/device/key` 功能重叠；mirror 额外依赖 HX90 adb 中继、且未指定 `-s`，多 adb 设备时会报错。
- 风险：维护两套镜像/注入通道，易不一致。
- 选项：
  - A（推荐）：以 pocketshell-dev 为主通道；mirror 保留为“adb 中继 + 真实 gamepad 注入”诊断备用，不删。
  - B：退役 mirror（从 tools 移除 README/server）。
  - C：增强 mirror 指定 `-s <serial>` 以支持多设备，作为正式备用。
- 影响范围：工具目录、文档。
- 状态: DECIDED（A+C）— pocketshell-dev 为主通道；mirror 保留为「adb 中继 + 真实 gamepad 注入」诊断备用，并补 `-s <serial>` 消除多 adb 设备歧义（C 部分作为小改动排期）。不退役（B），因为它是唯一能注入真实 gamepad evdev 的通道。
