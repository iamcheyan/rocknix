# SPDX-License-Identifier: GPL-2.0-only

. ${ROOT}/packages/audio/openal-soft/package.mk

if [ "${PIPEWIRE_SUPPORT}" = "yes" ]; then
  PKG_DEPENDS_TARGET+=" pulseaudio"
  PKG_CMAKE_OPTS_TARGET+=" -DALSOFT_BACKEND_PULSEAUDIO=ON"
fi
