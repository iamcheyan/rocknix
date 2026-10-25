# 04. 在电脑上直接运行、操作与调试掌机软件（窗口与虚拟机）

定制掌机软件时，很多人会直觉认为“必须启动一个完整的掌机虚拟机才能看到效果”。实际上在嵌入式与掌机开发中，有**轻重两条路径**：

1. **轻量快速路径（原生窗口模拟）**：直接在电脑桌面上弹出一个固定 640×480（掌机物理分辨率）的窗口，通过键盘/手柄直接交互调试 UI 与业务逻辑。修改代码后 **1 秒即可重载看到效果**。
2. **完整系统路径（QEMU 虚拟机）**：构建并运行包含内核、systemd、Swaywm 的完整操作系统镜像，用于验证底层引导和服务链。

---

## 途径 A：原生窗口模拟（启动器与播放器开发首选）

掌机的前端启动器和图形播放器绝大多数基于 **SDL2** 或 **Raylib / Qt / Wayland EGL** 开发。SDL2 本身天然具备跨平台特性：在电脑上编译它就是一个桌面窗口，在掌机交叉编译后它就是一个直出屏幕的掌机界面。

### 1. 窗口与按键映射规范（以 640×480 掌机为例）
在电脑上测试时，标准做法是将掌机手柄按键映射为通用键盘按键：

| 掌机物理按键 | 电脑键盘映射 | 说明 |
| :--- | :--- | :--- |
| **方向键 (D-Pad)** | `Up / Down / Left / Right` 或 `W / A / S / D` | 菜单导航 |
| **A 键 (确定/选择)** | `J` 或 `Enter` | 确认/进入/播放 |
| **B 键 (返回/取消)** | `K` 或 `Backspace` / `ESC` | 返回上一级 |
| **X / Y 键** | `U / I` | 辅助功能/菜单 |
| **Start 键** | `Space` / `Return` | 开始/暂停/主菜单 |
| **Select 键** | `Tab` / `Right Shift` | 选项/呼出侧边栏 |

### 2. 容器内 GUI 投射到宿主机桌面的原理
如果你的编译环境在 Docker 容器中，容器内的 GUI 程序可以通过挂载宿主机的 Wayland 或 X11 Socket，直接在宿主机（如 Labwc / Sway 桌面）上弹出窗口：

```bash
docker run --rm -it \
  --user $(id -u):$(id -g) \
  -e WAYLAND_DISPLAY=$WAYLAND_DISPLAY \
  -v $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY:$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v "$PWD":/work \
  -w /work \
  rocknix-builder
```

---

## 途径 B：QEMU 虚拟机运行完整 ROCKNIX 系统

如果你需要验证的是**整机操作系统级行为**（例如：开机自动启动服务 `systemd`、窗口管理器 `sway` 崩溃恢复、热插拔事件等）：

### 1. 编译 AMD64 (x86_64) 目标镜像
ROCKNIX 原生支持 x86_64 PC 平台（代码位于 [`projects/ROCKNIX/devices/AMD64`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/devices/AMD64)）。

```bash
# 在编译容器中执行：
PROJECT=ROCKNIX DEVICE=AMD64 ARCH=x86_64 ./scripts/image mkimage
```

### 2. 使用 QEMU 启动虚拟掌机
镜像构建完成后，产物位于 `target/ROCKNIX-AMD64.x86_64-...img.gz`。解压后可直接用 QEMU 启动：

```bash
# 解压系统镜像
gzip -d target/ROCKNIX-AMD64.x86_64-*.img.gz

# 启动 QEMU 虚拟机并开启 KVM 硬件加速
qemu-system-x86_64 \
  -enable-kvm \
  -m 2048 \
  -smp 4 \
  -vga virtio \
  -display gtk,gl=on \
  -drive file=target/ROCKNIX-AMD64.x86_64-*.img,format=raw
```

此时电脑上会弹出一个真实的 QEMU 虚拟机窗口，完整展示 ROCKNIX 从内核启动、自启动到拉起前端界面的全部过程。
