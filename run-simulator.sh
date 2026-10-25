#!/usr/bin/env bash
#
# ROCKNIX Anbernic RG34XX 掌机模拟器快速启动脚本
# 原生 720x480 (3:2) 分辨率窗口，支持键盘与 USB/蓝牙手柄热插拔
#

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$DIR/projects/ROCKNIX/packages/apps/handheld-launcher/src"
BIN="$SRC_DIR/handheld-launcher"

# 如果源码比二进制新，或者二进制不存在，自动增量重编
if [ ! -f "$BIN" ] || [ "$SRC_DIR/main.c" -nt "$BIN" ]; then
    echo "==> 检测到启动器源码更新，正在自动构建..."
    if command -v nix-shell >/dev/null 2>&1; then
        nix-shell -p SDL2 gcc pkg-config --run "make -C '$SRC_DIR' clean && make -C '$SRC_DIR'"
    else
        make -C "$SRC_DIR" clean && make -C "$SRC_DIR"
    fi
    echo "==> 构建完成！"
fi

# 显示驱动环境自适应（优先 Wayland，后退 X11）
export SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-wayland,x11}"
export ROCKNIX_SIMULATOR=1

clear 2>/dev/null || true
echo "=================================================================="
echo "   🎮 ROCKNIX 掌机开发环境模拟器 (Anbernic RG34XX 720x480)   "
echo "=================================================================="
echo " 键盘快捷键:"
echo "   [W / S] 或 [方向键 ↑ / ↓] : 菜单项目上下切换 / 平滑滚动"
echo "   [A / D] 或 [方向键 ← / →] : 调节亮度、音量 / 切换 USB 模式"
echo "   [Enter] 或 [Space] / [J]  : 确认选择 / 开关切换 / 启动程序"
echo "   [Backspace] 或 [Esc] / [K]: 返回上级菜单"
echo "   [START + SELECT] (Shift+Enter 或手柄组合键): 安全退出模拟器"
echo ""
echo " 实体手柄支持:"
echo "   已支持 Xbox / PS / Switch / 8BitDo 等各类 USB 及蓝牙手柄"
echo "   十字键/左摇杆导航，A 键确认，B 键返回，START+SELECT 组合退出"
echo "=================================================================="
echo "正在启动视窗..."

exec "$BIN" "$@"
