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
| B3 | 网页→设备注入 | PENDING | - | - | |
| B4 | 设备→网页跟随 | PENDING | - | - | |
| B5 | 刷新率/撕帧限制 | PENDING | - | - | |
| B6 | 断线恢复 | PENDING | - | - | |
| C1 | 输入工作区开关 | PENDING | - | - | |
| C2 | 布局切换 | PENDING | - | - | |
| C3 | 功能页切换 | PENDING | - | - | |
| C4 | 编辑与提交到 PTY | PENDING | - | - | |
| C5 | /api/state 一致性 | PENDING | - | - | |
| C6 | 历史与预置 | PENDING | - | - | |
| D1 | 布局 | PENDING | - | - | |
| D2 | 中文文案 | PENDING | - | - | |
| D3 | 服务开关真实生效 | PENDING | - | - | |
| D4 | 设置页 | PENDING | - | - | |
| D5 | 每个条目点一遍 | PENDING | - | - | |
| D6 | 冷启动与异常 | PENDING | - | - | |
| E1 | ADB 脚本静态校验 | PENDING | - | - | |
| E2 | 根因复现 | PENDING | - | - | |
| E3 | USB-ADB 不误杀 | PENDING | - | - | |
| E4 | 插拔自愈 | PENDING | - | - | |
| E5 | 副作用检查 | PENDING | - | - | |
| F1 | SYSTEM MD5 一致性 | PENDING | - | - | |
| F2 | 备份可回滚 | PENDING | - | - | |
| F3 | 启动分区完整性 | PENDING | - | - | |
| F4 | 重启回归 | PENDING | - | - | |
| G1 | 快速路径跳过 clean | PENDING | - | - | |
| G2 | 真的出包 | PENDING | - | - | |
| G3 | 耗时对比 | PENDING | - | - | |
| G4 | 文档一致 | PENDING | - | - | |
| H1 | mirror 功能验证 | PENDING | - | - | |
| H2 | 与 dev 重复判定 | PENDING | - | - | |
| I1 | 连续使用场景 | PENDING | - | - | |
| I2 | 无残留异常 | PENDING | - | - | |
| I3 | 已知限制清单 | PENDING | - | - | |

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
