# 06. 编译系统底层原理解析与本次全套定制归总

本文档面向希望深入理解 ROCKNIX 构建系统运作机制、缓存原理以及本次针对 **Anbernic RG34XX (Allwinner H700)** 专属开发版全套定制细节的开发者。

---

## 一、 编译系统到底是怎么回事？底层原理深度剖析

### 1. 编译的核心目标：从零“无中生有”造出一个完整 OS
当你在运行 `./scripts/image mkimage` 时，你不是在给某个现成系统安装软件，而是在**从源码级别构建一台完整的随身 Linux 电脑**。它会自动经历以下三个大阶段：

```
[阶段一: 宿主机工具构建 (Host Tools)]
编译在你的电脑 (x86_64) 上运行的特定版本编译工具 (如 host 端的 cmake, pkg-config, u-boot-tools, genimage)
       │
       ▼
[阶段二: 交叉编译器构建 (Cross-Toolchain)]
编译一套专用的 aarch64-linux-gnu-gcc 交叉工具链 (包含 ARM64 专用的 glibc, binutils, gcc-12)
       │
       ▼
[阶段三: 目标环境软件包与系统生成 (Target Packages & Rootfs)]
使用上面的交叉编译器，把 600+ 个软件包 (内核, DRM 驱动, Wayland, SDL2, 你的启动器, XMPlayer) 编译成 ARM64 二进制，
并压缩成 SquashFS 只读系统镜像 (SYSTEM) 与可刷卡磁盘镜像 (*.img.gz)
```

---

### 2. 为什么第一次编译会下载很久？以后会不会快？

**完全正确！第一次编译是最慢的，因为要建立本地缓存；只要第一次完成，以后的构建速度会提升几十倍！**

原因在于构建系统的三层持久缓存机制：

#### ① 源码包永久缓存（`sources/` 目录）
* **原理**：系统构建前，会把每一个开源软件的官方 Tar 包或 Git 仓库（如 Linux 内核、Mesa、FFmpeg、SDL2 等）下载到本地的 [`sources/`](file:///home/tetsuya/development/rocknix/sources) 目录，并校验 SHA256 哈希防篡改。
* **效果**：**只要下载过一次，这些源码包就永久保存在本地硬盘中。下一次编译即使完全断开外网，系统也会直接从本地解压，绝对不会重复下载！**

#### ② 状态时间戳与跳过机制（`.stamps/` 缓存）
* **原理**：每当一个包编译安装成功后，系统会在 `build.ROCKNIX-H700.aarch64/.stamps/<包名>/` 中记录一个包含源码配置与编译器参数的指纹（Deep-Hash）。
* **效果**：下一次运行编译时，系统如果发现某个包的代码和配置没有变动，**直接 1 毫秒秒级跳过**，完全不会重复编译！

#### ③ 日常开发的极速工作流：单包编译
在日常修改自己的代码时，**绝对不需要每次跑整机编译**：
* 比如你改动了 [`handheld-launcher`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/handheld-launcher)：
  ```bash
  PROJECT=ROCKNIX DEVICE=H700 ARCH=aarch64 ./scripts/build handheld-launcher
  ```
  系统只会编译这一个包，几秒钟就能生成最新的 ARM64 二进制！

---

## 二、 本次针对 RG34XX 开发版的定制改动清单总览

为了将一台普通的掌机打造成属于你的“专属便携 Linux 开发板”，我们在项目中完成了以下核心改造：

### 1. 屏幕分辨率与比例原生适配（720×480，3:2）
* **硬件特性**：RG34XX 搭载 3.4 寸 720×480 IPS 屏幕（GBA 原生 240×160 的 3 倍整数点对点缩放）。
* **改动点**：将启动器与所有渲染基准从 640×480（4:3）修正为精准的 **720×480（3:2）**，消除了画面拉伸与模糊。

### 2. 专属轻量主启动器（`handheld-launcher`）
* **位置**：[`projects/ROCKNIX/packages/apps/handheld-launcher/`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/handheld-launcher/)
* **特点**：
  * 基于 SDL2 编写，毫秒级冷启动，极致省电；
  * 开机接管：编写了 [`handheld-launcher.service`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/handheld-launcher/system.d/handheld-launcher.service)，开机直接拉起自制主界面，替换原版臃肿的 EmulationStation。

### 3. XMPlayer 媒体套件移植与按键全死 Bug 彻底修复
* **位置**：[`projects/ROCKNIX/packages/apps/xmplayer/`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/xmplayer/)
* **痛点根治**：
  * 原版 XMPlayer 偷懒只写了键盘事件（`love.keypressed`），在 ROCKNIX (Wayland/Sway) 原生手柄环境下按键完全失灵；
  * 我们在 [`main.lua`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/xmplayer/app/main.lua) 中注入了**原生手柄驱动桥（Native Gamepad Bridge）**，原生地将十字键、摇杆、A/B/X/Y/肩键与 XMB 操作绑定，彻底救活了按键。

### 4. START + SELECT 双键防误触退出机制
* **痛点**：在手柄上如果单按 Select 或单按 Start 退出，听歌选曲时极易发生误触中断。
* **改动点**：
  * 在 XMPlayer 中重构了退出监听：**只有同时按下 START 和 SELECT 两键**才会退出播放器，单独按其中任何一个均不会退出；
  * 在主启动器中也同步配置了 START + SELECT 退出保护。

### 5. 熄屏后台听歌逻辑设计（Walkman 模式）
* **痛点**：普通系统休眠会直接停止 CPU，导致音频 DMA 停摆断音。
* **解决方案**：
  * 掌机 70% 的电量消耗在液晶屏背光；
  * 听歌时按下电源键，调用底层 `echo 4 > /sys/class/backlight/*/bl_power` 仅关闭背光灭屏，并将 CPU 降频运行，实现不断音且超长续航的真熄屏播放。

### 6. RG34XX 默认 DTB 设备树自动引导（免手动提取替换）
* **痛点**：官方通用包默认外置 `dtb.img` 是 RG35XX 的，RG34XX 用户刷完卡必须手动进入 `device_trees/` 把 `sun50i-h700-anbernic-rg34xx.dtb` 提出来改名替换，否则黑屏。
* **改动点**：
  * 在 [`projects/ROCKNIX/config.xml`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/config.xml) 中直接将引导项指向 `device_trees/sun50i-h700-anbernic-rg34xx.dtb`；
  * 构建出的镜像**出厂即原生匹配 RG34XX**，直接刷卡插机点亮，告别繁琐的手动改文件！

### 7. 开发板系统纯净化瘦身（剔除 32 位老旧游戏模拟器）
* **改动点**：
  * 在 [`projects/ROCKNIX/devices/H700/options`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/H700/options) 中声明 `ENABLE_32BIT="false"`；
  * 彻底剔除了 `box86` 和一众 32 位老旧游戏模拟器，避免了重复构建 32 位 ARM 冗余依赖，让整个系统专注作为纯粹的 **64 位嵌入式 Linux 极客开发板**，大幅减少磁盘占用并提升编译速度！
