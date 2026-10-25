# 01. 系统底层架构与核心认知

在定制系统或预装软件之前，必须清晰了解 ROCKNIX 在掌机上的运行原理。

---

## 1. 硬件平台：Allwinner H700 (RG35XX 系列)

* **芯片**：全志 Allwinner H700（四核 ARM Cortex-A53，64 位，Mali-G31 MP2 GPU）。
* **对应设备目录**：[`projects/ROCKNIX/devices/H700`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/H700)。
* **硬件特性**：
  * 大多数掌机（如 RG35XX Plus / H / SP）屏幕采用竖屏物理面板，需要软件翻转 90 或 270 度。
  * 掌机按键通过 GPIO / ADC 连接，由内核输入驱动上报为标准的 Linux 输入事件（`evdev`）。

---

## 2. 存储与分区结构：只读根目录与可写存储

ROCKNIX 基于 JeOS（Just Enough Linux OS）设计理念，运行时结构如下：

```
MicroSD 卡
├── 分区 1 (FAT32): BOOT 分区
│   ├── boot.scr / extlinux.conf (U-Boot 启动引导脚本)
│   ├── KERNEL (Linux 内核镜像)
│   ├── dtb.img / dtb 目录 (设备树文件)
│   └── SYSTEM (核心只读系统镜像，SquashFS 格式，包含完整 /usr、/bin、/lib)
│
└── 分区 2 (ext4): STORAGE 分区 (/storage)
    ├── .config/ (用户配置、前端配置文件、retroarch 配置等)
    ├── roms/ (游戏与应用程序)
    └── systemd/ (用户级服务与自启动脚本)
```

> **重要启示**：
> 1. **为什么终端里不能 `apt install`？** 因为系统的 `/` 大部分路径是直接挂载自 SquashFS 压缩只读文件系统。
> 2. **二次开发的两种层次**：
>    * **运行时改动**：将编译好的二进制或脚本放在 `/storage` 下，通过配置现有前端调用。
>    * **固件级改动**：在源代码中编写 `package.mk`，将其直接编译打入 `SYSTEM` 镜像中，做成真正“预装”的系统。

---

## 3. 图形栈与前端启动器机制

系统完全抛弃了笨重的传统桌面（X11/GNOME/KDE），采用轻量级的嵌入手游/掌机架构：

```
Linux Kernel (DRM/KMS 显卡驱动)
       │
       ▼
Wayland 窗口合成器 (Sway / Weston)
       │
       ▼
默认前端启动器 (EmulationStation，通过 essway.service 启动)
```

* **Wayland 桌面合成器**：掌机使用 Swaywm 作为后台合成器（配置在 [`projects/ROCKNIX/devices/H700/options`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/H700/options) 中定义为 `WINDOWMANAGER="swaywm-env"`）。
* **前端启动服务**：
  * systemd 服务定义位于 [`projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service)。
  * **更换启动器的关键**：只需创建自己启动器的 systemd service 或脚本，替换或修改启动依赖，就可以把默认的前端换成 Pegasus、MinUI、自制 SDL 启动器等。

---

## 4. ROCKNIX 软件包管理（package.mk）规范

ROCKNIX 不使用 deb/rpm 包，而是通过源码级自动化构建声明：

* **文件结构**：每一个包通常存放在 `projects/ROCKNIX/packages/<分类>/<包名>/package.mk`。
* **基本字段样例**：
  ```bash
  PKG_NAME="myplayer"
  PKG_VERSION="1.0.0"
  PKG_SHA256="..."
  PKG_ARCH="any"
  PKG_LICENSE="GPL"
  PKG_SITE="https://github.com/..."
  PKG_URL="https://github.com/.../archive/v${PKG_VERSION}.tar.gz"
  PKG_DEPENDS_TARGET="toolchain alsa-lib libsdl2"
  PKG_LONGDESC="A lightweight music player for handhelds"

  # 编译方式（针对 cmake / meson / autotools 或原生 make）
  make_target() {
    make -C ${PKG_BUILD} CC="${CC}"
  }

  # 安装方式（安装至目标根文件系统）
  makeinstall_target() {
    mkdir -p ${SYSROOT_PREFIX}/usr/bin
    cp -v ${PKG_BUILD}/myplayer ${SYSROOT_PREFIX}/usr/bin/
  }
  ```
* **仓库隔离规范（来自 AGENTS.md）**：
  * **严禁**直接修改顶层 `packages/` 目录中的 `package.mk` 文件。
  * **必须**将新增或修改的包维护在 [`projects/ROCKNIX/packages`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages) 或设备专属的 `projects/ROCKNIX/devices/H700/packages`。
