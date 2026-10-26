# SPDX-License-Identifier: GPL-2.0-or-later

PKG_NAME="sonata"
PKG_VERSION="6e3755b5264b126199a85d6c21a81f4e0bf6f0c2"
PKG_SHA256="ada254b5d3487e4464b717a1c47f9417ab20113bc2d5be76127a3c19e8a5791c"
PKG_ARCH="aarch64"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/iamcheyan/sonata"
PKG_URL="${PKG_SITE}/archive/${PKG_VERSION}.tar.gz"
PKG_DEPENDS_TARGET="toolchain go:host mpv foot rocknix-hotkey"
PKG_LONGDESC="Local music library and mpv playback controller"
PKG_TOOLCHAIN="manual"

make_target() {
  export CGO_ENABLED=0
  export GOOS=linux
  export GOARCH=arm64
  export GOCACHE="${PKG_BUILD}/.gocache"
  export GOPATH="${PKG_BUILD}/.gopath"
  export GOFLAGS="-mod=readonly"
  export GOTOOLCHAIN=local

  cd "${PKG_BUILD}"
  "${TOOLCHAIN}/lib/golang/bin/go" build \
    -trimpath \
    -ldflags "-s -w" \
    -o "${PKG_BUILD}/sonata" \
    ./cmd/sonata
}

makeinstall_target() {
  mkdir -p "${INSTALL}/usr/bin"
  install -m 0755 "${PKG_BUILD}/sonata" "${INSTALL}/usr/bin/sonata"
  install -m 0755 "${PKG_DIR}/scripts/sonata-launch" \
    "${INSTALL}/usr/bin/sonata-launch"

  mkdir -p "${INSTALL}/usr/share/heya/apps/sonata"
  install -m 0644 "${PKG_DIR}/apps/sonata/app.json" \
    "${INSTALL}/usr/share/heya/apps/sonata/app.json"

  mkdir -p "${INSTALL}/usr/config/sonata"
  install -m 0644 "${PKG_DIR}/config/sonata.gptk" \
    "${INSTALL}/usr/config/sonata/sonata.gptk"
}
