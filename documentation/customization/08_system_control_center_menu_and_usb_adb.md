# 08. 系统控制中心交互设计与 USB ADB / MTP / 网卡落地

本文档详细说明我们在 ROCKNIX（Anbernic RG34XX，Allwinner H700，720×480 原生分辨率）上实现的**系统控制中心（System Control Center）**交互菜单设计，以及底层 **USB ADB 调试、MTP 磁盘传输、虚拟网卡与熄屏随身听（Walkman）模式** 的完整落地架构。

---

## 一、 系统控制中心菜单设计（UI / UX）

针对 RG34XX 的 3.4 英寸 720×480 原生 3:2 屏幕，控制中心采用全原生 SDL2 像素渲染引擎，去除了繁重的 EmulationStation 前端，打造了一个低延迟、低内存占用的沉浸式设备控制面板。

```
+-------------------------------------------------------------------------------+
| ROCKNIX HANDHELD      WIFI: ON      USB: MTP PC DISK     BAT: 92%       21:45 | <- 顶部状态栏
+-------------------------------------------------------------------------------+
|                   === SYSTEM CONTROL CENTER & SETTINGS ===                    |
|                                                                               |
|  > Wi-Fi Wireless     : [ENABLED] (Press A to toggle)                       # | <- 滚动槽
|    Wi-Fi IP Status    : 192.168.1.102 (Connected)                           # |
|    Bluetooth Radio    : [OFF] (Press A to toggle)                           | |
|    USB-C Mode         : < MTP PC DISK > (Left/Right to switch)              | |
|    Wireless ADB       : [DISABLED:5555] (Press A to toggle)                 | |
|    Screen Brightness  : < 80% > (Left/Right to adjust)                      | |
|                                                                               |
|  USB Tip: Connect Type-C to PC for Instant MTP Explorer or 'adb shell'        |
+-------------------------------------------------------------------------------+
| [A] TOGGLE/APPLY   [LEFT/RIGHT] ADJUST   [B] BACK   [START+SELECT] QUIT       | <- 底部操作提示
+-------------------------------------------------------------------------------+
```

### 1. 视窗与平滑滚动机制
* **可视窗口**：屏幕中央固定显示 6 个功能行，每行高 50px，右侧配备自适应高度与位置的黄色滑块指示条（Scrollbar Thumb）。
* **光标跟随与越界滚动**：当十字键或摇杆向上/向下移动超过当前视野边界时，`cp_scroll_offset` 自动滚屏，始终保持当前选中项居中可见。

### 2. 14 项完整控制菜单矩阵

| 序号 | 菜单项名称 | 键位交互 | 状态表现与底层命令 |
| :--- | :--- | :--- | :--- |
| **0** | **Wi-Fi Wireless** | 按 `A` 键切换 | `[ENABLED]` / `[DISABLED]`，调用 `wifictl enable` / `disable` |
| **1** | **Wi-Fi IP Status** | 只读展示 | 实时显示当前分配的局域网 IP（如 `192.168.1.102`）或 `Disconnected` |
| **2** | **Bluetooth Radio** | 按 `A` 键切换 | `[ON]` / `[OFF]`，调用 `rocknix-bluetooth on` / `off` |
| **3** | **USB-C Mode** | 十字键左/右切换，`A` 应用 | `< MTP PC DISK >` / `< USB ADB DEBUG >` / `< USB NETWORK/SSH >` / `< CHARGING ONLY >` |
| **4** | **Wireless ADB** | 按 `A` 键切换 | `[ACTIVE:5555]` / `[DISABLED:5555]`，调用 `usbgadget adb_tcp` 开启 Wi-Fi 调试 |
| **5** | **Screen Brightness** | 十字键左/右微调 | `< 10% - 100% >`（步长 5%），调用 `brightness set <val>` |
| **6** | **Walkman Mode** | 按 `A` 键进入 | 熄灭 LCD 背光（`bl_power=4`），后台音乐继续全速播放，任意按键即刻唤醒 |
| **7** | **Audio Volume** | 十字键左/右微调 | `< 0% - 100% >`（步长 5%），调用 `amixer -q set Master <val>%` |
| **8** | **SD Storage** | 只读展示 | 实时读取 `statvfs("/storage")`，显示剩余容量（如 `48.2 GB Free / 59.8 GB`） |
| **9** | **CPU Telemetry** | 只读展示 | 实时读取内核温控与频率（如 `42.5 C @ 1.5 GHz`） |
| **10** | **Restart UI** | 按 `A` 键执行 | 重启启动器服务：`systemctl restart handheld-launcher` |
| **11** | **Reboot Handheld** | 按 `A` 键执行 | 安全同步磁盘并重启设备：`reboot` |
| **12** | **Power Off** | 按 `A` 键执行 | 卸载存储并彻底关机：`poweroff` |
| **13** | **Back to Main** | 按 `A` 或 `B` 键 | 返回桌面一级启动菜单 |

---

## 二、 USB 多模式与 ADB 底层架构

ROCKNIX 底层使用 Linux 内核的 **ConfigFS + FunctionFS** 动态 USB 复合小工具框架。我们在 `projects/ROCKNIX/packages/rocknix/sources/scripts/usbgadget` 中扩展了四大核心模式：

```
                      +-----------------------------+
                      |       /usr/bin/usbgadget    |
                      +--------------+--------------+
                                     |
         +-----------------+---------+---------+-----------------+
         |                 |                   |                 |
         v                 v                   v                 v
   [file_transfer]       [adb]             [network]         [disabled]
         |                 |                   |                 |
  FunctionFS (mtp)  FunctionFS (adb)      CDC-NCM USB网卡    断开 UDC 绑定
         |                 |                   |                 |
      umtprd             adbd                udhcpd          仅充电 / HOST
         |                 |                   |
   电脑识别为大容量    电脑识别为 Android   电脑分配虚拟网卡
    便携式媒体设备     调试桥 (Root Shell)    IP 169.254.170.2
```

### 1. MTP 磁盘传输模式 (`usbgadget file_transfer`)
* **原理**：基于 `umtprd` 守护进程，通过 FunctionFS 向主机宣告 MTP 媒体类设备（VID: `0x1d6b`, PID: `0x0100`）。
* **优势**：
  * 主机（Windows/macOS/Linux）插上 USB-C 即自动弹出手持媒体设备资源管理器。
  * 用户可直接拖拽音乐（MP3/FLAC）、视频（MP4/MKV）至 `/storage/music` 或 `/storage/roms`。
  * **绝不会**出现传统 USB 大容量存储（Mass Storage）因主机端意外拔出导致的 MicroSD 卡 EXT4 文件系统损坏或强制脱机问题。

### 2. USB ADB 调试模式 (`usbgadget adb`)
* **原理**：
  * 内核 ConfigFS 创建 ADB 设备描述符（VID: `0x18d1`，PID: `0x4ee7`）。
  * 挂载 FunctionFS：`mount -t functionfs adb /dev/usb-ffs/adb`。
  * 启动原生守护进程 `/usr/bin/adbd`。
* **开发者体验**：
  * 主机端无需任何 IP 配置，终端直接输入 `adb devices` 即刻识别。
  * 运行 `adb shell` 直接获得 root 终端权限（`#`）。
  * 运行 `adb push local_file /storage/` 与 `adb pull` 极速传输工程文件与可执行程序。

### 3. USB 虚拟网卡与网络 ADB (`usbgadget network` & `adb_tcp`)
* **原理**：基于 CDC-NCM 协议，手持机端自建 `udhcpd` 服务，向 PC 分配 `169.254.170.1`，自身固定为 `169.254.170.2`。
* **Wi-Fi / 网络 ADB**：
  * 当启动器勾选 `Wireless ADB: ACTIVE` 时，触发 `usbgadget adb_tcp`。
  * `adbd` 监听 TCP 端口 `5555`。
  * 主机在同一个局域网或通过 USB 网卡直接执行：
    ```bash
    adb connect 192.168.1.102:5555
    # 或
    adb connect 169.254.170.2:5555
    ```

---

## 三、 熄屏随身听（Walkman）模式实现

为了满足用户“听歌时熄灭屏幕省电、但 CPU 保持运行不中断播放”的需求：

1. **为什么不能使用系统级 Suspend（挂起/睡眠）**：
   Linux 系统如果执行 `echo mem > /sys/power/state`，全志 H700 CPU 核心将停振、DRAM 进入自刷新，音频 DAC 与 DMA 传输会瞬间中断。
2. **硬件级背光低功耗模式**：
   * 在进入随身听模式时，程序向内核发送：
     ```bash
     echo 4 > /sys/class/backlight/*/bl_power
     ```
   * 参数 `4` 在 Linux 帧缓冲/背光子系统中代表 `FB_BLANK_POWERDOWN`，它会切断屏幕 LCD 背光驱动芯片供电，功耗骤降 80% 以上。
   * 启动器将 SDL 视口刷黑后进入轻量级阻塞事件循环，CPU 仅需极低占用为音频解码提供算力。
   * 当用户轻触任意按键或按下电源键时，捕获输入中断，立即写入 `echo 0 > .../bl_power` 恢复背光，无缝唤醒界面。

---

## 四、 编译与测试验证

该系统控制中心已集成在 `projects/ROCKNIX/packages/apps/handheld-launcher` 中，随整机镜像自动打包。

### 本地模拟器预览运行
在开发机桌面随时测试该控制中心：
```bash
./tools/run-launcher-simulator.sh
```
* 键盘 `W`/`S` 或 方向键上下：滚动选择设置项。
* 键盘 `A`/`D` 或 方向键左右：调节亮度、音量与切换 USB 模式。
* 键盘 `Space`/`Enter`：切换 Wi-Fi/蓝牙/随身听模式。
* 键盘 `Esc` 或 `Backspace`：返回上一层。
* 手柄 `START + SELECT`：安全退出模拟器。
