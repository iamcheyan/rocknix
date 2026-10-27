# SPDX-License-Identifier: GPL-2.0-or-later
# heya — JSON-driven launcher shell

PKG_NAME="heya"
PKG_VERSION="bca7c0510ac6c857b55c9532b9165dd332b8477c"
PKG_SHA256="cdea7d48083111777fabf2e5592b3bb97515037dd2992f8c1a33c0e5f6f20d79"
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

  if [ "${PROJECT_DEVELOPER_MODE:-${DEVELOPER_MODE:-false}}" = "true" ]; then
    "${TOOLCHAIN}/lib/golang/bin/go" build \
      -trimpath \
      -ldflags "-s -w" \
      -o "${PKG_BUILD}/devexec" \
      "${PKG_DIR}/scripts/devexec.go"
  fi
}

makeinstall_target() {
  mkdir -p "${INSTALL}/usr/bin"
  install -m 0755 "${PKG_BUILD}/heya" "${INSTALL}/usr/bin/heya"
  install -m 0755 "${PKG_DIR}/scripts/heya-control" "${INSTALL}/usr/bin/heya-control"
  if [ "${PROJECT_DEVELOPER_MODE:-${DEVELOPER_MODE:-false}}" = "true" ]; then
    install -m 0755 "${PKG_BUILD}/devexec" "${INSTALL}/usr/bin/devexec"
  fi

  mkdir -p "${INSTALL}/usr/share/heya/assets" "${INSTALL}/usr/share/heya/themes/default"
  install -m 0644 "${PKG_BUILD}/assets/icons.json" "${INSTALL}/usr/share/heya/assets/icons.json"
  install -m 0644 "${PKG_BUILD}/assets/JetBrainsMonoNerdFont-Regular.ttf" \
    "${INSTALL}/usr/share/heya/assets/JetBrainsMonoNerdFont-Regular.ttf"
  install -m 0644 "${PKG_BUILD}/assets/JetBrainsMonoNerdFont-LICENSE.txt" \
    "${INSTALL}/usr/share/heya/assets/JetBrainsMonoNerdFont-LICENSE.txt"
  install -m 0644 "${PKG_BUILD}/themes/default/theme.json" \
    "${INSTALL}/usr/share/heya/themes/default/theme.json"

  mkdir -p "${INSTALL}/usr/lib/systemd/system"
  if [ "${PROJECT_DEVELOPER_MODE:-${DEVELOPER_MODE:-false}}" = "true" ]; then
    sed 's#^ExecStart=/usr/bin/heya #ExecStart=/usr/bin/devexec /usr/bin/heya #' \
      "${PKG_DIR}/integrations/rocknix/heya.service" \
      > "${INSTALL}/usr/lib/systemd/system/heya.service"
  else
    install -m 0644 "${PKG_DIR}/integrations/rocknix/heya.service" \
      "${INSTALL}/usr/lib/systemd/system/heya.service"
  fi

  mkdir -p "${INSTALL}/usr/lib/autostart/common"
  install -m 0755 "${PKG_DIR}/autostart/050-heya-apps" \
    "${INSTALL}/usr/lib/autostart/common/050-heya-apps"
}
