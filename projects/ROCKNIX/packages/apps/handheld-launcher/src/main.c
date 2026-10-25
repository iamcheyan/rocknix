/*
 * Handheld Launcher for Anbernic RG34XX (Allwinner H700)
 * Resolution: 720x480 (3:2 Aspect Ratio)
 * Includes:
 *   - XMPlayer Integration
 *   - Native System Control Panel (WiFi, Bluetooth, Audio, Brightness, USB MTP/ADB)
 *   - START + SELECT Combo Exit Protection
 */

#include <SDL2/SDL.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <unistd.h>
#include <time.h>
#include <math.h>

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
    VIEW_CONTROL_PANEL,
    VIEW_SYSTEM_INFO
} ViewState;

// System Settings State
static int g_brightness = 80;
static int g_volume = 75;
static int g_usb_mode = 0; // 0 = MTP Disk, 1 = ADB / Network, 2 = Disabled
static bool g_wifi_enabled = true;
static bool g_bt_enabled = false;

void apply_brightness(int delta) {
    g_brightness += delta;
    if (g_brightness > 100) g_brightness = 100;
    if (g_brightness < 10) g_brightness = 10;
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "brightness set %d >/dev/null 2>&1", g_brightness);
    (void)!system(cmd);
}

void apply_volume(int delta) {
    g_volume += delta;
    if (g_volume > 100) g_volume = 100;
    if (g_volume < 0) g_volume = 0;
    char cmd[64];
    snprintf(cmd, sizeof(cmd), "amixer -q set Master %d%% >/dev/null 2>&1", g_volume);
    (void)!system(cmd);
}

void toggle_usb_mode() {
    g_usb_mode = (g_usb_mode + 1) % 2;
    if (g_usb_mode == 0) {
        (void)!system("usbgadget file_transfer >/dev/null 2>&1");
    } else {
        (void)!system("usbgadget network >/dev/null 2>&1");
    }
}

int main(int argc, char* argv[]) {
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
    const char* menu_items[] = {
        "1. Launch XMPlayer (XMB Media Suite)",
        "2. System Settings & Control Panel",
        "3. Terminal / Developer Shell",
        "4. Hardware & System Info (RG34XX)",
        "5. Power Off / Exit"
    };
    int menu_count = 5;
    int selected_idx = 0;

    int cp_idx = 0;
    int cp_count = 6;

    bool running = true;
    SDL_Event e;

    SDL_Color c_white  = {255, 255, 255, 255};
    SDL_Color c_accent = {255, 196, 0, 255};
    SDL_Color c_gray   = {160, 160, 160, 255};
    SDL_Color c_cyan   = {0, 220, 255, 255};
    SDL_Color c_green  = {80, 240, 120, 255};
    SDL_Color c_dark   = {20, 24, 32, 255};
    SDL_Color c_panel  = {32, 38, 50, 255};

    while (running) {
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) {
                running = false;
            } else if (e.type == SDL_KEYDOWN) {
                SDL_Keycode k = e.key.keysym.sym;

                // Check START + SELECT keyboard fallback (Shift + Enter)
                if (k == SDLK_ESCAPE) {
                    if (state == VIEW_MAIN_MENU) running = false;
                    else state = VIEW_MAIN_MENU;
                }

                if (state == VIEW_MAIN_MENU) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        selected_idx = (selected_idx - 1 + menu_count) % menu_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        selected_idx = (selected_idx + 1) % menu_count;
                    } else if (k == SDLK_RETURN || k == SDLK_j || k == SDLK_SPACE) {
                        if (selected_idx == 0) launch_xmplayer(win);
                        else if (selected_idx == 1) state = VIEW_CONTROL_PANEL;
                        else if (selected_idx == 3) state = VIEW_SYSTEM_INFO;
                        else if (selected_idx == 4) running = false;
                    }
                } else if (state == VIEW_CONTROL_PANEL) {
                    if (k == SDLK_UP || k == SDLK_w) {
                        cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    } else if (k == SDLK_DOWN || k == SDLK_s) {
                        cp_idx = (cp_idx + 1) % cp_count;
                    } else if (k == SDLK_LEFT || k == SDLK_a) {
                        if (cp_idx == 2) apply_brightness(-5);
                        else if (cp_idx == 3) apply_volume(-5);
                        else if (cp_idx == 4) toggle_usb_mode();
                    } else if (k == SDLK_RIGHT || k == SDLK_d) {
                        if (cp_idx == 2) apply_brightness(+5);
                        else if (cp_idx == 3) apply_volume(+5);
                        else if (cp_idx == 4) toggle_usb_mode();
                    } else if (k == SDLK_RETURN || k == SDLK_j || k == SDLK_SPACE) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            system(g_wifi_enabled ? "wifictl enable" : "wifictl disable");
                        } else if (cp_idx == 1) {
                            g_bt_enabled = !g_bt_enabled;
                            system(g_bt_enabled ? "rocknix-bluetooth on" : "rocknix-bluetooth off");
                        } else if (cp_idx == 4) {
                            toggle_usb_mode();
                        } else if (cp_idx == 5) {
                            state = VIEW_MAIN_MENU;
                        }
                    } else if (k == SDLK_BACKSPACE || k == SDLK_k) {
                        state = VIEW_MAIN_MENU;
                    }
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (k == SDLK_BACKSPACE || k == SDLK_k || k == SDLK_RETURN) {
                        state = VIEW_MAIN_MENU;
                    }
                }
            } else if (e.type == SDL_CONTROLLERBUTTONDOWN) {
                Uint8 btn = e.cbutton.button;

                // COMBO EXIT: START + SELECT together
                if ((btn == SDL_CONTROLLER_BUTTON_START && SDL_GameControllerGetButton(controller, SDL_CONTROLLER_BUTTON_BACK)) ||
                    (btn == SDL_CONTROLLER_BUTTON_BACK && SDL_GameControllerGetButton(controller, SDL_CONTROLLER_BUTTON_START))) {
                    running = false;
                    break;
                }

                if (state == VIEW_MAIN_MENU) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) selected_idx = (selected_idx - 1 + menu_count) % menu_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) selected_idx = (selected_idx + 1) % menu_count;
                    if (btn == SDL_CONTROLLER_BUTTON_A) {
                        if (selected_idx == 0) launch_xmplayer(win);
                        else if (selected_idx == 1) state = VIEW_CONTROL_PANEL;
                        else if (selected_idx == 3) state = VIEW_SYSTEM_INFO;
                        else if (selected_idx == 4) running = false;
                    }
                } else if (state == VIEW_CONTROL_PANEL) {
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP) cp_idx = (cp_idx - 1 + cp_count) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN) cp_idx = (cp_idx + 1) % cp_count;
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_LEFT) {
                        if (cp_idx == 2) apply_brightness(-5);
                        else if (cp_idx == 3) apply_volume(-5);
                        else if (cp_idx == 4) toggle_usb_mode();
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_DPAD_RIGHT) {
                        if (cp_idx == 2) apply_brightness(+5);
                        else if (cp_idx == 3) apply_volume(+5);
                        else if (cp_idx == 4) toggle_usb_mode();
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_A) {
                        if (cp_idx == 0) {
                            g_wifi_enabled = !g_wifi_enabled;
                            system(g_wifi_enabled ? "wifictl enable" : "wifictl disable");
                        } else if (cp_idx == 1) {
                            g_bt_enabled = !g_bt_enabled;
                            system(g_bt_enabled ? "rocknix-bluetooth on" : "rocknix-bluetooth off");
                        } else if (cp_idx == 4) {
                            toggle_usb_mode();
                        } else if (cp_idx == 5) {
                            state = VIEW_MAIN_MENU;
                        }
                    }
                    if (btn == SDL_CONTROLLER_BUTTON_B) state = VIEW_MAIN_MENU;
                } else if (state == VIEW_SYSTEM_INFO) {
                    if (btn == SDL_CONTROLLER_BUTTON_B || btn == SDL_CONTROLLER_BUTTON_A) state = VIEW_MAIN_MENU;
                }
            }
        }

        // Render Background
        SDL_SetRenderDrawColor(ren, c_dark.r, c_dark.g, c_dark.b, 255);
        SDL_RenderClear(ren);

        // 1. Top Status Bar (Width = 720)
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect top_bar = {0, 0, SCREEN_WIDTH, 36};
        SDL_RenderFillRect(ren, &top_bar);

        draw_string(ren, "ROCKNIX DEV", 18, 10, 2, c_cyan);
        draw_string(ren, g_wifi_enabled ? "WIFI: ON" : "WIFI: OFF", 220, 10, 2, g_wifi_enabled ? c_green : c_gray);
        draw_string(ren, g_usb_mode == 0 ? "USB: MTP DISK" : "USB: ADB/NET", 380, 10, 2, c_accent);
        draw_string(ren, "BAT: 92%", 570, 10, 2, c_white);
        draw_string(ren, "21:28", 660, 10, 2, c_accent);

        // 2. Main Content
        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "=== ANBERNIC RG34XX DEV LAUNCHER ===", 75, 65, 2, c_accent);

            for (int i = 0; i < menu_count; i++) {
                int item_y = 125 + i * 52;
                bool is_sel = (i == selected_idx);

                SDL_Rect r = {60, item_y - 6, SCREEN_WIDTH - 120, 42};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 32, item_y + 6, 2, c_accent);
                    draw_string(ren, menu_items[i], 80, item_y + 6, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, menu_items[i], 80, item_y + 6, 2, c_gray);
                }
            }
        } else if (state == VIEW_CONTROL_PANEL) {
            draw_string(ren, "=== SYSTEM SETTINGS & CONTROL PANEL ===", 65, 55, 2, c_cyan);

            char cp_labels[6][80];
            snprintf(cp_labels[0], sizeof(cp_labels[0]), "WiFi Network: [%s] (Press A to toggle / scan)", g_wifi_enabled ? "ENABLED" : "DISABLED");
            snprintf(cp_labels[1], sizeof(cp_labels[1]), "Bluetooth:    [%s] (Press A to toggle / pair)", g_bt_enabled ? "ON" : "OFF");
            snprintf(cp_labels[2], sizeof(cp_labels[2]), "Brightness:   [ < %d%% > ] (Left/Right to adjust)", g_brightness);
            snprintf(cp_labels[3], sizeof(cp_labels[3]), "Audio Volume: [ < %d%% > ] (Left/Right to adjust)", g_volume);
            snprintf(cp_labels[4], sizeof(cp_labels[4]), "USB-C Mode:   [ < %s > ] (MTP Disk / ADB Network)", g_usb_mode == 0 ? "MTP PC DISK" : "ADB & NETWORK");
            snprintf(cp_labels[5], sizeof(cp_labels[5]), "<-- Return to Main Menu");

            for (int i = 0; i < cp_count; i++) {
                int item_y = 105 + i * 48;
                bool is_sel = (i == cp_idx);

                SDL_Rect r = {45, item_y - 6, SCREEN_WIDTH - 90, 40};
                if (is_sel) {
                    SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, ">", 20, item_y + 6, 2, c_accent);
                    draw_string(ren, cp_labels[i], 55, item_y + 6, 2, c_white);
                } else {
                    SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
                    SDL_RenderFillRect(ren, &r);
                    draw_string(ren, cp_labels[i], 55, item_y + 6, 2, c_gray);
                }
            }

            draw_string(ren, "Tip: Plug USB-C to PC for instant MTP storage or 'adb shell'", 45, 405, 2, c_accent);
        } else if (state == VIEW_SYSTEM_INFO) {
            draw_string(ren, "=== HARDWARE & SYSTEM INFO ===", 110, 65, 2, c_cyan);

            SDL_Rect card = {50, 110, SCREEN_WIDTH - 100, 250};
            SDL_SetRenderDrawColor(ren, c_panel.r, c_panel.g, c_panel.b, 255);
            SDL_RenderFillRect(ren, &card);

            draw_string(ren, "Model: Anbernic RG34XX / RG34XX SP", 80, 135, 2, c_white);
            draw_string(ren, "SoC: Allwinner H700 (4x Cortex-A53 1.5GHz)", 80, 170, 2, c_white);
            draw_string(ren, "Screen: 3.4 inch IPS, 720x480 Native (3:2)", 80, 205, 2, c_accent);
            draw_string(ren, "GPU: ARM Mali-G31 MP2 (Panfrost DRM/KMS)", 80, 240, 2, c_white);
            draw_string(ren, "Media Suite: XMPlayer (XMB PSP UI)", 80, 275, 2, c_cyan);
            draw_string(ren, "System: Custom ROCKNIX JeOS (Pure 64-bit)", 80, 310, 2, c_white);
        }

        // 3. Bottom Bar
        SDL_SetRenderDrawColor(ren, 14, 18, 24, 255);
        SDL_Rect bot_bar = {0, SCREEN_HEIGHT - 38, SCREEN_WIDTH, 38};
        SDL_RenderFillRect(ren, &bot_bar);

        if (state == VIEW_MAIN_MENU) {
            draw_string(ren, "[UP/DOWN] Move  [A] Open  [START+SELECT] Power Off", 40, SCREEN_HEIGHT - 26, 2, c_white);
        } else if (state == VIEW_CONTROL_PANEL) {
            draw_string(ren, "[UP/DOWN] Select  [LEFT/RIGHT] Adjust  [B] Back", 40, SCREEN_HEIGHT - 26, 2, c_white);
        } else {
            draw_string(ren, "[B/Enter] Back to Main Menu", 40, SCREEN_HEIGHT - 26, 2, c_white);
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
