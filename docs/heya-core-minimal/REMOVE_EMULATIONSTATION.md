# 04 · H700 镜像禁用 EmulationStation

> 基线：`next` @ `742bd52562`。
> H700 迷你镜像不安装 EmulationStation；共享源码保留给其它设备。

## 依赖关系

```
essway.service
  Requires=sway.service
  After=sway.service
  ExecStart=/usr/bin/start_es.sh
  Restart=always
```

来源：`projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`

## 启动链中的位置

```
rocknix.target
  → rocknix-autostart
    → autostart 脚本
      → $UI_SERVICE (H700: "sway.service essway.service")
        → sway.service
        → essway.service
          → start_es.sh
            → emulationstation / handheld-launcher
```

## 删除影响

| 影响 | 处理 |
|---|---|
| `essway.service` 不进入 H700 镜像 | H700 `UI_SERVICE` 改为启动 `heya.service` |
| `start_es.sh` 不进入 H700 镜像 | 保留共享源码，不构建 EmulationStation 包 |
| `es_systems.cfg` 不生成 | EmulationStation 与模拟器元包均不进入镜像 |
| `es_features.cfg`、`es_input.cfg` 不安装 | 它们由 EmulationStation 包提供 |
| 主题目录 | 用户数据 `/storage/.config/emulationstation/themes/` 可保留但不使用 |
| `handheld-launcher` | 不进入 H700 迷你镜像 |

## 替代方案

```ini
[Unit]
Description=heya launcher shell
Requires=sway.service
After=sway.service
Conflicts=essway.service

[Service]
Type=simple
Environment=HOME=/storage
Environment=XDG_RUNTIME_DIR=/var/run/0-runtime-dir
Environment=WAYLAND_DISPLAY=wayland-1
Environment=SDL_VIDEODRIVER=wayland
Environment=SDL_AUDIODRIVER=pulseaudio
EnvironmentFile=/etc/profile
ExecStart=/usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
Restart=always
RestartSec=2
KillMode=process
TimeoutStopSec=3

[Install]
WantedBy=rocknix.target
```

H700 quirk 修改：
```
# 旧
UI_SERVICE="sway.service essway.service"
# 新
UI_SERVICE="sway.service heya.service"
```

## 验证

- `systemd-analyze verify heya.service` 无错误
- `make H700` 构建成功
- 镜像启动后 `systemctl status heya.service` 为 active
- 不出现 `essway.service` 或 `emulationstation` 进程
