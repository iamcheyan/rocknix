# 06 · 最小系统包列表

> 基线：`next` @ `742bd52562`。当前包数量来自报告 11。

## 当前状态

| 项 | 数量 |
|---|---|
| 系统定义（`config/emulators/*.conf`） | 139 |
| libretro 核心（基础） | 125 |
| 独立模拟器（基础） | 17 |
| 总包数（估计） | ~200+ |

## 精简后

| 项 | 数量 |
|---|---|
| 系统定义 | 0（删除 `es_systems.cfg` 生成） |
| libretro 核心（保留） | 10–20（按需） |
| 独立模拟器 | 0 |
| 总包数（估计） | ~80–100 |

## 预计收益

| 项 | 估算 |
|---|---|
| 镜像体积 | 减少 30–50%（独立模拟器 + 非基础核心） |
| 编译时间 | 减少 40–60%（独立模拟器编译耗时远超核心） |
| 启动时间 | 基本不变（ES 不是启动瓶颈） |
| 内存占用 | 减少 50–100 MB（ES + 独立模拟器不运行时不占内存） |

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
| `retroarch` | 唯一模拟器前端 |
| `heya` | 新启动器 |

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
| `ppsspp` | 由 RetroArch 核心替代 |
| `duckstation` | 由 RetroArch 核心替代 |
| `melonDS` | 由 RetroArch 核心替代 |
| `mame` | 由 RetroArch 核心替代 |
| `flycast` | 由 RetroArch 核心替代 |
| `rpcs3` | 完全移除 |
| 其它独立模拟器 | 由 RetroArch 核心替代 |
| 非基础 libretro 核心 | 按需安装 |

## 修改路径

1. `distributions/ROCKNIX/config/options.conf`：从 `ADDITIONAL_PACKAGES` 中移除游戏相关包
2. `projects/ROCKNIX/packages/virtual/emulators/package.mk`：只保留 `retroarch`
3. `projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service`：`UI_SERVICE` 改为 `sway.service heya.service`
4. `projects/ROCKNIX/packages/ui/emulationstation/`：整个目录删除
5. `projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`：删除
6. `projects/ROCKNIX/packages/ui/emulationstation/sources/start_es.sh`：删除
7. `projects/ROCKNIX/packages/apps/heya/`：新增 heya 包

## 验证

- `make H700` 构建成功
- 镜像中不包含 `emulationstation`、`essway`、独立模拟器
- `systemctl status heya.service` 为 active
- 不出现 `essway.service` 或 `emulationstation` 进程