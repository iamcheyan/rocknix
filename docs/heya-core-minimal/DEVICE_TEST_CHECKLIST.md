# H700 mini：HX90 编译与上机检查

本分支将 H700 前端改为 heya，默认应用为 XMPlayer 和 Sonata（Sonata `87d6f2f88ff7fd8018f616a12d7c1e86779fae30`）。heya 的源码由
`projects/ROCKNIX/packages/apps/heya/package.mk` 中的 commit 和 SHA256 锁定；
HX90 不会读取 NAS 上另一个工作目录里的未提交代码。
当前 heya 源码版本：`0aaaf541905b5d1e6d322beff1544d6560b2e9da`。

## 编译前

```sh
cd ~/development/rocknix
git status --short --branch
git fetch origin
git switch heya-core-minimal
git pull --ff-only
git rev-parse HEAD
sed -n '1,16p' projects/ROCKNIX/packages/apps/heya/package.mk
make docker-H700 DOCKER_IMAGE=rocknix-builder:latest
```

HX90 已有本地 `rocknix-builder:latest`，Docker 可用。2026-10-26 检查时构建盘剩余
约 360 GiB。若更换构建镜像，按 ROCKNIX 文档准备其依赖。不要在有本地修改时强制
reset。H700 关闭 32 位兼容构建，仍由正常镜像流程产出所有 H700 设备镜像。

构建成功后检查 rootfs，宿主需安装 Python 3 和 binutils/readelf：

```sh
python3 tools/check-mini-rootfs.py build.ROCKNIX-H700.aarch64/image/system
find target -type f \( -name '*.img.gz' -o -name '*.tar' \)
```

若构建目录带版本后缀，替换为实际 `image/system` 路径。检查器检查启动文件、
AArch64 ELF 和递归共享库依赖；它不执行 ARM 程序，也不证明库的符号 ABI 兼容。
首次测试使用新的测试卡；保留构建日志、实际 commit、`.img.gz` 与 `.tar`。

## 掌机操作

- 物理 A 确认，B 返回，方向键导航，SELECT 刷新。
- System → Wi-Fi / Bluetooth：A 打开列表，左右关闭/开启无线。
- 音量、亮度用左右调整，每次 5%，亮度最低 5%。
- 屏幕键盘：A 输入，L 切换大小写，R 切换符号，SELECT 删除，START 提交，B 取消。
- Wi-Fi 支持开放网络、WPA/WPA2 和 WPA3；企业/WEP 认证需要已有系统 profile。
  选择网络后连接或输入密码，可断开或忘记保存的网络。
- 蓝牙可扫描、配对、核对数字、输入 PIN/passkey、显示键盘配对码、重连、断开和移除。
  耳机和手柄各测一次；显示配对成功不能替代音频和按键实测。
- `/storage/music` 放 Sonata 音乐；XMPlayer 的媒体目录由启动脚本初始化。
  SSH/SFTP 保留，传文件前在真机检查 SSH 服务和认证设置。

## 必须在硬件完成的验收

1. 全新 userdata 首次开机，heya 能启动，两个应用都能启动、退出并回到 heya。
2. 每次返回后方向键和 A/B 仍工作；蓝牙手柄断开再连接也能导航。
3. Wi-Fi 扫描、正确/错误密码、带空格和符号的密码、取消、忘记网络；重启后自动重连。
4. 蓝牙首次启用无需旧备份；新设备配对，拒绝配对码，接受配对码，断开重连，移除后重新配对。
5. 音量和亮度调整后重启仍保留；Wi-Fi/蓝牙开关在重启、休眠唤醒后符合设置。
6. XMPlayer FLAC/MP3 解码、视频启动和退出；Sonata 浏览和播放；扬声器、耳机、蓝牙音频分别验证。
7. 电量百分比、充电/放电状态、卡槽挂载、拔卡重插、短按休眠和唤醒。

## 真机诊断

```sh
systemctl status heya sway NetworkManager iwd bluetooth input powerstate
journalctl -b -u heya -u NetworkManager -u bluetooth --no-pager
xmplayer --check
nmcli device status
bluetoothctl show
cat /tmp/battery.percent
```

heya 不提前 enable：由 rocknix-autostart 完成用户配置和 app.json 初始化后，
H700 quirk 启动 sway 与 heya。因此 `systemctl is-enabled heya` 显示 disabled
并不等于启动失败，应看 `is-active` 和本次开机日志。

桌面预览使用 `HEYA_SIMULATOR=1` 的演示网络和设备，不改宿主机无线状态。
目前通过源码、桌面交互、私有 D-Bus 配对协议和自动化回归检查；完整镜像编译和
上述硬件验收仍待执行。不能据此标记为发布完成。
