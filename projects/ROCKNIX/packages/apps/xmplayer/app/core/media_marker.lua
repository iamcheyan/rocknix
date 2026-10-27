local media_marker = {}

local MARKER = "/run/media.pid"
local active = false

local function own_pid()
    local file = io.open("/proc/self/stat", "r")
    if not file then return nil end
    local pid = file:read("*n")
    file:close()
    return pid
end

function media_marker.set(on)
    on = on and true or false
    if on == active then return end
    if on then
        local pid = own_pid()
        local file = pid and io.open(MARKER, "w")
        if not file then return end
        file:write(tostring(math.floor(pid)), "\n")
        file:close()
    else
        os.remove(MARKER)
    end
    active = on
end

return media_marker
