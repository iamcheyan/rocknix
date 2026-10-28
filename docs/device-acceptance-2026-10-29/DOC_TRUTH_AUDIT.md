# DOC_TRUTH_AUDIT — 文档 vs 实现 逐条核对（J3 + J4）

- 时间：2026-10-29
- 方法：读代码 `tools/pocketshell-dev/src/main.rs`、`tools/pocketshell-mirror/{server.py,capture.c}`，对照 `README.md` / `REMOTE_DEV.md` 原文；以实机 `curl` 佐证。

## 一、三种"镜像"的真实状态（严禁混为一谈）

| 通道 | 状态 | 证据（code file:line / 实测） |
|---|---|---|
| WS 消息 `frame_mirror` | **stub（仅状态应答）** | `main.rs:535`：收到 `FrameMirror` 恒回 `frame_mirror_status{enabled:false, reason:"DRM capture backend unavailable in this build"}`，不推帧 |
| HTTP `GET /device/frame.rgb` | **已实现** | `main.rs:269-284`：执行 `/storage/pocketshell-dev/capture`，取 PPM `P6\n720 480\n255\n` 之后字节返回；实测 1,036,800 字节（本报告 B1） |
| HTTP `POST /device/key` | **已实现** | `main.rs:285-300`：`capture key <event> <code>` 注入 gamepad |
| `tools/pocketshell-mirror`（JPEG 中继） | **独立工具，已实现** | `server.py` + `capture.c`；实测 `/frame.jpg`=720×480 JPEG、`/key/START` ok（本报告 H1） |

## 二、文档原文 → 代码事实 → 处理

### `tools/pocketshell-dev/README.md`
- 原文（§Frame mirror）：“The host harness reports capture unavailable; no H700 frame capture is claimed or bundled.”
  - 事实：`/device/frame.rgb` 已实现（`main.rs:269`），H700 抓帧可用（B1 实测）。
  - **已改**：改为说明 `/device/frame.rgb`、`/device/key` 已实现，WS `frame_mirror` 仍是 stub，mirror 是独立 JPEG 中继。
- 原文（§Known differences）：“Frame mirror capture is not implemented in this host build; only the protocol status response exists.”
  - **已改**：改为“`/device/frame.rgb` 与 `/device/key` 已在设备宿主实现；WS `frame_mirror` 仍为 status stub（不推帧）”。

### `tools/pocketshell-dev/REMOTE_DEV.md`
- 原文（line 54）：“The host harness implements only the protocol/status response and reports capture unavailable; it does not produce image frames. … No H700 frame capture is claimed.”
  - 事实：与同文件 line 56-87（已记录 `/device/frame.rgb` 返回 1,036,800 字节、`/device/key` 注入、已实机验证）**自相矛盾**。
  - **已改**：line 54 明确区分 (a) WS `frame_mirror` stub / (b) HTTP `/device/frame.rgb`+`/device/key` 已实现 / (c) mirror 独立 JPEG 中继；删除“No H700 frame capture is claimed”。

> 未改的保留（属实，非矛盾）：`README.md` line 36-38“shows the active LCD scanout and forwards controls”本就正确，保留。

## 三、J4 独立判断：是否复用 helper / 硬编码 / 恢复

### ① 是否复用现有 helper（而不是另写一套）
- 是。`capture.c` 是唯一采集/注入 helper；`server.py` 与 `main.rs` 都调用 `/storage/pocketshell-dev/capture`（采集 + `key` 注入）。未发现重复实现。

### ② event 设备路径 `event3` 硬编码 —— **脆弱，已修**
- 原状：`main.rs:297` 硬编码 `/dev/input/event3`；`server.py` 原 do_POST 硬编码 `/dev/input/event3`。设备重启后事件编号可能变化 → 注入失效。
- 实测设备：`event3 -> "H700 Gamepad"`（当前正确），但编号不保证稳定。
- **修复**：
  - `server.py`：新增 `probe()`，按 `/sys/class/input/event*/device/name` 含 `Gamepad` 动态定位，失败回退 `event3`；每次失败 `invalidate_probe()` 重新探测。
  - `main.rs`：新增 `fn gamepad_event()` 同样按名探测，`/device/key` 使用它，回退 `event3`。
  - **server.py 已实机验证**：`/status{sequence:12,error:""}`、`/frame.jpg` 720×480、`/key/START`→`ok`；探测输出 `EV=/dev/input/event3`。
  - **main.rs 已验证编译**：`cargo check --offline` 通过（rc=0）；设备二进制需重建后才生效（见下）。

### ③ DRM `card1` 硬编码 —— **脆弱，已修**
- 原状：`capture.c:28` 默认 `/dev/dri/card1`；`main.rs` `/device/frame.rgb` 调 capture 不带卡号。
- 实测：`card1-DSI-1 connected`（LCD 在 card1），但卡号可能变化。
- **修复**：`capture.c` 改为：无参数时遍历 `/dev/dri/card0..9`，取第一个有可读 XRGB/ARGB plane 的卡；有参数则用之。`gcc -fsyntax-only -I/usr/include/libdrm` 通过（rc=0）。
  - `server.py` 另加卡探测（`/sys/class/drm/card[0-9]` 有 connected 连接器者），并把卡号传给 capture；**已实机验证** `CARD=/dev/dri/card1`。

### ④ 服务崩溃 / 设备重连后是否自动恢复
- `pocketshell-dev.service`：`Restart`（镜像内 unit）负责进程级重启。
- `server.py`：采集线程每 ~0.4s 重试，异常时 `invalidate_probe()` 并重探；设备重连/重启后下一轮自动恢复。
- `capture.c`：每次调用独立，无状态，设备重连后自然可用。

## 四、验证状态（严格区分）
- **已实机验证**：server.py 动态探测 + JPEG 抓帧 + key 注入（H1 复测）。
- **已编译验证、设备待重建**：main.rs（cargo check 通过）、capture.c（gcc -fsyntax-only 通过）。设备当前运行 `/storage/pocketshell-dev.new` 为旧二进制，需 H700 重编后重新部署（后台构建进行中）；不把"代码已改"当成"设备已生效"。
