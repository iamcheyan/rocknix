# PocketShell UI 重构合并验收（CPR95–98）

合并分支：`integration/cpr95-98-ui-redesign`
基线：`f7459a51bc`（main）
设备：RG34XX（H700 DDR4），720×480

## 合并内容

| Issue | 内容 | 落点 |
|---|---|---|
| #95 | Workspace-first 启动器、日/中/英 三语、语言持久化 | `hello/launcher-home.tsx`、`hello/launcher-localization.ts`、`main.tsx` |
| #96 | 现有 `system-info` 的紧凑摘要（不新增页面/路由） | `apps/heya/scripts/heya-tool` |
| #97 | 分类式设置页（DISPLAY/AUDIO/NETWORK/SERVICES/SYSTEM） | `hello/settings-workspace.tsx`、`main.tsx` |
| #98 | 像素 WorkspaceBar（左图标栏） | `hello/workspace-bar.tsx`、`main.tsx` |

冲突处理原则：新版视觉/布局覆盖旧卡片式启动器（已删除 `card-carousel.tsx`、`pages/*`、`status-bar.tsx`）；既有命令、bridge 语义、输入键位与持久化行为保留。

## 关键修复（合并过程中）

- `pocketshell-launcher.rs` 保留 main 的 `run()` 硬超时包装（`pactl` 会永久阻塞渲染线程），新增命令全部走它。
- 设置页超时表纠正重复的 `30s`（应为 `30m`）。
- 补回 `settingsValues` signal；设置入口判断改用索引而非分类行集合。
- L/R（`BTN.LTRIGGER`/`RTRIGGER`）绑定分类切换，←/→ 调值，避免与 workspace 切换冲突。
- SYSTEM 分类新增「表示言語」，A 循环 ja→zh→en 并写入 `/storage/pocketshell/launcher/settings.json`。

## 字体

原字体链只有 `FusionPixel-12px-monospaced-zh_hans.ttf`（121 KB 简体子集）+ Nerd Font 兜底，缺日文汉字（選/択/設/言/語/開/戻/移/動…），日文界面会出现方块。

已加入官方 `fusion-pixel-12px-monospaced-ja.ttf`（OFL，7.0 MB）作为第二 fallback，`fonts.json` 顺序为：zh_hans 子集 → ja → Nerd Font。加入后日文汉字正常，中文仍由第一顺位渲染。

## 实机证据

全部截图取自设备 DRM 平面 `/device/frame.rgb`（720×480×3 字节），按键通过 `/device/key` 注入。

| 文件 | 内容 | 验证点 |
|---|---|---|
| `INT-01-overview.png` | APPS 概览 | 顶部像素图标栏（无 IP/数字/电量百分比）、标题/描述/`システム / 選択中`、底部五图标 |
| `INT-02-apps-list.png` | 应用列表 | 20 行，选中行高亮 |
| `INT-03-settings-display.png` | 设置 DISPLAY | `SYSTEM SETTINGS`、分类 `表示`、明るさ 值条 |
| `INT-04-brightness-staged.png` | 亮度预调 | ←/→ 暂存 +5%（值后带 `*`） |
| `INT-05-brightness-applied.png` | 亮度应用 | A 提交，`Setting updated` |
| `INT-06-settings-audio.png` | AUDIO | `音声`、音量 60%、提示行不裁切 |
| `INT-07-settings-network.png` | NETWORK | Wi-Fi / Bluetooth 状态 |
| `INT-08-settings-services.png` | SERVICES | 服务清单窗口滚动 |
| `INT-09-settings-system.png` | SYSTEM | ツール/アプリ、网络 USB、画面オフ 30m、表示言語 日本語 |
| `INT-10-settings-language.png` | 语言行选中 | 焦点可辨 |
| `INT-19-settings-zh.png` | 切到中文 | 中文文案无方块 |
| `INT-20-overview-zh.png` | 中文首页 | `应用 / 应用程序与系统工具 / 系统 / 已选择` |
| `INT-21-persisted-ja.png` | 重启后 | 语言从持久化文件恢复 |
| `INT-11-tools-apps.png` | Tools 应用清单 | Terminal + 19 个既有应用，入口未丢失 |
| `INT-14…INT-18` | 五个 workspace | L/R 循环，含回到 APPS 的 wrap |

## 已知限制

- 本轮为 **手动 deploy 验证**：新 `boot.pocket` 与 `pocket-linux-kms` 放在 `/storage` 覆盖层（drop-in `90-integration-test.conf`），尚未进镜像；镜像构建完成并刷入后才算 image 验证。
- `systemctl restart pocketjs-kms` 会因 KMS 进程忽略 SIGTERM 而超时（既有行为），需 `kill -s SIGKILL` + `start`。
- TopBar 右侧真实系统状态图标未启用：runtime 没有 Wi-Fi/蓝牙/电量查询 contract，按设计留空而不是伪造。
- `heya-tool system-info` 的紧凑摘要已在 HX90/设备上以脚本副本执行验证，但未随本分支镜像安装到设备，未截取该页截图。
- issue #95–#98 保持 OPEN，等待 review。
