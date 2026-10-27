# 2026-10-27 工作盘点与本地整合

日期按 Asia/Tokyo。原始盘点：12 个本地分支、11 个 worktree，4 个 worktree 有未提交内容；今天可达历史中有 15 个原始提交。未提交内容只能按内容归类，不能仅凭 Git 断定全部写于今天。

## 今天的工作

| 工作 | 记录与结果 | 验收边界 |
|---|---|---|
| H700 DDR4 构建收敛 | a064b1318d、b999540765、44e2aa5ab2：解释双镜像来源、只输出 DDR4 镜像、移除未使用的 DDR3 bootloader 包 | RG34XX 使用 DDR4；不表示本次已重新构建/刷写 |
| 平台审计 | 37bf5b891e：平台结构与现状审计 | 文档与代码分析 |
| 桌面运行环境 | cf907a7a64、68e0166446：可行性分析、真实 x86_64 rootfs 的容器运行脚手架、GUI 选择、验证报告 | 不模拟 H700 硬件；XMPlayer 内置 ARM64 二进制仍不能在 x86_64 运行 |
| 开发覆盖模式 | e441421b32、f686afd479：devexec 和可选 developer image 配置、交付记录 | 默认关闭；不代表所有应用已支持热替换 |
| PocketJS 调研与架构 | 4a52e69290、e81b402864、1396a0594b：源码调查、集成方案和阻塞项 | 尚未替代 heya/Sway 启动链 |
| PocketJS KMS 原型 | 0426f6bb5d、a1e3a50422：H700 配方草稿、profile、session、服务和脚本权限 | 通用 ARM64 交叉编译有记录，ROCKNIX sysroot/镜像集成未验收 |
| PocketJS Hello | e0ffe24bf8、b9bc05ff7b：修复应用别名和按钮常量的补丁、编译与运行记录 | 记录显示 Hello 编译及宿主机 headless 五帧生命周期通过；H700 显示、按键、退出恢复未验收 |

## 当前主 worktree 尚未提交的工作

整合前有 38 个已跟踪文件修改、26 个未跟踪文件，共 64 个路径，均已纳入整合分支的工作区快照。

- 服务：统一 rocknix-services 与九项 *.enabled 开关，开机启动、升级补缺键、FTP/rsync/telnet 服务配方和 unit。
- heya 应用：Disk 文件浏览器、Terminal、服务设置，以及移除 Sonata 的默认应用和包集合。
- USB/网络：ADB TCP/USB 处理、MTP 暴露 /storage、HTTP 配方与默认 Wi-Fi 相关记录。
- 电源和媒体：媒体播放标记；播放期间电源键关屏、屏蔽手柄输入；非播放时挂起。
- XMPlayer/终端：资源、播放器和手柄配置及终端启动配置。
- 构建与维护：rocknix-joypad 缓存清理防止内核符号 CRC 不匹配、modules 和工具包设置、构建主机同步工具、rootfs 检查和文档。

以上是保存的实现，不是全部通过实机验收的功能。原工作日志存在历史状态，应结合较新的补充和实际代码阅读。

## 分支与 worktree 去向

以下路径以前缀 ~/development/ 为基准。关系均以整合前 heya-core-minimal 为参照。

| 分支 | worktree | 整合前关系 / 本次处理 |
|---|---|---|
| next | 无独立 worktree | 已是主线祖先，含于整合历史 |
| audit/architecture | 无独立 worktree | 已是主线祖先，含于整合历史 |
| feat/heya-frontend | .worktrees/rocknix-heya | 分支已含于主线；未提交旧 heya 另存快照，资源与 frontend2 重叠；旧 v0.2.0 配方不覆盖当前 commit+SHA pin |
| feat/heya-frontend2 | .worktrees/rocknix-heya2 | 合入唯一提交的历史及遗留资源；保留当前 systemd 启动、控制器环境和最新配方 |
| feat/mini-launcher-system-tools | .worktrees/rocknix-mini-launcher | 合入 3 个提交：系统工具、实时信息、截图文档与脚本；已暂存的编译二进制仅备份 |
| heya-core-minimal | rocknix | 整合基线；64 个未提交路径已保存并纳入 |
| cpr69-endgame | rocknix-pocketjs-endgame | 已含于主线 |
| 无分支，detached HEAD | rocknix-cpr71-build | 基线已含于主线；未提交 heya AMD64/ARM64 架构选择已合入 |
| cpr75-analysis | rocknix-musicos-audit | 与主线同一提交 |
| feat/development-override | .worktrees/rocknix-dev-override | 合入 2 个提交；手动合并 heya 安装段，保留 Disk/Terminal/服务配置及 devexec |
| feature/pocketjs-runtime | .worktrees/rocknix-feature-pocketjs-runtime | 已被 cpr80/hello-report 包含 |
| feat/pocketjs-runtime-kms | rocknix-pocketjs-kms | 已被 cpr80/hello-report 包含 |
| cpr80/hello-report | .worktrees/pocketjs-hello-cpr80-rocknix | 一次合入 PocketJS 连续 7 个提交 |

所有 12 个原始分支 tip 均已验证为整合分支的祖先。旧 ES 直接 exec heya 的入口没有重新引入：当前 H700 由 systemd 启动 Sway/heya。旧版本 pin、EnvironmentFile=/etc/profile 和旧打包安装逻辑不覆盖当前实现。mini-launcher 源码作为已有备用实现保留，不改变 H700 默认前端。

## 统一工作入口

- 整合完成时的分支：integration/2026-10-27；随后按用户要求改名为 main。
- 后续开发目录：~/development/rocknix，已切换到 main；rocknix-integrated 保留为 detached HEAD 的整合检查点。
- 按用户要求以整合结果替换 origin/main，并将 GitHub 默认分支设为 main；执行结果以远端读回校验为准。未创建 PR。
- 原主目录的 64 个改动已逐文件确认与快照一致，切换前额外保存为 Git stash；均已包含在 main 中，不应再次 apply。其他 worktree 未改动。
- 远端旧 main（37be0eb79bb60dc1fd32dbea18fe4d9b6b6e41f3）保存为 backup/20261027/remote-main-before-integration，并已纳入 before-main-replacement.bundle。

## 备份与恢复

目录：~/development/rocknix-integration-backup-20261027（权限 0700）。

- all-branches.bundle：所有原分支和四个工作区快照的 Git 对象，git bundle verify 已通过。
- branches.txt：原始 12 个分支的 tip。
- inventory.json：11 个 worktree 的路径、HEAD、未提交状态及快照引用。
- 四个工作区目录分别保留 staged.patch、unstaged.patch、未跟踪文件清单和临时索引。未跟踪文件正文包含在快照提交/bundle 中。
- backup/20261027/rocknix、rocknix-heya、rocknix-mini-launcher、rocknix-cpr71-build：四个快照分支。
- mini-launcher 的暂存二进制保存在其快照分支；未放进统一源码树。
- Git 忽略的构建目录/产物不在本次快照范围内，原位置未改动。

## 本次验证

- 现有 Python unittest：7/7 通过。
- 新增/变化 Shell 文件与 package.mk：30 个语法检查通过；变化 JSON 可解析。
- mini-launcher：宿主机 SDL2 编译通过。
- devexec：宿主机 Go 编译通过。
- git diff --check：遗留字体许可证一行、旧 start_es.sh.patch 两行尾随空格，保持原资源/补丁内容，未改写。
- 未执行完整 H700/AMD64 镜像构建、刷写、硬件测试；本次没有新 .img.gz/.tar 交付物。

## 尚未闭环

1. 旁边 ~/development/heya 的 master 比 origin/master 多 830ffd4，且 cmd/heya/main.go、internal/ui/ui.go 仍有未提交修改。本次仅只读查看，未改动。ROCKNIX 仍 pin bca7c05；服务开关依赖的新 heya 功能尚未进入该 pin。应先完成 heya 测试与 push，再更新 commit 和归档 SHA。
2. PocketJS 配方 PKG_SHA256 为空，尚未以 ROCKNIX 工具链编译并打进镜像；Hello 补丁和构建证据也不等于配方已自动生成/安装该应用。
3. PocketJS 旧 Phase 3 文档的 Hello 编译阻塞已由后来的 CPR77_HELLO_POCKET_UNBLOCK.md 补充解决；源码草稿的镜像集成、KMS 主控交接和实机验收仍未解决。
4. 新服务、Disk/Terminal、USB/MTP、关屏继续播放与驱动缓存修复需要构建和 RG34XX 实机验收。
5. 按 AGENTS.md，发布 PR 前仍需由贡献者理解并验证代码，提供受影响目标的 .img.gz 与 .tar 链接/附件。
