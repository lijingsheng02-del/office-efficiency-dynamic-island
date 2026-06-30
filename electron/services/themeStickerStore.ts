import { nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type ThemeStickerSlot = 'compact' | 'dashboard' | 'detail' | 'sheet' | 'pattern' | 'floating';

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

type StoredThemeStickerPiece = Omit<ThemeStickerPiece, 'url'>;
type StoredThemeSticker = Omit<ThemeSticker, 'url' | 'pieces'> & {
  pieces: StoredThemeStickerPiece[];
};

type ThemeStickerStoreShape = {
  stickers: Partial<Record<ThemeStickerSlot, StoredThemeSticker>>;
};

const slots: ThemeStickerSlot[] = ['compact', 'dashboard', 'detail', 'sheet', 'pattern', 'floating'];
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const maxPieces = 36;

function removeNearWhiteBackground(filePath: string) {
  const image = nativeImage.createFromPath(filePath);
  const size = image.getSize();
  if (size.width <= 0 || size.height <= 0) return fs.readFileSync(filePath);

  const bitmap = Buffer.from(image.toBitmap());
  const pixelCount = size.width * size.height;
  const visited = new Uint8Array(pixelCount);
  const queue: number[] = [];

  const isRemovableBackground = (pixelIndex: number) => {
    const index = pixelIndex * 4;
    const blue = bitmap[index] ?? 0;
    const green = bitmap[index + 1] ?? 0;
    const red = bitmap[index + 2] ?? 0;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max - min;
    return max > 218 && saturation < 30;
  };

  const enqueue = (pixelIndex: number) => {
    if (pixelIndex < 0 || pixelIndex >= pixelCount || visited[pixelIndex] || !isRemovableBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < size.width; x += 1) {
    enqueue(x);
    enqueue((size.height - 1) * size.width + x);
  }

  for (let y = 0; y < size.height; y += 1) {
    enqueue(y * size.width);
    enqueue(y * size.width + size.width - 1);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pixelIndex = queue[cursor];
    const x = pixelIndex % size.width;
    const y = Math.floor(pixelIndex / size.width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < size.width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - size.width);
    if (y < size.height - 1) enqueue(pixelIndex + size.width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;
    const index = pixelIndex * 4;
    bitmap[index + 3] = 0;

    const x = pixelIndex % size.width;
    const y = Math.floor(pixelIndex / size.width);
    const neighbors = [
      x > 0 ? pixelIndex - 1 : -1,
      x < size.width - 1 ? pixelIndex + 1 : -1,
      y > 0 ? pixelIndex - size.width : -1,
      y < size.height - 1 ? pixelIndex + size.width : -1,
    ];

    for (const neighbor of neighbors) {
      if (neighbor < 0 || visited[neighbor]) continue;
      const neighborIndex = neighbor * 4;
      const alpha = bitmap[neighborIndex + 3] ?? 255;
      if (isRemovableBackground(neighbor)) {
        bitmap[neighborIndex + 3] = Math.round(alpha * 0.22);
      }
    }
  }

  return nativeImage.createFromBitmap(bitmap, { width: size.width, height: size.height }).toPNG();
}

function readPngBitmap(filePath: string) {
  const image = nativeImage.createFromPath(filePath);
  const size = image.getSize();
  if (size.width <= 0 || size.height <= 0) return null;
  return {
    width: size.width,
    height: size.height,
    bitmap: Buffer.from(image.toBitmap()),
  };
}

function cropBitmap(source: Buffer, sourceWidth: number, box: { x: number; y: number; width: number; height: number }) {
  const cropped = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    const sourceStart = ((box.y + y) * sourceWidth + box.x) * 4;
    const targetStart = y * box.width * 4;
    source.copy(cropped, targetStart, sourceStart, sourceStart + box.width * 4);
  }
  return cropped;
}

function splitStickerPieces(filePath: string, slotDir: string): StoredThemeStickerPiece[] {
  const image = readPngBitmap(filePath);
  if (!image) return [];

  fs.rmSync(slotDir, { recursive: true, force: true });
  fs.mkdirSync(slotDir, { recursive: true });

  const pixelCount = image.width * image.height;
  const visited = new Uint8Array(pixelCount);
  const boxes: Array<{ x: number; y: number; width: number; height: number; area: number }> = [];
  const queue: number[] = [];
  const minArea = Math.max(140, Math.round(pixelCount * 0.00028));

  const isSolid = (pixelIndex: number) => (image.bitmap[pixelIndex * 4 + 3] ?? 0) > 24;

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || !isSolid(start)) continue;
    visited[start] = 1;
    queue.length = 0;
    queue.push(start);

    let minX = start % image.width;
    let maxX = minX;
    let minY = Math.floor(start / image.width);
    let maxY = minY;
    let area = 0;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixelIndex = queue[cursor];
      const x = pixelIndex % image.width;
      const y = Math.floor(pixelIndex / image.width);
      area += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < image.width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - image.width : -1,
        y < image.height - 1 ? pixelIndex + image.width : -1,
        x > 0 && y > 0 ? pixelIndex - image.width - 1 : -1,
        x < image.width - 1 && y > 0 ? pixelIndex - image.width + 1 : -1,
        x > 0 && y < image.height - 1 ? pixelIndex + image.width - 1 : -1,
        x < image.width - 1 && y < image.height - 1 ? pixelIndex + image.width + 1 : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || visited[neighbor] || !isSolid(neighbor)) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const padding = 4;
    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const width = Math.min(image.width - x, maxX - minX + 1 + padding * 2);
    const height = Math.min(image.height - y, maxY - minY + 1 + padding * 2);
    if (area >= minArea && width >= 14 && height >= 14) {
      boxes.push({ x, y, width, height, area });
    }
  }

  return boxes
    .sort((a, b) => b.area - a.area)
    .slice(0, maxPieces)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((box, index) => {
      const filePath = path.join(slotDir, `${String(index).padStart(2, '0')}.png`);
      const cropped = cropBitmap(image.bitmap, image.width, box);
      fs.writeFileSync(filePath, nativeImage.createFromBitmap(cropped, { width: box.width, height: box.height }).toPNG());
      return { filePath, width: box.width, height: box.height };
    });
}

function normalizeSlot(value: unknown): ThemeStickerSlot | null {
  return value === 'compact' || value === 'dashboard' || value === 'detail' || value === 'sheet' || value === 'pattern' || value === 'floating'
    ? value
    : null;
}

function normalizeSticker(value: Partial<StoredThemeSticker>, slot: ThemeStickerSlot, stickerDir: string): StoredThemeSticker | null {
  if (!value.filePath || !fs.existsSync(value.filePath)) return null;
  let normalizedPath = value.filePath;
  try {
    fs.mkdirSync(stickerDir, { recursive: true });
    const pngPath = path.join(stickerDir, `${slot}.png`);
    if (slot === 'pattern' || slot === 'floating') {
      fs.copyFileSync(value.filePath, pngPath);
    } else {
      fs.writeFileSync(pngPath, removeNearWhiteBackground(value.filePath));
    }
    if (value.filePath !== pngPath && value.filePath.startsWith(stickerDir)) {
      fs.rmSync(value.filePath, { force: true });
    }
    normalizedPath = pngPath;
  } catch {
    return null;
  }
  return {
    slot,
    filePath: normalizedPath,
    name: value.name || path.basename(normalizedPath),
    updatedAt: value.updatedAt || new Date().toISOString(),
    pieces: slot === 'pattern' || slot === 'floating' ? [] : splitStickerPieces(normalizedPath, path.join(stickerDir, `${slot}-pieces`)),
  };
}

export class ThemeStickerStore {
  private readonly storePath: string;
  private readonly stickerDir: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'theme-sticker-store.json');
    this.stickerDir = path.join(userDataPath, 'theme-stickers');
  }

  getTheme() {
    const store = this.loadStore();
    return Object.fromEntries(slots.map((slot) => [slot, store.stickers[slot] ? this.toPayload(store.stickers[slot]) : null])) as Record<
      ThemeStickerSlot,
      ThemeSticker | null
    >;
  }

  setSticker(slot: ThemeStickerSlot, filePath: string) {
    const nextSlot = normalizeSlot(slot);
    if (!nextSlot) return this.getTheme();

    const sourceExt = path.extname(filePath).toLowerCase();
    if (!imageExtensions.has(sourceExt) || !fs.existsSync(filePath)) return this.getTheme();

    const store = this.loadStore();
    fs.mkdirSync(this.stickerDir, { recursive: true });
    let readableSource = filePath;
    let tempSource: string | null = null;
    if (path.resolve(filePath).startsWith(path.resolve(this.stickerDir))) {
      tempSource = path.join(this.stickerDir, `${nextSlot}-source-${Date.now()}${sourceExt}`);
      fs.copyFileSync(filePath, tempSource);
      readableSource = tempSource;
    }
    this.removeSlotFile(store.stickers[nextSlot]);

    const destPath = path.join(this.stickerDir, `${nextSlot}.png`);
    if (nextSlot === 'pattern' || nextSlot === 'floating') {
      fs.copyFileSync(readableSource, destPath);
    } else {
      fs.writeFileSync(destPath, removeNearWhiteBackground(readableSource));
    }
    if (tempSource) fs.rmSync(tempSource, { force: true });
    store.stickers[nextSlot] = {
      slot: nextSlot,
      filePath: destPath,
      name: path.basename(filePath),
      updatedAt: new Date().toISOString(),
      pieces: nextSlot === 'pattern' || nextSlot === 'floating' ? [] : splitStickerPieces(destPath, path.join(this.stickerDir, `${nextSlot}-pieces`)),
    };
    this.saveStore(store);
    return this.getTheme();
  }

  clearSticker(slot: ThemeStickerSlot) {
    const nextSlot = normalizeSlot(slot);
    if (!nextSlot) return this.getTheme();

    const store = this.loadStore();
    this.removeSlotFile(store.stickers[nextSlot]);
    delete store.stickers[nextSlot];
    this.saveStore(store);
    return this.getTheme();
  }

  private removeSlotFile(sticker: StoredThemeSticker | undefined) {
    if (sticker?.filePath && sticker.filePath.startsWith(this.stickerDir)) {
      fs.rmSync(sticker.filePath, { force: true });
    }
    if (sticker?.pieces?.length) {
      for (const piece of sticker.pieces) {
        if (piece.filePath.startsWith(this.stickerDir)) fs.rmSync(piece.filePath, { force: true });
      }
    }
    fs.rmSync(path.join(this.stickerDir, `${sticker?.slot ?? ''}-pieces`), { recursive: true, force: true });
  }

  private toPayload(sticker: StoredThemeSticker): ThemeSticker {
    const version = encodeURIComponent(sticker.updatedAt);
    return {
      ...sticker,
      url: `${pathToFileURL(sticker.filePath).toString()}?v=${version}`,
      pieces: (sticker.pieces ?? []).map((piece) => ({
        ...piece,
        url: `${pathToFileURL(piece.filePath).toString()}?v=${version}`,
      })),
    };
  }

  private loadStore(): ThemeStickerStoreShape {
    if (!fs.existsSync(this.storePath)) return { stickers: {} };

    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<ThemeStickerStoreShape>;
      const stickers: Partial<Record<ThemeStickerSlot, StoredThemeSticker>> = {};
      let changed = false;
      for (const slot of slots) {
        const rawSticker = (parsed.stickers?.[slot] ?? {}) as Partial<StoredThemeSticker>;
        const sticker = normalizeSticker(rawSticker, slot, this.stickerDir);
        if (sticker) {
          stickers[slot] = sticker;
          changed ||= sticker.filePath !== rawSticker.filePath || sticker.name !== rawSticker.name || sticker.updatedAt !== rawSticker.updatedAt;
        } else if (rawSticker.filePath) {
          changed = true;
        }
      }
      const store = { stickers };
      if (changed) this.saveStore(store);
      return store;
    } catch {
      return { stickers: {} };
    }
  }

  private saveStore(store: ThemeStickerStoreShape) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}
