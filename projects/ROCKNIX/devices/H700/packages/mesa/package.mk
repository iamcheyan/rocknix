# SPDX-License-Identifier: GPL-2.0-or-later

PKG_DIR="${ROOT}/projects/ROCKNIX/packages/graphics/mesa"
. "${PKG_DIR}/package.mk"
PKG_NEED_UNPACK+=" ${ROOT}/projects/ROCKNIX/devices/H700/packages/mesa"
PKG_STAMP="${DISPLAYSERVER} ${OPENGL} ${OPENGLES} ${VULKAN}"
