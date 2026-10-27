# SPDX-License-Identifier: GPL-2.0
PKG_NAME="pocketjs-runtime"
PKG_VERSION="e6770376626a4de5c93eaa6fb048e7e9ffb81f9f"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/pocket-nexus/pocketjs"
PKG_URL="${PKG_SITE}/archive/${PKG_VERSION}.tar.gz"
PKG_SHA256=""
PKG_DEPENDS_TARGET="toolchain rust:host libdrm"
PKG_NEED_UNPACK="$(get_pkg_directory rust)"
PKG_GIT_CLONE_BRANCH="main"
PKG_LONGDESC="PocketJS Linux DRM/KMS and fbdev JavaScript UI runtime"
PKG_TOOLCHAIN="manual"
PKG_BUILD_FLAGS="parallel"

make_profile() {
  mkdir -p "${PKG_BUILD}/generated"
  cp "${PKG_DIR}/config/h700-profile.rs" "${PKG_BUILD}/generated/pocket_profile.rs"
}

make_target() {
  make_profile
  POCKETJS_PROFILE_RS="${PKG_BUILD}/generated/pocket_profile.rs" \
    cargo build --manifest-path "${PKG_BUILD}/Cargo.toml" --locked --release \
      --package pocket-linux-kms --target "${TARGET_NAME}"
}

makeinstall_target() {
  install -D -m 0755 "${PKG_BUILD}/target/${TARGET_NAME}/release/pocket-linux-kms" \
    "${INSTALL}/usr/libexec/pocket-linux-kms"
  install -D -m 0755 "${PKG_DIR}/scripts/pocket" "${INSTALL}/usr/bin/pocket"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketjs-session" "${INSTALL}/usr/libexec/pocketjs-session"
  install -D -m 0644 "${PKG_DIR}/hello/README.md" "${INSTALL}/usr/share/pocketjs/apps/README.md"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketjs-kms.service" \
    "${INSTALL}/usr/lib/systemd/system/pocketjs-kms.service"
}
