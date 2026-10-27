# SPDX-License-Identifier: GPL-2.0-only
# Telnet login served by the busybox telnetd applet.

PKG_NAME="telnet"
PKG_VERSION=""
PKG_LICENSE="GPLv2"
PKG_SITE=""
PKG_URL=""
PKG_DEPENDS_TARGET="toolchain busybox"
PKG_LONGDESC="Busybox telnetd socket units for the telnet.enabled toggle"
PKG_TOOLCHAIN="manual"

makeinstall_target() {
  mkdir -p ${INSTALL}/usr/lib/systemd/system
  cp ${PKG_DIR}/system.d/telnet.socket ${PKG_DIR}/system.d/telnet@.service \
    ${INSTALL}/usr/lib/systemd/system
}
