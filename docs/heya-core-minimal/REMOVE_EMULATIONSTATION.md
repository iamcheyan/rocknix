# 04 · EmulationStation 剥离

> 基线：`next` @ `742bd52562`。

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
| `essway.service` 消失 | 新建 `heya.service` 替代 |
| `start_es.sh` 消失 | 整个文件删除；heya 直接由 systemd 拉起 |
| `es_systems.cfg` 不再生成 | 构建步骤中删除 `mk_es_systems` 调用 |
| `es_features.cfg` 不再需要 | 构建步骤中删除该文件的安装 |
| `es_input.cfg` 不再需要 | 构建步骤中删除该文件的安装 |
| 主题目录 | 用户数据 `/storage/.config/emulationstation/themes/` 可保留但不使用 |
| `handheld-launcher` | 被 heya 取代；`start_es.sh` 中的分支删除 |

## 替代方案

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

[Install]
WantedBy=multi-user.target
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