# H700 可重复构建命令（P4）

- 构建机：HX90（`192.168.3.188` / `hx90`），NixOS；构建在 `ghcr.io/rocknix/rocknix-build:latest` docker 容器内执行。
- 源码：`~/development/rocknix`（与本机 `main` 对齐）。

## 关键坑：单包构建必须显式 DEVICE
`config/options` 第 30-31 行：`PROJECT=ROCKNIX` 且未设 `DEVICE` 时 **默认 `DEVICE=SM8550`**。
不带 DEVICE 的 `make docker-package` 会去编 **SM8550**（本次实测踩坑，浪费大量时间）。**务必显式传** `DEVICE=H700 ARCH=aarch64 PROJECT=ROCKNIX`。

## 1. 全量镜像（H700，arm+aarch64 两遍）
```sh
cd ~/development/rocknix
make docker-H700        # 内部: PROJECT=ROCKNIX DEVICE=H700 ARCH=arm/aarch64 ./scripts/build_distro
```
- 从近乎空的 build 目录起步：需编译工具链 + LLVM + Rust（源码），**数小时**量级。
- 产物：`target/ROCKNIX-H700.aarch64-<DATE>[-DDR4]/{target/SYSTEM,SYSTEM.md5,*.tar,*.img.gz}`。

## 2. 单包迭代（推荐日常）
```sh
cd ~/development/rocknix
DEVICE=H700 ARCH=aarch64 PROJECT=ROCKNIX make docker-clean   PACKAGE=<pkg>
DEVICE=H700 ARCH=aarch64 PROJECT=ROCKNIX make docker-package PACKAGE=<pkg>
make docker-image        # 或 make image（组装，不重编）
```
- 改了**已解包源码目录**里的文件时，必须先 `docker-clean PACKAGE=<pkg>`（build stamp 只认 package.mk/归档校验和/patch/配置，见 `docs/build-iteration-fastpath.md`）。
- 仅改某包：单包 + 镜像组装通常几分钟，远快于全量。

## 3. 跳过 OS-base 强制 clean（G 组开关）
```sh
# 先重建改动的包，再跳过 8 组 OS-base clean 直接打包
DEVICE=H700 ARCH=aarch64 PROJECT=ROCKNIX make docker-package PACKAGE=<pkg>
OS_BASE_CLEAN=no make docker-H700
```
- `scripts/build_distro:78`：`OS_BASE_CLEAN=no` 跳过 `CLEAN_OS_BASE` 8 组（`emulators system-utils modules quirks autostart rocknix rocknix-joypad kernel-firmware`，见 `distributions/ROCKNIX/options:49`）。
- `DIRTY=1`：同时跳过 8 组 clean 与 initramfs 重建（仅改 rootfs、未动 early-boot 时用）。

## 4. 本轮实测
- `DEVICE=H700 … make docker-package PACKAGE=pocketjs-runtime`（2026-10-29）在后台从工具链源码起步，截至交报告时仍在编译（openssl/cmake/rust/llvm），未进入 pocketjs-runtime 阶段。
- 历史 `integration-20261028` 已完整成功（出 DDR4 镜像），日志见 `P3-evidence.txt`。
- 精确“全量分钟数”未在本轮实测完（构建跨小时）；快速路径单包+组装按 `docs/build-iteration-fastpath.md` 为“几分钟”量级。

## 5. 部署（仅 SYSTEM）
见 `AGENTS.md` §3 / 本报告 F 组：先传 `.new`、读回比对 MD5、再改名生效；保留 KERNEL/U-Boot/dtb/extlinux/STORAGE。
