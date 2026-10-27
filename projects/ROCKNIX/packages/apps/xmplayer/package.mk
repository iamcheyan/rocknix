# SPDX-License-Identifier: GPL-2.0-or-later
# XMPlayer - XMB Inspired Media Suite for ROCKNIX

PKG_NAME="xmplayer"
PKG_VERSION="1.0"
PKG_ARCH="aarch64"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/atalaygrgn/XMPlayer"
PKG_URL=""
PKG_DEPENDS_TARGET="toolchain mpv mc SDL2 freetype openal-soft libogg libvorbis mpg123 zlib gamecontrollerdb rocknix-hotkey noto-sans-cjk"
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
  rm -f ${INSTALL}/usr/share/xmplayer/bin/gptokeyb2

  mkdir -p ${INSTALL}/usr/bin
  install -m 0755 ${PKG_DIR}/scripts/xmplayer ${INSTALL}/usr/bin/xmplayer
  install -m 0755 ${PKG_DIR}/scripts/xmplayer-playback ${INSTALL}/usr/bin/xmplayer-playback

  mkdir -p ${INSTALL}/usr/share/heya/apps/xmplayer
  install -m 0644 ${PKG_DIR}/app.json ${INSTALL}/usr/share/heya/apps/xmplayer/app.json

  ln -sf /usr/share/xmplayer/bin/love ${INSTALL}/usr/bin/love
}
