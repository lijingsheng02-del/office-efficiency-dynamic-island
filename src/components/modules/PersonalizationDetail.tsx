import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ThemeMode, ThemePreset, ThemeSticker, ThemeStickerSlot } from '../DynamicIsland';
import { DetailShell } from './DetailShell';

type PersonalizationDetailProps = {
  theme: ThemeMode;
  themePreset: ThemePreset;
  alwaysOnTop: boolean;
  islandOpacity: number;
  islandTint: string;
  stickerOpacity: number;
  wallpaperBlur: boolean;
  wallpaperFocus: { x: number; y: number };
  floatingWallpaperFocus: { x: number; y: number };
  videoWallpaper: VideoWallpaperState;
  themeStickers: Record<ThemeStickerSlot, ThemeSticker | null>;
  onSetTheme: (theme: ThemeMode) => void;
  onSetThemePreset: (preset: ThemePreset) => void;
  onSetAlwaysOnTop: (enabled: boolean) => void;
  onSetIslandOpacity: (opacity: number) => void;
  onSetIslandTint: (tint: string) => void;
  onSetStickerOpacity: (opacity: number) => void;
  onSetWallpaperBlur: (enabled: boolean) => void;
  onSetWallpaperFocus: (focus: { x: number; y: number }) => void;
  onSetFloatingWallpaperFocus: (focus: { x: number; y: number }) => void;
  onSelectVideoWallpaper: () => void;
  onStartVideoWallpaper: () => void;
  onStopVideoWallpaper: () => void;
  onSetThemeSticker: (slot: ThemeStickerSlot) => void;
  onClearThemeSticker: (slot: ThemeStickerSlot) => void;
  onBack: () => void;
  onClose: () => void;
};

type VideoWallpaperState = {
  enabled: boolean;
  filePath: string;
  name: string;
  attachedToDesktop: boolean;
  lastError: string;
};

const TINT_PRESETS = [
  '#111318',
  '#1f2937',
  '#374151',
  '#f9a8d4',
  '#f0abfc',
  '#c4b5fd',
  '#93c5fd',
  '#7dd3fc',
  '#67e8f9',
  '#5eead4',
  '#99f6e4',
  '#86efac',
  '#bef264',
  '#fde68a',
  '#fdba74',
  '#fca5a5',
  '#fb7185',
  '#0f766e',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#be123c',
  '#c2410c',
  '#365314',
];

const STICKER_SLOTS: Array<{ slot: ThemeStickerSlot; title: string; description: string }> = [
  { slot: 'pattern', title: '照片壁纸背景', description: '上传一张照片，像手机壁纸一样铺满背景' },
  { slot: 'floating', title: '竖图浮窗壁纸', description: '上传竖图，专门用于临时剪贴板竖型浮窗' },
  { slot: 'sheet', title: '元素贴纸散落', description: '上传多元素贴纸图，自动拆分后叠加散落' },
];

const WALLPAPER_FRAME_ASPECT = 13 / 9;
const FLOATING_WALLPAPER_FRAME_ASPECT = 360 / 520;
const WALLPAPER_FRAME_SCALE = 0.96;

type PreviewSize = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getContainedImageRect(stageSize: PreviewSize, imageSize: PreviewSize) {
  if (!stageSize.width || !stageSize.height || !imageSize.width || !imageSize.height) {
    return { left: 0, top: 0, width: stageSize.width || 1, height: stageSize.height || 1 };
  }

  const scale = Math.min(stageSize.width / imageSize.width, stageSize.height / imageSize.height);
  const width = imageSize.width * scale;
  const height = imageSize.height * scale;
  return {
    left: (stageSize.width - width) / 2,
    top: (stageSize.height - height) / 2,
    width,
    height,
  };
}

function getWallpaperFrameMetrics(stageSize: PreviewSize, imageSize: PreviewSize, focus: { x: number; y: number }, aspect = WALLPAPER_FRAME_ASPECT) {
  const imageRect = getContainedImageRect(stageSize, imageSize);
  const maxFrameWidth = imageRect.width * WALLPAPER_FRAME_SCALE;
  const maxFrameHeight = imageRect.height * WALLPAPER_FRAME_SCALE;
  const frameWidth = Math.min(maxFrameWidth, maxFrameHeight * aspect);
  const frameHeight = frameWidth / aspect;
  const minLeft = imageRect.left;
  const maxLeft = imageRect.left + imageRect.width - frameWidth;
  const minTop = imageRect.top;
  const maxTop = imageRect.top + imageRect.height - frameHeight;
  const centerX = imageRect.left + (imageRect.width * focus.x) / 100;
  const centerY = imageRect.top + (imageRect.height * focus.y) / 100;
  const left = clamp(centerX - frameWidth / 2, minLeft, Math.max(minLeft, maxLeft));
  const top = clamp(centerY - frameHeight / 2, minTop, Math.max(minTop, maxTop));

  return {
    imageRect,
    frame: {
      left,
      top,
      width: frameWidth,
      height: frameHeight,
    },
  };
}

export function PersonalizationDetail({
  theme,
  themePreset,
  alwaysOnTop,
  islandOpacity,
  islandTint,
  stickerOpacity,
  wallpaperBlur,
  wallpaperFocus,
  floatingWallpaperFocus,
  videoWallpaper,
  themeStickers,
  onSetTheme,
  onSetThemePreset,
  onSetAlwaysOnTop,
  onSetIslandOpacity,
  onSetIslandTint,
  onSetStickerOpacity,
  onSetWallpaperBlur,
  onSetWallpaperFocus,
  onSetFloatingWallpaperFocus,
  onSelectVideoWallpaper,
  onStartVideoWallpaper,
  onStopVideoWallpaper,
  onSetThemeSticker,
  onClearThemeSticker,
  onBack,
  onClose,
}: PersonalizationDetailProps) {
  const [showPalette, setShowPalette] = useState(false);
  const [wallpaperImageSize, setWallpaperImageSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const [wallpaperStageSize, setWallpaperStageSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const [floatingWallpaperImageSize, setFloatingWallpaperImageSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const [floatingWallpaperStageSize, setFloatingWallpaperStageSize] = useState<PreviewSize>({ width: 0, height: 0 });
  const wallpaperStageRef = useRef<HTMLDivElement | null>(null);
  const floatingWallpaperStageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stage = wallpaperStageRef.current;
    if (!stage) return undefined;

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      setWallpaperStageSize({ width: rect.width, height: rect.height });
    };
    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [themeStickers.pattern?.url]);

  useEffect(() => {
    const stage = floatingWallpaperStageRef.current;
    if (!stage) return undefined;

    const syncSize = () => {
      const rect = stage.getBoundingClientRect();
      setFloatingWallpaperStageSize({ width: rect.width, height: rect.height });
    };
    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [themeStickers.floating?.url]);

  const setOpacity = (value: number) => onSetIslandOpacity(Math.min(100, Math.max(0, Math.round(value))));
  const setStickerOpacity = (value: number) => onSetStickerOpacity(Math.min(100, Math.max(0, Math.round(value))));
  const setTint = (value: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) onSetIslandTint(value.toLowerCase());
  };
  const updateFocusFromPointer = (
    event: PointerEvent<HTMLDivElement>,
    imageSize: PreviewSize,
    focus: { x: number; y: number },
    aspect: number,
    onUpdate: (focus: { x: number; y: number }) => void,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { imageRect, frame } = getWallpaperFrameMetrics(
      { width: rect.width, height: rect.height },
      imageSize,
      focus,
      aspect,
    );
    const frameCenterX = clamp(event.clientX - rect.left, imageRect.left + frame.width / 2, imageRect.left + imageRect.width - frame.width / 2);
    const frameCenterY = clamp(event.clientY - rect.top, imageRect.top + frame.height / 2, imageRect.top + imageRect.height - frame.height / 2);
    const x = ((frameCenterX - imageRect.left) / imageRect.width) * 100;
    const y = ((frameCenterY - imageRect.top) / imageRect.height) * 100;
    onUpdate({ x: Math.round(x), y: Math.round(y) });
  };

  const wallpaperFrameMetrics = getWallpaperFrameMetrics(wallpaperStageSize, wallpaperImageSize, wallpaperFocus);
  const floatingWallpaperFrameMetrics = getWallpaperFrameMetrics(
    floatingWallpaperStageSize,
    floatingWallpaperImageSize,
    floatingWallpaperFocus,
    FLOATING_WALLPAPER_FRAME_ASPECT,
  );

  return (
    <DetailShell title="个性化" onBack={onBack} onClose={onClose}>
      <section className="settings-detail-card">
        <span className="eyebrow">显示与窗口行为</span>
        <strong className="truncate">桌面灵动岛外观</strong>

        <div className="setting-row">
          <span className="truncate">主题</span>
          <div className="segmented">
            <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => onSetTheme('dark')}>
              深色
            </button>
            <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => onSetTheme('light')}>
              浅色
            </button>
          </div>
        </div>

        <div className="theme-preset-setting">
          <div>
            <span className="truncate">主题预设</span>
            <em>Kitty 粉白为非官方风格预设，不内置官方角色素材。</em>
          </div>
          <div className="theme-preset-row">
            <button type="button" className={themePreset === 'default' ? 'active' : ''} onClick={() => onSetThemePreset('default')}>
              默认
            </button>
            <button type="button" className={themePreset === 'kitty' ? 'active kitty' : 'kitty'} onClick={() => onSetThemePreset('kitty')}>
              Kitty 粉白
            </button>
          </div>
        </div>

        <label className="toggle-row">
          <input type="checkbox" checked={alwaysOnTop} onChange={(event) => onSetAlwaysOnTop(event.target.checked)} />
          <span className="truncate">窗口置顶</span>
        </label>

        <label className="opacity-setting">
          <span className="truncate">胶囊不透明度</span>
          <div>
            <input type="range" min="0" max="100" step="1" value={islandOpacity} onChange={(event) => setOpacity(Number(event.target.value))} />
            <input type="number" min="0" max="100" value={islandOpacity} onChange={(event) => setOpacity(Number(event.target.value))} />
            <em>%</em>
          </div>
        </label>

        <div className="color-setting">
          <div className="color-setting-head">
            <span className="truncate">胶囊颜色</span>
            <button type="button" onClick={() => setShowPalette((current) => !current)}>
              {showPalette ? '收起色卡' : '打开色卡'}
            </button>
          </div>
          <div className="color-picker-row">
            <input type="color" value={islandTint} onChange={(event) => setTint(event.target.value)} aria-label="选择胶囊颜色" />
            <input value={islandTint} onChange={(event) => setTint(event.target.value)} aria-label="胶囊颜色十六进制值" />
          </div>
          <p className="color-help">可以在浏览器搜索“颜色色号”或“hex color”，把喜欢的色号复制到这里替换。</p>
          {showPalette && (
            <div className="color-preset-row">
              {TINT_PRESETS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={islandTint === color ? 'active' : ''}
                  style={{ backgroundColor: color }}
                  aria-label={`使用颜色 ${color}`}
                  onClick={() => setTint(color)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="settings-detail-card">
        <span className="eyebrow">系统桌面壁纸</span>
        <strong className="truncate">电脑桌面视频壁纸</strong>
        <p className="settings-note">选择本地视频后，会创建一个静音循环播放窗口并尝试挂到 Windows 桌面图标后方。视频不复制到用户数据目录，只记录本地路径。</p>

        <div className="theme-sticker-setting">
          <div className="theme-sticker-copy">
            <strong className="truncate">{videoWallpaper.name || '未选择视频'}</strong>
            <span className="truncate">
              {videoWallpaper.enabled
                ? videoWallpaper.attachedToDesktop
                  ? '运行中：已挂到桌面层'
                  : '运行中：置底窗口模式'
                : videoWallpaper.filePath
                  ? '已选择，尚未启动'
                  : '支持 mp4、webm、mov、m4v、avi、mkv'}
            </span>
          </div>
          <div className="theme-sticker-actions">
            <button type="button" onClick={onSelectVideoWallpaper}>
              选择视频
            </button>
            <button type="button" disabled={!videoWallpaper.filePath || videoWallpaper.enabled} onClick={onStartVideoWallpaper}>
              启动
            </button>
            <button type="button" disabled={!videoWallpaper.enabled} onClick={onStopVideoWallpaper}>
              停止
            </button>
          </div>
        </div>
        {videoWallpaper.lastError ? <p className="settings-note warning-note">{videoWallpaper.lastError}</p> : null}
      </section>

      <section className="settings-detail-card">
        <span className="eyebrow">主图贴纸</span>
        <strong className="truncate">图片壁纸与元素散落</strong>
        <p className="settings-note">两个功能互相独立：照片壁纸背景会把一张图像手机壁纸一样铺满并柔化；元素贴纸散落会把多元素图拆成独立小贴纸再叠加到界面上。本地图片只保存在本机数据目录，分享安装包不会带走你的图片。</p>

        <label className="opacity-setting">
          <span className="truncate">贴纸透明度</span>
          <div>
            <input type="range" min="0" max="100" step="1" value={stickerOpacity} onChange={(event) => setStickerOpacity(Number(event.target.value))} />
            <input type="number" min="0" max="100" value={stickerOpacity} onChange={(event) => setStickerOpacity(Number(event.target.value))} />
            <em>%</em>
          </div>
        </label>

        <label className="toggle-row">
          <input type="checkbox" checked={wallpaperBlur} onChange={(event) => onSetWallpaperBlur(event.target.checked)} />
          <span className="truncate">照片壁纸柔化</span>
        </label>

        <div className="wallpaper-focus-setting">
          <span className="truncate">壁纸取景区域</span>
          {themeStickers.pattern ? (
            <div className="wallpaper-focus-picker">
              <div
                ref={wallpaperStageRef}
                className="wallpaper-focus-image-stage"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateFocusFromPointer(event, wallpaperImageSize, wallpaperFocus, WALLPAPER_FRAME_ASPECT, onSetWallpaperFocus);
                }}
                onPointerMove={(event) => {
                  if (event.buttons === 1) updateFocusFromPointer(event, wallpaperImageSize, wallpaperFocus, WALLPAPER_FRAME_ASPECT, onSetWallpaperFocus);
                }}
              >
                <img
                  src={themeStickers.pattern.url}
                  alt=""
                  draggable={false}
                  onLoad={(event) => {
                    setWallpaperImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                />
                <span
                  className="wallpaper-focus-frame"
                  style={{
                    left: `${wallpaperFrameMetrics.frame.left}px`,
                    top: `${wallpaperFrameMetrics.frame.top}px`,
                    width: `${wallpaperFrameMetrics.frame.width}px`,
                    height: `${wallpaperFrameMetrics.frame.height}px`,
                  }}
                  aria-hidden="true"
                />
              </div>
              <span className="settings-note">图片保持完整显示，拖动白框选择最终要展示的画面。使用 16:9 比例的照片会更清晰。</span>
            </div>
          ) : (
            <p className="settings-note">先上传照片壁纸背景，再拖动图片内部的白色取景框选择展示区域。</p>
          )}
        </div>

        <div className="wallpaper-focus-setting">
          <span className="truncate">竖图浮窗取景区域</span>
          {themeStickers.floating ? (
            <div className="wallpaper-focus-picker floating-wallpaper-focus-picker">
              <div
                ref={floatingWallpaperStageRef}
                className="wallpaper-focus-image-stage floating-wallpaper-focus-stage"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateFocusFromPointer(
                    event,
                    floatingWallpaperImageSize,
                    floatingWallpaperFocus,
                    FLOATING_WALLPAPER_FRAME_ASPECT,
                    onSetFloatingWallpaperFocus,
                  );
                }}
                onPointerMove={(event) => {
                  if (event.buttons !== 1) return;
                  updateFocusFromPointer(
                    event,
                    floatingWallpaperImageSize,
                    floatingWallpaperFocus,
                    FLOATING_WALLPAPER_FRAME_ASPECT,
                    onSetFloatingWallpaperFocus,
                  );
                }}
              >
                <img
                  src={themeStickers.floating.url}
                  alt=""
                  draggable={false}
                  onLoad={(event) => {
                    setFloatingWallpaperImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                />
                <span
                  className="wallpaper-focus-frame"
                  style={{
                    left: `${floatingWallpaperFrameMetrics.frame.left}px`,
                    top: `${floatingWallpaperFrameMetrics.frame.top}px`,
                    width: `${floatingWallpaperFrameMetrics.frame.width}px`,
                    height: `${floatingWallpaperFrameMetrics.frame.height}px`,
                  }}
                  aria-hidden="true"
                />
              </div>
              <span className="settings-note">这是临时剪贴板竖型浮窗专用取景框，建议使用竖图会更清晰。</span>
            </div>
          ) : (
            <p className="settings-note">先上传竖图浮窗壁纸，再拖动白色取景框选择浮窗显示区域。</p>
          )}
        </div>

        <div className="theme-sticker-settings">
          {STICKER_SLOTS.map(({ slot, title, description }) => {
            const sticker = themeStickers[slot];
            return (
              <div className="theme-sticker-setting" key={slot}>
                <div className="theme-sticker-preview">
                  {sticker ? <img src={sticker.url} alt="" /> : <span>未设置</span>}
                </div>
                <div className="theme-sticker-copy">
                  <strong className="truncate">{title}</strong>
                  <span className="truncate">{sticker?.name || description}</span>
                </div>
                <div className="theme-sticker-actions">
                  <button type="button" onClick={() => onSetThemeSticker(slot)}>
                    选择
                  </button>
                  <button type="button" disabled={!sticker} onClick={() => onClearThemeSticker(slot)}>
                    清除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </DetailShell>
  );
}
