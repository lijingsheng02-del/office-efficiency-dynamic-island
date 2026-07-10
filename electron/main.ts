import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, shell } from 'electron';
import fs from 'node:fs';
import koffi from 'koffi';
import path from 'node:path';
import { BackupService } from './services/backupService';
import { DashboardOrderStore, type DashboardModuleKey } from './services/dashboardOrderStore';
import { DailyPlanStore } from './services/dailyPlanStore';
import { FileNamingStore, type FileNameTemplate } from './services/fileNamingStore';
import { PasswordVaultStore, type AccountRecord } from './services/passwordVaultStore';
import { PhotoStore } from './services/photoStore';
import { TempClipboardStore, type TempClipboardEntry, type TempClipboardMode, type TempClipboardShortcuts } from './services/tempClipboardStore';
import { ThemeStickerStore, type ThemeSticker, type ThemeStickerSlot } from './services/themeStickerStore';
import { VideoWallpaperController } from './services/videoWallpaperController';
import { WorkCountdownStore, type WorkCountdownSettings } from './services/workCountdownStore';

const islandSizes = {
  compact: { width: 276, height: 62 },
  reminder: { width: 340, height: 128 },
  dashboard: { width: 520, height: 360 },
  detail: { width: 560, height: 420 },
  calculator: { width: 390, height: 430 },
  dailyPlan: { width: 560, height: 440 },
  reader: { width: 620, height: 480 },
  vault: { width: 720, height: 560 },
};
const EDGE_MARGIN = 12;
const PLAN_REMINDER_INTERVAL_MS = 30 * 60 * 1000;
const PLAN_REMINDER_VISIBLE_MS = 60 * 1000;
const VK_LBUTTON = 0x01;
const VK_CONTROL = 0x11;
const VK_C = 0x43;
const VK_V = 0x56;
const VK_Z = 0x5a;
const KEYEVENTF_KEYUP = 0x0002;
const user32 = process.platform === 'win32' ? koffi.load('user32.dll') : null;
const getAsyncKeyState = user32?.func('short GetAsyncKeyState(int vKey)') as ((vKey: number) => number) | undefined;
const keybdEvent = user32?.func('void keybd_event(unsigned char bVk, unsigned char bScan, unsigned long dwFlags, unsigned long dwExtraInfo)') as
  | ((bVk: number, bScan: number, dwFlags: number, dwExtraInfo: number) => void)
  | undefined;

let mainWindow: BrowserWindow | null = null;
let tempClipboardWindow: BrowserWindow | null = null;
let alwaysOnTop = true;
let currentSizeKey: keyof typeof islandSizes = 'compact';
let currentSize = islandSizes.compact;
let dockPosition: DockPosition = 'top';
let dockOffsetRatio = 0.5;
let dailyPlanStore: DailyPlanStore | null = null;
let dashboardOrderStore: DashboardOrderStore | null = null;
let photoStore: PhotoStore | null = null;
let themeStickerStore: ThemeStickerStore | null = null;
let workCountdownStore: WorkCountdownStore | null = null;
let passwordVaultStore: PasswordVaultStore | null = null;
let fileNamingStore: FileNamingStore | null = null;
let tempClipboardStore: TempClipboardStore | null = null;
let videoWallpaperController: VideoWallpaperController | null = null;
let nativeDialogOpen = false;
let planReminderInterval: NodeJS.Timeout | null = null;
let planReminderTimeout: NodeJS.Timeout | null = null;
let planReminderVisible = false;
let tempClipboardPoller: NodeJS.Timeout | null = null;
let currentTempClipboardMode: TempClipboardMode = 'normal';
let lastClipboardSignature = '';
let outsideClickPoller: NodeJS.Timeout | null = null;
let outsideClickWasLeftDown = false;

type DockPosition = 'top' | 'right' | 'bottom' | 'left';

type ScreenPoint = {
  x: number;
  y: number;
};

type ReaderBookDiskState = {
  id: string;
  filePath: string;
  title: string;
  position: number;
  charsPerPage: number;
  fontSize: number;
  addedAt: string;
  updatedAt: string;
};

type ReaderDiskState = {
  currentBookId: string;
  books: ReaderBookDiskState[];
};

type ReaderStatePatch = {
  currentBookId?: string;
  filePath?: string;
  position?: number;
  charsPerPage?: number;
  fontSize?: number;
};

type ReaderChapter = {
  id: string;
  title: string;
  position: number;
};

type PlanReminderPayload = {
  id: string;
  text: string;
  date: string;
  order: number;
};

type ThemeMode = 'dark' | 'light';
type ThemePreset = 'default' | 'kitty';
type WallpaperPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

type AppSettings = {
  theme: ThemeMode;
  themePreset: ThemePreset;
  alwaysOnTop: boolean;
  islandOpacity: number;
  islandTint: string;
  stickerOpacity: number;
  wallpaperBlur: boolean;
  wallpaperPosition: WallpaperPosition;
  wallpaperFocusX: number;
  wallpaperFocusY: number;
  floatingWallpaperFocusX: number;
  floatingWallpaperFocusY: number;
  hasSeenWelcome: boolean;
};

const DEFAULT_READER_STATE: ReaderDiskState = {
  currentBookId: '',
  books: [],
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  themePreset: 'default',
  alwaysOnTop: true,
  islandOpacity: 100,
  islandTint: '#111318',
  stickerOpacity: 60,
  wallpaperBlur: false,
  wallpaperPosition: 'center',
  wallpaperFocusX: 50,
  wallpaperFocusY: 50,
  floatingWallpaperFocusX: 50,
  floatingWallpaperFocusY: 50,
  hasSeenWelcome: false,
};

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function getEffectiveSize(size = currentSize, dock = dockPosition) {
  if (size === islandSizes.compact && (dock === 'left' || dock === 'right')) {
    return { width: size.height, height: size.width };
  }

  return size;
}

function getDockStatePath() {
  return path.join(app.getPath('userData'), 'island-dock-state.json');
}

function normalizeDockPosition(value: unknown): DockPosition {
  return value === 'right' || value === 'bottom' || value === 'left' || value === 'top' ? value : 'top';
}

function clampRatio(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

function loadDockState() {
  try {
    if (!fs.existsSync(getDockStatePath())) return 'top';
    const parsed = JSON.parse(fs.readFileSync(getDockStatePath(), 'utf8')) as { dockPosition?: unknown; dockOffsetRatio?: unknown };
    dockOffsetRatio = clampRatio(parsed.dockOffsetRatio);
    return normalizeDockPosition(parsed.dockPosition);
  } catch {
    dockOffsetRatio = 0.5;
    return 'top';
  }
}

function saveDockState() {
  fs.mkdirSync(path.dirname(getDockStatePath()), { recursive: true });
  fs.writeFileSync(getDockStatePath(), `${JSON.stringify({ dockPosition, dockOffsetRatio }, null, 2)}\n`, 'utf8');
}

function getAppSettingsPath() {
  return path.join(app.getPath('userData'), 'app-settings.json');
}

function normalizeTheme(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

function normalizeThemePreset(value: unknown): ThemePreset {
  return value === 'kitty' ? 'kitty' : 'default';
}

function normalizeWallpaperPosition(value: unknown): WallpaperPosition {
  return value === 'top-left' ||
    value === 'top' ||
    value === 'top-right' ||
    value === 'left' ||
    value === 'center' ||
    value === 'right' ||
    value === 'bottom-left' ||
    value === 'bottom' ||
    value === 'bottom-right'
    ? value
    : DEFAULT_APP_SETTINGS.wallpaperPosition;
}

function normalizeOpacity(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_APP_SETTINGS.islandOpacity;
}

function normalizeStickerOpacity(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_APP_SETTINGS.stickerOpacity;
}

function normalizeFocusPercent(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
}

function normalizeTint(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : DEFAULT_APP_SETTINGS.islandTint;
}

function loadAppSettings(): AppSettings {
  if (!fs.existsSync(getAppSettingsPath())) return { ...DEFAULT_APP_SETTINGS };

  try {
    const parsed = JSON.parse(fs.readFileSync(getAppSettingsPath(), 'utf8')) as Partial<AppSettings>;
    return {
      theme: normalizeTheme(parsed.theme),
      themePreset: normalizeThemePreset(parsed.themePreset),
      alwaysOnTop: typeof parsed.alwaysOnTop === 'boolean' ? parsed.alwaysOnTop : DEFAULT_APP_SETTINGS.alwaysOnTop,
      islandOpacity: normalizeOpacity(parsed.islandOpacity),
      islandTint: normalizeTint(parsed.islandTint),
      stickerOpacity: normalizeStickerOpacity(parsed.stickerOpacity),
      wallpaperBlur: typeof parsed.wallpaperBlur === 'boolean' ? parsed.wallpaperBlur : DEFAULT_APP_SETTINGS.wallpaperBlur,
      wallpaperPosition: normalizeWallpaperPosition(parsed.wallpaperPosition),
      wallpaperFocusX: normalizeFocusPercent(parsed.wallpaperFocusX, DEFAULT_APP_SETTINGS.wallpaperFocusX),
      wallpaperFocusY: normalizeFocusPercent(parsed.wallpaperFocusY, DEFAULT_APP_SETTINGS.wallpaperFocusY),
      floatingWallpaperFocusX: normalizeFocusPercent(parsed.floatingWallpaperFocusX, DEFAULT_APP_SETTINGS.floatingWallpaperFocusX),
      floatingWallpaperFocusY: normalizeFocusPercent(parsed.floatingWallpaperFocusY, DEFAULT_APP_SETTINGS.floatingWallpaperFocusY),
      hasSeenWelcome: typeof parsed.hasSeenWelcome === 'boolean' ? parsed.hasSeenWelcome : DEFAULT_APP_SETTINGS.hasSeenWelcome,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function saveAppSettings(settings: AppSettings) {
  fs.mkdirSync(path.dirname(getAppSettingsPath()), { recursive: true });
  fs.writeFileSync(getAppSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function getBackupService() {
  return new BackupService(app.getPath('userData'), app.getVersion());
}

function getDockedBounds(size = currentSize, dock = dockPosition, display = screen.getPrimaryDisplay()) {
  const effectiveSize = getEffectiveSize(size, dock);
  const { x, y, width, height } = display.workArea;
  const horizontalTravel = Math.max(0, width - effectiveSize.width - EDGE_MARGIN * 2);
  const verticalTravel = Math.max(0, height - effectiveSize.height - EDGE_MARGIN * 2);
  const dockX = Math.round(x + EDGE_MARGIN + horizontalTravel * dockOffsetRatio);
  const dockY = Math.round(y + EDGE_MARGIN + verticalTravel * dockOffsetRatio);

  if (dock === 'bottom') {
    return {
      width: effectiveSize.width,
      height: effectiveSize.height,
      x: dockX,
      y: Math.round(y + height - effectiveSize.height - EDGE_MARGIN),
    };
  }

  if (dock === 'left') {
    return {
      width: effectiveSize.width,
      height: effectiveSize.height,
      x: Math.round(x + EDGE_MARGIN),
      y: dockY,
    };
  }

  if (dock === 'right') {
    return {
      width: effectiveSize.width,
      height: effectiveSize.height,
      x: Math.round(x + width - effectiveSize.width - EDGE_MARGIN),
      y: dockY,
    };
  }

  return {
    width: effectiveSize.width,
    height: effectiveSize.height,
    x: dockX,
    y: Math.round(y + EDGE_MARGIN),
  };
}

function getNearestDockPosition(point: ScreenPoint) {
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;
  const distances: Record<DockPosition, number> = {
    top: Math.abs(point.y - y),
    right: Math.abs(point.x - (x + width)),
    bottom: Math.abs(point.y - (y + height)),
    left: Math.abs(point.x - x),
  };

  return (Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] ?? 'top') as DockPosition;
}

function applyWindowSize(sizeKey: keyof typeof islandSizes) {
  if (!mainWindow) return;

  currentSizeKey = sizeKey;
  const size = islandSizes[sizeKey];
  currentSize = size;
  const acceptsKeyboardInput = sizeKey !== 'compact' && sizeKey !== 'reminder';
  mainWindow.setIgnoreMouseEvents(false);
  mainWindow.setFocusable(acceptsKeyboardInput);
  mainWindow.setBounds(getDockedBounds(size), true);

  if (acceptsKeyboardInput) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function isLeftMouseDown() {
  return Boolean(getAsyncKeyState && (getAsyncKeyState(VK_LBUTTON) & 0x8000));
}

function isPointInsideBounds(point: Electron.Point, bounds: Electron.Rectangle) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function forceCollapseIsland() {
  if (!mainWindow || currentSizeKey === 'compact' || currentSizeKey === 'reminder') return;
  mainWindow.webContents.send('force-collapse-island');
}

function startOutsideClickWatcher() {
  if (outsideClickPoller || !getAsyncKeyState) return;

  outsideClickPoller = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || currentSizeKey === 'compact' || currentSizeKey === 'reminder') {
      outsideClickWasLeftDown = isLeftMouseDown();
      return;
    }

    const leftDown = isLeftMouseDown();
    const leftPressedNow = leftDown && !outsideClickWasLeftDown;
    outsideClickWasLeftDown = leftDown;
    if (!leftPressedNow) return;

    const cursorPoint = screen.getCursorScreenPoint();
    if (!isPointInsideBounds(cursorPoint, mainWindow.getBounds())) {
      forceCollapseIsland();
    }
  }, 120);
}

function moveWindowNearPoint(point: ScreenPoint) {
  if (!mainWindow) return;
  const effectiveSize = getEffectiveSize(currentSize);
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;

  mainWindow.setBounds(
    {
      width: effectiveSize.width,
      height: effectiveSize.height,
      x: Math.round(Math.min(x + width - effectiveSize.width, Math.max(x, point.x - effectiveSize.width / 2))),
      y: Math.round(Math.min(y + height - effectiveSize.height, Math.max(y, point.y - effectiveSize.height / 2))),
    },
    false,
  );
}

function snapWindowToNearestDock(point: ScreenPoint) {
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.workArea;
  const nextDock = getNearestDockPosition(point);
  const effectiveSize = getEffectiveSize(currentSize, nextDock);
  dockPosition = nextDock;

  if (nextDock === 'top' || nextDock === 'bottom') {
    const travel = Math.max(1, width - effectiveSize.width - EDGE_MARGIN * 2);
    dockOffsetRatio = clampRatio((point.x - x - EDGE_MARGIN - effectiveSize.width / 2) / travel);
  } else {
    const travel = Math.max(1, height - effectiveSize.height - EDGE_MARGIN * 2);
    dockOffsetRatio = clampRatio((point.y - y - EDGE_MARGIN - effectiveSize.height / 2) / travel);
  }

  saveDockState();
  applyWindowSize(currentSizeKey);
  mainWindow?.webContents.send('dock-position-changed', dockPosition);
  return dockPosition;
}

function getDailyPlanStore() {
  dailyPlanStore ??= new DailyPlanStore(app.getPath('userData'));
  return dailyPlanStore;
}

function getDashboardOrderStore() {
  dashboardOrderStore ??= new DashboardOrderStore(app.getPath('userData'));
  return dashboardOrderStore;
}

function clearPlanReminderTimeout() {
  if (planReminderTimeout) {
    clearTimeout(planReminderTimeout);
    planReminderTimeout = null;
  }
}

function hidePlanReminder() {
  if (!planReminderVisible) return;

  planReminderVisible = false;
  clearPlanReminderTimeout();
  mainWindow?.webContents.send('daily-plan-reminder-hide');

  if (mainWindow && currentSizeKey === 'reminder') {
    applyWindowSize('compact');
  }
}

function showPlanReminder() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const firstPending = getDailyPlanStore().getFirstPendingItem();
  if (!firstPending) {
    hidePlanReminder();
    return;
  }

  const payload: PlanReminderPayload = {
    id: firstPending.id,
    text: firstPending.text,
    date: getDailyPlanStore().getTodayPlan().date,
    order: firstPending.order,
  };

  planReminderVisible = true;
  clearPlanReminderTimeout();
  applyWindowSize('reminder');
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('daily-plan-reminder-show', payload);
  planReminderTimeout = setTimeout(hidePlanReminder, PLAN_REMINDER_VISIBLE_MS);
}

function startPlanReminderScheduler() {
  if (planReminderInterval) return;
  planReminderInterval = setInterval(showPlanReminder, PLAN_REMINDER_INTERVAL_MS);
}

function getPhotoStore() {
  photoStore ??= new PhotoStore(app.getPath('userData'));
  return photoStore;
}

function getThemeStickerStore() {
  themeStickerStore ??= new ThemeStickerStore(app.getPath('userData'));
  return themeStickerStore;
}

function getVideoWallpaperController() {
  if (!videoWallpaperController) {
    videoWallpaperController = new VideoWallpaperController();
  }
  return videoWallpaperController;
}

function broadcastThemeStickersChanged(theme: Record<ThemeStickerSlot, ThemeSticker | null>) {
  mainWindow?.webContents.send('theme-stickers:changed', theme);
  tempClipboardWindow?.webContents.send('theme-stickers:changed', theme);
}

function getWorkCountdownStore() {
  workCountdownStore ??= new WorkCountdownStore(app.getPath('userData'));
  return workCountdownStore;
}

function getPasswordVaultStore() {
  passwordVaultStore ??= new PasswordVaultStore(app.getPath('userData'));
  return passwordVaultStore;
}

function getFileNamingStore() {
  fileNamingStore ??= new FileNamingStore(app.getPath('userData'));
  return fileNamingStore;
}

function getTempClipboardStore() {
  tempClipboardStore ??= new TempClipboardStore(app.getPath('userData'));
  return tempClipboardStore;
}

function emitTempClipboardState() {
  mainWindow?.webContents.send('temp-clipboard-state-changed', getTempClipboardStore().getState());
  tempClipboardWindow?.webContents.send('temp-clipboard-state-changed', getTempClipboardStore().getState());
}

function getClipboardSnapshot(): Pick<TempClipboardEntry, 'type' | 'preview' | 'text' | 'imageDataUrl'> | null {
  const text = clipboard.readText();
  if (text.trim()) {
    return {
      type: 'text',
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 140),
      text,
    };
  }

  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    const size = image.getSize();
    return {
      type: 'image',
      preview: `鍥剧墖 ${size.width}x${size.height}`,
      imageDataUrl: image.toDataURL(),
    };
  }

  return null;
}

function getClipboardSignature(snapshot: Pick<TempClipboardEntry, 'type' | 'text' | 'imageDataUrl'> | null) {
  if (!snapshot) return '';
  return `${snapshot.type}:${snapshot.type === 'text' ? snapshot.text : snapshot.imageDataUrl}`;
}

function pollClipboardForCapture() {
  if (currentTempClipboardMode !== 'capture') return;

  const state = getTempClipboardStore().getState();
  if (state.mode !== 'capture') {
    currentTempClipboardMode = state.mode;
    return;
  }

  const snapshot = getClipboardSnapshot();
  const signature = getClipboardSignature(snapshot);
  if (!snapshot || !signature || signature === lastClipboardSignature) return;

  lastClipboardSignature = signature;
  getTempClipboardStore().addEntry(snapshot);
  emitTempClipboardState();
}

function startTempClipboardPoller() {
  if (tempClipboardPoller) return;
  tempClipboardPoller = setInterval(pollClipboardForCapture, 450);
}

function setClipboardFromEntry(entry: TempClipboardEntry) {
  if (entry.type === 'text' && entry.text) {
    clipboard.writeText(entry.text);
    return true;
  }

  if (entry.type === 'image' && entry.imageDataUrl) {
    clipboard.writeImage(nativeImage.createFromDataURL(entry.imageDataUrl));
    return true;
  }

  return false;
}

function sendCtrlV() {
  if (process.platform !== 'win32') return;
  sendKeyChord(VK_V);
}

function sendCtrlC() {
  if (process.platform !== 'win32') return;
  sendKeyChord(VK_C);
}

function sendCtrlZ() {
  if (process.platform !== 'win32') return;
  sendKeyChord(VK_Z);
}

function sendKeyChord(key: number) {
  if (!keybdEvent) return;

  keybdEvent(VK_CONTROL, 0, 0, 0);
  keybdEvent(key, 0, 0, 0);
  keybdEvent(key, 0, KEYEVENTF_KEYUP, 0);
  keybdEvent(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);
}

function captureCurrentSelection() {
  const state = getTempClipboardStore().getState();
  if (state.mode !== 'capture') return state;

  lastClipboardSignature = getClipboardSignature(getClipboardSnapshot());
  sendCtrlC();
  setTimeout(() => {
    const snapshot = getClipboardSnapshot();
    const signature = getClipboardSignature(snapshot);
    if (!snapshot || !signature || signature === lastClipboardSignature) return;
    lastClipboardSignature = signature;
    getTempClipboardStore().addEntry(snapshot);
    emitTempClipboardState();
  }, 220);
  return state;
}

function pasteTempClipboardEntry(entry: TempClipboardEntry, triggerPaste = true) {
  if (!setClipboardFromEntry(entry)) return getTempClipboardStore().getState();

  if (triggerPaste) {
    const shouldRestoreMainWindow = Boolean(mainWindow?.isFocused());
    const shouldRestoreTempClipboardWindow = Boolean(tempClipboardWindow?.isVisible());

    if (shouldRestoreMainWindow) {
      mainWindow?.hide();
    }

    if (shouldRestoreTempClipboardWindow) {
      tempClipboardWindow?.hide();
    }

    setTimeout(sendCtrlV, 120);

    if (shouldRestoreMainWindow) {
      setTimeout(() => mainWindow?.showInactive(), 360);
    }

    if (shouldRestoreTempClipboardWindow) {
      setTimeout(() => updateTempClipboardWindowVisibility(), 380);
    }

    setTimeout(() => {
      getTempClipboardStore().markPasted(entry);
      emitTempClipboardState();
    }, 520);

    return getTempClipboardStore().getState();
  }

  const nextState = getTempClipboardStore().deleteEntry(entry.id);
  emitTempClipboardState();
  return nextState;
}

function undoLastTempClipboardPaste() {
  const state = getTempClipboardStore().getState();
  if (state.pastedHistory.length === 0) return state;

  const shouldRestoreMainWindow = Boolean(mainWindow?.isFocused());
  const shouldRestoreTempClipboardWindow = Boolean(tempClipboardWindow?.isVisible());

  if (shouldRestoreMainWindow) {
    mainWindow?.hide();
  }

  if (shouldRestoreTempClipboardWindow) {
    tempClipboardWindow?.hide();
  }

  setTimeout(sendCtrlZ, 80);

  if (shouldRestoreMainWindow) {
    setTimeout(() => mainWindow?.showInactive(), 320);
  }

  if (shouldRestoreTempClipboardWindow) {
    setTimeout(() => updateTempClipboardWindowVisibility(), 340);
  }

  setTimeout(() => {
    getTempClipboardStore().restoreLastPastedEntry();
    emitTempClipboardState();
  }, 380);

  return state;
}

function pasteNextTempClipboardEntry(triggerPaste = true) {
  const state = getTempClipboardStore().getState();
  if (!state.entries.length) return state;

  const index = Math.min(state.pasteIndex, state.entries.length - 1);
  const entry = state.entries[index];
  pasteTempClipboardEntry(entry, triggerPaste);
  const nextState = getTempClipboardStore().setPasteIndex((index + 1) % state.entries.length);
  emitTempClipboardState();
  return nextState;
}

function setTempClipboardMode(mode: TempClipboardMode) {
  const state = getTempClipboardStore().setMode(mode);
  currentTempClipboardMode = state.mode;
  lastClipboardSignature = getClipboardSignature(getClipboardSnapshot());
  updateTempClipboardWindowVisibility(state.mode);
  emitTempClipboardState();
  return state;
}

function registerTempClipboardShortcuts() {
  globalShortcut.unregisterAll();
  const state = getTempClipboardStore().getState();
  const bindings: Array<[string, () => void]> = [
    [state.shortcuts.captureMode, () => setTempClipboardMode('capture')],
    [
      state.shortcuts.captureCopy,
      () => {
        const current = getTempClipboardStore().getState();
        if (current.mode !== 'capture') return;
        captureCurrentSelection();
      },
    ],
    [state.shortcuts.normalMode, () => setTempClipboardMode('normal')],
    [state.shortcuts.pasteMode, () => setTempClipboardMode('paste')],
  ];

  for (const [accelerator, callback] of bindings) {
    try {
      globalShortcut.register(accelerator, callback);
    } catch {
      // Invalid accelerators are ignored so the user can correct them from the UI.
    }
  }
}

function getShortcutTargetPath() {
  const portableExecutable = process.env.PORTABLE_EXECUTABLE_FILE;
  if (portableExecutable && fs.existsSync(portableExecutable)) {
    return portableExecutable;
  }

  return process.execPath;
}

function ensureDesktopShortcut() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  const target = getShortcutTargetPath();
  if (!target || !fs.existsSync(target)) return;

  const shortcutPath = path.join(app.getPath('desktop'), 'Dynamic Island.lnk');
  if (fs.existsSync(shortcutPath)) return;

  shell.writeShortcutLink(shortcutPath, 'create', {
    target,
    cwd: path.dirname(target),
    description: 'Dynamic Island desktop floating widget',
    icon: target,
    iconIndex: 0,
    appUserModelId: 'com.codex.dynamicisland',
  });
}

function getReaderStatePath() {
  return path.join(app.getPath('userData'), 'reader-state.json');
}

function getLegacyReaderStatePath() {
  return 'C:\\works\\taskbar-novel-reader\\reader-state.json';
}

function clampReaderCharsPerPage(value: unknown) {
  const numeric = Number(value);
  return Math.max(120, Math.min(600, Number.isFinite(numeric) ? numeric : 120));
}

function clampReaderFontSize(value: unknown) {
  const numeric = Number(value);
  return Math.max(12, Math.min(20, Number.isFinite(numeric) ? numeric : 14));
}

function normalizeBookId(filePath: string) {
  return path.normalize(filePath);
}

function getBookTitle(filePath: string) {
  return path.basename(filePath, path.extname(filePath));
}

function normalizeReaderBook(
  value: Partial<ReaderBookDiskState> & { FilePath?: string; Position?: number; CharsPerPage?: number; FontSize?: number },
  now: string,
) {
  const filePath = typeof value.filePath === 'string' ? value.filePath : typeof value.FilePath === 'string' ? value.FilePath : '';
  if (!filePath) return null;
  const id = typeof value.id === 'string' && value.id ? value.id : normalizeBookId(filePath);

  return {
    id,
    filePath,
    title: typeof value.title === 'string' && value.title ? value.title : getBookTitle(filePath),
    position: Math.max(0, Number.isFinite(value.position ?? value.Position) ? Number(value.position ?? value.Position) : 0),
    charsPerPage: clampReaderCharsPerPage(value.charsPerPage ?? value.CharsPerPage),
    fontSize: clampReaderFontSize(value.fontSize ?? value.FontSize),
    addedAt: typeof value.addedAt === 'string' && value.addedAt ? value.addedAt : now,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt ? value.updatedAt : now,
  };
}

function normalizeReaderState(
  value:
    | (Partial<ReaderDiskState> &
        Partial<ReaderStatePatch> & {
          FilePath?: string;
          Position?: number;
          CharsPerPage?: number;
          FontSize?: number;
        })
    | null
    | undefined,
): ReaderDiskState {
  const now = new Date().toISOString();
  const books: ReaderBookDiskState[] = [];
  const seen = new Set<string>();

  const addBook = (book: ReaderBookDiskState | null) => {
    if (!book) return;
    const dedupeKey = book.id.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    books.push(book);
  };

  if (Array.isArray(value?.books)) {
    value.books.forEach((book) => addBook(normalizeReaderBook(book, now)));
  } else {
    addBook(
      normalizeReaderBook(
        {
          filePath: value?.filePath ?? value?.FilePath,
          position: value?.position ?? value?.Position,
          charsPerPage: value?.charsPerPage ?? value?.CharsPerPage,
          fontSize: value?.fontSize ?? value?.FontSize,
        },
        now,
      ),
    );
  }

  const requestedCurrentBookId =
    typeof value?.currentBookId === 'string' && value.currentBookId
      ? value.currentBookId
      : typeof value?.filePath === 'string'
        ? normalizeBookId(value.filePath)
        : '';
  const currentBookId = books.some((book) => book.id === requestedCurrentBookId) ? requestedCurrentBookId : books[0]?.id ?? '';

  return {
    currentBookId,
    books,
  };
}

function readJsonState(filePath: string): ReaderDiskState | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<ReaderDiskState> &
      Partial<ReaderStatePatch> & {
      FilePath?: string;
      Position?: number;
      CharsPerPage?: number;
      FontSize?: number;
    };

    return normalizeReaderState(parsed);
  } catch {
    return null;
  }
}

function loadReaderDiskState() {
  return readJsonState(getReaderStatePath()) ?? readJsonState(getLegacyReaderStatePath()) ?? DEFAULT_READER_STATE;
}

function saveReaderDiskState(state: ReaderDiskState) {
  const normalized = normalizeReaderState(state);
  fs.mkdirSync(path.dirname(getReaderStatePath()), { recursive: true });
  fs.writeFileSync(getReaderStatePath(), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function decodeTextFile(filePath: string) {
  const bytes = fs.readFileSync(filePath);

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('gb18030').decode(bytes);
  }
}

function normalizeBookText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isLikelyChapterTitle(line: string) {
  const title = line.trim().replace(/\s+/g, ' ');
  if (!title || title.length > 64) return false;

  return (
    /^第\s*[0-9０-９一二三四五六七八九十百千万零〇两]+\s*[章节回卷集部篇].{0,40}$/.test(title) ||
    /^(序章|楔子|引子|前言|尾声|后记)(\s|$|[:：-]).{0,40}$/.test(title) ||
    /^番外.{0,40}$/.test(title) ||
    /^chapter\s+[0-9ivxlcdm]+.{0,40}$/i.test(title)
  );
}

function extractReaderChapters(text: string): ReaderChapter[] {
  const chapters: ReaderChapter[] = [];
  let position = 0;

  for (const line of text.split('\n')) {
    const title = line.trim().replace(/\s+/g, ' ');
    if (isLikelyChapterTitle(title)) {
      chapters.push({
        id: String(position),
        title,
        position,
      });
    }
    position += line.length + 1;
  }

  return chapters;
}

function getReaderPayload(state = loadReaderDiskState()) {
  const normalized = normalizeReaderState(state);
  const currentBook = normalized.books.find((book) => book.id === normalized.currentBookId) ?? null;
  const books = normalized.books.map((book) => ({
    ...book,
    exists: fs.existsSync(book.filePath),
  }));

  if (!currentBook) {
    return {
      currentBookId: '',
      books,
      filePath: '',
      title: '',
      text: '',
      chapters: [],
      position: 0,
      charsPerPage: 120,
      fontSize: 14,
    };
  }

  if (!fs.existsSync(currentBook.filePath)) {
    return {
      currentBookId: currentBook.id,
      books,
      filePath: currentBook.filePath,
      title: currentBook.title,
      text: '',
      chapters: [],
      position: currentBook.position,
      charsPerPage: currentBook.charsPerPage,
      fontSize: currentBook.fontSize,
    };
  }

  const text = normalizeBookText(decodeTextFile(currentBook.filePath));
  const chapters = extractReaderChapters(text);
  const position = Math.min(currentBook.position, Math.max(0, text.length - 1));

  return {
    currentBookId: currentBook.id,
    books: books.map((book) =>
      book.id === currentBook.id ? { ...book, position, charsPerPage: currentBook.charsPerPage, fontSize: currentBook.fontSize } : book,
    ),
    filePath: currentBook.filePath,
    position,
    title: currentBook.title,
    charsPerPage: currentBook.charsPerPage,
    fontSize: currentBook.fontSize,
    text,
    chapters,
  };
}

function createContextMenu() {
  return Menu.buildFromTemplate([
    {
      label: mainWindow?.isVisible() ? '\u9690\u85cf' : '\u663e\u793a',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '\u7a97\u53e3\u7f6e\u9876',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (menuItem) => {
        alwaysOnTop = menuItem.checked;
        mainWindow?.setAlwaysOnTop(alwaysOnTop, 'screen-saver');
        mainWindow?.webContents.send('always-on-top-changed', alwaysOnTop);
      },
    },
    {
      label: '\u6d4b\u8bd5\u8ba1\u5212\u63d0\u9192',
      click: () => showPlanReminder(),
    },
    { type: 'separator' },
    {
      label: '\u9000\u51fa',
      click: () => app.quit(),
    },
  ]);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    ...getDockedBounds(islandSizes.compact),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setBackgroundColor('#00000000');
  // The island is mostly static between state changes. A 30 FPS compositor
  // cap avoids spending a full display refresh on a small transparent window.
  mainWindow.webContents.setFrameRate(30);
  mainWindow.setAlwaysOnTop(alwaysOnTop, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.webContents.on('context-menu', () => {
    createContextMenu().popup({ window: mainWindow ?? undefined });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.setBackgroundColor('#00000000');
    mainWindow?.showInactive();
  });

  mainWindow.on('blur', () => {
    if (!nativeDialogOpen) {
      hidePlanReminder();
      mainWindow?.webContents.send('island-window-blur');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';

  if (!app.isPackaged) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

async function createTempClipboardWindow() {
  if (tempClipboardWindow && !tempClipboardWindow.isDestroyed()) return tempClipboardWindow;

  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.workArea;
  tempClipboardWindow = new BrowserWindow({
    width: 360,
    height: 520,
    x: Math.round(x + width - 390),
    y: Math.round(y + Math.max(24, height * 0.18)),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  tempClipboardWindow.setBackgroundColor('#00000000');
  tempClipboardWindow.webContents.setFrameRate(30);
  tempClipboardWindow.setAlwaysOnTop(true, 'screen-saver');
  tempClipboardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  tempClipboardWindow.on('closed', () => {
    tempClipboardWindow = null;
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
  if (!app.isPackaged) {
    await tempClipboardWindow.loadURL(`${devServerUrl}#temp-clipboard-window`);
  } else {
    await tempClipboardWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'temp-clipboard-window' });
  }

  return tempClipboardWindow;
}

function updateTempClipboardWindowVisibility(mode = getTempClipboardStore().getState().mode) {
  currentTempClipboardMode = mode;

  if (mode === 'normal') {
    tempClipboardWindow?.hide();
    return;
  }

  void createTempClipboardWindow().then((window) => {
    if (window.isDestroyed()) return;
    window.showInactive();
    emitTempClipboardState();
  });
}

app.whenReady().then(async () => {
  const appSettings = loadAppSettings();
  alwaysOnTop = appSettings.alwaysOnTop;
  dockPosition = loadDockState();
  ensureDesktopShortcut();
  await createWindow();
  startPlanReminderScheduler();
  startTempClipboardPoller();
  startOutsideClickWatcher();
  registerTempClipboardShortcuts();
  updateTempClipboardWindowVisibility();
  if (process.env.DYNAMIC_ISLAND_TEST_REMINDER === '1' || process.argv.includes('--test-plan-reminder')) {
    setTimeout(showPlanReminder, 6000);
  }

  app.on('second-instance', () => {
    if (!mainWindow) return;
    applyWindowSize(currentSizeKey);
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  });

  screen.on('display-metrics-changed', () => applyWindowSize(currentSizeKey));
  screen.on('display-added', () => applyWindowSize(currentSizeKey));
  screen.on('display-removed', () => applyWindowSize(currentSizeKey));

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void videoWallpaperController?.stop();
  globalShortcut.unregisterAll();
});

ipcMain.handle('resize-island', (_event, state: keyof typeof islandSizes) => {
  applyWindowSize(state in islandSizes ? state : 'dashboard');
  return currentSize;
});

ipcMain.handle('focus-island', () => {
  mainWindow?.setFocusable(true);
  mainWindow?.show();
  mainWindow?.focus();
});

ipcMain.handle('get-dock-position', () => {
  return dockPosition;
});

ipcMain.handle('drag-island', (_event, point: ScreenPoint) => {
  moveWindowNearPoint(point);
  return dockPosition;
});

ipcMain.handle('snap-island', (_event, point: ScreenPoint) => {
  return snapWindowToNearestDock(point);
});

ipcMain.handle('set-always-on-top', (_event, enabled: boolean) => {
  alwaysOnTop = Boolean(enabled);
  saveAppSettings({ ...loadAppSettings(), alwaysOnTop });
  mainWindow?.setAlwaysOnTop(alwaysOnTop, 'screen-saver');
  return alwaysOnTop;
});

ipcMain.handle('get-app-settings', () => {
  return { ...loadAppSettings(), alwaysOnTop };
});

ipcMain.handle('set-theme', (_event, theme: ThemeMode) => {
  const nextTheme = normalizeTheme(theme);
  saveAppSettings({ ...loadAppSettings(), theme: nextTheme });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextTheme;
});

ipcMain.handle('set-theme-preset', (_event, preset: ThemePreset) => {
  const nextPreset = normalizeThemePreset(preset);
  saveAppSettings({ ...loadAppSettings(), themePreset: nextPreset });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextPreset;
});

ipcMain.handle('set-island-opacity', (_event, opacity: number) => {
  const nextOpacity = normalizeOpacity(opacity);
  saveAppSettings({ ...loadAppSettings(), islandOpacity: nextOpacity });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextOpacity;
});

ipcMain.handle('set-island-tint', (_event, tint: string) => {
  const nextTint = normalizeTint(tint);
  saveAppSettings({ ...loadAppSettings(), islandTint: nextTint });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextTint;
});

ipcMain.handle('set-sticker-opacity', (_event, opacity: number) => {
  const nextOpacity = normalizeStickerOpacity(opacity);
  saveAppSettings({ ...loadAppSettings(), stickerOpacity: nextOpacity });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextOpacity;
});

ipcMain.handle('set-wallpaper-blur', (_event, enabled: boolean) => {
  const nextEnabled = Boolean(enabled);
  saveAppSettings({ ...loadAppSettings(), wallpaperBlur: nextEnabled });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextEnabled;
});

ipcMain.handle('set-wallpaper-position', (_event, position: WallpaperPosition) => {
  const nextPosition = normalizeWallpaperPosition(position);
  saveAppSettings({ ...loadAppSettings(), wallpaperPosition: nextPosition });
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return nextPosition;
});

ipcMain.handle('set-wallpaper-focus', (_event, focus: { x?: number; y?: number }) => {
  const current = loadAppSettings();
  const nextSettings = {
    ...current,
    wallpaperFocusX: normalizeFocusPercent(focus?.x, current.wallpaperFocusX),
    wallpaperFocusY: normalizeFocusPercent(focus?.y, current.wallpaperFocusY),
  };
  saveAppSettings(nextSettings);
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return { x: nextSettings.wallpaperFocusX, y: nextSettings.wallpaperFocusY };
});

ipcMain.handle('set-floating-wallpaper-focus', (_event, focus: { x?: number; y?: number }) => {
  const current = loadAppSettings();
  const nextSettings = {
    ...current,
    floatingWallpaperFocusX: normalizeFocusPercent(focus?.x, current.floatingWallpaperFocusX),
    floatingWallpaperFocusY: normalizeFocusPercent(focus?.y, current.floatingWallpaperFocusY),
  };
  saveAppSettings(nextSettings);
  mainWindow?.webContents.send('app-settings-changed', loadAppSettings());
  tempClipboardWindow?.webContents.send('app-settings-changed', loadAppSettings());
  return { x: nextSettings.floatingWallpaperFocusX, y: nextSettings.floatingWallpaperFocusY };
});

ipcMain.handle('video-wallpaper:get-state', () => {
  return getVideoWallpaperController().getState();
});

ipcMain.handle('video-wallpaper:select', async () => {
  if (!mainWindow) return getVideoWallpaperController().getState();

  nativeDialogOpen = true;
  try {
    return await getVideoWallpaperController().selectVideo(mainWindow);
  } finally {
    nativeDialogOpen = false;
  }
});

ipcMain.handle('video-wallpaper:start', () => {
  return getVideoWallpaperController().start();
});

ipcMain.handle('video-wallpaper:stop', () => {
  return getVideoWallpaperController().stop();
});

ipcMain.handle('video-wallpaper:toggle', () => {
  return getVideoWallpaperController().toggle();
});

ipcMain.handle('mark-welcome-seen', () => {
  const settings = { ...loadAppSettings(), hasSeenWelcome: true };
  saveAppSettings(settings);
  mainWindow?.webContents.send('app-settings-changed', settings);
  tempClipboardWindow?.webContents.send('app-settings-changed', settings);
  return true;
});

ipcMain.handle('backup:export', async () => {
  if (!mainWindow) return { ok: false, canceled: true };

  nativeDialogOpen = true;
  let result;
  try {
    result = await dialog.showSaveDialog(mainWindow, {
      title: '导出灵动岛数据',
      defaultPath: `Dynamic-Island-Backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [
        { name: 'Dynamic Island Backup', extensions: ['json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
  } finally {
    nativeDialogOpen = false;
  }

  if (result.canceled || !result.filePath) return { ok: false, canceled: true };

  try {
    getBackupService().exportToFile(result.filePath);
    return { ok: true, canceled: false, filePath: result.filePath };
  } catch {
    return { ok: false, canceled: false };
  }
});

ipcMain.handle('backup:import', async () => {
  if (!mainWindow) return { ok: false, canceled: true };

  nativeDialogOpen = true;
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      title: '导入灵动岛数据',
      properties: ['openFile'],
      filters: [
        { name: 'Dynamic Island Backup', extensions: ['json'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
  } finally {
    nativeDialogOpen = false;
  }

  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };

  try {
    getBackupService().importFromFile(result.filePaths[0]);
    const settings = loadAppSettings();
    alwaysOnTop = settings.alwaysOnTop;
    dockPosition = loadDockState();
    dailyPlanStore = null;
    dashboardOrderStore = null;
    photoStore = null;
    workCountdownStore = null;
    passwordVaultStore = null;
    fileNamingStore = null;
    tempClipboardStore = null;
    registerTempClipboardShortcuts();
    mainWindow.setAlwaysOnTop(alwaysOnTop, 'screen-saver');
    applyWindowSize(currentSizeKey);
    mainWindow.webContents.send('always-on-top-changed', alwaysOnTop);
    mainWindow.webContents.send('dock-position-changed', dockPosition);
    return { ok: true, canceled: false };
  } catch {
    return { ok: false, canceled: false };
  }
});

ipcMain.handle('backup:open-data-dir', async () => {
  await shell.openPath(app.getPath('userData'));
});

ipcMain.handle('get-reader-state', () => {
  return getReaderPayload();
});

ipcMain.handle('open-reader-file', async () => {
  if (!mainWindow) return getReaderPayload();

  nativeDialogOpen = true;
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      title: '\u5bfc\u5165 TXT \u5c0f\u8bf4',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Text files', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
  } finally {
    nativeDialogOpen = false;
  }

  if (result.canceled || result.filePaths.length === 0) {
    return getReaderPayload();
  }

  const currentState = loadReaderDiskState();
  const now = new Date().toISOString();
  const booksById = new Map(currentState.books.map((book) => [book.id.toLowerCase(), book]));
  const firstImportedId = normalizeBookId(result.filePaths[0]);
  const currentBook = currentState.books.find((book) => book.id === currentState.currentBookId);
  const defaultCharsPerPage = currentBook?.charsPerPage ?? currentState.books[0]?.charsPerPage ?? 120;
  const defaultFontSize = currentBook?.fontSize ?? currentState.books[0]?.fontSize ?? 14;

  result.filePaths.forEach((filePath) => {
    const id = normalizeBookId(filePath);
    const key = id.toLowerCase();
    const existingBook = booksById.get(key);
    booksById.set(key, {
      id,
      filePath,
      title: getBookTitle(filePath),
      position: existingBook?.position ?? 0,
      charsPerPage: existingBook?.charsPerPage ?? defaultCharsPerPage,
      fontSize: existingBook?.fontSize ?? defaultFontSize,
      addedAt: existingBook?.addedAt ?? now,
      updatedAt: now,
    });
  });

  const state = saveReaderDiskState({
    currentBookId: firstImportedId,
    books: Array.from(booksById.values()),
  });

  return getReaderPayload(state);
});

ipcMain.handle('select-reader-book', (_event, bookId: string) => {
  const currentState = loadReaderDiskState();
  const selectedBook = currentState.books.find((book) => book.id === bookId);
  if (!selectedBook) return getReaderPayload(currentState);
  const state = saveReaderDiskState({ ...currentState, currentBookId: selectedBook.id });
  return getReaderPayload(state);
});

ipcMain.handle('save-reader-state', (_event, patch: ReaderStatePatch) => {
  const currentState = loadReaderDiskState();
  const bookId =
    typeof patch.currentBookId === 'string' && patch.currentBookId
      ? patch.currentBookId
      : typeof patch.filePath === 'string' && patch.filePath
        ? normalizeBookId(patch.filePath)
        : currentState.currentBookId;
  const existingBook = currentState.books.find((book) => book.id === bookId);
  if (!existingBook && !patch.filePath) return saveReaderDiskState(currentState);

  const now = new Date().toISOString();
  const nextBook: ReaderBookDiskState = {
    id: existingBook?.id ?? normalizeBookId(patch.filePath ?? ''),
    filePath: existingBook?.filePath ?? patch.filePath ?? '',
    title: existingBook?.title ?? getBookTitle(patch.filePath ?? ''),
    position: Math.max(0, Number.isFinite(Number(patch.position)) ? Number(patch.position) : existingBook?.position ?? 0),
    charsPerPage: clampReaderCharsPerPage(patch.charsPerPage ?? existingBook?.charsPerPage),
    fontSize: clampReaderFontSize(patch.fontSize ?? existingBook?.fontSize),
    addedAt: existingBook?.addedAt ?? now,
    updatedAt: now,
  };
  const books = existingBook
    ? currentState.books.map((book) => (book.id === nextBook.id ? nextBook : book))
    : [...currentState.books, nextBook];

  return saveReaderDiskState({
    currentBookId: nextBook.id,
    books,
  });
});

ipcMain.handle('daily-plan:get-today', () => {
  return getDailyPlanStore().getTodayPlan();
});

ipcMain.handle('daily-plan:add-item', (_event, text: string) => {
  return getDailyPlanStore().addPlanItem(text);
});

ipcMain.handle('daily-plan:toggle-item', (_event, id: string) => {
  return getDailyPlanStore().togglePlanItem(id);
});

ipcMain.handle('daily-plan:delete-item', (_event, id: string) => {
  return getDailyPlanStore().deletePlanItem(id);
});

ipcMain.handle('daily-plan:reorder-items', (_event, ids: string[]) => {
  return getDailyPlanStore().reorderPlanItems(ids);
});

ipcMain.handle('daily-plan:run-carry-over', () => {
  return getDailyPlanStore().runCarryOver();
});

ipcMain.handle('daily-plan:rollback-today', () => {
  return getDailyPlanStore().rollbackTodayPlan();
});

ipcMain.handle('daily-plan:can-rollback', () => {
  return getDailyPlanStore().canRollbackTodayPlan();
});

ipcMain.handle('daily-plan:get-templates', () => {
  return getDailyPlanStore().getTemplates();
});

ipcMain.handle('daily-plan:save-template', (_event, name: string, items: string[]) => {
  return getDailyPlanStore().saveTemplate(name, items);
});

ipcMain.handle('daily-plan:delete-template', (_event, id: string) => {
  return getDailyPlanStore().deleteTemplate(id);
});

ipcMain.handle('daily-plan:import-template', (_event, id: string) => {
  return getDailyPlanStore().importTemplate(id);
});

ipcMain.handle('daily-plan:dismiss-reminder', () => {
  hidePlanReminder();
});

ipcMain.handle('dashboard:get-module-order', () => {
  return getDashboardOrderStore().getOrder();
});

ipcMain.handle('dashboard:save-module-order', (_event, order: DashboardModuleKey[]) => {
  return getDashboardOrderStore().saveOrder(order);
});

ipcMain.handle('dashboard:get-shortcuts', () => {
  return getDashboardOrderStore().getShortcuts();
});

ipcMain.handle('dashboard:save-shortcuts', (_event, shortcuts: DashboardModuleKey[]) => {
  return getDashboardOrderStore().saveShortcuts(shortcuts);
});

ipcMain.handle('photos:get-all', () => {
  return getPhotoStore().getPhotos();
});

ipcMain.handle('photos:get-filter-mode', () => {
  return getPhotoStore().getFilterMode();
});

ipcMain.handle('photos:update-filter-mode', (_event, mode: 'auto' | 'landscape' | 'portrait') => {
  return getPhotoStore().updateFilterMode(mode);
});

ipcMain.handle('photos:get-interval-ms', () => {
  return getPhotoStore().getIntervalMs();
});

ipcMain.handle('photos:update-interval-ms', (_event, intervalMs: 10000 | 30000 | 60000 | 600000) => {
  return getPhotoStore().updateIntervalMs(intervalMs);
});

ipcMain.handle('photos:add', async () => {
  if (!mainWindow) return getPhotoStore().getPhotos();

  nativeDialogOpen = true;
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      title: '\u6dfb\u52a0\u8f6e\u64ad\u7167\u7247',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
  } finally {
    nativeDialogOpen = false;
  }

  if (result.canceled || result.filePaths.length === 0) {
    return getPhotoStore().getPhotos();
  }

  return getPhotoStore().addPhotos(result.filePaths);
});

ipcMain.handle('photos:delete', (_event, id: string) => {
  return getPhotoStore().deletePhoto(id);
});

ipcMain.handle('photos:update-focus', (_event, id: string, focus: { focusX: number; focusY: number }) => {
  return getPhotoStore().updatePhotoFocus(id, focus);
});

ipcMain.handle('photos:update-orientation', (_event, id: string, orientation: 'landscape' | 'portrait') => {
  return getPhotoStore().updatePhotoOrientation(id, orientation);
});

ipcMain.handle('theme-stickers:get', () => {
  return getThemeStickerStore().getTheme();
});

ipcMain.handle('theme-stickers:set', async (_event, slot: ThemeStickerSlot) => {
  if (!mainWindow) return getThemeStickerStore().getTheme();

  nativeDialogOpen = true;
  let result;
  try {
    result = await dialog.showOpenDialog(mainWindow, {
      title: '閫夋嫨涓婚璐村浘',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
  } finally {
    nativeDialogOpen = false;
  }

  if (result.canceled || result.filePaths.length === 0) {
    return getThemeStickerStore().getTheme();
  }

  const theme = getThemeStickerStore().setSticker(slot, result.filePaths[0]);
  broadcastThemeStickersChanged(theme);
  return theme;
});

ipcMain.handle('theme-stickers:clear', (_event, slot: ThemeStickerSlot) => {
  const theme = getThemeStickerStore().clearSticker(slot);
  broadcastThemeStickersChanged(theme);
  return theme;
});

ipcMain.handle('work-countdown:get-settings', () => {
  return getWorkCountdownStore().getSettings();
});

ipcMain.handle('work-countdown:save-settings', (_event, settings: WorkCountdownSettings) => {
  return getWorkCountdownStore().saveSettings(settings);
});

ipcMain.handle('password-vault:get-status', () => {
  return getPasswordVaultStore().getStatus();
});

ipcMain.handle('password-vault:setup', (_event, password: string) => {
  return getPasswordVaultStore().setup(password);
});

ipcMain.handle('password-vault:unlock', (_event, password: string) => {
  return getPasswordVaultStore().unlock(password);
});

ipcMain.handle('password-vault:lock', () => {
  return getPasswordVaultStore().lock();
});

ipcMain.handle('password-vault:reset', () => {
  return getPasswordVaultStore().reset();
});

ipcMain.handle('password-vault:list', () => {
  return getPasswordVaultStore().listRecords();
});

ipcMain.handle('password-vault:add', (_event, record: Partial<AccountRecord>) => {
  return getPasswordVaultStore().addRecord(record);
});

ipcMain.handle('password-vault:update', (_event, id: string, record: Partial<AccountRecord>) => {
  return getPasswordVaultStore().updateRecord(id, record);
});

ipcMain.handle('password-vault:delete', (_event, id: string) => {
  return getPasswordVaultStore().deleteRecord(id);
});

ipcMain.handle('password-vault:copy-text', (_event, value: string) => {
  if (typeof value !== 'string' || !value) return false;
  clipboard.writeText(value);
  return true;
});

ipcMain.handle('file-naming:get-templates', () => {
  return getFileNamingStore().getTemplates();
});

ipcMain.handle('file-naming:save-template', (_event, template: Partial<FileNameTemplate>) => {
  return getFileNamingStore().saveTemplate(template);
});

ipcMain.handle('file-naming:delete-template', (_event, id: string) => {
  return getFileNamingStore().deleteTemplate(id);
});

ipcMain.handle('temp-clipboard:get-state', () => {
  return getTempClipboardStore().getState();
});

ipcMain.handle('temp-clipboard:set-mode', (_event, mode: TempClipboardMode) => {
  return setTempClipboardMode(mode);
});

ipcMain.handle('temp-clipboard:delete-entry', (_event, id: string) => {
  const state = getTempClipboardStore().deleteEntry(id);
  emitTempClipboardState();
  return state;
});

ipcMain.handle('temp-clipboard:clear', () => {
  const state = getTempClipboardStore().clear();
  emitTempClipboardState();
  return state;
});

ipcMain.handle('temp-clipboard:paste-entry', (_event, id: string) => {
  const state = getTempClipboardStore().getState();
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return state;
  return pasteTempClipboardEntry(entry, true);
});

ipcMain.handle('temp-clipboard:undo-last-paste', () => {
  return undoLastTempClipboardPaste();
});

ipcMain.handle('temp-clipboard:paste-next', () => {
  return pasteNextTempClipboardEntry(true);
});

ipcMain.handle('temp-clipboard:capture-selection', () => {
  return captureCurrentSelection();
});

ipcMain.handle('temp-clipboard:show-window', () => {
  updateTempClipboardWindowVisibility();
  return getTempClipboardStore().getState();
});

ipcMain.handle('temp-clipboard:save-shortcuts', (_event, shortcuts: Partial<TempClipboardShortcuts>) => {
  const state = getTempClipboardStore().saveShortcuts(shortcuts);
  registerTempClipboardShortcuts();
  emitTempClipboardState();
  return state;
});

ipcMain.handle('quit-app', () => {
  app.quit();
});

