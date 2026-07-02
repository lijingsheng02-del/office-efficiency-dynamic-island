export {};

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

type ReaderChapter = {
  id: string;
  title: string;
  position: number;
};

type ReaderState = {
  currentBookId: string;
  books: ReaderBookState[];
  filePath: string;
  title: string;
  text: string;
  chapters: ReaderChapter[];
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

declare global {
  interface Window {
    islandApi: {
      resizeIsland: (size: 'compact' | 'reminder' | 'dashboard' | 'detail' | 'calculator' | 'dailyPlan' | 'reader' | 'vault') => Promise<{ width: number; height: number }>;
      focusIsland: () => Promise<void>;
      getDockPosition: () => Promise<DockPosition>;
      dragIsland: (point: { x: number; y: number }) => Promise<DockPosition>;
      snapIsland: (point: { x: number; y: number }) => Promise<DockPosition>;
      setAlwaysOnTop: (enabled: boolean) => Promise<boolean>;
      getAppSettings: () => Promise<AppSettings>;
      setTheme: (theme: ThemeMode) => Promise<ThemeMode>;
      setThemePreset: (preset: ThemePreset) => Promise<ThemePreset>;
      setIslandOpacity: (opacity: number) => Promise<number>;
      setIslandTint: (tint: string) => Promise<string>;
      setStickerOpacity: (opacity: number) => Promise<number>;
      setWallpaperBlur: (enabled: boolean) => Promise<boolean>;
      setWallpaperPosition: (position: WallpaperPosition) => Promise<WallpaperPosition>;
      setWallpaperFocus: (focus: { x: number; y: number }) => Promise<{ x: number; y: number }>;
      setFloatingWallpaperFocus: (focus: { x: number; y: number }) => Promise<{ x: number; y: number }>;
      getVideoWallpaperState: () => Promise<VideoWallpaperState>;
      selectVideoWallpaper: () => Promise<VideoWallpaperState>;
      startVideoWallpaper: () => Promise<VideoWallpaperState>;
      stopVideoWallpaper: () => Promise<VideoWallpaperState>;
      toggleVideoWallpaper: () => Promise<VideoWallpaperState>;
      markWelcomeSeen: () => Promise<boolean>;
      getReaderState: () => Promise<ReaderState>;
      openReaderFile: () => Promise<ReaderState>;
      selectReaderBook: (bookId: string) => Promise<ReaderState>;
      saveReaderState: (state: ReaderDiskState) => Promise<ReaderDiskState>;
      quitApp: () => Promise<void>;
      onAlwaysOnTopChanged: (callback: (enabled: boolean) => void) => () => void;
      onWindowBlur: (callback: () => void) => () => void;
      onForceCollapse: (callback: () => void) => () => void;
      onDockPositionChanged: (callback: (dockPosition: DockPosition) => void) => () => void;
      onAppSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
    };
    dailyPlanAPI: {
      getTodayPlan: () => Promise<DailyPlan>;
      addPlanItem: (text: string) => Promise<DailyPlan>;
      togglePlanItem: (id: string) => Promise<DailyPlan>;
      deletePlanItem: (id: string) => Promise<DailyPlan>;
      reorderPlanItems: (ids: string[]) => Promise<DailyPlan>;
      runCarryOver: () => Promise<DailyPlan>;
      rollbackTodayPlan: () => Promise<DailyPlan>;
      canRollback: () => Promise<boolean>;
      getTemplates: () => Promise<DailyPlanTemplate[]>;
      saveTemplate: (name: string, items: string[]) => Promise<DailyPlanTemplate[]>;
      deleteTemplate: (id: string) => Promise<DailyPlanTemplate[]>;
      importTemplate: (id: string) => Promise<DailyPlan>;
      dismissReminder: () => Promise<void>;
      onReminderShow: (callback: (reminder: PlanReminder) => void) => () => void;
      onReminderHide: (callback: () => void) => () => void;
    };
    dashboardAPI: {
      getModuleOrder: () => Promise<DashboardModuleKey[]>;
      saveModuleOrder: (order: DashboardModuleKey[]) => Promise<DashboardModuleKey[]>;
      getShortcuts: () => Promise<DashboardModuleKey[]>;
      saveShortcuts: (shortcuts: DashboardModuleKey[]) => Promise<DashboardModuleKey[]>;
    };
    photoAPI: {
      getPhotos: () => Promise<IslandPhoto[]>;
      getFilterMode: () => Promise<PhotoFilterMode>;
      updateFilterMode: (mode: PhotoFilterMode) => Promise<PhotoFilterMode>;
      getIntervalMs: () => Promise<PhotoIntervalMs>;
      updateIntervalMs: (intervalMs: PhotoIntervalMs) => Promise<PhotoIntervalMs>;
      addPhotos: () => Promise<IslandPhoto[]>;
      deletePhoto: (id: string) => Promise<IslandPhoto[]>;
      updatePhotoFocus: (id: string, focus: { focusX: number; focusY: number }) => Promise<IslandPhoto[]>;
      updatePhotoOrientation: (id: string, orientation: 'landscape' | 'portrait') => Promise<IslandPhoto[]>;
    };
    themeStickerAPI: {
      getTheme: () => Promise<Record<ThemeStickerSlot, ThemeSticker | null>>;
      setSticker: (slot: ThemeStickerSlot) => Promise<Record<ThemeStickerSlot, ThemeSticker | null>>;
      clearSticker: (slot: ThemeStickerSlot) => Promise<Record<ThemeStickerSlot, ThemeSticker | null>>;
      onThemeChanged: (callback: (theme: Record<ThemeStickerSlot, ThemeSticker | null>) => void) => () => void;
    };
    backupAPI: {
      exportData: () => Promise<{ ok: boolean; canceled: boolean; filePath?: string }>;
      importData: () => Promise<{ ok: boolean; canceled: boolean }>;
      openDataDirectory: () => Promise<void>;
    };
    workCountdownAPI: {
      getSettings: () => Promise<WorkCountdownSettings>;
      saveSettings: (settings: WorkCountdownSettings) => Promise<WorkCountdownSettings>;
    };
    passwordVaultAPI: {
      getStatus: () => Promise<{ configured: boolean; unlocked: boolean }>;
      setup: (password: string) => Promise<{ configured: boolean; unlocked: boolean }>;
      unlock: (password: string) => Promise<AccountRecord[]>;
      lock: () => Promise<{ configured: boolean; unlocked: boolean }>;
      reset: () => Promise<{ configured: boolean; unlocked: boolean }>;
      list: () => Promise<AccountRecord[]>;
      add: (record: Partial<AccountRecord>) => Promise<AccountRecord[]>;
      update: (id: string, record: Partial<AccountRecord>) => Promise<AccountRecord[]>;
      delete: (id: string) => Promise<AccountRecord[]>;
      copyText: (value: string) => Promise<boolean>;
    };
    fileNamingAPI: {
      getTemplates: () => Promise<FileNameTemplate[]>;
      saveTemplate: (template: Partial<FileNameTemplate>) => Promise<FileNameTemplate[]>;
      deleteTemplate: (id: string) => Promise<FileNameTemplate[]>;
    };
    tempClipboardAPI: {
      getState: () => Promise<TempClipboardState>;
      setMode: (mode: TempClipboardState['mode']) => Promise<TempClipboardState>;
      deleteEntry: (id: string) => Promise<TempClipboardState>;
      clear: () => Promise<TempClipboardState>;
      pasteEntry: (id: string) => Promise<TempClipboardState>;
      undoLastPaste: () => Promise<TempClipboardState>;
      pasteNext: () => Promise<TempClipboardState>;
      captureSelection: () => Promise<TempClipboardState>;
      showWindow: () => Promise<TempClipboardState>;
      saveShortcuts: (shortcuts: Partial<TempClipboardShortcuts>) => Promise<TempClipboardState>;
      onStateChanged: (callback: (state: TempClipboardState) => void) => () => void;
    };
  }
}

