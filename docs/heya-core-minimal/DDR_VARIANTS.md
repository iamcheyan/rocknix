# H700 镜像为什么会出两张（DDR3 / DDR4）

> 基线：`heya-core-minimal` 分支，`projects/ROCKNIX/config.xml` 现状。
> 结论先行：一次 `make H700` 会生成两张 `.img.gz`，因为 H700 在 `config.xml` 里声明了**两个带 `mkimage_options` 的子设备**（`DDR4` 和 `DDR3`）。只要保留两个子设备，构建系统就会为每个子设备各出一张完整镜像。我们只需要 DDR4（RG34XX），因此应当删掉 DDR3 子设备，并同步处理依赖它的两个包。

---

## 1. 现象

在 hx90 上跑完一次 `make H700` 后，`target/` 里会出现：

```
ROCKNIX-H700.aarch64-<日期>-DDR4.img.gz
ROCKNIX-H700.aarch64-<日期>-DDR3.img.gz
```

两者的差异只在 **u-boot 引导程序**（以及 DDR3 的 dtb overlay）。系统 rootfs、内核、包集合完全相同。我们只刷 DDR4 那张，DDR3 那张每次都被白白编译、打包、压缩一遍。

---

## 2. 完整链路（证据链）

这个问题不是某一个脚本写错了，而是四层配置叠加的结果。按数据流顺序：

### 2.1 `config.xml` 声明两个子设备

`projects/ROCKNIX/config.xml:2-47`：

```xml
<H700 dtb_prefix="allwinner">
  <DDR4 mkimage_options="dtb,extlinux,uboot" fdt="device_trees/sun50i-h700-anbernic-rg34xx.dtb" fdt_type="fdt">
    <file>sun50i-h700-anbernic-rg34xx</file>
    ...（20 个 dtb）
  </DDR4>
  <DDR3 mkimage_options="dtb,extlinux,uboot" fdt="device_trees/sun50i-h700-anbernic-rg34xx.dtb"
        fdt_type="fdt" fdt_overlays="sun50i-h700-anbernic-rg35xx-2024-ddr3.dtbo">
    <file>sun50i-h700-anbernic-rg34xx</file>
    ...（同样的 20 个 dtb）
  </DDR3>
</H700>
```

`DDR4` / `DDR3` 是**子设备名**（subdevice），`mkimage_options` 属性表示"这个子设备要生成镜像"。注意两个块的 dtb 列表几乎一样，区别是 DDR3 多一个 `fdt_overlays`。

### 2.2 构建脚本把它们收集成 `SUBDEVICES`

`distributions/ROCKNIX/config/functions:216-218`：

```sh
CONFIGXML="${PROJECT_DIR}/${PROJECT}/config.xml"
SUBDEVICES=$(xmlstarlet sel -t -m "//rocknix/${DEVICE}/*[@mkimage_options]" -v "name()" -n "${CONFIGXML}" 2>/dev/null | tr '\n' ' ')
```

用 `xmlstarlet` 取 `/rocknix/H700/*` 下所有**带 `mkimage_options` 属性**的元素的标签名，得到：

```
SUBDEVICES="DDR4 DDR3 "
```

这一步是全问题的源头：**`SUBDEVICES` 有多少个词，下游就循环多少次。**

### 2.3 u-boot 包为每个子设备各编一份

`projects/ROCKNIX/devices/H700/packages/u-boot/package.mk:14-35`：

```sh
for PKG_SUBDEVICE in ${SUBDEVICES}; do
  PKG_DEPENDS_UNPACK+=" u-boot-${PKG_SUBDEVICE}"
  PKG_NEED_UNPACK+=" $(get_pkg_directory u-boot-${PKG_SUBDEVICE})"
  PKG_NEED_UNPACK+=" ${SYSROOT_PREFIX}/usr/share/u-boot-${PKG_SUBDEVICE}/u-boot-sunxi-with-spl.bin"
done

makeinstall_target() {
  mkdir -p $INSTALL/usr/share/bootloader
  for PKG_SUBDEVICE in ${SUBDEVICES}; do
    PKG_UBOOTBIN=${PKG_ORIG_SYSROOT_PREFIX}/usr/share/u-boot-${PKG_SUBDEVICE}/u-boot-sunxi-with-spl.bin
    cp -av ${PKG_UBOOTBIN} $INSTALL/usr/share/bootloader/H700_${PKG_SUBDEVICE}_u-boot-sunxi-with-spl.bin
  done
}
```

即：编出 `u-boot-DDR4` 和 `u-boot-DDR3` 两个子包，镜像里同时放 `H700_DDR4_u-boot-sunxi-with-spl.bin` 和 `H700_DDR3_u-boot-sunxi-with-spl.bin`。

### 2.4 suspend stub 与 ATF 同时绑两份

`projects/ROCKNIX/devices/H700/packages/h700-suspend-stub/package.mk:17-22`：

```sh
PKG_DEPENDS_UNPACK="u-boot-DDR4 u-boot-DDR3 atf"
PKG_NEED_UNPACK="$(get_pkg_directory u-boot-DDR4) $(get_pkg_directory u-boot-DDR3) $(get_pkg_directory atf)"

PKG_STUB_VARIANTS="u-boot-DDR4:suspend_stub_lpddr4.bin \
                   u-boot-DDR3:suspend_stub_lpddr3.bin"
```

`projects/ROCKNIX/packages/tools/atf/package.mk:41-44`：

```sh
STUB_DIR="${SYSROOT_PREFIX}/usr/share/h700-suspend-stub"
ATF_SUSPEND="SUNXI_SYSTEM_SUSPEND=1 SUNXI_SUSPEND_STUB=${STUB_DIR}/suspend_stub_lpddr4.bin"
ATF_SUSPEND+=" SUNXI_SUSPEND_STUB2=${STUB_DIR}/suspend_stub_lpddr3.bin"
```

ATF（BL31）在编译期把两个 stub **都嵌入**，运行时按内存类型选一个。所以删 DDR3 时，这里也必须同步，否则 ATF 会去找一个不存在的 `suspend_stub_lpddr3.bin`。

### 2.5 镜像阶段按 `SUBDEVICES` 循环出图

`scripts/image:322-329`：

```sh
if [ -n "${SUBDEVICES}" ]; then
  for SUBDEVICE in ${SUBDEVICES}; do
    do_mkimage "${IMAGE_NAME}"
  done
else
  do_mkimage
fi
```

`do_mkimage()`（`scripts/image:22-50`）把 `UBOOT_SYSTEM="${UBOOT_SYSTEM}"` 传给 `scripts/mkimage`；`scripts/mkimage:24` 用 `IMAGE_NAME` 命名产物。

### 2.6 文件名后缀从哪来

`scripts/image:105-112`：

```sh
if [ -n "${UBOOT_SYSTEM}" ] && [ "${UBOOT_SYSTEM}" != "${DEVICE:-${PROJECT}}" ]; then
  IMAGE_NAME="${IMAGE_NAME}-${UBOOT_SYSTEM}"
fi
if [ -n "${IMAGE_SUFFIX}" ]; then
  IMAGE_NAME="${IMAGE_NAME}-${IMAGE_SUFFIX}"
fi
```

`UBOOT_SYSTEM` 在循环里被设成当前 `SUBDEVICE`（`DDR4`/`DDR3`），与 `DEVICE`（`H700`）不同，于是拼出 `-DDR4` / `-DDR3` 后缀。

### 2.7 一张图

```
config.xml  <H700> 下两个带 mkimage_options 的子元素
        │
        ▼
config/functions:218   SUBDEVICES="DDR4 DDR3"
        │
        ├─────────────► u-boot/package.mk 循环 → u-boot-DDR4、u-boot-DDR3 两个子包
        │                                      → 镜像里两份 H700_*_u-boot-sunxi-with-spl.bin
        ├─────────────► h700-suspend-stub 循环 → suspend_stub_lpddr4.bin、suspend_stub_lpddr3.bin
        │                                      → atf 把两个都嵌进 BL31（SUNXI_SUSPEND_STUB / STUB2）
        └─────────────► scripts/image:323 循环 → do_mkimage ×2
                                               → ROCKNIX-H700.aarch64-<date>-DDR4.img.gz
                                               → ROCKNIX-H700.aarch64-<date>-DDR3.img.gz
```

---

## 3. 为什么当初要这么设计

`[事实]` `bootloader/update.sh:33-48` 在**设备上运行时**读 `vdd-dram` 的电压来区分内存类型：

```sh
for r in /sys/class/regulator/regulator.*/; do
  [[ "$(cat "$r/name" 2>/dev/null)" == "vdd-dram" ]] && VDD_REG_PATH=$r
done
case "$DCDC3_MICROVOLTS" in
  1200000) UBOOT_BIN="H700_DDR3_u-boot-sunxi-with-spl.bin" ;;
  1100000) UBOOT_BIN="H700_DDR4_u-boot-sunxi-with-spl.bin" ;;
esac
```

`[推断]` 上游的意图是：**一张镜像兼容两种内存**，靠运行时探测挑 u-boot。但 `config.xml` 又给 DDR3 单独声明了 `mkimage_options`，于是构建阶段额外产出一张独立镜像——这两件事在功能上是重复的，而代价是每次构建多出一整轮镜像打包（复制 rootfs、mksquashfs、dd 稀疏镜像、gzip）。

---

## 4. 影响

| 影响 | 说明 |
|---|---|
| 构建时间 | 镜像阶段完整跑两遍（rootfs 复制 + squashfs + 稀疏镜像 + 压缩） |
| 磁盘占用 | `target/` 里两份 `.img.gz`、两份 `.tar`、两份 `.sha256` |
| 刷写风险 | 文件名只差 `DDR3`/`DDR4`，容易刷错 |
| 认知成本 | 每次都要解释"为什么有两张" |

`[推断]` 如果只刷 DDR4，DDR3 那张从产出到删除全程没有用户价值。

---

## 5. 修复方案

> **已实施**（`heya-core-minimal` 分支）：
> - `b999540765` build(H700): emit only the DDR4 image — 删除 `config.xml` 的 DDR3 子设备、`h700-suspend-stub` 单变体、`atf` 去掉 `SUNXI_SUSPEND_STUB2`
> - 后续提交：删除 `projects/ROCKNIX/devices/H700/packages/u-boot-DDR3/` 整个包目录，并把 `bootloader/update.sh` 收敛为"只在 DDR4 硬件（vdd-dram = 1.1 V）上更新 u-boot"，DDR3 机器保持原引导不变
> - 结果：`SUBDEVICES` 只剩 `DDR4`，一次构建只产出一张镜像


### 方案 A（推荐）：删掉 DDR3 子设备，只保留 DDR4

适用于"只支持 DDR4 机型（RG34XX 等）"的场景，也是我们现在的目标。

需要改 **三个**文件（少改任何一个都会构建失败）：

#### 5.1 `projects/ROCKNIX/config.xml`

删除 `<H700>` 内的整个 `<DDR3 …>…</DDR3>` 块（第 25–46 行），保留 `<DDR4>`：

```xml
<rocknix>
  <H700 dtb_prefix="allwinner">
    <DDR4 mkimage_options="dtb,extlinux,uboot" fdt="device_trees/sun50i-h700-anbernic-rg34xx.dtb" fdt_type="fdt">
      ...（保持原样）
    </DDR4>
  </H700>
  ...
```

改完后 `SUBDEVICES` 只剩 `DDR4`，u-boot 只编一份、镜像只出一张。

#### 5.2 `projects/ROCKNIX/devices/H700/packages/h700-suspend-stub/package.mk`

去掉 DDR3 的依赖与变体：

```diff
-PKG_DEPENDS_UNPACK="u-boot-DDR4 u-boot-DDR3 atf"
-PKG_NEED_UNPACK="$(get_pkg_directory u-boot-DDR4) $(get_pkg_directory u-boot-DDR3) $(get_pkg_directory atf)"
+PKG_DEPENDS_UNPACK="u-boot-DDR4 atf"
+PKG_NEED_UNPACK="$(get_pkg_directory u-boot-DDR4) $(get_pkg_directory atf)"

-PKG_STUB_VARIANTS="u-boot-DDR4:suspend_stub_lpddr4.bin \
-                   u-boot-DDR3:suspend_stub_lpddr3.bin"
+PKG_STUB_VARIANTS="u-boot-DDR4:suspend_stub_lpddr4.bin"
```

#### 5.3 `projects/ROCKNIX/packages/tools/atf/package.mk`

不再把第二个 stub 传给 TF-A：

```diff
   H700)
     PKG_VERSION="2.12.0"
     PKG_SHA256="d95aaf292792c98035910d7e6c64ebfb297c897fef510415db1612f6d39f9223"
     PKG_DEPENDS_TARGET+=" h700-suspend-stub"
     ...
   ;;
```

```diff
     STUB_DIR="${SYSROOT_PREFIX}/usr/share/h700-suspend-stub"
     ATF_SUSPEND="SUNXI_SYSTEM_SUSPEND=1 SUNXI_SUSPEND_STUB=${STUB_DIR}/suspend_stub_lpddr4.bin"
-    ATF_SUSPEND+=" SUNXI_SUSPEND_STUB2=${STUB_DIR}/suspend_stub_lpddr3.bin"
   fi
```

> 注意：`SUNXI_SUSPEND_STUB2` 是 TF-A 补丁里的**可选**参数（`patches/H700/001-allwinner-h616-psci-system-suspend.patch` 的说明写明 "optionally SUNXI_SUSPEND_STUB2 for a second memory type"），删掉后 BL31 仍能编译，只是只认 DDR4 的 stub。

#### 5.4 `bootloader/update.sh`（可选）

`update.sh` 的 DDR3 分支可以保留：`if [ -f … ]` 会跳过不存在的文件，不会报错。若想彻底清理，也可以把 `1200000) UBOOT_BIN="H700_DDR3…"` 分支删掉，让 DDR3 设备明确失败而不是静默不更新。

### 方案 B：保留两份 u-boot，只抑制 DDR3 镜像

如果想继续兼容 DDR3 硬件、但不想出第二张图，可以只让 `SUBDEVICES` 影响 u-boot 编译、不影响镜像循环。做法是在 `scripts/image` 里给镜像循环加过滤（例如跳过 `SUBDEVICE != DDR4`），而不动 `config.xml`。

代价：需要改构建脚本本身，与上游差异变大，后续 rebase 更容易冲突。**只有在确实要支持 DDR3 机型时才值得。**

---

## 6. 验证

### 6.1 改完后先确认变量展开

```sh
cd ~/development/rocknix
DEVICE=H700 PROJECT=ROCKNIX PROJECT_DIR=$PWD/projects
xmlstarlet sel -t -m "//rocknix/H700/*[@mkimage_options]" -v "name()" -n projects/ROCKNIX/config.xml
```

期望只输出一行：`DDR4`。

### 6.2 只重出镜像（不必重编包）

配置改动不影响已编译的包，`build.ROCKNIX-H700.aarch64/.stamps` 里已有全部包记录：

```sh
docker run --rm --init --name rocknix_h700_img --user $(id -u):$(id -g) \
  -e HOME="$HOME" -e LANG=C.UTF-8 -e TMPDIR=/tmp \
  -v "$PWD:$PWD" -w "$PWD" \
  ghcr.io/rocknix/rocknix-build:latest \
  bash -c './scripts/image mkimage > .buildlog/image.log 2>&1; echo IMAGE_RC=$? >> .buildlog/image.log'
```

> 注意：改 `h700-suspend-stub` / `atf` 的依赖会触发这两个包重编，因此**第一次**改完仍建议跑完整 `make H700`（或先 `./scripts/clean h700-suspend-stub atf u-boot` 再 `make H700`）。之后的纯镜像调整才用 `./scripts/image mkimage`。

### 6.3 检查产物

```sh
ls -la target/*.img.gz target/*.sha256
```

期望只有一组（DDR4）：

```
ROCKNIX-H700.aarch64-<date>-DDR4.img.gz
ROCKNIX-H700.aarch64-<date>-DDR4.img.gz.sha256
```

### 6.4 校验

```sh
cd target && sha256sum -c ./*.img.gz.sha256
```

---

## 7. 回滚

```sh
git checkout -- projects/ROCKNIX/config.xml \
  projects/ROCKNIX/devices/H700/packages/h700-suspend-stub/package.mk \
  projects/ROCKNIX/packages/tools/atf/package.mk
```

回滚后 DDR3 支持恢复，同时两张镜像也会恢复产出。

---

## 8. 风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| DDR3 机型不再受支持 | 删掉 DDR3 子设备后，DDR3 内存的 RG35XX 等机型没有对应 u-boot 与 stub | 明确本分支只面向 DDR4 机型（RG34XX）；需要 DDR3 时回滚 |
| ATF 编译失败 | 若只删 `config.xml` 而忘了改 ATF，`SUNXI_SUSPEND_STUB2` 指向不存在的文件 | 三个文件一起改；构建日志里搜 `SUNXI_SUSPEND_STUB` |
| suspend 失效 | 删 DDR3 stub 后，DDR3 硬件上 BL31 找不到匹配 stub | 与第一条同源；DDR4 机型不受影响 |
| 缓存导致旧产物残留 | `target/` 里旧的两张图不会被自动删除 | 改完先 `rm -f target/*DDR3*`，再构建 |

---

## 9. 一句话总结

`config.xml` 的 `<H700>` 下有 **两个** `mkimage_options` 子设备，`SUBDEVICES` 把数量变成了下游所有循环的次数——u-boot 包编两份、suspend stub 编两份、ATF 嵌两份、镜像打包两遍。只保留 DDR4 需要同时改 `config.xml`、`h700-suspend-stub/package.mk`、`atf/package.mk` 三处；只改第一处会让构建在 ATF 或 stub 包处失败。
