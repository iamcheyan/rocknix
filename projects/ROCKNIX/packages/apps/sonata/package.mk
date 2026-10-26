# SPDX-License-Identifier: GPL-2.0-or-later

PKG_NAME="sonata"
PKG_VERSION="87d6f2f88ff7fd8018f616a12d7c1e86779fae30"
PKG_SHA256="a3d6477d46ceaa6cdb2b051fec2b9b56d3ffc8ca9a589d474971bfab71e440fa"
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
