# 02 · 保留组件

> 基线：`next` @ `742bd52562`。

## 必须保留

| 组件 | 理由 | 证据 |
|---|---|---|
| U-Boot | 唯一的启动入口 | 报告 01 |
| Kernel + DTB | 系统基础 | 报告 01 |
| GPU Driver | Wayland/SDL2 需要 | H700 平台 |
| DRM/KMS | SDL2 直连显示 | 报告 01 |
| Wayland | 未来 heya 的 compositor | 报告 09 |
| Sway | Wayland compositor | 报告 09 |
| SDL2 | heya 的 UI 库 | heya `go.mod` |
| SDL2_ttf | heya 的字体渲染 | heya `go.mod` |
| ALSA | 音频输出 | 报告 09 |
| PipeWire | 现代音频路由（可选） | 报告 09 |
| BlueZ | 蓝牙 | 报告 09 |
| Wi-Fi | 网络 | 报告 09 |
| SSH | 远程管理 | 报告 09 |
| systemd | 系统初始化 | 报告 01 |
| RetroArch | 保留的唯一模拟器前端 | 报告 04 |
| heya | 新启动器 | 本项目 |

## 可保留（按需）

| 组件 | 条件 |
|---|---|
| NetworkManager / iwd | 保留 Wi-Fi 管理 |
| avahi-daemon | mDNS 服务发现 |
| seatd | 多 seat 支持 |
| powerstate.service | 电源管理 |
| batteryplus | 电量显示 |
| fancontrol.service | 散热控制 |
| input.service | 输入感知 |
| hdmi-hotplug | HDMI 热插拔 |

## 不保留

| 组件 | 理由 |
|---|---|
| EmulationStation | 被 heya 取代 |
| 所有独立模拟器 | 仅保留 RetroArch |
| Scraper / 成就 | 游戏元数据系统 |
| 主题引擎 | ES 专属 |
| 游戏集合 | ES 专属 |