## CPR98 实现组件

`projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/workspace-bar.tsx` 导出 `WorkspaceBar({ workspaces, activeId })`。调用方传入导航定义中的顺序数组，每项包含稳定 `id` 与 8×8 单色位图 `glyph`；组件按传入顺序绘制，active workspace 由 `activeId` 指定。当前项为 Cyber Blue，其他项为低对比灰蓝；图标无按钮框，组件不接管输入/切换。2× profile 下 8×8 logical glyph 呈现为 16×16 physical pixels。

CPR95 当前描述符有 `id` 与 Nerd Font `icon` codepoint，但无 pixel `glyph`。最终集成时，Launcher owner 需在同一份现有五项 workspace descriptors 增加 pixel glyph，并把该数组和当前 id 传入 WorkspaceBar。PocketJS 当前无真实 Wi‑Fi/Bluetooth/battery/developer-mode query，因此右侧状态 lane 保持空白。

该 props 版本已通过官方 `pocket check`、`pocket compile`，并由官方 Rust/WASM renderer 运行三尺寸 probe。正式 app wiring 归 CPR95/最终 integration owner；CPR98 不改共享 `hello/main.tsx`。

## CPR98 — PocketShell Workspace Bar 设计与共享组件

状态：设计、独立 WorkspaceBar 组件和官方 PocketJS renderer probe 已完成。集成 wiring/真机最终验收由页面 owner 或总集成阶段完成。

## TopBar 现状

唯一所有者为 `projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/main.tsx`。当前 360×240 逻辑画布上，TopBar 使用 `top=1px, height=24px`，中心显示 `◀ WS{编号}:{名称} ▶`，右边用 Nerd Font 电池满格码位作为固定字符。它没有读真实电池状态。`HostUI` 暴露的 `__launcher` 与 `__pocketshell` 不提供网络/电量查询。

workspace 导航由同文件 `NAMES = ["APPS", "FILES", "VIM", "TOP", "LOG"]`、`LOG_WORKSPACE=4` 与 `switchTo()` 驱动。`BTN.LEFT/RIGHT/START` 调用 `switchTo()`；`active()` 决定内容和快照。Launcher 是 APPS workspace 上的 overlay，不是第六个 workspace。必须保留这五项顺序、状态和按键语义。

既有字体包含 FusionPixel 12px monospaced（OFL）与 Symbols Nerd Font（SIL OFL）；Symbols 字体已由 launcher manifest 配置为 fallback，但 glyph 能否呈现仍取决于 bake/preview 资源路径。TopBar 不混用文字字体字形来伪造像素图标。新组件用内联 8×8 位图格点数据绘制五个统一 16×16 单色 Vector Pixel workspace glyph，不引入外部图标字体或新增 workspace。状态图标目前无真实状态源，故不显示。

## 冲突与实施边界

CPR95 Launcher 与 CPR97 Settings 的 worktree 都含 `hello/main.tsx` 未提交改动；CPR96 负责 System 页面。用户明确文件所有权：CPR95 管 Launcher/locale，CPR96 管 System，CPR97 管 Settings，CPR98 管共享 TopBar。CPR98 只在本 worktree 修改独立 WorkspaceBar 和本 issue 文档，不触碰共享 `main.tsx` 或其他 worktree。

当前组件契约：`WorkspaceBar({ workspaces, activeId })`；每项 descriptor 是 `{ id, glyph }`，顺序由正式 launcher/navigation 提供。组件纯显示，不接管方向/Start 输入或页面切换。真实状态 API 未提供，不传 status props，不显示状态 glyph。

## 新布局

```text
┌───────────────────────────────────────────────────────────────────────────┐ 24px physical / 12px logical
│ [workspace glyphs from current navigation]        [real status icons only] │
│ current: Cyber Blue                    status lane empty without data source │
└───────────────────────────────────────────────────────────────────────────┘
```

TopBar 高 12px logical（2× profile 下 24px physical）。五个 workspace 槽各宽 12px logical，16×16 physical glyph 在槽中居中；左侧 workspace lane 共 60px logical，右侧预留给真实状态图标。状态数据暂不可用时右侧保持空白。active glyph 使用 Cyber Blue 和同槽淡 cyan 背景，150ms transition，不缩放或移动邻项。

在没有可读真实数据源之前，Wi‑Fi、Bluetooth、电池和 ADB/SSH/MTP/OTA 图标均不显示。不得把“开启命令已发出”当成连接状态。将来只在 runtime 明确提供状态值时映射：已连接/已开为 cyan 或 mint，关闭/不可用为灰色，警告为 amber，错误为 red；developer 状态还须检查真实 developer-mode 开关。电量分段只用电池轮廓填充状态表示，不显示数字或百分比。IP/SSID 仍由既有 Network/System 页面负责。

## 图标、颜色与尺寸规范

- Component 从正式 navigation descriptor 的 `glyph` 数据渲染 8×8 logical 单色像素图案，profile 2×后为 16×16 physical；无 Emoji、Material、Fluent 或混合来源。
- 五个 glyph 对应现有 APPS、FILES、VIM、TOP、LOG workspace；顺序由调用方传入的 workspace 数组决定，TopBar 不加条目或标签。
- 主焦点 Cyber Blue `#3ECFFF`；次级可用亮色 `#D8E8FF`；关闭/不可用 `#64748B`；警告 `#FFB400`；错误 `#FF4D5A`。状态图标不闪烁，面积与亮度均低于 workspace lane。
- 背景沿用 `#06111B` / 当前 runtime 深色底。最多一条 1px 分隔线，不使用按钮边框、传统 tab 卡片或大块状态徽标。

## PocketJS 组件树 / 接口

```text
├── WorkspaceBar (height 12 logical / 24 physical px)
│   └── PixelWorkspaceGlyph × workspaces.length (navigation `{id, glyph}` + activeId)
├── ActiveWorkspaceContent
└── InputOverlay?            // existing behavior and priority retained
```

最终 wiring 时，Launcher owner 将正式导航数组和 active id 传给 WorkspaceBar；workspace 顺序和 active 状态继续由导航管理。CPR98 按所有权不改 `main.tsx`，由 CPR95/最终集成添加 import/mount。无真实状态 contract 时不生成系统状态。页面主体和输入/导航语义保持各自 owner 的实现。

## 切换动画

active id 更新时，glyph 立即切换为 Cyber Blue；底色与图标色使用 150ms transition。动画不延迟导航或快照，不移动相邻槽位。

## 前后对照

| 项目 | 当前 | 目标 |
|---|---|---|
| 层级 | 中央 workspace 标题与编号 | 左侧为 navigation 提供的 glyph，右侧只留真实状态图标 |
| Workspace | 名称文字、数字和箭头 | 只显示五项像素图标，active 明显高亮 |
| 状态 | 固定电池字形，非真实数据 | 只显示有真实 query source 的图标；当前 status lane 空白 |
| 视觉 | 居中 debug 标签 | 左 workspace lane 主导，16×16 physical 单色 Vector Pixel |
| 空间 | 当前 24px logical / 48px physical | 目标 12px logical / 24px physical |
| 信息泄露 | 当前无网络细节 | TopBar 不放 IP、SSID、文字或电量百分比 |

## 浏览器与真机验收计划

WorkspaceBar probe 使用 HX90 临时 pinned PocketJS checkout 的官方 compiler、Rust/WASM core 与 rasterizer，root 为 360×240 logical canvas，组件占 top row。720×480、960×640 与 1280×720 均由同一 app bundle、同一 logical UI 在 renderer viewport 下捕获；三帧非空、hash 不同，top row 元素未越过画布边界，其余画布保持 root 背景。Probe props 使用与正式合约相同的 `{workspaces, activeId}`，但不是 CPR95 完整 app 或浏览器外壳缩放验收。

| 尺寸 | Probe 截图 |
|---|---|
| 720×480 | `screenshots/workspace-bar-720x480.png` |
| 960×640 | `screenshots/workspace-bar-960x640.png` |
| 1280×720 | `screenshots/workspace-bar-1280x720.png` |
不同 `activeId` 的渲染证据：`screenshots/workspace-bar-active-apps-720x480.png` 与 `screenshots/workspace-bar-active-log-720x480.png`。两张均由当前 `{workspaces, activeId}` probe bundle + 官方 WASM renderer 生成，draw hash 不同，像素统计非空。

RG34XX 官方 PocketJS KMS 当前 frame endpoint 在最近检查时返回 1,036,800 字节（720×480 RGB），PNG mean=0.130449、stddev=0.126468；但设备显示的是未集成 CPR98 的旧 Launcher 状态栏。出于隐私，设备原始帧不随文档发布；其中存在网络与电池信息。KMS service 当前 inactive，因此未对其重启或改写。新组件尚未 mount 到正式 app，真机/设备尺寸验收未完成。

## 当前未解决项
1. 最新审计（2026-10-29）显示 CPR95 branch 远端仍无 integration commit；其 worktree 的 dirty `main.tsx` 仍有 `09:41 / Wi‑Fi / 78%` 文本状态行，且 descriptors 无 pixel `glyph`。CPR95/协调 agent 确认该文件归 Launcher owner/最终集成所有，CPR98 不改其他 worktree。接线接口为在五个既有 descriptors 添加 8×8 `glyph`，再传入 `<WorkspaceBar workspaces={WORKSPACES} activeId={WORKSPACES[selectedWorkspace()].id} />`。
2. 最新 RG34XX frame 经 HX90 `/device/frame.rgb` 捕获，为 720×480、1,036,800 字节 RGB，PNG mean=0.130449、stddev=0.126468；画面仍含 IP、数字 workspace 与 `100%` 电量，不是 CPR98 新 UI。PocketJS runtime 没有可查询的 Wi‑Fi、Bluetooth、电池或 developer-mode 状态 API；不显示、不合成状态。
3. CPR98 独立 component probe 已完成三尺寸 renderer 检查；正式 Launcher wiring、RG34XX 新界面截图、浏览器外壳缩放、整页裁切、输入/导航回归与实际 150ms 动画验收仍待集成 owner 提供稳定 ref。
