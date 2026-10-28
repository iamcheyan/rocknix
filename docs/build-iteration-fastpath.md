# H700 快速迭代：跳过无谓的 OS-base 重编

## 问题
`make H700` 每次都走 `scripts/build_distro`，其中无条件 `./scripts/clean` 这 8 个 OS-base 包组
（见 `distributions/ROCKNIX/options` 的 `CLEAN_OS_BASE`，H700 上 `WINDOWMANAGER="none"`、
`ENABLE_32BIT="false"`，故不附加 weston / 32bit 组）：

```
emulators system-utils modules quirks autostart rocknix rocknix-joypad kernel-firmware
```

即便只改了一个包，这 8 组仍被强制重编（走 ccache，但解包/configure/install/strip 开销累积），
导致每次 system 替换约 20 分钟。

## 证据
- 实测：对已有 `build.ROCKNIX-H700.aarch64/image/system`（616M → 188M SYSTEM）跑 mksquashfs，
  hx90 上 **7.5s**（~14 并行压缩器）。
- `make image`（`./scripts/image mkimage`）只重打包、不重编。20 分钟几乎全在 8 组重编上，打包可忽略。

## 标准快速路径（推荐）
只改了某包 `P`（如 rocknix / heya / pocketjs / 某个 config）：

```sh
./scripts/clean P
./scripts/build P
make image
```

`make image` 不从源码重编任何包，只从已安装的 `install_pkg` 组装并打包。
耗时 ≈ 单包 ccache 重编 + 镜像组装 + 7.5s squashfs，通常几分钟而非 20 分钟。

## 保留 `make H700` 习惯
新增开关 `OS_BASE_CLEAN`（默认 `yes`，行为不变，见 `scripts/build_distro`）：

```sh
# 先重建你改的包，再跳过 8 组 clean 直接打包
./scripts/clean P && ./scripts/build P
OS_BASE_CLEAN=no make H700
```

`OS_BASE_CLEAN=no` 跳过 8 组的强制 clean，但**仍重建 initramfs**（`DIRTY` 未设置时）。

## 其他开关
- `DIRTY=1 make H700`：同时跳过 8 组 clean 与 initramfs 重建。仅改 rootfs、未动
  initramfs / early-boot 脚本时用；动了 early-boot 则不要用。
- `make system`（`./scripts/image`，无 mkimage 参数）：只生成裸 `.system`，不含
  `target/SYSTEM` 拷贝，不适合直接刷机。刷机用 `make image`。

## 重要坑：构建 stamp 只认这些输入
`scripts/build` 的 `PKG_DEEPHASH` 只覆盖 `package.mk` + 源码归档校验和 + patches + 编译配置。
**直接改已解包源码目录里的文件不会被检测到** → 必须显式 `./scripts/clean P` 先清
（或把改动落在 patch / `package.mk`）。

## 产物位置
`make image` 产出刷机文件：

```
target/ROCKNIX-H700.aarch64-<DATE>[-DDR4]/target/SYSTEM      (+ SYSTEM.md5)
target/ROCKNIX-H700.aarch64-<DATE>[-DDR4].tar
target/ROCKNIX-H700.aarch64-<DATE>[-DDR4].img.gz
```

按 AGENTS.md §3 仅把 `SYSTEM` + `SYSTEM.md5` 复制到 FAT32 boot 分区（`/dev/sdX1`）。
