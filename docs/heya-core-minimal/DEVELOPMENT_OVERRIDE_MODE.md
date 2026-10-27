# ROCKNIX Development Override Mode 设计报告

状态：实现于 `feat/development-override`，基线 `origin/heya-core-minimal` (`94eb46217286a35a3eaf5b7559990111b1a9350f`)。报告按 CPR #76 指定仓库分支的源码核实；该分支包含 heya integration，但不包含本机原 heya checkout 的未提交改动。

## 1. 真实启动链

在此分支的 H700 构建中，`projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service` 写入 `UI_SERVICE="sway.service heya.service"`。systemd 默认目标由 `projects/ROCKNIX/packages/rocknix/package.mk` 链接到 `rocknix.target`；`projects/ROCKNIX/packages/sysutils/autostart/system.d/rocknix-autostart.service` 将 `/usr/bin/autostart` 作为 oneshot 拉起。autostart 运行 H700 quirk、公共启动脚本后读取 `/etc/profile` 并执行 `systemctl start ${UI_SERVICE}`。其中 sway 的 unit 是 `projects/ROCKNIX/packages/wayland/compositor/sway/system.d/sway.service`，ExecStart `/usr/bin/sway.sh`；heya 的 unit 随 heya 包安装到 `/usr/lib/systemd/system/heya.service`，Requires/After sway，ExecStart `/usr/bin/heya ...`。

通用非 heya 启动链也在源码中：`essway.service`（`projects/ROCKNIX/packages/ui/emulationstation/system.d/essway.service`）→ `/usr/bin/start_es.sh`。脚本从同目录 source `es_settings`、调用 `prerotate_env` 和 `scanout_reset_stale`，若 `/usr/bin/handheld-launcher` 可执行便 exec 它，否则执行 `emulationstation --log-path /var/log --no-splash`。`projects/ROCKNIX/packages/apps/handheld-launcher/system.d/handheld-launcher.service` 是另一条独立入口，直接 exec `/usr/bin/handheld-launcher`。该 CPR 分支 H700 使用 heya，不使用 ES 链；以上 ES 链作为分支中保留的通用 ROCKNIX 路径记录。

更早阶段 SYSTEM 由 `projects/ROCKNIX/packages/sysutils/busybox/scripts/init` 以只读 loop mount（`ro,loop`）挂入 `/sysroot`，最后 `switch_root` 到 systemd；构建镜像时 `scripts/image` 用 mksquashfs 生成 SYSTEM。此功能不写 SYSTEM、不改 mount 或 squashfs。

## 2. 真实 frontend 与 binary 路径

| 入口 | 包路径 | systemd unit/ExecStart | binary |
|---|---|---|---|
| H700 heya | `projects/ROCKNIX/packages/apps/heya/package.mk` | `/usr/lib/systemd/system/heya.service`，`/usr/bin/heya --theme ... --apps ...` | `/usr/bin/heya` |

### 通用非 heya 启动链（此分支的源码）

`rocknix.target` → `rocknix-autostart.service` → `/usr/bin/autostart` → `/etc/profile` 提供的 `UI_SERVICE` → `sway.service` 与 `essway.service`。`essway.service` 的 ExecStart 是 `/usr/bin/start_es.sh`；它加载 `es_settings`、执行 `prerotate_env` / `scanout_reset_stale`，随后优先 exec 可执行的 `/usr/bin/handheld-launcher`，否则运行 `emulationstation --log-path /var/log --no-splash`。ES 包把二进制安装到 `/usr/bin/emulationstation`。`handheld-launcher.service` 另可直接启动 `/usr/bin/handheld-launcher`。

本次实现作用于 H700 的 heya 前端。ES 与 handheld-launcher 在此 H700 构建选项中被裁剪，故没有改动其 unit/package。

## 3. 修改点

- `distributions/ROCKNIX/options` 与 `projects/ROCKNIX/devices/H700/options` 默认设置 `DEVELOPER_MODE=false`，并支持 `PROJECT_DEVELOPER_MODE` 覆盖。
- `projects/ROCKNIX/packages/apps/heya/package.mk` 仅开发模式编译、安装 devexec，并只在开发模式生成带 wrapper 的 systemd unit；正式模式保留原 unit 字节内容。
- `projects/ROCKNIX/packages/apps/heya/scripts/devexec.go`：需要一个系统程序绝对路径参数。以 `/storage/dev` + 去掉开头 `/` 的相对路径查找覆盖；存在时 exec 覆盖，否则 exec 原路径。保留环境变量和传入参数；要求干净绝对路径并拒绝指向自身覆盖树的目标。

SYSTEM 仍是只读系统基线；所有覆盖仅从 `/storage/dev` 读取。目录不存在或对应覆盖不存在时运行系统 binary。部署覆盖文件须保持可执行权限和目标架构匹配。

## 4. A/B/C 方案比较

| 方案 | 内容 | 优点 | 缺点 | immutable |
|---|---|---|---|---|
| A devexec（推荐） | 开发镜像 unit 将其 ExecStart 前置为 `devexec /absolute/binary` | 通用按真实安装路径映射；argv/env 原样保留；无覆盖即原程序；构建期开关可默认关闭 | 需要显式把目标 unit 纳入包装；每个目标 package 需与 helper 协作 | 兼容，不改 SYSTEM 内容或挂载 |
| B 覆盖目录 bind mount/overlay | 开机把 `/storage/dev/...` bind 到系统路径 | 调用方完全无感 | 需要 mount unit、路径清单、目录预创建及 mount namespace/更新顺序处理；覆盖可能影响系统文件打开 | 不可写 SYSTEM，但增加系统全局 mount 改动面 |
| C 手动替换 unit/脚本或 symlink | 人工修改 ExecStart 或将系统路径链接到 storage | 简单直接 | 每个程序各自硬编码；升级易漂移；不适用于一般路径；风险是配置或链接越界 | 可兼容但维护性与边界较差 |

## 5. 推荐方案与开关

选 A，遵循现有 package 配方自身的 Go host toolchain 和 systemd unit 安装规则。开关由 distro/device `options` 暴露：`DEVELOPER_MODE=true`，或更具体的 `PROJECT_DEVELOPER_MODE=true`。均默认 false，后者优先；正常镜像不安装 helper 且 unit 直接运行 heya。开发镜像必须在 build 前设开关并重建 heya package/image。systemd unit 本身不做运行时环境变量判定，避免 service 条件与编译安装产物状态不一致。

## 6. 修改文件列表

- `distributions/ROCKNIX/options`
- `projects/ROCKNIX/devices/H700/options`
- `projects/ROCKNIX/packages/apps/heya/package.mk`
- `projects/ROCKNIX/packages/apps/heya/scripts/devexec.go`（新增）
- `projects/ROCKNIX/packages/apps/heya/integrations/rocknix/README.md`

## 7. 完整 patch

完整实现 patch 由本报告所在提交包含；检查命令：

```sh
git show --format=fuller --stat HEAD
git show --format= HEAD -- distributions/ROCKNIX/options projects/ROCKNIX/devices/H700/options projects/ROCKNIX/packages/apps/heya
```

## 8. 编译与验证步骤

构建配置：

```sh
export DEVELOPER_MODE=true
# 可选：项目显式值优先
export PROJECT_DEVELOPER_MODE=true
scripts/build H700
scripts/install H700
```

重建镜像可按仓库常规 `scripts/build_distro`/`make image` 流程完成。开发主机必须满足 ROCKNIX toolchain、Go host、SDL2/SDL2_ttf 目标依赖及仓库 `scripts/checkdeps`。预期 helper 安装于 build root `/usr/bin/devexec`，unit ExecStart 为 `/usr/bin/devexec /usr/bin/heya ...`。关闭开关（false）后重新安装，helper 不应在 heya 包中且 unit 使用 `/usr/bin/heya ...`。

## 9. RG34XX（H700）真机测试步骤

1. 使用 `DEVELOPER_MODE=true` 构建 RG34XX/H700 对应 DDR4 镜像；按仓库设备流程写卡前核对设备，保留可回滚镜像。
2. 启动后检查 SYSTEM 为只读、`/storage` 可写、`/usr/bin/devexec` 存在且 `systemctl cat heya.service` 显示 wrapper ExecStart。
3. 无覆盖时 `systemctl restart heya.service`，确认 heya 从 SYSTEM 正常启动。
4. 通过 SCP 放置 ARM64 可执行文件到 `/storage/dev/usr/bin/heya`（mode 0755），重启 heya unit；检查 `/proc/<pid>/exe` 或进程行为确认覆盖生效。
5. 删除覆盖文件再重启 unit，确认恢复系统 binary；验证开机、显示、按键、应用启动、休眠/恢复及日志。
6. 正式镜像验证 helper 不存在、unit 无 wrapper，前端照常运行。

真机与镜像行为目前未验证。

## 10. 开发者工作流

```sh
# heya 源码目录，以 heya 仓库实际模块与依赖为准
go build -o heya ./cmd/heya
scp ./heya root@<ROCKNIX-IP>:/storage/dev/usr/bin/heya
ssh root@<ROCKNIX-IP> 'chmod 0755 /storage/dev/usr/bin/heya && systemctl restart heya.service'
```

`/storage/dev/usr/bin/heya` 是系统 binary `/usr/bin/heya` 的镜像路径；不需要重写 TF 卡。若修改了 systemd unit 参数或系统依赖，则仍需重新打包验证。该流程假设设备已是开启开发模式的镜像、SSH 已可用且 Go 构建产物 ABI/架构匹配。

## 验证状态与限制

- 已对启动链、ExecStart、binary 安装路径、RO mount 与构建 options 顺序进行源码核实。
- 已通过 `go build` 编译 devexec；临时根目录行为验证覆盖命中、缺失覆盖回退、目录外符号链接拒绝（exit 127），及无覆盖系统版成功（exit 0）。
- `bash -n` 适用于相关 options/package 配方、`git diff --check` 通过；带 stub dependency 的 `systemd-analyze verify --root=... heya.service` 通过。直接对主机验证原 unit 会因主机没有 ROCKNIX sway/heya binary 而失败，此属环境差异。
- 完整 H700 image build 与 RG34XX H700 真机步骤未在本工作环境运行，不能视为通过。
