import { useState, type MouseEvent } from 'react';
import type { IslandPhoto, PhotoFilterMode, PhotoIntervalMs } from '../DynamicIsland';
import { DetailShell } from './DetailShell';

type PhotosDetailProps = {
  photos: IslandPhoto[];
  filterMode: PhotoFilterMode;
  intervalMs: PhotoIntervalMs;
  onAddPhotos: () => void;
  onDeletePhoto: (id: string) => void;
  onUpdatePhotoFocus: (id: string, focus: { focusX: number; focusY: number }) => void;
  onUpdatePhotoOrientation: (id: string, orientation: 'landscape' | 'portrait') => void;
  onUpdateFilterMode: (mode: PhotoFilterMode) => void;
  onUpdateIntervalMs: (intervalMs: PhotoIntervalMs) => void;
  onBack: () => void;
  onClose: () => void;
};

type ImageSize = {
  width: number;
  height: number;
};

const HORIZONTAL_CAROUSEL_ASPECT = 52 / 30;
const VERTICAL_CAROUSEL_ASPECT = 30 / 52;
const PREVIEW_ASPECT = 16 / 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTargetAspect(photo: IslandPhoto) {
  return photo.orientation === 'portrait' ? VERTICAL_CAROUSEL_ASPECT : HORIZONTAL_CAROUSEL_ASPECT;
}

function getCropSize(size: ImageSize | null, targetAspect: number) {
  if (!size?.width || !size.height) {
    return { width: 42, height: 42 / targetAspect };
  }

  const imageAspect = size.width / size.height;
  if (imageAspect > targetAspect) {
    return {
      width: (targetAspect / imageAspect) * 100,
      height: 100,
    };
  }

  return {
    width: 100,
    height: (imageAspect / targetAspect) * 100,
  };
}

function clampFocus(focus: { focusX: number; focusY: number }, crop: { width: number; height: number }) {
  return {
    focusX: clamp(focus.focusX, crop.width / 2, 100 - crop.width / 2),
    focusY: clamp(focus.focusY, crop.height / 2, 100 - crop.height / 2),
  };
}

function PhotoTile({
  photo,
  onDeletePhoto,
  onUpdatePhotoFocus,
  onUpdatePhotoOrientation,
}: {
  photo: IslandPhoto;
  onDeletePhoto: (id: string) => void;
  onUpdatePhotoFocus: (id: string, focus: { focusX: number; focusY: number }) => void;
  onUpdatePhotoOrientation: (id: string, orientation: 'landscape' | 'portrait') => void;
}) {
  const [loadedSize, setLoadedSize] = useState<ImageSize | null>(null);
  const imageSize = loadedSize ?? { width: photo.width || 1, height: photo.height || 1 };
  const targetAspect = getTargetAspect(photo);
  const crop = getCropSize(imageSize, targetAspect);
  const frameFocus = clampFocus({ focusX: photo.focusX, focusY: photo.focusY }, crop);
  const imageAspect = imageSize.width / imageSize.height || PREVIEW_ASPECT;
  const imageBoxClass = imageAspect > PREVIEW_ASPECT ? 'photo-image-box wide' : 'photo-image-box tall';

  const updateFocusFromClick = (event: MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextFocus = clampFocus(
      {
        focusX: ((event.clientX - rect.left) / rect.width) * 100,
        focusY: ((event.clientY - rect.top) / rect.height) * 100,
      },
      crop,
    );
    onUpdatePhotoFocus(photo.id, nextFocus);
  };

  return (
    <figure className="photo-tile">
      <button type="button" className="photo-preview-button" aria-label={`设置 ${photo.name} 的轮播取景区域`}>
        <span className={imageBoxClass} style={{ aspectRatio: `${imageAspect}` }} onClick={updateFocusFromClick}>
          <img
            src={photo.url}
            alt={photo.name}
            onLoad={(event) => {
              setLoadedSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />
          <span
            className="photo-focus-frame"
            style={{
              left: `${frameFocus.focusX}%`,
              top: `${frameFocus.focusY}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
            }}
          />
        </span>
      </button>

      <div className="photo-orientation-switch" aria-label="单张照片取景类型">
        <button
          type="button"
          className={photo.orientation === 'landscape' ? 'active landscape' : 'landscape'}
          onClick={() => onUpdatePhotoOrientation(photo.id, 'landscape')}
        >
          横图
        </button>
        <button
          type="button"
          className={photo.orientation === 'portrait' ? 'active portrait' : 'portrait'}
          onClick={() => onUpdatePhotoOrientation(photo.id, 'portrait')}
        >
          竖图
        </button>
      </div>

      <button
        type="button"
        className="photo-delete-button"
        aria-label="删除照片"
        onClick={(event) => {
          event.stopPropagation();
          onDeletePhoto(photo.id);
        }}
      >
        X
      </button>
      <figcaption>{photo.name}</figcaption>
    </figure>
  );
}

export function PhotosDetail({
  photos,
  filterMode,
  intervalMs,
  onAddPhotos,
  onDeletePhoto,
  onUpdatePhotoFocus,
  onUpdatePhotoOrientation,
  onUpdateFilterMode,
  onUpdateIntervalMs,
  onBack,
  onClose,
}: PhotosDetailProps) {
  const landscapeCount = photos.filter((photo) => photo.orientation === 'landscape').length;
  const portraitCount = photos.filter((photo) => photo.orientation === 'portrait').length;

  return (
    <DetailShell title="照片轮播" onBack={onBack} onClose={onClose}>
      <section className="photos-detail">
        <div className="photos-toolbar">
          <div>
            <span className="eyebrow">取景设置</span>
            <strong>{photos.length} 张照片</strong>
          </div>
          <button type="button" className="small-action" onClick={onAddPhotos}>
            添加照片
          </button>
        </div>

        <p className="photo-help">每张照片都可以手动切换横图或竖图；白色取景框内就是胶囊最终显示的画面。</p>

        <div className="photo-setting-block">
          <span className="muted-text">轮播筛选</span>
          <div className="photo-filter-row" role="group" aria-label="照片轮播筛选">
            <button type="button" className={filterMode === 'auto' ? 'active' : ''} onClick={() => onUpdateFilterMode('auto')}>
              自动
            </button>
            <button type="button" className={filterMode === 'landscape' ? 'active' : ''} onClick={() => onUpdateFilterMode('landscape')}>
              横图
            </button>
            <button type="button" className={filterMode === 'portrait' ? 'active' : ''} onClick={() => onUpdateFilterMode('portrait')}>
              竖图
            </button>
          </div>
        </div>

        <div className="photo-setting-block">
          <span className="muted-text">切换时间</span>
          <div className="photo-interval-row" role="group" aria-label="照片轮播切换时间">
            <button type="button" className={intervalMs === 10000 ? 'active' : ''} onClick={() => onUpdateIntervalMs(10000)}>
              10秒
            </button>
            <button type="button" className={intervalMs === 30000 ? 'active' : ''} onClick={() => onUpdateIntervalMs(30000)}>
              30秒
            </button>
            <button type="button" className={intervalMs === 60000 ? 'active' : ''} onClick={() => onUpdateIntervalMs(60000)}>
              1分钟
            </button>
            <button type="button" className={intervalMs === 600000 ? 'active' : ''} onClick={() => onUpdateIntervalMs(600000)}>
              10分钟
            </button>
          </div>
        </div>

        {photos.length > 0 ? (
          <div className="photo-summary">
            <span>横图 {landscapeCount}</span>
            <span>竖图 {portraitCount}</span>
          </div>
        ) : null}

        {photos.length === 0 ? (
          <div className="photo-empty">
            <strong>还没有照片</strong>
            <span>添加后可以逐张设置横图或竖图取景。</span>
          </div>
        ) : (
          <div className="photo-grid">
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                onDeletePhoto={onDeletePhoto}
                onUpdatePhotoFocus={onUpdatePhotoFocus}
                onUpdatePhotoOrientation={onUpdatePhotoOrientation}
              />
            ))}
          </div>
        )}
      </section>
    </DetailShell>
  );
}
