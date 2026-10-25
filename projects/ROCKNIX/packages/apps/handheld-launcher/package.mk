# SPDX-License-Identifier: GPL-2.0-or-later
# Handheld Launcher for Anbernic RG34XX (H700)

PKG_NAME="handheld-launcher"
PKG_VERSION="1.0.0"
PKG_LICENSE="GPL"
PKG_SITE="local"
PKG_DEPENDS_TARGET="toolchain SDL2 xmplayer"
PKG_LONGDESC="Custom Handheld Launcher for Anbernic RG34XX (720x480)"
PKG_TOOLCHAIN="make"

pre_make_target() {
  mkdir -p ${PKG_BUILD}
  cp -rf ${PKG_DIR}/src/* ${PKG_BUILD}/
}

make_target() {
  make -C ${PKG_BUILD} CC="${CC}" \
    CFLAGS="${CFLAGS} $(pkg-config --cflags sdl2 2>/dev/null || echo '-I${SYSROOT_PREFIX}/usr/include/SDL2')" \
    LIBS="-L${SYSROOT_PREFIX}/usr/lib -lSDL2 -lm"
}

makeinstall_target() {
  mkdir -p ${INSTALL}/usr/bin
  cp -a ${PKG_BUILD}/handheld-launcher ${INSTALL}/usr/bin/
}

post_install() {
  enable_service handheld-launcher.service
}
