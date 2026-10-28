# RG34XX ADB 故障与恢复记录（2026-10-28）

日期按 Asia/Tokyo。本文记录从 HX90 恢复 RG34XX 网络 ADB 的排查与操作。

## 现象

- HX90 上 `adb devices -l` 显示 USB 序列号 `ba9ce7e674c32f789169c30bfed92781` 为 `offline`。
- `adb reconnect`、`get-state` 和 `adb shell` 都不能恢复 USB transport；设备端 SSH 仍可用。
- 掌机当前 DHCP 地址为 `192.168.3.57`。用 `ssh root@192.168.3.57` 登录后，`hostname` 返回 `H700`，确认目标是 RG34XX。
- 掌机有两个 `/usr/sbin/adbd` 进程，TCP 5555 看似开放；HX90 的网络 ADB transport 仍是 `offline`，读超时。

## 排查证据

HX90 使用 ADB 35.0.2。其 `/tmp/adb.1000.log` 对 USB transport 记录了多次 `usb read failed: status = 1` 和 `libusb write failed`，其中一次在重置 USB transport 时触发 libusb 断言，导致 ADB server 崩溃并重启。这个日志说明 USB 通道本身也有错误，但单独重启 HX90 的 ADB server 后，设备依然离线。

设备端 `adbd.service` 配置为运行 `/usr/sbin/adbd` 并监听 TCP 5555。重启服务后，systemd 报告新主进程 PID 20069 已运行，但 `netstat -lntp` 显示 5555 仍由 PID 1153 的旧 `adbd` 持有。`systemctl status adbd` 的 cgroup 只列出新进程 PID 20069，没有列出 PID 1153；因此 systemd 重启服务没有清理这个残留进程，新服务无法接管 TCP 端口。

设备端日志还反复出现 `usb_ffs.cpp:300 failed to write USB descriptors: No such process`。这属于 USB FunctionFS 初始化错误，与 TCP 端口被残留进程占用是两条可观察到的异常；网络 ADB 恢复后，USB 日志仍有该错误。

## 修复步骤

所有设备端命令通过已验证的 SSH 通道执行；HX90 上的 ADB 命令通过 `ssh hx90` 执行。

1. 在 HX90 检查设备身份及网络路径：

   ```sh
   ssh root@192.168.3.57 hostname
   # H700
   ssh hx90 'ip route get 192.168.3.57'
   ```

2. 从设备 systemd 重启 ADB daemon：

   ```sh
   ssh root@192.168.3.57 'systemctl restart adbd'
   ```

3. 核实监听者，而不只检查服务是否显示 active：

   ```sh
   ssh root@192.168.3.57 'systemctl status adbd --no-pager; netstat -lntp | grep 5555'
   ```

   当时服务主进程为 PID 20069，但旧 PID 1153 仍占据 `:::5555`。这是重启后依然无法连接的直接原因。

4. 终止已确认占用 5555 的旧 `adbd`，再确认 systemd 管理的新进程已经接管：

   ```sh
   ssh root@192.168.3.57 'kill 1153; sleep 1; netstat -lntp | grep 5555'
   ```

   结果为 `:::5555 LISTEN 20069/adbd`。复用本步骤前，应重新检查 PID 和监听端口；不要假定 PID 1153 会在以后保持不变。

5. 在 HX90 清除旧网络 transport 并重连、运行 shell 验证：

   ```sh
   ssh hx90 'adb disconnect 192.168.3.57:5555; adb connect 192.168.3.57:5555; adb devices -l; adb -s 192.168.3.57:5555 get-state; adb -s 192.168.3.57:5555 shell hostname'
   ```

## 验证结果与边界

修复后 HX90 输出：

```text
connected to 192.168.3.57:5555
192.168.3.57:5555      device
device
H700
```

网络 ADB 已恢复，且 `adb shell hostname` 成功返回 `H700`。恢复依赖杀掉设备上的残留 `adbd` 并由当前 systemd 服务接管 5555；没有修改镜像或持久配置。

USB 序列号此前的 libusb 读写失败，以及设备端 USB FunctionFS 描述符错误仍需与网络 ADB 分开看待。本次确认的是 TCP ADB 可用；没有验证 USB ADB 已恢复，也没有确定 USB FunctionFS 错误的根本来源。后续如需 USB ADB，应单独检查线缆、端口/USB gadget 状态和 FunctionFS 初始化。
