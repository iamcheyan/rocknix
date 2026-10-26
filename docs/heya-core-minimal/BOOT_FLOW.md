# 01 · 启动链分析

> 基线：`next` @ `742bd52562`。证据来自 `docs/audit/ROCKNIX_ARCHITECTURE_REPORT_01_BOOT_CHAIN.md`。

## 当前启动链

```mermaid
flowchart LR
  UBOOT["U-Boot (8 KiB offset)"] --> K["Kernel + DTB"]
  K --> I["busybox initramfs"]
  I --> M["Mount /flash, SYSTEM squashfs, /storage"]
  M --> SR["switch_root -> /usr"]
  SR --> T["rocknix.target"]
  T --> A["rocknix-autostart"]
  A --> AS["autostart -> $UI_SERVICE"]
  AS --> SWAY["sway.service (H700)"]
  SWAY --> ES["essway.service"]
  ES --> SH["/usr/bin/start_es.sh"]
  SH --> FRONT["emulationstation / handheld-launcher"]
```

`[事实]` `essway.service` 的定义：
- `Requires=sway.service`、`After=sway.service`
- `ExecStart=/usr/bin/start_es.sh`
- 来源：`projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`

`[事实]` `start_es.sh` 的内容：
1. source `es_settings`
2. `prerotate_env`
3. `scanout_reset_stale`
4. 启动前端

`[事实]` 本 fork 在 `start_es.sh` 中加了 `handheld-launcher` 分支：
```sh
if [ -x /usr/bin/handheld-launcher ]; then
  exec /usr/bin/handheld-launcher
fi
# 否则回退到 emulationstation
```
来源：`.../sources/start_es.sh:18-22`

## 替换点

| 层 | 当前 | 目标 | 影响 |
|---|---|---|---|
| systemd target | `rocknix.target` | 不变 | 无 |
| autostart | `$UI_SERVICE` | 不变 | 无 |
| UI_SERVICE | `sway.service essway.service` | `sway.service heya.service` | 改 H700 quirk |
| start_es.sh | ES / handheld-launcher | heya | 整个文件可删 |
| heya.service | 不存在 | 新建 | 新增 unit |

## 依赖关系

```
heya.service
  Requires=sway.service
  After=sway.service
  ExecStart=/usr/bin/heya
  Restart=always
```

`[推断]` 保留 `sway.service` 是因为 heya 未来需要 Wayland compositor；当前 V1 heya 是 SDL2 直连 DRM/KMS，但保留 sway 可避免后续重写。

## 风险

- `[推断]` `essway.service` 以 `Restart=always` 拉起，杀掉 ES 进程会被 systemd 重新拉起。真正的"退出"必须走 `run`/`powerstate` 等控制脚本，而不是简单退出进程。
- `[事实]` H700 的 `UI_SERVICE` 定义在 `projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service`。