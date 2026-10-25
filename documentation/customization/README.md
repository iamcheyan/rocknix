# ROCKNIX 掌机定制与二次开发指南 (RG35XX / H700 平台)

本指南针对 Anbernic RG35XX 系列（如 RG35XX Plus、RG35XX H、RG35XX SP、RG28XX 等基于全志 Allwinner H700 芯片的掌机），整理了 ROCKNIX 系统的底层架构、编译环境搭建、变更追踪方法以及本地/真机测试验证工作流。

---

## 目录导航

1. [01. 系统底层架构与核心认知](file:///home/tetsuya/development/rocknix/documentation/customization/01_architecture_and_concepts.md)
   * 掌机双分区运作模型（只读 SquashFS + 可写 Storage）
   * 图形显示（DRM/KMS + Wayland/Sway）与按键输入栈
   * 启动链（Boot Flow）与自启动服务（systemd）
   * ROCKNIX 软件包管理规范（`package.mk`）

2. [02. 基础编译环境搭建](file:///home/tetsuya/development/rocknix/documentation/customization/02_build_environment_setup.md)
   * 为什么推荐容器化构建（Docker）
   * 构建开发镜像与一键进入环境
   * 针对 H700 目标设备的基线编译测试

3. [03. 变更追踪与电脑端测试工作流](file:///home/tetsuya/development/rocknix/documentation/customization/03_development_and_testing_workflow.md)
   * 如何清晰追踪每一次代码改动（Git 规范与隔离规则）
   * 电脑端快速迭代验证（单包快速编译、产物检查）
   * 跨架构仿真与本地调试（QEMU 用户态测试）
   * 局域网快速推送到真机（免烧录、免插拔 SD 卡的极致效率）
   * 最终系统打包（SquashFS 与 .img.gz 固件生成）

4. [04. 电脑端直接操作与调试体验（原生窗口与虚拟机）](file:///home/tetsuya/development/rocknix/documentation/customization/04_gui_and_vm_simulation.md)
   * 原生窗口模拟调试（以 720×480 掌机比例即时预览与手柄/键盘交互）
   * GUI 窗口如何通过 Docker 投射到主机桌面
   * QEMU 启动完整 ROCKNIX 虚拟系统进行全流程验证

5. [05. XMPlayer 掌机按键失灵根因分析与原生手柄修复](file:///home/tetsuya/development/rocknix/documentation/customization/05_xmplayer_and_gamepad_fix.md)
   * 为什么在原版 ROCKNIX 里 XMPlayer 按键彻底瘫痪
   * 原生手柄驱动桥（Native Gamepad Bridge）补丁实现
   * RG34XX 实体按键与 XMB 功能映射表

6. [06. 编译系统底层原理解析与本次全套定制归总](file:///home/tetsuya/development/rocknix/documentation/customization/06_build_system_deep_dive_and_customization_summary.md)
   * 构建系统工作流剖析（Host 工具 -> 交叉工具链 -> 目标系统镜像）
   * 本地持久缓存机制（sources/ 源码包、.stamps/ 指纹时间戳）
   * 为什么后续编译速度会快几十倍（单包增量构建技巧）
   * 针对 RG34XX 专属开发版的 7 项核心定制改动总揽
