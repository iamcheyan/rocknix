#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <unistd.h>
#include <linux/input.h>
#include <xf86drm.h>
#include <xf86drmMode.h>
#include <drm_fourcc.h>

/* Inject a key press+release into an evdev device. */
static int inject_key(const char *dev, int code) {
    if (code < 1 || code > KEY_MAX) return 1;
    int fd = open(dev, O_WRONLY);
    if (fd < 0) return 1;
    struct input_event events[2] = {0};
    events[0].type = EV_KEY; events[0].code = code; events[0].value = 1;
    events[1].type = EV_SYN;
    if (write(fd, events, sizeof(events)) != sizeof(events)) { close(fd); return 1; }
    usleep(100000);
    events[0].value = 0;
    if (write(fd, events, sizeof(events)) != sizeof(events)) { close(fd); return 1; }
    close(fd); return 0;
}

/* Dump the first readable XRGB/ARGB plane on one DRM card as PPM to stdout.
 * Returns 0 on success, 1 if the card has no usable plane, 2 if it will not open. */
static int capture_card(const char *path) {
    int fd = open(path, O_RDWR);
    if (fd < 0) return 2;
    drmSetClientCap(fd, DRM_CLIENT_CAP_UNIVERSAL_PLANES, 1);
    drmModePlaneRes *planes = drmModeGetPlaneResources(fd);
    if (!planes) { close(fd); return 1; }
    for (uint32_t i = 0; i < planes->count_planes; ++i) {
        drmModePlane *p = drmModeGetPlane(fd, planes->planes[i]);
        uint32_t id = p ? p->fb_id : 0;
        if (p) drmModeFreePlane(p);
        if (!id) continue;
        drmModeFB2 *fb = drmModeGetFB2(fd, id);
        if (!fb) continue;
        if ((fb->pixel_format != DRM_FORMAT_XRGB8888 && fb->pixel_format != DRM_FORMAT_ARGB8888) || fb->width > 1920 || fb->height > 1080) { drmModeFreeFB2(fb); continue; }
        struct drm_mode_map_dumb map = {.handle = fb->handles[0]};
        if (ioctl(fd, DRM_IOCTL_MODE_MAP_DUMB, &map) < 0) { perror("map dumb"); drmModeFreeFB2(fb); continue; }
        size_t size = (size_t)fb->pitches[0] * fb->height;
        uint8_t *pixels = mmap(NULL, size, PROT_READ, MAP_SHARED, fd, map.offset);
        if (pixels == MAP_FAILED) { perror("mmap"); drmModeFreeFB2(fb); continue; }
        printf("P6\n%u %u\n255\n", fb->width, fb->height);
        for (uint32_t y = 0; y < fb->height; ++y) {
            uint8_t row[1920 * 3];
            for (uint32_t x = 0; x < fb->width; ++x) {
                uint8_t *s = pixels + y * fb->pitches[0] + x * 4;
                row[x*3] = s[2]; row[x*3+1] = s[1]; row[x*3+2] = s[0];
            }
            if (fwrite(row, 3, fb->width, stdout) != fb->width) { munmap(pixels, size); drmModeFreeFB2(fb); drmModeFreePlaneResources(planes); close(fd); return 1; }
        }
        munmap(pixels, size); drmModeFreeFB2(fb); drmModeFreePlaneResources(planes); close(fd); return 0;
    }
    drmModeFreePlaneResources(planes); close(fd); return 1;
}

int main(int argc, char **argv) {
    if (argc == 4 && !strcmp(argv[1], "key")) {
        return inject_key(argv[2], atoi(argv[3]));
    }
    /* Explicit card path argument. */
    if (argc > 1 && argv[1][0]) {
        return capture_card(argv[1]) == 0 ? 0 : 1;
    }
    /* Probe /dev/dri/card0..9 for the first card with a readable plane, so the
     * card number is not hardcoded (it can change across boots). */
    for (int n = 0; n < 10; ++n) {
        char path[32];
        snprintf(path, sizeof(path), "/dev/dri/card%d", n);
        if (access(path, R_OK) != 0) continue;
        int rc = capture_card(path);
        if (rc == 0) return 0;
    }
    fprintf(stderr, "No readable active XRGB/ARGB plane\n");
    return 1;
}
