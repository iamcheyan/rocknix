# 06 · 最小系统包列表

> 基线：`next` @ `742bd52562`。当前包数量来自报告 11。

## 当前状态

| 项 | 数量 |
|---|---|
| 系统定义（`config/emulators/*.conf`） | 139 |
| libretro 核心（基础） | 125 |
| 独立模拟器（基础） | 17 |
| 总包数（估计） | ~200+ |

## H700 迷你镜像

| 项 | 数量 |
|---|---|
| ES 系统定义 | 不打包 |
| RetroArch / libretro 核心 | 不打包 |
| 独立模拟器 | 0 |
| ES 前端、主题和工具 | 不打包 |
| 额外播放器 | 仅保留 XMPlayer 依赖的 mpv |

## 预计收益

| 项 | 估算 |
|---|---|
| 镜像体积、构建时间 | 待构建后测量 |
| 启动时间、内存占用 | 待设备测量 |

## 目标包列表

### 必须保留

| 包 | 理由 |
|---|---|
| `busybox` | 基础工具 |
| `systemd` | 系统初始化 |
| `kernel` | 内核 |
| `u-boot` | 启动 |
| `sway` | Wayland compositor |
| `SDL2` | heya UI 库 |
| `SDL2_ttf` | heya 字体渲染 |
| `ALSA` | 音频输出 |
| `PipeWire` | 现代音频路由 |
| `BlueZ` | 蓝牙 |
| `NetworkManager` / `iwd` | Wi-Fi |
| `openssh` | SSH |
| `heya` | 新启动器 |
| `mpv` | XMPlayer 播放后端 |
| `foot` + `rocknix-hotkey` + `mc` | Disk 浏览器的终端 UI 和掌机按键输入 |

### 可选保留

| 包 | 理由 |
|---|---|
| `avahi-daemon` | mDNS |
| `seatd` | 多 seat |
| `powerstate` | 电源管理 |
| `batteryplus` | 电量显示 |
| `fancontrol` | 散热 |
| `input-sense` | 输入感知 |
| `hdmi-hotplug` | HDMI 热插拔 |

### 删除

| 包 | 理由 |
|---|---|
| `emulationstation` | 被 heya 取代 |
| `essway` | 被 heya.service 取代 |
| `handheld-launcher` | 被 heya 取代 |
| EmulationStation、主题和 ES 工具 | H700 镜像不再依赖 |
| RetroArch、libretro 核心、独立模拟器 | H700 镜像不再依赖 |
| handheld-launcher | 不纳入迷你镜像；XMPlayer 与 Disk 保留为 heya 应用 |
| NFS、Samba 服务、VPN、模块包、调试包 | H700 迷你镜像关闭 |

## 修改路径

1. `projects/ROCKNIX/devices/H700/options`：启用迷你镜像并选择 heya、xmplayer
2. `projects/ROCKNIX/packages/virtual/image/package.mk`：只为迷你镜像裁减可选包组
3. `projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service`：启动 Sway + heya
4. `projects/ROCKNIX/packages/apps/heya/`、`xmplayer/`：添加应用构建包和 heya manifest

## 验证

- `make H700` 构建成功（待执行）
- 镜像中不包含 `emulationstation`、`essway`、模拟器包（待镜像检查）
- `systemctl status heya.service` 为 active
- Heya 首次启动后能发现 XMPlayer 与 Disk（待实机验证）

SSH/SFTP 保留，供真机调试及传输媒体。默认应用为 XMPlayer 与 Disk。
开发服务（ADB、HTTP、Telnet、Avahi 等）由 `system.cfg` 的 `*.enabled` 开关控制，见 `rocknix-services`。
