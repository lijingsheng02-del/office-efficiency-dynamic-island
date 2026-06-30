import type { ReactNode } from 'react';

type DetailShellProps = {
  title: string;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
};

export function DetailShell({ title, onBack, onClose, children }: DetailShellProps) {
  return (
    <section className="module-detail">
      <header className="detail-header">
        <button type="button" className="detail-back" onClick={onBack}>
          返回
        </button>
        <strong className="detail-title">{title}</strong>
        <button type="button" className="detail-close" onClick={onClose} aria-label="收起面板">
          ×
        </button>
      </header>
      <div className="detail-content">{children}</div>
    </section>
  );
}
