# SPDX-License-Identifier: GPL-2.0-or-later

PKG_NAME="bun"
PKG_VERSION="1.4.4"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/oven-sh/bun"
PKG_DEPENDS_HOST="toolchain:host"
PKG_TOOLCHAIN="manual"
PKG_LONGDESC="Host JavaScript tooling for PocketJS application compilation"

case "${MACHINE_HARDWARE_NAME}" in
  x86_64)
    PKG_SHA256="bf8ccbfb2b0b80159e0f9a6d15c55317add8077534dbc6130a3edb52fccb395c"
    PKG_SOURCE_DIR="bun-linux-x64"
    ;;
  aarch64)
    PKG_SHA256="baa6bb36f51d6e58561e02bbea825038a9df454f673d6d776e8bbf86f8c7850e"
    PKG_SOURCE_DIR="bun-linux-aarch64"
    ;;
esac
PKG_URL="${PKG_SITE}/releases/download/bun-v${PKG_VERSION}/${PKG_SOURCE_DIR}.zip"
PKG_SOURCE_NAME="bun-${PKG_VERSION}-${MACHINE_HARDWARE_NAME}.zip"

make_host() {
  :
}

makeinstall_host() {
  install -D -m 0755 "${PKG_BUILD}/bun" "${TOOLCHAIN}/bin/bun"
}
