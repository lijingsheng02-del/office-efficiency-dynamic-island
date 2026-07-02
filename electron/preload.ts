import { contextBridge, ipcRenderer } from 'electron';

type IslandSize = 'compact' | 'reminder' | 'dashboard' | 'detail' | 'calculator' | 'dailyPlan' | 'reader' | 'vault';
type DockPosition = 'top' | 'right' | 'bottom' | 'left';
type PhotoFilterMode = 'auto' | 'landscape' | 'portrait';
type PhotoIntervalMs = 10000 | 30000 | 60000 | 600000;
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
type ThemeStickerSlot = 'compact' | 'dashboard' | 'detail' | 'sheet' | 'pattern' | 'floating';
type RoastTone = 'encourage' | 'normal' | 'almost';
type DashboardModuleKey =
  | 'daily-plan'
  | 'work-countdown'
  | 'reader'
  | 'photos'
  | 'calculator'
  | 'password-vault'
  | 'file-namer'
  | 'temp-clipboard'
  | 'personalization'
  | 'author-support'
  | 'settings';

type ReaderBookState = {
  id: string;
  filePath: string;
  title: string;
  position: number;
  charsPerPage: number;
  addedAt: string;
  updatedAt: string;
  exists: boolean;
};

type ReaderState = {
  currentBookId: string;
  books: ReaderBookState[];
  filePath: string;
  title: string;
  text: string;
  position: number;
  charsPerPage: number;
};

type ReaderDiskState = {
  currentBookId?: string;
  filePath?: string;
  position: number;
  charsPerPage: number;
};

type PlanItem = {
  id: string;
  sourceId: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
  carryOverFrom?: string | null;
  order: number;
};

type DailyPlan = {
  date: string;
  items: PlanItem[];
};

type DailyPlanTemplate = {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
};

type PlanReminder = {
  id: string;
  text: string;
  date: string;
  order: number;
};

type IslandPhoto = {
  id: string;
  filePath: string;
  url: string;
  name: string;
  createdAt: string;
  focusX: number;
  focusY: number;
  width: number;
  height: number;
  orientation: 'landscape' | 'portrait';
};

type ThemeSticker = {
  slot: ThemeStickerSlot;
  filePath: string;
  url: string;
  name: string;
  updatedAt: string;
  pieces: ThemeStickerPiece[];
};

type ThemeStickerPiece = {
  filePath: string;
  url: string;
  width: number;
  height: number;
};

type WorkCountdownSettings = {
  workStart: string;
  lunchStart: string;
  lunchEnd: string;
  workEnd: string;
  roasts: Record<RoastTone, string[]>;
};

type AccountRecord = {
  id: string;
  platform: string;
  account: string;
  password: string;
  email: string;
  phone: string;
  note: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type FileNameTemplate = {
  id: string;
  name: string;
  pattern: string;
  createdAt: string;
};

type TempClipboardEntry = {
  id: string;
  type: 'text' | 'image';
  preview: string;
  text?: string;
  imageDataUrl?: string;
  createdAt: string;
  expiresAt: string;
};

type TempClipboardShortcuts = {
  captureMode: string;
  captureCopy: string;
  normalMode: string;
  pasteMode: string;
  pasteNext: string;
};

type TempClipboardState = {
  mode: 'normal' | 'capture' | 'paste';
  entries: TempClipboardEntry[];
  pasteIndex: number;
  shortcuts: TempClipboardShortcuts;
  pastedHistory: TempClipboardEntry[];
};

type VideoWallpaperState = {
  enabled: boolean;
  filePath: string;
  name: string;
  attachedToDesktop: boolean;
  lastError: string;
};

const islandApi = {
  resizeIsland: (size: IslandSize) => ipcRenderer.invoke('resize-island', size),
  focusIsland: () => ipcRenderer.invoke('focus-island') as Promise<void>,
  getDockPosition: () => ipcRenderer.invoke('get-dock-position') as Promise<DockPosition>,
  dragIsland: (point: { x: number; y: number }) => ipcRenderer.invoke('drag-island', point) as Promise<DockPosition>,
  snapIsland: (point: { x: number; y: number }) => ipcRenderer.invoke('snap-island', point) as Promise<DockPosition>,
  setAlwaysOnTop: (enabled: boolean) => ipcRenderer.invoke('set-always-on-top', enabled),
  getAppSettings: () => ipcRenderer.invoke('get-app-settings') as Promise<AppSettings>,
  setTheme: (theme: ThemeMode) => ipcRenderer.invoke('set-theme', theme) as Promise<ThemeMode>,
  setThemePreset: (preset: ThemePreset) => ipcRenderer.invoke('set-theme-preset', preset) as Promise<ThemePreset>,
  setIslandOpacity: (opacity: number) => ipcRenderer.invoke('set-island-opacity', opacity) as Promise<number>,
  setIslandTint: (tint: string) => ipcRenderer.invoke('set-island-tint', tint) as Promise<string>,
  setStickerOpacity: (opacity: number) => ipcRenderer.invoke('set-sticker-opacity', opacity) as Promise<number>,
  setWallpaperBlur: (enabled: boolean) => ipcRenderer.invoke('set-wallpaper-blur', enabled) as Promise<boolean>,
  setWallpaperPosition: (position: WallpaperPosition) => ipcRenderer.invoke('set-wallpaper-position', position) as Promise<WallpaperPosition>,
  setWallpaperFocus: (focus: { x: number; y: number }) => ipcRenderer.invoke('set-wallpaper-focus', focus) as Promise<{ x: number; y: number }>,
  setFloatingWallpaperFocus: (focus: { x: number; y: number }) =>
    ipcRenderer.invoke('set-floating-wallpaper-focus', focus) as Promise<{ x: number; y: number }>,
  getVideoWallpaperState: () => ipcRenderer.invoke('video-wallpaper:get-state') as Promise<VideoWallpaperState>,
  selectVideoWallpaper: () => ipcRenderer.invoke('video-wallpaper:select') as Promise<VideoWallpaperState>,
  startVideoWallpaper: () => ipcRenderer.invoke('video-wallpaper:start') as Promise<VideoWallpaperState>,
  stopVideoWallpaper: () => ipcRenderer.invoke('video-wallpaper:stop') as Promise<VideoWallpaperState>,
  toggleVideoWallpaper: () => ipcRenderer.invoke('video-wallpaper:toggle') as Promise<VideoWallpaperState>,
  markWelcomeSeen: () => ipcRenderer.invoke('mark-welcome-seen') as Promise<boolean>,
  getReaderState: () => ipcRenderer.invoke('get-reader-state') as Promise<ReaderState>,
  openReaderFile: () => ipcRenderer.invoke('open-reader-file') as Promise<ReaderState>,
  selectReaderBook: (bookId: string) => ipcRenderer.invoke('select-reader-book', bookId) as Promise<ReaderState>,
  saveReaderState: (state: ReaderDiskState) => ipcRenderer.invoke('save-reader-state', state) as Promise<ReaderDiskState>,
  quitApp: () => ipcRenderer.invoke('quit-app'),
  onAlwaysOnTopChanged: (callback: (enabled: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, enabled: boolean) => callback(enabled);
    ipcRenderer.on('always-on-top-changed', listener);
    return () => ipcRenderer.removeListener('always-on-top-changed', listener);
  },
  onWindowBlur: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('island-window-blur', listener);
    return () => ipcRenderer.removeListener('island-window-blur', listener);
  },
  onForceCollapse: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('force-collapse-island', listener);
    return () => ipcRenderer.removeListener('force-collapse-island', listener);
  },
  onDockPositionChanged: (callback: (dockPosition: DockPosition) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, dockPosition: DockPosition) => callback(dockPosition);
    ipcRenderer.on('dock-position-changed', listener);
    return () => ipcRenderer.removeListener('dock-position-changed', listener);
  },
  onAppSettingsChanged: (callback: (settings: AppSettings) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings);
    ipcRenderer.on('app-settings-changed', listener);
    return () => ipcRenderer.removeListener('app-settings-changed', listener);
  },
};

contextBridge.exposeInMainWorld('islandApi', islandApi);

const dailyPlanAPI = {
  getTodayPlan: () => ipcRenderer.invoke('daily-plan:get-today') as Promise<DailyPlan>,
  addPlanItem: (text: string) => ipcRenderer.invoke('daily-plan:add-item', text) as Promise<DailyPlan>,
  togglePlanItem: (id: string) => ipcRenderer.invoke('daily-plan:toggle-item', id) as Promise<DailyPlan>,
  deletePlanItem: (id: string) => ipcRenderer.invoke('daily-plan:delete-item', id) as Promise<DailyPlan>,
  reorderPlanItems: (ids: string[]) => ipcRenderer.invoke('daily-plan:reorder-items', ids) as Promise<DailyPlan>,
  runCarryOver: () => ipcRenderer.invoke('daily-plan:run-carry-over') as Promise<DailyPlan>,
  rollbackTodayPlan: () => ipcRenderer.invoke('daily-plan:rollback-today') as Promise<DailyPlan>,
  canRollback: () => ipcRenderer.invoke('daily-plan:can-rollback') as Promise<boolean>,
  getTemplates: () => ipcRenderer.invoke('daily-plan:get-templates') as Promise<DailyPlanTemplate[]>,
  saveTemplate: (name: string, items: string[]) => ipcRenderer.invoke('daily-plan:save-template', name, items) as Promise<DailyPlanTemplate[]>,
  deleteTemplate: (id: string) => ipcRenderer.invoke('daily-plan:delete-template', id) as Promise<DailyPlanTemplate[]>,
  importTemplate: (id: string) => ipcRenderer.invoke('daily-plan:import-template', id) as Promise<DailyPlan>,
  dismissReminder: () => ipcRenderer.invoke('daily-plan:dismiss-reminder') as Promise<void>,
  onReminderShow: (callback: (reminder: PlanReminder) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, reminder: PlanReminder) => callback(reminder);
    ipcRenderer.on('daily-plan-reminder-show', listener);
    return () => ipcRenderer.removeListener('daily-plan-reminder-show', listener);
  },
  onReminderHide: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('daily-plan-reminder-hide', listener);
    return () => ipcRenderer.removeListener('daily-plan-reminder-hide', listener);
  },
};

contextBridge.exposeInMainWorld('dailyPlanAPI', dailyPlanAPI);

const dashboardAPI = {
  getModuleOrder: () => ipcRenderer.invoke('dashboard:get-module-order') as Promise<DashboardModuleKey[]>,
  saveModuleOrder: (order: DashboardModuleKey[]) => ipcRenderer.invoke('dashboard:save-module-order', order) as Promise<DashboardModuleKey[]>,
  getShortcuts: () => ipcRenderer.invoke('dashboard:get-shortcuts') as Promise<DashboardModuleKey[]>,
  saveShortcuts: (shortcuts: DashboardModuleKey[]) => ipcRenderer.invoke('dashboard:save-shortcuts', shortcuts) as Promise<DashboardModuleKey[]>,
};

contextBridge.exposeInMainWorld('dashboardAPI', dashboardAPI);

const photoAPI = {
  getPhotos: () => ipcRenderer.invoke('photos:get-all') as Promise<IslandPhoto[]>,
  getFilterMode: () => ipcRenderer.invoke('photos:get-filter-mode') as Promise<PhotoFilterMode>,
  updateFilterMode: (mode: PhotoFilterMode) => ipcRenderer.invoke('photos:update-filter-mode', mode) as Promise<PhotoFilterMode>,
  getIntervalMs: () => ipcRenderer.invoke('photos:get-interval-ms') as Promise<PhotoIntervalMs>,
  updateIntervalMs: (intervalMs: PhotoIntervalMs) => ipcRenderer.invoke('photos:update-interval-ms', intervalMs) as Promise<PhotoIntervalMs>,
  addPhotos: () => ipcRenderer.invoke('photos:add') as Promise<IslandPhoto[]>,
  deletePhoto: (id: string) => ipcRenderer.invoke('photos:delete', id) as Promise<IslandPhoto[]>,
  updatePhotoFocus: (id: string, focus: { focusX: number; focusY: number }) =>
    ipcRenderer.invoke('photos:update-focus', id, focus) as Promise<IslandPhoto[]>,
  updatePhotoOrientation: (id: string, orientation: 'landscape' | 'portrait') =>
    ipcRenderer.invoke('photos:update-orientation', id, orientation) as Promise<IslandPhoto[]>,
};

contextBridge.exposeInMainWorld('photoAPI', photoAPI);


const themeStickerAPI = {
  getTheme: () => ipcRenderer.invoke('theme-stickers:get') as Promise<Record<ThemeStickerSlot, ThemeSticker | null>>,
  setSticker: (slot: ThemeStickerSlot) => ipcRenderer.invoke('theme-stickers:set', slot) as Promise<Record<ThemeStickerSlot, ThemeSticker | null>>,
  clearSticker: (slot: ThemeStickerSlot) => ipcRenderer.invoke('theme-stickers:clear', slot) as Promise<Record<ThemeStickerSlot, ThemeSticker | null>>,
  onThemeChanged: (callback: (theme: Record<ThemeStickerSlot, ThemeSticker | null>) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, theme: Record<ThemeStickerSlot, ThemeSticker | null>) => callback(theme);
    ipcRenderer.on('theme-stickers:changed', listener);
    return () => ipcRenderer.removeListener('theme-stickers:changed', listener);
  },
};

contextBridge.exposeInMainWorld('themeStickerAPI', themeStickerAPI);

const backupAPI = {
  exportData: () => ipcRenderer.invoke('backup:export') as Promise<{ ok: boolean; canceled: boolean; filePath?: string }>,
  importData: () => ipcRenderer.invoke('backup:import') as Promise<{ ok: boolean; canceled: boolean }>,
  openDataDirectory: () => ipcRenderer.invoke('backup:open-data-dir') as Promise<void>,
};

contextBridge.exposeInMainWorld('backupAPI', backupAPI);

const workCountdownAPI = {
  getSettings: () => ipcRenderer.invoke('work-countdown:get-settings') as Promise<WorkCountdownSettings>,
  saveSettings: (settings: WorkCountdownSettings) => ipcRenderer.invoke('work-countdown:save-settings', settings) as Promise<WorkCountdownSettings>,
};

contextBridge.exposeInMainWorld('workCountdownAPI', workCountdownAPI);

const passwordVaultAPI = {
  getStatus: () => ipcRenderer.invoke('password-vault:get-status') as Promise<{ configured: boolean; unlocked: boolean }>,
  setup: (password: string) => ipcRenderer.invoke('password-vault:setup', password) as Promise<{ configured: boolean; unlocked: boolean }>,
  unlock: (password: string) => ipcRenderer.invoke('password-vault:unlock', password) as Promise<AccountRecord[]>,
  lock: () => ipcRenderer.invoke('password-vault:lock') as Promise<{ configured: boolean; unlocked: boolean }>,
  reset: () => ipcRenderer.invoke('password-vault:reset') as Promise<{ configured: boolean; unlocked: boolean }>,
  list: () => ipcRenderer.invoke('password-vault:list') as Promise<AccountRecord[]>,
  add: (record: Partial<AccountRecord>) => ipcRenderer.invoke('password-vault:add', record) as Promise<AccountRecord[]>,
  update: (id: string, record: Partial<AccountRecord>) => ipcRenderer.invoke('password-vault:update', id, record) as Promise<AccountRecord[]>,
  delete: (id: string) => ipcRenderer.invoke('password-vault:delete', id) as Promise<AccountRecord[]>,
  copyText: (value: string) => ipcRenderer.invoke('password-vault:copy-text', value) as Promise<boolean>,
};

contextBridge.exposeInMainWorld('passwordVaultAPI', passwordVaultAPI);

const fileNamingAPI = {
  getTemplates: () => ipcRenderer.invoke('file-naming:get-templates') as Promise<FileNameTemplate[]>,
  saveTemplate: (template: Partial<FileNameTemplate>) => ipcRenderer.invoke('file-naming:save-template', template) as Promise<FileNameTemplate[]>,
  deleteTemplate: (id: string) => ipcRenderer.invoke('file-naming:delete-template', id) as Promise<FileNameTemplate[]>,
};

contextBridge.exposeInMainWorld('fileNamingAPI', fileNamingAPI);

const tempClipboardAPI = {
  getState: () => ipcRenderer.invoke('temp-clipboard:get-state') as Promise<TempClipboardState>,
  setMode: (mode: TempClipboardState['mode']) => ipcRenderer.invoke('temp-clipboard:set-mode', mode) as Promise<TempClipboardState>,
  deleteEntry: (id: string) => ipcRenderer.invoke('temp-clipboard:delete-entry', id) as Promise<TempClipboardState>,
  clear: () => ipcRenderer.invoke('temp-clipboard:clear') as Promise<TempClipboardState>,
  pasteEntry: (id: string) => ipcRenderer.invoke('temp-clipboard:paste-entry', id) as Promise<TempClipboardState>,
  undoLastPaste: () => ipcRenderer.invoke('temp-clipboard:undo-last-paste') as Promise<TempClipboardState>,
  pasteNext: () => ipcRenderer.invoke('temp-clipboard:paste-next') as Promise<TempClipboardState>,
  captureSelection: () => ipcRenderer.invoke('temp-clipboard:capture-selection') as Promise<TempClipboardState>,
  showWindow: () => ipcRenderer.invoke('temp-clipboard:show-window') as Promise<TempClipboardState>,
  saveShortcuts: (shortcuts: Partial<TempClipboardShortcuts>) =>
    ipcRenderer.invoke('temp-clipboard:save-shortcuts', shortcuts) as Promise<TempClipboardState>,
  onStateChanged: (callback: (state: TempClipboardState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: TempClipboardState) => callback(state);
    ipcRenderer.on('temp-clipboard-state-changed', listener);
    return () => ipcRenderer.removeListener('temp-clipboard-state-changed', listener);
  },
};

contextBridge.exposeInMainWorld('tempClipboardAPI', tempClipboardAPI);

