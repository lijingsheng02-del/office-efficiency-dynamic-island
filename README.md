# Dynamic Island for Windows

一个基于 Electron、React、TypeScript 和 Vite 的 Windows 桌面灵动岛应用。它提供桌面顶部悬浮胶囊、计划提醒、工具入口、个性化外观、本地数据备份，以及实验性的电脑桌面视频壁纸功能。

## 功能概览

- 桌面灵动岛：透明无边框窗口、置顶显示、可拖拽吸附到屏幕边缘。
- Dashboard：每日计划、下班倒计时、阅读、照片、计算器、密码保险箱、文件命名、临时剪贴板等入口。
- 每日计划：添加、完成、删除、拖拽排序，支持未完成任务跨天结转。
- 工作倒计时：按上下班和午休时间显示当前状态。
- TXT 阅读器：打开本地 TXT，保存阅读进度。
- 照片轮播：导入本地图片，支持取景位置调整。
- 个性化：主题、透明度、胶囊颜色、图片壁纸、贴纸散落。
- 电脑桌面视频壁纸：选择本地视频，尝试挂载到 Windows 桌面图标后方循环播放。
- 数据备份：导出/导入本机应用数据。

## 技术栈

- Electron 42
- React 19
- TypeScript
- Vite
- Framer Motion
- Koffi / Win32 API
- electron-builder

## 环境要求

- Windows 10/11
- Node.js 22 或更高版本
- npm

## 安装依赖

```powershell
npm install
```

## 开发运行

```powershell
npm run dev
```

开发命令会先编译 Electron 主进程，再启动 Vite 和 Electron 桌面窗口。

## 类型检查

```powershell
npm run typecheck
```

## 构建

```powershell
npm run build
```

## 打包 Windows 安装包

```powershell
npm run dist
```

产物输出到：

```text
release/
```

常见产物：

```text
Dynamic Island Setup x.x.x.exe
Dynamic Island Portable x.x.x.exe
```

## 用户数据位置

应用数据存放在 Electron 的 `userData` 目录，通常是：

```text
%APPDATA%\dynamic-island-electron
```

这里会保存每日计划、阅读进度、照片、主题贴纸、视频壁纸路径、备份数据等。卸载或重新安装应用时，不应直接删除这个目录，除非你明确要清空用户数据。

## 视频壁纸说明

视频壁纸功能通过 Electron 创建一个静音循环播放窗口，并使用 Win32 API 尝试挂载到 Windows 桌面图标后方。

注意事项：

- 支持本地视频文件，如 `mp4`、`webm`、`mov`、`m4v`、`avi`、`mkv`。
- 推荐使用 H.264 编码的 MP4，兼容性最好。
- Windows 10/11 的桌面窗口层级差异较大，部分系统可能无法挂载。
- 如果无法挂载到桌面图标后方，应用会取消启动视频壁纸，避免遮挡桌面快捷方式和文件。
- 多显示器和高 DPI 缩放环境下，视频窗口会做额外外扩以避免边缘露底。

## 目录结构

```text
electron/              Electron 主进程、预加载脚本和本地服务
electron/services/     数据存储、备份、视频壁纸等服务
src/                   React 渲染进程
src/components/        灵动岛 UI 和各功能模块
release/               打包产物，本仓库不提交
dist/                  前端构建产物，本仓库不提交
dist-electron/         Electron 编译产物，本仓库不提交
```

## 发布建议

1. 更新 `package.json` 版本号。
2. 运行 `npm run typecheck`。
3. 运行 `npm run dist`。
4. 将 `release/Dynamic Island Setup x.x.x.exe` 压缩后分发。

## 重要限制

- 这是 Windows 桌面应用，不支持 macOS/Linux。
- 桌面视频壁纸依赖 Windows Shell 窗口层级，不能保证所有电脑 100% 成功。
- 本仓库不提交安装包、构建产物、用户数据和 `node_modules`。
