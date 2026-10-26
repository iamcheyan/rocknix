# 07 · 主题系统

> 基线：`next` @ `742bd52562`。ES 主题引擎在 `emulationstation-next` 内部，本仓库只包含**主题包与安装路径**；涉及 schema 细节的结论标 `[推断]`。

## 1. 主题从哪来

| 项 | 事实 | 证据 |
|---|---|---|
| 默认主题包 | `es-theme-art-book-next`（上游 `anthonycaccese/art-book-next-es`） | `projects/ROCKNIX/packages/ui/themes/es-theme-art-book-next/package.mk:4-10` |
| 版本 | 固定 commit `9a50ef3…` | 同上 `:5` |
| 安装路径 | `/usr/share/themes/es-theme-art-book-next` | 同上 `:16-17` |
| 用户可见主题 | `/storage/.config/emulationstation/themes/system-theme` → 软链到上面的系统主题 | `userconfig-setup:34-37` |
| 额外主题目录 | `/storage/roms/themes`（由 `add_system_dir` 创建） | `.../virtual/emulators/package.mk:150` |

`[事实]` 系统主题随 OTA 更新：`system-theme` 是软链，不是拷贝；用户替换主题应放在 `/storage/.config/emulationstation/themes/` 的其他目录，而不是覆盖 `system-theme`。

## 2. 主题格式

`[事实]` ROCKNIX 对主题包做了三类构建期改写（`es-theme-art-book-next/package.mk:17-30`）：

1. 删除不需要的 artwork 变体目录：`_inc/systems/{artwork-circuit,artwork-classic,artwork-nintendont,artwork-noir,artwork-outline}`
2. 从 `theme.xml` 删除对应 `<include name="noir|nintendont|circuit|outline"/>`
3. 向 `fonts.xml` 注入中文变量：

```xml
<variables lang="zh" ifSubset="fonts:default|custom">
  <fontBold>/usr/share/fonts/truetype/noto-cjk/NotoSansCJKsc-Regular.otf</fontBold>
  ...
</variables>
```

`[推断]` 由此可确认主题引擎支持：

- `theme.xml` 作为入口，支持 `<include name="…"/>` 组合子文件
- `fonts.xml` 支持按语言（`lang="zh"`）和字体子集（`ifSubset`）切换字体
- 每个系统可有独立 artwork 目录（`_inc/systems/…`）

`[推断]` ES 主题的典型结构（来自 ES 主题 schema 与上述 include 机制）：

```text
theme.xml                 # 入口：变量、include、view 定义
fonts.xml                 # 字体与语言变量
_inc/
  systems/<system>.xml    # 每个系统的布局/artwork
  colors.xml              # 调色板
assets/                   # 背景、logo、图标
```

以上目录名在包中被显式引用（`_inc/systems/artwork-*`、`theme.xml`、`fonts.xml`），但完整的 `<view>`/`<image>`/`<text>` 节点结构需要读上游主题仓库才能逐项确认。

## 3. 布局能力（可从构建改写推断的部分）

| 能力 | 是否支持 | 依据 |
|---|---|---|
| 多视图布局（system / gamelist） | `[推断]` 是 | ES 主题引擎的标准能力；主题包按 `_inc/systems` 分系统布局 |
| 图片/背景/logo | `[事实]` 是 | 包内删除的是 `artwork-*` 图片目录 |
| 字体替换与多语言字体 | `[事实]` 是 | 注入 `lang="zh"` 的 `fonts.xml` 变量 |
| 每系统不同布局 | `[推断]` 是 | `_inc/systems/<system>.xml` + `SYSTEM_THEME="nes"` 映射 |
| 动画/视频预览 | `[待验证]` | 主题包未体现；取决于 ES 版本与主题 schema |
| 自定义控件/交互 | `[推断]` 否 | 主题是声明式 XML，不含逻辑 |

`[事实]` 每个系统的主题名来自 `config/emulators/<system>.conf` 的 `SYSTEM_THEME`（如 `nes.conf:9`），ES 用它选择 `_inc/systems/` 下的布局。

## 4. 可扩展性评估（只陈述约束）

1. `[事实]` 主题是**纯数据**：新增主题不需要重新编译 ES，放到 `/storage/.config/emulationstation/themes/` 即可被 ES 识别。
2. `[事实]` 系统级默认主题由包管理，OTA 会覆盖 `system-theme` 软链目标；用户主题不会被覆盖。
3. `[推断]` 主题能力上限由 ES 主题引擎决定，而不是主题文件；如果替换前端，ES 主题 XML 不能直接复用（除非新前端实现同一 schema）。
4. `[推断]` 主题不参与启动、输入、模拟器选择，属于**可替换且低风险**的展示层。

## 5. 结论

- `[事实]` 主题系统的架构位置很清晰：`/usr/share/themes`（只读、随 OTA）+ `/storage/.config/emulationstation/themes`（用户、持久）。
- `[推断]` 如果保留 ES 作为前端，主题系统值得保留（零成本、可定制）；如果替换前端，主题需要重写，但不会影响系统其他部分。
- `[待验证]` ES 主题 schema 的完整节点集合与版本兼容性，需要读 `emulationstation-next` 的主题解析代码或官方主题文档。
