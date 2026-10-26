local root = assert(arg[1], "usage: luajit xmplayer-controller.lua APP_ROOT")
package.path = root .. "/core/?.lua;" .. package.path

local held, pressed, released, quit = {}, {}, {}, 0
local joystick = {}
function joystick:isGamepad() return true end
function joystick:isGamepadDown(button) return held[button] == true end
function joystick:getGamepadAxis() return 0 end
local api = {
    keyboard = {isDown = function(...) return select(1, ...) == "keyboard-only" end},
    joystick = {getJoysticks = function() return {joystick} end},
    event = {quit = function() quit = quit + 1 end},
    keypressed = function(key) pressed[#pressed + 1] = key end,
    keyreleased = function(key) released[#released + 1] = key end,
}

require("controller").install(api)
api.gamepadpressed(joystick, "b")
assert(pressed[#pressed] == "return", "physical A must confirm")
api.gamepadreleased(joystick, "b")
assert(released[#released] == "return")
api.gamepadpressed(joystick, "a")
assert(pressed[#pressed] == "backspace", "physical B must go back")
held.b = true
assert(api.keyboard.isDown("unused", "return"), "held confirm must support multiple keys")
assert(not api.keyboard.isDown("backspace"))
assert(api.keyboard.isDown("keyboard-only"))
held.b = nil
held.start, held.back = true, true
api.gamepadpressed(joystick, "back")
assert(quit == 1, "Start+Select must quit")
held.start, held.back = nil, nil
local count = #pressed
api.gamepadaxis(joystick, "leftx", 0.8)
api.gamepadaxis(joystick, "leftx", 0.9)
assert(#pressed == count + 1 and pressed[#pressed] == "right")
api.gamepadaxis(joystick, "leftx", 0)
assert(released[#released] == "right", "returning to deadzone must release")
print("XMPlayer controller checks passed")
