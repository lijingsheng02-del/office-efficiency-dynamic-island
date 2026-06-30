import { useEffect, useMemo, useState } from 'react';

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

type ThemeSticker = {
  slot: 'compact' | 'dashboard' | 'detail' | 'sheet' | 'pattern' | 'floating';
  filePath: string;
  url: string;
  name: string;
  updatedAt: string;
  pieces: Array<{ filePath: string; url: string; width: number; height: number }>;
};

const EMPTY_STATE: TempClipboardState = {
  mode: 'normal',
  entries: [],
  pasteIndex: 0,
  shortcuts: {
    captureMode: 'CommandOrControl+Alt+1',
    captureCopy: 'CommandOrControl+Alt+C',
    normalMode: 'CommandOrControl+Alt+2',
    pasteMode: 'CommandOrControl+Alt+3',
    pasteNext: 'CommandOrControl+Alt+V',
  },
  pastedHistory: [],
};

function getModeText(mode: TempClipboardState['mode']) {
  if (mode === 'capture') return '采集模式';
  if (mode === 'paste') return '粘贴模式';
  return '正常模式';
}

function formatShortcut(shortcut: string) {
  return shortcut.replace(/CommandOrControl/g, 'Ctrl').replace(/\+/g, ' + ');
}

function getMinRemaining(entries: TempClipboardEntry[]) {
  if (!entries.length) return 0;
  const minExpiresAt = Math.min(...entries.map((entry) => new Date(entry.expiresAt).getTime()));
  return Math.max(0, Math.ceil((minExpiresAt - Date.now()) / 60000));
}

function applyIslandOpacity(opacity: number) {
  document.documentElement.style.setProperty('--island-opacity', String(Math.min(100, Math.max(0, opacity)) / 100));
}

function applyIslandTint(tint: string) {
  document.documentElement.style.setProperty('--island-tint', tint);
}

function applyStickerOpacity(opacity: number) {
  document.documentElement.style.setProperty('--sticker-opacity', String(Math.min(100, Math.max(0, opacity)) / 100));
}

function applyThemePreset(preset: 'default' | 'kitty') {
  document.documentElement.dataset.themePreset = preset;
}

function applyWallpaperBlur(enabled: boolean) {
  document.documentElement.dataset.wallpaperBlur = enabled ? 'on' : 'off';
}

function applyFloatingWallpaperFocus(focusX: number, focusY: number) {
  document.documentElement.style.setProperty('--floating-wallpaper-position', `${focusX}% ${focusY}%`);
}

export function TempClipboardFloatingWindow() {
  const [state, setState] = useState<TempClipboardState>(EMPTY_STATE);
  const [floatingWallpaper, setFloatingWallpaper] = useState<ThemeSticker | null>(null);
  const remainingMinutes = useMemo(() => getMinRemaining(state.entries), [state.entries]);

  useEffect(() => {
    void window.tempClipboardAPI.getState().then(setState);
    return window.tempClipboardAPI.onStateChanged(setState);
  }, []);

  useEffect(() => {
    void window.islandApi?.getAppSettings().then((settings) => {
      applyIslandOpacity(settings.islandOpacity);
      applyIslandTint(settings.islandTint);
      applyStickerOpacity(settings.stickerOpacity);
      applyThemePreset(settings.themePreset);
      applyWallpaperBlur(settings.wallpaperBlur);
      applyFloatingWallpaperFocus(settings.floatingWallpaperFocusX, settings.floatingWallpaperFocusY);
    });
    return window.islandApi?.onAppSettingsChanged((settings) => {
      applyIslandOpacity(settings.islandOpacity);
      applyIslandTint(settings.islandTint);
      applyStickerOpacity(settings.stickerOpacity);
      applyThemePreset(settings.themePreset);
      applyWallpaperBlur(settings.wallpaperBlur);
      applyFloatingWallpaperFocus(settings.floatingWallpaperFocusX, settings.floatingWallpaperFocusY);
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    void window.themeStickerAPI?.getTheme().then((theme) => {
      if (mounted) setFloatingWallpaper(theme.floating ?? null);
    });
    const unsubscribe = window.themeStickerAPI?.onThemeChanged((theme) => {
      setFloatingWallpaper(theme.floating ?? null);
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const setMode = async (mode: TempClipboardState['mode']) => {
    setState(await window.tempClipboardAPI.setMode(mode));
  };

  const pasteEntry = async (id: string) => {
    setState(await window.tempClipboardAPI.pasteEntry(id));
  };

  const undoLastPaste = async () => {
    setState(await window.tempClipboardAPI.undoLastPaste());
  };

  const clearEntries = async () => {
    setState(await window.tempClipboardAPI.clear());
  };

  const deleteEntry = async (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setState(await window.tempClipboardAPI.deleteEntry(id));
  };

  return (
    <main className="floating-clipboard-shell">
      <section className={`floating-clipboard mode-${state.mode}`}>
        {floatingWallpaper ? <div className="floating-clipboard-wallpaper" style={{ backgroundImage: `url("${floatingWallpaper.url}")` }} aria-hidden="true" /> : null}
        <header className="floating-clipboard-header">
          <div>
            <span>临时剪贴板岛</span>
            <strong>{getModeText(state.mode)}</strong>
          </div>
          <em>
            {state.entries.length} 条 · {remainingMinutes} 分钟
          </em>
        </header>

        <div className="floating-clipboard-actions">
          <button type="button" className={state.mode === 'capture' ? 'active' : ''} onClick={() => void setMode('capture')}>
            采集
          </button>
          <button type="button" className={state.mode === 'paste' ? 'active' : ''} onClick={() => void setMode('paste')}>
            粘贴
          </button>
          <button type="button" onClick={() => void setMode('normal')}>
            退出
          </button>
          <button type="button" disabled={state.mode !== 'capture'} onClick={() => void window.tempClipboardAPI.captureSelection()}>
            采当前
          </button>
          <button type="button" disabled={state.pastedHistory.length === 0} onClick={() => void undoLastPaste()}>
            撤回{state.pastedHistory.length ? ` ${state.pastedHistory.length}` : ''}
          </button>
          <button type="button" disabled={state.entries.length === 0} onClick={() => void clearEntries()}>
            清空
          </button>
        </div>

        <div className="floating-clipboard-hint">
          {state.mode === 'capture'
            ? `选中内容后按 ${formatShortcut(state.shortcuts.captureCopy)} 采集`
            : state.mode === 'paste'
              ? '双击任意一条内容粘贴，粘贴错了可点撤回'
              : '进入采集或粘贴模式后会自动保持显示'}
        </div>

        <div className="floating-clip-list">
          {state.entries.length === 0 ? (
            <div className="floating-clip-empty">暂无暂存内容</div>
          ) : (
            state.entries.map((entry, index) => (
              <article className="floating-clip-row" key={entry.id} onDoubleClick={() => void pasteEntry(entry.id)}>
                <span className="floating-clip-number">{index + 1}</span>
                <div className="floating-clip-body">
                  <strong>{entry.type === 'image' ? '图片' : entry.preview}</strong>
                  {entry.type === 'image' && entry.imageDataUrl ? <img src={entry.imageDataUrl} alt="" /> : null}
                  <em>{Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - Date.now()) / 60000))} 分钟后清理</em>
                </div>
                <div className="floating-clip-buttons">
                  <button type="button" onClick={(event) => deleteEntry(event, entry.id)}>
                    ×
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
