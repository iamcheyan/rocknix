# ROCKNIX H700 模拟器与核心配置说明

本文说明仓库当前 H700 构建配置中，模拟器程序、RetroArch/libretro 核心、EmulationStation 系统入口之间的关系。RG34XX 使用 H700 平台配置，因此适用本文；同一 H700 构建配置也可能用于其他 H700 掌机，实际设备树和屏幕等仍由具体机型决定。

## 先看结论

- ROCKNIX 的标准游戏镜像通过 `image` 包组加入 `emulators` 和 `gamesupport`，并由 `virtual/emulators/package.mk` 汇总 RetroArch、libretro 核心及独立模拟器包。
- H700 额外选择 DraStic 和 Mednafen，并登记各个模拟系统可用的 emulator/core 组合。
- Emulator/core 登记表表示系统生成的 EmulationStation 菜单和启动组合，不代表每个游戏都能满速，也不代表 ROM、BIOS 已随镜像提供。
- H700 的 `ENABLE_32BIT="false"` 关闭 32 位兼容包。但 PS1 的 H700 系统登记把 `pcsx_rearmed32` 设为默认项；应以实际构建产物和设备上的可用核心为准，必要时选 64 位 `pcsx_rearmed`。
- 本仓库还为 H700 增加了 `handheld-launcher` 和 `xmplayer`。两者不是游戏模拟器。

## 构建入口与筛选条件

### 镜像包组

[`projects/ROCKNIX/packages/virtual/image/package.mk`](../../../projects/ROCKNIX/packages/virtual/image/package.mk) 在非 `BASE_ONLY` 镜像中加入 UI 和媒体包；正常模拟器镜像还需满足 `EMULATION_DEVICE=yes` 才会加入 `emulators gamesupport`。`BASE_ONLY=true` 会强制关闭该标志。H700 配置见 [`projects/ROCKNIX/devices/H700/options`](../../../projects/ROCKNIX/devices/H700/options)，其中关闭了 32 位兼容，并加入 `handheld-launcher xmplayer`。

### Emulator 包组

[`projects/ROCKNIX/packages/virtual/emulators/package.mk`](../../../projects/ROCKNIX/packages/virtual/emulators/package.mk) 定义三类依赖：

1. `PKG_RETROARCH`：RetroArch 前端、核心信息、数据库、手柄、覆盖层和着色器资源。
2. `LIBRETRO_CORES`：大量 libretro 核心包；AArch64 构建另加 DuckStation、Flycast 2021、PPSSPP 等核心包。
3. `PKG_EMUS`：Amiberry、Flycast standalone、PPSSPP standalone、ScummVM、YabaSanshiro 等独立模拟器，以及 H700 条件下追加的 DraStic 和 Mednafen。

构建还受 `TARGET_TYPE` 控制：`cores_only` 只加核心，`emus_only` 只加独立模拟器与 RetroArch 前端，`none` 不加这些构建依赖，其他值才同时加上两类。最终镜像是否包含模拟器，需要结合实际使用的构建目标和生成日志确认。

### H700 专属设置

[`projects/ROCKNIX/devices/H700/options`](../../../projects/ROCKNIX/devices/H700/options) 指定：

- SoC：Allwinner H700，目标 CPU 为 Cortex-A53。
- GPU：Mali-G31 MP2，使用 Panfrost，并优先 GLES。
- `ENABLE_32BIT="false"`。
- 附加包：`handheld-launcher xmplayer`。

Emulator 包组对 H700/RK3326 增加 `drastic-sa`、`mednafen` 和 `uae4arm-lr`。其他平台专属包，如 Azahar/3DS、Dolphin/GameCube、Vita3K 等，不会因为仓库其他设备支持它们就自动成为 H700 包。

## 系统入口与模拟器程序不是一回事

生成器通过 `add_emu_core <system> <emulator> <core> <default>` 建立游戏系统和启动映射，再以 `add_es_system` 生成 EmulationStation 系统列表。一个系统可能映射多个 RetroArch 核心或独立模拟器；同一个核心也可能服务多个系统。

H700 的详细系统名、扩展名、默认核心和其他登记核心见现有 [H700 支持系统与核心表](SUPPORTED_EMULATORS_AND_CORES.md)。那张表描述的是配置登记，阅读时需结合本说明里的构建目标和条件判断。

### 包条件与登记不一致的例子：PlayStation

H700 的 PS1 条件登记将 `pcsx_rearmed32` 设为默认核心，并列出 `pcsx_rearmed`、DuckStation 等选项。但 H700 的 `ENABLE_32BIT=false`，emulator 包定义只在该值为 `true` 时把 `pcsx_rearmed-lr` 的 32 位兼容变体放入 `EMUS_32BIT`。因此 `pcsx_rearmed32` 默认登记不等于它一定被当前构建出来。模拟器包组的标准核心列表包含 AArch64 `pcsx_rearmed-lr`；实际使用时应核对镜像中的核心文件并选择可加载的核心。

同理，某个核心出现在系统表里，只能说明配置曾登记该组合。`TARGET_TYPE`、设备条件、包是否成功构建、ROM 格式、BIOS 和固件都会影响最终能否启动。

## RG34XX 上的实用性能分层

性能建议依据 RG34XX 官方规格（H700 四核 Cortex-A53 1.5 GHz、Mali-G31 MP2、1 GB RAM、720×480 屏幕）以及这些主机的模拟负载特征作保守判断；仓库没有提供逐游戏性能基准。具体游戏、核心版本、分辨率、渲染器和散热都会改变表现。

| 预期 | 系统类别 | 使用建议 |
|---|---|---|
| 稳妥首选 | 8/16 位家用机与掌机：NES、Master System、Mega Drive/Genesis、Game Boy/Color、Game Gear、PC Engine、WonderSwan、Atari 2600/7800、常见早期家机 | 优先用系统默认 RetroArch 核心。一般是这台设备最轻松的范围。 |
| 通常合适 | GBA、SNES、PS1、PSP Minis、传统 2D 街机（CPS1/CPS2、较早 MAME/FBNeo 游戏） | 先用默认核心；街机应逐个游戏测试，不同 ROM 集和驱动要求差异很大。PS1 使用实际可加载的 64 位核心。 |
| 需要逐游戏测试 | Nintendo DS（DraStic）、Nintendo 64、Dreamcast、3DO、部分较新的街机、PSP | 菜单提供核心不代表每个游戏流畅。N64 和 Dreamcast 对游戏与渲染设置较敏感；PSP 选择低负载游戏并按游戏调整。 |
| 不建议作为目标 | 需要仓库未给 H700 登记或未加入 H700 包的较新/高负载平台，例如 3DS、GameCube、Wii、PS2、PS3、PS Vita、Xbox、Wii U | H700 条件没有提供这些平台的相应系统入口/模拟器包，且其性能需求也明显超出本设备的定位。不要把其他 ROCKNIX 设备的支持表套用到 RG34XX。 |

这些是选型建议，不是逐游戏保证。对性能敏感的系统，建议在 RG34XX 实机上检查帧率、音频连续性和温度后再固定使用某个核心。

## 不包含在上述清单里的内容

- ROM/游戏文件、商业 BIOS、固件和密钥不会因为模拟器核心已打包就自动存在。
- 其他 SoC 分支的独立模拟器包，不能当作 H700 已打包内容。
- 本仓库新加的 XMPlayer 是媒体应用，不属于模拟器核心。

## 仓库依据

- [`projects/ROCKNIX/devices/H700/options`](../../../projects/ROCKNIX/devices/H700/options)
- [`projects/ROCKNIX/packages/virtual/image/package.mk`](../../../projects/ROCKNIX/packages/virtual/image/package.mk)
- [`projects/ROCKNIX/packages/virtual/emulators/package.mk`](../../../projects/ROCKNIX/packages/virtual/emulators/package.mk)
- [H700 生成系统表](SUPPORTED_EMULATORS_AND_CORES.md)
- [Anbernic RG34XX 官方规格](https://anbernic.com/products/rg34xx)
