import { nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type PhotoOrientation = 'landscape' | 'portrait';
export type PhotoFilterMode = 'auto' | 'landscape' | 'portrait';
export type PhotoIntervalMs = 10000 | 30000 | 60000 | 600000;

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
  orientation: PhotoOrientation;
};

type StoredPhoto = Omit<IslandPhoto, 'url'>;

type PhotoStoreShape = {
  photos: StoredPhoto[];
  filterMode: PhotoFilterMode;
  intervalMs: PhotoIntervalMs;
};

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeFilterMode(value: unknown): PhotoFilterMode {
  return value === 'landscape' || value === 'portrait' || value === 'auto' ? value : 'auto';
}

function normalizeIntervalMs(value: unknown): PhotoIntervalMs {
  return value === 30000 || value === 60000 || value === 600000 || value === 10000 ? value : 10000;
}

function getImageMeta(filePath: string) {
  const image = nativeImage.createFromPath(filePath);
  const size = image.getSize();
  const width = size.width > 0 ? size.width : 1;
  const height = size.height > 0 ? size.height : 1;

  return {
    width,
    height,
    orientation: height > width ? 'portrait' : 'landscape',
  } satisfies Pick<IslandPhoto, 'width' | 'height' | 'orientation'>;
}

function normalizeStoredPhoto(value: Partial<StoredPhoto>): StoredPhoto | null {
  if (!value.id || !value.filePath || !fs.existsSync(value.filePath)) return null;
  const meta =
    Number.isFinite(value.width) && Number.isFinite(value.height) && value.width && value.height
      ? {
          width: Number(value.width),
          height: Number(value.height),
          orientation:
            value.orientation === 'portrait' || value.orientation === 'landscape'
              ? value.orientation
              : value.height > value.width
                ? 'portrait'
                : 'landscape',
        } satisfies Pick<IslandPhoto, 'width' | 'height' | 'orientation'>
      : getImageMeta(value.filePath);

  return {
    id: value.id,
    filePath: value.filePath,
    name: value.name || path.basename(value.filePath),
    createdAt: value.createdAt || new Date().toISOString(),
    focusX: Number.isFinite(value.focusX) ? Math.min(100, Math.max(0, Number(value.focusX))) : 50,
    focusY: Number.isFinite(value.focusY) ? Math.min(100, Math.max(0, Number(value.focusY))) : 50,
    ...meta,
  };
}

export class PhotoStore {
  private readonly storePath: string;
  private readonly photoDir: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'photo-carousel-store.json');
    this.photoDir = path.join(userDataPath, 'carousel-photos');
  }

  getPhotos() {
    return this.loadStore().photos.map((photo) => this.toPayload(photo));
  }

  getFilterMode() {
    return this.loadStore().filterMode;
  }

  updateFilterMode(mode: PhotoFilterMode) {
    const store = this.loadStore();
    store.filterMode = normalizeFilterMode(mode);
    this.saveStore(store);
    return store.filterMode;
  }

  getIntervalMs() {
    return this.loadStore().intervalMs;
  }

  updateIntervalMs(intervalMs: PhotoIntervalMs) {
    const store = this.loadStore();
    store.intervalMs = normalizeIntervalMs(intervalMs);
    this.saveStore(store);
    return store.intervalMs;
  }

  addPhotos(filePaths: string[]) {
    const store = this.loadStore();
    fs.mkdirSync(this.photoDir, { recursive: true });

    const nextPhotos = filePaths
      .filter((filePath) => imageExtensions.has(path.extname(filePath).toLowerCase()))
      .filter((filePath) => fs.existsSync(filePath))
      .map((filePath) => {
        const id = createId();
        const ext = path.extname(filePath).toLowerCase();
        const destPath = path.join(this.photoDir, `${id}${ext}`);
        fs.copyFileSync(filePath, destPath);
        const meta = getImageMeta(destPath);

        return {
          id,
          filePath: destPath,
          name: path.basename(filePath),
          createdAt: new Date().toISOString(),
          focusX: 50,
          focusY: 50,
          ...meta,
        };
      });

    store.photos = [...store.photos, ...nextPhotos];
    this.saveStore(store);
    return this.getPhotos();
  }

  updatePhotoFocus(id: string, focus: { focusX: number; focusY: number }) {
    const store = this.loadStore();
    store.photos = store.photos.map((photo) => {
      if (photo.id !== id) return photo;
      return {
        ...photo,
        focusX: Math.min(100, Math.max(0, focus.focusX)),
        focusY: Math.min(100, Math.max(0, focus.focusY)),
      };
    });
    this.saveStore(store);
    return this.getPhotos();
  }

  updatePhotoOrientation(id: string, orientation: PhotoOrientation) {
    const nextOrientation = orientation === 'portrait' ? 'portrait' : 'landscape';
    const store = this.loadStore();
    store.photos = store.photos.map((photo) => {
      if (photo.id !== id) return photo;
      return {
        ...photo,
        orientation: nextOrientation,
        focusX: 50,
        focusY: 50,
      };
    });
    this.saveStore(store);
    return this.getPhotos();
  }

  deletePhoto(id: string) {
    const store = this.loadStore();
    const target = store.photos.find((photo) => photo.id === id);
    store.photos = store.photos.filter((photo) => photo.id !== id);

    if (target?.filePath && target.filePath.startsWith(this.photoDir)) {
      fs.rmSync(target.filePath, { force: true });
    }

    this.saveStore(store);
    return this.getPhotos();
  }

  private toPayload(photo: StoredPhoto): IslandPhoto {
    return {
      ...photo,
      url: pathToFileURL(photo.filePath).toString(),
    };
  }

  private loadStore(): PhotoStoreShape {
    if (!fs.existsSync(this.storePath)) {
      return { photos: [], filterMode: 'auto', intervalMs: 10000 };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<PhotoStoreShape>;
      return {
        filterMode: normalizeFilterMode(parsed.filterMode),
        intervalMs: normalizeIntervalMs(parsed.intervalMs),
        photos: Array.isArray(parsed.photos)
          ? parsed.photos.map((photo) => normalizeStoredPhoto(photo)).filter((photo): photo is StoredPhoto => Boolean(photo))
          : [],
      };
    } catch {
      return { photos: [], filterMode: 'auto', intervalMs: 10000 };
    }
  }

  private saveStore(store: PhotoStoreShape) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}
