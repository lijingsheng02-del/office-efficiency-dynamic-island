import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import type { ModuleKey } from '../DynamicIsland';

type ModuleCardProps = {
  module: Exclude<ModuleKey, 'dashboard'>;
  icon: ReactNode;
  title: string;
  description: string;
  status: string;
  progress?: number;
  dragAttributes?: HTMLAttributes<HTMLElement>;
  dragListeners?: Record<string, any>;
  dragging?: boolean;
  compact?: boolean;
  showDragHandle?: boolean;
  style?: CSSProperties;
  onOpen: (module: Exclude<ModuleKey, 'dashboard'>) => void;
};

export function ModuleCard({
  module,
  icon,
  title,
  description,
  status,
  progress,
  dragAttributes,
  dragListeners,
  dragging = false,
  compact = false,
  showDragHandle = true,
  style,
  onOpen,
}: ModuleCardProps) {
  return (
    <button
      type="button"
      className={`module-card ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''}`}
      style={style}
      onClick={() => onOpen(module)}
    >
      <span className="module-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="module-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        <em>{status}</em>
        {typeof progress === 'number' ? (
          <span className="module-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(100, Math.max(0, progress)) / 100})` }} />
          </span>
        ) : null}
      </span>
      {showDragHandle ? (
        <span className="module-drag-handle" aria-label="拖动排序" title="拖动排序" {...dragAttributes} {...dragListeners}>
          ⋮
        </span>
      ) : null}
    </button>
  );
}
