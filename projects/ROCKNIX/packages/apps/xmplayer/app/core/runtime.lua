local runtime = {}

function runtime.quote(value)
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

function runtime.binary(name)
    local override = os.getenv("XMPLAYER_" .. name:upper())
    if override and override ~= "" then return override end
    if os.getenv("XMPLAYER_SIMULATOR") == "1" then return name end
    if package.config:sub(1, 1) ~= "\\" and (name == "ffmpeg" or name == "ffplay") then
        return love.filesystem.getSource() .. "/bin/" .. name
    end
    return name
end

function runtime.command(name)
    local binary = runtime.quote(runtime.binary(name))
    local playback = os.getenv("XMPLAYER_PLAYBACK")
    if playback and playback ~= "" and (name == "mpv" or name == "ffplay") then
        return runtime.quote(playback) .. " " .. binary
    end
    return binary
end

return runtime
