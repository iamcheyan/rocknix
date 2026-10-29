# HX90 工作树盘点（P1）

- 盘点时间：2026-10-29 00:33 JST
- HX90 路径：`~/development/rocknix`
- HX90 HEAD：`4cd48384e3`（落后本机 `origin/main` = `174727d4a4` 三个提交：`1d906e1858`、`f6f0edf1a1`、`174727d4a4`）
- 统计：已跟踪改动 26 个文件；未跟踪条目 64 个（`git status --porcelain` 共 90 行）

## 留档文件（本仓库 `attachments/`）

| 文件 | 大小 | 内容 |
|---|---|---|
| `hx90-rocknix-20261029T003343.patch` | 70,998 B | HX90 全部已跟踪改动的 `git diff`（另存于 HX90 `/tmp/hx90-rocknix-20261029T003343.patch`） |
| `hx90-status-20261029T003343.txt` | 5,514 B | `git status --porcelain` 完整清单 |
| `hx90-untracked-src-20261029T003343.tar.gz` | 101,702 B | 58 个未跟踪源码/文档文件打包（HX90 `/tmp/hx90-untracked-src-20261029T003343.tar.gz`） |
| `hx90-untracked-20261029T003343.list` | 3,460 B | 打包所用未跟踪文件清单 |

### 未打包的大体积/生成物（仅登记，不入库）

| 路径 | 大小 | 原因 |
|---|---|---|
| `tools/pocketshell-dev/` | 242 MB | 含二进制/构建产物 |
| `projects/.../pocketjs-runtime/fonts/` | 25 MB | 字体源文件（大） |
| `projects/.../pocketjs-runtime/hello/fonts/` | 2.7 MB | 字体子集 |
| `projects/.../pocketjs-runtime/showcase/`、`hello/showcase/` | 588K/48K | 素材目录 |
| `.buildlog/` | 576 KB | 构建日志 |

## 隐私扫描

`grep -Ein '(passw|token|secret|api[_-]?key|begin.*private|ssh-rsa|AKIA)'` 仅命中一行 `root.password=rocknix`（patch 第 961 行）。该行是 **context 行**（未修改），来自上游 `system.cfg` 已提交的默认值，本 patch 并未引入新的凭据。未做删改。

## HX90 已跟踪改动清单（26 个）

AGENTS.md、docs/heya-core-minimal/CPR77_PHASE3_IMPLEMENTATION.md、devices/H700/options、heya（README/package.mk/disk-browser）、pocketjs-runtime（hello/README、hello/main.tsx、hello/pocket.json、package.mk、scripts/pocket、scripts/pocketjs-session、system.d/pocketjs-kms.service）、graphics/SDL2、graphics/cairo、graphics/mesa、quirks/H700/090-ui_service、multimedia/mpv、rocknix/autostart/098-devservices、config/system.cfg、sources/scripts/rocknix-services、system-utils/scripts/input_sense、util-linux/package.mk、rocknix-splash patch、virtual/image/package.mk、tools/check-mini-rootfs.py

## 未跟踪清单（64 条，全文见 status 文件）

关键条目：`scripts/pocketshell-dev`、`scripts/pocketshell-launcher.rs`、`scripts/pocketshell-library.rs`、`scripts/pocketshell-terminal.rs`、`scripts/patch-build-fonts.py`、`scripts/patch-runtime.py`、`scripts/pocket-session-run`、`system.d/pocketshell-dev.service`、`system.d/pocketjs-recovery.service`、`library.tsx`/`library-model.ts`、`devel/bun/`、`tools/pocketshell-mirror/`。

## P2 风险提示

以上未跟踪文件中，相当一部分（如 `patch-build-fonts.py`、`patch-runtime.py`、`pocketshell-*.rs`、`pocketshell-dev.service`）在本机 `main` 上已是**已跟踪**文件 —— HX90 直接 fast-forward 会因 "untracked working tree files would be overwritten" 失败。P2 需先把冲突未跟踪文件备份重命名，ff 后逐个与上游版本比对，决定保留哪份。
## P2 对齐结果（2026-10-29 00:45 JST）

- `git fetch` + `git merge --ff-only origin/main` 成功，HX90 HEAD = `d681c8f25e`（= 本机已推送最新的 origin/main，含 P0/P1 文档提交）。
- 冲突处理：72 个未跟踪文件与 ff 路径相交，已先 `cp -a` 备份到 `/tmp/hx90-p2-backup-20261029T003343/`（4.8MB）再删除，未丢失任何内容。
- 26 个已跟踪改动：`git diff stash@{0} HEAD` 显示其中 **25 个文件的 stash 版本与当前 HEAD 完全一致** → 这些改动早已合入 main（本机 `174727d4a4` 及其后续）。仅 `pocketjs-runtime/hello/main.tsx` 在 stash 中与 HEAD 不一致；该文件本机另有更新的未提交版本，为权威来源，HX90 的 stash 旧版无需单独提交。
- `git stash@{0}`（"P2 pre-ff tracked changes 2026-10-29"）保留未丢弃；完整 diff 亦存档于 `attachments/hx90-rocknix-20261029T003343.patch`。
- ff 后残留未跟踪（不与 main 冲突、构建会重新生成）：`.buildlog/`、`linux-splash`、`main_linux.c`、`pocketjs-runtime/{README,browser-preview.html,fixtures,fonts,fonts.json,launcher-*,library-*,main.tsx,pocket.json,pocket.runtime-config.ts,profile.ts,scripts/pocketjs-legacy-settings}` 等。不影响后续构建。
- 结论：HX90 已与 origin/main 基线对齐，可开始 P3 构建修复。

## J7 核查：S3 曾对 HX90 `git checkout build_distro` 是否冲掉他人改动

- 方法：比对 `scripts/build_distro` 是否与 HEAD 一致；查已导出的未提交改动 patch 是否含该文件；确认 `.buildlog/` 与 26 文件 patch 是否完整留档。
- 结果：
  - `git diff HEAD -- scripts/build_distro` 为空、`git status` 干净 → 当前 `build_distro` 即 HEAD 版本。
  - 存档 patch `/tmp/hx90-rocknix-20261029T003343.patch` 含 **26 个 `diff --git`**，其中**不含** `scripts/build_distro`。
  - `.buildlog/` 仍有 12 个日志文件。
  - 26 个未提交改动全部保存于 `attachments/hx90-rocknix-20261029T003343.patch`，并另有 `git stash@{0}` 备份。
- 结论：S3 的 `git checkout build_distro` 只把该文件还原到 HEAD；没有证据表明它冲掉了其他 agent 对 `build_distro` 的未提交改动（该文件不在 26 文件存档内，且现与 HEAD 一致）。其他 26 个未提交文件均已完整留档，**无不可恢复丢失**。
- 残留风险/限制：无法从会话 JSONL 逐字节还原 S3 checkout 前的 `build_distro` 瞬时状态；但当前树该文件与 origin/main 一致，功能完整（`OS_BASE_CLEAN` 等开关仍在，见 G 组）。

## P2b 再同步（2026-10-29 上午，为 E 镜像验证重建）

- HX90 原 HEAD `d681c8f25e`（早于 sleep `faacfe0e6a`、adbd `71ff73cb71`、launcher `084cca71b4` 等）。
- 操作：`git fetch`；`git diff > /tmp/hx90-pre-rebuild-20261029T103741.patch`；`git stash push`（stash@{0} "pre-rebuild"）；备份/删除 5 个与新提交冲突的未跟踪文件到 `/tmp/hx90-untracked-20261029T103741/`；`git merge --ff-only origin/main` → HX90 HEAD 现为 **`e484b261d2`**（= origin/main）。sleep/adbd 修复文件已 tracked。剩余未跟踪 50 个（非冲突用户资产，保留）。
- 已跟踪但被 stash 的改动（5）：`hello/fonts.json`、`hello/launcher-characters.txt`、`hello/main.tsx`、`pocketjs-runtime/package.mk`、`scripts/patch-runtime.py`。stash 未丢弃。
- **损坏**：误执行 `make docker-clean PACKAGE=adbd`（Makefile `clean:` 忽略 PACKAGE → `./scripts/clean` 全量 clean），叠加 sonata 根属 `.gopath` 权限错误，导致 `build.ROCKNIX-H700.aarch64/build/` 仅剩 `adbd-1.0.4`、`install_pkg/` 仅 1 项、`image/` staging 损坏。`sudo` 可用，已 `sudo rm -rf` sonata 与损坏 image 目录。
- 后果：需按 `BUILD.md` 做一次干净全量重建（约 1–2h）才能出含 adbd 修复的镜像；源码与 stash 均保留，未丢用户改动。E 的镜像验证因此仍 OPEN（详见 REPORT.md Build-verify 节）。
