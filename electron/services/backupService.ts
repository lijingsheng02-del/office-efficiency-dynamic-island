import fs from 'node:fs';
import path from 'node:path';

type BackupFile = {
  path: string;
  encoding: 'utf8' | 'base64';
  content: string;
};

type BackupManifest = {
  app: 'dynamic-island-electron';
  backupVersion: 1;
  appVersion: string;
  exportedAt: string;
  files: BackupFile[];
};

const backupFileNames = [
  'daily-plan-store.json',
  'reader-state.json',
  'photo-carousel-store.json',
  'theme-sticker-store.json',
  'island-dock-state.json',
  'app-settings.json',
  'work-countdown-store.json',
  'dashboard-module-order.json',
  'password-vault-store.json',
  'file-naming-store.json',
  'temp-clipboard-store.json',
];

const userDataPlaceholder = '__DYNAMIC_ISLAND_USER_DATA__';

function toSafeRelativePath(baseDir: string, filePath: string) {
  const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
  return relativePath;
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function collectFile(files: BackupFile[], userDataPath: string, filePath: string, encoding: BackupFile['encoding']) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return;
  const relativePath = toSafeRelativePath(userDataPath, filePath);
  if (!relativePath) return;

  files.push({
    path: relativePath,
    encoding,
    content: encoding === 'utf8' ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(filePath).toString('base64'),
  });
}

function collectDirectory(files: BackupFile[], userDataPath: string, dirPath: string) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return;

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectDirectory(files, userDataPath, entryPath);
    } else if (entry.isFile()) {
      collectFile(files, userDataPath, entryPath, 'base64');
    }
  }
}

function collectReaderSource(files: BackupFile[], userDataPath: string) {
  const readerState = readJsonFile<{ filePath?: unknown }>(path.join(userDataPath, 'reader-state.json'));
  const filePath = typeof readerState?.filePath === 'string' ? readerState.filePath : '';
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return;

  const backupName = path.basename(filePath).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const relativePath = `reader-files/${Date.now()}-${backupName}`;
  files.push({
    path: relativePath,
    encoding: 'base64',
    content: fs.readFileSync(filePath).toString('base64'),
  });

  const statePath = path.join(userDataPath, 'reader-state.json');
  const stateIndex = files.findIndex((file) => file.path === 'reader-state.json');
  if (stateIndex >= 0) {
    const parsed = readJsonFile<Record<string, unknown>>(statePath) ?? {};
    parsed.filePath = `${userDataPlaceholder}/${relativePath}`;
    files[stateIndex] = {
      path: 'reader-state.json',
      encoding: 'utf8',
      content: `${JSON.stringify(parsed, null, 2)}\n`,
    };
  }
}

function rewritePhotoStoreForExport(files: BackupFile[], userDataPath: string) {
  const storeIndex = files.findIndex((file) => file.path === 'photo-carousel-store.json');
  if (storeIndex < 0) return;

  try {
    const parsed = JSON.parse(files[storeIndex].content) as { photos?: Array<{ filePath?: unknown }> };
    if (Array.isArray(parsed.photos)) {
      parsed.photos = parsed.photos.map((photo) => {
        if (typeof photo.filePath !== 'string') return photo;
        const relativePath = toSafeRelativePath(userDataPath, photo.filePath);
        return relativePath ? { ...photo, filePath: `${userDataPlaceholder}/${relativePath}` } : photo;
      });
    }
    files[storeIndex] = {
      ...files[storeIndex],
      content: `${JSON.stringify(parsed, null, 2)}\n`,
    };
  } catch {
    return;
  }
}

function rewriteThemeStickerStoreForExport(files: BackupFile[], userDataPath: string) {
  const storeIndex = files.findIndex((file) => file.path === 'theme-sticker-store.json');
  if (storeIndex < 0) return;

  try {
    const parsed = JSON.parse(files[storeIndex].content) as { stickers?: Record<string, { filePath?: unknown }> };
    if (parsed.stickers && typeof parsed.stickers === 'object') {
      for (const sticker of Object.values(parsed.stickers)) {
        if (typeof sticker.filePath !== 'string') continue;
        const relativePath = toSafeRelativePath(userDataPath, sticker.filePath);
        if (relativePath) sticker.filePath = `${userDataPlaceholder}/${relativePath}`;
      }
    }
    files[storeIndex] = {
      ...files[storeIndex],
      content: `${JSON.stringify(parsed, null, 2)}\n`,
    };
  } catch {
    return;
  }
}

function restorePlaceholders(content: string, userDataPath: string) {
  return content.split(userDataPlaceholder).join(userDataPath.replace(/\\/g, '/'));
}

export class BackupService {
  constructor(
    private readonly userDataPath: string,
    private readonly appVersion: string,
  ) {}

  exportToFile(filePath: string) {
    const files: BackupFile[] = [];

    for (const fileName of backupFileNames) {
      collectFile(files, this.userDataPath, path.join(this.userDataPath, fileName), 'utf8');
    }

    collectDirectory(files, this.userDataPath, path.join(this.userDataPath, 'carousel-photos'));
    collectDirectory(files, this.userDataPath, path.join(this.userDataPath, 'theme-stickers'));
    collectReaderSource(files, this.userDataPath);
    rewritePhotoStoreForExport(files, this.userDataPath);
    rewriteThemeStickerStoreForExport(files, this.userDataPath);

    const manifest: BackupManifest = {
      app: 'dynamic-island-electron',
      backupVersion: 1,
      appVersion: this.appVersion,
      exportedAt: new Date().toISOString(),
      files,
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  importFromFile(filePath: string) {
    const manifest = readJsonFile<BackupManifest>(filePath);
    if (!manifest || manifest.app !== 'dynamic-island-electron' || !Array.isArray(manifest.files)) {
      throw new Error('Invalid backup file');
    }

    for (const fileName of backupFileNames) {
      fs.rmSync(path.join(this.userDataPath, fileName), { force: true });
    }
    fs.rmSync(path.join(this.userDataPath, 'carousel-photos'), { recursive: true, force: true });
    fs.rmSync(path.join(this.userDataPath, 'theme-stickers'), { recursive: true, force: true });
    fs.rmSync(path.join(this.userDataPath, 'reader-files'), { recursive: true, force: true });

    for (const file of manifest.files) {
      if (!file.path || (file.encoding !== 'utf8' && file.encoding !== 'base64')) {
        throw new Error('Invalid backup entry');
      }
      if (file.path === 'character-companion-store.json' || file.path.startsWith('character-companion/')) continue;

      const targetPath = path.resolve(this.userDataPath, file.path);
      if (!toSafeRelativePath(this.userDataPath, targetPath)) {
        throw new Error('Unsafe backup entry');
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (file.encoding === 'utf8') {
        fs.writeFileSync(targetPath, restorePlaceholders(file.content, this.userDataPath), 'utf8');
      } else {
        fs.writeFileSync(targetPath, Buffer.from(file.content, 'base64'));
      }
    }
  }
}
