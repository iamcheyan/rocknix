# SPDX-License-Identifier: GPL-2.0-or-later
# XMPlayer - XMB Inspired Media Suite for ROCKNIX

PKG_NAME="xmplayer"
PKG_VERSION="main"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/atalaygrgn/XMPlayer"
PKG_URL="${PKG_SITE}/archive/refs/heads/${PKG_VERSION}.tar.gz"
PKG_DEPENDS_TARGET="toolchain mpv ffmpeg"
PKG_LONGDESC="All-in-one XMB-inspired media suite for handheld Linux devices"
PKG_TOOLCHAIN="manual"

makeinstall_target() {
  mkdir -p ${INSTALL}/usr/share/xmplayer
  cp -rf ${PKG_BUILD}/.xmplayer/* ${INSTALL}/usr/share/xmplayer/

  mkdir -p ${INSTALL}/usr/bin
  cat << 'EOF' > ${INSTALL}/usr/bin/xmplayer
#!/bin/sh
exec love /usr/share/xmplayer "$@"
EOF
  chmod +x ${INSTALL}/usr/bin/xmplayer
}
