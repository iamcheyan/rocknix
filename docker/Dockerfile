# Stage 1: build-time tools (Python mock service + launcher).
FROM python:3.13-slim AS runtime-tools
COPY docker/mock-services.py /usr/share/rocknix-desktop/mock-services.py
COPY docker/start-mocks.sh /usr/bin/rocknix-desktop-mocks
RUN chmod 0755 /usr/bin/rocknix-desktop-mocks \
    && useradd -u 1000 -d /storage -s /usr/sbin/nologin rocknix

# Stage 2: authentic ROCKNIX userspace + mock services.
# The rootfs context is the extracted official ROCKNIX install tree
# (build.<distro>-<device>.<arch>/image/system), supplied as the named
# `rootfs` additional context by docker-compose.
FROM scratch
COPY --from=rootfs / /
COPY --from=runtime-tools /usr/share/rocknix-desktop/mock-services.py /usr/share/rocknix-desktop/mock-services.py
COPY --from=runtime-tools /usr/bin/rocknix-desktop-mocks /usr/bin/rocknix-desktop-mocks

ENV HOME=/storage \
    XDG_RUNTIME_DIR=/run/user/0 \
    WAYLAND_DISPLAY=wayland-0 \
    SDL_VIDEODRIVER=wayland \
    SDL_AUDIODRIVER=dummy \
    SDL_GAMECONTROLLERCONFIG_FILE=/usr/config/SDL-GameControllerDB/gamecontrollerdb.txt \
    CFW_NAME=ROCKNIX
WORKDIR /storage
USER 1000:1000
CMD ["/usr/bin/rocknix-desktop-mocks"]
