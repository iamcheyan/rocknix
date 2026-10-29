# SPDX-License-Identifier: GPL-2.0
PKG_NAME="pocketjs-runtime"
PKG_VERSION="e6770376626a4de5c93eaa6fb048e7e9ffb81f9f"
PKG_ARCH="aarch64"
PKG_LICENSE="MIT"
PKG_SITE="https://github.com/pocket-nexus/pocketjs"
PKG_URL="${PKG_SITE}/archive/${PKG_VERSION}.tar.gz"
PKG_SHA256="8b33c1f710323f384ecef63a85fae9a329aac11c7d8747d99c01bbdb538d2a87"
PKG_DEPENDS_HOST="toolchain:host bun:host"
PKG_DEPENDS_TARGET="toolchain cargo:host rust:host llvm:host pocketjs-runtime:host"
PKG_LONGDESC="PocketJS Linux DRM/KMS and fbdev JavaScript UI runtime"
PKG_TOOLCHAIN="manual"
PKG_BUILD_FLAGS="parallel"

make_host() {
  export XDG_CACHE_HOME="${PKG_BUILD}/.cache"
  mkdir -p "${XDG_CACHE_HOME}/pocket-nexus/transforms"
  cd "${PKG_BUILD}"
  export POCKETJS_FONT_REGULAR="${PKG_DIR}/hello/fonts/FusionPixel-12px-monospaced-zh_hans.ttf"
  export POCKETJS_FONT_BOLD="${PKG_DIR}/hello/fonts/FusionPixel-12px-monospaced-zh_hans.ttf"
  export POCKETJS_FONT_MONO="${PKG_DIR}/hello/fonts/FusionPixel-12px-monospaced-zh_hans.ttf"
  python3 "${PKG_DIR}/scripts/patch-build-fonts.py" "${PKG_BUILD}"
  mkdir -p "${PKG_BUILD}/programs/rocknix-h700" "${PKG_BUILD}/apps/rocknix-h700"
  cp -a "${PKG_DIR}/config/." "${PKG_BUILD}/programs/rocknix-h700/"
  cp -a "${PKG_DIR}/hello/." "${PKG_BUILD}/apps/rocknix-h700/"
  bun install --frozen-lockfile --ignore-scripts
  bun tools/pocket.ts profile export --config programs/rocknix-h700/pocket.runtime-config.ts \
    --out "${PKG_BUILD}/generated"
  bun tools/pocket.ts check --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/pocket.json
  bun tools/pocket.ts compile --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/pocket.json \
    --output "${PKG_BUILD}/generated/boot.pocket"
  bun tools/pocket.ts check --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/showcase/pocket.json
  bun tools/pocket.ts compile --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/showcase/pocket.json \
    --output "${PKG_BUILD}/generated/showcase.pocket"
  bun tools/pocket.ts check --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/library-pocket.json
  bun tools/pocket.ts compile --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
    --target rocknix-h700-kms --manifest apps/rocknix-h700/library-pocket.json \
    --output "${PKG_BUILD}/generated/library.pocket"
}

makeinstall_host() {
  mkdir -p "${TOOLCHAIN}/share/pocketjs/h700"
  install -m 0644 "${PKG_BUILD}/generated/"* "${TOOLCHAIN}/share/pocketjs/h700/"
}

make_target() {
  export RUSTC="${TOOLCHAIN}/bin/rustc"
  export LIBCLANG_PATH="${TOOLCHAIN}/lib"
  export LD_LIBRARY_PATH="${TOOLCHAIN}/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
  export BINDGEN_EXTRA_CLANG_ARGS="--target=${TARGET_NAME} --sysroot=${SYSROOT_PREFIX} -isystem ${SYSROOT_PREFIX}/usr/include"
  python3 "${PKG_DIR}/scripts/patch-runtime.py" "${PKG_BUILD}"
  python3 "${PKG_DIR}/scripts/prepare-workspace.py" "${PKG_BUILD}" "${TOOLCHAIN}/bin/cargo"
  POCKETJS_PROFILE_RS="${TOOLCHAIN}/share/pocketjs/h700/pocket_profile.rs" \
    "${TOOLCHAIN}/bin/cargo" build --manifest-path "${PKG_BUILD}/Cargo.toml" --locked --release \
      --package pocket-linux-kms --package rocknix-pocketjs-bindings --target "${TARGET_NAME}"
  "${TOOLCHAIN}/bin/cargo" build --manifest-path "${ROOT}/tools/pocketshell-dev/Cargo.toml" --locked --release --target "${TARGET_NAME}"
}

makeinstall_target() {
  install -D -m 0755 "${PKG_DIR}/scripts/pocketjs-legacy-settings" "${INSTALL}/usr/libexec/pocketjs-legacy-settings"
  install -D -m 0755 "${CARGO_TARGET_DIR}/${TARGET_NAME}/release/pocket-linux-kms" \
    "${INSTALL}/usr/libexec/pocket-linux-kms"
  install -D -m 0755 "${PKG_DIR}/scripts/pocket" "${INSTALL}/usr/bin/pocket"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketjs-session" "${INSTALL}/usr/libexec/pocketjs-session"
  install -D -m 0755 "${PKG_DIR}/scripts/pocket-session-run" "${INSTALL}/usr/bin/pocket-session-run"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketjs-native-launch" "${INSTALL}/usr/bin/pocketjs-native-launch"
  install -D -m 0644 "${TOOLCHAIN}/share/pocketjs/h700/boot.pocket" \
    "${INSTALL}/usr/share/pocketjs/apps/boot.pocket"
  install -D -m 0644 "${TOOLCHAIN}/share/pocketjs/h700/showcase.pocket" \
    "${INSTALL}/usr/share/pocketjs/apps/showcase.pocket"
  install -D -m 0644 "${TOOLCHAIN}/share/pocketjs/h700/library.pocket" \
    "${INSTALL}/usr/share/pocketjs/apps/library.pocket"
  install -D -m 0644 "${TOOLCHAIN}/share/pocketjs/h700/pocket-profile.json" \
    "${INSTALL}/usr/share/pocketjs/pocket-profile.json"
  install -D -m 0644 "${PKG_BUILD}/LICENSE" "${INSTALL}/usr/share/licenses/pocketjs-runtime/LICENSE"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketjs-kms.service" \
    "${INSTALL}/usr/lib/systemd/system/pocketjs-kms.service"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketjs-recovery.service" \
    "${INSTALL}/usr/lib/systemd/system/pocketjs-recovery.service"
  install -D -m 0755 "${PKG_DIR}/scripts/rocknix-hotkeys" \
    "${INSTALL}/usr/bin/rocknix-hotkeys"
  install -D -m 0644 "${PKG_DIR}/system.d/rocknix-hotkeys.service" "${INSTALL}/usr/lib/systemd/system/rocknix-hotkeys.service"
  install -D -m 0755 "${CARGO_TARGET_DIR}/${TARGET_NAME}/release/pocketshell-dev" "${INSTALL}/usr/libexec/pocketshell-dev"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketshell-dev" "${INSTALL}/usr/bin/pocketshell-dev"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketshell-dev.service" "${INSTALL}/usr/lib/systemd/system/pocketshell-dev.service"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketshell-games" "${INSTALL}/usr/bin/pocketshell-games"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketshell-games.service" \
    "${INSTALL}/usr/lib/systemd/system/pocketshell-games.service"
  install -D -m 0755 "${PKG_DIR}/scripts/pocketjs-sleep" "${INSTALL}/usr/libexec/pocketjs-sleep"
  install -D -m 0644 "${PKG_DIR}/system.d/pocketjs-sleep.service" "${INSTALL}/usr/lib/systemd/system/pocketjs-sleep.service"
}
