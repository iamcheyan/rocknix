# SPDX-License-Identifier: GPL-2.0-or-later
# XMPlayer - XMB Inspired Media Suite for ROCKNIX

PKG_NAME="xmplayer"
PKG_VERSION="1.0"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/atalaygrgn/XMPlayer"
PKG_URL=""
PKG_DEPENDS_TARGET="toolchain mpv ffmpeg"
PKG_LONGDESC="All-in-one XMB-inspired media suite for handheld Linux devices"
PKG_TOOLCHAIN="manual"

make_target() {
  :
}

makeinstall_target() {
  mkdir -p ${INSTALL}/usr/share/xmplayer
  cp -rf ${PKG_DIR}/app/* ${INSTALL}/usr/share/xmplayer/
  chmod 755 ${INSTALL}/usr/share/xmplayer/bin/* 2>/dev/null || true
  chmod 755 ${INSTALL}/usr/share/xmplayer/libs/* 2>/dev/null || true

  mkdir -p ${INSTALL}/usr/bin
  cat << 'EOF' > ${INSTALL}/usr/bin/xmplayer
#!/bin/sh
export LD_LIBRARY_PATH="/usr/share/xmplayer/libs:/usr/lib/compat:${LD_LIBRARY_PATH}"
export PATH="/usr/share/xmplayer/bin:${PATH}"
export SDL_GAMECONTROLLERCONFIG_FILE="/usr/lib/gamecontrollerdb.txt"
export HOME=/storage
export XDG_RUNTIME_DIR=/var/run/0-runtime-dir
export WAYLAND_DISPLAY=wayland-1
export SDL_VIDEODRIVER=wayland
export SDL_AUDIODRIVER=pulseaudio
mkdir -p /storage/.config/xmplayer/thumbnails /storage/music /storage/roms/music
cd /usr/share/xmplayer
exec /usr/share/xmplayer/bin/love /usr/share/xmplayer "$@"
EOF
  chmod 755 ${INSTALL}/usr/bin/xmplayer

  ln -sf /usr/share/xmplayer/bin/love ${INSTALL}/usr/bin/love
}
