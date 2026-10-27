# SPDX-License-Identifier: GPL-2.0-or-later
# ProFTPD built into the image with root login over /storage.

PKG_NAME="proftpd"
PKG_VERSION="1.3.9c"
PKG_SHA256="724a6aead2f4a284c1df0c96ad778da2a45d38474bb46db8db0921d2b222f300"
PKG_LICENSE="GPL-2.0-or-later"
PKG_SITE="http://www.proftpd.org/"
PKG_URL="https://github.com/proftpd/proftpd/archive/v${PKG_VERSION}.tar.gz"
PKG_DEPENDS_TARGET="toolchain libcap openssl ncurses pcre2"
PKG_LONGDESC="Secure FTP server with TLS support"
PKG_TOOLCHAIN="configure"
PKG_BUILD_FLAGS="-sysroot"

PKG_CONFIGURE_OPTS_TARGET="--enable-static \
                           --enable-openssl \
                           --with-modules=mod_tls \
                           --localstatedir=/var \
                           --sysconfdir=/etc \
                           --disable-ipv6 \
                           --disable-nls \
                           --without-pam \
                           --enable-sendfile \
                           --enable-largefile \
                           install_user=$(id -u) \
                           install_group=$(id -g)"

pre_configure_target() {
  export CFLAGS="${CFLAGS} -D_LARGEFILE_SOURCE -D_FILE_OFFSET_BITS=64"
  cd ..
  rm -rf .${TARGET_NAME}
}

post_configure_target() {
  libtool_remove_rpath libtool
}

post_makeinstall_target() {
  mkdir -p ${INSTALL}/etc ${INSTALL}/usr/lib/systemd/system ${INSTALL}/usr/bin
  cp ${PKG_DIR}/config/proftpd.conf ${INSTALL}/etc/proftpd.conf
  cp ${PKG_DIR}/system.d/proftpd.service ${INSTALL}/usr/lib/systemd/system
  cp ${PKG_DIR}/scripts/proftpd-start ${INSTALL}/usr/bin
  chmod 0755 ${INSTALL}/usr/bin/proftpd-start
  rm -rf ${INSTALL}/usr/share/man ${INSTALL}/usr/share/locale
}
