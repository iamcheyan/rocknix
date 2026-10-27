# CPR #77：PocketJS Runtime 调查

调查日期：2026-10-27。范围：只读调查，没有改动任何产品代码。ROCKNIX 依据 `origin/heya-core-minimal`（调查时 SHA `f686afd47991c4403c480c33e37c6fce48dc751b`）；本报告所在工作分支以含已推送 CPR75/69 历史的 `68e0166446c7ebbb21f7062ffa8fa49a79b11723` 为基础。PocketJS 精确源码依据 GitHub `main` HEAD `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f`（2026-10-26），并检查 v0.15.0 tag `96e5f4084c2da45d72997c443fd478bcffb92dc7`。网站 `https://pocketjs.dev/` 实际跳转/展示 PocketJS 官方站；源码 README 的规范站点是 `https://pocketjs.pocket.nexus/`。

## PocketJS Runtime 与平台

PocketJS 不是 WebView：`README.md` 描述 TypeScript Solid/Vue Vapor/Octane adapter、QuickJS guest 与 Rust UI core 同进程、单线程内运行。core 做 retained native tree、flexbox、baked style、draw list；Rust CPU raster 提交到 platform display。关键实现：`programs/linux-kms/src/main.rs`、`programs/linux-kms/Cargo.toml`、`engine/runtime/Cargo.toml`、`engine/core/Cargo.toml`、`engine/guest-rquickjs/Cargo.toml`、`platforms/linux/{drm,fbdev,evdev}/`。

- **QuickJS**：该 Linux program 依赖 `pocket-guest-rquickjs`（Cargo 中 rquickjs 0.12），加载官方 `.pocket` 包并在 guest 生命周期中运行 JS；不是系统级 `qjs` 命令或独立 QuickJS daemon。Rust core 与 guest binding 同进程组合。
- **Linux / ARM64**：`programs/linux-kms/pocket.runtime-config.ts` 明列 build hosts `linux-arm64`、`linux-x64`；Buildroot 集成说明 `tools/packaging/buildroot/README.md` 支持 little-endian ARM/AArch64、x86、MMU 与 threads。属于源码和构建配置支持，不等同 ROCKNIX H700 交叉编译/实机验证。
- **显示**：`programs/linux-kms` 首先打开 DRM/KMS (`platforms/linux/drm`)，失败后尝试 fbdev (`platforms/linux/fbdev`)；DRM 需要可用 connector/mode 与 profile 物理分辨率匹配，fbdev 有格式、stride、viewport 限制且 timer paced。Wayland compositor/window surface 不是此 program backend；仓库 desktop program 是独立 winit/wgpu host，不能据此声称 linux-kms 可作为 Wayland client。ROCKNIX H700 目前 options 是 `DISPLAYSERVER="wl"`、`WINDOWMANAGER="swaywm-env"`，因此抢占 DRM/KMS/fbdev 与 Sway 同时控制显示可能冲突。H700 适配必须先决定通过 Sway/Wayland 接入，或将 runtime 作为独占前台并受控暂停 Sway；现有 KMS/fbdev program 无 Wayland 路径。
- **输入**：`platforms/linux/evdev` 支持 evdev buttons/gamepad、pointer、touch；README 明确不宣称 analog sticks、text/IME、motion sensors、scroll。H700 gamepad 的 evdev 可用性、权限及按钮映射仍需实机核验。
- **SDL / OpenGL / Vulkan**：Linux KMS program 的 Cargo 依赖没有 SDL、OpenGL 或 Vulkan；显示由软件 raster + DRM/fbdev 提交。desktop Cargo 使用 wgpu/winit，但不代表 Linux KMS runtime 需要 GPU。不能把本仓库 `programs/desktop` 的依赖套到 H700 KMS backend。
- **静态构建**：源码有 Rust release 配置及 Buildroot `cargo-package` 适配，但没有证据证明 H700 完全静态链接。Buildroot 适配说明要求 Buildroot 2026.08 或 Rust >=1.93，并执行 `cargo-post-process` vendor 锁定依赖，避免构建时在线拉包；ROCKNIX 基线 `packages/rust/rust/package.mk` 此时用 Rust 1.97.1，版本门槛满足，但其 `cargo` 配置、系统库、目标 linker、Cargo vendor 输入与该上游 Buildroot adapter 不同。静态/动态链接结果应由实际 target build 与 `readelf`/`ldd` 核验。
- **体积**：上游 README 的“8 MB”是 PSP 上完整运行应用的内存占用陈述，不是 H700 binary/安装包大小。desktop 过往 M3 Max 实测磁盘 10 MB、RSS 83 MB（历史 gpui host），也不是 Linux KMS 结果。H700 binary、framework assets、rootfs 增量当前未测。`tools/packaging/buildroot` 描述需要携带完整 workspace source closure 与 Cargo vendored archive，开发期源码体积与 target runtime 体积需分开量。
- **内存**：Linux KMS program 明确 runtime JS heap limit 为 32 MiB，framebuffer budget 上限由 viewport×8 bytes 计算，最大 256 MiB；这是显式配置/防护上限，不是 RSS、最低内存或实际分配量。RSS、冷启动时间、具体 H700 分辨率下 framebuffer 分配和运行峰值均未测。Buildroot README 中“不会替代真机 DRM/fbdev/input/audio 验证”同样适用。
- **许可证**：精确 HEAD 根 `LICENSE` 为 MIT，README 也标 PocketJS/MicroTS MIT；集成时应保留上游 LICENSE 与版权信息。上游同时含 Pocket3D 等不同许可资产，不能将非 runtime 内容顺带打包。v0.15.0 tag 的提交与当时 main HEAD 不同；应选定并固定 release/revision 与 source archive SHA，而非使用浮动 main 或杜撰 hash。

## ROCKNIX 位置与 H700 兼容性

调查基线的真实结构：`projects/ROCKNIX/packages/` 下按 `apps`、`graphics`、`rust`、`wayland`、`virtual` 等分类；项目包需放这里（仓库 `AGENTS.md` 禁止改顶层 `packages/` 的 `package.mk`）。Rust 系统包例子：`projects/ROCKNIX/packages/emulators/standalone/touchhle-sa/package.mk`、`projects/ROCKNIX/packages/graphics/librashader/package.mk`；应用 recipe 例子 `projects/ROCKNIX/packages/apps/heya/package.mk`。`projects/ROCKNIX/packages/virtual/image/package.mk` 组装基础镜像，迷你镜像通过 device `ADDITIONAL_PACKAGES` 额外纳入应用。`projects/ROCKNIX/devices/H700/options` 是设备架构与包集覆盖处；`distributions/ROCKNIX/options` 提供 distro 默认值，但 H700 覆盖值必须按加载顺序核查。

PocketJS 是供多应用复用的系统 UI Runtime，合适做 `projects/ROCKNIX/packages/ui/pocketjs`（新 `ui` category）或 `projects/ROCKNIX/packages/graphics/pocketjs` 的 project-wide package，再由 H700 `ADDITIONAL_PACKAGES` 启用；不应放 `apps/` 并伪装为普通 app。分类可借鉴 `wayland`/`graphics` 分层，但是否新设 `ui` 最终应遵循目录语义和 package index 约定。分层装载路径建议：执行文件 `/usr/bin/pocket-linux-kms` 或统一 `/usr/bin/pocket`；runtime 私有库若有则 `/usr/lib/pocketjs/`；只读 framework/system assets `/usr/share/pocketjs/`；可变 app/package 与状态放 `/storage/heya/apps/<id>/`、`/storage/heya/data/<id>/`，不可将可变数据写入只读 system squashfs。PROFILE 应编译进 runtime，不安装为运行时配置文件（上游 Linux program 设计如此）。

H700 是 Allwinner H700 Cortex-A53/AArch64 little-endian，当前选 Panfrost、G31、优先 GLES、Wayland + sway 环境，镜像压缩与低存储空间敏感；ROCKNIX 的 Rust 版本为 1.97.1。软件 raster 可避开 GLES/Vulkan 驱动和 SDL 依赖，但 KMS backend 会与 Wayland compositor争显示所有权；fbdev 是否启用/能否并行访问亦未知。还需核对 kernel DRM dumb buffer、fbdev 像素布局、设备权限、H700 默认物理分辨率/旋转、休眠恢复和系统服务切换。官方上游 Buildroot adapter 要求 Rust >=1.93，满足版本数字条件，但不能直接作为 ROCKNIX recipe：其 profile export、release archive 校验、cargo vendoring、target install/init hooks 和 Buildroot variable 必须移植并按 ROCKNIX 构建体系适配。

## heya launcher / manifest

ROCKNIX pin `projects/ROCKNIX/packages/apps/heya/package.mk` 当前固定 heya commit `bca7c0510ac6c857b55c9532b9165dd332b8477c` 与 archive SHA，使用 Go ARM64 + SDL2/SDL2_ttf 编译。安装 heya 可执行文件、`/usr/share/heya/assets`、`themes/default`、systemd unit 与 app seeder。launcher源码 `cmd/heya/main.go`、`internal/ui/`、`internal/input/input.go`、`internal/launcher/launcher.go`、`internal/registry/registry.go`；manifest 规则 `docs/application-manifest-spec.md`。应用目录 `/storage/heya/apps/<id>/app.json`，launcher seeder 把系统内置 `/usr/share/heya/apps/*/app.json` 初次复制到可写存储。manifest 使用 absolute `entrypoint`/兼容 `exec` 与 argv 参数；launcher停止自身画面，直接启动子进程，退出后重新打开 UI。Theme 在 `/storage/heya/themes/theme.json`，默认值和字体 assets 由 heya 初始化。

未来把 heya 的 SDL UI 换成 PocketJS 时：

- **Theme**：颜色/组件 tokens 可迁移为 PocketJS theme/profile asset，但 JSON schema 不兼容，需显式转换器或新版本；字体资源可复用需验证 PocketJS 字体格式/打包契约。
- **App Catalog / Registry**：稳定 app ID、名称、分类、安装位置等语义可留；manifest 执行字段需演进为 runtime 类型/包路径/能力 profile，现有可执行文件 app 要继续兼容。
- **Launcher**：菜单、排序、收藏、设置状态机与 app discovery 可保留为 provider/model；SDL rendering/input event loop 不能直接留作新的 PocketJS UI。
- **Input Layer**：抽象动作（confirm/back/dpad/shoulder）可留；SDL 事件采集/映射需要连接 evdev/PocketJS input，且 analog 支持要补证。
- **Platform Layer**：服务控制、持久化目录、升级迁移等 OS integration 可留；SDL window/context、renderer 和进程管理生命周期需要重新设计/桥接。

## 阶段一结论

源码证实 PocketJS 已有 Linux ARM64 native runtime 和 KMS/fbdev/evdev backend，原则上可作为内置 UI runtime；当前最主要适配风险是它提供独占 KMS/fbdev 的前台程序，而 H700 基线运行 Wayland/Sway。这不是已证明可工作的当前 ROCKNIX UI host。上游 README 提供 Buildroot release preparation recipe，具体解决了 Cargo offline vendoring 和 profile ABI pinning 的方法，但 ROCKNIX recipe 移植仍需构建验证。所有 H700 的 binary size、runtime RSS、启动时间、屏幕显示、手柄与 heya 生命周期结论均未测。调查尚未改变 ROCKNIX 产品代码。