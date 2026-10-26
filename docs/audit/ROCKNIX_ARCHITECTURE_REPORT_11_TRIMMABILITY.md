# 11 · 可裁剪性分析（A / B / C）

> 本文件只做**分类**，不提出重构方案。依据来自 01–10 号文档的事实；标 `[推断]` 的部分为分类判断，不是代码事实。

## 1. 分类口径

| 类别 | 定义 | 判据 |
|---|---|---|
| **A 核心** | 删除会导致系统无法启动、无 UI、无输入/存储/网络基本功能 | 出现在启动链或 `/usr/bin/autostart` 的必经路径 |
| **B 可替换** | 有替代实现，接口（文件/命令行/服务名）可被另一实现满足 | 仓库中存在两套实现或明确的调用契约 |
| **C 可删除** | 不参与启动链，删除后系统仍可正常开机、玩游戏 | 仅被用户主动使用或纯附加功能 |

## 2. A 类：核心系统组件

| 组件 | 为什么是 A | 证据 |
|---|---|---|
| U-Boot + ATF | 唯一引导入口 | 01 · §2.1 |
| Linux kernel + DTB | 硬件与驱动 | 01 · §2.2 |
| busybox initramfs `/init` | 挂载 rootfs、应用 OTA、switch_root | 01 · §2.3 |
| SYSTEM squashfs + `/flash` 分区 | 根文件系统 | 02 · §1 |
| STORAGE ext4 + `fs-resize` | 用户数据与首次扩容 | 02 · §1 |
| systemd + `rocknix.target` | 服务编排 | 01 · §2.4 |
| `userconfig.service` | 首次配置落地 | 01 · §2.4、02 · §4 |
| `rocknix-automount.service` | ROM 存储挂载 | 01 · §2.5、09 · §2.1 |
| `rocknix-autostart.service` + `/usr/bin/autostart` | 启动 UI 的唯一编排 | 01 · §2.5 |
| `UI_SERVICE`（sway + essway 或 weston + emustation） | 显示与前端入口 | 01 · §2.6 |
| `seatd` | Wayland 会话 | 09 · §2.2 |
| `input.service`（`input_sense`） | 电源/音量/合盖 | 06 · §4.4 |
| `powerstate` + `batteryplus` | 电源与电量策略 | 09 · §2.4 |
| `NetworkManager` + `iwd` | Wi-Fi | 09 · §2.5 |
| `pipewire`/`wireplumber`（或 pulseaudio） | 音频 | 09 · §2.5 |
| `rocknix-memory-manager` + `systemd-oomd` | 低内存稳定性 | 09 · §2.6 |

## 3. B 类：可替换组件

| 组件 | 现有实现 | 可替换为 | 契约/证据 |
|---|---|---|---|
| 前端 | EmulationStation | 任意实现 `es_systems` + `runemu.sh` 的前端 | 04 · §7、05 · §2 |
| 合成器 | Sway | Weston（仓库保留 `emustation.service` 路径） | `H700/options:55`、`emustation.service` |
| 网络管理 | NetworkManager | connman（仓库保留单元） | `packages/network/connman/system.d/` |
| 音频 | pipewire | pulseaudio | 09 · §2.5 |
| 系统按键守护 | `input_sense` | 自写 evdev 守护 | 06 · §4.4 |
| 启动编排 | `/usr/bin/autostart` | 自写脚本 | 01 · §2.5 |
| OTA 客户端 | `rocknix-update` | 自建客户端（需兼容 `.tar` 结构） | 10 · §6 |
| 按键映射层 | `gptokeyb` + `inputfilter` | 自写映射层 | 06 · §4.3 |
| 主题 | art-book-next | 任意 ES 主题 / 新前端主题 | 07 · §1 |
| 存储挂载策略 | `automount` bind/overlay | 自写挂载逻辑 | 02 · §2 |

## 4. C 类：可删除组件

| 组件 | 说明 | 证据 |
|---|---|---|
| `adbd` | 调试用，本 fork 新增 | `H700/options:72`、09 · §2.6 |
| `entware` | 可选 opkg 生态 | 08 · §4 |
| `samba`/`nmbd`/`smbd` | 默认未启用（`SAMBA_SUPPORT=no`） | `distributions/ROCKNIX/options:81` |
| `syncthing` / `rclone` | 同步工具，非核心 | `PKG_SYNC` |
| `tailscale` / `zerotier` / `wireguard` | VPN/组网 | `virtual/network/package.mk` |
| `docker` | 默认关闭 | `CONTAINER_SUPPORT:-no` |
| `cron` | 可选定时任务 | `enable_service cron.service` 条件块 |
| `simple-http-server` | 可选调试服务 | `SIMPLE_HTTP_SERVER` |
| `kodi` | ES 构建已 `DISABLE_KODI=1`，包仍在树中 | `emulationstation/package.mk:19` |
| 未使用的模拟器/核心 | 见 §5 数量 | `virtual/emulators/package.mk` |
| 主题多余 artwork 变体 | 构建时已删除 | 07 · §2 |

## 5. 模拟器规模（裁剪的主要体积来源）

`[事实]`：

| 项 | 数量 | 来源 |
|---|---:|---|
| 系统定义（`config/emulators/*.conf`） | 139 | `ls config/emulators/*.conf` |
| RetroArch 核心（基础列表） | 125 | `LIBRETRO_CORES`（`virtual/emulators/package.mk:18-30`） |
| 独立模拟器（基础列表） | 17 | `PKG_EMUS`（`:11-12`） |
| aarch64 追加 | `duckstation-lr`、`flycast2021-lr`、`ppsspp-lr`、`box64`、`dsperate-sa`、`portmaster` | `:32-36` |

`[推断]` 对“只玩某几类主机”的自建发行版，模拟器/核心是最大的一块可裁剪体积；但裁剪必须同步 `es_features.cfg`、`es_systems.cfg` 与 `config/emulators/*.conf`，否则菜单会残留不可用项（03 · §4、04 · §3）。

## 6. 子系统矩阵

| 子系统 | 保留（A） | 替换（B） | 删除（C） |
|---|---|---|---|
| 引导 | U-Boot、kernel、DTB、initramfs | — | — |
| 文件系统 | squashfs SYSTEM、ext4 STORAGE、`/var` tmpfs | 挂载策略（bind/overlay） | — |
| 构建 | `scripts/*`、`package.mk`、元包 | — | 未使用的包定义 |
| 前端 | 启动链（systemd 服务 + `UI_SERVICE`） | EmulationStation | — |
| 启动游戏 | `runemu.sh` 契约 | 前端侧命令生成 | 未使用模拟器 |
| 输入 | 内核驱动、evdev、SDL2/RetroArch 读取 | `input_sense`、`gptokeyb` | — |
| 主题 | 主题目录结构 | 具体主题 | 多余 artwork |
| 应用扩展 | Ports/Tools 目录扫描 | PortMaster | 第三方 ports |
| 服务 | 见 09 · A 类 | 网络/音频/合成器 | 见 09 · C 类 |
| OTA | `.tar` + initramfs 应用 | `rocknix-update` 客户端 | — |

## 7. 裁剪风险（基于事实）

1. `[事实]` 删包必须重构建 + 整包 OTA；没有运行时卸载（03 · §7）。
2. `[事实]` `es_systems.cfg`/`es_features.cfg` 是构建产物且软链到只读 `/usr/config`，手改不持久（02 · §4）。
3. `[事实]` 无 A/B 分区，OTA 失败无法自动回滚（10 · §5）。
4. `[推断]` 删除 `input_sense`/`powerstate` 不会导致无法开机，但会失去电源键、音量键、电量策略——属于“能开机但不好用”，分类上仍应视为 A。
5. `[待验证]` 实际镜像体积与各包占用未测量；需要一次完整构建后用 `du` 统计，才能给出“删了能省多少”的数字。

## 8. 最终回答（对应 issue 的问题）

> “如果我要把 Rocknix 改造成完全属于自己的发行版，我到底需要保留什么、替换什么、删除什么。”

**保留（A）**：U-Boot/kernel/DTB、busybox initramfs、squashfs+ext4 分区模型、systemd + `rocknix.target`、`userconfig`/`automount`/`autostart` 启动编排、`UI_SERVICE` 入口、`seatd`、`input_sense`、`powerstate`/`batteryplus`、NetworkManager+iwd、pipewire、memory-manager/oomd。

**替换（B）**：EmulationStation（前端）、Sway（可选 Weston）、`rocknix-update`（OTA 客户端）、`input_sense`/`gptokeyb`（可选自写）、主题（可选）。

**删除（C）**：adbd、entware、samba、syncthing/rclone、tailscale/zerotier/wireguard、docker、cron、simple-http-server、kodi、未使用的模拟器/核心、多余主题 artwork。

**不能只删不改的耦合点**：模拟器清单 ↔ `es_features.cfg`/`es_systems.cfg`/`config/emulators/*.conf`；主题 ↔ ES 主题 schema；OTA ↔ `.tar` 结构与 `canupdate.sh`。

以上结论均可在 01–10 号文档中找到对应证据；`[推断]` 项已单独标注。
