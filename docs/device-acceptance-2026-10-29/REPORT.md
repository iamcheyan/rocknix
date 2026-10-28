# ROCKNIX / PocketShell / PocketJS 实机验收报告（2026-10-29）

- 设备：Anbernic RG34XX（Rockchip H700，DDR4），hostname `H700`，内核 `7.2.0 aarch64`，LAN `192.168.3.57`
- 构建机：HX90（`192.168.3.188` / `hx90`），NixOS
- 本机仓库：`/home/tetsuya/development/rocknix`，分支 `main`，HEAD `174727d4a4`
- 截图通道：`http://192.168.3.57:8080/device/frame.rgb` → RGB24 720×480（1,036,800 字节）
- 截图纪律：每张图由本次测试当场产生；设备类=LCD 真实扫描输出；浏览器类=真实浏览器渲染；命名 `NN-<项>-<步骤>-<状态>.png`。

## 总表

| 编号 | 项目 | 状态 | 证据截图 | 修复 commit | 备注 |
|---|---|---|---|---|---|
| P1 | HX90 未提交改动盘点 | PENDING | - | - | |
| P2 | HX90 对齐 origin/main | PENDING | - | - | |
| P3 | rquickjs-sys 编译修复 | PENDING | - | - | |
| P4 | 可重复构建命令文档 | PENDING | - | - | |
| A1 | 启动器中文字体 | PENDING | - | - | |
| A2 | 电池 Nerd 图标 | PENDING | - | - | |
| A3 | 字体子集可复现 | PENDING | - | - | |
| A4 | 全页面巡检 | PENDING | - | - | |
| B1 | 抓帧字节正确 | PASS | B01-lcd-frame-rgb-correct.png | - | 1036800 字节 ✓ |
| B2 | 浏览器显示真实画面 | PASS | B02-browser-shows-device.png | - | DOM 确认 LCD live |
| B3 | 网页→设备注入 | PASS | B03-web-inject-device-lcd-before.png, B03-web-inject-device-lcd-after.png, B04-web-inject-browser-after.png | - | ArrowRight→device RIGHT, LCD 变化 19.40% |
| B4 | 设备→网页跟随 | PASS | B05-web-follow-device-before.png, B06-web-follow-device-after.png, B07-web-follow-browser-before.png, B08-web-follow-browser-after.png, B09-device-after.png, B10-web-canvas-after.png | - | 设备 LCD 变化 19.40%，浏览器同步 |
| B5 | 刷新率/撕帧限制 | PASS | B11-mirror-rate-limit.png | - | 实测 4fps 轮询；空闲帧稳定无撕裂 |
| B6 | 断线恢复 | PASS | B12-recovery-mirror-live.png, B13-recovery-stopped.png, B14-recovery-recovered.png | - | 停服→unavailable，重启→自动 LCD live |
| C1 | 输入工作区开关 | PASS | C01-input-open.png, C01-input-closed.png | - | F2 开；Escape 退出并恢复 |
| C2 | 布局切换 | PASS | C02-abc.png, C02-num.png, C02-sym.png, C02-path.png | - | ABC→NUM→SYM→PATH 与 state 一致 |
| C3 | 功能页切换 | PASS | C03-keyboard.png, C03-commands.png, C03-phrases.png, C03-sessions.png, C03-agent.png, C03-history.png | - | 6 页循环与 state 一致 |
| C4 | 编辑与提交到 PTY | PASS | C04-before.png, C04-after.png | - | 提交后 SHELL PTY bytesOut +57，画布变化 1.29% |
| C5 | /api/state 一致性 | PASS | C05-state.png | - | input.entered/layout/function 与 UI 一致 |
| C6 | 历史与预置 | PASS | C06-commands.png, C06-phrases.png, C06-sessions.png, C06-agent.png, C06-preset-selected.png | - | 预置选中落入缓冲（buffer=ssh pve） |
| D1 | 布局 | PENDING | - | - | |
| D2 | 中文文案 | PENDING | - | - | |
| D3 | 服务开关真实生效 | PENDING | - | - | |
| D4 | 设置页 | PENDING | - | - | |
| D5 | 每个条目点一遍 | PENDING | - | - | |
| D6 | 冷启动与异常 | PENDING | - | - | |
| E1 | ADB 脚本静态校验 | PASS | E-evidence.txt | - | sh -n OK；PID 提取 `:::5555` 命中/`:::55550` 排除 |
| E2 | 根因复现 | PASS | E-evidence.txt | - | 孤儿占端口；杀+重启 → listener==MainPID |
| E3 | USB-ADB 不误杀 | PASS | E-evidence.txt | - | usbgadget=adb 时跳过、未杀 |
| E4 | 插拔自愈 | PASS（模拟） | E-evidence.txt | - | systemctl 触发 service，健康时不动 |
| E5 | 副作用检查 | PASS | E-evidence.txt | - | 服务全 active、SSH 正常、无新增失败 |
| F1 | SYSTEM MD5 一致性 | PASS | F-evidence.txt | - | /flash/SYSTEM=71b156e4… 与 sidecar 一致 |
| F2 | 备份可回滚 | PASS | F-evidence.txt | - | 备份完整 + 回滚命令 |
| F3 | 启动分区完整性 | PASS | F-evidence.txt | - | /flash 只读；FDT /dtb.img；KERNEL/dtb 未改 |
| F4 | 重启回归 | PASS | K07-after-reboot.png | - | 重启后服务 active（复用 K7） |
| G1 | 快速路径跳过 clean | PENDING | - | - | |
| G2 | 真的出包 | PENDING | - | - | |
| G3 | 耗时对比 | PENDING | - | - | |
| G4 | 文档一致 | PENDING | - | - | |
| H1 | mirror 功能验证 | PASS | H01-mirror-frame.jpg, H-evidence.txt | - | JPEG 720×480 抓帧 + evdev 注入 ok |
| H2 | 与 dev 重复判定 | PASS（判定） | H-evidence.txt | - | 功能重叠，建议见 DEC-004 |
| I1 | 连续使用场景 | PENDING | - | - | |
| I2 | 无残留异常 | PENDING | - | - | |
| I3 | 已知限制清单 | PENDING | - | - | |
| K1 | 屏幕休眠守护进程 | PASS | K02-default.png | f0821e95fa | is-active=active，进程在跑 |
| K2 | 默认 30m | PASS | K02-default.png | - | 无 [sleep]→timeout=1800s |
| K3 | 1m 档关屏 | PASS（机制）/ 截图限制 | K03-on.png, K03-dimmed.png | f0821e95fa | backlight 1249→0；frame.rgb 保留 fb，见 DEC-001 |
| K4 | 按键唤醒 | PASS | K04-woken.png | - | 唤醒→backlight=1249 |
| K5 | ≥3 档实测 | PASS | K05-10s-dimmed.png, K03-dimmed.png, K08-never-stays-on.png | - | 10s / 1m / never |
| K6 | 不影响其它服务 | PASS | K06-services-ok.png | - | kms/dev/adbd active；仅 2 个既有失败，见 DEC-002 |
| K7 | 重启后记忆 | PASS | K07-after-reboot.png | - | 重启后 active + timeout=60s |
| K8 | never 不暗 | PASS | K08-never-stays-on.png | - | 静置 15s 仍 2499 |

## 详细记录

（逐项测试时填充，每个编号一个小节。）
### B1 抓帧字节正确
- 状态：PASS
- 测试时间（JST）：2026-10-29 00:46
- 设备状态：H700 / 7.2.0 / pocketshell-dev active / 服务全部 active
- 操作步骤：`curl -s http://192.168.3.57:8080/device/frame.rgb | wc -c`
- 预期 / 实测：恰好 1,036,800 字节（720×480×3 RGB24）。实测 = 1036800 ✓。人眼无法判图，已用脚本校验 PNG 720×480 且像素有变化（sum_std=92，非空帧）。
- 截图：![](./B01-lcd-frame-rgb-correct.png)
- 问题与根因：无。
- 未验证/限制：无。

### B2 浏览器显示真实画面
- 状态：PASS
- 测试时间（JST）：2026-10-29 00:47
- 设备状态：同上；Dev Center 打开即自动拉取 `/device/frame.rgb`（每 250ms 轮询）。
- 操作步骤：Playwright 打开 `http://192.168.3.57:8080/`，等待 6s 后截图 `B02-browser-shows-device.png`；并用 DOM 探针读取 `#link` 文本与 canvas 像素。
- 预期 / 实测：画布显示设备当前 LCD。DOM 探针确认 `link="handheld LCD live · 192.168.3.57:8080"`，canvas 720×480 非黑像素 100%，说明渲染的是真实 LCD 而非主机 PTY 模型。控制台 0 错误。
- 截图：![](./B02-browser-shows-device.png)
- 问题与根因：无。
- 未验证/限制：浏览器侧画面为设备 LCD 的 RGB 镜像（约 4fps，见 B5），非原生逐帧同步。
### B3 网页→设备注入
- 状态：PASS
- 测试时间（JST）：2026-10-29 00:52
- 设备状态：H700 / pocketshell-dev active
- 操作步骤：在浏览器 Dev Center 页面（deviceLive 模式）调用 `page.keyboard.press('ArrowRight')`。页面 `keydown` 处理器（deviceLive 分支）将 `ArrowRight` 映射为设备键 `RIGHT` 并 `POST /device/key`。在按键前后各抓一次 `/device/frame.rgb` 做像素差。
- 预期 / 实测：网页按键应使设备 LCD 出现可见变化。实测前后帧像素差 = **19.40%**（前后帧 sum_std 118.7→75.0，内容确已改变）。证明网页→设备的按键注入链路（`/device/key`）真实生效。
- 截图：![](./B03-web-inject-device-lcd-before.png) / ![](./B03-web-inject-device-lcd-after.png) / 浏览器侧 ![](./B04-web-inject-browser-after.png)
- 问题与根因：无。
- 未验证/限制：该按键映射是 Dev Center 的 Web 层映射（ArrowRight→RIGHT），并非物理手柄；物理手柄走同一 `/device/key` 后端，本次未接物理手柄实按（设备无实体按键可远程按）。逻辑链路已通过 HTTP 端点证明。
### B4 设备→网页跟随
- 状态：PASS
- 测试时间（JST）：2026-10-29 00:55
- 设备状态：H700 / pocketshell-dev active
- 操作步骤：在不经过网页 UI 的情况下，用 `curl -X POST /device/key --data RIGHT` 直接让设备侧按键（模拟物理按键）改变 LCD；等待浏览器 250ms 轮询追上后，分别截设备帧与浏览器画面。再用 Playwright 单独截 `#screen` 画布元素，缩放回 720×480 与设备帧做像素差。
- 预期 / 实测：设备 LCD 独立变化后，浏览器应在下一帧跟随。实测设备帧前后差 **19.40%**；浏览器整页前后差 **2.43%**；浏览器画布元素缩放后与设备帧差 **2.54%**（残差来自 CSS 缩放/采样，内容一致）。证明网页跟随设备显示。
- 截图：设备 ![](./B05-web-follow-device-before.png) → ![](./B06-web-follow-device-after.png)；浏览器 ![](./B07-web-follow-browser-before.png) → ![](./B08-web-follow-browser-after.png)；画布 vs 设备 ![](./B09-device-after.png) / ![](./B10-web-canvas-after.png)
- 问题与根因：无。
- 未验证/限制：跟随存在约 250ms 轮询延迟（见 B5）；浏览器画布为 CSS 缩放显示，非 1:1 像素拷贝。
### B5 刷新率与撕帧限制
- 状态：PASS（限制如实记录，非缺陷）
- 测试时间（JST）：2026-10-29 00:58
- 设备状态：H700 / pocketshell-dev active
- 操作步骤：读 `devcenter.html` 源码确认轮询间隔；用 `curl /device/frame.rgb` 连续抓取：①空闲时取 10 帧算 md5；②注入 RIGHT 改变显示时取 6 帧算 md5 看是否区分。
- 预期 / 实测：浏览器侧 LCD 镜像非实时。源码 `setTimeout(refreshDeviceFrame, 250)` → **轮询周期 250ms ≈ 4fps**，与既有已知限制一致。空闲 10 帧 md5 全部相同（`9f5c9eb8c92…`），**无半帧/撕裂/闪烁**；设备变化时帧内容随之改变（6 帧 md5 各异）。
- 截图：![](./B11-mirror-rate-limit.png)
- 问题与根因：非缺陷——这是单帧拉取式镜像的设计取舍（每 250ms 拉一次 `/device/frame.rgb`），不是逐帧同步。
- 未验证/限制：动态画面会有约 250ms 跟随延迟；运动瞬间存在单帧抓取恰逢扫描中途的理论可能，但空闲稳定性实测证明 KMS 呈现为整帧，未观察到撕裂。
### B6 断线恢复 + SupplementaryGroups 校验
- 状态：PASS
- 测试时间（JST）：2026-10-29 01:01
- 设备状态：H700 / pocketshell-dev（运行 `/storage/pocketshell-dev.new --bind 192.168.3.57 --port 8080`）
- 操作步骤：浏览器保持打开；`systemctl stop pocketshell-dev` → 等待 → 截图；`systemctl start pocketshell-dev` → 等待 8s → 截图。并用 `systemctl show pocketshell-dev -p SupplementaryGroups` 校验权限组。
- 预期 / 实测：页面应能自恢复。实测 DOM `#link` 文本：
  - 停服前：`handheld LCD live · 192.168.3.57:8080`
  - 停服后：`handheld unavailable · Failed to fetch`
  - 重启后：`handheld LCD live · 192.168.3.57:8080`，且 `systemctl is-active pocketshell-dev` = `active`
  → 浏览器侧 WebSocket 断线后自动重连、frame 轮询恢复，页面自恢复成功。`OnFailure=` 为空，停服未触发 recovery 抢占 tty7。
- SupplementaryGroups 校验：`systemctl show pocketshell-dev -p SupplementaryGroups` → `SupplementaryGroups=video input`；单元文件第 27 行 `SupplementaryGroups=video input`。证明读 DRM/写输入设备的权限组由 systemd 单元提供，而非手动 export。
- 截图：![](./B12-recovery-mirror-live.png) / ![](./B13-recovery-stopped.png) / ![](./B14-recovery-recovered.png)
- 问题与根因：无。
- 未验证/限制：仅验证了 Dev Center 页面的 TCP/WS 自恢复；未模拟网络物理断开后重连的更长超时路径。
### C1 输入工作区开关
- 状态：PASS
- 测试时间（JST）：2026-10-29 01:10
- 设备状态：H700 / pocketshell-dev active
- 操作步骤：终端缓冲模式（屏蔽 `/device/frame.rgb` 以退出 LCD 镜像）下按 `F2` 打开输入工作区；`/api/state` 读 `input.entered`；按 `Escape` 退出。
- 预期 / 实测：F2 打开，`input.entered` 由 `false`→`true`；Escape 退出并恢复原视图，`input.entered`→`false`。反应正确，无错位/空白。
- 截图：![](./C01-input-open.png) / ![](./C01-input-closed.png)
- 问题与根因：无。
- 未验证/限制：输入工作区仅在“终端缓冲模式”（LCD 镜像关闭）下可用，源码 `enterInput()` 在 `deviceLive` 时直接 return；这是设计约束，非缺陷。

### C2 布局切换
- 状态：PASS
- 操作步骤：输入工作区内按 `ArrowRight` 在 ABC/NUM/SYM/PATH 间循环，每步读 `/api/state.input.layout`。
- 实测：`layout` 依次为 `ABC`→`NUM`→`SYM`→`PATH`（与界面高亮一致）。
- 截图：![](./C02-abc.png) ![](./C02-num.png) ![](./C02-sym.png) ![](./C02-path.png)
- 问题与根因：无。

### C3 功能页切换
- 状态：PASS
- 操作步骤：`PageUp`/`PageDown` 在 Keyboard/History/Commands/Phrases/Sessions/Agent 间循环，每步读 `input.function`。
- 实测：`function` 依次为 `Keyboard`→`History`→`Commands`→`Phrases`→`Sessions`→`Agent`（与标签页一致）。每页均渲染。
- 截图：![](./C03-keyboard.png) ![](./C03-commands.png) ![](./C03-phrases.png) ![](./C03-sessions.png) ![](./C03-agent.png) ![](./C03-history.png)
- 问题与根因：无。

### C4 编辑与提交到 PTY
- 状态：PASS
- 操作步骤：输入工作区键入 `seq 1 12`，`Enter` 提交；对比提交前后活动 PTY 的 `bytesOut` 与终端画布像素。
- 实测：活动 PTY（SHELL）`bytesOut` 由 307→364（**+57**，命令字节已进入 PTY**）；终端缓冲画布前后像素差 **1.29%**（12 行输出可见，单屏 720×480 下占比正常）。
- 截图：![](./C04-before.png) / ![](./C04-after.png)
- 问题与根因：输入工作区提交目标是 **Dev Center 的 SHELL PTY**（服务端维护的会话），并非设备 LCD 上 PocketShell 自身显示的 PTY；因此设备 LCD 不回显该命令属架构预期。PTY 侧（Dev Center 终端视图）确已产生可见输出。
- 未验证/限制：未做 OCR 文本比对，以字节增量 + 画布像素差作为“进入 PTY 并产生可见输出”的客观证据。

### C5 /api/state 一致性
- 状态：PASS
- 操作步骤：打开输入工作区后读取 `/api/state` 的 `input` 字段（`entered`/`previousView`/`buffer`/`layout`/`function`/`history`），与界面逐项对照（C2/C3 每步均比对）。
- 实测：`input.entered=true`；C2/C3 中 `input.layout`/`input.function` 的每次变化都与界面高亮选择完全对应。
- 截图：![](./C05-state.png)
- 问题与根因：无。

### C6 历史与预置
- 状态：PASS
- 操作步骤：进入 History/Commands/Phrases/Sessions/Agent 各功能页，确认预置条目存在；点击某预置条目，验证其值落入输入缓冲（`input.buffer`）。
- 实测：各页均有预置条目（如 Agent 页含 `ssh pve` 等）；点击 Agent 页首项后 `input.buffer="ssh pve"`，证明预置可落入缓冲。
- 截图：![](./C06-commands.png) ![](./C06-phrases.png) ![](./C06-sessions.png) ![](./C06-agent.png) ![](./C06-preset-selected.png)
- 问题与根因：无。
- 未验证/限制：History 页当前为空（本会话尚未产生提交历史），属正常初始状态；预置来源 Commands/Phrases/Sessions/Agent 均可用。
### K1 屏幕休眠守护进程
- 状态：PASS
- 测试时间（JST）：2026-10-29 01:50
- 设备状态：H700；`pocketjs-sleep` 以 `/storage/.config/system.d/pocketjs-sleep.service` 手工部署（根 fs 只读 squashfs，`/storage/.config/system.d` 在 systemd UnitPath 中）。
- 操作步骤：`systemctl is-active pocketjs-sleep`；`journalctl -u pocketjs-sleep -o cat | grep timeout=`。
- 预期 / 实测：`is-active=active`；日志 `pocketjs-sleep: timeout=1800s backlight=/sys/class/backlight/backlight cur=2499 max=2499 devices=[event0..3]` —— 进程真实在跑（非 dead），且监控到 4 个输入设备。
- 截图：![](./K02-default.png)
- 问题与根因：首次部署即发现守护进程**崩溃**（`configparser.MissingSectionHeaderError`，因 runtime.conf 为 `POCKETJS_APP=...` 非 INI）。已修复（commit `f0821e95fa`）。
- 未验证/限制：本次为手工部署（`/storage`），非镜像内验证；P3 构建完成后将随 SYSTEM 进镜像。

### K2 默认 30m
- 状态：PASS
- 操作步骤：runtime.conf 仅含 `POCKETJS_APP=...`（无 `[sleep]`），重启守护进程，读日志 timeout。
- 预期 / 实测：无 `[sleep]` 段 → 默认 30m。实测日志 `timeout=1800s`（=30 分钟），`backlight` 保持 2499 不暗。
- 截图：![](./K02-default.png)
- 问题与根因：原始 `load_config` 用 configparser 且未知值回退 300s(5m)；修复后无段/非法值均回退 1800s(30m)。
- 未验证/限制：未实测“静置 30 分钟”的全过程（用日志 timeout=1800s + 1m 档快速实测 K3 代替）。

### K3 1m 档关屏
- 状态：PASS（机制）/ 截图限制（见 DEC-001）
- 操作步骤：runtime.conf 写 `[sleep] timeout = 1m`；亮度设 1249；重启守护进程；静置 65s。
- 预期 / 实测：1 分钟无输入后 backlight 1249→**0**（`cat /sys/class/backlight/backlight/brightness` = 0），日志 `screen dimmed`。
- 截图：![](./K03-on.png)（1249，屏亮）/ ![](./K03-dimmed.png)（backlight=0；**注意**：frame.rgb 读 framebuffer，关背光不清 fb，故画面非全黑——这是“只写 backlight”约束的必然结果，物理面板已熄灭）
- 问题与根因：J10 期望“frame.rgb 抓全黑”，但 frame.rgb 是 KMS framebuffer 回读，`backlight=0` 不清空 fb，二者矛盾。已记 DEC-001 待用户决策。
- 未验证/限制：无法远程拍摄物理屏幕确认真黑；以 backlight=0 为关屏的客观证据。

### K4 任意按键唤醒
- 状态：PASS
- 操作步骤：关屏后 `curl -X POST /device/key --data RIGHT`（向 /dev/input 注入输入事件），读亮度与日志。
- 预期 / 实测：输入事件到达后立即恢复亮度到原值：backlight 0→**1249**，日志 `screen restored`。守护进程用 `select()` 阻塞等待输入（非轮询）。
- 截图：![](./K04-woken.png)
- 问题与根因：无。
- 未验证/限制：用 `/device/key` 注入模拟物理按键；与物理手柄走同一 evdev 路径。

### K5 各档位实测（≥3）
- 状态：PASS
- 操作步骤：分别设 `timeout = 10s` / `1m` / `never`，静置观察。
- 预期 / 实测：
  - `10s`：静置 12s → backlight 1249→0（日志 `dimmed`）。
  - `1m`：静置 65s → backlight 1249→0（见 K3）。
  - `never`：静置 15s → backlight 保持 2499（不暗）。
- 截图：![](./K05-10s-dimmed.png) / ![](./K03-dimmed.png) / ![](./K08-never-stays-on.png)
- 问题与根因：无。
- 未验证/限制：30s/5m/15m/1h 未逐一实测（同一 TIMEOUTS 映射表，行为一致）。

### K6 不影响其它服务
- 状态：PASS（详见说明）
- 操作步骤：关屏/唤醒前后 `systemctl is-active pocketjs-kms pocketshell-dev adbd`；`systemctl --failed`。
- 预期 / 实测：三服务在关屏/唤醒过程中始终 `active`；`systemctl --failed` 仅剩 2 个**预先存在**的失败单元 `rocknix-report-stats.service`、`rocknix-usbgadget.service`（会话开始前即失败，与 sleep 无关）。除此之外无新增失败。
- 截图：![](./K06-services-ok.png)
- 问题与根因：2 个既有失败归入 E/F 处理；`pocketshell-dev` 重启后不自启（`disabled`）为既有配置问题，记 DEC-002。
- 未验证/限制：未逐个验证所有服务的运行时行为，仅验证 active 状态与 --failed。

### K7 重启后记忆仍生效
- 状态：PASS
- 操作步骤：runtime.conf 设 `timeout = 1m`，`systemctl reboot`；开机后读 `is-active`、`runtime.conf`、日志 timeout、亮度。
- 预期 / 实测：重启后 `is-active=active`、`is-enabled=enabled`；`runtime.conf` 仍含 `timeout = 1m`；守护进程日志 `timeout=60s`（**非**默认 1800s，证明记忆生效）；亮度恢复 1249。
- 截图：![](./K07-after-reboot.png)
- 问题与根因：重启后 `pocketshell-dev` 为 inactive（disabled），需手动 start 才能抓帧——非 sleep 引起，记 DEC-002。
- 未验证/限制：手工部署下验证；镜像版需在 SYSTEM 含 unit 后复验。

### K8 never 档不暗
- 状态：PASS
- 操作步骤：设 `timeout = never`，亮度 2499，静置 15s。
- 预期 / 实测：backlight 保持 **2499**（不暗）；日志 `timeout=never`。
- 截图：![](./K08-never-stays-on.png)
- 问题与根因：无。
- 未验证/限制：未静置更长时间；`never` 分支 `poll=None` 阻塞等待输入，不触发 dim。
### E1 ADB 脚本静态校验
- 状态：PASS
- 操作步骤：`sh -n` 校验 `adbd-free-port`/`adbd-repair`；用合成 netstat 数据验证 awk PID 提取。
- 实测：两脚本 `sh -n` 通过；提取对 `:::5555`（1153/777/9999）命中，对 `:::55550`（4242）正确排除；repair 取首个 PID。
- 证据：`E-evidence.txt`
- 未验证/限制：`.service` 为 unit 文件，未用 `systemd-analyze verify`（需安装到系统）。

### E2 根因复现
- 状态：PASS（动作验证）
- 实测：设备存在孤儿 adbd 占 5555，`netstat` listener PID（4194/PPID=1）≠ `systemctl MainPID`（4232）。杀掉孤儿 + `systemctl restart adbd` 后 `listener=4340 == MainPID=4340`（接管成功）。`usbgadget adb` 恢复后不匹配重现（4410 vs 4427，adb 模式固有）。
- 证据：`E-evidence.txt`
- 未验证/限制：`usbgadget disabled` 在本机挂起（超时 300s），未走完整脚本自动路径；以手工 kill+restart 证明接管动作。

### E3 USB-ADB 不误杀
- 状态：PASS
- 实测：`usbgadget=adb` 时 `sh adbd-repair` 退出 0，listener 1151 未被杀（按 `case adb) exit 0` 跳过）。
- 证据：`E-evidence.txt`

### E4 插拔自愈
- 状态：PASS（模拟触发）
- 实测：`systemctl start adbd-repair.service` 退出 0（oneshot 完成）；adb 模式下跳过，listener 4410 不变、adbd 仍 active（健康时不丢会话）。
- 证据：`E-evidence.txt`
- 未验证/限制：用 systemctl 模拟 udev，未做真实物理 USB 插拔。

### E5 副作用检查
- 状态：PASS
- 实测：adbd/pocketjs-kms/pocketshell-dev/pocketjs-sleep 均 active；SSH 正常；`systemctl --failed` 仅 pre-existing 两项。
- 证据：`E-evidence.txt`

### F1 SYSTEM MD5 一致性
- 状态：PASS
- 实测：/flash/SYSTEM md5 `71b156e43467587e7b418097e3e2fb0d`，与 sidecar /flash/SYSTEM.md5 记录一致。
- 证据：`F-evidence.txt`

### F2 备份可回滚
- 状态：PASS
- 实测：/storage/update-backup-20261028/ 含 KERNEL/SYSTEM 及 before-deploy 版本，MD5 已记录；给出回滚命令。
- 证据：`F-evidence.txt`

### F3 启动分区完整性
- 状态：PASS
- 实测：/flash 以 `ro` 只读挂载；extlinux `FDT /dtb.img`；KERNEL/dtb.img md5 记录、未被改动。
- 证据：`F-evidence.txt`
- 未验证/限制：未直接 dump U-Boot 区域比对；以 /flash 只读 + KERNEL/dtb 不变为证据。FSCK0000.REC(148MB) 等历史文件占空间，建议清理。

### F4 重启回归
- 状态：PASS
- 实测：K7 已重启设备；开机后 pocketjs-kms/adbd/pocketshell-dev(手动 start)/pocketjs-sleep 正常，首屏见 `K07-after-reboot.png`。
- 证据：`K07-after-reboot.png`
- 未验证/限制：`pocketshell-dev` 重启后不自启（disabled，见 DEC-002），需手动 start。
### H1 pocketshell-mirror 功能验证
- 状态：PASS
- 操作步骤：本地 `POCKET_MIRROR_BIND=127.0.0.1 python3 tools/pocketshell-mirror/server.py`；`GET /status`、`GET /frame.jpg`、`POST /key/START`。
- 预期 / 实测：`/status={"sequence":13,"error":""}`；`/frame.jpg` 为合法 720×480 JPEG（34KB）；`POST /key/START`→`ok`；sequence 升至 16。
- 截图：H01-mirror-frame.jpg（mirror 输出的设备真实画面 JPEG；浏览器类=真实抓帧）
- 问题与根因：mirror 未指定 `-s`，HX90 多 adb 设备时报 "more than one device"；需先断开 TCP 仅留 USB。
- 未验证/限制：未在浏览器中打开 index.html 做交互截图（仅验证 HTTP 接口）。

### H2 与 pocketshell-dev 重复判定
- 状态：PASS（判定）
- 结论：与 pocketshell-dev 的 `/device/frame.rgb`+`/device/key` 功能重叠；mirror 额外依赖 adb 中继、单设备假设。建议以 pocketshell-dev 为主，mirror 作备用诊断，去留见 DEC-004（未擅自删除）。
- 证据：H-evidence.txt
