# SPDX-License-Identifier: GPL-2.0-or-later
# heya — JSON-driven launcher shell

PKG_NAME="heya"
PKG_VERSION="b865a5b1849db4e9262818825150a0674204fb1e"
PKG_SHA256="318c4f640b8150e289059ebf38f40f55d6afbfa73286501e0847ee1ab5615a56"
PKG_ARCH="any"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/iamcheyan/heya"
PKG_URL="${PKG_SITE}/archive/${PKG_VERSION}.tar.gz"
PKG_DEPENDS_TARGET="toolchain go:host SDL2 SDL2_ttf rocknix gamecontrollerdb commander foot rocknix-hotkey"
PKG_LONGDESC="Lightweight JSON-driven launcher shell for Linux handhelds"
PKG_TOOLCHAIN="manual"

make_target() {
  export CGO_ENABLED=1
  export GOOS=linux
  case "${TARGET_ARCH}" in
    aarch64) export GOARCH=arm64 ;;
    x86_64) export GOARCH=amd64 ;;
    *) die "unsupported heya architecture: ${TARGET_ARCH}" ;;
  esac
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
  install -m 0755 "${PKG_DIR}/scripts/disk-browser" "${INSTALL}/usr/bin/disk-browser"
  install -m 0755 "${PKG_DIR}/scripts/heya-terminal" "${INSTALL}/usr/bin/heya-terminal"
  install -m 0755 "${PKG_DIR}/scripts/heya-tool" "${INSTALL}/usr/bin/heya-tool"

  mkdir -p "${INSTALL}/usr/share/heya/apps" "${INSTALL}/usr/share/heya/legacy-apps"
  cp -a "${PKG_DIR}/apps/." "${INSTALL}/usr/share/heya/apps/"
  cp -a "${PKG_DIR}/legacy-apps/." "${INSTALL}/usr/share/heya/legacy-apps/"
  mkdir -p "${INSTALL}/usr/share/heya/settings"
  install -m 0644 "${PKG_DIR}/settings/services.conf" \
    "${INSTALL}/usr/share/heya/settings/services.conf"
  install -m 0644 "${PKG_DIR}/settings/tools.gptk" \
    "${INSTALL}/usr/share/heya/settings/tools.gptk"

  # Apps an earlier image shipped and this one no longer does. The seeder
  # removes these on boot; anything absent here is treated as user data.
  mkdir -p "${INSTALL}/usr/share/heya"
  install -m 0644 "${PKG_DIR}/config/removed-apps" \
    "${INSTALL}/usr/share/heya/removed-apps"
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

post_install() {
  enable_service heya.service
}
