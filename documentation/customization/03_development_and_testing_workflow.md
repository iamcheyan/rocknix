# 03. 变更追踪与电脑端测试工作流

在进行系统改造时，最忌讳的是“改了一堆东西然后整机编译两小时，刷入卡里启动黑屏，却不知道哪一步出错了”。

高效的嵌入式开发流程讲求**小步迭代、清晰追踪与分级验证**。

---

## 1. 变更追踪：清晰知道自己改了什么

### 1.1 善用 Git 分支与状态追踪
在动手改动前，切出一个专门的自定义分支，不要在 `next` 或 `main` 主干上混杂改动：

```bash
# 1. 检出新的特性分支
git checkout -b my-custom-h700

# 2. 查看当前修改了哪些文件
git status

# 3. 详细比对每一行代码修改
git diff

# 4. 如果修改已添加到暂存区 (git add)，查看暂存区别
git diff --cached
```

### 1.2 严格遵守目录与文件规范
根据项目的维护规则（可参考仓库根目录的 `AGENTS.md`）：
* **新增/修改软件包**：只在 [`projects/ROCKNIX/packages/`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages) 或 `projects/ROCKNIX/devices/H700/packages/` 维护，**不要动外层的 `packages/` 目录**。
* **新增机型补丁/quirk**：设备特定改动放在 [`projects/ROCKNIX/devices/H700/`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/H700)。

---

## 2. 电脑端怎么测试改动的效果？（分级测试模型）

掌机是 ARM64 架构，PC 是 x86_64 架构，你不能直接双击运行编译出来的 aarch64 程序。我们可以通过以下分级策略在电脑和掌机之间高效验证：

```
[阶段 1: 单包编译测试] ──> [阶段 2: 产物静态检查] ──> [阶段 3: 本地/模拟测试] ──> [阶段 4: 真机热同步测试] ──> [阶段 5: 最终固件整包]
(耗时几秒~数分钟)         (检查架构与依赖库)           (QEMU 或 PC 本地逻辑)       (SSH 推送，免刷卡验证)      (打出 .img.gz 烧录)
```

---

### 阶段 1：单包快速编译（不必整机编译）
当你添加了一个新软件（如音乐播放器 `myplayer`）或修改了某个包的 `package.mk`：
**永远不要直接运行 make image！** 优先单独编译该包：

```bash
# 在容器中编译单个目标包
PROJECT=ROCKNIX DEVICE=H700 ARCH=aarch64 ./scripts/build myplayer
```
* **验证点**：源码能否正确拉取、补丁能否打上、依赖是否齐全、编译过程是否有报错。

---

### 阶段 2：产物静态检查
编译成功后，产物会生成在对应设备的 build 目录下：
* 编译目录：`build.ROCKNIX-H700.aarch64/myplayer-<version>/`
* 模拟根目录（sysroot/image 预安装目录）：`build.ROCKNIX-H700.aarch64/.install_pkg/myplayer/`

你可以使用以下命令检查生成的文件：
```bash
# 1. 检查目标二进制文件架构（必须是 ARM aarch64）
file build.ROCKNIX-H700.aarch64/.install_pkg/myplayer/usr/bin/myplayer

# 2. 检查动态依赖库（确认所需 .so 库是否在 ROCKNIX 系统中已有支持）
# （需使用交叉工具链的 readelf）
./build.ROCKNIX-H700.aarch64/toolchain/bin/aarch64-linux-gnu-readelf -d \
  build.ROCKNIX-H700.aarch64/.install_pkg/myplayer/usr/bin/myplayer | grep NEEDED
```

---

### 阶段 3：本地仿真与逻辑运行验证

#### A. 命令行工具 / 非图形程序：使用 QEMU 用户态模拟
宿主机或容器如果配置了 `qemu-user-binfmt`，可以直接透明运行 aarch64 命令行程序：
```bash
# 直接运行交叉编译出来的 ARM64 二进制
qemu-aarch64 -L ./build.ROCKNIX-H700.aarch64/toolchain/aarch64-linux-gnu/sysroot \
  ./build.ROCKNIX-H700.aarch64/.install_pkg/myplayer/usr/bin/myplayer --help
```

#### B. 启动器 (GUI) 开发的独家技巧：分层编写与 PC 本地预览
如果你要自己写一个启动器（基于 SDL2、Raylib 等）：
* **推荐做法**：启动器代码在本地（PC 上用 CMake/Makefile）先编译成 x86_64 原生程序在电脑窗口里直接运行调试，手柄也可以插在电脑上测试界面、菜单与交互逻辑。
* **最后一步**：在 PC 上把界面与逻辑测试完善后，再写 `package.mk` 使用交叉编译器编译为 aarch64 版本。

---

### 阶段 4：真机局域网热同步（效率最高的真机测试方式）

只要你的掌机连上了 WiFi 并开启了 SSH（ROCKNIX 默认提供 SSH 服务，默认端口 22，用户 `root`，密码 `rocknix`）：

**你完全不需要每次烧录 SD 卡！**
直接通过 `scp` 将编译好的二进制推送到掌机的 `/storage` 运行测试：

```bash
# 1. 传输编译好的二进制文件到掌机的 /storage 分区
scp ./build.ROCKNIX-H700.aarch64/.install_pkg/myplayer/usr/bin/myplayer root@<掌机IP>:/storage/

# 2. 登录掌机直接调起执行
ssh root@<掌机IP>
chmod +x /storage/myplayer
/storage/myplayer
```

* **测试替换启动器**：
  在掌机 SSH 终端中：
  ```bash
  # 临时停止默认的前端
  systemctl stop essway.service
  
  # 在终端中以 Wayland 客户端身份调起你的新启动器看运行效果
  WAYLAND_DISPLAY=wayland-0 /storage/my-launcher
  
  # 查看调试日志
  journalctl -u essway -f
  ```

---

### 阶段 5：打包完整固件与最终集成

当你单包测试与真机热同步都验证无误后，再将该包加入系统的全局构建清单中，打出完整固件：

1. **注册到默认镜像清单**：
   在 [`projects/ROCKNIX/devices/H700/options`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/H700/options) 中，将你的包名添加到 `ADDITIONAL_PACKAGES`：
   ```bash
   ADDITIONAL_PACKAGES="myplayer"
   ```
2. **打包完整镜像**：
   ```bash
   PROJECT=ROCKNIX DEVICE=H700 ARCH=aarch64 ./scripts/image mkimage
   ```
3. 镜像产物将输出在 `target/` 目录下（例如 `ROCKNIX-H700.aarch64-...img.gz`），此时可以刷入全新 SD 卡进行整机验证。
