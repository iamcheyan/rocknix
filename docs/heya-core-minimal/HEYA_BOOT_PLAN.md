# 07 · Heya 启动入口规划

> 目标：不实现 UI，只规划结构。

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
Description=Heya Pocket OS Launcher
Requires=sway.service
After=sway.service

[Service]
Type=simple
ExecStart=/usr/bin/heya
Restart=always
RestartSec=2
Environment=HOME=/storage

[Install]
WantedBy=multi-user.target
```

来源：`projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`（修改）

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
├── heya.service        # systemd unit
├── start_es.sh.patch   # 前端切换 patch（可选）
└── README.md           # 安装与验证说明
```

来源：`~/development/heya/integrations/rocknix/`（已有草案）

## 启动链验证

```sh
# 构建后验证
systemctl status heya.service
# 应显示 active (running)
systemctl is-enabled heya.service
# 应显示 enabled
pgrep -af heya
# 应显示 /usr/bin/heya 进程
```

## 不实现的内容

- 不实现 heya UI（V1 已在 heya 仓库完成）
- 不实现游戏启动（RetroArch 作为独立 Application 由用户启动）
- 不实现主题系统（heya 有自己的 JSON 主题）
- 不实现 ROM 扫描（heya 不碰 ROM）