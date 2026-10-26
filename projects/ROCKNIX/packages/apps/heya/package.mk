# SPDX-License-Identifier: GPL-2.0-or-later
# heya — JSON-driven launcher shell

PKG_NAME="heya"
PKG_VERSION="0aaaf541905b5d1e6d322beff1544d6560b2e9da"
PKG_SHA256="81b9745086d1fd6650880ebe76490cc76480d79c3b28074927eca2b1e4e4838d"
PKG_ARCH="aarch64"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/iamcheyan/heya"
PKG_URL="${PKG_SITE}/archive/${PKG_VERSION}.tar.gz"
PKG_DEPENDS_TARGET="toolchain go:host SDL2 SDL2_ttf rocknix gamecontrollerdb"
PKG_LONGDESC="Lightweight JSON-driven launcher shell for Linux handhelds"
PKG_TOOLCHAIN="manual"

make_target() {
  export CGO_ENABLED=1
  export GOOS=linux
  export GOARCH=arm64
  export CC="${CC}"
  export CXX="${CXX}"
  export CGO_CFLAGS="${CFLAGS}"
  export CGO_LDFLAGS="${LDFLAGS} -lSDL2 -lSDL2_ttf"
  export GOCACHE="${PKG_BUILD}/.gocache"
  export GOPATH="${PKG_BUILD}/.gopath"
  export GOFLAGS="-mod=readonly"
  export GOTOOLCHAIN=local

  cd "${PKG_BUILD}"
  "${TOOLCHAIN}/lib/golang/bin/go" build \
    -trimpath \
    -ldflags "-s -w" \
    -o "${PKG_BUILD}/heya" \
    ./cmd/heya
}

makeinstall_target() {
  mkdir -p "${INSTALL}/usr/bin"
  install -m 0755 "${PKG_BUILD}/heya" "${INSTALL}/usr/bin/heya"
  install -m 0755 "${PKG_DIR}/scripts/heya-control" "${INSTALL}/usr/bin/heya-control"

  mkdir -p "${INSTALL}/usr/share/heya/assets" "${INSTALL}/usr/share/heya/themes/default"
  install -m 0644 "${PKG_BUILD}/assets/icons.json" "${INSTALL}/usr/share/heya/assets/icons.json"
  install -m 0644 "${PKG_BUILD}/assets/JetBrainsMonoNerdFont-Regular.ttf" \
    "${INSTALL}/usr/share/heya/assets/JetBrainsMonoNerdFont-Regular.ttf"
  install -m 0644 "${PKG_BUILD}/assets/JetBrainsMonoNerdFont-LICENSE.txt" \
    "${INSTALL}/usr/share/heya/assets/JetBrainsMonoNerdFont-LICENSE.txt"
  install -m 0644 "${PKG_BUILD}/themes/default/theme.json" \
    "${INSTALL}/usr/share/heya/themes/default/theme.json"

  mkdir -p "${INSTALL}/usr/lib/systemd/system"
  install -m 0644 "${PKG_DIR}/integrations/rocknix/heya.service" \
    "${INSTALL}/usr/lib/systemd/system/heya.service"

  mkdir -p "${INSTALL}/usr/lib/autostart/common"
  install -m 0755 "${PKG_DIR}/autostart/050-heya-apps" \
    "${INSTALL}/usr/lib/autostart/common/050-heya-apps"
}
