local history = require("history")
local system = require("system")
local utils = require("utils")
local runtime = require("runtime")
local media_marker = require("media_marker")
local player = {}

-- Flag to signal main.lua to do a hard refresh
player.needs_refresh = false

local function get_saved_playback_position(filepath, watch_later_dir)
    local p = io.popen("ls " .. runtime.quote(watch_later_dir) .. " 2>/dev/null")
    if not p then return nil end

    local position = nil
    for filename in p:lines() do
        local full_path = watch_later_dir .. "/" .. filename
        local f = io.open(full_path, "r")
        if f then
            local lines = {}
            for line in f:lines() do
                table.insert(lines, line)
            end
            f:close()

            -- Check if this watch-later file belongs to our video
            local belongs_to_us = false
            for _, line in ipairs(lines) do
                if line:match("^#%s*(.-)%s*$") == filepath then
                    belongs_to_us = true
                    break
                end
            end

            if belongs_to_us then
                -- Find the start position
                for _, line in ipairs(lines) do
                    local start_val = line:match("^start=([%d%.]+)")
                    if start_val then
                        position = tonumber(start_val)
                        break
                    end
                end
                break
            end
        end
    end
    p:close()
    return position
end

function player.play_video(filepath, resume, options)
    if not filepath or filepath == "" then return end

    local paths = {}
    local loop = false
    local shuffle = false

    if type(options) == "table" then
        loop = options.loop
        shuffle = options.shuffle
    end

    if type(filepath) == "table" then
        paths = filepath
    else
        paths = { filepath }
    end

    if #paths == 0 then return end

    local settings = require("settings")
    local ui = require("ui")

    -- 1. Check player setting and availability
    if settings.video_player_mode == "mpv" then
        local ok = os.execute("command -v mpv >/dev/null 2>&1")
        if not (ok == true or ok == 0) then
            ui.show_toast("mpv not available", "info", "top_center")
            return false
        end
    else
        local builtin_exe = runtime.binary("ffplay")
        local f = io.open(builtin_exe, "r")
        local has_builtin = false
        if f then
            f:close()
            has_builtin = true
        end
        local ok_sys = os.execute("command -v ffplay >/dev/null 2>&1")
        local has_system = (ok_sys == true or ok_sys == 0)

        if not has_builtin and not has_system then
            ui.show_toast("ffplay not available", "info", "top_center")
            return false
        end
    end

    -- Record history for the first file at least
    history.add(paths[1])

    if settings.video_player_mode == "mpv" then
        local storage_path = utils.get_storage_path()
        local watch_later_dir = storage_path .. "/mpv/watch_later"
        local mpv_config_dir = storage_path .. "/mpv"
        os.execute("mkdir -p " .. runtime.quote(watch_later_dir))
        os.execute("mkdir -p " .. runtime.quote(mpv_config_dir))

        local screenshot_dir = system.get_screenshot_dir()
        if screenshot_dir and screenshot_dir ~= "" then
            os.execute("mkdir -p \"" .. screenshot_dir .. "\"")
        end

        local resume_flag = resume and "--resume-playback=yes" or "--start=0"
        local loop_flag = loop and "--loop-playlist=inf" or ""

        local target_src = ""
        local temp_playlist_path = nil

        if #paths > 1 then
            if shuffle then
                utils.shuffle(paths)
            end

            temp_playlist_path = mpv_config_dir .. "/temp_playlist.m3u"
            local f = io.open(temp_playlist_path, "w")
            if f then
                for _, p in ipairs(paths) do
                    f:write(p .. "\n")
                end
                f:close()
            end
            target_src = " --playlist=" .. runtime.quote(temp_playlist_path)
            print("Launching MPV with playlist containing " .. #paths .. " files")
        else
            target_src = " " .. runtime.quote(paths[1])
            print("Launching MPV for single file: " .. paths[1])
        end

        local screenshot_arg = ""
        if screenshot_dir and screenshot_dir ~= "" then
            screenshot_arg = " --screenshot-directory=" .. runtime.quote(screenshot_dir)
        end

        local sub_pos_map = {
            Top = 0,
            Center = 60,
            Bottom = 100
        }
        local sub_pos_val = sub_pos_map[settings.sub_position] or 100

        local sub_scale_val = 1.0
        if settings.sub_font_size then
            local pct = settings.sub_font_size:match("%%(%d+)")
            if pct then
                sub_scale_val = tonumber(pct) / 100
            end
        end
        local sub_arg = string.format(" --sub-pos=%d --sub-scale=%.2f", sub_pos_val, sub_scale_val)

        local command = string.format(
            "%s %s %s%s%s --save-position-on-quit --watch-later-directory=%s --write-filename-in-watch-later-config=yes %s --input-conf=./config/input.conf --config-dir=./config",
            runtime.command("mpv"), target_src, loop_flag, screenshot_arg, sub_arg, runtime.quote(watch_later_dir), resume_flag)

        print("Executing: " .. command)
        media_marker.set(true)
        os.execute(command)
        media_marker.set(false)

        -- Delete the temporary playlist file if it was created
        if temp_playlist_path then
            os.remove(temp_playlist_path)
        end

        print("MPV exited, returning to XMPlayer")

    elseif settings.video_player_mode:sub(1, 6) == "ffplay" then
        if #paths == 0 then return end
        print("Launching ffplay for " .. #paths .. " files")

        local storage_path = utils.get_storage_path()
        local watch_later_dir = storage_path .. "/mpv/watch_later"

        local ffplay_bin = runtime.command("ffplay")
        local is_builtin = false
        local builtin_exe = runtime.binary("ffplay")
        local f = io.open(builtin_exe, "r")
        if f then
            f:close()
            ffplay_bin = runtime.command("ffplay")
            is_builtin = true
        end

        local vf_arg = ""
        if settings.ffplay_aspect_ratio and settings.ffplay_aspect_ratio ~= "Original" then
            local ratio = settings.ffplay_aspect_ratio:gsub(":", "/")
            vf_arg = string.format(' -vf "setdar=%s"', ratio)
        end

        local env_prefix = ""
        if is_builtin then
            local wayland = os.getenv("WAYLAND_DISPLAY")
            local session = os.getenv("XDG_SESSION_TYPE")
            local display = os.getenv("DISPLAY")

            if wayland or (session and session == "wayland") then
                env_prefix = "SDL_VIDEODRIVER=wayland "
            elseif display and display ~= "" then
                env_prefix = "SDL_VIDEODRIVER=x11 "
            end
        end

        -- Launch FFplay sequentially
        for _, p in ipairs(paths) do

            local ss_arg = ""
            if resume then
                local pos = get_saved_playback_position(p, watch_later_dir)
                if pos and pos > 0 then
                    ss_arg = string.format(" -ss %.3f", pos)
                end
            end

            local command = string.format('%s%s -fs -autoexit -noborder%s%s %s', env_prefix, ffplay_bin, vf_arg, ss_arg,
                runtime.quote(p))
            print("Executing: " .. command)
            media_marker.set(true)
            os.execute(command)
            media_marker.set(false)
        end

        print("FFplay exited, returning to XMPlayer")

    end

    -- Signal that we need a hard display refresh
    player.needs_refresh = true
end

function player.play_slideshow(filepaths)
    if not filepaths then return end

    local paths = {}
    if type(filepaths) == "string" then
        if utils.is_photo_file(filepaths) then
            table.insert(paths, filepaths)
        end
    elseif type(filepaths) == "table" then
        for _, item in ipairs(filepaths) do
            local p = (type(item) == "table") and item.path or item
            if p and type(p) == "string" and utils.is_photo_file(p) then
                table.insert(paths, p)
            end
        end
    end

    if #paths == 0 then return end

    local ui = require("ui")
    local settings = require("settings")

    local ok = os.execute("command -v mpv >/dev/null 2>&1")
    local is_windows = (package.config:sub(1,1) == '\\') or (love.system and love.system.getOS() == "Windows")
    if not is_windows and not (ok == true or ok == 0) then
        ui.show_toast("mpv not available", "info", "top_center")
        return false
    end

    print("Launching mpv slideshow for " .. #paths .. " files")

    local storage_path = utils.get_storage_path()
    local mpv_config_dir = storage_path .. "/mpv"
    os.execute("mkdir -p " .. runtime.quote(mpv_config_dir))

    local temp_playlist_path = mpv_config_dir .. "/temp_slideshow.m3u"
    local f = io.open(temp_playlist_path, "w")
    if f then
        for _, p in ipairs(paths) do
            f:write(p .. "\n")
        end
        f:close()
    end

    local duration = settings.slideshow_duration_seconds or 5
    local loop_flag = settings.loop_slideshow_enabled and " --loop-playlist=inf" or ""

    local command = string.format(
        '%s --image-display-duration=%d%s --fullscreen --playlist=%s --input-conf=./config/input.conf --config-dir=./config',
        runtime.command("mpv"), duration, loop_flag, runtime.quote(temp_playlist_path))

    print("Executing slideshow: " .. command)
    os.execute(command)

    if temp_playlist_path then
        os.remove(temp_playlist_path)
    end

    print("MPV slideshow exited, returning to XMPlayer")

    player.needs_refresh = true
end

return player
