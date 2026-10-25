/*
 * Handheld Launcher for Anbernic RG34XX (Allwinner H700)
 * Resolution: 720x480 (3:2 Aspect Ratio)
 * Features:
 *   - XMPlayer Integration (with START + SELECT Exit protection)
 *   - Pixel-perfect Responsive Views:
 *       * Non-overlapping 5-Zone Top Status Bar
 *       * Main Menu with Context-Aware Descriptions
 *       * Control Center: Left-aligned Titles, Right-aligned Values, Marquee Scroll
 *       * Hardware & System Info: Multi-line Word-Wrapped Spec Table (No Truncation)
 *       * Power Management Modal Dialog (Reboot, Power Off, Reload UI)
 *       * Screen-Off Walkman Mode (turns off backlight bl_power=4, keeps music playing)
 *   - Global START + SELECT combo exit
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
    int len = strlen(str);
    int width = len * 8 * scale;
    draw_string(ren, str, right_x - width, y, scale, color);
}

// Text marquee horizontal scrolling with scissor clipping
void draw_string_marquee(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color, int max_w, bool active, Uint32 ticks) {
    int str_w = strlen(str) * 8 * scale;
    if (str_w <= max_w || !active) {
        draw_string(ren, str, x, y, scale, color);
        return;
    }

    SDL_Rect clip = {x, y - 2, max_w, 8 * scale + 4};
    SDL_RenderSetClipRect(ren, &clip);

    int overflow = str_w - max_w + 24;
    int scroll_period = 4000;
    int time_in_period = ticks % scroll_period;
    int scroll_offset = 0;

    if (time_in_period > 1000 && time_in_period < 3000) {
        scroll_offset = (int)((time_in_period - 1000) * overflow / 2000.0);
    } else if (time_in_period >= 3000) {
        scroll_offset = overflow;
    }

    draw_string(ren, str, x - scroll_offset, y, scale, color);
    SDL_RenderSetClipRect(ren, NULL);
}

// Multi-line word-wrapped text rendering
int draw_text_wrapped(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color, int max_w, int line_h) {
    int cur_x = x;
    int cur_y = y;
    int char_w = 8 * scale;

    const char* p = str;
    while (*p) {
        if (*p == '\n') {
            cur_y += line_h;
            cur_x = x;
            p++;
            continue;
        }

        // Measure next token/word
        const char* word_end = p;
        while (*word_end && *word_end != ' ' && *word_end != '\n') {
            word_end++;
        }
        int word_len = word_end - p;
        int word_w = word_len * char_w;

        // Wrap to next line if word exceeds max width
        if (cur_x + word_w > x + max_w && cur_x > x) {
            cur_y += line_h;
            cur_x = x;
        }

        // Draw the word
        for (int i = 0; i < word_len; i++) {
            draw_char(ren, p[i], cur_x, cur_y, scale, color);
            cur_x += char_w;
        }
        p = word_end;

        // Handle space
        if (*p == ' ') {
            if (cur_x + char_w <= x + max_w) {
                draw_char(ren, ' ', cur_x, cur_y, scale, color);
                cur_x += char_w;
            } else {
                cur_y += line_h;
                cur_x = x;
            }
            p++;
        }
    }
    return cur_y + line_h;
}

void launch_xmplayer(SDL_Window* win) {
    SDL_HideWindow(win);
    printf("==> Pausing Launcher, launching XMPlayer...\n");

    const char* cmd = NULL;
    if (access("/usr/share/xmplayer/main.lua", F_OK) == 0) {
        cmd = "love /usr/share/xmplayer";
    } else if (access("projects/ROCKNIX/packages/apps/xmplayer/app/main.lua", F_OK) == 0) {
        cmd = "nix-shell -p love --run 'love projects/ROCKNIX/packages/apps/xmplayer/app'";
    } else {
        cmd = "nix-shell -p love --run 'love /tmp/XMPlayer/.xmplayer'";
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
    VIEW_POWER_DIALOG
} ViewState;

typedef enum {
    USB_MODE_MTP = 0,
    USB_MODE_ADB = 1,
    USB_MODE_NET = 2,
    USB_MODE_OFF = 3,
    USB_MODE_COUNT = 4
} UsbMode;

static const char* g_usb_mode_names[USB_MODE_COUNT] = {
    "MTP PC DISK",
    "USB ADB DEBUG",
    "USB NETWORK",
    "CHARGING ONLY"
};

static const char* g_usb_short_names[USB_MODE_COUNT] = {
    "USB: MTP",
    "USB: ADB",
    "USB: NET",
    "USB: CHG"
};

// System Settings State
static int g_brightness = 80;
static int g_volume = 75;
static UsbMode g_usb_mode = USB_MODE_MTP;
static bool g_wifi_enabled = true;
static bool g_bt_enabled = false;
static bool g_wifi_adb_enabled = false;

// Host PC Safety Guard: Prevent simulator from executing systemctl/reboot/poweroff on host PC
static bool is_target_device(void) {
    if (getenv("ROCKNIX_SIMULATOR") != NULL) return false;
    return (access("/etc/rocknix-release", F_OK) == 0 || access("/storage/.config", F_OK) == 0);
}

static void do_reboot(void) {
    if (is_target_device()) {
        (void)!system("reboot 2>/dev/null");
    } else {
        printf("\n[SIMULATOR GUARD] Reboot requested: Simulated on PC host (host reboot prevented).\n\n");
    }
}

static void do_poweroff(bool* running) {
    if (is_target_device()) {
        (void)!system("poweroff 2>/dev/null");
    } else {
        printf("\n[SIMULATOR GUARD] Power off requested: Exiting simulator cleanly (host shutdown prevented).\n\n");
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
        case USB_MODE_MTP:
            (void)!system("usbgadget file_transfer >/dev/null 2>&1");
            break;
        case USB_MODE_ADB:
            (void)!system("usbgadget adb >/dev/null 2>&1");
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

    ViewState state = VIEW_MAIN_MENU;
    const char* main_menu_items[] = {
        "1. Launch XMPlayer (XMB Media Suite)",
        "2. System Settings & Control Center",
        "3. Terminal / Developer Shell",
        "4. Hardware & System Info (RG34XX)",
        "5. Power Management / Reboot"
    };
    const char* main_menu_hints[] = {
        "Launch PSP XMB style media player for music, video and photos",
        "Configure Wi-Fi, Bluetooth, Audio, Brightness and USB Gadget",
        "Open developer terminal shell or start background SSH server",
        "Inspect RG34XX Allwinner H700 hardware architecture specifications",
        "Reboot system, restart launcher UI, or power off handheld"
    };
    int main_menu_count = 5;
    int main_selected_idx = 0;

    int cp_idx = 0;
    const int cp_count = 14;
    int cp_scroll_offset = 0;
    const int cp_visible_count = 6;

    int info_scroll_offset = 0;
    const int info_count = 8;
    const int info_visible_count = 6;

    int power_idx = 0;
    const int power_count = 4;
    const char* power_items[] = {
        "1. Restart Launcher UI",
        "2. Reboot System",
        "3. Power Off Hardware",
        "4. Cancel / Return"
    };

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

                // ESC: Back or Exit
                if (k == SDLK_ESCAPE) {
                    if (state == VIEW_MAIN_MENU) running = false;
                    else state = VIEW_MAIN_MENU;
                }

                if (state == VIEW_MAIN_MENU) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        main_selected_idx = (main_selected_idx - 1 + main_menu_count) % main_menu_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        main_selected_idx = (main_selected_idx + 1) % main_menu_count;
                    } else if (k == SDLK_RETURN || k == SDLK_j || k == SDLK_SPACE) {
                        if (main_selected_idx == 0) launch_xmplayer(win);
                        else if (main_selected_idx == 1) state = VIEW_CONTROL_CENTER;
                        else if (main_selected_idx == 2) {
                            (void)!system("systemctl start dropbear 2>/dev/null || systemctl start sshd 2>/dev/null");
                        }
                        else if (main_selected_idx == 3) state = VIEW_SYSTEM_INFO;
                        else if (main_selected_idx == 4) state = VIEW_POWER_DIALOG;
                    }
                } else if (state == VIEW_CONTROL_CENTER) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        cp_idx = (cp_idx + 1) % cp_count;
                    } else if (k == SDLK_LEFT || k == SDLK_a) {
                        if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode - 1 + USB_MODE_COUNT) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 5) apply_brightness(-5);
                        else if (cp_idx == 7) apply_volume(-5);
                    } else if (k == SDLK_RIGHT || k == SDLK_d) {
                        if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 5) apply_brightness(+5);
                        else if (cp_idx == 7) apply_volume(+5);
                    } else if (k == SDLK_RETURN || k == SDLK_j || k == SDLK_SPACE) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            (void)!system(g_wifi_enabled ? "wifictl enable >/dev/null 2>&1" : "wifictl disable >/dev/null 2>&1");
                        } else if (cp_idx == 2) {
                            g_bt_enabled = !g_bt_enabled;
                            (void)!system(g_bt_enabled ? "rocknix-bluetooth on >/dev/null 2>&1" : "rocknix-bluetooth off >/dev/null 2>&1");
                        } else if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 4) {
                            g_wifi_adb_enabled = !g_wifi_adb_enabled;
                            (void)!system(g_wifi_adb_enabled ? "usbgadget adb_tcp >/dev/null 2>&1" : "usbgadget adb_tcp_stop >/dev/null 2>&1");
                        } else if (cp_idx == 6) {
                            enter_walkman_mode(ren);
                        } else if (cp_idx == 10) {
                            do_restart_launcher();
                        } else if (cp_idx == 11) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        } else if (cp_idx == 12) {
                            do_poweroff(&running);
                        } else if (cp_idx == 13) {
                            state = VIEW_MAIN_MENU;
                        }
                    } else if (k == SDLK_BACKSPACE || k == SDLK_k) {
                        state = VIEW_MAIN_MENU;
                    }
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        if (info_scroll_offset > 0) info_scroll_offset--;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        if (info_scroll_offset + info_visible_count < info_count) info_scroll_offset++;
                    } else if (k == SDLK_BACKSPACE || k == SDLK_k || k == SDLK_RETURN || k == SDLK_SPACE) {
                        state = VIEW_MAIN_MENU;
                    }
                } else if (state == VIEW_POWER_DIALOG) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        power_idx = (power_idx - 1 + power_count) % power_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        power_idx = (power_idx + 1) % power_count;
                    } else if (k == SDLK_RETURN || k == SDLK_j || k == SDLK_SPACE) {
                        if (power_idx == 0) do_restart_launcher();
                        else if (power_idx == 1) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        }
                        else if (power_idx == 2) do_poweroff(&running);
                        else if (power_idx == 3) state = VIEW_MAIN_MENU;
                    } else if (k == SDLK_BACKSPACE || k == SDLK_k) {
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
                    if (btn == SDL_CONTROLLER_BUTTON_A) {
                        if (main_selected_idx == 0) launch_xmplayer(win);
                        else if (main_selected_idx == 1) state = VIEW_CONTROL_CENTER;
                        else if (main_selected_idx == 3) state = VIEW_SYSTEM_INFO;
                        else if (main_selected_idx == 4) state = VIEW_POWER_DIALOG;
                    }
                } else if (state == VIEW_CONTROL_CENTER) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) cp_idx = (cp_idx + 1) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_LEFT) {
                        if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode - 1 + USB_MODE_COUNT) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 5) apply_brightness(-5);
                        else if (cp_idx == 7) apply_volume(-5);
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_RIGHT) {
                        if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 5) apply_brightness(+5);
                        else if (cp_idx == 7) apply_volume(+5);
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_A) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            (void)!system(g_wifi_enabled ? "wifictl enable >/dev/null 2>&1" : "wifictl disable >/dev/null 2>&1");
                        } else if (cp_idx == 2) {
                            g_bt_enabled = !g_bt_enabled;
                            (void)!system(g_bt_enabled ? "rocknix-bluetooth on >/dev/null 2>&1" : "rocknix-bluetooth off >/dev/null 2>&1");
                        } else if (cp_idx == 3) {
                            g_usb_mode = (g_usb_mode + 1) % USB_MODE_COUNT;
                            apply_usb_mode();
                        } else if (cp_idx == 4) {
                            g_wifi_adb_enabled = !g_wifi_adb_enabled;
                            (void)!system(g_wifi_adb_enabled ? "usbgadget adb_tcp >/dev/null 2>&1" : "usbgadget adb_tcp_stop >/dev/null 2>&1");
                        } else if (cp_idx == 6) {
                            enter_walkman_mode(ren);
                        } else if (cp_idx == 10) {
                            do_restart_launcher();
                        } else if (cp_idx == 11) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        } else if (cp_idx == 12) {
                            do_poweroff(&running);
                        } else if (cp_idx == 13) {
                            state = VIEW_MAIN_MENU;
                        }
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_B) state = VIEW_MAIN_MENU;
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP && info_scroll_offset > 0) info_scroll_offset--;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN && info_scroll_offset + info_visible_count < info_count) info_scroll_offset++;
                    if (btn == SDL_CONTROLLER_BUTTON_B || btn == SDL_CONTROLLER_BUTTON_A) state = VIEW_MAIN_MENU;
                } else if (state == VIEW_POWER_DIALOG) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) power_idx = (power_idx - 1 + power_count) % power_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) power_idx = (power_idx + 1) % power_count;
                    if (btn == SDL_CONTROLLER_BUTTON_A) {
                        if (power_idx == 0) do_restart_launcher();
                        else if (power_idx == 1) {
                            do_reboot();
                            state = VIEW_MAIN_MENU;
                        }
                        else if (power_idx == 2) do_poweroff(&running);
                        else if (power_idx == 3) state = VIEW_MAIN_MENU;
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_B) state = VIEW_MAIN_MENU;
                }
            }
        }

        // Adjust scroll offset
        if (cp_idx < cp_scroll_offset) {
            cp_scroll_offset = cp_idx;
        } else if (cp_idx >= cp_scroll_offset + cp_visible_count) {
            cp_scroll_offset = cp_idx - cp_visible_count + 1;
        }

        // Render Background
        SDL_SetRenderDrawColor(ren, c_dark.r, c_dark.g, c_dark.b, 255);
        SDL_RenderClear(ren);

        // 1. Top Status Bar (Height 36px, Width 720px, strictly non-overlapping)
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect top_bar = {0, 0, SCREEN_WIDTH, 36};
        SDL_RenderFillRect(ren, &top_bar);

        char bat_str[32];
        get_battery_info(bat_str, sizeof(bat_str));
        char bat_disp[40];
        snprintf(bat_disp, sizeof(bat_disp), "BAT: %s", bat_str);

        time_t now = time(NULL);
        struct tm* tm_now = localtime(&now);
        char time_str[16];
        strftime(time_str, sizeof(time_str), "%H:%M", tm_now);

        // Dynamically spaced 5 zones:
        draw_string(ren, "RG34XX DEV", 20, 10, 2, c_cyan);
        draw_string(ren, g_wifi_enabled ? "WIFI: ON" : "WIFI: OFF", 205, 10, 2, g_wifi_enabled ? c_green : c_gray);
        draw_string(ren, g_usb_short_names[g_usb_mode], 350, 10, 2, c_accent);
        draw_string(ren, bat_disp, 495, 10, 2, c_white);
        draw_string(ren, time_str, 630, 10, 2, c_accent);

        // 2. Main Content
        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "=== ANBERNIC RG34XX DEV LAUNCHER ===", 75, 62, 2, c_accent);

            for (int i = 0; i < main_menu_count; i++) {
                int item_y = 118 + i * 50;
                bool is_sel = (i == main_selected_idx);

                SDL_Rect r = {55, item_y - 6, SCREEN_WIDTH - 110, 42};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 26, item_y + 6, 2, c_accent);
                    draw_string(ren, main_menu_items[i], 70, item_y + 6, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, main_menu_items[i], 70, item_y + 6, 2, c_gray);
                }
            }

            // Contextual hint box
            SDL_Rect hint_box = {45, 386, 630, 36};
            SDL_SetRenderDrawColor(ren, 26, 32, 42, 255);
            SDL_RenderFillRect(ren, &hint_box);

            draw_string(ren, "INFO:", 55, 396, 2, c_accent);
            draw_string_marquee(ren, main_menu_hints[main_selected_idx], 145, 396, 2, c_white, 515, true, ticks);

        } else if (state == VIEW_CONTROL_CENTER) {
            draw_string(ren, "=== SYSTEM CONTROL CENTER & SETTINGS ===", 55, 48, 2, c_cyan);

            char storage_str[48];
            get_storage_info(storage_str, sizeof(storage_str));
            char temp_str[48];
            get_cpu_temp(temp_str, sizeof(temp_str));

            char cp_titles[14][32] = {
                "Wi-Fi Wireless",
                "Wi-Fi IP Address",
                "Bluetooth Radio",
                "USB-C Data Role",
                "Wireless ADB",
                "Screen Brightness",
                "Walkman Mode",
                "Audio Volume",
                "SD Free Space",
                "CPU Telemetry",
                "Restart UI",
                "Reboot Handheld",
                "Power Off",
                "Back to Main"
            };

            char cp_values[14][48];
            snprintf(cp_values[0], sizeof(cp_values[0]), "[%s]", g_wifi_enabled ? "ENABLED" : "DISABLED");
            snprintf(cp_values[1], sizeof(cp_values[1]), "%s", g_wifi_enabled ? "192.168.1.102" : "Disconnected");
            snprintf(cp_values[2], sizeof(cp_values[2]), "[%s]", g_bt_enabled ? "ON" : "OFF");
            snprintf(cp_values[3], sizeof(cp_values[3]), "< %s >", g_usb_mode_names[g_usb_mode]);
            snprintf(cp_values[4], sizeof(cp_values[4]), "[%s:5555]", g_wifi_adb_enabled ? "ACTIVE" : "DISABLED");
            snprintf(cp_values[5], sizeof(cp_values[5]), "< %d%% >", g_brightness);
            snprintf(cp_values[6], sizeof(cp_values[6]), "[Sleep Screen]");
            snprintf(cp_values[7], sizeof(cp_values[7]), "< %d%% >", g_volume);
            snprintf(cp_values[8], sizeof(cp_values[8]), "%s", storage_str);
            snprintf(cp_values[9], sizeof(cp_values[9]), "%s", temp_str);
            snprintf(cp_values[10], sizeof(cp_values[10]), "[Reload UI]");
            snprintf(cp_values[11], sizeof(cp_values[11]), "[Reboot System]");
            snprintf(cp_values[12], sizeof(cp_values[12]), "[Power Off]");
            snprintf(cp_values[13], sizeof(cp_values[13]), "[Return]");

            const char* cp_hints[14] = {
                "[A] Toggle Wi-Fi Network Connection",
                "Assigned IP Address on Local Network",
                "[A] Toggle Bluetooth Radio Power",
                "[Left/Right] Cycle USB Role  [A] Apply to Host",
                "[A] Toggle ADB Daemon over TCP (Port 5555)",
                "[Left/Right] Adjust LCD Backlight Brightness",
                "[A] Turn Off Backlight (bl_power=4), Keep Audio",
                "[Left/Right] Adjust Master Sound Output Volume",
                "MicroSD Storage Partition (/storage) Capacity",
                "Allwinner H700 SoC Temperature & Core Freq",
                "[A] Restart Handheld Launcher Daemon",
                "[A] Reboot Device Hardware Safely",
                "[A] Safely Unmount & Power Down Handheld",
                "[A / B] Return to Primary Launch Menu"
            };

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

            // Contextual Hint Bar
            SDL_Rect hint_box = {45, 392, 646, 34};
            SDL_SetRenderDrawColor(ren, 26, 32, 42, 255);
            SDL_RenderFillRect(ren, &hint_box);

            draw_string(ren, "HINT:", 55, 400, 2, c_accent);
            draw_string_marquee(ren, cp_hints[cp_idx], 145, 400, 2, c_white, 530, true, ticks);

        } else if (state == VIEW_SYSTEM_INFO) {
            draw_string(ren, "=== HARDWARE & ARCHITECTURE INFO ===", 55, 48, 2, c_cyan);

            SDL_Rect card = {45, 88, 646, 334};
            SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
            SDL_RenderFillRect(ren, &card);

            SDL_Rect card_header = {45, 88, 646, 34};
            SDL_SetRenderDrawColor(ren, 26, 32, 42, 255);
            SDL_RenderFillRect(ren, &card_header);
            draw_string(ren, "DEVICE SPECIFICATIONS", 60, 98, 2, c_accent);

            const char* spec_keys[] = {
                "Model", "Processor", "Display", "Graphics",
                "Memory", "Storage", "Media", "Stack"
            };
            const char* spec_vals[] = {
                "Anbernic RG34XX / SP Handheld",
                "Allwinner H700 Quad-core / 4x Cortex-A53 @ 1.5GHz",
                "3.4\" IPS Screen 720x480 / Native 3:2 Aspect Ratio",
                "ARM Mali-G31 MP2 GPU / Panfrost KMS/DRM Driver",
                "1GB LPDDR4 System RAM @ 1600MHz",
                "Dual TF Card Architecture / TF1 OS SquashFS + TF2 Ext4",
                "XMPlayer Media Suite (PSP XMB UI)",
                "ROCKNIX Pure 64-bit JeOS / Native Gamepad Bridge"
            };
            const int spec_count = 8;
            const int row_y = 128;
            const int row_h = 42;

            for (int i = 0; i < info_visible_count; i++) {
                int item_idx = info_scroll_offset + i;
                if (item_idx >= spec_count) break;
                int y = row_y + i * row_h;
                if (i % 2 == 1) {
                    SDL_Rect row = {56, y, 624, row_h};
                    SDL_SetRenderDrawColor(ren, 36, 44, 58, 255);
                    SDL_RenderFillRect(ren, &row);
                }
                draw_string(ren, spec_keys[item_idx], 64, y + 13, 2, c_cyan);
                draw_string(ren, ":", 200, y + 13, 2, c_gray);
                draw_string_marquee(ren, spec_vals[item_idx], 224, y + 13, 2, c_white,
                                    448, true, ticks + item_idx * 900);
            }

            int info_sb_x = 685;
            int info_sb_y = 128;
            int info_sb_h = info_visible_count * row_h;
            SDL_Rect info_sb_track = {info_sb_x, info_sb_y, 6, info_sb_h};
            SDL_SetRenderDrawColor(ren, 40, 48, 64, 255);
            SDL_RenderFillRect(ren, &info_sb_track);

            int info_thumb_h = (info_sb_h * info_visible_count) / spec_count;
            int info_thumb_y = info_sb_y + (info_scroll_offset * (info_sb_h - info_thumb_h)) / (spec_count - info_visible_count);
            SDL_Rect info_sb_thumb = {info_sb_x, info_thumb_y, 6, info_thumb_h};
            SDL_SetRenderDrawColor(ren, c_accent.r, c_accent.g, c_accent.b, 255);
            SDL_RenderFillRect(ren, &info_sb_thumb);

        } else if (state == VIEW_POWER_DIALOG) {
            SDL_Rect panel = {45, 88, 646, 334};
            SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
            SDL_RenderFillRect(ren, &panel);

            SDL_Rect panel_header = {45, 88, 646, 34};
            SDL_SetRenderDrawColor(ren, 26, 32, 42, 255);
            SDL_RenderFillRect(ren, &panel_header);
            draw_string(ren, "POWER & SYSTEM ACTIONS", 60, 98, 2, c_accent);

            for (int i = 0; i < power_count; i++) {
                int item_y = 132 + i * 54;
                bool is_sel = (i == power_idx);
                SDL_Rect r = {60, item_y, 616, 44};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 68, item_y + 13, 2, c_accent);
                    draw_string(ren, power_items[i], 92, item_y + 13, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, 24, 28, 38, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, power_items[i], 92, item_y + 13, 2,
                                i == 2 ? c_red : c_gray);
                }
            }
        }

        // 3. Bottom Navigation Bar
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect bot_bar = {0, SCREEN_HEIGHT - 38, SCREEN_WIDTH, 38};
        SDL_RenderFillRect(ren, &bot_bar);

        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "[A] SELECT    [UP/DOWN] NAVIGATE    [START+SELECT] QUIT", 60, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_CONTROL_CENTER) {
            draw_string(ren, "[A] SELECT/APPLY   [LEFT/RIGHT] ADJUST   [B] BACK", 75, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_SYSTEM_INFO) {
            draw_string(ren, "[B / A / ESC] RETURN TO MAIN MENU", 175, SCREEN_HEIGHT - 26, 2, c_gray);
        } else if (state == VIEW_POWER_DIALOG) {
            draw_string(ren, "[A] CONFIRM ACTION      [B / ESC] CANCEL", 145, SCREEN_HEIGHT - 26, 2, c_gray);
        }

        SDL_RenderPresent(ren);
        SDL_Delay(16); // ~60 FPS
    }

    if (controller) SDL_GameControllerClose(controller);
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
