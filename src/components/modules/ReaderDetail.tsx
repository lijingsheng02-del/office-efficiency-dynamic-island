import { useEffect, useMemo, useState, type WheelEvent } from 'react';
import type { ReaderState } from '../DynamicIsland';
import { DetailShell } from './DetailShell';

type ReaderDetailProps = {
  reader: ReaderState;
  readerPageText: string;
  readerProgress: number;
  onOpenReaderFile: () => void;
  onSelectBook: (bookId: string) => void;
  onJumpToPosition: (position: number) => void;
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
  onSelectBook,
  onJumpToPosition,
  onPreviousPage,
  onNextPage,
  onChangeCharsPerPage,
  onBack,
  onClose,
}: ReaderDetailProps) {
  const [readerLevel, setReaderLevel] = useState<'library' | 'toc' | 'content'>('library');
  const hasBook = Boolean(reader.filePath && reader.text);
  const hasLibrary = reader.books.length > 0;
  const emptyMessage = reader.filePath ? '当前书籍文件不存在或无法读取，请选择其他书籍或重新导入。' : '点击“导入书籍”添加小说文本，支持一次选择多本。';
  const currentBook = useMemo(() => reader.books.find((book) => book.id === reader.currentBookId) ?? null, [reader.books, reader.currentBookId]);

  useEffect(() => {
    if (!hasLibrary) {
      setReaderLevel('library');
      return;
    }
    if (readerLevel === 'content' && !hasBook) {
      setReaderLevel('toc');
    }
  }, [hasBook, hasLibrary, readerLevel]);

  const handleWheel = (event: WheelEvent<HTMLElement>) => {
    if (!hasBook || readerLevel !== 'content') return;
    event.preventDefault();
    if (event.deltaY > 0) onNextPage();
    if (event.deltaY < 0) onPreviousPage();
  };

  const openBook = (bookId: string) => {
    onSelectBook(bookId);
    setReaderLevel('toc');
  };

  const continueReading = () => {
    setReaderLevel('content');
  };

  const openChapter = (position: number) => {
    onJumpToPosition(position);
    setReaderLevel('content');
  };

  return (
    <DetailShell title="小说阅读" onBack={onBack} onClose={onClose}>
      <article className="reader-detail-card" onWheel={handleWheel}>
        <div className="reader-card-header">
          <div className="card-copy">
            <span className="eyebrow">{readerLevel === 'library' ? '一级：书库' : readerLevel === 'toc' ? '二级：目录' : '三级：正文'}</span>
            <strong className="truncate">{readerLevel === 'library' ? '选择书名' : reader.title || '还没有选择小说文件'}</strong>
          </div>
          <button type="button" className="small-action" onClick={onOpenReaderFile}>
            导入书籍
          </button>
        </div>

        {readerLevel === 'library' ? (
          <div className="reader-level-panel">
            {hasLibrary ? (
              <div className="reader-library-list" aria-label="已导入书籍">
                {reader.books.map((book) => (
                  <button
                    type="button"
                    key={book.id}
                    className={`reader-book-option ${book.id === reader.currentBookId ? 'active' : ''}`}
                    onClick={() => openBook(book.id)}
                    title={book.filePath}
                  >
                    <span className="truncate">{book.title}</span>
                    <em>{book.exists ? (book.id === reader.currentBookId ? '当前书籍' : '进入目录') : '文件丢失'}</em>
                  </button>
                ))}
              </div>
            ) : (
              <p className="reader-empty-state">{emptyMessage}</p>
            )}
          </div>
        ) : null}

        {readerLevel === 'toc' ? (
          <div className="reader-level-panel">
            <div className="reader-path-row">
              <button type="button" className="reader-link-button" onClick={() => setReaderLevel('library')}>
                返回书库
              </button>
              <span className="truncate">{currentBook?.title || reader.title}</span>
            </div>
            {hasBook ? (
              <>
                <button type="button" className="reader-resume-option" onClick={continueReading}>
                  <span>从上次退出的地方继续阅读</span>
                  <em>{readerProgress}%</em>
                </button>
                {reader.chapters.length ? (
                  <div className="reader-chapter-list" aria-label="章节目录">
                    {reader.chapters.map((chapter, index) => (
                      <button type="button" key={chapter.id} className="reader-chapter-option" onClick={() => openChapter(chapter.position)}>
                        <span className="truncate">{chapter.title}</span>
                        <em>{index + 1}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="reader-empty-state">没有从正文识别到目录。当前只提供继续阅读入口。</p>
                )}
              </>
            ) : (
              <p className="reader-empty-state">{emptyMessage}</p>
            )}
          </div>
        ) : null}

        {readerLevel === 'content' ? (
          <>
            <div className="reader-path-row">
              <button type="button" className="reader-link-button" onClick={() => setReaderLevel('toc')}>
                返回目录
              </button>
              <span className="truncate">{reader.title}</span>
            </div>

            <p className={`reader-detail-page ${hasBook ? '' : 'empty'}`}>
              {hasBook ? readerPageText || '这一页暂时没有内容。' : emptyMessage}
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
          </>
        ) : null}
      </article>
    </DetailShell>
  );
}
