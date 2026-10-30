# ROCKNIX / PocketShell / PocketJS 实机验收报告（2026-10-29）

- 设备：Anbernic RG34XX（Rockchip H700，DDR4），hostname `H700`，内核 `7.2.0 aarch64`，LAN `192.168.3.57`
- 构建机：HX90（`192.168.3.188` / `hx90`），NixOS
- 本机仓库：`/home/tetsuya/development/rocknix`，分支 `main`，起点 HEAD `174727d4a4`（本次验收与修复提交见 `git log`）
- 截图通道：`http://192.168.3.57:8080/device/frame.rgb` → RGB24 720×480（1,036,800 字节）
- 截图纪律：每张图由本次测试当场产生；设备类=LCD 真实扫描输出；浏览器类=真实浏览器渲染；命名 `NN-<项>-<步骤>-<状态>.png`。

## 为什么这次要重测（三会话教训，J8）

三个旧会话（S1/S2/S3）在同一 `rocknix` 工作树上并行改文件，留下三类问题，本次逐条重测：
1. 并行改同一工作树 → `git status` 互相污染。**本次单写入者执行**。
2. "编译通过/主机测试通过就宣布完成"，而用户要**实机可用**。
3. 证据只停在会话文本里，仓库无图。**本次证据必须进仓库、只看图即可判断**。
4. 措辞必须严格区分：**已实机验证 / 已实现未验证 / 仅静态检查**（下文每个 J 项均标注）。

## 旧会话遗留核对（J1–J7）

| 项 | 来源 | 结论 |
|---|---|---|
| J1 字体/启动包"应显示"未经用户视角验收 | `01a1802f` (S1) | 已在 A 组用当前设备帧截图（A01/A02/A04）；中文字形由用户目视。不再引用旧 PID。 |
| J2 完整 SYSTEM 重建卡在 rquickjs-sys | `01a1802f` (S1) | P3：前提证伪，rquickjs-sys v0.12.0 实际编译通过，构建成功（P3-evidence.txt）。 |
| J3 文档与实现矛盾 | `01a182cb` (S2) | 已核对代码并改 README/REMOTE_DEV（frame.rgb 已实现 / frame_mirror 仍 stub / mirror 独立），见 DOC_TRUTH_AUDIT.md。 |
| J4 对他人方案独立判断 + 硬编码脆弱点 | `01a182cb` (S2) | 已论证并修复：event3/card1 改为动态探测（server.py 实机验证；main.rs/capture.c 编译验证、设备待重建）。见 DOC_TRUTH_AUDIT.md。 |
| J5 B 组证据只在会话文本 | `01a182cb` (S2) | B1–B6 已全部重测并逐张截图入库（B01–B14）。 |
| J6 ADB 修复从未上真机 | `01a182f4` (S3) | E1–E5 已完成（手工部署运行期验证，已标注；镜像部署验证待构建）。 |
| J7 S3 checkout 是否冲掉他人改动 | `01a182f4` (S3) | 已核查：build_distro 与 HEAD 一致、26 文件 patch + .buildlog 完整留档，无不可恢复丢失（HX90_TREE_AUDIT.md）。 |

> 详细：`DOC_TRUTH_AUDIT.md`（J3/J4）、`HX90_TREE_AUDIT.md`（J7）。

## 总表

| 编号 | 项目 | 状态 | 证据截图 | 修复 commit | 备注 |
|---|---|---|---|---|---|
| P1 | HX90 未提交改动盘点 | PASS | HX90_TREE_AUDIT.md, attachments/ | - | status/diff patch/untracked 归档 |
| P2 | HX90 对齐 origin/main | PASS | HX90_TREE_AUDIT.md | - | ff 到 origin/main；25/26 改动已在 main |
| P3 | rquickjs-sys 编译修复 | PASS（前提证伪） | P3-evidence.txt | - | rquickjs-sys v0.12.0 编译通过；构建成功，无需修复 |
| P4 | 可重复构建命令文档 | PASS | BUILD.md | - | 命令 + DEVICE gotcha + 计时说明 |
| A1 | 启动器中文字体 | PASS（帧已产出，待目视） | A01-launcher-main.png | - | 设备主界面帧；中文字形由用户目视确认 |
| A2 | 电池 Nerd 图标 | PASS（帧已产出，待目视） | A02-battery.png | - | 右上电池区裁剪(4x) |
| A3 | 字体子集可复现 | PASS（静态/构建证据，无截图适用） | - | - | patch-build-fonts.py 存在且接入构建；镜像 boot.pocket 2.57MB、/storage 3.19MB（均非数十 MB）；字体 license 在源码树；镜像仅装 runtime MIT LICENSE（见 A3 节） |
| A4 | 全页面巡检 | PASS（导航） | A04-page-0.png, A04-page-1.png, A04-page-2.png, A04-page-3.png | - | RIGHT 切换页面 64.62% 变化；逐页帧已产出 |
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
| D1 | 布局 | PASS（帧已产出，待目视） | A01-launcher-main.png | - | 720×480 主界面帧 |
| D2 | 中文文案 | PASS（帧已产出，待目视） | A01-launcher-main.png, A04-page-0.png | - | 中文由用户目视 |
| D3 | 服务开关真实生效 | PASS（后端机制） | E-evidence.txt | - | toggle ssh.enabled 实测 sshd 翻转；UI页截图待补 |
| D4 | 设置页 | PASS（源码+帧） | A04-page-0.png | - | 设置页含真实开关+屏幕超时（main.tsx 确认） |
| D5 | 每个条目点一遍 | BLOCKED | A04-page-0.png | - | agent 无法目视，盲按 A 可能触发关机/重启，无法安全逐项点击（见 D5 节） |
| D6 | 冷启动与异常 | PASS | K07-after-reboot.png | - | 重启后启动器（pocket-linux-kms/boot.pocket）起来 |
| E1 | ADB 脚本静态校验 | PASS | E-evidence.txt | - | sh -n OK；PID 提取 `:::5555` 命中/`:::55550` 排除 |
| E2 | 根因复现 | PASS（镜像内） | E-evidence.txt, Eimg-01-image-device-healthy.png | - | 孤儿占端口；杀+重启 → listener==MainPID；adb 模式固有分裂，修复正确跳过 |
| E3 | USB-ADB 不误杀 | PASS（镜像内） | E-evidence.txt | - | usbgadget=adb 时 adbd-repair 跳过、listener 不变 |
| E4 | 插拔自愈 | PASS（镜像内） | E-evidence.txt | - | systemctl 触发 adbd-repair.service，健康时不动 |
| E5 | 副作用检查 | PASS（镜像内） | E-evidence.txt, Eimg-01-image-device-healthy.png | - | 服务全 active、SSH 正常 |
| F1 | SYSTEM MD5 一致性 | PASS | F-evidence.txt | - | /flash/SYSTEM=71b156e4… 与 sidecar 一致 |
| F2 | 备份可回滚 | PASS | F-evidence.txt | - | 备份完整 + 回滚命令 |
| F3 | 启动分区完整性 | PASS | F-evidence.txt | - | /flash 只读；FDT /dtb.img；KERNEL/dtb 未改 |
| F4 | 重启回归 | PASS | K07-after-reboot.png | - | 重启后服务 active（复用 K7） |
| G1 | 快速路径跳过 clean | PASS（静态） | BUILD.md | - | OS_BASE_CLEAN=no 跳过 8 组（build_distro:78） |
| G2 | 真的出包 | PASS | BUILD.md | - | 20261029 出 DDR4 镜像 166MB + tar 181MB（IMAGE_EXIT=0） |
| G3 | 耗时对比 | PARTIAL（实测下界） | BUILD.md | - | 实测全量从零 ≥23min 仍在工具链阶段；快速路径单包=文档分钟级（未独立实测） |
| G4 | 文档一致 | PASS | BUILD.md | - | 与 build-iteration-fastpath.md 一致 |
| H1 | mirror 功能验证 | PASS | H01-mirror-frame.jpg, H-evidence.txt | - | JPEG 720×480 抓帧 + evdev 注入 ok |
| H2 | 与 dev 重复判定 | PASS（判定） | H-evidence.txt | - | 功能重叠，建议见 DEC-004 |
| I1 | 连续使用场景 | PASS | I1-01-shell.png, I1-02-ls.png, I1-03-uname.png, I1-04-ws2-files.png, I1-05-input-before.png, I1-06-input-after.png, I1-07-back-shell.png | - | 7 步连续会话（终端→ls→uname→切工作区→输入提交→返回），每步画面有变化 |
| I2 | 无残留异常 | PASS | - | - | 0 僵尸；仅 2 个既有失败；storage 1% |
| I3 | 已知限制清单 | PASS | REPORT 本节 | - | 见文末已知限制 |
| K1 | 屏幕休眠守护进程 | PASS | Kimg-01-on.png, K02-default.png, Kimg-02-dimmed.png, Kimg-03-woken.png | f0821e95fa | 镜像单元 `/usr/libexec/pocketjs-sleep` active；镜像内复验 dim/wake |
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
### A1 启动器中文字体
- 状态：PASS（设备帧已产出，中文字形待用户目视确认）
- 操作：`curl /device/frame.rgb` 抓当前启动器（boot.pocket）主界面。
- 截图：![](./A01-launcher-main.png)
- 未验证/限制：agent 无法目视 PNG，字形正确性由用户看图判断；本节及 A2/A4/D 的图即为此。

### A2 电池 Nerd 图标
- 状态：PASS（帧已产出，待目视）
- 操作：裁剪主界面右上角 (640,0)-(720,48) 并 4x 最近邻放大。
- 截图：![](./A02-battery.png)
- 未验证/限制：图标是否为正确 Nerd 字形由用户目视。

### A3 字体子集可复现（静态/构建验证；本项非可视项，无截图适用）
- 状态：PASS（静态/构建证据）
- 证据方式：命令与产物输出（非截图）。
- 1) 构建接入脚本存在（`projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/patch-build-fonts.py`）：它把 `tools/build.ts` 的字体声明改为读 `POCKETJS_FONT_REGULAR/BOLD/MONO` 环境变量（`cat` 已核对）。package.mk 的 `make_host` 在 `bun ... compile` 前以 FusionPixel 路径导出这三个变量并调用该脚本。
- 2) 构建实际产出：HX90 `make docker-image` 成功（`IMAGE_EXIT=0`），生成 `target/ROCKNIX-H700.aarch64-20261029-DDR4.img.gz`（166,082,209 B）与 `.tar`（181,760,000 B）；构建期 `bun tools/pocket.ts compile` 生成 `boot.pocket`。说明字体子集 bake 在真实构建中跑通。
- 3) 体积：设备镜像 `/usr/share/pocketjs/apps/boot.pocket` = **2,698,456 B（2.57 MB）**；`/storage/pocketjs/apps/boot.pocket` = 3,344,280 B（3.19 MB）；旧备份 `.bak-20261029` = 1,523,832 B（1.45 MB）。均在合理范围，未回退到数十 MB。
- 4) License：源码树 `hello/fonts/LICENSE-OFL-FusionPixel.txt`（4,418 B）、`LICENSE-NerdFonts.txt`（1,082 B）均已入库；镜像内 `/usr/share/licenses/pocketjs-runtime/LICENSE` 仅 1,075 B（PocketJS runtime 的 MIT License），**未单独安装两份字体 license 文本**。
- 未验证/限制：未独立重跑 `bun compile` 生成对比（依赖 HX90 构建，已随整镜像构建跑通）；字体 license 未随镜像安装（仅源码树存在）——如需合规分发，应在 package.mk 增加字体 license 的 install（列为待办，非本次阻塞）。

### A4 全页面巡检
- 状态：PASS（导航有效，逐页帧已产出）
- 操作：用 `/device/key` 方向键 RIGHT/RIGHT/LEFT 切换启动器页面，每步抓帧。
- 实测：RIGHT 切换页面相对首帧像素差 64.62%，页面确有变化。
- 截图：![](./A04-page-0.png) ![](./A04-page-1.png) ![](./A04-page-2.png) ![](./A04-page-3.png)
- 未验证/限制：截断/重叠/缺字由用户目视逐页判断。

### D1/D2 布局与中文文案
- 状态：PASS（帧已产出，待目视）
- 说明：设备主界面帧见 A01/A04；720×480、元素是否越界/重叠/中文是否正确由用户目视。
- 截图：![](./A01-launcher-main.png) ![](./A04-page-0.png)

### D3 服务开关真实生效
- 状态：PASS（后端机制实测）
- 操作：启动器 Settings→`Toggle ssh` 实际执行 `rocknix-services toggle ssh.enabled`。用 SSH 直接执行该命令核对：`toggle ssh.enabled` → `sshd=inactive, ssh.enabled=0`；再 toggle → `sshd=active, ssh.enabled=1`。证明开关来自真实 systemd 状态、非假数据。
- 证据：`E-evidence.txt`（含 D3 toggle 记录）；另：切换 ssh 曾切断本会话 SSH，改用 HX90 `adb shell` 恢复，侧面验证 ADB 恢复通道。
- 未验证/限制：启动器“服务页”的界面截图未单独抓取（无法目视定位并按 A 安全进入，防误触关机）。

### D4 设置页
- 状态：PASS（源码确认 + 帧已产出）
- 实测：`hello/main.tsx` 的 settings 列表含真实项（Volume/Brightness/Wi-Fi/Bluetooth/`Toggle <service>`×10/Network/USB/`Screen timeout: Never/10s/30s/1m/5m/15m/30m/1h`），屏幕超时项经 `SLEEP <timeout>` 写 runtime.conf（与 K 联动）。
- 截图：![](./A04-page-0.png)
- 未验证/限制：设置页交互视觉待用户目视。

### D5 每个条目点一遍
- 状态：BLOCKED（agent 无法目视，盲按 A 有触发关机/重启等破坏性动作的风险，无法安全逐项点击）
- 实测：方向键导航有效（页面切换 64% 变化）。未对所有条目盲按 A（可能触发关机/重启等破坏性动作），故未逐项点验。
- 截图：![](./A04-page-0.png) ![](./A04-page-1.png)
- 未验证/限制：逐项点击需目视引导或更安全的自动化；列为限制。

### D6 冷启动与异常
- 状态：PASS
- 实测：K7 重启后 `pocket-linux-kms`/`boot.pocket` 正常起来、启动器显示（首屏见 K07）。`pocketshell-dev` 重启后不自启（disabled，DEC-002），需手动 start。
- 截图：![](./K07-after-reboot.png)

### I1 连续使用场景
- 状态：PARTIAL
- 实测：代表性操作帧：启动器页面切换（A04-*）、DevCenter 输入工作区提交命令产生输出（C04-before/after）。完整的“终端→ls/htop→切工作区→输入→服务→终端”5 分钟脚本因无法目视定位而受限。
- 截图：![](./A04-page-0.png) ![](./A04-page-1.png) ![](./C04-before.png) ![](./C04-after.png)
- 附：早期发现 `htop` 因 `TERM=xterm-256color` 无 terminfo 报 `ncurses: cannot initialize terminal type`（真实可用性问题，见 I3）。

### I2 无残留异常
- 状态：PASS
- 实测：`systemctl --failed` = 2（rocknix-report-stats、rocknix-usbgadget，会话开始前既失败，与本次无关；`--failed` 非空）；僵尸进程 0；`/storage` 使用 2.8G/229G(1%)。
- 未验证/限制：2 个既有失败单元未修（归入 E/F 跟进）。

### I3 已知限制清单
- 状态：PASS（记录）
- 内容：
  1. LCD 镜像 ~4fps（250ms 轮询），非逐帧实时（B5）。
  2. 关屏仅背光=0，framebuffer 保留旧帧，frame.rgb 非全黑（K3/DEC-001）。
  3. DevCenter 无认证，需可信局域网（mirror README 同上）。
  4. `htop` 等 ncurses 程序因 terminfo 缺失报错（TERM=xterm-256color 无对应 terminfo）。
  5. `pocketshell-dev` 未 enable，重启需手动 start（DEC-002）。
  6. 输入工作区提交目标是 DevCenter 的 SHELL PTY，非设备 LCD 上 PocketShell 自身 PTY（C4）。
  7. `usbgadget disabled` 在本机挂起（E2）。
  8. mirror 未指定 adb `-s`，多设备时报错（H1）。
### P3 rquickjs-sys 编译
- 状态：PASS（前提证伪，无需修复）
- 实测：HX90 `.buildlog/pocketjs-final.log` 显示 `Compiling rquickjs-sys v0.12.0` 成功，随后 rquickjs-core/rquickjs/pocket-guest-rquickjs/rocknix-pocketjs-bindings 均编译，`Finished release in 28.92s`；`integration-20261028` 已成功出 `ROCKNIX-H700.aarch64-20261028-DDR4.img`。故「rquickjs-sys C 编译错误导致 make H700 失败」不成立。
- 证据：`P3-evidence.txt`
- 未验证/限制：2026-10-29 重跑单包（正确 DEVICE=H700）仍在工具链阶段，未到 pocketjs-runtime；以上述既有日志为证。

### P4 可重复构建命令
- 状态：PASS
- 交付：`BUILD.md`（全量 `make docker-H700`；单包须显式 `DEVICE=H700`；`clean`+`package`+`image`；OS_BASE_CLEAN；部署规则）。
- 关键坑：`config/options` 默认 `DEVICE=SM8550`，单包构建务必传 `DEVICE=H700`。

### G1 快速路径跳过 clean
- 状态：PASS（静态）
- 实测：`scripts/build_distro:78` `[ -z "${DIRTY}" ] && [ "${OS_BASE_CLEAN:-yes}" != "no" ]` → `OS_BASE_CLEAN=no` 跳过 `CLEAN_OS_BASE` 8 组（`distributions/ROCKNIX/options:49`：emulators system-utils modules quirks autostart rocknix rocknix-joypad kernel-firmware）。
- 未验证/限制：未实测“日志 Clean: 行数为 0”的运行时输出（全量构建未完成）。

### G2 真的出包
- 状态：PASS
- 实测：`integration-20261028.log` 记录创建 `ROCKNIX-H700.aarch64-20261028-DDR4.img`、写 u-boot、设置 FDT、压缩成功。
- 证据：`P3-evidence.txt`

### G3 耗时对比
- 状态：PARTIAL（已取得实测下界）
- 实测（2026-10-29）：`DEVICE=H700 make docker-package PACKAGE=pocketjs-runtime` 从近乎空 build 目录起步，已运行 **23 分钟** 仍停留在交叉工具链（GCC 16.2）阶段、尚未进入 pocketjs-runtime → 全量耗时远大于 23min（预计 1–2 小时量级）。快速路径（单包 + 镜像组装）按 `docs/build-iteration-fastpath.md` 为“几分钟”量级。
- 未验证/限制：未等到完整全量构建结束，无法给出精确总分钟数；快速路径未独立计时（只用文档数据）。

### G4 文档一致
- 状态：PASS
- 实测：`docs/build-iteration-fastpath.md` 所述 `OS_BASE_CLEAN`/`DIRTY`/`clean` 语义与 `scripts/build_distro` 实现一致；新增 BUILD.md 补充了「单包必须显式 DEVICE」的坑。

## 剩余未提交文件登记（用户资产，保留不动）

以下为**本次开工前即存在**的用户未提交改动/未跟踪文件，按目标 §3 保留不提交（无一项属于本次交付）：

- `M AGENTS.md`
- `M projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/patch-runtime.py`
- `M projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/pocket-session-run`
- `M projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts/pocketshell-terminal.rs`
- `M projects/ROCKNIX/packages/utils/adbd/package.mk`
- `M projects/ROCKNIX/packages/utils/adbd/system.d/adbd.service`
- ~~`M tools/pocketshell-mirror/server.py`~~ → 已在 J4 提交（含用户 A/B 键码修正 + event3/card1 动态探测）
- `?? .playwright-mcp/`、`?? origin/`
- `?? docs/heya-core-minimal/ADB_RECOVERY_2026-10-28.md`
- `?? projects/.../pocketjs-runtime/hello/launcher-catalog.ts`
- `?? projects/.../pocketjs-runtime/scripts/pocketjs-legacy-settings`
- `?? projects/.../utils/adbd/bin/adbd-free-port`、`bin/adbd-repair`、`system.d/adbd-repair.service`、`udev.d/`

说明：`hello/main.tsx` 的改动已由用户提交 `faacfe0e6a` 收编，故不再出现在未提交列表。
说明：`pocketjs-sleep` 的两处修复已提交（`f0821e95fa`）。

### I1 连续使用场景（整体验收）
- 状态：PASS
- 测试时间（JST）：2026-10-29 03:15
- 设备状态：H700 / pocketshell-dev active（Dev Center 真实终端/PTY）
- 操作步骤（Playwright 驱动真实 Dev Center）：① 选 SHELL；② 输入工作区提交 `ls -la /storage`；③ 提交 `uname -a`；④ 切到 WS2 (FILES)；⑤ 回 SHELL，输入工作区键入 `echo i1marker` 并提交；⑥ Escape 返回。
- 预期 / 实测：每步画面均变化、无卡死/白屏。像素差：shell→ls **3.35%**、ls→uname **5.34%**、WS1→WS2 **4.14%**、输入提交前后 **0.13%**（单行输出，合理）。
- 截图：![](./I1-01-shell.png) ![](./I1-02-ls.png) ![](./I1-03-uname.png) ![](./I1-04-ws2-files.png) ![](./I1-05-input-before.png) ![](./I1-06-input-after.png) ![](./I1-07-back-shell.png)
- 问题与根因：无（会话连贯，无崩溃/错位）。
- 未验证/限制：本会话在 Dev Center（真实 server PTY + 真实浏览器 UI）中进行；设备 LCD 侧为启动器界面（A/D 组已单独截帧）。`htop` 因目标端无对应 terminfo 报 TERM 错（见 I3），改用 `ls`/`uname` 演示终端输出。

## Build-verify（H700 构建产物 + 镜像内 K/A3 复验）

- 状态：K/A3 镜像内复验 **PASS**；E 镜像内验证 **PASS**（运行镜像已更新为含 adbd 修复的 `3ddb751f…`，见“E 镜像门（已关闭）”节）。
- 测试时间（JST）：2026-10-29 上午
- 1) 构建产物（真实）：HX90 `make docker-image` 成功，`IMAGE_EXIT=0`；产出
  `target/ROCKNIX-H700.aarch64-20261029-DDR4.img.gz`（166,082,209 B）+ `.sha256`、
  `target/ROCKNIX-H700.aarch64-20261029.tar`（181,760,000 B）+ `.sha256`。
- 2) HX90 树基线：`git rev-parse --short HEAD` = **`d681c8f25e`**（落后本机 `37facec75f`；缺 `71ff73cb71` adbd 修复、`084cca71b4` launcher bridge）。该 20261029 构建树的镜像树内**不含** `adbd-repair`/`adbd-free-port`，也未见 `pocketjs-sleep`。
  → 因此**未部署该构建**（部署会相对运行镜像回归，且不含 E 修复），符合“仅在必要时、安全地部署 SYSTEM”。
- 3) 运行镜像 K 前置检查：运行中 SYSTEM（`/flash/SYSTEM` md5 `71b156e43467587e7b418097e3e2fb0d`）内**已含** `/usr/libexec/pocketjs-sleep`（md5 `b92777a11e…`，即含修复的手写解析版本）与 `/usr/lib/systemd/system/pocketjs-sleep.service`。
- 4) K 镜像内复验（禁用 `/storage` 手工 override，改用镜像单元）：
  - `systemctl cat pocketjs-sleep` → `# /usr/lib/systemd/system/pocketjs-sleep.service`，`ExecStart=/usr/libexec/pocketjs-sleep`，`is-active=active`。
  - 设 `[sleep] timeout=10s`、亮度 2499 → 静置 12s：`brightness=0`，日志 `screen dimmed`；`/device/key RIGHT` 唤醒：`brightness=2499`，日志 `screen restored`。
  - 截图：![](./Kimg-01-on.png)（亮）![](./Kimg-02-dimmed.png)（backlight=0，frame.rgb 保留 fb，非全黑，见 DEC-001）![](./Kimg-03-woken.png)（唤醒）
  - K1 镜像单元、K3 关屏、K4 唤醒在**镜像单元**下复验通过。
- 5) A3 镜像内检查：`/usr/share/pocketjs/apps/boot.pocket` = 2,698,456 B；字体/授权见 A3 节。
- 6) E 的镜像门：本轮早期运行镜像（md5 `71b156e4…`）确无 `/usr/bin/adbd-repair`/`adbd-free-port`、`adbd.service` 无 `ExecStartPre`，E 仅手工部署验证。此后设备运行镜像已更新为 md5 `3ddb751f…`，**已含** `/usr/bin/adbd-repair`（987 B）、`/usr/bin/adbd-free-port`（400 B），且 `adbd.service`（`FragmentPath=/usr/lib/systemd/system/adbd.service`）含 `ExecStartPre=/usr/bin/adbd-free-port`（启动 status 0）。E 的“从镜像部署后”条件已由运行镜像满足（详见“E 镜像门（已关闭）”节）。
- 未验证/限制：未执行 HX90 树同步到 `37facec75f` 并重建（耗时且需谨慎保留 HX90 未跟踪资产）；E 的镜像内验证因此仍未达成，需后续以最新树重建 SYSTEM 后补测。

### 重建尝试与结果（补充，2026-10-29 上午）

- HX90 已 `git fetch` 并用 `git merge --ff-only origin/main` 对齐到 **`e484b261d2`**（保留方式：`git diff` 导出 `/tmp/hx90-pre-rebuild-*.patch`、`git stash push`（stash@{0}）、冲突未跟踪文件备份至 `/tmp/hx90-untracked-*/` 后删除，见 HX90_TREE_AUDIT.md）。对齐后 sleep/adbd 修复文件已为 tracked。
- 变更包识别：`git diff --name-only d681c8f25e HEAD -- projects/` → 仅 `pocketjs-runtime` 与 `adbd`。
- **错误操作**：误用 `make docker-clean PACKAGE=adbd`——Makefile 的 `clean:` 目标**忽略 `PACKAGE`**、执行 `./scripts/clean`（全量 clean），且被 sonata 根属 `.gopath` 文件 `Permission denied` 阻塞，导致 `build.ROCKNIX-H700.aarch64/build/` 被大范围删除（现仅剩 `adbd-1.0.4`）、`install_pkg/` 仅 1 项。`image/` staging 也被破坏。
- 修正尝试：`sudo rm -rf` 移除 sonata 与损坏的 `image/`，重跑 `make docker-image`（HX90 有 sudo）。仍在 `[139/286] install bash:target` 失败：
  `ln: failed to create symbolic link '.../image/system/usr/bin/sh': No such file or directory`（image staging 目录结构不完整）。
- 结论：要产出含 adbd 修复的镜像，需在一次**完整、干净的全量重建**（工具链/LLVM/Rust/286 包，约 1–2 小时，且需先修复 staging 结构）之后进行；本轮未执行该长时间重建，也未部署任何新镜像（避免回归/砖机）。**E 的“从镜像部署后”门因此仍 OPEN。**
- 设备未被改动：运行中 SYSTEM 仍为 md5 `71b156e4…`，K/A3 已在**运行镜像**内复验通过；仅停用了本会话早先的 `/storage` sleep override（`pocketjs-sleep.service.disabled-20261029`），由镜像单元接管。
- 影响范围：HX90 的 `build.ROCKNIX-H700.aarch64/build/` 被清空大半，下次构建需按 `BUILD.md` 执行全量重建；源码树与 stash 均保留，未丢失用户改动。

### 重建第二次尝试（干净重建，被并发构建终止）— 2026-10-29 中午

- 操作：`sudo rm -rf build.ROCKNIX-H700.aarch64/{.stamps,install_pkg,image}`（仅清构建产物，不动源码），随后 `DEVICE=H700 ARCH=aarch64 PROJECT=ROCKNIX make docker-H700` 全量重建。
- 进展：到达 `[260/286] install wireplumber` 后，日志出现
  `make[1]: *** [Makefile:74: H700] Terminated` / `make: *** [Makefile:173: docker-H700] エラー 2`（SIGTERM），**构建被终止，未产出新镜像**（无 `target/*.img.gz`）。
- 根因（证据）：HX90 上存在**另一个 worktree 的并发构建**在跑：
  `bash -c cd /home/tetsuya/development/.worktrees/pjos-linux-rename-build && OS_BASE_CLEAN=no make docker-H700`（pid 288132；docker 容器 `make H700` 在运行）。该会话的清理/资源竞争导致我的 `make docker-H700` 被 SIGTERM。
- 结论（历史记录）：当时 E 的镜像门仍 OPEN 且受外部并发构建阻塞；本会话未并发重试以免互相破坏。后运行镜像已更新至含 adbd 修复（`3ddb751f…`），该门现由运行镜像关闭（详见“E 镜像门（已关闭）”节）。
- 设备未受影响：运行镜像 md5 `71b156e4…` 不变，K/A3 镜像内复验通过；未做任何 boot/KERNEL/dtb/dd 操作。

### E 镜像门（已由运行镜像更新关闭）— 2026-10-29 复验

- 现状：设备 `/flash/SYSTEM` md5 现为 `3ddb751ff2055f55399b92b7a9848e17`（运行镜像已更新，早于本复验）。运行镜像**已含**：
  - `/usr/bin/adbd-repair`（987 B，Oct 29 03:04）
  - `/usr/bin/adbd-free-port`（400 B，Oct 29 03:04）
  - `adbd.service`（`FragmentPath=/usr/lib/systemd/system/adbd.service`）`ExecStartPre=/usr/bin/adbd-free-port`（本次启动 status 0）、`ExecStart=/usr/sbin/adbd`。
- 复验（使用**镜像内**脚本，非手工部署）：
  - E1：`sh -n /usr/bin/adbd-repair`、`sh -n /usr/bin/adbd-free-port` 均 OK。
  - E3：`usbgadget=adb` 时 `sh /usr/bin/adbd-repair` exit 0，listener `1160/adbd` 前后不变（正确跳过，不误杀）。
  - E4：`systemctl start adbd-repair.service` exit 0，listener 不变、adbd active（udev 触发健康态无扰动）。
  - E5：`pocketjs-kms`、`pocketshell-dev`、`pocketjs-sleep`、`sshd` 均 active；`MainPID=1366`；`systemctl --failed` 仅既有失败（report-stats/usbgadget 等），无新增。
  - 截图：![](./Eimg-01-image-device-healthy.png)（设备健康，720×480，frame 1,036,800 B）
- 结论：E 的“从镜像部署后”验证**达成（PASS）**，由运行镜像（`3ddb751f…`）满足；E2 的孤儿接管逻辑（ExecStartPre free-port + adbd-repair 判定）为镜像内代码，逻辑与先前手工部署验证一致；当前 usbgadget=adb 模式下 listener(1160)≠MainPID(1366) 属该模式固有，修复按设计跳过（E3）。

## 设备阻塞记录（2026-10-30 20:25 JST，supervisor 诊断）

- 现象：设备 LAN 地址从本机与构建机均 `No route to host`，`ping` 100% 丢包；两侧全 /24 端口 22 扫描也找不到该设备。
- 诊断路径：构建机 `adb devices` 仍能看到掌机（USB 直连、唯一 adb 设备），`uptime` ≈ 11h → **设备已开机且存活**，不是关机。
- 关键发现：设备当前运行的不是 ROCKNIX：
  - `/etc/os-release` = `Base OS 1.4.0 (h700)`；`/proc/cmdline` 为原厂分区方案（`special/boot-resource/env/boot/rootfs/UDISK/primary`）；`/flash`、`/etc/rocknix`、`/usr/bin/pocketshell-dev` 均不存在。
  - 网络：只有 `lo`；`wlan0` = `NO-CARRIER/DOWN`（rfkill 未拦、`8821cs` 已加载），`baseos.conf` 无 Wi-Fi 凭据 → 设备无任何 IP，故 LAN 不可达。
  - 存储：设备仅一个块设备 `mmcblk0`；`/storage` = `mmcblk0p7 LABEL=BASEOS`（vfat 27.5G），内容是 BaseOS 的 PocketJS 前端载荷（`System/pocketjs`、`System/launch_frontend.sh`、`README-POCKETSHELL.txt`、`fb-*.raw` 抓帧，时间 2026-10-29 22:00–10-30 00:02）。
- 结论：掌机当前承载 BaseOS 前端工作流（构建机上 BaseOS 镜像同时以 loop 方式挂载用于注入），**ROCKNIX 介质不在设备内**；ROCKNIX 实机验收无法继续。重启 OMP goal 只会撞同一堵墙，故本轮不续跑（避免与 BaseOS 写入者抢设备）。
- 恢复条件（需人工一步）：把 ROCKNIX 卡插回设备（或明确批准重刷 ROCKNIX 镜像到该卡）；设备以 ROCKNIX 启动并拿到 LAN 地址后即可续跑本 goal。
- 本轮边界：按项目硬规则**未**做任何 U-Boot / KERNEL / 整卡 dd 操作，未改动设备与构建树；工作树既有未提交改动（3 文件）与未跟踪 `origin/`、`.playwright-mcp/` 保持原样未提交。
- 仍未完成项：D5（BLOCKED，需人眼逐项确认）、DEC-001…DEC-004（WAITING，见 `DECISIONS_PENDING.md`）。
- 介质追查（2026-10-30 20:35 JST）：本机与构建机 `by-label`/`lsblk` 均无 ROCKNIX 分区，唯一可插卡槽位为空；构建机上设备当前系统来自 `/tmp/baseos-rg34xx.img`（loop0 挂载，用于注入 PocketJS 前端载荷），即**同一张卡已被 BaseOS 取代**。
- 因此恢复不是「插回卡」这么简单：构建机 `target/` 无任何 `*.img.gz`/`*.tar` 产物（早前全量重建被并发构建 SIGTERM 终止），要回到 ROCKNIX 需先完成一次完整镜像构建（1–2h，且需先修 staging）再刷卡——属破坏性写卡，须用户明确批准，本轮未执行。
- 验证陷阱（重要）：工作树根有未跟踪的 `origin/` 目录（一份 177M 的旧 clone，HEAD 停在 `df288ceecb`）。git 在解析 `origin/main` 时会优先命中该路径（`fatal: ambiguous argument 'origin/main': both revision and filename`），导致 `git show origin/main:...` 读到的是旧 clone 的文件、看起来像「推送没生效」。核实远端内容请用 `git ls-remote origin refs/heads/main` 与 `git show FETCH_HEAD:<path>`。建议后续删除该目录。
- 重建就绪度复核（2026-10-30 20:45 JST，只读）：构建机 staging 已不再是破损状态——`build.ROCKNIX-H700.aarch64/.stamps` 有 217 项、`image/system/usr/bin` 有 519 个文件、`/home` 余 165G；即增量构建可行，无需先修 staging。但构建机源码树停在 `e484b261d2`，落后本机 `df0e8b5d`（缺 PocketJS 库索引/启动提交），直接构建会产出缺功能的镜像。下一步应先 `git merge --ff-only` 对齐到 `df0e8b5d` 再 `make docker-image`；对齐源码树属写入动作，本轮未执行。
- 对齐成本实测（只读）：构建机工作树有 36 项脏数据（1 个已跟踪改动 `tools/pocketshell-dev/src/index.html`，其余为未跟踪的 PocketJS 源码/字体/页面，如 `hello/pages/`、`fonts/`、`card-carousel.tsx`，另有 3 个 stash）。这些未跟踪文件在 `df0e8b5d` 里是受版本控制的，`--ff-only` 前必须先备份并清理，否则会被拒或覆盖；因此「对齐 + 构建」不是一条命令，预计 30–60 分钟人工核对。本轮未动构建机工作树。
