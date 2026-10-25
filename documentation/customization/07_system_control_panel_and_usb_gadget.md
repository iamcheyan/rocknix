# 07. 系统控制中心与 USB 扩展功能（MTP / ADB 调试）

为了使 RG34XX 成为一台真正开箱即用的便携 Linux 开发板，我们在主启动器中直接打通了底层现成的系统设置与 USB Gadget 模式，避免了传统掌机需要安装桌面环境或笨重界面的烦琐。

---

## 一、 系统控制中心（System Control Panel）功能

进入启动器的 **`2. System Settings & Control Panel`**，即可直接操作掌机的各项硬件与系统服务：

### 1. WiFi 管理
* **功能**：一键切换无线网络开关（`wifictl enable / disable`）；
* **底层**：直接与系统的 NetworkManager / WPA Supplicant 联动。

### 2. 蓝牙音频
* **功能**：一键切换蓝牙射频（`rocknix-bluetooth on / off`）；
* **耳机连接**：支持与附近的无线蓝牙耳机直接配对，听歌免插线。

### 3. 背光亮度微调
* **操作**：十字键左右方向直接增减（10% ~ 100%）；
* **底层**：调用 `/usr/bin/brightness set <percent>`，即时同步到硬件背光驱动。

### 4. 系统音量微调
* **操作**：十字键左右方向直接增减（0% ~ 100%）；
* **底层**：调用 ALSA `amixer -q set Master <percent>%`，自动应用到扬声器和 3.5mm 耳机接口。

---

## 二、 USB-C 多功能模式（MTP 磁盘与 ADB 极客调试）

通过在控制中心中切换 **`USB-C Mode`**，可激活不同的 Linux USB Gadget 模式：

### 1. MTP PC 磁盘传输模式（默认推荐）
* **底层命令**：`usbgadget file_transfer`
* **体验**：
  * 用 USB-C 数据线直接插入电脑（Windows / macOS / Linux）；
  * 电脑上会自动弹出一个便携式媒体设备，就像插上手机一样；
  * 可以直接在电脑文件管理器中将音乐、视频、脚本等文件拖拽进 `/storage/` 分区，**彻底免去拔插 TF 卡的繁琐**。

### 2. ADB / USB 虚拟网卡调试模式
* **底层命令**：`usbgadget network`
* **体验**：
  * 插上 USB-C 线后，掌机自动变身一条极速 USB 虚拟以太网卡（默认 IP: `10.1.1.2`）；
  * 开发者在电脑终端直接敲：
    ```bash
    ssh root@10.1.1.2
    ```
    无需依赖 WiFi 局域网，即可直接通过 USB 数据线以高速获得掌机 root 终端权限；
  * 如果需要 ADB 调试，可直接通过 `adb connect 10.1.1.2:5555` 或 USB 接口执行 `adb shell` 与 `adb push`！
