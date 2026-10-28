# 任务：把 PocketShell 启动器重写成一个高级、丝滑的 Switch 风格原生界面

你在这个 worktree 里工作：`/home/tetsuya/development/.worktrees/launcher-redesign`（分支 `feat/launcher-redesign`）。
这是一个 ROCKNIX 固件仓库，目标设备是 Anbernic RG34XX（Rockchip H700，720×480 LCD）。

## 一、现状与根因（先读代码再动手）

启动器源码：`projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/`

- **`main.tsx` 现在是"伪 UI"**：它并不渲染真正的视图树，而是把字符写进一个 12 行 × 46 列的终端网格（通过 `__pocketshell` 的 `RESIZE` / `SNAP` / `ACTIVATE` / `KEY` / `TEXT` / `LOG` 协议）。所以它只能是纯文字，不能有布局、圆角、图层、动画——这就是它"丑"和"动不起来"的根本原因。
- **`showcase/main.tsx` 才是正确的做法**：它用真正的原生视图树（`View` / `Text` / `FocusScope` / `Modal` / `ActionHandler`），并用 `animate()` 做过渡动画、`VirtualList` / `createScroller` 做滚动。**这是你要参照的范例，请先完整读它**。
- `library.tsx` 是另一个较小的原生视图例子（`View` / `Text` / `ActionHandler` + `TextField`）。
- `pocket.json` 声明了应用清单（viewport 逻辑分辨率 360×240、`integer-fit` 2× 放大到 720×480）。
- `launcher-catalog.ts` 是应用清单数据（id / name / description / kind）。

**第一步必须是**：读 `showcase/main.tsx`、`library.tsx`、`showcase/showcase-model.ts`、`pocket.json`、`launcher-catalog.ts`，搞清楚原生视图树的写法和这个仓库的编译检查命令（`grep -rn "pocket.ts check" ../../` 之类，`package.mk` 里有真实调用）。

## 二、要做的产品（用户原话）

> "整个界面都太丑了，重新设计一个样式。类似 Switch 的游戏界面。第一屏是首页，显示各种启动项目；第二屏多媒体；第三屏游戏；第四屏设置；第五屏系统信息。顶部左侧是 Wi-Fi 和蓝牙，Wi-Fi 如果连接上了就显示当前设备的 IP 地址；右边是电量。字体还用现在的点阵和 Nerd Fonts fallback。"
>
> "让它充分利用 PocketJS，把交互做的酷炫，动画丝滑流畅，高级、有质感。"

### 2.1 五屏结构（左右切换）

| 屏 | 名称 | 内容 |
|---|---|---|
| 1 | 首页 | 启动项目卡片网格：终端、文件管理、音乐播放器、系统监控等常用入口 |
| 2 | 多媒体 | 音乐/视频/图片/录音相关 |
| 3 | 游戏 | 游戏启动器、手柄测试、ROM 相关 |
| 4 | 设置 | 亮度、音量、Wi-Fi、蓝牙、服务开关、**屏幕超时（never/10s/30s/1m/5m/15m/30m/1h）** |
| 5 | 系统信息 | CPU、内存、存储、网络、内核版本、设备型号 |

### 2.2 顶部状态栏（常驻）

- **左**：Wi-Fi 图标 + 蓝牙图标；Wi-Fi 已连接时在旁边显示本机 IP（如 `192.168.3.57`）；未连接显示 `--`。
- **右**：电量图标（Nerd Font 电池字形，随电量换 `nf-fa-battery_0..4` / `full`）。
- 状态栏要实时刷新，不要每次切屏才更新。

### 2.3 视觉与动效要求（这是本次的核心，不是附加项）

目标是"有质感"，不是"能显示"。具体要做到：

1. **卡片式布局**：每个应用是一张卡片（图标 + 名称 + 一行描述），不是纯文本行。卡片有圆角、边框、选中态高亮。
2. **焦点动画，不是瞬移**：选中框在卡片之间移动时用 `animate()` / `spring()` 做插值，带一点回弹，不要硬跳。
3. **页面切换动画**：左右切屏要有位移/淡入淡出过渡（整屏或整列横移），而不是内容瞬间替换。
4. **入场动画**：进入某一屏时卡片依次淡入/轻微上移，错开几十毫秒，形成节奏感。
5. **状态反馈**：打开应用、切换服务开关、调亮度时，要有短暂的视觉反馈（高亮脉冲、文字提示淡出），不要静默。
6. **信息层级**：标题、副标题、正文用不同字号/粗细/颜色对比拉开层次；选中卡片与其邻居要有明显区分。
7. **性能**：动画跑在 `onFrame` 帧循环里，保持流畅；不要每帧重建整棵树，用 `animate`/`jump`/`createJumpBatch` 或 signal 驱动最小重绘。

配色不要花哨：一个深色背景 + 一到两个强调色 + 灰阶分层，参考主机系统的克制感。禁止彩虹渐变、禁止刺眼纯色块。

### 2.4 必须保留的既有功能（不能因为重写而丢）

- 启动器桥接命令（`globalThis.ui.__launcher`）：
  - `LEVEL\tbrightness` / `LEVEL\tvolume` → 读当前值
  - `CONTROL\tbrightness|<0-100>`、`CONTROL\tvolume|<0-100>`、`CONTROL\twifi|on|off`、`CONTROL\tbluetooth|on|off`
  - `SERVICE\t<key>.enabled` → 切换服务
  - `LAUNCH\t<app-id>` → 启动原生应用
  - `SLEEP\t<never|10s|30s|1m|5m|15m|30m|1h>` → 设置屏幕超时（写入 `/storage/.config/pocketjs/runtime.conf` 的 `[sleep] timeout`）
- 终端工作区（`globalThis.ui.__pocketshell`）：`RESIZE` / `SNAP` / `ACTIVATE` / `KEY` / `TEXT` / `LOG` / `RESET`，以及 5 个 WS（APPS/FILES/VIM/TOP/LOG）的切换与输入注入。
- 输入工作区（F2 / 反引号打开，Esc 退出恢复原视图；L/R 切 ABC/NUM/SYM/PATH；PageUp/Down 切 Keyboard/History/Commands/Phrases/Sessions/Agent；Enter 提交到当前 PTY）。
- 按键映射：方向键移动焦点、A 键（`BTN.CIRCLE`）确认、B 键（`BTN.CROSS`）返回、START 切屏、SELECT 打开输入工作区、L/R 肩键切屏。

## 三、硬性技术约束

1. **不要用 DOM/CSS**。PocketJS 没有 DOM、没有 CSS 引擎、没有 WebView。只能用 `@pocketjs/framework/solid/components` 里的组件（`View`、`Text`、`For`、`Show`、`FocusScope`、`FocusGrid`、`Modal`、`ActionHandler` 等）和 `@pocketjs/framework/animation`（`animate`、`spring`、`jump`、`createJumpBatch`）。
2. **逻辑分辨率 360×240**，2× 放大到 720×480。布局按逻辑像素算，注意溢出。
3. **字体**：`fonts.json` 已配好 Fusion Pixel 12px（主）+ Symbols Nerd Font（图标 fallback）。字号请对齐 12px 像素网格（12 / 24 / 36），不要用非整数字号，否则像素字会糊。图标直接用 Nerd Font 码点（如 `\uf1eb` Wi-Fi、`\uf293` 蓝牙、`\uf240` 电池）。
4. **数据来源**：能读 `/proc`、`/sys` 的地方优先走已有脚本命令（`heya-control`、`rocknix-services`），不要新写特权组件。
5. **不许改别人的东西**：只改 `hello/` 目录下的启动器源码，以及（必要时）`launcher-catalog.ts` 的分类数据。不要动 `tools/`、`scripts/`、`system.d/`、`package.mk` 里的其它包。
6. **必须能通过编译检查**。仓库里有 `bun tools/pocket.ts check ...` 的调用（见 `package.mk`），你自己找到准确的命令并在本地跑通。编译不通过等于没做完。

## 四、交付

1. 重写后的启动器源码（`main.tsx` 为主，可按需拆出 `status-bar.tsx`、`pages/*.tsx` 等模块；拆文件是为了可读，不是为了逃避）。旧的文本网格渲染路径可以保留为降级路径，但默认必须走原生视图。
2. `launcher-catalog.ts` 补充分类与图标字段（不破坏原有 id）。
3. 在分支 `feat/launcher-redesign` 上 commit（中文提交信息可以），不要 push 到 main。
4. 交付时用中文写一段简短说明：改了哪些文件、动画怎么实现的、编译检查的实际输出、还没做完的部分。

## 五、验收（由 Hermes 做，不用你操心，但你要让它可验收）

Hermes 会在 HX90 上编译成 `boot.pocket`、部署到实体 RG34XX，并逐屏截图核对：
- 五屏都能切、每屏内容正确
- 状态栏 Wi-Fi/蓝牙/IP/电量正确
- 焦点移动有平滑动画、切屏有过渡
- 设置页能真正改动亮度/音量/服务/屏幕超时
- 终端工作区和输入工作区没被破坏

所以：**凡是"看起来对但实际没接数据"的地方，会被退回**。开关要真的调 `__launcher`，状态要真的读设备。
