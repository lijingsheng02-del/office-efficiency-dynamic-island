import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Dashboard } from './dashboard/Dashboard';
import { AccountVaultDetail } from './modules/AccountVaultDetail';
import { AuthorSupportDetail } from './modules/AuthorSupportDetail';
import { CalculatorDetail } from './modules/CalculatorDetail';
import { DailyPlanDetail } from './modules/DailyPlanDetail';
import { FileNamerDetail } from './modules/FileNamerDetail';
import { PersonalizationDetail } from './modules/PersonalizationDetail';
import { PhotosDetail } from './modules/PhotosDetail';
import { ReaderDetail } from './modules/ReaderDetail';
import { SettingsDetail } from './modules/SettingsDetail';
import { TempClipboardDetail } from './modules/TempClipboardDetail';
import { WelcomeNotice } from './modules/WelcomeNotice';
import { WorkCountdownDetail } from './modules/WorkCountdownDetail';

export type ModuleKey =
  | 'dashboard'
  | 'daily-plan'
  | 'reader'
  | 'photos'
  | 'work-countdown'
  | 'calculator'
  | 'password-vault'
  | 'file-namer'
  | 'temp-clipboard'
  | 'personalization'
  | 'author-support'
  | 'settings';
export type ThemeMode = 'dark' | 'light';
export type ThemePreset = 'default' | 'kitty';
export type PhotoFilterMode = 'auto' | 'landscape' | 'portrait';
export type PhotoIntervalMs = 10000 | 30000 | 60000 | 600000;
export type ThemeStickerSlot = 'compact' | 'dashboard' | 'detail' | 'sheet' | 'pattern' | 'floating';
type DockPosition = 'top' | 'right' | 'bottom' | 'left';

type PlanReminder = {
  id: string;
  text: string;
  date: string;
  order: number;
};

export type ReaderState = {
  filePath: string;
  title: string;
  text: string;
  position: number;
  charsPerPage: number;
};

export type IslandPhoto = {
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

export type ThemeSticker = {
  slot: ThemeStickerSlot;
  filePath: string;
  url: string;
  name: string;
  updatedAt: string;
  pieces: ThemeStickerPiece[];
};

export type ThemeStickerPiece = {
  filePath: string;
  url: string;
  width: number;
  height: number;
};

type ImageSize = {
  width: number;
  height: number;
};

type VideoWallpaperState = {
  enabled: boolean;
  filePath: string;
  name: string;
  attachedToDesktop: boolean;
  lastError: string;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

const EMPTY_READER: ReaderState = { filePath: '', title: '', text: '', position: 0, charsPerPage: 120 };
const EMPTY_VIDEO_WALLPAPER: VideoWallpaperState = {
  enabled: false,
  filePath: '',
  name: '',
  attachedToDesktop: false,
  lastError: '',
};

const moduleSizes: Record<ModuleKey, { width: number; height: number; resizeKey: 'dashboard' | 'detail' | 'calculator' | 'dailyPlan' | 'reader' | 'vault' }> = {
  dashboard: { width: 520, height: 360, resizeKey: 'dashboard' },
  'daily-plan': { width: 560, height: 440, resizeKey: 'dailyPlan' },
  reader: { width: 620, height: 480, resizeKey: 'reader' },
  photos: { width: 560, height: 420, resizeKey: 'detail' },
  'work-countdown': { width: 560, height: 440, resizeKey: 'dailyPlan' },
  calculator: { width: 390, height: 430, resizeKey: 'calculator' },
  'password-vault': { width: 720, height: 560, resizeKey: 'vault' },
  'file-namer': { width: 620, height: 480, resizeKey: 'reader' },
  'temp-clipboard': { width: 620, height: 480, resizeKey: 'reader' },
  personalization: { width: 560, height: 420, resizeKey: 'detail' },
  'author-support': { width: 560, height: 420, resizeKey: 'detail' },
  settings: { width: 560, height: 420, resizeKey: 'detail' },
};
const reminderSize = { width: 340, height: 128 };
const welcomeSize = { width: 560, height: 420 };

const AUTO_COLLAPSE_TIMEOUT_MS = 60_000;
const HORIZONTAL_PHOTO_ASPECT = 52 / 30;
const VERTICAL_PHOTO_ASPECT = 30 / 52;
const DRAG_THRESHOLD = 8;
const stickerScatterPoints = [
  [8, 10, 0.55, -10],
  [24, 8, 0.48, 7],
  [42, 12, 0.52, -4],
  [60, 9, 0.5, 9],
  [78, 13, 0.56, -7],
  [91, 22, 0.44, 12],
  [13, 31, 0.48, 8],
  [31, 29, 0.42, -12],
  [50, 30, 0.5, 5],
  [69, 32, 0.46, -8],
  [87, 39, 0.5, 7],
  [8, 53, 0.52, -7],
  [25, 51, 0.44, 10],
  [43, 54, 0.48, -5],
  [61, 52, 0.42, 13],
  [78, 57, 0.5, -10],
  [92, 63, 0.38, 8],
  [15, 74, 0.46, 5],
  [34, 72, 0.5, -8],
  [53, 76, 0.44, 11],
  [72, 74, 0.48, -6],
  [88, 82, 0.42, 9],
  [6, 88, 0.34, -12],
  [23, 91, 0.36, 6],
  [41, 90, 0.38, -4],
  [59, 91, 0.36, 8],
  [76, 91, 0.38, -10],
  [94, 90, 0.34, 6],
] as const;

function getStickerPieceStyle(index: number, total: number, slot: ThemeStickerSlot, piece?: ThemeStickerPiece): CSSProperties {
  if (slot === 'compact') {
    const compactPoints = [
      [26, 50, 0.28, -8],
      [50, 50, 0.24, 6],
      [74, 50, 0.26, -4],
    ] as const;
    const [left, top, scale, rotate] = compactPoints[index % compactPoints.length];
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: 88,
      height: 88,
      transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${scale})`,
    };
  }

  const [left, top, baseScale, rotate] = stickerScatterPoints[index % stickerScatterPoints.length];
  const visualWeight = piece ? Math.min(1.1, Math.max(0.72, Math.sqrt((piece.width * piece.height) / 46000))) : 1;
  const densityScale = total > 24 ? 0.88 : total > 16 ? 0.96 : 1.08;
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: 128,
    height: 128,
    transform: `translate(-50%, -50%) rotate(${rotate}deg) scale(${baseScale * visualWeight * densityScale})`,
  };
}

function getStickerScatterPieces(sticker: ThemeSticker, slot: ThemeStickerSlot) {
  const sourcePieces = sticker.pieces.length ? sticker.pieces : [sticker];
  const targetCount = slot === 'compact' ? 3 : slot === 'dashboard' ? 16 : 14;
  const pieces = Array.from({ length: targetCount }, (_, index) => sourcePieces[index % sourcePieces.length]);
  return pieces;
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date);
}

function clampPosition(position: number, textLength: number) {
  if (textLength <= 0) return 0;
  return Math.max(0, Math.min(position, textLength - 1));
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getReaderProgress(reader: ReaderState) {
  if (!reader.text.length) return 0;
  return Math.min(100, Math.max(0, Math.round((reader.position / reader.text.length) * 100)));
}

function getStatusText(activeModule: ModuleKey, reader: ReaderState, readerProgress: number, photos: IslandPhoto[]) {
  if (activeModule === 'daily-plan') return '计划';
  if (activeModule === 'reader') return reader.title ? '阅读 ' + String(readerProgress) + '%' : '阅读';
  if (activeModule === 'photos') return photos.length ? String(photos.length) + ' 张' : '照片';
  if (activeModule === 'work-countdown') return '下班';
  if (activeModule === 'calculator') return '计算';
  if (activeModule === 'password-vault') return '账号';
  if (activeModule === 'file-namer') return '命名';
  if (activeModule === 'temp-clipboard') return '剪贴';
  if (activeModule === 'personalization') return '个性';
  if (activeModule === 'author-support') return '支持';
  if (activeModule === 'settings') return '设置';
  return '就绪';
}

function getPhotoSize(photo: IslandPhoto, imageSize?: ImageSize) {
  return {
    width: imageSize?.width || photo.width || 1,
    height: imageSize?.height || photo.height || 1,
  };
}

function getCoverObjectPosition(photo: IslandPhoto, targetAspect: number, imageSize?: ImageSize) {
  const size = getPhotoSize(photo, imageSize);
  const imageAspect = size.width / size.height;

  if (Math.abs(imageAspect - targetAspect) < 0.001) {
    return '50% 50%';
  }

  if (imageAspect > targetAspect) {
    const scale = imageAspect / targetAspect;
    const positionX = ((photo.focusX / 100 - 0.5 / scale) / (1 - 1 / scale)) * 100;
    return String(clampPercent(positionX)) + '% 50%';
  }

  const scale = targetAspect / imageAspect;
  const positionY = ((photo.focusY / 100 - 0.5 / scale) / (1 - 1 / scale)) * 100;
  return '50% ' + String(clampPercent(positionY)) + '%';
}

function getCompactSize(dockPosition: DockPosition) {
  return dockPosition === 'left' || dockPosition === 'right' ? { width: 52, height: 260 } : { width: 260, height: 52 };
}

function getPreferredPhotos(photos: IslandPhoto[], isSideDock: boolean, filterMode: PhotoFilterMode) {
  const preferredOrientation = filterMode === 'auto' ? (isSideDock ? 'portrait' : 'landscape') : filterMode;
  const preferred = photos.filter((photo) => photo.orientation === preferredOrientation);
  return preferred.length ? preferred : photos;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, input, textarea, select, a'));
}

export function DynamicIsland() {
  const [expanded, setExpanded] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [dockPosition, setDockPosition] = useState<DockPosition>('top');
  const [now, setNow] = useState(() => new Date());
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [themePreset, setThemePreset] = useState<ThemePreset>('default');
  const [photoFilterMode, setPhotoFilterMode] = useState<PhotoFilterMode>('auto');
  const [photoIntervalMs, setPhotoIntervalMs] = useState<PhotoIntervalMs>(10000);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [islandOpacity, setIslandOpacity] = useState(100);
  const [islandTint, setIslandTint] = useState('#111318');
  const [stickerOpacity, setStickerOpacity] = useState(60);
  const [wallpaperBlur, setWallpaperBlur] = useState(false);
  const [wallpaperFocus, setWallpaperFocus] = useState({ x: 50, y: 50 });
  const [floatingWallpaperFocus, setFloatingWallpaperFocus] = useState({ x: 50, y: 50 });
  const [videoWallpaper, setVideoWallpaper] = useState<VideoWallpaperState>(EMPTY_VIDEO_WALLPAPER);
  const [showWelcomeNotice, setShowWelcomeNotice] = useState(false);
  const [themeStickers, setThemeStickers] = useState<Record<ThemeStickerSlot, ThemeSticker | null>>({
    compact: null,
    dashboard: null,
    detail: null,
    sheet: null,
    pattern: null,
    floating: null,
  });
  const [reader, setReader] = useState<ReaderState>(EMPTY_READER);
  const [photos, setPhotos] = useState<IslandPhoto[]>([]);
  const [photoSizes, setPhotoSizes] = useState<Record<string, ImageSize>>({});
  const [photoIndex, setPhotoIndex] = useState(0);
  const [planReminder, setPlanReminder] = useState<PlanReminder | null>(null);
  const autoCollapseTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearAutoCollapseTimer = useCallback(() => {
    if (autoCollapseTimerRef.current !== null) {
      window.clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = null;
    }
  }, []);

  const closePanel = useCallback(() => {
    clearAutoCollapseTimer();
    setPlanReminder(null);
    setExpanded(false);
  }, [clearAutoCollapseTimer]);

  const resetIslandAutoCollapseTimer = useCallback(() => {
    if (!expanded || activeModule === 'calculator') return;
    clearAutoCollapseTimer();
    autoCollapseTimerRef.current = window.setTimeout(() => setExpanded(false), AUTO_COLLAPSE_TIMEOUT_MS);
  }, [activeModule, clearAutoCollapseTimer, expanded]);

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const current = new Date();
      setNow(current);
      timer = window.setTimeout(tick, 60_000 - current.getSeconds() * 1000 - current.getMilliseconds() + 50);
    };

    tick();
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.themePreset = themePreset;
  }, [themePreset]);

  useEffect(() => {
    document.documentElement.style.setProperty('--island-opacity', String(Math.min(100, Math.max(0, islandOpacity)) / 100));
  }, [islandOpacity]);

  useEffect(() => {
    document.documentElement.style.setProperty('--island-tint', islandTint);
  }, [islandTint]);

  useEffect(() => {
    document.documentElement.style.setProperty('--sticker-opacity', String(Math.min(100, Math.max(0, stickerOpacity)) / 100));
  }, [stickerOpacity]);

  useEffect(() => {
    document.documentElement.dataset.wallpaperBlur = wallpaperBlur ? 'on' : 'off';
  }, [wallpaperBlur]);

  useEffect(() => {
    document.documentElement.style.setProperty('--wallpaper-position', `${wallpaperFocus.x}% ${wallpaperFocus.y}%`);
  }, [wallpaperFocus]);

  useEffect(() => {
    if (showWelcomeNotice) {
      void window.islandApi?.resizeIsland('detail');
      clearAutoCollapseTimer();
      return;
    }

    if (planReminder) {
      void window.islandApi?.resizeIsland('reminder');
      clearAutoCollapseTimer();
      return;
    }

    if (!expanded) {
      void window.islandApi?.resizeIsland('compact');
      setActiveModule('dashboard');
      clearAutoCollapseTimer();
      return;
    }
    void window.islandApi?.resizeIsland(moduleSizes[activeModule].resizeKey);
    resetIslandAutoCollapseTimer();
  }, [activeModule, clearAutoCollapseTimer, expanded, planReminder, resetIslandAutoCollapseTimer, showWelcomeNotice]);

  useEffect(() => window.islandApi?.onAlwaysOnTopChanged(setAlwaysOnTop), []);
  useEffect(
    () =>
      window.islandApi?.onWindowBlur(() => {
        if (expanded && activeModule === 'calculator') return;
        closePanel();
      }),
    [activeModule, closePanel, expanded],
  );
  useEffect(
    () =>
      window.islandApi?.onForceCollapse(() => {
        if (activeModule === 'calculator') return;
        closePanel();
      }),
    [activeModule, closePanel],
  );
  useEffect(() => window.islandApi?.onDockPositionChanged(setDockPosition), []);
  useEffect(
    () =>
      window.dailyPlanAPI?.onReminderShow((reminder) => {
        clearAutoCollapseTimer();
        setExpanded(false);
        setActiveModule('dashboard');
        setPlanReminder(reminder);
      }),
    [clearAutoCollapseTimer],
  );
  useEffect(() => window.dailyPlanAPI?.onReminderHide(() => setPlanReminder(null)), []);

  useEffect(() => {
    void window.islandApi?.getDockPosition().then(setDockPosition);
    void window.islandApi?.getAppSettings().then((settings) => {
      setTheme(settings.theme);
      setThemePreset(settings.themePreset);
      setAlwaysOnTop(settings.alwaysOnTop);
      setIslandOpacity(settings.islandOpacity);
      setIslandTint(settings.islandTint);
      setStickerOpacity(settings.stickerOpacity);
      setWallpaperBlur(settings.wallpaperBlur);
      setWallpaperFocus({ x: settings.wallpaperFocusX, y: settings.wallpaperFocusY });
      setFloatingWallpaperFocus({ x: settings.floatingWallpaperFocusX, y: settings.floatingWallpaperFocusY });
      if (!settings.hasSeenWelcome) {
        setPlanReminder(null);
        setActiveModule('dashboard');
        setExpanded(true);
        setShowWelcomeNotice(true);
        void window.islandApi?.focusIsland();
      }
    });
    void window.islandApi?.getReaderState().then((state) => {
      setReader({ ...EMPTY_READER, ...state, position: clampPosition(state.position, state.text.length) });
    });
    void window.photoAPI?.getPhotos().then(setPhotos);
    void window.photoAPI?.getFilterMode().then(setPhotoFilterMode);
    void window.photoAPI?.getIntervalMs().then(setPhotoIntervalMs);
    void window.themeStickerAPI?.getTheme().then(setThemeStickers);
    void window.islandApi?.getVideoWallpaperState().then(setVideoWallpaper);
    const unsubscribeTheme = window.themeStickerAPI?.onThemeChanged(setThemeStickers);
    return () => {
      unsubscribeTheme?.();
    };
  }, []);

  const timeText = formatTime(now);
  const dateText = formatDate(now);
  const [compactHourText, compactMinuteText] = timeText.split(':');
  const readerProgress = getReaderProgress(reader);
  const activeSize = showWelcomeNotice ? welcomeSize : planReminder ? reminderSize : expanded ? moduleSizes[activeModule] : getCompactSize(dockPosition);
  const readerPageText = useMemo(() => (reader.text ? reader.text.slice(reader.position, reader.position + reader.charsPerPage).trim() : ''), [reader]);
  const statusText = getStatusText(activeModule, reader, readerProgress, photos);
  const isSideDock = dockPosition === 'left' || dockPosition === 'right';
  const carouselPhotos = useMemo(() => getPreferredPhotos(photos, isSideDock, photoFilterMode), [isSideDock, photoFilterMode, photos]);
  const carouselAspect = isSideDock ? VERTICAL_PHOTO_ASPECT : HORIZONTAL_PHOTO_ASPECT;
  const currentPhoto = carouselPhotos[photoIndex] ?? null;
  const activeStickerSlot: ThemeStickerSlot = !expanded ? 'compact' : activeModule === 'dashboard' ? 'dashboard' : 'detail';
  const stickerSheet = themeStickers.sheet;
  const stickerPattern = themeStickers.pattern;
  const stickerScatterPieces = useMemo(
    () => (stickerSheet ? getStickerScatterPieces(stickerSheet, activeStickerSlot) : []),
    [activeStickerSlot, stickerSheet],
  );

  useEffect(() => {
    if (carouselPhotos.length <= 1) return undefined;
    const timer = window.setInterval(() => setPhotoIndex((index) => (index + 1) % carouselPhotos.length), photoIntervalMs);
    return () => window.clearInterval(timer);
  }, [carouselPhotos.length, photoIntervalMs]);

  useEffect(() => {
    setPhotoIndex((index) => (carouselPhotos.length ? Math.min(index, carouselPhotos.length - 1) : 0));
  }, [carouselPhotos.length]);

  const persistReader = (nextReader: ReaderState) => {
    if (!nextReader.filePath) return;
    void window.islandApi?.saveReaderState({ filePath: nextReader.filePath, position: nextReader.position, charsPerPage: nextReader.charsPerPage });
  };

  const updateReader = (updater: (current: ReaderState) => ReaderState) => {
    setReader((current) => {
      const next = updater(current);
      persistReader(next);
      return next;
    });
  };

  const openReaderFile = async () => {
    const state = await window.islandApi?.openReaderFile();
    if (!state) return;
    setReader({ ...EMPTY_READER, ...state, position: clampPosition(state.position, state.text.length) });
    setActiveModule('reader');
    setExpanded(true);
  };

  const addPhotos = async () => {
    setPhotos(await window.photoAPI.addPhotos());
    setActiveModule('photos');
    setExpanded(true);
  };

  const deletePhoto = async (id: string) => {
    setPhotos(await window.photoAPI.deletePhoto(id));
  };

  const updatePhotoFocus = async (id: string, focus: { focusX: number; focusY: number }) => {
    setPhotos(await window.photoAPI.updatePhotoFocus(id, focus));
  };

  const updatePhotoOrientation = async (id: string, orientation: 'landscape' | 'portrait') => {
    setPhotos(await window.photoAPI.updatePhotoOrientation(id, orientation));
    setPhotoIndex(0);
  };

  const updatePhotoFilterMode = async (mode: PhotoFilterMode) => {
    setPhotoFilterMode(await window.photoAPI.updateFilterMode(mode));
    setPhotoIndex(0);
  };

  const updatePhotoIntervalMs = async (intervalMs: PhotoIntervalMs) => {
    setPhotoIntervalMs(await window.photoAPI.updateIntervalMs(intervalMs));
    setPhotoIndex(0);
  };

  const setThemeSticker = async (slot: ThemeStickerSlot) => {
    setThemeStickers(await window.themeStickerAPI.setSticker(slot));
  };

  const clearThemeSticker = async (slot: ThemeStickerSlot) => {
    setThemeStickers(await window.themeStickerAPI.clearSticker(slot));
  };

  const selectVideoWallpaper = async () => {
    const state = await window.islandApi?.selectVideoWallpaper();
    if (state) setVideoWallpaper(state);
  };

  const startVideoWallpaper = async () => {
    const state = await window.islandApi?.startVideoWallpaper();
    if (state) setVideoWallpaper(state);
  };

  const stopVideoWallpaper = async () => {
    const state = await window.islandApi?.stopVideoWallpaper();
    if (state) setVideoWallpaper(state);
  };

  const rememberPhotoSize = (id: string, size: ImageSize) => {
    setPhotoSizes((current) => {
      const previous = current[id];
      if (previous?.width === size.width && previous.height === size.height) return current;
      return { ...current, [id]: size };
    });
  };

  const previousPage = () => updateReader((current) => ({ ...current, position: clampPosition(current.position - current.charsPerPage, current.text.length) }));
  const nextPage = () => updateReader((current) => ({ ...current, position: clampPosition(current.position + current.charsPerPage, current.text.length) }));
  const changeCharsPerPage = (charsPerPage: number) => updateReader((current) => ({ ...current, charsPerPage, position: clampPosition(current.position, current.text.length) }));
  const goDashboard = () => setActiveModule('dashboard');

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    resetIslandAutoCollapseTimer();
    const canDragExpandedCalculator = expanded && activeModule === 'calculator' && !isInteractiveTarget(event.target);
    if ((!canDragExpandedCalculator && expanded) || event.button !== 0) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.screenX,
      startY: event.screenY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    resetIslandAutoCollapseTimer();
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.screenX - dragState.startX, event.screenY - dragState.startY);
    if (!dragState.dragging && distance >= DRAG_THRESHOLD) {
      dragState.dragging = true;
      clearAutoCollapseTimer();
    }

    if (dragState.dragging) {
      event.preventDefault();
      void window.islandApi?.dragIsland({ x: event.screenX, y: event.screenY });
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const wasDragging = dragState.dragging;
    dragStateRef.current = null;
    suppressNextClickRef.current = wasDragging;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (wasDragging && expanded && activeModule === 'calculator') {
      event.preventDefault();
      return;
    }

    if (wasDragging) {
      event.preventDefault();
      void window.islandApi?.snapIsland({ x: event.screenX, y: event.screenY }).then(setDockPosition);
    }
  };

  const renderExpandedContent = () => {
    if (activeModule === 'dashboard') {
      return (
        <Dashboard
          time={timeText}
          date={dateText}
          reader={reader}
          readerProgress={readerProgress}
          photos={photos}
          photoIntervalMs={photoIntervalMs}
          theme={theme}
          onOpenModule={setActiveModule}
        />
      );
    }
    if (activeModule === 'daily-plan') return <DailyPlanDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'reader') {
      return (
        <ReaderDetail
          reader={reader}
          readerPageText={readerPageText}
          readerProgress={readerProgress}
          onOpenReaderFile={openReaderFile}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
          onChangeCharsPerPage={changeCharsPerPage}
          onBack={goDashboard}
          onClose={closePanel}
        />
      );
    }
    if (activeModule === 'photos') {
      return (
        <PhotosDetail
          photos={photos}
          filterMode={photoFilterMode}
          intervalMs={photoIntervalMs}
          onAddPhotos={addPhotos}
          onDeletePhoto={deletePhoto}
          onUpdatePhotoFocus={updatePhotoFocus}
          onUpdatePhotoOrientation={updatePhotoOrientation}
          onUpdateFilterMode={updatePhotoFilterMode}
          onUpdateIntervalMs={updatePhotoIntervalMs}
          onBack={goDashboard}
          onClose={closePanel}
        />
      );
    }
    if (activeModule === 'work-countdown') return <WorkCountdownDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'calculator') return <CalculatorDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'password-vault') return <AccountVaultDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'file-namer') return <FileNamerDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'temp-clipboard') return <TempClipboardDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'author-support') return <AuthorSupportDetail onBack={goDashboard} onClose={closePanel} />;
    if (activeModule === 'personalization') {
      return (
        <PersonalizationDetail
          theme={theme}
          themePreset={themePreset}
          alwaysOnTop={alwaysOnTop}
          islandOpacity={islandOpacity}
          islandTint={islandTint}
          stickerOpacity={stickerOpacity}
          wallpaperBlur={wallpaperBlur}
          wallpaperFocus={wallpaperFocus}
          floatingWallpaperFocus={floatingWallpaperFocus}
          videoWallpaper={videoWallpaper}
          themeStickers={themeStickers}
          onSetTheme={(nextTheme) => {
            setTheme(nextTheme);
            setThemePreset('default');
            void window.islandApi?.setTheme(nextTheme);
            void window.islandApi?.setThemePreset('default');
          }}
          onSetThemePreset={(preset) => {
            setThemePreset(preset);
            void window.islandApi?.setThemePreset(preset);
            if (preset === 'kitty') {
              setTheme('light');
              setIslandTint('#f9a8d4');
              void window.islandApi?.setTheme('light');
              void window.islandApi?.setIslandTint('#f9a8d4');
            }
          }}
          onSetAlwaysOnTop={(enabled) => {
            setAlwaysOnTop(enabled);
            void window.islandApi?.setAlwaysOnTop(enabled);
          }}
          onSetIslandOpacity={(opacity) => {
            setIslandOpacity(opacity);
            void window.islandApi?.setIslandOpacity(opacity);
          }}
          onSetIslandTint={(tint) => {
            setIslandTint(tint);
            void window.islandApi?.setIslandTint(tint);
          }}
          onSetStickerOpacity={(opacity) => {
            setStickerOpacity(opacity);
            void window.islandApi?.setStickerOpacity(opacity);
          }}
          onSetWallpaperBlur={(enabled) => {
            setWallpaperBlur(enabled);
            void window.islandApi?.setWallpaperBlur(enabled);
          }}
          onSetWallpaperFocus={(focus) => {
            setWallpaperFocus(focus);
            void window.islandApi?.setWallpaperFocus(focus);
          }}
          onSetFloatingWallpaperFocus={(focus) => {
            setFloatingWallpaperFocus(focus);
            void window.islandApi?.setFloatingWallpaperFocus(focus);
          }}
          onSelectVideoWallpaper={() => {
            void selectVideoWallpaper();
          }}
          onStartVideoWallpaper={() => {
            void startVideoWallpaper();
          }}
          onStopVideoWallpaper={() => {
            void stopVideoWallpaper();
          }}
          onSetThemeSticker={(slot) => {
            void setThemeSticker(slot);
          }}
          onClearThemeSticker={(slot) => {
            void clearThemeSticker(slot);
          }}
          onBack={goDashboard}
          onClose={closePanel}
        />
      );
    }
    return <SettingsDetail onBack={goDashboard} onClose={closePanel} />;
  };

  const dismissPlanReminder = () => {
    setPlanReminder(null);
    void window.dailyPlanAPI?.dismissReminder();
  };

  const confirmPlanReminder = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dismissPlanReminder();
  };

  const acceptWelcomeNotice = () => {
    setShowWelcomeNotice(false);
    setExpanded(false);
    void window.islandApi?.markWelcomeSeen();
  };

  return (
    <section className="island-stage">
      <motion.div
        className={'island island-' + (planReminder ? 'reminder' : expanded ? 'expanded' : 'compact') + ' dock-' + dockPosition}
        tabIndex={expanded ? 0 : -1}
        initial={false}
        animate={{ width: activeSize.width, height: activeSize.height, borderRadius: planReminder ? 24 : expanded ? 28 : 999 }}
        transition={{ type: 'spring', stiffness: 520, damping: 42 }}
        whileHover={{ scale: expanded || planReminder || showWelcomeNotice ? 1 : 1.04 }}
        onPointerEnter={resetIslandAutoCollapseTimer}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={resetIslandAutoCollapseTimer}
        onKeyDown={resetIslandAutoCollapseTimer}
        onClick={() => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            return;
          }

          if (planReminder || showWelcomeNotice) {
            return;
          }

          if (!expanded) {
            setActiveModule('dashboard');
            setExpanded(true);
            void window.islandApi?.focusIsland();
          }
        }}
      >
        {stickerPattern && activeStickerSlot !== 'compact' && !planReminder ? (
          <div
            className={'theme-wallpaper theme-wallpaper-' + activeStickerSlot}
            style={{ backgroundImage: `url("${stickerPattern.url}")` }}
            aria-hidden="true"
          />
        ) : null}
        {stickerSheet && !planReminder ? (
          <div className={'theme-sticker-sheet theme-sticker-sheet-scatter theme-sticker-sheet-' + activeStickerSlot} aria-hidden="true">
            {stickerScatterPieces.map((piece, index, list) => (
              <img
                key={piece.url + String(index)}
                className="theme-sticker-piece"
                src={piece.url}
                alt=""
                style={getStickerPieceStyle(index, list.length, activeStickerSlot, 'width' in piece ? piece : undefined)}
                decoding="async"
                draggable={false}
              />
            ))}
          </div>
        ) : null}
        {themePreset === 'kitty' && !planReminder ? (
          <div className={'kitty-decor-layer kitty-decor-' + activeStickerSlot + (stickerSheet || stickerPattern ? ' has-sticker-sheet' : '')} aria-hidden="true">
            <span className="kitty-decor bow bow-main" />
            <span className="kitty-decor bow bow-small" />
            <span className="kitty-decor heart heart-a" />
            <span className="kitty-decor heart heart-b" />
            <span className="kitty-decor heart heart-c" />
            <span className="kitty-decor star star-a" />
            <span className="kitty-decor star star-b" />
            <span className="kitty-decor cloud cloud-a" />
            <span className="kitty-decor rainbow rainbow-a" />
            <span className="kitty-decor candy candy-a" />
            <span className="kitty-decor dot dot-a" />
            <span className="kitty-decor dot dot-b" />
          </div>
        ) : null}
        <AnimatePresence initial={false} mode="wait">
          {showWelcomeNotice ? (
            <motion.div
              key="welcome"
              className="expanded-panel"
              initial={{ opacity: 0, y: -6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.14 }}
              onClick={(event) => event.stopPropagation()}
            >
              <WelcomeNotice onAccept={acceptWelcomeNotice} />
            </motion.div>
          ) : !expanded ? (
            planReminder ? (
              <motion.div
                key="plan-reminder"
                className="plan-reminder-panel"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="plan-reminder-pill">
                  <span className="status-dot daily-plan" />
                  <strong className="clock">{timeText}</strong>
                  <span className="status-text">计划提醒</span>
                </div>
                <div className="plan-reminder-card">
                  <span className="plan-reminder-mark" aria-hidden="true" />
                  <span className="plan-reminder-copy">
                    <span className="plan-reminder-kicker">下一项计划</span>
                    <strong>{planReminder.text}</strong>
                  </span>
                  <button
                    type="button"
                    className="plan-reminder-confirm"
                    onPointerDown={confirmPlanReminder}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    aria-label="确认计划提醒"
                    title="确认"
                  >
                    ✓
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="compact"
                className={
                  'compact-row ' +
                  (currentPhoto ? 'has-photo' : '') +
                  ' ' +
                  (isSideDock ? 'compact-row-vertical' : '')
                }
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
              >
                <span className={'status-dot ' + activeModule} />
                {isSideDock ? (
                  <strong className="clock side-clock" aria-label={timeText}>
                    <span>{compactHourText}</span>
                    <span className="side-clock-colon">:</span>
                    <span>{compactMinuteText}</span>
                  </strong>
                ) : (
                  <strong className="clock">{timeText}</strong>
                )}
                <div className="compact-photo-carousel" aria-hidden="true">
                  <AnimatePresence mode="wait">
                    {currentPhoto ? (
                      <motion.img
                        key={currentPhoto.id}
                        src={currentPhoto.url}
                        alt=""
                        style={{ objectPosition: getCoverObjectPosition(currentPhoto, carouselAspect, photoSizes[currentPhoto.id]) }}
                        onLoad={(event) => {
                          rememberPhotoSize(currentPhoto.id, {
                            width: event.currentTarget.naturalWidth,
                            height: event.currentTarget.naturalHeight,
                          });
                        }}
                        initial={{ opacity: 0, scale: 1.015, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.995, filter: 'blur(2px)' }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      />
                    ) : null}
                  </AnimatePresence>
                </div>
                <span className="status-text">{statusText}</span>
              </motion.div>
            )
          ) : (
            <motion.div
              key={activeModule}
              className="expanded-panel"
              initial={{ opacity: 0, y: -5, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.995 }}
              transition={{ duration: 0.12 }}
              onClick={(event) => event.stopPropagation()}
            >
              {renderExpandedContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}



