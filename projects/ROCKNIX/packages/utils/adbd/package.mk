# SPDX-License-Identifier: GPL-2.0-or-later
# ADB Daemon for ROCKNIX

PKG_NAME="adbd"
PKG_VERSION="1.0.4"
PKG_LICENSE="GPL-3.0"
PKG_SITE="https://github.com/Roboparty/adbd4linux"
PKG_URL=""
PKG_DEPENDS_TARGET="toolchain zstd"
PKG_LONGDESC="Android Debug Bridge daemon for ROCKNIX Linux"
PKG_TOOLCHAIN="manual"

make_target() {
  :
}

makeinstall_target() {
  mkdir -p ${INSTALL}/usr/sbin ${INSTALL}/usr/bin ${INSTALL}/usr/lib
  cp -a ${PKG_DIR}/bin/adbd ${INSTALL}/usr/sbin/adbd
  ln -sf /usr/sbin/adbd ${INSTALL}/usr/bin/adbd
  cp -d ${PKG_DIR}/lib/* ${INSTALL}/usr/lib/
  chmod +x ${INSTALL}/usr/sbin/adbd
}

post_install() {
  enable_service adbd.service
}
