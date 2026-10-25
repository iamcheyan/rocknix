# 02. 基础编译环境搭建

由于 ROCKNIX 依赖特定的交叉工具链、Linux 内核编译套件以及大量系统依赖（gcc-12/14、bison、flex、xsltproc、u-boot-tools 等），为了确保构建环境的一致性并避免污染宿主机环境，推荐使用官方的 **Docker 容器化环境** 进行编译。

---

## 1. 为什么使用 Docker 编译

1. **环境隔离**：编译系统需要特定版本的编译器和依赖库，Docker 可以在标准 Ubuntu 容器中运行，避免宿主机发行版差异（如 NixOS、Arch、Fedora）导致路径找不到或库版本不匹配的问题。
2. **源码共享**：通过卷挂载（Volume Mount），容器直接读写本地的 `development/rocknix` 目录，宿主机上编辑代码，容器内立即生效。
3. **安全与免污染**：所有临时产物受控生成，不会影响主机的全局配置。

---

## 2. 构建开发容器镜像

仓库根目录下已经包含现成的 [`Dockerfile`](file:///home/tetsuya/development/rocknix/Dockerfile)。在宿主机终端中执行以下命令构建镜像：

```bash
cd /home/tetsuya/development/rocknix

# 构建名为 rocknix-builder 的 Docker 镜像
docker build -t rocknix-builder .
```

> **注意**：首次构建时会下载基础镜像并安装必要的开发依赖，耗时约几分钟，请保持网络通畅。

---

## 3. 进入交互式开发容器

构建完成后，建议编写一个简单的快捷启动命令或直接运行以下命令进入编译环境：

```bash
docker run --rm -it \
  --user $(id -u):$(id -g) \
  -v "$PWD":/work \
  -w /work \
  rocknix-builder \
  bash
```

* `--user $(id -u):$(id -g)`：确保在容器内编译生成的文件所有权属于当前宿主机用户，避免出现 root 权限无法修改的问题。
* `-v "$PWD":/work`：将当前工程目录挂载到容器内的 `/work`。
* `-w /work`：默认工作目录设置为工程根目录。

---

## 4. 验证基线编译环境

进入容器后，可以通过编译一个体量非常小的基础包，来验证交叉编译工具链与环境是否完全正常，而无需一开始就耗费数小时全编译：

```bash
# 验证 H700 目标环境下的基础工具编译（例如编译 dialog）
PROJECT=ROCKNIX DEVICE=H700 ARCH=aarch64 ./scripts/build dialog
```

* 如果这是该目标设备的第一次编译，系统会自动：
  1. 下载并构建 host 工具（如 host 端的 cmake、ninja 等）；
  2. 构建 aarch64 交叉编译器工具链；
  3. 编译目标架构的依赖库与指定包。
* 编译成功后，产物会保存在 `build.ROCKNIX-H700.aarch64/` 目录下。

如果该单包能够顺利生成，说明你的基础编译环境已经搭建完成！
