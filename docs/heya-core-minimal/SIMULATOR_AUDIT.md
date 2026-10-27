# 05 · H700 模拟器裁剪决策

> ROCKNIX 上游包含 RetroArch、libretro 核心和独立模拟器。本分支的 H700 迷你镜像不包含游戏运行时，供 heya + XMPlayer 使用。

## 实施

- H700 设置 `EMULATION_DEVICE="no"`，不依赖 `emulators` 和 `gamesupport` 元包。
- 迷你镜像不依赖 EmulationStation、ES 主题、ES 工具或生成器。
- 其它设备仍沿用 ROCKNIX 原有模拟器包集合。

## 影响

H700 镜像不提供 ROCKNIX 的 ROM 扫描和游戏启动链。要恢复游戏功能，需要为该镜像添加模拟器、输入映射和相应的应用入口；镜像体积和构建时间收益待完整构建后测量。

## 验证状态

- 镜像构建与包清单检查：待执行。
- H700 实机启动与 heya/XMPlayer 操作：待执行。
