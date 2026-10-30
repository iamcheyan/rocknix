# PocketShell Launcher V2 — 验收记录

分支 `feat/launcher-v2-spec`。所有命令与渲染都在 HX90（NixOS）上执行；
截图由官方 PocketJS WASM 像素渲染器生成，不是手绘、不是模拟。

## 0. 证据总览

| 项 | 值 |
|---|---|
| 逻辑坐标 | 360×240 |
| 输出 | 720×480（精确 2x，`integer-fit`） |
| 截图目录 | `docs/evidence/launcher-v2/`（11 张 WASM 帧）+ `docs/evidence/launcher-v2/browser/`（10 张 headless Chromium 实拍），全部 720×480 |
| 截图工具 | `tools/capture-launcher-v2-frames.ts`（WASM）、`tools/launcher-v2-browser/drive.mjs`（Chromium） |
| PocketJS 版本 | `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f`（= `package.mk` 的 `PKG_VERSION`） |

## 1. 逐条需求验收

### #92

| # | 需求 | 验收方式 | 结果 |
|---|---|---|---|
| 1 | 无数字分页；顶部中央 `<分類>`；L1/R1 切换 | `06-search`/`01-all` 等截图的状态栏中段只有 `‹ すべて ›`；`status-bar.tsx` 里没有任何 `n/total` 计数文本（`grep -n "selection + 1\|selected + 1" hello/*.tsx` 无结果）。分类切换由 `main.tsx` 的 `BTN.LTRIGGER`/`BTN.RTRIGGER` → `setCategoryBy` 驱动，实测帧哈希变化。 | PASS |
| 2 | 状态栏高 12 逻辑像素；`[网络/IP] [分类] [系统状态]`；电池无百分比 | `theme.ts` `STATUS_BAR_H = 12`；`status-bar.tsx` 三段绝对定位（左 IP、中分类、右 ADB/BT/音量/电池）。截图 `09-battery-low`、`10-battery-critical` 只有图标，无数字。`02-media` 里右侧图标随状态换色。 | PASS |
| 3 | 界面语言全部日语 | `strings.ts` 是唯一文案表（`JA`），代码里没有中英文 UI 字符串；`grep -rn "zh\|中文\|Settings\"\|Back\"" hello/*.tsx` 无结果（`JA.settings.*` 除外）。截图里所有可见文字（すべて/メディア/ゲーム/お気に入り/設定/ファイル/検索/最近使った/明るさ/画面…）均为日语。 | PASS |
| 4 | 内容优先：首屏就是内容 | `01-all` 首屏直接是 4 张内容卡（ファイル / Metroid Fusion / Golden Sun / Manual），没有菜单或配置项；设置必须按 R1×4 才到。 | PASS |
| 4b | 最近使用优先（DESC(last_launch)） | `model.ts` `orderByRecent`；截图 `01-all` 第一张卡 `ファイル` 的 key 是 mock 里的 `recent[0]`。 | PASS |
| 5 | 手柄完成全部操作 | 逐键实测（见 §3）：D-Pad、ABXY、L1/R1、START、SELECT 全部改变帧或改写状态；没有任何操作需要鼠标/键盘。 | PASS |
| 6 | 主页面无描述/副标题，仅图标+名称 | `launcher-catalog.ts` 已删除 `description`/`shortName`/`tag` 字段；`content-flow.tsx` 只渲染 `Icon` + 一行 `fit(label)`。截图里卡片内只有图标与名称。 | PASS |
| 7 | 内容流 `[A][B][C][D]…` 横向流 | `content-flow.tsx` 单行 flex-row，`FLOW.visible = 4`；`windowStart()` 让窗口跟随焦点。无树状/列表/桌面网格/商店布局。设置页同样横向（分组行 + 瓦片行）。 | PASS |
| 8 | 禁用 scale，改用边框+亮度+阴影 | `grep -rn "scale" hello/content-flow.tsx hello/settings-page.tsx hello/overlay.tsx` 无结果；选中卡用 `borderColor: #3FFF96` + `borderWidth: 2` + `bgColor: #202020`（亮一档）+ `shadow: 2`。 | PASS |
| 9 | 底部导航常驻且高亮 | `bottom-nav.tsx` 渲染于所有首页/设置/搜索态（`main.tsx` 的 `<BottomNav>` 不在 `<Show when={!overlay()}>` 内）；当前项 `color: #3FFF96`，其余 `#5C5C5C`。截图可见五项常驻。 | PASS |
| 10 | X 搜索、Y 最近使用 | `main.tsx` `BTN.SQUARE → openOverlay("search")`、`BTN.TRIANGLE → openOverlay("recent")`。截图 `06-search`（検索面板 + 实时查询行）、`07-recent`（最近使った）。搜索覆盖名称/分类/分组/path（`model.ts` `searchItems`）。 | PASS |
| 附加 | 360×240 + 整数 2x，无非整数缩放 | 见 §2 的结构审计：254/191/217 个节点矩形全部整数、全部落在 360×240 内。`pocket.json` 声明 `integer-fit`。 | PASS |
| 附加 | 配色 | `theme.ts` `COLORS` 就是 #92 的色板（`#141414`/`#8BFF5A`/`#3FFF96`/`#FFA63C`/`#FF5A5A`/`#EAEAEA`）。 | PASS |
| 附加 | 动效预算 | `theme.ts` `MOTION` 常量（80/120/180/150ms）已定义；当前视图切换是即时重绘（无缓动过渡），见 §6 遗留。 | 部分 |

### #93

| # | 需求 | 验收方式 | 结果 |
|---|---|---|---|
| 1 | pixelarticons 为唯一图标包，vendor 进仓库 | `hello/icons/pixelarticons/svg/` 45 个上游 SVG + `LICENSE`（MIT, © 2019 Gerrit Halfmann）。只 vendor 用到的图标（172 KB）。 | PASS |
| 2 | 构建/导入管线 + icon registry | `hello/tools/build-icons.py`：SVG → 路径展平 → even-odd 像素中心采样 → 24×24 位图 + 12×12 半分辨率 → `icons/registry.generated.ts`（45 图标，13 046 字节，含 `ICON_SOURCES`/`IconName`/`ICON_ROWS`/`ICON_ROWS_HALF`/`ICON_REGISTRY_DIGEST`）。 | PASS |
| 2b | 光栅化正确性 | 对全部 651 个上游非变体图标与 `resvg` 逐像素比对：**651/651 完全一致**（`mismatched 0`）。 | PASS |
| 3 | UI 不用 Nerd Font 图标 | `grep -rn "\\\\uf[0-9a-f]\\{3\\}" hello/*.tsx hello/*.ts` 无结果；`fonts.json` 不再包含 `SymbolsNerdFontMono-Regular.ttf`。Nerd Font 仅作为字体栈可选项保留给终端。 | PASS |
| 4 | 状态栏像素图标 | `status-bar.tsx` 用 `wifi`/`bluetooth`/`adb`/`volume`/`battery-*`/`charging`，全部来自 registry。 | PASS |
| 5 | 电池只图标+颜色，三档色值 | `status-bar.tsx` `batteryColor()`：`>20` `#EAEAEA`、`≤20` `#FFA63C`、`≤5` `#FF5A5A`；`batteryIcon()` 映射 4 档。截图 `09-battery-low`（15% → 橙）、`10-battery-critical`（3% → 红）实测。 | PASS |
| 6 | WiFi/BT 状态色 | `stateColor()`：on=主题色 `#8BFF5A`、off=灰 `#4A4A4A`、unknown=红 `#FF5A5A`。 | PASS |
| 7 | 每分类固定图标 | `bottom-nav.tsx` `CATEGORY_ICONS`：all=grid-3x3、media=video、games=gamepad、favorites=star、settings=settings-2。截图底部栏可见。 | PASS |
| 8 | 应用图标：自带 artwork → pixelarticons fallback | 当前所有应用都用 registry 的语义图标（`launcher-catalog.ts` 每条显式指定），没有随机占位符。应用自带 artwork 通路**未实现**（见 §6）。 | 部分 |
| 9 | 统一渲染管线 SVG→归一化→padding→缓存→渲染 | 归一化在构建期完成（统一 24×24 画布）；`icon.tsx` 把位图贪心合并成整数矩形（平均 11.3 个/图标），无 SVG、无纹理、无字形。padding 由卡片布局的 52px 图标框统一给出。 | PASS |
| 10 | 16/24 逻辑、32/48 物理、像素对齐 | `ICON_SIZE=24`（48 物理）、`ICON_HALF=12`（24 物理）；`icon.tsx` 明确拒绝其他尺寸（`throw`），因此不存在任何重采样。结构审计：0 个分数矩形。 | PASS |

## 2. 结构与像素栅格审计（实测）

用 WASM 宿主逐节点读回布局矩形（`inspectNode` + `layout`），对三个代表屏扫描全部节点：

```
all:      nodes=254 fractional=0 out-of-bounds=0
settings: nodes=191 fractional=0 out-of-bounds=0
search:   nodes=217 fractional=0 out-of-bounds=0
```

- **fractional=0**：每个节点的 x/y/w/h 都是整数逻辑像素 → 2x 输出时落在偶数物理像素上。
- **out-of-bounds=0**：没有任何节点越出 360×240，因此不存在裁切或滚动溢出。
- 说明：对 720×480 帧做"2×2 块完全相同"的逐像素检查会报少量差异，这来自
  **字体图集本身在 2x 下烘焙**（`rasterDensity: 2`）——字形边缘可以落在物理像素级。
  这是 PocketJS 的既定行为（所有 2x 文案都如此），不是布局非整数化。

## 2b. Headless Chromium 实测（浏览器路径）

WASM 帧只能证明**核心**的绘制结果；浏览器会额外引入自己的一层光栅化与合成。
`tools/launcher-v2-browser/` 用真实 Chromium（headless）跑同一份编译产物：

```
01-all … 10-battery-critical   shot=720x480  logical=360x240  css=720x480  backing=360x240
console messages: 0 (errors: 0)
PASS: every screenshot 720x480, no console/page errors
```

- canvas 的 **backing store 是 360×240**，CSS 盒是 720×480（`transform: scale(2)` +
  `image-rendering: pixelated`），即整数 2x，浏览器不参与重采样。
- `console`(error) / `pageerror` / `requestfailed` 三类事件全部收集，**0 条**。
- 10 张截图的 SHA-256 互不相同（若某两屏相同说明渲染没更新）。
- 该 harness 暴露并修复了一个真实缺陷：桥接必须在**启动器求值之前**安装
  （`globalThis.ui` + `__launcher`），否则 `onMount` 读到空数据，所有变体渲染一致。
  Rust 宿主本来就是这个顺序，是 harness 此前写错了。

## 3. 手柄按键逐项实测

`bun` 直接驱动 WASM 宿主，每次按键后比对 `drawHash()`：

| 操作 | 结果 |
|---|---|
| R1 下一分类（すべて→メディア） | 帧变化 |
| L1 上一分类（メディア→すべて） | 帧变化 |
| 方向键移动选择 | 帧变化 |
| SQUARE 打开搜索面板 | 帧变化（面板出现） |
| CROSS 关闭搜索 | 面板消失，回到底部导航仍在的首页 |
| TRIANGLE 打开最近使用 | 帧变化 |
| 设置：→/← 调亮度 | 帧变化，且桥接收到 `CONTROL brightness` |
| 设置：↓/↑ 换分组、↑ 回绕到末组 | 帧变化 |
| 设置：A 应用值 | 帧变化 |

桥接调用统计（同一轮）：

```
LEVEL 34, STATE 66, PREF 1, ROMS 1, CONTROL 2, SLEEP 1, SHELL RESIZE 1, SHELL 0..4 START
```

即状态栏读 IP/电池/充电、服务状态读、偏好读、库读、亮度写、超时写全部真实发生。

## 4. 字体

`fonts.json` 的 fallback 顺序 = `Tamzen6x12r` → `TerminusTTF` → `fusion-pixel-12px-ja` → `GNUUnifont`，
regular/bold/mono 三面都指向 Tamzen。实测（`bakeAtlases` + opentype.js cmap 查询）：

| 面 | `ゲーム`/`設定`/`検索`/`明るさ` 等 20 字覆盖 |
|---|---|
| Tamzen 6x12 | 0/20（纯 ASCII 终端字体，无假名） |
| Terminus TTF | 0/20（同上） |
| Fusion Pixel 12px JA | 20/20 |
| GNU Unifont | 20/20（大而全，最终兜底） |

所以日语正文实际由 Fusion Pixel 命中，Tamzen 负责 ASCII/数字/标点——这正是
`bakeAtlases` 的 per-glyph fallback 设计。烘焙结果：所有 UI 字符串在 12px 槽位
**0 个 gid 0（豆腐块）**，唯一 gid 0 是刻意画的 U+FFFD 替换方块。

**假名覆盖**：`fonts.json` 声明 `U+3000-30FF`（平假名/片假名/假名标点）、`U+FF01-FF60`、
`U+FFE0-FFE6`（全角 ASCII），因此**任意**日文游戏标题都能渲染，不只源码里出现的字。
实测：加范围前 243 字形、`ゴールデンサン` 的 `ゴ` 是豆腐块（截图 11 暴露）；
加范围后 539 字形，同一截图正确显示 `ゴールデンサ...`。代价是 pak 从 1.0 MB 涨到 2.4 MB。

字体实测单元尺寸（决定行高，不能用非整数）：

| 字体 | 12px 下 cell |
|---|---|
| Tamzen 6x12 | 12×12（未声明的假名回落到 Fusion Pixel 时；纯 ASCII 子集 11×12） |
| Terminus TTF | 12×13 |
| Fusion Pixel JA | 11×12 |
| Iosevka NF | 11×16 |

Iosevka 的 16px 行高放不进 12px 状态栏，且 #93 禁止把 Nerd Font 当 UI 图标，
因此没有 vendor 它。这是与 #92 字面字体清单的唯一偏离，理由见 `SPEC-MAP.md` C3。

授权文件已随字体入库：`LICENSE-Tamzen.txt`、`LICENSE-OFL-Terminus.txt`、
`LICENSE-OFL-FusionPixel.txt`、`LICENSE-GPL-Unifont.txt`、`LICENSE-NerdFonts.txt`。

## 5. 构建与检查

```
bun tools/pocket.ts check   ... → ✓ pocket.json v2 / ✓ capabilities / ✓ TypeScript (72 modules)
bun tools/pocket.ts compile ... → ✓ Package: boot.pocket
  tailwind: 27 style records
  fonts: 4 fallback faces, 162 declared characters
  pak: 8 entries, 1 016 816 bytes
```

`scripts/pocketshell-launcher.rs` 用 `cargo build --release`（pocket-guest-rquickjs）编译通过。

## 6. 明确未完成 / 待实机验证

| 项 | 状态 | 说明 |
|---|---|---|
| RG34XX 实机渲染、按键手感、字体在真实 LCD 上的可读性 | **待实机验证** | 本次只做 host 渲染与 WASM 帧；未刷机、未部署 `/storage` 覆盖。 |
| 动画（80/120/180/150ms） | 未实现 | 视图切换是即时重绘。常量已定义，尚未接 `animate()`；PocketJS 在 360×240 上每次重绘需保证不丢帧，需实机测量后再接。 |
| 应用自带 artwork 优先级 | 未实现 | 目前全部走 registry 语义图标。PocketJS 的 `Image` + pak 图片管线可用，但没有应用提供 artwork 清单。 |
| 搜索面板的文字输入 | 部分 | 手柄下可浏览/打开结果，但键盘输入依赖 `onTextEvent` 的 `commit`（需要文本输入设备）；面板内未接 PocketJS `TextField` OSK，因为 92px 的 OSK 面板会盖住 150px 的搜索面板。待实机确认按键方案后再接。浏览器路径已验证：Chromium 里以 `__step(SQUARE)` 打开面板、方向键移动、B 关闭均正常。 |
| 收藏（SELECT）在实机上的可达性 | 待实机验证 | SELECT 在终端视图里保留"输入工作区"含义，首页里是收藏切换。 |
| `LEVEL charging` | 待实机验证 | 读 `/sys/class/power_supply/*/online`；HX90 无电池，实机才能给出真实值。 |
