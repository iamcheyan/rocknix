## CPR98 实现组件

`projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/workspace-bar.tsx` 导出 `WorkspaceBar({ activeIndex })`。文件包含五组内联 8×8 位图数据，通过 PocketJS `View` 网格绘制为 16×16 物理像素的单色 Vector Pixel glyph（2×显示 profile 下每个 logical pixel 为 2×2 physical）。glyph 依次为应用/手柄、文件夹、Vim 编辑符、TOP 资源图、LOG 文档；顺序对应 APPS、FILES、VIM、TOP、LOG。当前项使用 `#3ECFFF`，其余项使用低对比度 `#64748B`。组件只读 active index，不接管输入或页面切换；真实状态 lane 目前为空。

官方 `pocket check` 与 `pocket compile` 通过；独立 probe 经官方 WASM renderer 在三个尺寸和不同 active index 下运行，截图见下方。完整 Launcher mount wiring 由 integration owner 处理，CPR98 不修改共享 `hello/main.tsx`。

## CPR98 — PocketShell Workspace Bar 设计与共享组件

状态：设计、独立 WorkspaceBar 组件和官方 PocketJS renderer probe 已完成。集成 wiring/真机最终验收由页面 owner 或总集成阶段完成。

## TopBar 现状

唯一所有者为 `projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/main.tsx`。当前 360×240 逻辑画布上，TopBar 使用 `top=1px, height=24px`，中心显示 `◀ WS{编号}:{名称} ▶`，右边用 Nerd Font 电池满格码位作为固定字符。它没有读真实电池状态。`HostUI` 暴露的 `__launcher` 与 `__pocketshell` 不提供网络/电量查询。

workspace 导航由同文件 `NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"]`、`LOG_WORKSPACE=4` 与 `switchTo()` 驱动。`BTN.LEFT/RIGHT/START` 调用 `switchTo()`；`active()` 决定内容和快照。Launcher 是 APPS workspace 上的 overlay，不是第六个 workspace。必须保留这五项顺序、状态和按键语义。

既有字体包含 FusionPixel 12px monospaced（OFL）与 Symbols Nerd Font（SIL OFL）；Symbols 字体已由 launcher manifest 配置为 fallback，但 glyph 能否呈现仍取决于 bake/preview 资源路径。TopBar 不混用文字字体字形来伪造像素图标。新组件用内联 8×8 位图格点数据绘制五个统一 16×16 单色 Vector Pixel workspace glyph，不引入外部图标字体或新增 workspace。状态图标目前无真实状态源，故不显示。

## 冲突与实施边界

CPR95 Launcher 和 CPR97 Settings 目标都涉及 `hello/main.tsx`，CPR96 目标涉及 System 内容页。用户 2026-10-29 已明确文件所有权：CPR95 管 Launcher/locale，CPR96 管 System 页面，CPR97 管 Settings，CPR98 管共享 TopBar；要求各自拆分内容组件，由页面负责人或最终集成阶段负责 mount wiring。CPR98 不修改 `main.tsx`，只实现独立 WorkspaceBar 与自己的文档。此前 CPR95/97 的实现仍在各自 worktree 的 `main.tsx`；不可覆盖或复制其未提交改动。

TopBar 组件契约：`hello/workspace-bar.tsx` 导出 `WorkspaceBar({ activeIndex })`。调用者传入现有导航的 0–4 active index。组件只绘制五个顺序固定的 glyph，不接管方向/Start 输入，不自行切换页面；调用方保持现有 `switchTo()`。状态数据接口暂时不存在，因此不传 status props、不显示状态 glyph。页面 owner/集成 owner 后续只需在共享 bar 位置传入当前 active index。

## 新布局

```text
┌──────────────────────────────────────────────────────────────┐ 24px physical / 12px logical
│ [APP] [FILES] [VIM] [TOP] [LOG]                                  │
│  active: Cyber Blue                         status lane: empty │
└──────────────────────────────────────────────────────────────┘
```

每个 workspace 使用 12px logical 槽，8×8 logical glyph 在当前 2× profile 下为 16×16 physical pixels；整个 bar 使用 12px logical 高度，即 24px physical。workspace icon lane 宽 60px logical，保留其余宽度给真实状态图标；当前 status lane 为空。active 图标以 cyan 高亮，150ms color transition 提示切换，不缩放、不弹跳、不延迟输入。

在没有可读真实数据源之前，Wi‑Fi、Bluetooth、电池和 ADB/SSH/MTP/OTA 图标均不显示。不得把“开启命令已发出”当成连接状态。将来只在 runtime 明确提供状态值时映射：已连接/已开为 cyan 或 mint，关闭/不可用为灰色，警告为 amber，错误为 red；developer 状态还须检查真实 developer-mode 开关。电量分段只用电池轮廓填充状态表示，不显示数字或百分比。IP/SSID 仍由既有 Network/System 页面负责。

## 图标、颜色与尺寸规范

- 当前设备 profile 的 glyph 为 8×8 logical pixels，2× raster 后 16×16 physical pixels；单色方格绘制，直角像素网格，统一轮廓/留白。不用 Emoji、Material、Fluent 或混搭图标来源。
- 五个 workspace glyph 按现有导航顺序分别对应 applications、files、Vim、TOP、LOG；不新增 workspace，不在 bar 显示数字或标签。
- 主焦点 Cyber Blue `#3ECFFF`；次级可用亮色 `#D8E8FF`；关闭/不可用 `#64748B`；警告 `#FFB400`；错误 `#FF4D5A`。状态图标不闪烁，面积与亮度均低于 workspace lane。
- 背景沿用 `#06111B` / 当前 runtime 深色底。最多一条 1px 分隔线，不使用按钮边框、传统 tab 卡片或大块状态徽标。

## PocketJS 组件树 / 接口

```text
PocketShellRoot
├── WorkspaceBar (height 12 logical / 24 physical px)
│   └── PixelWorkspaceGlyph × 5 (activeIndex prop; 8×8 logical / 16×16 physical)
├── ActiveWorkspaceContent
└── InputOverlay?            // existing behavior and priority retained
```

最终 wiring 时应把唯一 workspace metadata/icon key 放在导航定义，`switchTo()` 与 bar 从同一数据读取；但 CPR98 按所有权只提交独立组件，不改 `main.tsx`，由 Launcher/Settings owner 或最终集成提交添加 import 和 `activeIndex`。WorkspaceBar 只接收 `activeIndex`；目前无 status contract，不生成或轮询状态值。launcher/system/settings 页面主体、键位路由和输入 overlay不属本 issue 的组件改动范围。

## 切换动画

activeIndex 改变时立即更新选中 glyph；短暂使用 150ms focus tint 作切换反馈，不延迟输入、workspace 切换或 snapshot。组件保持纯显示，不在内部复制导航状态。

## 前后对照

| 项目 | 当前 | 目标 |
|---|---|---|
| 层级 | 中央大号 workspace 名称 + 编号 | 左侧 workspace icon lane 为首要内容 |
| Workspace | 名称文字、数字和箭头 | 只显示五个既有 workspace 图标，active 明显高亮 |
| 状态 | 固定电池字形，非真实数据 | 只呈现 runtime 真实可用状态；无 bridge 时隐藏 |
| 视觉 | 居中 debug 标签 | 左主右次、无按钮框、16px 单色 Vector Pixel |
| 空间 | 当前 24px logical / 48px physical | 目标 12px logical / 24px physical |
| 信息泄露 | 当前无网络细节 | TopBar 不放 IP、SSID、文字或电量百分比 |

## 浏览器与真机验收计划

WorkspaceBar probe 使用 HX90 临时 pinned PocketJS checkout 的官方 compiler、Rust/WASM core 与 rasterizer，root 为 360×240 logical canvas，组件占 top row。720×480、960×640 与 1280×720 均由同一 app bundle、同一 logical UI 在 renderer viewport 下捕获；三帧非空、hash 不同，顶栏元素未越过画布边界，canvas 其余区域保持 root 背景。它验证组件和 renderer 尺寸布局，不证明最终 app wiring、完整页面无裁切或浏览器外壳缩放流程。

| 尺寸 | Probe 截图 |
|---|---|
| 720×480 | `screenshots/workspace-bar-720x480.png` |
| 960×640 | `screenshots/workspace-bar-960x640.png` |
| 1280×720 | `screenshots/workspace-bar-1280x720.png` |

真机基线 `screenshots/rg34xx-baseline-720x480.png` 来自 RG34XX 官方 PocketJS KMS 运行帧，显示未集成 CPR98 的旧 Launcher 状态栏，不是新组件真机截图。新组件尚未 mount 到设备 app；真机行为、全页裁切和实际 150ms 动画须在最终集成后检查。

## 当前未解决项
1. CPR95/96/97 页面和最终集成尚未把 WorkspaceBar mount 到 app；CPR98 按用户授权不改 `hello/main.tsx`，须由 integration owner 接线。
2. PocketJS runtime 没有 Wi‑Fi、Bluetooth、电池或 developer-mode 状态数据契约；组件当前仅呈现 workspace glyph，不新增 status bridge，也不合成状态。
3. 本 worktree 完成了独立组件的官方 compiler/WASM renderer probe；完整 app wiring、真实 RG34XX 新界面截图、浏览器缩放/完整页面裁切与动画帧验证仍待最终集成。
