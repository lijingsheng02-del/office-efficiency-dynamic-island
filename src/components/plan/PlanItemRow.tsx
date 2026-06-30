import { CSSProperties } from 'react';
import type { PlanItem } from './types';

type PlanItemRowProps = {
  item: PlanItem;
  dragAttributes?: Record<string, any>;
  dragListeners?: Record<string, any>;
  dragDisabled?: boolean;
  style?: CSSProperties;
  isDragging?: boolean;
  onToggle: (id: string) => void;
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
  onDelete,
}: PlanItemRowProps) {
  const carryLabel = getCarryLabel(item);

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

      <button type="button" className="plan-delete" aria-label="删除计划" onClick={() => onDelete(item.id)}>
        ×
      </button>
    </div>
  );
}
