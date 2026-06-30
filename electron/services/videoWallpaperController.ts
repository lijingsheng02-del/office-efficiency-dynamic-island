import { BrowserWindow, app, dialog, screen, type OpenDialogOptions } from 'electron';
import fs from 'node:fs';
import koffi from 'koffi';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type HWND = unknown;

export type VideoWallpaperState = {
  enabled: boolean;
  filePath: string;
  name: string;
  attachedToDesktop: boolean;
  lastError: string;
};

type PersistedState = {
  filePath?: unknown;
  name?: unknown;
};

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'];
const WM_SPAWN_WORKERW = 0x052c;
const SMTO_NORMAL = 0x0000;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const SM_XVIRTUALSCREEN = 76;
const SM_YVIRTUALSCREEN = 77;
const SM_CXVIRTUALSCREEN = 78;
const SM_CYVIRTUALSCREEN = 79;
const DESKTOP_WALLPAPER_OVERSCAN_PX = 160;

const user32 = process.platform === 'win32' ? koffi.load('user32.dll') : null;
const EnumWindowsProc =
  process.platform === 'win32' ? koffi.proto('bool __stdcall EnumWindowsProc(void * hwnd, long lParam)') : null;
const findWindowW = user32?.func('void * __stdcall FindWindowW(str16 className, str16 windowName)') as
  | ((className: string | null, windowName: string | null) => HWND | null)
  | undefined;
const findWindowExW = user32?.func('void * __stdcall FindWindowExW(void * parent, void * childAfter, str16 className, str16 windowName)') as
  | ((parent: HWND | null, childAfter: HWND | null, className: string | null, windowName: string | null) => HWND | null)
  | undefined;
const sendMessageTimeoutW = user32?.func(
  'long __stdcall SendMessageTimeoutW(void * hwnd, uint msg, uintptr_t wParam, intptr_t lParam, uint flags, uint timeout, void * result)',
) as ((hwnd: HWND, msg: number, wParam: number, lParam: number, flags: number, timeout: number, result: null) => number) | undefined;
const enumWindows =
  user32 && EnumWindowsProc
    ? (user32.func('bool __stdcall EnumWindows(EnumWindowsProc * proc, long lParam)') as ((
        proc: (hwnd: HWND, lParam: number) => boolean,
        lParam: number,
      ) => boolean))
    : undefined;
const setParent = user32?.func('void * __stdcall SetParent(void * child, void * parent)') as
  | ((child: HWND, parent: HWND) => HWND | null)
  | undefined;
const setWindowPos = user32?.func('bool __stdcall SetWindowPos(void * hwnd, void * insertAfter, int x, int y, int cx, int cy, uint flags)') as
  | ((hwnd: HWND, insertAfter: HWND | null, x: number, y: number, cx: number, cy: number, flags: number) => boolean)
  | undefined;
const getSystemMetrics = user32?.func('int __stdcall GetSystemMetrics(int index)') as ((index: number) => number) | undefined;

function getStatePath() {
  return path.join(app.getPath('userData'), 'video-wallpaper-state.json');
}

function normalizeFilePath(filePath: unknown) {
  return typeof filePath === 'string' && fs.existsSync(filePath) ? filePath : '';
}

function fileNameOf(filePath: string) {
  return filePath ? path.basename(filePath) : '';
}

function readPersistedState(): PersistedState {
  try {
    const statePath = getStatePath();
    if (!fs.existsSync(statePath)) return {};
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as PersistedState;
  } catch {
    return {};
  }
}

function writePersistedState(state: PersistedState) {
  fs.mkdirSync(path.dirname(getStatePath()), { recursive: true });
  fs.writeFileSync(getStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function hwndFromWindow(window: BrowserWindow) {
  return koffi.decode(window.getNativeWindowHandle(), 'void *') as HWND;
}

function findDesktopHost(): HWND | null {
  if (!findWindowW || !findWindowExW || !sendMessageTimeoutW || !enumWindows) return null;

  const progman = findWindowW('Progman', null);
  if (!progman) return null;

  try {
    sendMessageTimeoutW(progman, WM_SPAWN_WORKERW, 0x0d, 0, SMTO_NORMAL, 1000, null);
    sendMessageTimeoutW(progman, WM_SPAWN_WORKERW, 0, 0, SMTO_NORMAL, 1000, null);
  } catch {
    // The WorkerW message is best-effort. Some Windows shells already have one.
  }

  let workerw: HWND | null = null;
  enumWindows((topWindow) => {
    const shellView = findWindowExW(topWindow, null, 'SHELLDLL_DefView', null);
    if (!shellView) return true;
    workerw = findWindowExW(null, topWindow, 'WorkerW', null);
    return false;
  }, 0);

  if (workerw) return workerw;

  // Windows 11 can keep the desktop icon view under Progman without exposing
  // the blank WorkerW sibling used by older shells. Parenting to Progman is
  // still a desktop-host attach, unlike a normal bottom window fallback.
  return progman;
}

function getElectronVirtualBounds() {
  const displays = screen.getAllDisplays();
  const left = Math.min(...displays.map((display) => display.bounds.x));
  const top = Math.min(...displays.map((display) => display.bounds.y));
  const right = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const bottom = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function getNativeVirtualBounds() {
  if (process.platform !== 'win32' || !getSystemMetrics) {
    return getElectronVirtualBounds();
  }

  const width = getSystemMetrics(SM_CXVIRTUALSCREEN);
  const height = getSystemMetrics(SM_CYVIRTUALSCREEN);
  if (width <= 0 || height <= 0) return getElectronVirtualBounds();

  return {
    x: getSystemMetrics(SM_XVIRTUALSCREEN),
    y: getSystemMetrics(SM_YVIRTUALSCREEN),
    width,
    height,
  };
}

function buildVideoHtml(filePath: string) {
  const src = pathToFileURL(filePath).href;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #000;
    }
    video {
      width: 100vw;
      height: 100vh;
      object-fit: cover;
      background: #000;
      display: block;
    }
    .error {
      position: fixed;
      left: 24px;
      bottom: 24px;
      max-width: 720px;
      padding: 14px 18px;
      border-radius: 14px;
      color: rgba(255, 255, 255, 0.86);
      background: rgba(0, 0, 0, 0.72);
      font: 14px/1.5 "Microsoft YaHei", "Segoe UI", sans-serif;
      opacity: 0;
      transition: opacity 160ms ease;
    }
    body[data-error="true"] .error {
      opacity: 1;
    }
  </style>
</head>
<body>
  <video id="wallpaper-video" src="${src}" autoplay muted loop playsinline></video>
  <div class="error">视频壁纸无法播放。请换成 H.264 编码的 MP4，或重新选择视频。</div>
  <script>
    const video = document.getElementById('wallpaper-video');
    video.addEventListener('error', () => {
      document.body.dataset.error = 'true';
    });
    video.addEventListener('canplay', () => {
      document.body.dataset.error = 'false';
    });
    video.play().catch(() => {
      document.body.dataset.error = 'true';
    });
  </script>
</body>
</html>`;
}

function getVideoWallpaperHtmlPath() {
  return path.join(app.getPath('userData'), 'video-wallpaper.html');
}

export class VideoWallpaperController {
  private window: BrowserWindow | null = null;
  private filePath = '';
  private name = '';
  private attachedToDesktop = false;
  private lastError = '';

  constructor() {
    const persisted = readPersistedState();
    this.filePath = normalizeFilePath(persisted.filePath);
    this.name = typeof persisted.name === 'string' ? persisted.name : fileNameOf(this.filePath);
  }

  getState(): VideoWallpaperState {
    return {
      enabled: Boolean(this.window && !this.window.isDestroyed()),
      filePath: this.filePath,
      name: this.name,
      attachedToDesktop: this.attachedToDesktop,
      lastError: this.lastError,
    };
  }

  async selectVideo(owner: BrowserWindow | null): Promise<VideoWallpaperState> {
    const options: OpenDialogOptions = {
      title: '选择桌面视频壁纸',
      properties: ['openFile'],
      filters: [
        { name: 'Video', extensions: VIDEO_EXTENSIONS },
        { name: 'All files', extensions: ['*'] },
      ],
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) return this.getState();

    this.filePath = result.filePaths[0];
    this.name = fileNameOf(this.filePath);
    writePersistedState({ filePath: this.filePath, name: this.name });
    return this.getState();
  }

  async start(filePath = this.filePath): Promise<VideoWallpaperState> {
    this.lastError = '';
    const normalizedPath = normalizeFilePath(filePath);
    if (!normalizedPath) {
      this.lastError = '请先选择一个本地视频文件。';
      return this.getState();
    }

    this.filePath = normalizedPath;
    this.name = fileNameOf(normalizedPath);
    writePersistedState({ filePath: this.filePath, name: this.name });
    await this.stop(false);

    const electronBounds = getElectronVirtualBounds();
    const nativeBounds = getNativeVirtualBounds();
    this.window = new BrowserWindow({
      x: electronBounds.x - DESKTOP_WALLPAPER_OVERSCAN_PX,
      y: electronBounds.y - DESKTOP_WALLPAPER_OVERSCAN_PX,
      width: electronBounds.width + DESKTOP_WALLPAPER_OVERSCAN_PX * 2,
      height: electronBounds.height + DESKTOP_WALLPAPER_OVERSCAN_PX * 2,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      backgroundColor: '#000000',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.window.setIgnoreMouseEvents(true);
    this.window.on('closed', () => {
      this.window = null;
      this.attachedToDesktop = false;
    });
    const htmlPath = getVideoWallpaperHtmlPath();
    fs.writeFileSync(htmlPath, buildVideoHtml(normalizedPath), 'utf8');
    await this.window.loadFile(htmlPath);

    this.attachedToDesktop = false;
    if (process.platform === 'win32' && setParent && setWindowPos) {
      try {
        const host = findDesktopHost();
        if (host) {
          const hwnd = hwndFromWindow(this.window);
          setParent(hwnd, host);
          setWindowPos(
            hwnd,
            null,
            nativeBounds.x - DESKTOP_WALLPAPER_OVERSCAN_PX,
            nativeBounds.y - DESKTOP_WALLPAPER_OVERSCAN_PX,
            nativeBounds.width + DESKTOP_WALLPAPER_OVERSCAN_PX * 2,
            nativeBounds.height + DESKTOP_WALLPAPER_OVERSCAN_PX * 2,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW,
          );
          this.attachedToDesktop = true;
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!this.attachedToDesktop) {
      if (!this.lastError) this.lastError = '未能挂载到 Windows 桌面图标后方，已取消启动，避免遮挡桌面快捷方式。';
      await this.stop(false);
    } else {
      this.window.showInactive();
    }

    return this.getState();
  }

  async stop(clearError = true): Promise<VideoWallpaperState> {
    if (clearError) this.lastError = '';
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
    this.window = null;
    this.attachedToDesktop = false;
    return this.getState();
  }

  async toggle(): Promise<VideoWallpaperState> {
    return this.window && !this.window.isDestroyed() ? this.stop() : this.start();
  }
}
