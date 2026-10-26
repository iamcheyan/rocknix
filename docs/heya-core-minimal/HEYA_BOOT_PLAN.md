# 07 · Heya 与 Sonata 启动集成

> H700 方案：heya 是系统前端，Sonata 作为普通 heya 媒体应用出现。

## 设计

```
systemd
  ↓
sway.service (Wayland compositor)
  ↓
heya.service
  ↓
/usr/bin/heya
```

替换：
```
旧：essway.service → start_es.sh → emulationstation
新：heya.service → /usr/bin/heya
```

## heya.service

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
Environment=SDL_GAMECONTROLLERCONFIG_FILE=/usr/config/SDL-GameControllerDB/gamecontrollerdb.txt
ExecStart=/usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
Restart=always
RestartSec=2
KillMode=process
TimeoutStopSec=3

[Install]
WantedBy=rocknix.target
```

来源：`projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service`

## H700 quirk 修改

文件：`projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service`

```
# 旧
UI_SERVICE="sway.service essway.service"
# 新
UI_SERVICE="sway.service heya.service"
```

## heya 包结构

```
projects/ROCKNIX/packages/apps/heya/
├── package.mk          # ROCKNIX package recipe
├── integrations/rocknix/heya.service
└── autostart/050-heya-apps # 首次启动时复制默认应用 manifest
```

Sonata 由 `projects/ROCKNIX/packages/apps/sonata/` 构建，依赖 mpv、foot 和 `rocknix-hotkey`。foot 为 Sonata 提供终端窗口，gptokeyb 将 H700 手柄按键映射为方向键和 Sonata 操作。包内 manifest 安装到只读 `/usr/share/heya/apps`，autostart 首次启动时复制到可写 `/storage/heya/apps`，不会覆盖用户已有配置。

## 启动链验证

```sh
# 构建后验证
systemctl status heya.service
# 应显示 active (running)
systemctl is-enabled heya.service
# 允许 disabled：由 H700 quirk 在配置初始化完成后启动，不提前 enable
pgrep -af heya
# 应显示 heya 进程
```

## 不实现的内容

- 不实现 heya UI（V1 已在 heya 仓库完成）
- 不包含模拟器或 ROM 扫描
- 不实现主题系统（heya 有自己的 JSON 主题）
