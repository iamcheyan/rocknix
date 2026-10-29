# PJOS Linux 更名覆盖清单

Issue: [iamcheyan/chezmoi#94](https://github.com/iamcheyan/chezmoi/issues/94)

显示字样统一为 `PJOS Linux`，并保留 splash 的上游 SVG parser、rotation、framebuffer 渲染与 cleanup 实现。

## 已更新的用户可见品牌

- H700 RG34XX boot splash：仅将 SVG path/颜色资源更新为 PJOS LINUX 字形，保留上游 parser、rotation、framebuffer 渲染和 cleanup 调用链。补丁：`projects/ROCKNIX/packages/tools/rocknix-splash/patches/0001-retro-dot-matrix-rg34xx.patch`。已在干净归档副本 dry-run、应用并编译通过。
- H700 DDR4 extlinux 启动菜单顶层 label 更新为 PJOS Linux；设备机型条目保持机型名。
- 系统身份：`distributions/ROCKNIX/options` 的 `DISTRONAME` 更新为 PJOS Linux；生成的 `/etc/os-release`、系统发行名及镜像名使用新显示名。`/etc/issue` 只显示版本和构建日期。
- handheld-launcher：模拟器窗口标题、System Info OS Stack、系统工具页备份/恢复说明更新。
- heya：`CFW_NAME`、终端提示符、Cloud Backup/Restore、System Information、Terminal 描述和终端工具标题/确认文字更新。
- PocketJS：浏览器预览标题和顶栏、示例 app 展示标题、未知 app 错误及 KMS service 描述更新。
- 安装器：欢迎、安装选项、完成、保存日志和窗口标题更新。
- EmulationStation 工具系统的 manufacturer UI 元数据、splash 包说明及 heya 当前操作文档描述更新。

## 保留的协议、技术名称与上游身份

- 项目/发行版源目录 `projects/ROCKNIX`、`distributions/ROCKNIX`，构建变量、目录前缀、包名、命令、service/unit/target、systemd 依赖、配置路径和环境变量名。
- `/etc/rocknix-release`、`/storage/rocknix-system-info.txt`、`ROCKNIX_BACKUP.zip` 是现存探测、诊断和备份接口/文件名；launcher 提示更新时保留实际文件路径。
- `DISTRO_BOOTLABEL=ROCKNIX`、`DISTRO_DISKLABEL=STORAGE` 是启动分区及存储卷标，不更改镜像/设备协议。
- `OSNAME=rocknix`、DTS 属性（如 `rocknix-dt-id`）、`ROCKNIX_*` 构建宏/环境变量、服务命令和设备接口保持原样。
- GitHub organization/repository、OTA URL、上游包 URL、下载坐标、构建工作流过滤器及 changelog 上游链接保留现有来源。
- GPL/APACHE/第三方版权、ROCKNIX 上游署名及品牌素材许可保持原样。仓库未发现 PJOS 专属品牌规范或现成 logo。
- 架构审计、工作日志和旧版本记录保留当时事实，不回写历史。

## 实机验收范围

重启后核验 boot splash、启动菜单/控制台（若设备启动路径实际展示）、首页、设置/系统工具、系统信息和关键服务状态。仅保存真机截图，并在中文 README 记录步骤、时间及实际结果。当前会话的控制机无法执行 ADB；设备部署须通过 HX90 网络 SSH 流程继续，截图与验收尚未完成。
