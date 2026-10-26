/*
 * Handheld Launcher for Anbernic RG34XX (Allwinner H700)
 * Resolution: 720x480 (3:2 Aspect Ratio)
 * Features:
 *   - XMPlayer Integration
 *   - Pixel-perfect Views without clutter:
 *       * Non-overlapping 4-Zone Top Status Bar (No time display)
 *       * Main Menu (No numbers, cleanly spaced)
 *       * Control Center (Wi-Fi, Bluetooth, ADB default active, Volume, Brightness)
 *       * Wi-Fi Scanner & Connection Manager (Interactive live scan & connect)
 *       * Bluetooth Scanner & Pair Manager
 *       * Hardware & System Info Spec Table
 *       * Power Management Modal Dialog
 *       * Screen-Off Walkman Mode
 *   - Standardized Physical Handheld Buttons (A=Confirm, B=Cancel, D-PAD, START+SELECT)
 */

#include <SDL2/SDL.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <unistd.h>
#include <time.h>
#include <sys/statvfs.h>

#define SCREEN_WIDTH  720
#define SCREEN_HEIGHT 480

// RG34XX Physical Handheld Layout (Japanese / Nintendo: A=East, B=South, X=North, Y=West)
// In SDL standard GameController mapping:
// Physical 'A' (East)  -> SDL_CONTROLLER_BUTTON_B
// Physical 'B' (South) -> SDL_CONTROLLER_BUTTON_A
// Physical 'X' (North) -> SDL_CONTROLLER_BUTTON_Y
// Physical 'Y' (West)  -> SDL_CONTROLLER_BUTTON_X
#define BTN_CONFIRM SDL_CONTROLLER_BUTTON_B
#define BTN_CANCEL  SDL_CONTROLLER_BUTTON_A
#define BTN_RESCAN  SDL_CONTROLLER_BUTTON_Y

// Minimal 8x8 ASCII font bitmap (ASCII 32 to 126)
static const unsigned char font8x8_basic[95][8] = {
    {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00}, // 32 ' '
    {0x18,0x3C,0x3C,0x18,0x18,0x00,0x18,0x00}, // 33 '!'
    {0x66,0x66,0x24,0x00,0x00,0x00,0x00,0x00}, // 34 '"'
    {0x6C,0x6C,0xFE,0x6C,0xFE,0x6C,0x6C,0x00}, // 35 '#'
    {0x18,0x7E,0xC0,0x7C,0x06,0xFC,0x18,0x00}, // 36 '$'
    {0x00,0xC6,0xCC,0x18,0x30,0x66,0xC6,0x00}, // 37 '%'
    {0x38,0x6C,0x38,0x76,0xDC,0xCC,0x76,0x00}, // 38 '&'
    {0x18,0x18,0x30,0x00,0x00,0x00,0x00,0x00}, // 39 '''
    {0x0C,0x18,0x30,0x30,0x30,0x18,0x0C,0x00}, // 40 '('
    {0x30,0x18,0x0C,0x0C,0x0C,0x18,0x30,0x00}, // 41 ')'
    {0x00,0x66,0x3C,0xFF,0x3C,0x66,0x00,0x00}, // 42 '*'
    {0x00,0x18,0x18,0x7E,0x18,0x18,0x00,0x00}, // 43 '+'
    {0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x30}, // 44 ','
    {0x00,0x00,0x00,0x7E,0x00,0x00,0x00,0x00}, // 45 '-'
    {0x00,0x00,0x00,0x00,0x00,0x18,0x18,0x00}, // 46 '.'
    {0x06,0x0C,0x18,0x30,0x60,0xC0,0x80,0x00}, // 47 '/'
    {0x3C,0x66,0x6E,0x76,0x66,0x66,0x3C,0x00}, // 48 '0'
    {0x18,0x38,0x18,0x18,0x18,0x18,0x7E,0x00}, // 49 '1'
    {0x3C,0x66,0x06,0x1C,0x30,0x60,0x7E,0x00}, // 50 '2'
    {0x3C,0x66,0x06,0x1C,0x06,0x66,0x3C,0x00}, // 51 '3'
    {0x0C,0x1C,0x34,0x64,0x7E,0x0C,0x0C,0x00}, // 52 '4'
    {0x7E,0x60,0x7C,0x06,0x06,0x66,0x3C,0x00}, // 53 '5'
    {0x1C,0x30,0x60,0x7C,0x66,0x66,0x3C,0x00}, // 54 '6'
    {0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x00}, // 55 '7'
    {0x3C,0x66,0x66,0x3C,0x66,0x66,0x3C,0x00}, // 56 '8'
    {0x3C,0x66,0x66,0x3E,0x06,0x0C,0x38,0x00}, // 57 '9'
    {0x00,0x18,0x18,0x00,0x00,0x18,0x18,0x00}, // 58 ':'
    {0x00,0x18,0x18,0x00,0x00,0x18,0x18,0x30}, // 59 ';'
    {0x06,0x0C,0x18,0x30,0x18,0x0C,0x06,0x00}, // 60 '<'
    {0x00,0x00,0x7E,0x00,0x7E,0x00,0x00,0x00}, // 61 '='
    {0x60,0x30,0x18,0x0C,0x18,0x30,0x60,0x00}, // 62 '>'
    {0x3C,0x66,0x06,0x1C,0x18,0x00,0x18,0x00}, // 63 '?'
    {0x3C,0x66,0x6E,0x6E,0x60,0x62,0x3C,0x00}, // 64 '@'
    {0x18,0x3C,0x66,0x66,0x7E,0x66,0x66,0x00}, // 65 'A'
    {0x7C,0x66,0x66,0x7C,0x66,0x66,0x7C,0x00}, // 66 'B'
    {0x3C,0x66,0x60,0x60,0x60,0x66,0x3C,0x00}, // 67 'C'
    {0x78,0x6C,0x66,0x66,0x66,0x6C,0x78,0x00}, // 68 'D'
    {0x7E,0x60,0x60,0x7C,0x60,0x60,0x7E,0x00}, // 69 'E'
    {0x7E,0x60,0x60,0x7C,0x60,0x60,0x60,0x00}, // 70 'F'
    {0x3C,0x66,0x60,0x6E,0x66,0x66,0x3C,0x00}, // 71 'G'
    {0x66,0x66,0x66,0x7E,0x66,0x66,0x66,0x00}, // 72 'H'
    {0x3C,0x18,0x18,0x18,0x18,0x18,0x3C,0x00}, // 73 'I'
    {0x1E,0x0C,0x0C,0x0C,0x0C,0x6C,0x38,0x00}, // 74 'J'
    {0x66,0x6C,0x78,0x70,0x78,0x6C,0x66,0x00}, // 75 'K'
    {0x60,0x60,0x60,0x60,0x60,0x60,0x7E,0x00}, // 76 'L'
    {0x63,0x77,0x7F,0x6B,0x63,0x63,0x63,0x00}, // 77 'M'
    {0x66,0x76,0x7E,0x7E,0x6E,0x66,0x66,0x00}, // 78 'N'
    {0x3C,0x66,0x66,0x66,0x66,0x66,0x3C,0x00}, // 79 'O'
    {0x7C,0x66,0x66,0x7C,0x60,0x60,0x60,0x00}, // 80 'P'
    {0x3C,0x66,0x66,0x66,0x6A,0x64,0x3E,0x00}, // 81 'Q'
    {0x7C,0x66,0x66,0x7C,0x6C,0x66,0x66,0x00}, // 82 'R'
    {0x3C,0x66,0x60,0x3C,0x06,0x66,0x3C,0x00}, // 83 'S'
    {0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x00}, // 84 'T'
    {0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0x00}, // 85 'U'
    {0x66,0x66,0x66,0x66,0x66,0x3C,0x18,0x00}, // 86 'V'
    {0x63,0x63,0x63,0x6B,0x7F,0x77,0x63,0x00}, // 87 'W'
    {0x66,0x66,0x3C,0x18,0x3C,0x66,0x66,0x00}, // 88 'X'
    {0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x00}, // 89 'Y'
    {0x7E,0x06,0x0C,0x18,0x30,0x60,0x7E,0x00}, // 90 'Z'
    {0x3C,0x30,0x30,0x30,0x30,0x30,0x3C,0x00}, // 91 '['
    {0xC0,0x60,0x30,0x18,0x0C,0x06,0x02,0x00}, // 92 '\'
    {0x3C,0x0C,0x0C,0x0C,0x0C,0x0C,0x3C,0x00}, // 93 ']'
    {0x10,0x38,0x6C,0xC6,0x00,0x00,0x00,0x00}, // 94 '^'
    {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF}, // 95 '_'
    {0x30,0x18,0x0C,0x00,0x00,0x00,0x00,0x00}, // 96 '`'
    {0x00,0x00,0x3C,0x06,0x3E,0x66,0x3E,0x00}, // 97 'a'
    {0x60,0x60,0x7C,0x66,0x66,0x66,0x7C,0x00}, // 98 'b'
    {0x00,0x00,0x3C,0x66,0x60,0x66,0x3C,0x00}, // 99 'c'
    {0x06,0x06,0x3E,0x66,0x66,0x66,0x3E,0x00}, // 100 'd'
    {0x00,0x00,0x3C,0x66,0x7E,0x60,0x3C,0x00}, // 101 'e'
    {0x1C,0x30,0x78,0x30,0x30,0x30,0x30,0x00}, // 102 'f'
    {0x00,0x00,0x3E,0x66,0x66,0x3E,0x06,0x3C}, // 103 'g'
    {0x60,0x60,0x7C,0x66,0x66,0x66,0x66,0x00}, // 104 'h'
    {0x18,0x00,0x38,0x18,0x18,0x18,0x3C,0x00}, // 105 'i'
    {0x06,0x00,0x0E,0x06,0x06,0x06,0x66,0x3C}, // 106 'j'
    {0x60,0x60,0x66,0x6C,0x78,0x6C,0x66,0x00}, // 107 'k'
    {0x38,0x18,0x18,0x18,0x18,0x18,0x3C,0x00}, // 108 'l'
    {0x00,0x00,0x66,0x7F,0x7F,0x6B,0x63,0x00}, // 109 'm'
    {0x00,0x00,0x7C,0x66,0x66,0x66,0x66,0x00}, // 110 'n'
    {0x00,0x00,0x3C,0x66,0x66,0x66,0x3C,0x00}, // 111 'o'
    {0x00,0x00,0x7C,0x66,0x66,0x7C,0x60,0x60}, // 112 'p'
    {0x00,0x00,0x3E,0x66,0x66,0x3E,0x06,0x06}, // 113 'q'
    {0x00,0x00,0x7C,0x66,0x60,0x60,0x60,0x00}, // 114 'r'
    {0x00,0x00,0x3E,0x60,0x3C,0x06,0x7C,0x00}, // 115 's'
    {0x18,0x18,0x7E,0x18,0x18,0x18,0x0E,0x00}, // 116 't'
    {0x00,0x00,0x66,0x66,0x66,0x66,0x3E,0x00}, // 117 'u'
    {0x00,0x00,0x66,0x66,0x66,0x3C,0x18,0x00}, // 118 'v'
    {0x00,0x00,0x63,0x6B,0x7F,0x3E,0x36,0x00}, // 119 'w'
    {0x00,0x00,0x66,0x3C,0x18,0x3C,0x66,0x00}, // 120 'x'
    {0x00,0x00,0x66,0x66,0x66,0x3E,0x06,0x3C}, // 121 'y'
    {0x00,0x00,0x7E,0x0C,0x18,0x30,0x7E,0x00}, // 122 'z'
    {0x0E,0x18,0x18,0x70,0x18,0x18,0x0E,0x00}, // 123 '{'
    {0x18,0x18,0x18,0x18,0x18,0x18,0x18,0x00}, // 124 '|'
    {0x70,0x18,0x18,0x0E,0x18,0x18,0x70,0x00}, // 125 '}'
    {0x76,0xDC,0x00,0x00,0x00,0x00,0x00,0x00}  // 126 '~'
};

void draw_char(SDL_Renderer* ren, char c, int x, int y, int scale, SDL_Color color) {
    if (c < 32 || c > 126) c = ' ';
    int idx = c - 32;
    SDL_SetRenderDrawColor(ren, color.r, color.g, color.b, color.a);
    for (int row = 0; row < 8; row++) {
        unsigned char bits = font8x8_basic[idx][row];
        for (int col = 0; col < 8; col++) {
            if ((bits >> (7 - col)) & 1) {
                SDL_Rect r = { x + col * scale, y + row * scale, scale, scale };
                SDL_RenderFillRect(ren, &r);
            }
        }
    }
}

void draw_string(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color) {
    int cur_x = x;
    while (*str) {
        draw_char(ren, *str, cur_x, y, scale, color);
        cur_x += 8 * scale;
        str++;
    }
}

void draw_string_right(SDL_Renderer* ren, const char* str, int right_x, int y, int scale, SDL_Color color) {
    int len = (int)strlen(str);
    int start_x = right_x - (len * 8 * scale);
    draw_string(ren, str, start_x, y, scale, color);
}

void draw_string_marquee(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color, int max_w, bool active, Uint32 ticks) {
    int char_w = 8 * scale;
    int str_len = (int)strlen(str);
    int total_w = str_len * char_w;

    SDL_Rect clip_rect = {x, y, max_w, 8 * scale};
    SDL_RenderSetClipRect(ren, &clip_rect);

    if (total_w <= max_w) {
        draw_string(ren, str, x, y, scale, color);
    } else {
        if (!active) {
            draw_string(ren, str, x, y, scale, color);
        } else {
            int overflow = total_w - max_w + (char_w * 4);
            int speed = 40; // ms per pixel
            int phase = (ticks / speed) % (overflow + 40);
            int offset = 0;
            if (phase > 20) {
                offset = phase - 20;
                if (offset > overflow) offset = overflow;
            }
            draw_string(ren, str, x - offset, y, scale, color);
            draw_string(ren, str, x - offset + total_w + (char_w * 4), y, scale, color);
        }
    }

    SDL_RenderSetClipRect(ren, NULL);
}

void launch_xmplayer(SDL_Window* win) {
    SDL_HideWindow(win);
    printf("==> Pausing Launcher, launching XMPlayer...\n");

    const char* cmd = NULL;
    if (access("/usr/bin/xmplayer", X_OK) == 0) {
        cmd = "/usr/bin/xmplayer >/tmp/xmplayer.log 2>&1";
    } else if (access("/usr/share/xmplayer/bin/love", X_OK) == 0) {
        cmd = "export LD_LIBRARY_PATH=/usr/share/xmplayer/libs:/usr/lib/compat:$LD_LIBRARY_PATH PATH=/usr/share/xmplayer/bin:$PATH HOME=/storage; cd /usr/share/xmplayer && /usr/share/xmplayer/bin/love /usr/share/xmplayer >/tmp/xmplayer.log 2>&1";
    } else if (access("projects/ROCKNIX/packages/apps/xmplayer/app/main.lua", F_OK) == 0) {
        cmd = "nix-shell -p love --run 'love projects/ROCKNIX/packages/apps/xmplayer/app'";
    } else {
        cmd = "love /usr/share/xmplayer >/tmp/xmplayer.log 2>&1";
    }

    int ret = system(cmd);
    (void)ret;

    printf("==> XMPlayer exited, restoring Launcher...\n");
    SDL_ShowWindow(win);
    SDL_RaiseWindow(win);
}

typedef enum {
    VIEW_MAIN_MENU,
    VIEW_CONTROL_CENTER,
    VIEW_SYSTEM_INFO,
    VIEW_POWER_DIALOG,
    VIEW_WIFI_MENU,
    VIEW_BT_MENU
} ViewState;

typedef enum {
    USB_MODE_ADB = 0,
    USB_MODE_MTP = 1,
    USB_MODE_NET = 2,
    USB_MODE_OFF = 3,
    USB_MODE_COUNT = 4
} UsbMode;

static const char* g_usb_mode_names[USB_MODE_COUNT] = {
    "USB ADB DEBUG",
    "MTP PC DISK",
    "USB NETWORK",
    "CHARGING ONLY"
};

static const char* g_usb_short_names[USB_MODE_COUNT] = {
    "USB: ADB",
    "USB: MTP",
    "USB: NET",
    "USB: CHG"
};

// System Settings State (Default ADB Active)
static int g_brightness = 80;
static int g_volume = 75;
static UsbMode g_usb_mode = USB_MODE_ADB;
static bool g_wifi_enabled = true;
static bool g_bt_enabled = false;
static bool g_wifi_adb_enabled = true;

// Host PC Safety Guard
static bool is_target_device(void) {
    if (getenv("ROCKNIX_SIMULATOR") != NULL) return false;
    return (access("/etc/rocknix-release", F_OK) == 0 || access("/storage/.config", F_OK) == 0);
}

#include "system_tools.c"


static void do_reboot(void) {
    if (is_target_device()) {
        (void)!system("reboot 2>/dev/null");
    } else {
        printf("\n[SIMULATOR GUARD] Reboot requested: Simulated on PC host.\n\n");
    }
}

static void do_poweroff(bool* running) {
    if (is_target_device()) {
        (void)!system("poweroff 2>/dev/null");
    } else {
        printf("\n[SIMULATOR GUARD] Power off requested: Exiting simulator cleanly.\n\n");
        if (running) *running = false;
    }
}

static void do_restart_launcher(void) {
    if (is_target_device()) {
        (void)!system("systemctl restart handheld-launcher 2>/dev/null");
    } else {
        printf("\n[SIMULATOR GUARD] Restart launcher requested: Simulated on PC host.\n\n");
    }
}

// Hardware & Telemetry Helpers
static void get_ip_info(char* buf, size_t max_len) {
    FILE* fp = popen("ip -4 addr show up | grep -E 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -n1", "r");
    if (fp) {
        if (fgets(buf, max_len, fp)) {
            buf[strcspn(buf, "\r\n")] = 0;
            pclose(fp);
            if (strlen(buf) > 0) return;
        } else {
            pclose(fp);
        }
    }
    snprintf(buf, max_len, "Disconnected");
}

static void get_storage_info(char* buf, size_t max_len) {
    struct statvfs st;
    const char* target = "/storage";
    if (access(target, F_OK) != 0) target = ".";
    if (statvfs(target, &st) == 0) {
        double free_gb = (double)(st.f_bavail * st.f_frsize) / (1024.0 * 1024.0 * 1024.0);
        double total_gb = (double)(st.f_blocks * st.f_frsize) / (1024.0 * 1024.0 * 1024.0);
        snprintf(buf, max_len, "%.1fG / %.1fG", free_gb, total_gb);
    } else {
        snprintf(buf, max_len, "54.2G / 64G");
    }
}

static void get_battery_info(char* buf, size_t max_len) {
    FILE* f = fopen("/sys/class/power_supply/axp20x-battery/capacity", "r");
    if (!f) f = fopen("/sys/class/power_supply/battery/capacity", "r");
    int cap = 92;
    if (f) {
        if (fscanf(f, "%d", &cap) != 1) cap = 92;
        fclose(f);
    }
    snprintf(buf, max_len, "%d%%", cap);
}

static void get_cpu_temp(char* buf, size_t max_len) {
    FILE* f = fopen("/sys/class/thermal/thermal_zone0/temp", "r");
    int temp = 43000;
    if (f) {
        if (fscanf(f, "%d", &temp) != 1) temp = 43000;
        fclose(f);
    }
    snprintf(buf, max_len, "%.1fC @ 1.5GHz", (double)temp / 1000.0);
}

void apply_brightness(int delta) {
    g_brightness += delta;
    if (g_brightness > 100) g_brightness = 100;
    if (g_brightness < 10) g_brightness = 10;
    if (is_target_device()) {
        char cmd[128];
        snprintf(cmd, sizeof(cmd), "brightness set %d >/dev/null 2>&1", g_brightness);
        (void)!system(cmd);
    }
}

void apply_volume(int delta) {
    g_volume += delta;
    if (g_volume > 100) g_volume = 100;
    if (g_volume < 0) g_volume = 0;
    if (is_target_device()) {
        char cmd[128];
        snprintf(cmd, sizeof(cmd), "amixer -q set Master %d%% >/dev/null 2>&1", g_volume);
        (void)!system(cmd);
    }
}

void apply_usb_mode() {
    if (!is_target_device()) {
        printf("[SIMULATOR GUARD] USB Mode changed to: %s (simulated)\n", g_usb_mode_names[g_usb_mode]);
        return;
    }
    switch (g_usb_mode) {
        case USB_MODE_ADB:
            (void)!system("usbgadget adb >/dev/null 2>&1");
            break;
        case USB_MODE_MTP:
            (void)!system("usbgadget file_transfer >/dev/null 2>&1");
            break;
        case USB_MODE_NET:
            (void)!system("usbgadget network >/dev/null 2>&1");
            break;
        case USB_MODE_OFF:
        default:
            (void)!system("usbgadget disabled >/dev/null 2>&1");
            break;
    }
}

void enter_walkman_mode(SDL_Renderer* ren) {
    printf("==> Walkman Mode: Blanking LCD screen. Audio continues in background.\n");
    if (is_target_device()) {
        (void)!system("echo 4 > /sys/class/backlight/*/bl_power 2>/dev/null || brightness set 0 >/dev/null 2>&1");
    }

    SDL_SetRenderDrawColor(ren, 0, 0, 0, 255);
    SDL_RenderClear(ren);
    SDL_RenderPresent(ren);

    bool sleeping = true;
    SDL_Event we;
    while (sleeping) {
        while (SDL_PollEvent(&we)) {
            if (we.type == SDL_KEYDOWN || we.type == SDL_CONTROLLERBUTTONDOWN || we.type == SDL_QUIT) {
                sleeping = false;
                break;
            }
        }
        SDL_Delay(50);
    }

    if (is_target_device()) {
        char cmd[128];
        snprintf(cmd, sizeof(cmd), "echo 0 > /sys/class/backlight/*/bl_power 2>/dev/null; brightness set %d >/dev/null 2>&1", g_brightness);
        (void)!system(cmd);
    }
    printf("==> Walkman Mode Exited: LCD backlight restored.\n");
}

// Interactive Wi-Fi Scanner & Connection Management
#define MAX_WIFI_NETWORKS 16
typedef struct {
    char ssid[48];
    int signal;
    bool in_use;
    bool secure;
} WifiNetwork;

static WifiNetwork g_wifi_list[MAX_WIFI_NETWORKS];
static int g_wifi_count = 0;
static int g_wifi_selected_idx = 0;
static char g_wifi_status_msg[64] = "Press [A] to connect";

static void scan_wifi_networks(void) {
    g_wifi_count = 0;
    g_wifi_selected_idx = 0;
    snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Scanning Wi-Fi...");

    FILE* fp = popen("nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY dev wifi list 2>/dev/null | head -n 16", "r");
    if (!fp) {
        snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Scan failed or no wifi device");
        return;
    }

    char line[128];
    while (fgets(line, sizeof(line), fp) && g_wifi_count < MAX_WIFI_NETWORKS) {
        line[strcspn(line, "\r\n")] = 0;
        if (strlen(line) == 0) continue;

        char* colon1 = strchr(line, ':');
        if (!colon1) continue;
        bool in_use = (line[0] == '*');

        char* ssid_start = colon1 + 1;
        char* colon2 = strchr(ssid_start, ':');
        if (!colon2) continue;
        *colon2 = 0;

        char* signal_str = colon2 + 1;
        char* colon3 = strchr(signal_str, ':');
        int signal = 70;
        bool secure = true;
        if (colon3) {
            *colon3 = 0;
            signal = atoi(signal_str);
            char* sec_str = colon3 + 1;
            if (strlen(sec_str) == 0 || strcmp(sec_str, "--") == 0) secure = false;
        } else {
            signal = atoi(signal_str);
        }

        if (strlen(ssid_start) == 0) continue;

        bool exists = false;
        for (int i = 0; i < g_wifi_count; i++) {
            if (strcmp(g_wifi_list[i].ssid, ssid_start) == 0) {
                exists = true;
                break;
            }
        }
        if (exists) continue;

        snprintf(g_wifi_list[g_wifi_count].ssid, sizeof(g_wifi_list[g_wifi_count].ssid), "%s", ssid_start);
        g_wifi_list[g_wifi_count].signal = signal;
        g_wifi_list[g_wifi_count].in_use = in_use;
        g_wifi_list[g_wifi_count].secure = secure;
        g_wifi_count++;
    }
    pclose(fp);

    if (g_wifi_count == 0) {
        snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "No Wi-Fi networks found");
    } else {
        snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Found %d networks. [A] Connect", g_wifi_count);
    }
}

static void connect_selected_wifi(int idx) {
    if (idx < 0 || idx >= g_wifi_count) return;
    char cmd[256];
    snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Connecting to %s...", g_wifi_list[idx].ssid);
    snprintf(cmd, sizeof(cmd), "nmcli dev wifi connect \"%s\" >/dev/null 2>&1 || wifictl connect \"%s\" >/dev/null 2>&1",
             g_wifi_list[idx].ssid, g_wifi_list[idx].ssid);
    int res = system(cmd);
    if (res == 0) {
        snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Connected to %s!", g_wifi_list[idx].ssid);
        g_wifi_list[idx].in_use = true;
    } else {
        snprintf(g_wifi_status_msg, sizeof(g_wifi_status_msg), "Connecting initiated in background");
    }
}

// Interactive Bluetooth Scanner & Pair Management
#define MAX_BT_DEVICES 16
typedef struct {
    char name[48];
    char mac[20];
    bool connected;
} BtDevice;

static BtDevice g_bt_list[MAX_BT_DEVICES];
static int g_bt_count = 0;
static int g_bt_selected_idx = 0;
static char g_bt_status_msg[64] = "Press [A] to pair/connect";

static void scan_bt_devices(void) {
    g_bt_count = 0;
    g_bt_selected_idx = 0;
    snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Scanning Bluetooth devices...");

    (void)!system("bluetoothctl --timeout 3 scan on >/dev/null 2>&1 &");
    FILE* fp = popen("bluetoothctl devices 2>/dev/null | head -n 16", "r");
    if (!fp) {
        snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Bluetooth not available");
        return;
    }

    char line[128];
    while (fgets(line, sizeof(line), fp) && g_bt_count < MAX_BT_DEVICES) {
        line[strcspn(line, "\r\n")] = 0;
        if (strncmp(line, "Device ", 7) != 0) continue;
        char mac[20] = {0};
        char name[48] = {0};
        if (sscanf(line, "Device %19s %47[^\n]", mac, name) >= 1) {
            if (strlen(name) == 0) snprintf(name, sizeof(name), "%s", mac);
            snprintf(g_bt_list[g_bt_count].mac, sizeof(g_bt_list[g_bt_count].mac), "%s", mac);
            snprintf(g_bt_list[g_bt_count].name, sizeof(g_bt_list[g_bt_count].name), "%s", name);
            g_bt_list[g_bt_count].connected = false;
            g_bt_count++;
        }
    }
    pclose(fp);

    if (g_bt_count == 0) {
        snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "No devices found. Ensure BT is on.");
    } else {
        snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Found %d devices. [A] Connect", g_bt_count);
    }
}

static void connect_selected_bt(int idx) {
    if (idx < 0 || idx >= g_bt_count) return;
    char cmd[128];
    snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Pairing %s...", g_bt_list[idx].name);
    snprintf(cmd, sizeof(cmd), "bluetoothctl connect %s >/dev/null 2>&1", g_bt_list[idx].mac);
    int res = system(cmd);
    if (res == 0) {
        snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Connected to %s!", g_bt_list[idx].name);
        g_bt_list[idx].connected = true;
    } else {
        snprintf(g_bt_status_msg, sizeof(g_bt_status_msg), "Connection request sent");
    }
}

static void save_screenshot(SDL_Renderer* ren, const char* filepath) {
    SDL_Surface* sshot = SDL_CreateRGBSurfaceWithFormat(0, SCREEN_WIDTH, SCREEN_HEIGHT, 32, SDL_PIXELFORMAT_ARGB8888);
    if (sshot) {
        SDL_RenderReadPixels(ren, NULL, SDL_PIXELFORMAT_ARGB8888, sshot->pixels, sshot->pitch);
        SDL_SaveBMP(sshot, filepath);
        SDL_FreeSurface(sshot);
    }
}

int main(int argc, char* argv[]) {
    (void)argc;
    (void)argv;

    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_JOYSTICK | SDL_INIT_GAMECONTROLLER) != 0) {
        fprintf(stderr, "SDL_Init Error: %s\n", SDL_GetError());
        return 1;
    }

    SDL_Window* win = SDL_CreateWindow(
        "ROCKNIX Handheld Simulator (RG34XX - 720x480)",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
        SCREEN_WIDTH, SCREEN_HEIGHT,
        SDL_WINDOW_SHOWN
    );
    if (!win) {
        fprintf(stderr, "SDL_CreateWindow Error: %s\n", SDL_GetError());
        SDL_Quit();
        return 1;
    }

    SDL_Renderer* ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (!ren) {
        ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_SOFTWARE);
    }

    SDL_GameController* controller = NULL;
    if (SDL_NumJoysticks() > 0) {
        controller = SDL_GameControllerOpen(0);
    }

    // Default: Apply ADB Mode & Start Background ADB Daemon
    apply_usb_mode();

    ViewState state = VIEW_MAIN_MENU;
    const char* main_menu_items[] = {
        "Launch XMPlayer (XMB Media Suite)",
        "System Settings & Control Center",
        "System Tools & Support",
        "Hardware & System Info (Live)",
        "Power Management / Reboot"
    };
    int main_menu_count = 5;
    int main_selected_idx = 0;

    int cp_idx = 0;
    const int cp_count = 15;
    int cp_scroll_offset = 0;
    const int cp_visible_count = 6;

    int info_idx = 0;
    int info_scroll_offset = 0;
    const int info_count = 8;
    const int info_visible_count = 6;

    int power_idx = 0;
    const int power_count = 4;
    const char* power_items[] = {
        "Restart Launcher UI",
        "Reboot Handheld",
        "Power Off Hardware",
        "Cancel / Return"
    };

    bool dump_mode = (argc > 1 && strcmp(argv[1], "--dump-screens") == 0);
    bool running = true;
    SDL_Event e;

    SDL_Color c_white  = {255, 255, 255, 255};
    SDL_Color c_accent = {255, 196, 0, 255};
    SDL_Color c_gray   = {160, 160, 160, 255};
    SDL_Color c_cyan   = {0, 220, 255, 255};
    SDL_Color c_green  = {80, 240, 120, 255};
    SDL_Color c_red    = {255, 90, 90, 255};
    SDL_Color c_dark   = {20, 24, 32, 255};
    SDL_Color c_panel  = {32, 38, 50, 255};

    while (running) {
        Uint32 ticks = SDL_GetTicks();

        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) {
                running = false;
            } else if (e.type == SDL_KEYDOWN) {
                SDL_Keycode k = e.key.keysym.sym;

                if (k == SDLK_ESCAPE) {
                    if (state == VIEW_MAIN_MENU) running = false;
                    else if (state == VIEW_WIFI_MENU || state == VIEW_BT_MENU) state = VIEW_CONTROL_CENTER;
                    else state = VIEW_MAIN_MENU;
                }

                if (state == VIEW_MAIN_MENU) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        main_selected_idx = (main_selected_idx - 1 + main_menu_count) % main_menu_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        main_selected_idx = (main_selected_idx + 1) % main_menu_count;
                    } else if (k == SDLK_RETURN || k == SDLK_SPACE) {
                        if (main_selected_idx == 0) launch_xmplayer(win);
                        else if (main_selected_idx == 1) state = VIEW_CONTROL_CENTER;
                        else if (main_selected_idx == 2) launcher_open_settings(ren);
                        else if (main_selected_idx == 3) launcher_open_system_info(ren);
                        else if (main_selected_idx == 4) state = VIEW_POWER_DIALOG;
                    }
                } else if (state == VIEW_CONTROL_CENTER) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        cp_idx = (cp_idx + 1) % cp_count;
                    } else if (k == SDLK_LEFT || k == SDLK_a) {
                        if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode - 1 + USB_MODE_COUNT) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 7) apply_brightness(-5);
                        else if (cp_idx == 9) apply_volume(-5);
                    } else if (k == SDLK_RIGHT || k == SDLK_d) {
                        if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 7) apply_brightness(+5);
                        else if (cp_idx == 9) apply_volume(+5);
                    } else if (k == SDLK_RETURN || k == SDLK_SPACE) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            (void)!system(g_wifi_enabled ? "wifictl enable >/dev/null 2>&1" : "wifictl disable >/dev/null 2>&1");
                        } else if (cp_idx == 1) {
                            scan_wifi_networks();
                            state = VIEW_WIFI_MENU;
                        } else if (cp_idx == 3) {
                            g_bt_enabled = !g_bt_enabled;
                            (void)!system(g_bt_enabled ? "rocknix-bluetooth on >/dev/null 2>&1" : "rocknix-bluetooth off >/dev/null 2>&1");
                        } else if (cp_idx == 4) {
                            scan_bt_devices();
                            state = VIEW_BT_MENU;
                        } else if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 6) {
                            g_wifi_adb_enabled = !g_wifi_adb_enabled;
                            (void)!system(g_wifi_adb_enabled ? "systemctl restart adbd >/dev/null 2>&1; usbgadget adb_tcp >/dev/null 2>&1" : "systemctl stop adbd >/dev/null 2>&1; usbgadget adb_tcp_stop >/dev/null 2>&1");
                        } else if (cp_idx == 8) {
                            enter_walkman_mode(ren);
                        } else if (cp_idx == 11) {
                            do_restart_launcher();
                        } else if (cp_idx == 12) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        } else if (cp_idx == 13) {
                            do_poweroff(&running);
                        } else if (cp_idx == 14) {
                            state = VIEW_MAIN_MENU;
                        }
                    } else if (k == SDLK_BACKSPACE) {
                        state = VIEW_MAIN_MENU;
                    }
                } else if (state == VIEW_WIFI_MENU) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        if (g_wifi_count > 0) g_wifi_selected_idx = (g_wifi_selected_idx - 1 + g_wifi_count) % g_wifi_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        if (g_wifi_count > 0) g_wifi_selected_idx = (g_wifi_selected_idx + 1) % g_wifi_count;
                    } else if (k == SDLK_RETURN || k == SDLK_SPACE) {
                        connect_selected_wifi(g_wifi_selected_idx);
                    } else if (k == SDLK_r) {
                        scan_wifi_networks();
                    } else if (k == SDLK_BACKSPACE) {
                        state = VIEW_CONTROL_CENTER;
                    }
                } else if (state == VIEW_BT_MENU) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        if (g_bt_count > 0) g_bt_selected_idx = (g_bt_selected_idx - 1 + g_bt_count) % g_bt_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        if (g_bt_count > 0) g_bt_selected_idx = (g_bt_selected_idx + 1) % g_bt_count;
                    } else if (k == SDLK_RETURN || k == SDLK_SPACE) {
                        connect_selected_bt(g_bt_selected_idx);
                    } else if (k == SDLK_r) {
                        scan_bt_devices();
                    } else if (k == SDLK_BACKSPACE) {
                        state = VIEW_CONTROL_CENTER;
                    }
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        info_idx = (info_idx - 1 + info_count) % info_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        info_idx = (info_idx + 1) % info_count;
                    } else if (k == SDLK_BACKSPACE || k == SDLK_RETURN || k == SDLK_SPACE) {
                        state = VIEW_MAIN_MENU;
                    }
                } else if (state == VIEW_POWER_DIALOG) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        power_idx = (power_idx - 1 + power_count) % power_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        power_idx = (power_idx + 1) % power_count;
                    } else if (k == SDLK_RETURN || k == SDLK_SPACE) {
                        if (power_idx == 0) do_restart_launcher();
                        else if (power_idx == 1) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        }
                        else if (power_idx == 2) do_poweroff(&running);
                        else if (power_idx == 3) state = VIEW_MAIN_MENU;
                    } else if (k == SDLK_BACKSPACE) {
                        state = VIEW_MAIN_MENU;
                    }
                }
            } else if (e.type == SDL_CONTROLLERBUTTONDOWN) {
                Uint8 btn = e.cbutton.button;

                // COMBO EXIT: START + SELECT pressed together
                if ((btn == SDL_CONTROLLER_BUTTON_START && SDL_GameControllerGetButton(controller, SDL_CONTROLLER_BUTTON_BACK)) ||
                    (btn == SDL_CONTROLLER_BUTTON_BACK && SDL_GameControllerGetButton(controller, SDL_CONTROLLER_BUTTON_START))) {
                    running = false;
                    break;
                }

                if (state == VIEW_MAIN_MENU) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) main_selected_idx = (main_selected_idx - 1 + main_menu_count) % main_menu_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) main_selected_idx = (main_selected_idx + 1) % main_menu_count;
                    if (btn == BTN_CONFIRM) {
                        if (main_selected_idx == 0) launch_xmplayer(win);
                        else if (main_selected_idx == 1) state = VIEW_CONTROL_CENTER;
                        else if (main_selected_idx == 2) launcher_open_settings(ren);
                        else if (main_selected_idx == 3) launcher_open_system_info(ren);
                        else if (main_selected_idx == 4) state = VIEW_POWER_DIALOG;
                    }
                } else if (state == VIEW_CONTROL_CENTER) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) cp_idx = (cp_idx + 1) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_LEFT) {
                        if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode - 1 + USB_MODE_COUNT) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 7) apply_brightness(-5);
                        else if (cp_idx == 9) apply_volume(-5);
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_RIGHT) {
                        if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 7) apply_brightness(+5);
                        else if (cp_idx == 9) apply_volume(+5);
                    }
                    if (btn == BTN_CONFIRM) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            (void)!system(g_wifi_enabled ? "wifictl enable >/dev/null 2>&1" : "wifictl disable >/dev/null 2>&1");
                        } else if (cp_idx == 1) {
                            scan_wifi_networks();
                            state = VIEW_WIFI_MENU;
                        } else if (cp_idx == 3) {
                            g_bt_enabled = !g_bt_enabled;
                            (void)!system(g_bt_enabled ? "rocknix-bluetooth on >/dev/null 2>&1" : "rocknix-bluetooth off >/dev/null 2>&1");
                        } else if (cp_idx == 4) {
                            scan_bt_devices();
                            state = VIEW_BT_MENU;
                        } else if (cp_idx == 5) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 6) {
                            g_wifi_adb_enabled = !g_wifi_adb_enabled;
                            (void)!system(g_wifi_adb_enabled ? "systemctl restart adbd >/dev/null 2>&1; usbgadget adb_tcp >/dev/null 2>&1" : "systemctl stop adbd >/dev/null 2>&1; usbgadget adb_tcp_stop >/dev/null 2>&1");
                        } else if (cp_idx == 8) {
                            enter_walkman_mode(ren);
                        } else if (cp_idx == 11) {
                            do_restart_launcher();
                        } else if (cp_idx == 12) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        } else if (cp_idx == 13) {
                            do_poweroff(&running);
                        } else if (cp_idx == 14) {
                            state = VIEW_MAIN_MENU;
                        }
                    }
                    if (btn == BTN_CANCEL) state = VIEW_MAIN_MENU;
                } else if (state == VIEW_WIFI_MENU) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) {
                        if (g_wifi_count > 0) g_wifi_selected_idx = (g_wifi_selected_idx - 1 + g_wifi_count) % g_wifi_count;
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) {
                        if (g_wifi_count > 0) g_wifi_selected_idx = (g_wifi_selected_idx + 1) % g_wifi_count;
                    }
                    if (btn == BTN_CONFIRM) {
                        connect_selected_wifi(g_wifi_selected_idx);
                    }
                    if (btn == BTN_RESCAN) {
                        scan_wifi_networks();
                    }
                    if (btn == BTN_CANCEL) state = VIEW_CONTROL_CENTER;
                } else if (state == VIEW_BT_MENU) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) {
                        if (g_bt_count > 0) g_bt_selected_idx = (g_bt_selected_idx - 1 + g_bt_count) % g_bt_count;
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) {
                        if (g_bt_count > 0) g_bt_selected_idx = (g_bt_selected_idx + 1) % g_bt_count;
                    }
                    if (btn == BTN_CONFIRM) {
                        connect_selected_bt(g_bt_selected_idx);
                    }
                    if (btn == BTN_RESCAN) {
                        scan_bt_devices();
                    }
                    if (btn == BTN_CANCEL) state = VIEW_CONTROL_CENTER;
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) info_idx = (info_idx - 1 + info_count) % info_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) info_idx = (info_idx + 1) % info_count;
                    if (btn == BTN_CANCEL || btn == BTN_CONFIRM) state = VIEW_MAIN_MENU;
                } else if (state == VIEW_POWER_DIALOG) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) power_idx = (power_idx - 1 + power_count) % power_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) power_idx = (power_idx + 1) % power_count;
                    if (btn == BTN_CONFIRM) {
                        if (power_idx == 0) do_restart_launcher();
                        else if (power_idx == 1) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        }
                        else if (power_idx == 2) do_poweroff(&running);
                        else if (power_idx == 3) state = VIEW_MAIN_MENU;
                    }
                    if (btn == BTN_CANCEL) state = VIEW_MAIN_MENU;
                }
            }
        }

        // Adjust scroll offset
        if (cp_idx < cp_scroll_offset) {
            cp_scroll_offset = cp_idx;
        } else if (cp_idx >= cp_scroll_offset + cp_visible_count) {
            cp_scroll_offset = cp_idx - cp_visible_count + 1;
        }

        if (info_idx < info_scroll_offset) {
            info_scroll_offset = info_idx;
        } else if (info_idx >= info_scroll_offset + info_visible_count) {
            info_scroll_offset = info_idx - info_visible_count + 1;
        }

        // Render Background
        SDL_SetRenderDrawColor(ren, c_dark.r, c_dark.g, c_dark.b, 255);
        SDL_RenderClear(ren);

        // 1. Top Status Bar (Height 36px, strictly non-overlapping, NO TIME)
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect top_bar = {0, 0, SCREEN_WIDTH, 36};
        SDL_RenderFillRect(ren, &top_bar);

        char bat_str[32];
        get_battery_info(bat_str, sizeof(bat_str));
        char bat_disp[40];
        snprintf(bat_disp, sizeof(bat_disp), "BAT: %s", bat_str);

        // Dynamically spaced 4 zones (Time completely removed):
        draw_string(ren, "RG34XX DEV", 28, 10, 2, c_cyan);
        draw_string(ren, g_wifi_enabled ? "WIFI: ON" : "WIFI: OFF", 220, 10, 2, g_wifi_enabled ? c_green : c_gray);
        draw_string(ren, g_usb_short_names[g_usb_mode], 380, 10, 2, c_accent);
        draw_string(ren, bat_disp, 560, 10, 2, c_white);

        // 2. Main Content
        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "=== ANBERNIC RG34XX DEV LAUNCHER ===", 75, 48, 2, c_accent);

            for (int i = 0; i < main_menu_count; i++) {
                int item_y = 96 + i * 58;
                bool is_sel = (i == main_selected_idx);

                SDL_Rect r = {45, item_y - 4, 620, 48};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 20, item_y + 11, 2, c_accent);
                    draw_string(ren, main_menu_items[i], 60, item_y + 11, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, main_menu_items[i], 60, item_y + 11, 2, c_gray);
                }
            }

        } else if (state == VIEW_CONTROL_CENTER) {
            draw_string(ren, "=== SYSTEM CONTROL CENTER & SETTINGS ===", 55, 48, 2, c_cyan);

            char storage_str[48];
            get_storage_info(storage_str, sizeof(storage_str));
            char temp_str[48];
            get_cpu_temp(temp_str, sizeof(temp_str));
            char ip_str[48];
            get_ip_info(ip_str, sizeof(ip_str));

            char cp_titles[15][32] = {
                "Wi-Fi Wireless",
                "Wi-Fi Networks",
                "Wi-Fi IP Address",
                "Bluetooth Radio",
                "Bluetooth Devices",
                "USB-C Data Role",
                "Wireless ADB",
                "Screen Brightness",
                "Walkman Mode",
                "Audio Volume",
                "SD Free Space",
                "CPU Telemetry",
                "Restart UI",
                "Reboot Handheld",
                "Power Off"
            };

            char cp_values[15][48];
            snprintf(cp_values[0], sizeof(cp_values[0]), "[%s]", g_wifi_enabled ? "ENABLED" : "DISABLED");
            snprintf(cp_values[1], sizeof(cp_values[1]), "[Scan & Connect >]");
            snprintf(cp_values[2], sizeof(cp_values[2]), "%s", ip_str);
            snprintf(cp_values[3], sizeof(cp_values[3]), "[%s]", g_bt_enabled ? "ON" : "OFF");
            snprintf(cp_values[4], sizeof(cp_values[4]), "[Scan & Pair >]");
            snprintf(cp_values[5], sizeof(cp_values[5]), "< %s >", g_usb_mode_names[g_usb_mode]);
            snprintf(cp_values[6], sizeof(cp_values[6]), "[%s:5555]", g_wifi_adb_enabled ? "ACTIVE" : "DISABLED");
            snprintf(cp_values[7], sizeof(cp_values[7]), "< %d%% >", g_brightness);
            snprintf(cp_values[8], sizeof(cp_values[8]), "[Sleep Screen]");
            snprintf(cp_values[9], sizeof(cp_values[9]), "< %d%% >", g_volume);
            snprintf(cp_values[10], sizeof(cp_values[10]), "%s", storage_str);
            snprintf(cp_values[11], sizeof(cp_values[11]), "%s", temp_str);
            snprintf(cp_values[12], sizeof(cp_values[12]), "[Reload UI]");
            snprintf(cp_values[13], sizeof(cp_values[13]), "[Reboot System]");
            snprintf(cp_values[14], sizeof(cp_values[14]), "[Power Off]");

            for (int i = 0; i < cp_visible_count; i++) {
                int item_idx = cp_scroll_offset + i;
                if (item_idx >= cp_count) break;

                int item_y = 88 + i * 50;
                bool is_sel = (item_idx == cp_idx);

                SDL_Rect r = {45, item_y - 4, 620, 42};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 20, item_y + 8, 2, c_accent);

                    draw_string_marquee(ren, cp_titles[item_idx], 60, item_y + 8, 2, c_white, 300, true, ticks);
                    draw_string_right(ren, cp_values[item_idx], 645, item_y + 8, 2, c_accent);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);

                    draw_string_marquee(ren, cp_titles[item_idx], 60, item_y + 8, 2, c_gray, 300, false, ticks);
                    draw_string_right(ren, cp_values[item_idx], 645, item_y + 8, 2, c_white);
                }
            }

            // Scrollbar Track
            int sb_x = 685;
            int sb_y = 88;
            int sb_h = cp_visible_count * 50 - 8;
            SDL_Rect sb_track = {sb_x, sb_y, 6, sb_h};
            SDL_SetRenderDrawColor(ren, 40, 48, 64, 255);
            SDL_RenderFillRect(ren, &sb_track);

            // Scrollbar Thumb
            int thumb_h = (sb_h * cp_visible_count) / cp_count;
            int thumb_y = sb_y + (cp_scroll_offset * (sb_h - thumb_h)) / (cp_count - cp_visible_count);
            SDL_Rect sb_thumb = {sb_x, thumb_y, 6, thumb_h};
            SDL_SetRenderDrawColor(ren, c_accent.r, c_accent.g, c_accent.b, 255);
            SDL_RenderFillRect(ren, &sb_thumb);

        } else if (state == VIEW_WIFI_MENU) {
            draw_string(ren, "=== WI-FI NETWORKS (SCAN & CONNECT) ===", 55, 48, 2, c_cyan);

            int wifi_vis = 6;
            int wifi_offset = 0;
            if (g_wifi_selected_idx >= wifi_vis) wifi_offset = g_wifi_selected_idx - wifi_vis + 1;

            if (g_wifi_count == 0) {
                draw_string(ren, g_wifi_status_msg, 60, 180, 2, c_gray);
                draw_string(ren, "Press [X] to rescan wireless networks", 60, 220, 2, c_accent);
            } else {
                for (int i = 0; i < wifi_vis; i++) {
                    int idx = wifi_offset + i;
                    if (idx >= g_wifi_count) break;

                    int item_y = 88 + i * 50;
                    bool is_sel = (idx == g_wifi_selected_idx);

                    SDL_Rect r = {45, item_y - 4, 620, 42};
                    if (is_sel) {
                        SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                        SDL_RenderFillRect(ren, &r);
                        draw_string(ren, ">", 20, item_y + 8, 2, c_accent);
                    } else {
                        SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                        SDL_RenderFillRect(ren, &r);
                    }

                    char disp_name[64];
                    snprintf(disp_name, sizeof(disp_name), "%s %s", g_wifi_list[idx].in_use ? "*" : " ", g_wifi_list[idx].ssid);
                    draw_string(ren, disp_name, 60, item_y + 8, 2, g_wifi_list[idx].in_use ? c_green : (is_sel ? c_white : c_gray));

                    char sig_str[32];
                    snprintf(sig_str, sizeof(sig_str), "%s [%d%%]", g_wifi_list[idx].secure ? "SEC" : "OPEN", g_wifi_list[idx].signal);
                    draw_string_right(ren, sig_str, 645, item_y + 8, 2, is_sel ? c_accent : c_white);
                }
            }

            draw_string(ren, g_wifi_status_msg, 55, 395, 2, c_accent);

        } else if (state == VIEW_BT_MENU) {
            draw_string(ren, "=== BLUETOOTH DEVICES (SCAN & PAIR) ===", 55, 48, 2, c_cyan);

            int bt_vis = 6;
            int bt_offset = 0;
            if (g_bt_selected_idx >= bt_vis) bt_offset = g_bt_selected_idx - bt_vis + 1;

            if (g_bt_count == 0) {
                draw_string(ren, g_bt_status_msg, 60, 180, 2, c_gray);
                draw_string(ren, "Press [X] to rescan nearby bluetooth devices", 60, 220, 2, c_accent);
            } else {
                for (int i = 0; i < bt_vis; i++) {
                    int idx = bt_offset + i;
                    if (idx >= g_bt_count) break;

                    int item_y = 88 + i * 50;
                    bool is_sel = (idx == g_bt_selected_idx);

                    SDL_Rect r = {45, item_y - 4, 620, 42};
                    if (is_sel) {
                        SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                        SDL_RenderFillRect(ren, &r);
                        draw_string(ren, ">", 20, item_y + 8, 2, c_accent);
                    } else {
                        SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                        SDL_RenderFillRect(ren, &r);
                    }

                    draw_string(ren, g_bt_list[idx].name, 60, item_y + 8, 2, is_sel ? c_white : c_gray);
                    draw_string_right(ren, g_bt_list[idx].mac, 645, item_y + 8, 2, is_sel ? c_accent : c_white);
                }
            }

            draw_string(ren, g_bt_status_msg, 55, 395, 2, c_accent);

        } else if (state == VIEW_SYSTEM_INFO) {
            draw_string(ren, "=== RG34XX SYSTEM HARDWARE SPECIFICATIONS ===", 30, 48, 2, c_cyan);

            const char* spec_keys[] = {
                "Device Model",
                "Processor",
                "Display",
                "Graphics",
                "Memory",
                "Storage",
                "Media",
                "OS Stack"
            };
            const char* spec_vals[] = {
                "Anbernic RG34XX Handheld",
                "Allwinner H700 Quad-Core",
                "3.4\" IPS 720x480 (3:2)",
                "ARM Mali-G31 MP2 Panfrost",
                "1GB LPDDR4 @ 1600MHz RAM",
                "TF1 RootFS + TF2 Storage",
                "XMPlayer Native PSP XMB",
                "ROCKNIX Pure 64-bit JeOS"
            };

            for (int i = 0; i < info_visible_count; i++) {
                int item_idx = info_scroll_offset + i;
                if (item_idx >= info_count) break;

                int item_y = 88 + i * 50;
                bool is_sel = (item_idx == info_idx);

                SDL_Rect r = {45, item_y - 4, 620, 42};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 20, item_y + 8, 2, c_accent);

                    draw_string(ren, spec_keys[item_idx], 60, item_y + 8, 2, c_white);
                    draw_string(ren, ":", 210, item_y + 8, 2, c_gray);
                    draw_string_marquee(ren, spec_vals[item_idx], 230, item_y + 8, 2, c_accent, 415, true, ticks);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);

                    draw_string(ren, spec_keys[item_idx], 60, item_y + 8, 2, c_cyan);
                    draw_string(ren, ":", 210, item_y + 8, 2, c_gray);
                    draw_string(ren, spec_vals[item_idx], 230, item_y + 8, 2, c_white);
                }
            }

            // Scrollbar Track
            int sb_x = 685;
            int sb_y = 88;
            int sb_h = info_visible_count * 50 - 8;
            SDL_Rect sb_track = {sb_x, sb_y, 6, sb_h};
            SDL_SetRenderDrawColor(ren, 40, 48, 64, 255);
            SDL_RenderFillRect(ren, &sb_track);

            // Scrollbar Thumb
            int thumb_h = (sb_h * info_visible_count) / info_count;
            int thumb_y = sb_y + (info_scroll_offset * (sb_h - thumb_h)) / (info_count - info_visible_count);
            SDL_Rect sb_thumb = {sb_x, thumb_y, 6, thumb_h};
            SDL_SetRenderDrawColor(ren, c_accent.r, c_accent.g, c_accent.b, 255);
            SDL_RenderFillRect(ren, &sb_thumb);

        } else if (state == VIEW_POWER_DIALOG) {
            draw_string(ren, "=== POWER & SYSTEM ACTIONS ===", 55, 48, 2, c_cyan);

            for (int i = 0; i < power_count; i++) {
                int item_y = 104 + i * 62;
                bool is_sel = (i == power_idx);

                SDL_Rect r = {45, item_y - 4, 620, 50};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 20, item_y + 12, 2, c_accent);
                    draw_string(ren, power_items[i], 60, item_y + 12, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, power_items[i], 60, item_y + 12, 2, (i == 2) ? c_red : c_gray);
                }
            }
        }

        // 3. Bottom Navigation Bar (Handheld-native button labels only)
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect bot_bar = {0, SCREEN_HEIGHT - 38, SCREEN_WIDTH, 38};
        SDL_RenderFillRect(ren, &bot_bar);

        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "[A] SELECT   [D-PAD] MOVE   [START+SEL] EXIT", 16, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_CONTROL_CENTER) {
            draw_string(ren, "[A] TOGGLE   [D-PAD] ADJUST   [B] BACK", 56, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_WIFI_MENU) {
            draw_string(ren, "[A] CONNECT   [X] RESCAN   [B] BACK", 80, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_BT_MENU) {
            draw_string(ren, "[A] PAIR   [X] RESCAN   [B] BACK", 104, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_SYSTEM_INFO) {
            draw_string(ren, "[D-PAD] SCROLL                  [B] BACK", 40, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_POWER_DIALOG) {
            draw_string(ren, "[A] CONFIRM              [B] CANCEL", 80, SCREEN_HEIGHT - 26, 2, c_gray);
        }

        if (dump_mode) {
            char filename[64];
            snprintf(filename, sizeof(filename), "/tmp/screen_view_%d.bmp", state);
            save_screenshot(ren, filename);
            SDL_RenderPresent(ren);
            state++;
            if (state > VIEW_BT_MENU) {
                running = false;
            }
            continue;
        }

        SDL_RenderPresent(ren);
        SDL_Delay(16);
    }

    if (controller) SDL_GameControllerClose(controller);
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
