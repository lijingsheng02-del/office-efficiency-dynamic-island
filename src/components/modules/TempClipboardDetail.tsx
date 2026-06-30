import { useEffect, useMemo, useState } from 'react';
import { DetailShell } from './DetailShell';

type TempClipboardDetailProps = {
  onBack: () => void;
  onClose: () => void;
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
  if (mode === 'capture') return '采集模式中';
  if (mode === 'paste') return '粘贴模式中';
  return '正常模式';
}

function getMinRemaining(entries: TempClipboardEntry[]) {
  if (!entries.length) return 0;
  const minExpiresAt = Math.min(...entries.map((entry) => new Date(entry.expiresAt).getTime()));
  return Math.max(0, Math.ceil((minExpiresAt - Date.now()) / 60000));
}

function formatShortcut(shortcut: string) {
  return shortcut.replace(/CommandOrControl/g, 'Ctrl').replace(/\+/g, ' + ');
}

export function TempClipboardDetail({ onBack, onClose }: TempClipboardDetailProps) {
  const [state, setState] = useState<TempClipboardState>(EMPTY_STATE);
  const [shortcutDraft, setShortcutDraft] = useState(EMPTY_STATE.shortcuts);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void window.tempClipboardAPI.getState().then((nextState) => {
      setState(nextState);
      setShortcutDraft(nextState.shortcuts);
    });
    return window.tempClipboardAPI.onStateChanged((nextState) => {
      setState(nextState);
      setShortcutDraft(nextState.shortcuts);
    });
  }, []);

  const remainingMinutes = useMemo(() => getMinRemaining(state.entries), [state.entries]);

  const setMode = async (mode: TempClipboardState['mode']) => {
    setState(await window.tempClipboardAPI.setMode(mode));
  };

  const captureSelection = async () => {
    setState(await window.tempClipboardAPI.captureSelection());
  };

  const pasteEntry = async (id: string) => {
    setState(await window.tempClipboardAPI.pasteEntry(id));
  };

  const undoLastPaste = async () => {
    setState(await window.tempClipboardAPI.undoLastPaste());
  };

  const pasteEntryFromButton = async (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    await pasteEntry(id);
  };

  const deleteEntry = async (event: React.MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setState(await window.tempClipboardAPI.deleteEntry(id));
  };

  const clear = async () => {
    setState(await window.tempClipboardAPI.clear());
  };

  const saveShortcuts = async () => {
    const nextState = await window.tempClipboardAPI.saveShortcuts(shortcutDraft);
    setState(nextState);
    setShortcutDraft(nextState.shortcuts);
    setMessage('快捷键已保存');
    window.setTimeout(() => setMessage(''), 1600);
  };

  return (
    <DetailShell title="临时剪贴板岛" onBack={onBack} onClose={onClose}>
      <section className="temp-clipboard-page">
        <div className={`temp-clipboard-status mode-${state.mode}`}>
          <div>
            <span className="eyebrow">当前状态</span>
            <strong>{getModeText(state.mode)}</strong>
            <em>
              已暂存：{state.entries.length} 条 · 剩余自动清理时间：{remainingMinutes || 0} 分钟
            </em>
          </div>
          <span className="temp-mode-dot" />
        </div>

        <div className="temp-clipboard-actions">
          <button type="button" className={state.mode === 'capture' ? 'active' : ''} onClick={() => void setMode('capture')}>
            开始采集
          </button>
          <button type="button" onClick={() => void setMode('normal')}>
            恢复正常
          </button>
          <button type="button" className={state.mode === 'paste' ? 'active' : ''} onClick={() => void setMode('paste')}>
            开始粘贴
          </button>
          <button type="button" onClick={() => void captureSelection()} disabled={state.mode !== 'capture'}>
            采集当前选中
          </button>
          <button type="button" onClick={() => void undoLastPaste()} disabled={state.pastedHistory.length === 0}>
            撤回上次粘贴{state.pastedHistory.length ? ` ${state.pastedHistory.length}` : ''}
          </button>
          <button type="button" onClick={() => void clear()} disabled={!state.entries.length}>
            清空暂存岛
          </button>
        </div>

        <div className="temp-clipboard-help">
          <span>采集时：先选中文字或图片，再按「{formatShortcut(state.shortcuts.captureCopy)}」保存到暂存岛。</span>
          <span>粘贴时：双击任意一条即可粘贴；粘贴错了点「撤回上次粘贴」会撤销并恢复该条。</span>
        </div>

        <section className="temp-clipboard-list">
          {state.entries.length === 0 ? (
            <div className="temp-clipboard-empty">
              <strong>暂存岛为空</strong>
              <span>点击“开始采集”后，选中的内容会出现在这里。</span>
            </div>
          ) : (
            state.entries.map((entry, index) => (
              <article className="temp-clip-item" key={entry.id} onDoubleClick={() => void pasteEntry(entry.id)}>
                <div className="temp-clip-index">{index + 1}</div>
                <div className="temp-clip-main">
                  <strong>{entry.type === 'image' ? '图片内容' : '文本内容'}</strong>
                  {entry.type === 'image' && entry.imageDataUrl ? <img src={entry.imageDataUrl} alt="" /> : <span>{entry.preview}</span>}
                  <em>{Math.max(0, Math.ceil((new Date(entry.expiresAt).getTime() - Date.now()) / 60000))} 分钟后清理</em>
                </div>
                <div className="temp-clip-actions">
                  <button type="button" onClick={(event) => void pasteEntryFromButton(event, entry.id)}>
                    粘贴
                  </button>
                  <button type="button" onClick={(event) => deleteEntry(event, entry.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="temp-shortcut-panel">
          <div>
            <span className="eyebrow">快捷键</span>
            <strong>自定义工作流按键</strong>
            {message ? <em>{message}</em> : null}
          </div>
          <label>
            开始采集
            <input value={shortcutDraft.captureMode} onChange={(event) => setShortcutDraft((current) => ({ ...current, captureMode: event.target.value }))} />
          </label>
          <label>
            保存选中内容
            <input value={shortcutDraft.captureCopy} onChange={(event) => setShortcutDraft((current) => ({ ...current, captureCopy: event.target.value }))} />
          </label>
          <label>
            恢复正常模式
            <input value={shortcutDraft.normalMode} onChange={(event) => setShortcutDraft((current) => ({ ...current, normalMode: event.target.value }))} />
          </label>
          <label>
            开始粘贴
            <input value={shortcutDraft.pasteMode} onChange={(event) => setShortcutDraft((current) => ({ ...current, pasteMode: event.target.value }))} />
          </label>
          <button type="button" onClick={() => void saveShortcuts()}>
            保存快捷键
          </button>
        </section>
      </section>
    </DetailShell>
  );
}
