# 自研媒体/游戏库扫描（无第三方前端）

分支：`feat/pocketshell-games-scan`（基线 main `9fc62d1ba3`）

## 为什么自己做

镜像里没有 RetroArch / EmulationStation，也没有可用的媒体库索引。用户要求不依赖第三方，因此自己定目录契约 + 自研扫描服务，启动器只读索引结果。

## 目录契约（用户放文件的地方）

| 内容 | 主目录 | 说明 |
|---|---|---|
| 游戏 | `/storage/content/games/<system>/` | `<system>` 为 gba/snes/psx 等；也支持直接放在 `games/` 根下（记为 misc） |
| 音乐 | `/storage/content/music/` | mp3/flac/ogg/opus/m4a/aac/wav/wma/ape/dsf |
| 视频 | `/storage/content/videos/` | mp4/mkv/webm/avi/mov/m4v/ts/mpg/mpeg |
| 书/文档 | `/storage/content/books/` | epub/pdf/txt/md/mobi/azw3/cbz/cbr |
| 外置盘 | `/media/<卷标>/content/<同类目录>/` | 插上自动挂载后无需改配置 |

为兼容旧卡，以下历史路径也被扫描：`/storage/games-internal/roms`、`/storage/games-external/roms`、`/storage/roms`、`/storage/music`、`/storage/videos`、`/media/<卷标>/roms`。

## 组件

1. `scripts/pocketshell-games`（python3，自研）
   - `scan`：遍历上述根目录，写 `/storage/pocketshell/library/library.json`（原子替换）
   - `watch`：启动即扫，之后每 10 秒比对签名，变化才重扫；收到 `SIGUSR1` 立即重扫
2. `system.d/pocketshell-games.service`：`Type=simple`，`Restart=always`，`Nice=10`、`CPUQuota=20%`、`MemoryMax=64M`，保证扫描不与 UI 渲染抢资源
3. bridge（`scripts/pocketshell-launcher.rs`）
   - `ROMS` → 直接读 `library.json`（渲染线程不扫盘）
   - `ROMSCAN` → 调用扫描器 + `pkill -USR1` 通知 watcher
   - `ROMLAUNCH\t<path>` → 交给 `/usr/bin/pocketshell-play`（存在时）
4. 启动器 `hello/library-workspace.tsx`：应用列表新增 `Library / ライブラリ / 资料库` 条目，进入即自动刷新，首行 `Scan now` 可手动重扫；A 打开，B 返回

## 实机验证（RG34XX，720×480）

测试内容（临时，放在 `/storage/content/`）：`games/gba/{Pokemon Emerald,Metroid Fusion}.gba`、`games/snes/Chrono Trigger.sfc`、`music/Test Track.mp3`、`videos/Test Clip.mp4`、`books/Test Book.epub`

| 截图 | 结果 |
|---|---|
| `LIB-01-overview.png` | 启动器首页正常 |
| `LIB-02-apps-list.png` | 应用列表出现 `ライブラリ` 条目 |
| `LIB-03-library-row.png` | 该条目可选中 |
| `LIB-04-library.png` | 进入库页面，自动扫描 |
| `LIB-05-games-header.png` | `GAMES 3` 分组 |
| `LIB-06-first-game.png` | 列出 gba×2、snes×1，另有 MUSIC 1 / VIDEOS 1；右上计数 6 |
| `LIB-07-no-player.png` | 按 A → `No player configured`（当前未装播放器/模拟器） |
| `LIB-08-scan-row.png` | 手动 `Scan now` 行 |
| `LIB-09-after-rescan.png` | 手动重扫后列表仍为 6 项 |

`library.json` 实测内容：

```json
{"generated":1793268..., "total":6,
 "sections":["books","games","music","videos"]}
```

## 未完成 / 边界

- **没有播放器/模拟器**：`A` 只会返回 `No player configured`。要真正运行游戏或播放媒体，需要装一个我们认可的 runtime（或自研极简前端），当前不引入 RetroArch/ES-DE。
- systemd 单元与服务路径只在 `/storage` 手动部署验证过（扫描器放 `/storage/dev/usr/bin/`），**尚未进镜像**；`/usr/bin/pocketshell-games` 的镜像路径由 `package.mk` 安装，需要下次镜像构建后确认。
- `watch` 目前是 10 秒轮询（设备无 `inotifywait`）；库很大时可改为按目录 mtime 分层刷新。
