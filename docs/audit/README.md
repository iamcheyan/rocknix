# ROCKNIX 架构审计报告（索引）

> 本目录是对 `ROCKNIX/distribution`（本仓库 fork）的**只读架构调查**。
> 目标是为后续“裁剪 / 替换 / 自建发行版”提供事实基础，**不包含任何新系统设计、重构方案或启动器设计**。
> 调查对象：本仓库 `next` 分支源码（提交 `742bd52562`，含 fork 自有提交）、`scripts/`、`packages/`、`projects/ROCKNIX/`、`distributions/ROCKNIX/`。

## 阅读约定

每条结论后标注证据类型：

| 标记 | 含义 |
|---|---|
| `[事实]` | 直接来自仓库文件、可复现的命令输出或上游文档；附 `文件:行号` |
| `[推断]` | 由多条事实推导，未在真机验证；会写明推导链 |
| `[待验证]` | 需要真机/构建产物才能确认，仓库内无直接证据 |

设备差异说明：仓库同时支持 Allwinner H700、RK3568/RK3588、S922X、SM8250 等平台。本报告以 **H700（RG35XX 系列）** 为主线，其他平台仅在与架构相关处对比。凡涉及 fork 自有改动（例如 `handheld-launcher`），单独标注 `[fork]`。

## 报告清单

| 文档 | 内容 | 状态 |
|---|---|---|
| [01-boot-chain.md](01-boot-chain.md) | 上电 → Bootloader → Kernel → initramfs → systemd → UI 的完整链路 | 已完成 |
| [02-filesystem-layout.md](02-filesystem-layout.md) | 分区、挂载点、只读/可写、用户数据与 OTA 关系 | 已完成 |
| [03-build-system.md](03-build-system.md) | 构建系统、包定义、rootfs 与镜像生成 | 已完成 |
| [04-emulationstation.md](04-emulationstation.md) | EmulationStation 的职责边界 | 已完成 |
| [05-game-launch.md](05-game-launch.md) | 选中游戏后 ES → runemu.sh → RetroArch/独立模拟器 | 已完成 |
| [06-input.md](06-input.md) | 按键从内核到应用的路径 | 已完成 |
| [07-themes.md](07-themes.md) | 主题格式、资源、布局能力 | 已完成 |
| [08-app-extension.md](08-app-extension.md) | PortMaster、脚本、原生程序如何接入 | 已完成 |
| [09-services.md](09-services.md) | 关键 systemd 服务与可裁剪性 | 已完成 |
| [10-ota.md](10-ota.md) | 更新服务器、包格式、应用与回滚 | 待写 |
| [11-trimmability.md](11-trimmability.md) | A/B/C 三类组件分类 | 待写 |

## 调查方法

1. 只读源码检索：`rg` 检索 `system.d/`、`scripts/`、`package.mk`、`config/`，不做任何修改。
2. 构建脚本静态追踪：`Makefile` → `scripts/build_distro` → `scripts/build` → `scripts/image` → `scripts/mkimage`。
3. 运行时脚本追踪：initramfs `busybox/scripts/init` → systemd unit → `/usr/bin/autostart` → `start_es.sh` → `runemu.sh`。
4. 每条链路给出“入口文件 → 被调用文件”的调用关系；无法从源码确认的环节标 `[待验证]`。

## 版本基线

| 项 | 值 | 证据 |
|---|---|---|
| 发行版 | ROCKNIX（JELOS fork） | `README.md:39` |
| 分支 | `next` | `git branch` |
| 审计基线提交 | `742bd52562` | `git log -1` |
| 构建系统 | LibreELEC/CoreELEC 风格自研脚本（非 Buildroot/Yocto） | `Makefile`、`scripts/build*` |
| 默认 UI（H700） | Sway + EmulationStation | `projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service` |
