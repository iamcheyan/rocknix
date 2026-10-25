# Anbernic RG34XX：硬件资料与 ROCKNIX 模拟器建议

本文专门记录当前设备 **Anbernic RG34XX** 的硬件规格，并把它与本仓库的 ROCKNIX H700 模拟器配置对照。硬件规格来自 Anbernic 官方产品页；模拟器列表来自本仓库的 H700 构建配置。帧率建议是基于规格与模拟器负载的保守分级，并非逐游戏实测结果。

## 设备身份

- 产品：Anbernic RG34XX
- ROCKNIX 平台配置：H700
- 仓库设备树列表：`sun50i-h700-anbernic-rg34xx`
- 构建目标 CPU：Cortex-A53

RG34XX 是 H700 家族中的一个具体机型。仓库 `config.xml` 同时列有多个 H700 机型；同一平台的软件包条件不表示所有设备有相同屏幕、内存配置或设备树。

## 官方硬件规格

| 项目 | RG34XX 规格 |
|---|---|
| SoC / CPU | Allwinner H700，四核 ARM Cortex-A53，最高 1.5 GHz |
| GPU | Dual-core Mali-G31 MP2 |
| RAM | 1 GB |
| 屏幕 | 3.4 英寸 IPS，720 × 480 |
| 系统 | Linux 64-bit |
| 无线 | 2.4/5 GHz Wi-Fi 802.11 a/b/g/n/ac；Bluetooth 4.2 |
| 存储 | microSD/TF 双卡槽；官方页称最大支持 512 GB 扩展卡 |
| 电池 | 3500 mAh，官方标称最长约 7 小时（实际随亮度、负载和电池状态变化） |

来源：[Anbernic RG34XX 官方产品规格页](https://anbernic.com/products/rg34xx)。本页记录的是厂商公布参数，不代表对设备实测验证。

## 对 ROCKNIX 构建配置意味着什么

仓库的 H700 选项将目标 CPU 设为 Cortex-A53、GPU 设为 Mali-G31/Panfrost，并优先使用 GLES；同时关闭 32 位兼容：`ENABLE_32BIT="false"`。这与 RG34XX 的 H700 64 位 Linux 硬件定位一致，但会影响少数依赖 32 位兼容包的核心。

正常模拟器镜像配置会加入 `emulators`、RetroArch、libretro 核心及 H700 条件指定的 DraStic、Mednafen 等包；`BASE_ONLY` 镜像不包含该模拟器包组。H700 配置还添加了项目自己的 handheld-launcher 和 XMPlayer。EmulationStation 系统表里登记了大量主机和核心组合，但“有菜单映射”不等于 ROM/BIOS 已预装，也不等于所有核心都适用于 H700。完整清单和构建条件见 [ROCKNIX H700 模拟器与核心配置说明](ROCKNIX_EMULATOR_CONFIGURATION.md) 及 [H700 支持系统与核心表](SUPPORTED_EMULATORS_AND_CORES.md)。

### 特别注意：PS1 32 位默认项

仓库 H700 PS1 表把 `pcsx_rearmed32` 标为默认；但 RG34XX 的 H700 选项关闭了 `ENABLE_32BIT`。因此这个名字不能单独证明当前镜像带有可运行的 32 位核心。遇到核心加载失败时，先检查镜像里的实际核心文件，并尝试可用的 AArch64 `pcsx_rearmed` 选项。

## RG34XX 模拟器选择建议

### 可以作为日常主力

建议优先从这些 8/16 位系统开始：NES/Famicom、Game Boy/Color、Game Gear、Mega Drive/Genesis、Master System、SNES、PC Engine、WonderSwan、Atari 2600/7800，以及多数早期 2D 街机游戏。先用 ROCKNIX 提供的默认 RetroArch 核心；只有遇到兼容性问题再换其他核心。

GBA 通常也适合日常使用。PS1 多数游戏可作为实用目标，但使用可加载的 AArch64 核心，避免误选需要 32 位兼容的变体。

### 适合试用，按游戏判断

- **Nintendo DS**：配置默认使用 DraStic；屏幕分辨率和双屏布局会限制显示方式，不同游戏操作需求不同。
- **Nintendo 64**：系统默认核心已登记，但兼容性、速度和画面表现可能随游戏差异较大。
- **Dreamcast**：H700 配置提供 Flycast 系列核心；3D 负载较高，建议逐款测试并优先选择轻量游戏。
- **PSP**：仓库登记 PPSSPP，但 1 GB RAM 和 Cortex-A53 对高负载游戏构成限制；低负载作品更适合尝试。
- **街机**：FBNeo/MAME 覆盖范围很广，但新旧硬件、ROM 集版本和游戏复杂度差异大，不能以核心已安装推断所有游戏都可流畅运行。

### 不建议预期可玩的范围

本仓库的 H700 条件没有为 3DS、GameCube、Wii、PS2、PS3、PS Vita、Xbox、Wii U 等系统提供对应的 H700 菜单入口和模拟器包。这些系统即使在其他 ROCKNIX 设备上受支持，也不能据此推断 RG34XX 支持。它们的模拟负载也超出这台设备的合理目标。

## 结论与验证方法

RG34XX 适合以 8/16 位平台、GBA 和大多数 PS1 游戏作为稳定目标；DS、N64、Dreamcast、PSP 和较复杂街机游戏属于逐游戏测试范围。不要把“系统列出核心”当作流畅性承诺。

实际挑选配置时：

1. 先使用默认核心启动已合法取得的游戏文件。
2. 观察游戏速度、音频是否持续、画面是否稳定和设备温度。
3. 只有遇到兼容性或性能问题时，再换同系统下的其他核心逐项对比。
4. 检查需要 BIOS 的系统是否已由用户自行提供兼容 BIOS；核心包本身不包含授权 BIOS 或游戏。

## 资料来源

- Anbernic 官方 RG34XX 产品页：<https://anbernic.com/products/rg34xx>
- ROCKNIX H700 构建选项：[`projects/ROCKNIX/devices/H700/options`](../../../projects/ROCKNIX/devices/H700/options)
- H700 设备树登记：[`projects/ROCKNIX/config.xml`](../../../projects/ROCKNIX/config.xml)
- 镜像包组：[`projects/ROCKNIX/packages/virtual/image/package.mk`](../../../projects/ROCKNIX/packages/virtual/image/package.mk)
- 模拟器依赖及平台分支：[`projects/ROCKNIX/packages/virtual/emulators/package.mk`](../../../projects/ROCKNIX/packages/virtual/emulators/package.mk)
