# CPR #77：PocketJS Runtime 架构设计

状态：阶段二设计；以调查报告 `CPR77_POCKETJS_INVESTIGATION.md` 为依据。当前不包含 runtime package 实现，也不改变 heya、provider 或 app manifest。

## 目标边界与推荐决策

将 PocketJS 作为 ROCKNIX 的系统级 UI runtime 能力：安装一次 native runtime 与共享 framework assets，由多个 PocketJS app package 复用；app 是以 PocketJS package format 发布的 UI 内容，不是为每个 app 各装一份 QuickJS/runtime。初始 runtime 采用上游现有 Linux KMS/fbdev program（`programs/linux-kms`），其 profile 与 `.pocket` ABI 必须在构建期匹配。ROCKNIX package manager 将 runtime 列入 H700 rootfs；不把 PocketJS 本身做成 heya app。

**推荐关系：heya 暂作 PocketJS 的消费者/启动入口，长期保留为迁移目标。** 当下不改 heya 核心，也不假定当前 launcher 已能运行 `.pocket`。先用一个 heya-compatible manifest 启动系统级 runtime，并向 runtime 传入 app package 路径；此启动需要配套集成 glue/package。随后以独立阶段把 heya 的视图逐页迁移至 PocketJS，再决定保留其 catalog/input/platform provider，或改为轻量 app shell。此顺序能提供系统已有 UI 的回退路径，并避免 runtime 被误当单一 demo。

| 方案 | 优点 | 成本/风险 | 结论 |
|---|---|---|---|
| A. heya 是 PocketJS consumer | 沿用 heya app catalog、启动入口与用户数据位置；PocketJS apps 可并存于现有 native apps | 当前 heya manifest 启动语义未定义 runtime package 参数传递，需新增 manifest/runtime adapter；heya UI 本身仍 SDL | **推荐作为过渡集成关系**；先补显式 launcher contract，不碰核心/provider |
| B. heya 是 PocketJS host | 一个常驻 heya 进程复用 Runtime 实例，切换多个 app 时减少进程启动开销 | 要把 Rust core/QuickJS ABI 嵌入 Go/SDL，建立跨语言 FFI、surface/input/context/故障恢复协议；绑定上游 internals，耦合最高 | 当前不采用。只有上游稳定 host ABI 且多个 app 需要同进程生命周期后再评估 |
| C. heya 是未来迁移目标 | PocketJS 直接承载 launcher/settings/tool UI，最终减少 SDL UI | 单独作为当前集成策略没有 app 生命周期/回退方案；必须逐模块移植 UI、输入和主题 | 作为路线图目标，非当前 runtime 集成机制 |

A 与 C 可组合：A 给既有 UI 保持入口，C 逐步替换既有界面。B 是另一种进程架构，不建议和 A/C 混用。

## Runtime 与 assets 布局

建议 system package 布局：

```text
/usr/bin/pocket                 # 稳定产品命令/兼容 shim（调用已编译的 Linux host）
/usr/libexec/pocket-linux-kms   # 上游 Linux KMS/fbdev host binary
/usr/lib/pocketjs/              # 如将来拆出共享 native libraries
/usr/share/pocketjs/
  runtime.json                  # 只读构建身份、runtime revision/profile ABI
  profiles/h700.json            # build input/诊断信息；runtime profile 主体仍编译进 binary
  framework/                    # 随所选 release 发布、可复用的静态 API/resource assets
  fonts/                         # 明确采用并授权的共享字体（如 runtime 必需）
  LICENSES/                      # 上游 LICENSE 及 asset 许可证
/storage/pocketjs/apps/<id>/     # 持久 app package 与 manifest / 用户安装内容
/storage/pocketjs/data/<id>/     # app 持久数据
/storage/pocketjs/cache/<id>/    # 可删除缓存
/storage/pocketjs/logs/<id>/     # 有界运行日志
```

上游 `linux-kms` README 目前以 `/usr/bin/pocket-linux-kms` 运行，默认包路径 `/usr/share/pocketjs/app.pocket`；Buildroot adapter 也把 `.pocket` 安装在那里。本设计针对多 app 改为显式 `--package <path>` 参数，避免单一默认 demo。`/usr/bin/pocket` 可由 ROCKNIX package 提供简短稳定 CLI；实际入口名称/参数须以 pin 的上游 CLI 核验。应用与状态置于持久 `/storage`，而 runtime/framework 属于升级管理的 system partition。system package 不复制业务示例作为默认 app。

具体 framework assets 必须以选定 release 的 app compiler package manifest/source inputs 为准。runtime Rust host 若将生成 binding 编入 binary，应只安装被多个 app 共享的静态字体/标准资源、运行时元数据与许可证，不任意拷贝仓库 `framework/`、`assets/` 或 Pocket3D 大文件。调查发现上游 release archive prep 工具要求精确 release index、source archive size/SHA256 并 vendor Cargo closure；实现应采用这个可验证源，不手写猜测的 PKG_URL/hash。

## 创建、构建、打包和部署体验

开发工具保持在开发机/SDK，不放进目标 rootfs：

```sh
# 开发机：以与设备 runtime 对应的 pinned PocketJS CLI/toolchain 创建
pocket create hello-pocketjs
cd hello-pocketjs
pocket check --target rocknix-h700
pocket compile --manifest pocket.json --runtime-config <rocknix-h700-runtime-config> --output dist/hello.pocket

# 开发机：打包成独立应用目录/归档，校验 id、profile hash、ABI 与文件路径
pocket package dist/hello.pocket --manifest pocket.json --output dist/hello-pocketjs.tar

# 部署：SSH/SFTP 或 ROCKNIX 开发传输工具写入持久 storage，再经 launcher 启动
scp dist/hello-pocketjs.tar root@<device>:/storage/pocketjs/incoming/
ssh root@<device> pocket install /storage/pocketjs/incoming/hello-pocketjs.tar
```

命令中的 `pocket package`、`pocket install` 是期望的 ROCKNIX 产品体验，不是调查时已确认的上游 CLI 命令；具体 CLI 子命令、manifest schema 和打包格式需在实现阶段对 pinned release 验证，若上游不提供则由 ROCKNIX SDK/helper 实现。不得把拟议命令写成已有接口。建议最终提供 `pocket create/build/package/deploy` 开发机工具和设备端 `pocket list/install/remove/launch`，让应用开发者不必接触 Cargo、profile hash 或 Buildroot。

系统应用包（如设置应用、工具应用）由 ROCKNIX package recipe 安装到 `/usr/share/pocketjs/apps/<id>/`，启动时发现 system 与 user apps；用户安装到 `/storage/pocketjs/apps/<id>/`。优先 ID 稳定、每 app 独立目录。无签名/校验的任意 JS app 与现有 heya executable 一样以设备用户权限运行；manifest capability 不能当沙箱。后续若引入签名、权限沙箱，必须单独定义威胁模型和升级策略。

## App 发现和生命周期

1. **安装/升级**：解包前校验 package 路径无 traversal、manifest/schema/runtime ABI/profile hash、唯一 app ID、大小上限与文件权限；写入临时目录，原子 rename 到 `<apps>/<id>`。保留 `/storage/pocketjs/data/<id>`；升级失败恢复旧目录。早期最小集成可暂不做安装器，但须先定义 app package 确切 schema，避免把 `/usr/share/pocketjs/app.pocket` 固定为全系统唯一 app。
2. **发现**：枚举只读系统 `/usr/share/pocketjs/apps/*/app.json` 与持久 `/storage/pocketjs/apps/*/app.json`。user app 可覆盖同 ID system app（仅在明确升级/覆盖规则下）；重复、未知 schema 或 ABI 不匹配的 app 隔离并记录原因，不阻塞 catalog。
3. **启动**：launcher 以直接 argv（不经 shell）执行 runtime，输入 app package 绝对路径及必要选项；记录 PID/session。PocketJS 按编译 profile 和 package 中 ABI/profile 声明拒绝不匹配包。桌面会话由 runtime host 获取；display/input 设备不能由多个 runtime 同时抢占。
4. **运行**：一个前台 PocketJS app 一个 runtime 进程。先满足简单单前台生命周期；后台 app、热切换、驻留 QuickJS、多窗口都不在本次范围。runtime 管理 QuickJS guest、Rust core、输入帧和绘制。
5. **退出/异常**：SIGINT/SIGTERM 或用户 Back/Exit 触发 guest shutdown、提交/关闭 display、释放 input；子进程结束后 launcher 重新呈现。崩溃/不兼容 app 返回原 launcher 并记日志；需确认 Linux KMS host 的 signal/teardown 行为、Sway 恢复方式和按键退出实现后才可承诺。
6. **数据**：app 数据、cache、logs 与系统包分离；应用 manifest 的用户可写字段、数据迁移暂不沿用 heya manifest 原样，需版本化转换层。日志大小与保留上限待定义。

## H700 显示宿主决策门

上游当前可用 Linux program 是 DRM/KMS 优先、fbdev fallback，并非 Wayland client；H700 ROCKNIX 当前启动 Sway。运行前必须选择且验证一个 host strategy：

- **推荐第一阶段验证：前台独占显示 host**。通过系统 service/launcher adapter 有序停止或暂停 Sway，检查 KMS connector 及权限，PocketJS 退出时恢复 Sway/heya。这是已有上游接口路径，仍需在 H700 验证设备节点权限、显示 mode、旋转、resume 和 clean teardown。
- 若保持 Sway 常驻，则先实现/采用明确的 Wayland host backend；不能从 desktop winit/wgpu 或 Sway 存在推断 KMS binary 具备 Wayland 支持。应作为后续技术阶段单独审查，不虚构为本次已集成能力。
- fbdev 只作 DRM 不可用时的备选，并需确认该 kernel 节点、像素格式、stride、旋转与 framebuffer 冲突；不得把它描述成 Wayland surface。

输入配置用 evdev 的 button/action contract 与 H700 gamepad 做映射验收。上游当前 Linux README 不保证 analog stick、文本输入或 IME；基线 UI 若依赖这些能力，必须列入后续扩展而不能静默宣称兼容。

## 分期路线图

1. **当前最小集成**：固定上游可复现 release/revision/源 archive SHA；构建 package recipe 和必要 profile export/asset install；runtime 进入 H700 rootfs；不修改 heya 核心/provider，不引入 app UI；以 compile/rootfs/package test 验证。
2. **Runtime host 接受**：在 H700 image 启动 Hello PocketJS；检查 KMS 或明确 backend、evdev gamepad、Back/退出、切回 heya；记录冷启动、峰值 RSS、system partition 增量。
3. **开发者闭环**：为 H700 pinned runtime 建立 `pocket create → build → package → deploy → launcher start → exit` 文档与脚手架；验证 profile ABI 错配、损坏包及重复 app ID 的错误处理。
4. **Launcher 兼容桥**：新增 manifest/runtime type 或 adapter，由 heya catalog 调起 PocketJS app；旧 native app 仍保持原路径；与 upstream heya manifest owner 协调，不修改 provider 抽象。
5. **UI 逐步迁移**：先开发独立 Settings/tools app，再视验证结果迁移 heya UI 层。映射可复用 Theme tokens、app ID/catalog model、抽象 Input Actions、服务/持久化 Platform services；SDL rendering/input event loop 与 Go UI widgets 不作为 PocketJS runtime 资产直接复用。
6. **默认开发路径评估**：多 app、升级/回滚、ABI 兼容、恢复与内存预算稳定后，才评估将 PocketJS app 作为新 UI 默认路径，并决定 heya 保留为 launcher、变为 host 或逐渐退场。

## 尚未验证

没有 H700 实机验收或本分支 rootfs 集成结果。完整 H700 image、KMS/fbdev 首帧、Hello World 像素显示、手柄映射、退出返回 heya、启动时延、RSS、最终 image 增量和 host→device 开发闭环都必须留待实际运行测量。构建 package 不等于产品体验已验收。
