import { MouseEvent } from 'react';

type IslandHeaderProps = {
  time: string;
  date: string;
  onClose: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function IslandHeader({ time, date, onClose }: IslandHeaderProps) {
  return (
    <header className="island-header">
      <div className="header-time">
        <span className="eyebrow">当前时间</span>
        <strong>{time}</strong>
        <span className="muted-text">{date}</span>
      </div>

      <button className="close-button" type="button" onClick={onClose} aria-label="收起面板">
        X
      </button>
    </header>
  );
}
