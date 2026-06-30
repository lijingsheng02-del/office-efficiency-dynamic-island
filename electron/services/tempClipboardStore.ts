import fs from 'node:fs';
import path from 'node:path';

export type TempClipboardMode = 'normal' | 'capture' | 'paste';
export type TempClipboardEntryType = 'text' | 'image';

export type TempClipboardEntry = {
  id: string;
  type: TempClipboardEntryType;
  preview: string;
  text?: string;
  imageDataUrl?: string;
  createdAt: string;
  expiresAt: string;
};

export type TempClipboardShortcuts = {
  captureMode: string;
  captureCopy: string;
  normalMode: string;
  pasteMode: string;
  pasteNext: string;
};

export type TempClipboardState = {
  mode: TempClipboardMode;
  entries: TempClipboardEntry[];
  pasteIndex: number;
  shortcuts: TempClipboardShortcuts;
  pastedHistory: TempClipboardEntry[];
};

const DEFAULT_SHORTCUTS: TempClipboardShortcuts = {
  captureMode: 'CommandOrControl+Alt+1',
  captureCopy: 'CommandOrControl+Alt+C',
  normalMode: 'CommandOrControl+Alt+2',
  pasteMode: 'CommandOrControl+Alt+3',
  pasteNext: 'CommandOrControl+Alt+V',
};

const TTL_MS = 60 * 60 * 1000;

function createId() {
  return `clip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanShortcut(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeMode(value: unknown): TempClipboardMode {
  return value === 'capture' || value === 'paste' ? value : 'normal';
}

function normalizeEntry(value: Partial<TempClipboardEntry> | null | undefined): TempClipboardEntry | null {
  const type = value?.type === 'image' ? 'image' : value?.type === 'text' ? 'text' : null;
  if (!type) return null;
  const createdAt = typeof value?.createdAt === 'string' ? value.createdAt : new Date().toISOString();
  const expiresAt = typeof value?.expiresAt === 'string' ? value.expiresAt : new Date(Date.now() + TTL_MS).toISOString();
  const preview = typeof value?.preview === 'string' ? value.preview.slice(0, 500) : type === 'image' ? '图片' : '';
  const text = typeof value?.text === 'string' ? value.text : undefined;
  const imageDataUrl = typeof value?.imageDataUrl === 'string' ? value.imageDataUrl : undefined;
  if (type === 'text' && !text) return null;
  if (type === 'image' && !imageDataUrl) return null;
  return {
    id: typeof value?.id === 'string' ? value.id : createId(),
    type,
    preview,
    text,
    imageDataUrl,
    createdAt,
    expiresAt,
  };
}

export class TempClipboardStore {
  private readonly storePath: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'temp-clipboard-store.json');
  }

  getState() {
    const state = this.loadState();
    const cleaned = this.removeExpired(state);
    if (cleaned.entries.length !== state.entries.length) this.saveState(cleaned);
    return cleaned;
  }

  setMode(mode: TempClipboardMode) {
    const state = this.getState();
    const nextState = { ...state, mode: normalizeMode(mode) };
    this.saveState(nextState);
    return nextState;
  }

  addEntry(entry: Pick<TempClipboardEntry, 'type' | 'preview' | 'text' | 'imageDataUrl'>) {
    const state = this.getState();
    const now = Date.now();
    const nextEntry = normalizeEntry({
      ...entry,
      id: createId(),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + TTL_MS).toISOString(),
    });
    if (!nextEntry) return state;

    const duplicate = state.entries[state.entries.length - 1];
    if (duplicate?.type === nextEntry.type && duplicate.text === nextEntry.text && duplicate.imageDataUrl === nextEntry.imageDataUrl) {
      return state;
    }

    const nextState = {
      ...state,
      entries: [...state.entries, nextEntry].slice(-80),
    };
    this.saveState(nextState);
    return nextState;
  }

  deleteEntry(id: string) {
    const state = this.getState();
    const nextState = { ...state, entries: state.entries.filter((entry) => entry.id !== id) };
    this.saveState(nextState);
    return nextState;
  }

  markPasted(entry: TempClipboardEntry) {
    const state = this.getState();
    const nextState = {
      ...state,
      pastedHistory: [...state.pastedHistory.filter((item) => item.id !== entry.id), entry].slice(-20),
      entries: state.entries.filter((item) => item.id !== entry.id),
    };
    this.saveState(nextState);
    return nextState;
  }

  restoreLastPastedEntry() {
    const state = this.getState();
    const entry = state.pastedHistory[state.pastedHistory.length - 1];
    if (!entry) return state;

    const exists = state.entries.some((item) => item.id === entry.id);
    const nextState = {
      ...state,
      pastedHistory: state.pastedHistory.slice(0, -1),
      entries: exists ? state.entries : [entry, ...state.entries].slice(0, 80),
    };
    this.saveState(nextState);
    return nextState;
  }

  clear() {
    const state = this.getState();
    const nextState = { ...state, entries: [], pasteIndex: 0, pastedHistory: [] };
    this.saveState(nextState);
    return nextState;
  }

  setPasteIndex(pasteIndex: number) {
    const state = this.getState();
    const nextState = {
      ...state,
      pasteIndex: Math.max(0, Math.min(pasteIndex, Math.max(0, state.entries.length - 1))),
    };
    this.saveState(nextState);
    return nextState;
  }

  saveShortcuts(shortcuts: Partial<TempClipboardShortcuts>) {
    const state = this.getState();
    const nextState = {
      ...state,
        shortcuts: {
          captureMode: cleanShortcut(shortcuts.captureMode, DEFAULT_SHORTCUTS.captureMode),
          captureCopy: cleanShortcut(shortcuts.captureCopy, DEFAULT_SHORTCUTS.captureCopy),
          normalMode: cleanShortcut(shortcuts.normalMode, DEFAULT_SHORTCUTS.normalMode),
          pasteMode: cleanShortcut(shortcuts.pasteMode, DEFAULT_SHORTCUTS.pasteMode),
          pasteNext: cleanShortcut(shortcuts.pasteNext, DEFAULT_SHORTCUTS.pasteNext),
      },
    };
    this.saveState(nextState);
    return nextState;
  }

  private loadState(): TempClipboardState {
    if (!fs.existsSync(this.storePath)) {
      return { mode: 'normal', entries: [], pasteIndex: 0, shortcuts: DEFAULT_SHORTCUTS, pastedHistory: [] };
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<TempClipboardState>;
      const entries = Array.isArray(parsed.entries)
        ? parsed.entries.map((entry) => normalizeEntry(entry)).filter((entry): entry is TempClipboardEntry => Boolean(entry))
        : [];
      const legacyLastPastedEntry = normalizeEntry((parsed as Partial<TempClipboardState> & { lastPastedEntry?: TempClipboardEntry | null }).lastPastedEntry);
      const pastedHistory = Array.isArray((parsed as Partial<TempClipboardState>).pastedHistory)
        ? (parsed as Partial<TempClipboardState>).pastedHistory
            ?.map((entry) => normalizeEntry(entry))
            .filter((entry): entry is TempClipboardEntry => Boolean(entry)) ?? []
        : legacyLastPastedEntry
          ? [legacyLastPastedEntry]
          : [];
      return {
        mode: normalizeMode(parsed.mode),
        entries,
        pasteIndex: Number.isFinite(parsed.pasteIndex) ? Math.max(0, Number(parsed.pasteIndex)) : 0,
        shortcuts: {
          captureMode: cleanShortcut(parsed.shortcuts?.captureMode, DEFAULT_SHORTCUTS.captureMode),
          captureCopy: cleanShortcut(parsed.shortcuts?.captureCopy, DEFAULT_SHORTCUTS.captureCopy),
          normalMode: cleanShortcut(parsed.shortcuts?.normalMode, DEFAULT_SHORTCUTS.normalMode),
          pasteMode: cleanShortcut(parsed.shortcuts?.pasteMode, DEFAULT_SHORTCUTS.pasteMode),
          pasteNext: cleanShortcut(parsed.shortcuts?.pasteNext, DEFAULT_SHORTCUTS.pasteNext),
        },
        pastedHistory: pastedHistory.slice(-20),
      };
    } catch {
      return { mode: 'normal', entries: [], pasteIndex: 0, shortcuts: DEFAULT_SHORTCUTS, pastedHistory: [] };
    }
  }

  private removeExpired(state: TempClipboardState) {
    const now = Date.now();
    return {
      ...state,
      entries: state.entries.filter((entry) => new Date(entry.expiresAt).getTime() > now),
      pasteIndex: Math.min(state.pasteIndex, Math.max(0, state.entries.length - 1)),
    };
  }

  private saveState(state: TempClipboardState) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(this.removeExpired(state), null, 2)}\n`, 'utf8');
  }
}
