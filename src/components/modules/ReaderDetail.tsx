import type { WheelEvent } from 'react';
import type { ReaderState } from '../DynamicIsland';
import { DetailShell } from './DetailShell';

type ReaderDetailProps = {
  reader: ReaderState;
  readerPageText: string;
  readerProgress: number;
  onOpenReaderFile: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onChangeCharsPerPage: (charsPerPage: number) => void;
  onBack: () => void;
  onClose: () => void;
};

const CHARS_OPTIONS = [120, 160, 200, 240, 320, 420, 560];

export function ReaderDetail({
  reader,
  readerPageText,
  readerProgress,
  onOpenReaderFile,
  onPreviousPage,
  onNextPage,
  onChangeCharsPerPage,
  onBack,
  onClose,
}: ReaderDetailProps) {
  const hasBook = Boolean(reader.text);

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (!hasBook) return;
    event.preventDefault();
    if (event.deltaY > 0) onNextPage();
    if (event.deltaY < 0) onPreviousPage();
  };

  return (
    <DetailShell title="小说阅读" onBack={onBack} onClose={onClose}>
      <article className="reader-detail-card" onWheel={handleWheel}>
        <div className="reader-card-header">
          <div className="card-copy">
            <span className="eyebrow">当前书籍</span>
            <strong className="truncate">{hasBook ? reader.title : '还没有选择小说文件'}</strong>
          </div>
          <button type="button" className="small-action" onClick={onOpenReaderFile}>
            选择文件
          </button>
        </div>

        <p className={`reader-detail-page ${hasBook ? '' : 'empty'}`}>
          {hasBook ? readerPageText || '这一页暂时没有内容。' : '点击“选择文件”导入小说文本，支持常见文本编码。'}
        </p>

        <div className="reader-progress">
          <span>{hasBook ? `${readerProgress}%` : '0%'}</span>
          <div className="progress-track" aria-hidden="true">
            <div className="progress-value" style={{ transform: `scaleX(${readerProgress / 100})` }} />
          </div>
        </div>

        <div className="reader-controls">
          <button type="button" onClick={onPreviousPage} disabled={!hasBook}>
            上一页
          </button>
          <button type="button" onClick={onNextPage} disabled={!hasBook}>
            下一页
          </button>
        </div>

        <div className="setting-row compact-setting">
          <span className="truncate">每页字数</span>
          <div className="segmented reader-chars-segmented">
            {CHARS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                className={reader.charsPerPage === option ? 'active' : ''}
                onClick={() => onChangeCharsPerPage(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </article>
    </DetailShell>
  );
}
