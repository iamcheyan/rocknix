# #92 × #93 冲突与取舍（SPEC-MAP）

两份 issue 在四点直接冲突。#93 的图标条款优先（任务书原文："若 #92 与 #93 有其它冲突，
以 #93 的图标条款为准"），其余按"不引入新架构、不回退已验证能力"的原则裁定。

## C1 — 状态图标来源：Nerd Font（#92）vs Pixelarticons（#93）

- #92「状态图标」一节明确要求 WiFi/Bluetooth/ADB/电池全部来自 Nerd Font，并列出码点
  （`󰤨`/`󰂯`/`󰀘`/`󰁽`…），还明确写"禁止 png / svg / material icons / font awesome"。
- #93「Do NOT Use」把 "Nerd Font icons for UI" 列为禁止项，并要求状态栏用 pixelarticons。

**裁定：采用 #93。** 全部状态图标是 `icons/registry.generated.ts` 里的位图，
由 `icon.tsx` 用整数矩形绘制。Nerd Font **仍然**是字体栈的一段，但只用于文本渲染
（终端/TTY/Shell/Console 应用内部），不再作为 UI artwork 出现。

后果：#92 里 11 个电池码点（`󰁹`…`󰂃`）的映射被 4 档图标取代（`battery-full`/
`battery-medium`/`battery-low`/`battery-critical` + `charging` 闪电）。这同时满足 #93
「Battery levels: 100/75/50/25/10/Critical，用图标变化和颜色」。

## C2 — #92 的"禁止 svg"vs #93 的"vendor pixelarticons SVG"

#92 的禁止清单针对的是**状态图标**（避免与 Nerd Font 混用）；#93 要求 vendor 上游 SVG
并建立导入管线。

**裁定：上游 SVG 只在构建期存在。** `icons/pixelarticons/svg/*.svg` 是源码资产，
`tools/build-icons.py` 把它们光栅化成位图写进 `icons/registry.generated.ts`；
运行时产物（`.pocket` 包）里没有任何 SVG，也没有图标纹理。这既满足 #93 的管线要求，
也不违反 #92 对"运行时图标必须与文字同风格"的意图。

## C3 — 字体栈：#92 指定 Iosevka Nerd Font/Terminus/Tamzen/GNU Unifont

**裁定：采用 #92 的栈，但顺序按实测覆盖度重排。**

实测（`bakeAtlases` + opentype.js cmap 查询，见 ACCEPTANCE.md 的字体章节）：
Iosevka Nerd Font、Terminus、Tamzen 都不含假名/汉字，日语 UI 全部要靠 fallback。
Tamzen 6x12 在 12px 下是严格 12×12 单元、笔画对齐像素网格，是这套 UI 最合适的正文面；
Terminus 在 12px 是 12×13（行高多 1px，破坏 12px 栅格）；
Iosevka 在 12px 是 11×16（行高 16px，12px 状态栏放不下）。

因此实际栈为：

1. **Tamzen 6x12**（正文 + 标题，regular/bold 各一份）
2. **Terminus TTF 4.49.1**（fallback 第二）
3. **Fusion Pixel 12px JA**（假名/汉字主力，`bakeAtlases` 的 fallback 会按字符命中）
4. **GNU Unifont 17.0.04**（最终兜底，全 BMP 覆盖）

Iosevka Nerd Font **未** vendor：它解决了 Nerd Font 图标，而 #93 已禁止 UI 使用
Nerd Font 图标；作为纯文本面它的 12px 行高（16px）放不进 12px 状态栏。记为一处
与 #92 字面清单的偏离，理由在此。

## C4 — 分类图标语义：#92「すべて/メディア/ゲーム/お気に入り/設定」vs #93 的例子

#93 举的例子是「すべて→Grid、ゲーム→Gamepad、メディア→Media、お気に入り→Star、設定→Settings」，
与 #92 的分类集合完全一致。

**裁定：一致，直接采用。** 映射在 `bottom-nav.tsx`（`CATEGORY_ICONS`）与状态栏
（分类名两侧的 chevron）体现。

## 非冲突但需裁决的点

| 议题 | 取舍 | 理由 |
|---|---|---|
| 每页卡片数 | 4 张（84px 卡 + 6px 间距 + 4px 边距 = 360） | #92 只要求"横向流"，未定数量。4 张让标题不被压缩到 8px 假名；`flowInset()` 在条目少于 4 时居中。 |
| 主页面是否显示标题文字 | 卡片下方重复一次**当前选中项**的名称（图标 + 名称两件套） | #92 第 6 条禁的是"应用描述/副标题/介绍文字"，不是名称；Switch 本身也是这样。 |
| 分类切换键 | L1/R1（#92 明确"< > 暗示 L1/R1"）；B 也回退到上一分类 | #92 未规定 B 在内容页的行为；与旧实现（B 返回）保持一致，避免用户肌肉记忆断裂。 |
| 收藏键 | SELECT 切换收藏 | #92 未指定收藏键；X/Y 已被搜索/最近占用，SELECT 在旧实现里是输入工作区（终端视图内保留该含义）。 |
| 设置页形态 | 仍是横向流：分组标题行 + 该组的横向瓦片行 | #92 第 7 条禁止"树状/列表菜单"；设置页最容易退回列表，故显式保持横向语法。 |
| 亮度的百分比 | 设置页显示 `62%` | #92 只禁止**电池**显示百分比；亮度/音量本身就是百分比量。 |
| 终端工作区 | 整体保留（`terminal-workspace.tsx`） | 在 RG34XX 上验收过，V2 只改首页。START 进入终端。 |
| 游戏库 | ROM 成为内容流的一等条目 | #92"内容优先"，游戏就是内容；扫描服务保持不变。 |

## 明确不做

- 不引入 Electron / WebView / DOM / CSS：仍是 PocketJS Solid 原生视图树。
- 不改 `package.mk` 的 PocketJS 版本、不改 BSP/kernel/build 系统。
- 不做非整数缩放：只有 12×12 与 24×24 两种已烘焙分辨率，`Icon` 拒绝其他尺寸。
