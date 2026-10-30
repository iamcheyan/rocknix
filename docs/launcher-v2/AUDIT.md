# PocketShell Launcher V2 — 现状审计（对照 issue #92 / #93）

审计对象：`feat/launcher-v2-spec` 分支从 `origin/main@42d144b0db` 拉出时的实现。
审计方法：逐条读 `projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/` 的源码，
以行号引用；能跑的命令实测（`bun tools/pocket.ts check/compile`、WASM 渲染器）。

结论：V2 落地前，五条硬性需求已实现，七条部分实现，八条未实现；图标语言基本整体未实现。

## #92 需求逐条对照

| # | 需求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 删掉数字分页，顶部中央显示 `<分類>` | **未实现** | `launcher-home.tsx:55` 渲染 `{props.selection + 1}/{props.rows.length}`；`settings-workspace.tsx:23` 渲染 `{props.selected + 1}/{props.rows.length} ITEMS`。顶部没有分类名，只有 `workspace-bar.tsx` 的 5 个 8×8 位图方块。 |
| 2 | 顶部状态栏 12 逻辑像素，`[网络/IP] [分类] [系统状态]`，电池不显示百分比 | **未实现** | 仓库里没有状态栏组件：`status-bar.tsx` 在 `f89f8755c1`（整合 CPR95–98）时被删除，`main.tsx:526-528` 现在只画 `WorkspaceBar`。桥接层有 `LEVEL battery`/`LEVEL ip`/`LEVEL wifi`（`scripts/pocketshell-launcher.rs:191-241`），但 UI 不消费。 |
| 3 | 界面语言全部日语 | **部分** | `launcher-localization.ts` 提供 ja/zh/en 三语表，默认 `ja`；但 `main.tsx:68-79` 的 `settingGroups` label 是英文常量（`Brightness`/`Volume`/`Screen timeout`/`Tools / Applications`），`settings-workspace.tsx:20` 标题写死 `SYSTEM SETTINGS`，`main.tsx:572-583` 输入面板写死 `Keyboard`/`History`/`Commands`。 |
| 4 | 内容优先，首屏是内容不是 Linux 菜单 | **未实现** | `main.tsx:529-530` 首屏是 `LauncherHome` 的"工作区概览"：一个 4xl 图标 + `SYSTEM`/`FILES`/`EDITOR`/`MONITOR`/`DIAGNOSTICS` 五个工作区名字 + 一行描述。应用列表要按 ↓/A 才进入。 |
| 5 | 手柄优先：D-Pad/ABXY/L1/R1/START/SELECT 完成全部操作 | **部分** | 方向键、A（CIRCLE）、B（CROSS）、L1/R1、START、SELECT 都有分支（`main.tsx:433-489`），但 SELECT 只用于打开输入工作区，X/Y 没有绑定任何功能（`BTN.SQUARE`/`BTN.TRIANGLE` 在整个 launcher 视图里未使用）。 |
| 6 | 主页面删除描述/副标题，只显示图标+名称 | **未实现** | `launcher-home.tsx:50` 渲染 `description[localeIndex()]`；`launcher-catalog.ts` 每条应用带 `description` 字段（17/27/37 行等）；`launcher-home.tsx:51` 还渲染 `type / 選択中`。 |
| 7 | 内容流 `[A][B][C][D]…` 横向流 | **未实现** | 所有页面都是竖向列表：`launcher-home.tsx:56-61` 用 `Index` 逐行渲染 20px 高行；`settings-workspace.tsx:24-34` 同样竖向；`library-workspace.tsx:58+` 竖向。横向只有底部 5 个方形导航块。 |
| 8 | 选中态禁用 `scale(1.15)`，用边框+亮度+阴影 | **未实现** | `launcher-home.tsx:34`：`animate(selectedIcon, "scale", 1.16, ...)` 正是被禁止的缩放。选中行用 `bg-slate-800` 底色（56 行），没有边框高亮/像素阴影。 |
| 9 | 底部导航常驻，当前项高亮 | **部分** | 有常驻底部条（`launcher-home.tsx:65-67`），但内容是 5 个**工作区**图标（图标无文字），且只在 `overview` 视图存在；进入列表后底部条被提示文字替换（68-70 行）。 |
| 10 | `X` 实时搜索、`Y` 最近使用 | **未实现** | `main.tsx` 的 launcher 分支里 `BTN.SQUARE`/`BTN.TRIANGLE` 无任何处理。搜索只在 Library 应用内有（`library.tsx:170-181`），且与启动器无关。 |

### #92 附加条款

| 条款 | 状态 | 证据 |
|---|---|---|
| 逻辑坐标 360×240 + 整数 2x，禁止 1.25/1.5/1.75 | **已实现** | `pocket.json` 声明 `logical: [360,240]`、`presentation: "integer-fit"`；profile `profiles/rocknix-h700/profile.ts` 是 `rasterDensity: 2`。实测 254 个节点矩形全部整数、全部在 360×240 内（见 ACCEPTANCE.md）。 |
| 配色 `#141414`/`#8BFF5A`/`#3FFF96`/`#FFA63C`/`#FF5A5A`/`#EAEAEA` | **部分** | `main.tsx:520` 用 `bg-slate-950`；强调色是 `text-emerald-300`/`text-[#00FF99]`/`text-[#3ECFFF]`，与规范色板不一致。 |
| 动画 80/120/180/150ms easeOutQuad | **部分** | 只有 `launcher-home.tsx:34-38` 的 130ms/80ms 焦点动画；无内容滑动、分类切换、搜索面板动画。 |
| 字体栈 Iosevka Nerd Font / Terminus / Tamzen / GNU Unifont | **未实现** | `fonts.json` 用 Fusion Pixel 12px + Symbols Nerd Font；Iosevka/Terminus/Tamzen/Unifont 都没进场。 |

## #93 需求逐条对照

| # | 需求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 以 pixelarticons 为唯一图标包并 vendor 进仓库 | **未实现** | 仓库内没有 pixelarticons 资产、没有导入管线、没有 icon registry。 |
| 2 | 建构建/导入管线 + icon registry | **未实现** | 同上。图标全部是 Nerd Font 码点的字符串字面量。 |
| 3 | UI 禁止使用 Nerd Font 图标 | **未实现** | `launcher-catalog.ts` 每个应用一个 Nerd Font 码点（`\uf120` 终端、`\uf07b` 文件夹…）；`launcher-home.tsx:6-12` 五个工作区图标同样是 Nerd Font；`fonts.json` 直接以 `SymbolsNerdFontMono-Regular.ttf` 作 fallback。 |
| 4 | 状态栏图标（WiFi/BT/ADB/电池/音量/网络/搜索/设置）用像素图标 | **未实现** | 无状态栏（见 #92-2）。 |
| 5 | 电池只显示图标+颜色，`#EAEAEA`/`#FFA63C`/`#FF5A5A` | **未实现** | 无任何电量显示。 |
| 6 | WiFi/BT 状态色：主题色/灰/红 | **未实现** | 同上。 |
| 7 | 每个分类固定图标（grid/gamepad/media/star/settings） | **部分** | `workspace-bar.tsx:14-18` 有 5 个 8×8 位图，但对应的是 5 个**工作区**（apps/files/vim/top/log），不是 5 个内容分类。 |
| 8 | 应用图标优先级：自带 artwork → pixelarticons fallback | **未实现** | 只有 Nerd Font 字形，没有 artwork 通路，没有 fallback 表。 |
| 9 | 统一渲染管线 SVG→归一化→padding→缓存→渲染 | **未实现** | 字形由字体烘焙器隐式完成，无图标级别的归一化/padding/缓存。 |
| 10 | 16×16 / 24×24 逻辑、32×32 / 48×48 物理、像素对齐 | **未实现** | 图标尺寸散落在 `text-4xl`(36px)/`text-2xl`(24px)/`text-xl`(20px) 三种字号里（`launcher-home.tsx:48,66`），不是 12/24 的图标网格。 |

## 已实现且必须保留的能力（不得因 V2 重写而回退）

| 能力 | 位置 | 说明 |
|---|---|---|
| PTY 终端工作区（5 个 WS，`RESIZE`/`SNAP`/`ACTIVATE`/`KEY`/`TEXT` 协议） | `main.tsx:23-36, 313-362, 425-490, 552-563` | RG34XX 实机验收过（`docs/launcher-redesign-2026-10-29/README.md`）。V2 把它整体搬进 `terminal-workspace.tsx`，行为不变。 |
| 输入工作区（键盘/历史/命令/短语/会话/Agent） | `main.tsx:286-309, 365-387, 463-478` | 同上。V2 保留键盘/历史/命令三层骨架。 |
| 启动器桥接 `ui.__launcher`（LEVEL/STATE/CONTROL/SERVICE/SLEEP/LAUNCH/ROMS/ROMSCAN/ROMLAUNCH/LANGUAGE） | `scripts/pocketshell-launcher.rs:124-313` | 唯一 OS 访问点。V2 只新增 `PREF`/`PREFSET`/`LEVEL charging`，不改既有命令语义。 |
| 游戏库扫描与启动 | `scripts/pocketshell-games`、`bridge ROMS/ROMSCAN/ROMLAUNCH` | 保留，V2 把 ROM 变成内容流里的一等条目。 |
| 屏幕超时去抖 | `pocketjs-sleep` + `SLEEP` 命令 | 保留。 |
| Library 阅读器（`library.tsx`，独立 PocketJS 包） | `library-pocket.json` 单独编译 | 不受启动器重写影响。 |

## 差距汇总

- #92：1 条已实现（整数 2x 坐标）、4 条部分（日语、手柄、底部导航、配色/动画/字体）、5 条完全未实现（数字分页、状态栏、内容优先、去描述、横向流、去 scale、X/Y）。
- #93：0 条完全实现；1 条部分（分类图标位置存在但语义不同）；9 条未实现。
- 结论：需要按 #92 的信息架构重建启动器视图层，同时按 #93 建立独立的图标管线；桥接层与终端工作区保留。
