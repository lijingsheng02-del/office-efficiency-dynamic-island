import { CSSProperties, useState } from 'react';
import type { PlanItem } from './types';

type PlanItemRowProps = {
  item: PlanItem;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  dragDisabled?: boolean;
  style?: CSSProperties;
  isDragging?: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => Promise<void>;
  onDelete: (id: string) => void;
};

function getCarryLabel(item: PlanItem) {
  if (!item.carryOverFrom) return null;
  return item.carryOverFrom === new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    ? '昨日结转'
    : `结转自 ${item.carryOverFrom}`;
}

export function PlanItemRow({
  item,
  dragAttributes,
  dragListeners,
  dragDisabled = false,
  style,
  isDragging = false,
  onToggle,
  onEdit,
  onDelete,
}: PlanItemRowProps) {
  const carryLabel = getCarryLabel(item);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveEdit = async () => {
    const text = draft?.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      if (text !== item.text) await onEdit(item.id, text);
      setDraft(null);
    } catch {
      setError('保存失败，请重新打开每日计划后重试。');
    } finally {
      setSaving(false);
    }
  };

  if (draft !== null) {
    return (
      <div className="plan-item-row plan-edit-row plan-input-row">
        <input autoFocus aria-label="计划内容" value={draft} disabled={saving}
          onFocus={(event) => event.target.select()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void saveEdit();
            }
            if (event.key === 'Escape') setDraft(null);
          }} />
        <button type="button" disabled={saving || !draft.trim()} onClick={() => void saveEdit()}>保存</button>
        <button type="button" disabled={saving} onClick={() => setDraft(null)}>取消</button>
        {error && <span className="field-error" role="alert">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`plan-item-row ${item.done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`} style={style}>
      <button
        type="button"
        className="drag-handle"
        aria-label="拖拽调整计划顺序"
        disabled={dragDisabled}
        {...dragAttributes}
        {...dragListeners}
      >
        ⋮⋮
      </button>

      <div className="plan-item-copy">
        <span className="plan-item-text">{item.text}</span>
        {carryLabel ? <span className="carry-label">{carryLabel}</span> : null}
      </div>

      <input className="plan-checkbox" type="checkbox" checked={item.done} aria-label="标记计划完成" onChange={() => onToggle(item.id)} />

      <button type="button" className="plan-rollback-button" aria-label={`编辑计划 ${item.text}`} onClick={() => {
        setError('');
        setDraft(item.text);
      }}>编辑</button>

      <button type="button" className="plan-delete" aria-label="删除计划" onClick={() => onDelete(item.id)}>
        ×
      </button>
    </div>
  );
}
