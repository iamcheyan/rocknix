# 05. XMPlayer 掌机按键失灵根因分析与原生手柄修复

在将 [atalaygrgn/XMPlayer](https://github.com/atalaygrgn/XMPlayer) 移植到 ROCKNIX 或其他纯正 Linux 掌机系统时，最常遇到的严重问题是：**界面能够正常渲染显示，但掌机上的十字键、A/B 键等所有实体按键完全失灵，没有任何反应。**

本文档记录了该问题的底层根因及原生修复方案。

---

## 1. 为什么在原版 ROCKNIX 里按键全废？（Root Cause）

### 1.1 XMPlayer 的原本运行环境（muOS）
XMPlayer 原作者是针对 **muOS** 开发的。在 muOS 系统下，后台默认运行着一个名为 `gptokeyb`（Gamepad-To-Keyboard）的虚拟驱动进程。
* 掌机按键被 `gptokeyb` 在底层死死拦截；
* `gptokeyb` 将物理按键翻译成假冒的**电脑键盘按键**（例如按 A 键冒充键盘 `Enter`，按十字键冒充键盘 `Up/Down/Left/Right`）；
* 因此，XMPlayer 的 Lua 源码里**完全偷懒：只写了键盘事件处理函数 `love.keypressed(key)`，压根没有实现任何针对游戏手柄的回调！**

### 1.2 为什么在 ROCKNIX (Wayland/Sway) 彻底瘫痪？
* ROCKNIX 是现代化的嵌入式图形环境（Wayland / Sway + SDL2 原生驱动）；
* 掌机上的按键被作为正规的标准游戏控制器（GameController / Joystick）上报给图形栈；
* 当 Love2D 启动时，它收到的全是正规的 `gamepadpressed` 事件；
* **由于 XMPlayer 源码中缺乏手柄监听回调，Love2D 默默地把所有按键事件当作未处理事件丢弃！**
* 结果：屏幕正常播放动画，但你按爆十字键和 A/B 键，它都纹丝不动。

---

## 2. 彻底根治方案：注入原生手柄驱动桥（Native Gamepad Bridge）

不需要在后台挂复杂的虚拟键盘守护进程，我们在 XMPlayer 的入口文件 [`projects/ROCKNIX/packages/apps/xmplayer/app/main.lua`](file:///home/tetsuya/development/rocknix/projects/ROCKNIX/packages/apps/xmplayer/app/main.lua) 注入了原生的手柄支持：

### 2.1 映射按键按下与抬起
```lua
function love.gamepadpressed(joystick, button)
    local button_map = {
        dpup = "up",
        dpdown = "down",
        dpleft = "left",
        dpright = "right",
        a = "return",
        b = "backspace",
        x = "x",
        y = "y",
        leftshoulder = "pageup",
        rightshoulder = "pagedown",
        start = "return",
        back = "escape"
    }
    local mapped_key = button_map[button]
    if mapped_key then
        love.keypressed(mapped_key)
    end
end
```

### 2.2 解决长按连续翻页（Hook `love.keyboard.isDown`）
XMPlayer 的 XMB 菜单支持长按连续滚动，原版直接调用 `love.keyboard.isDown("up")`，在纯手柄设备上永远返回 `false`。
我们对其进行了重写扩展，让它无缝查询手柄的实时按下状态：
```lua
local original_isDown = love.keyboard.isDown
love.keyboard.isDown = function(key)
    if original_isDown(key) then return true end
    local joysticks = love.joystick.getJoysticks()
    for _, joy in ipairs(joysticks) do
        if joy:isGamepad() then
            if key == "up" and (joy:isGamepadDown("dpup") or joy:getGamepadAxis("lefty") < -0.5) then return true end
            if key == "down" and (joy:isGamepadDown("dpdown") or joy:getGamepadAxis("lefty") > 0.5) then return true end
            if key == "left" and (joy:isGamepadDown("dpleft") or joy:getGamepadAxis("leftx") < -0.5) then return true end
            if key == "right" and (joy:isGamepadDown("dpright") or joy:getGamepadAxis("leftx") > 0.5) then return true end
            -- ... 其余按键状态桥接 ...
        end
    end
    return false
end
```

### 2.3 摇杆轴向映射（Analog Stick Support）
如果掌机带类比摇杆（如 RG34XX / RG35XX-H），通过 `love.gamepadaxis` 设定阈值死区（0.5），推摇杆即可等效十字键导航。

---

## 3. RG34XX 实体按键功能一览表

经过此补丁后，RG34XX 上的所有按键在 XMPlayer 中全部生效：

| 掌机按键 | XMPlayer 功能映射 | 说明 |
| :--- | :--- | :--- |
| **十字键 (D-Pad) / 左摇杆** | `Up / Down / Left / Right` | XMB 横纵十字菜单导航、目录浏览 |
| **A 键** | `Return / Enter` | 确认进入、播放选中的音乐/视频 |
| **B 键** | `Backspace / Escape` | 返回上一级目录 / 退出当前媒体 |
| **X 键** | `x` | 呼出当前项目的上下文菜单（删除/属性） |
| **Y 键** | `y` | 辅助功能、多选 |
| **L1 / R1 肩键** | `PageUp / PageDown` | 列表快速翻页、音量调整 |
| **Start 键** | `Return` | 快捷播放 / 暂停 |
| **Select 键** | `Escape` | 退出播放器返回主启动器 |
