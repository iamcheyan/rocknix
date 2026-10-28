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
