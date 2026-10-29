#include <SDL2/SDL.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <unistd.h>
#include <time.h>
#include <sys/statvfs.h>
#include <sys/utsname.h>
#include <sys/sysinfo.h>

void draw_string(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color);
void draw_string_marquee(SDL_Renderer* ren, const char* str, int x, int y, int scale, SDL_Color color, int max_w, bool active, Uint32 ticks);
static bool is_target_device(void);

static const SDL_Color tool_white  = {255, 255, 255, 255};
static const SDL_Color tool_gray   = {160, 160, 160, 255};
static const SDL_Color tool_cyan   = {0, 220, 255, 255};
static const SDL_Color tool_accent = {255, 196, 0, 255};

typedef struct {
    char label[32];
    char value[96];
} LauncherInfoRow;

static void launcher_read_text(const char* path, char* out, size_t size, const char* fallback)
{
    FILE* f = fopen(path, "r");
    if (!f) {
        snprintf(out, size, "%s", fallback);
        return;
    }
    if (!fgets(out, (int)size, f))
        snprintf(out, size, "%s", fallback);
    fclose(f);
    out[strcspn(out, "\r\n")] = 0;
}

static void launcher_read_uptime(char* out, size_t size)
{
    struct sysinfo info;
    if (sysinfo(&info) != 0) {
        snprintf(out, size, "Unavailable");
        return;
    }
    long days = info.uptime / 86400;
    long hours = (info.uptime % 86400) / 3600;
    long mins = (info.uptime % 3600) / 60;
    snprintf(out, size, "%ldd %02ld:%02ld", days, hours, mins);
}

static int launcher_collect_info(LauncherInfoRow* rows, int capacity)
{
    struct utsname uts;
    char text[96];
    int n = 0;

#define ADD_ROW(k, v) do { if (n < capacity) { \
    snprintf(rows[n].label, sizeof(rows[n].label), "%s", (k)); \
    snprintf(rows[n].value, sizeof(rows[n].value), "%s", (v)); \
    n++; } } while (0)

    if (uname(&uts) == 0) {
        ADD_ROW("Kernel", uts.release);
        ADD_ROW("Architecture", uts.machine);
    }

    launcher_read_uptime(text, sizeof(text));
    ADD_ROW("Uptime", text);

    launcher_read_text("/sys/class/power_supply/battery/status", text, sizeof(text), "Unavailable");
    ADD_ROW("Battery state", text);

    launcher_read_text("/sys/class/power_supply/battery/capacity", text, sizeof(text), "Unavailable");
    if (strcmp(text, "Unavailable") != 0) {
        size_t len = strlen(text);
        if (len + 1 < sizeof(text)) {
            text[len] = '%';
            text[len + 1] = 0;
        }
    }
    ADD_ROW("Battery level", text);

    launcher_read_text("/proc/sys/kernel/hostname", text, sizeof(text), "Unavailable");
    ADD_ROW("Hostname", text);

    launcher_read_text("/sys/class/thermal/thermal_zone0/temp", text, sizeof(text), "Unavailable");
    if (strcmp(text, "Unavailable") != 0) {
        char* end = NULL;
        long milli = strtol(text, &end, 10);
        if (end != text)
            snprintf(text, sizeof(text), "%.1f C", milli / 1000.0);
    }
    ADD_ROW("CPU temperature", text);

    struct sysinfo mem;
    if (sysinfo(&mem) == 0) {
        unsigned long total_mb = (mem.totalram * mem.mem_unit) / (1024UL * 1024UL);
        unsigned long avail_kb = 0;
        FILE* f = fopen("/proc/meminfo", "r");
        if (f) {
            char line[128];
            while (fgets(line, sizeof(line), f)) {
                if (sscanf(line, "MemAvailable: %lu kB", &avail_kb) == 1)
                    break;
            }
            fclose(f);
        }
        snprintf(text, sizeof(text), "%lu / %lu MB available", avail_kb / 1024UL, total_mb);
        ADD_ROW("Memory", text);
    }

    struct statvfs st;
    const char* storage = access("/storage", F_OK) == 0 ? "/storage" : ".";
    if (statvfs(storage, &st) == 0) {
        unsigned long long free_mb = (unsigned long long)st.f_bavail * st.f_frsize / (1024ULL * 1024ULL);
        unsigned long long total_mb = (unsigned long long)st.f_blocks * st.f_frsize / (1024ULL * 1024ULL);
        snprintf(text, sizeof(text), "%llu / %llu MB free", free_mb, total_mb);
        ADD_ROW("Storage", text);
    }

#undef ADD_ROW
    return n;
}

static bool launcher_confirm_action(SDL_Renderer* ren, const char* title, const char* warning)
{
    bool confirmed = false;
    bool decided = false;
    SDL_Event e;

    while (!decided) {
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) {
                decided = true;
            } else if (e.type == SDL_KEYDOWN) {
                SDL_Keycode k = e.key.keysym.sym;
                if (k == SDLK_y || k == SDLK_RETURN) {
                    confirmed = true;
                    decided = true;
                } else if (k == SDLK_n || k == SDLK_ESCAPE || k == SDLK_BACKSPACE) {
                    decided = true;
                }
            } else if (e.type == SDL_CONTROLLERBUTTONDOWN) {
                Uint8 btn = e.cbutton.button;
                if (btn == SDL_CONTROLLER_BUTTON_B) {
                    confirmed = true;
                    decided = true;
                } else if (btn == SDL_CONTROLLER_BUTTON_A) {
                    decided = true;
                }
            }
        }
        SDL_SetRenderDrawColor(ren, 20, 24, 32, 255);
        SDL_RenderClear(ren);
        draw_string(ren, title, 45, 120, 2, tool_cyan);
        draw_string(ren, warning, 45, 190, 1, tool_white);
        draw_string(ren, "[A/ENTER] CONFIRM          [B/ESC] CANCEL", 45, 430, 1, tool_accent);
        SDL_RenderPresent(ren);
        SDL_Delay(16);
    }
    return confirmed;
}

static void launcher_run_tool_action(SDL_Renderer* ren, int selected, bool* done)
{
    switch (selected) {
        case 0:
            if (is_target_device())
                (void)!system("rocknix-memory-manager --status");
            else
                printf("[SIMULATOR] ZRAM status requested.\n");
            break;
        case 1:
            if (launcher_confirm_action(ren, "CREATE DIAGNOSTIC FILE?",
                    "System details are written to /storage/rocknix-system-info.txt.")) {
                if (is_target_device())
                    (void)!system("rocknix-info > /storage/rocknix-system-info.txt 2>&1");
                else
                    printf("[SIMULATOR] Diagnostic file created (simulated).\n");
            }
            break;
        case 2:
            if (launcher_confirm_action(ren, "BACK UP CONFIGURATION?",
                    "Creates /storage/roms/backup/ROCKNIX_BACKUP.zip.")) {
                if (is_target_device())
                    (void)!system("backuptool backup");
                else
                    printf("[SIMULATOR] Backup created (simulated).\n");
            }
            break;
        case 3:
            if (launcher_confirm_action(ren, "RESTORE BACKUP?",
                    "This overwrites the saved configuration and reboots the device.")) {
                if (is_target_device())
                    (void)!system("unzip -t /storage/roms/backup/ROCKNIX_BACKUP.zip >/dev/null 2>&1 && "
                                  "unzip -o /storage/roms/backup/ROCKNIX_BACKUP.zip -d / && systemctl reboot");
                else
                    printf("[SIMULATOR] Restore requested (simulated).\n");
            }
            break;
        case 4:
            if (launcher_confirm_action(ren, "RESTART AUDIO SERVICES?",
                    "Audio output is interrupted briefly.")) {
                if (is_target_device())
                    (void)!system("systemctl restart pipewire-pulse pipewire-pulse.socket pipewire pipewire.socket wireplumber");
                else
                    printf("[SIMULATOR] Audio restart requested (simulated).\n");
            }
            break;
        default:
            *done = true;
            break;
    }
}

static void launcher_open_settings(SDL_Renderer* ren)
{
    const char* items[] = {
        "Show ZRAM status",
        "Create diagnostic file",
        "Back up configuration",
        "Restore configuration",
        "Restart audio services",
        "Back"
    };
    const int item_count = (int)(sizeof(items) / sizeof(items[0]));
    int selected = 0;
    bool done = false;
    SDL_Event e;

    while (!done) {
        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) {
                done = true;
            } else if (e.type == SDL_KEYDOWN) {
                SDL_Keycode k = e.key.keysym.sym;
                if (k == SDLK_UP || k == SDLK_w)
                    selected = (selected + item_count - 1) % item_count;
                else if (k == SDLK_DOWN || k == SDLK_s)
                    selected = (selected + 1) % item_count;
                else if (k == SDLK_ESCAPE || k == SDLK_BACKSPACE)
                    done = true;
                else if (k == SDLK_RETURN || k == SDLK_SPACE)
                    launcher_run_tool_action(ren, selected, &done);
            } else if (e.type == SDL_CONTROLLERBUTTONDOWN) {
                Uint8 btn = e.cbutton.button;
                if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP)
                    selected = (selected + item_count - 1) % item_count;
                else if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN)
                    selected = (selected + 1) % item_count;
                else if (btn == SDL_CONTROLLER_BUTTON_A)
                    done = true;
                else if (btn == SDL_CONTROLLER_BUTTON_B)
                    launcher_run_tool_action(ren, selected, &done);
            }
        }

        SDL_SetRenderDrawColor(ren, 20, 24, 32, 255);
        SDL_RenderClear(ren);
        draw_string(ren, "=== SYSTEM TOOLS ===", 55, 48, 2, tool_cyan);

        for (int i = 0; i < item_count; i++) {
            int y = 100 + i * 54;
            SDL_Rect r = {45, y - 4, 620, 44};
            if (i == selected) {
                SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
            } else {
                SDL_SetRenderDrawColor(ren, 32, 38, 50, 255);
            }
            SDL_RenderFillRect(ren, &r);
            draw_string(ren, items[i], 60, y + 8, 2, i == selected ? tool_white : tool_gray);
        }

        draw_string(ren, "Backup and restore use PJOS Linux tools.", 60, 430, 1, tool_gray);
        SDL_RenderPresent(ren);
        SDL_Delay(16);
    }
}

static void launcher_open_system_info(SDL_Renderer* ren)
{
    int selected = 0;
    int offset = 0;
    bool done = false;
    SDL_Event e;

    while (!done) {
        LauncherInfoRow rows[12];
        int count = launcher_collect_info(rows, 12);

        while (SDL_PollEvent(&e)) {
            if (e.type == SDL_QUIT) {
                done = true;
            } else if (e.type == SDL_KEYDOWN) {
                SDL_Keycode k = e.key.keysym.sym;
                if (k == SDLK_UP && count)
                    selected = (selected + count - 1) % count;
                else if (k == SDLK_DOWN && count)
                    selected = (selected + 1) % count;
                else if (k == SDLK_ESCAPE || k == SDLK_BACKSPACE || k == SDLK_RETURN)
                    done = true;
            } else if (e.type == SDL_CONTROLLERBUTTONDOWN) {
                Uint8 btn = e.cbutton.button;
                if (btn == SDL_CONTROLLER_BUTTON_DPAD_UP && count)
                    selected = (selected + count - 1) % count;
                else if (btn == SDL_CONTROLLER_BUTTON_DPAD_DOWN && count)
                    selected = (selected + 1) % count;
                else if (btn == SDL_CONTROLLER_BUTTON_A || btn == SDL_CONTROLLER_BUTTON_B)
                    done = true;
            }
        }

        if (selected < offset)
            offset = selected;
        if (selected >= offset + 6)
            offset = selected - 5;

        SDL_SetRenderDrawColor(ren, 20, 24, 32, 255);
        SDL_RenderClear(ren);
        draw_string(ren, "=== LIVE SYSTEM INFORMATION ===", 40, 48, 2, tool_cyan);

        for (int i = 0; i < 6 && offset + i < count; i++) {
            int idx = offset + i;
            int y = 92 + i * 48;
            SDL_Rect r = {45, y - 4, 620, 40};
            if (idx == selected) {
                SDL_SetRenderDrawColor(ren, 0, 120, 215, 255);
            } else {
                SDL_SetRenderDrawColor(ren, 32, 38, 50, 255);
            }
            SDL_RenderFillRect(ren, &r);
            draw_string(ren, rows[idx].label, 58, y + 8, 2, idx == selected ? tool_white : tool_cyan);
            draw_string_marquee(ren, rows[idx].value, 300, y + 8, 2,
                                idx == selected ? tool_accent : tool_white, 350,
                                idx == selected, SDL_GetTicks());
        }

        draw_string(ren, "[D-PAD] SCROLL                 [B] BACK", 40, 450, 1, tool_gray);
        SDL_RenderPresent(ren);
        SDL_Delay(250);
    }
}
