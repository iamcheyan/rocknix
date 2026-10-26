# 05 · 模拟器审计

> 基线：`next` @ `742bd52562`。证据来自 `docs/audit/ROCKNIX_ARCHITECTURE_REPORT_04_EMULATIONSTATION.md` 与报告 11。

## 保留：RetroArch

`[事实]` RetroArch 是 libretro 前端，本身不绑定特定模拟器核心；核心以动态库形式加载。来源：`projects/ROCKNIX/packages/emulators/retroarch/package.mk`。

保留理由：
- 作为唯一模拟器前端，统一输入/视频/音频后端
- 核心可按需安装，不在默认镜像中包含全部核心
- 与 heya 的"应用即启动器"模型一致：RetroArch 本身就是一个 Application

## 移出默认镜像

| 模拟器 | 替代方案 | 证据 |
|---|---|---|
| PPSSPP | RetroArch SwanStation 核心 | `packages/emulators/ppsspp/` |
| DuckStation | RetroArch DuckStation 核心 | `packages/emulators/duckstation/` |
| melonDS | RetroArch melonDS 核心 | `packages/emulators/melonDS/` |
| MAME | RetroArch MAME 核心 | `packages/emulators/mame/` |
| Flycast | RetroArch Flycast 核心 | `packages/emulators/flycast/` |
| RPCS3 残留 | 完全移除 | `packages/emulators/rpcs3/` |
| 其它大型独立模拟器 | RetroArch 核心替代 | 报告 11 C 类 |

`[事实]` 模拟器规模：139 个系统定义、125 个 libretro 核心（基础）、17 个独立模拟器（基础）。来源：报告 04。

## 分类

### 保留（默认镜像）
- RetroArch
- 基础 libretro 核心（按需选择，约 10–20 个常用核心）

### 移出默认镜像
- 所有独立模拟器（PPSSPP、DuckStation、melonDS、MAME、Flycast、RPCS3 等）
- 非基础 libretro 核心（约 100+ 个）

### 风险未知
- 某些核心可能被系统其它组件依赖（如 `es_features.cfg` 中的配置）
- 移除后需验证 RetroArch 仍能加载剩余核心

## 影响

| 项 | 影响 |
|---|---|
| 镜像体积 | 大幅减少（独立模拟器通常 5–50 MB 每个） |
| 编译时间 | 大幅减少（独立模拟器编译耗时远超核心） |
| `es_systems.cfg` | 不再生成；RetroArch 核心列表由 RetroArch 自身管理 |
| `es_features.cfg` | 不再生成；RetroArch 选项由 `retroarch-core-options.cfg` 管理 |
| 用户体验 | 游戏启动需手动选择核心；不再有 ES 的自动核心选择 |

## 验证

- `make H700` 构建成功
- 镜像中不包含独立模拟器二进制
- RetroArch 可正常启动并加载核心
- `es_systems.cfg` 不存在于镜像中