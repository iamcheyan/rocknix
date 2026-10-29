# PJOS Linux 更名 + Switch 风格启动器 — 实机验收

合并后的 `main`（`63402983de`）在 HX90 上重建完整 H700 DDR4 镜像，并用 SYSTEM + KERNEL 双文件方式刷入 RG34XX 实机验证。

## 构建产物

| 项目 | 值 |
|---|---|
| 镜像 | `PJOS_Linux-H700.aarch64-20261029-DDR4.img.gz`（159 MB） |
| 镜像 SHA-256 | `c1a86ed8e38c36ec9bdef81e47ea6850cdc75f4395e1bf93007de2297b2e2759` |
| SYSTEM MD5 | `3ddb751ff2055f55399b92b7a9848e17` |
| KERNEL MD5 | `0a1cb182f1a7a5588430483b280d1276` |
| boot.pocket MD5 | `7f34b1cd423f6cc3b9e9262f945dee25` |
| BUILD_ID | `63402983deecb0d6e946c89def610a848e423623` |

## 截图

| 文件 | 内容 |
|---|---|
| `PJOS-01-home.png` | 首页（Terminal / Files / XMPlayer 三张卡片完整，无裁切） |
| `PJOS-02-media.png` | 多媒体页 |
| `PJOS-03-games.png` | 游戏页 |
| `PJOS-04-settings.png` | 设置页（亮度 49%、音量 60%、WiFi ON、蓝牙 OFF、息屏 5m、SSH 已启用） |
| `PJOS-05-system.png` | 系统信息页（OS 行显示 `PJOS Linux`） |
| `PJOS-06-home-wrap.png` | 第五页再按 START 回到首页，证明五页循环 |

## 实机验证结果

- `/etc/os-release` 的 `OS_NAME="PJOS Linux"`；systemd 单元描述为 `PJOS Linux PocketJS direct KMS interface`。
- 启动器运行的是镜像自带包 `/usr/share/pocketjs/apps/boot.pocket`，不是 `/storage` 覆盖；验收前已把 `runtime.conf` 里的 `POCKETJS_APP` 覆盖项删除。
- 五页 START 循环正常，进程 PID `1335` 全程未变，`pocketjs-kms` 保持 active。
- 状态栏为真实数据：IP `192.168.3.57`、电量 `100%`。
- 启动菜单 `/flash/extlinux/extlinux.conf` 已改为 `LABEL PJOS_Linux` + `MENU LABEL PJOS Linux`，改后重启正常引导。
- 开机 splash 在 initramfs 内（`initramfs/usr/bin/rocknix-splash`）：二进制中含 7 条 `PJOS LINUX` SVG 字形路径，`KoroOS` 残留计数为 0。

## 未完成 / 已知限制

- 开机 splash 是 initramfs 阶段绘制，`/device/frame.rgb` 那时还没起来，**无法用现有手段截图**；本轮只做了二进制层面的静态取证（字形路径 + 无旧品牌残留），没有实拍开机画面。
- 分区卷标仍是 `ROCKNIX`（`boot=LABEL=ROCKNIX`），属于分区标签而非显示品牌，本次未改动，避免影响启动。
- 设置页底部一行提示文字仍被屏幕下边缘轻微裁切（`PJOS-04-settings.png` 可见）。
- 设备只更新了 `/flash/SYSTEM`、`/flash/KERNEL`、`/flash/extlinux/extlinux.conf` 及各自 md5；U-Boot、dtb、STORAGE 未改动。备份位于 `/storage/{SYSTEM,KERNEL}.before-pjos-20261029*`。
