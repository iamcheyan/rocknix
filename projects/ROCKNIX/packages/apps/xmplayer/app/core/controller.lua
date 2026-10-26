local controller = {}
local buttons = {
    dpup = "up", dpdown = "down", dpleft = "left", dpright = "right",
    b = "return", a = "backspace", x = "x", y = "y",
    leftshoulder = "pageup", rightshoulder = "pagedown",
    start = "return", back = "tab",
}

function controller.install(api)
    local keyboard_is_down = api.keyboard.isDown
    local axes = setmetatable({}, {__mode = "k"})

    api.keyboard.isDown = function(...)
        if keyboard_is_down(...) then return true end
        for _, joystick in ipairs(api.joystick.getJoysticks()) do
            if joystick:isGamepad() then
                for _, key in ipairs({...}) do
                    for button, mapped in pairs(buttons) do
                        if key == mapped and joystick:isGamepadDown(button) then return true end
                    end
                    local x, y = joystick:getGamepadAxis("leftx"), joystick:getGamepadAxis("lefty")
                    if key == "up" and y < -0.5 or key == "down" and y > 0.5
                        or key == "left" and x < -0.5 or key == "right" and x > 0.5 then
                        return true
                    end
                end
            end
        end
        return false
    end

    api.gamepadpressed = function(joystick, button)
        if (button == "start" or button == "back")
            and joystick:isGamepadDown("start") and joystick:isGamepadDown("back") then
            api.event.quit()
        elseif buttons[button] then
            api.keypressed(buttons[button])
        end
    end

    api.gamepadreleased = function(_, button)
        if buttons[button] and api.keyreleased then api.keyreleased(buttons[button]) end
    end

    api.gamepadaxis = function(joystick, axis, value)
        if axis ~= "leftx" and axis ~= "lefty" then return end
        local previous = axes[joystick] or {}
        axes[joystick] = previous
        local key
        if value < -0.5 then key = axis == "leftx" and "left" or "up"
        elseif value > 0.5 then key = axis == "leftx" and "right" or "down" end
        if previous[axis] ~= key then
            if previous[axis] and api.keyreleased then api.keyreleased(previous[axis]) end
            previous[axis] = key
            if key then api.keypressed(key) end
        end
    end
end

return controller
