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
  onChangeFontSize: (fontSize: number) => void;
  onBack: () => void;
  onClose: () => void;
};

const CHARS_OPTIONS = [120, 160, 200, 240];
const FONT_SIZE_OPTIONS = [13, 14, 15, 16, 18];
const CHAPTERS_PER_PAGE = 500;
const levelMeta = {
  library: { label: '书库', title: '选择一本书' },
  toc: { label: '目录', title: '章节目录' },
  content: { label: '正文', title: '正在阅读' },
};

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
  onChangeFontSize,
  onBack,
  onClose,
}: ReaderDetailProps) {
  const [readerLevel, setReaderLevel] = useState<'library' | 'toc' | 'content'>('library');
  const [chapterPage, setChapterPage] = useState(0);
  const hasBook = Boolean(reader.filePath && reader.text);
  const hasLibrary = reader.books.length > 0;
  const emptyMessage = reader.filePath ? '当前书籍文件不存在或无法读取，请选择其他书籍或重新导入。' : '点击“导入书籍”添加小说文本，支持一次选择多本。';
  const currentBook = useMemo(() => reader.books.find((book) => book.id === reader.currentBookId) ?? null, [reader.books, reader.currentBookId]);
  const sortedBooks = useMemo(
    () =>
      [...reader.books].sort((first, second) => {
        if (first.id === reader.currentBookId) return -1;
        if (second.id === reader.currentBookId) return 1;
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      }),
    [reader.books, reader.currentBookId],
  );
  const headerTitle = readerLevel === 'library' ? levelMeta.library.title : reader.title || levelMeta[readerLevel].title;
  const chapterPageCount = Math.max(1, Math.ceil(reader.chapters.length / CHAPTERS_PER_PAGE));
  const visibleChapters = useMemo(
    () => reader.chapters.slice(chapterPage * CHAPTERS_PER_PAGE, (chapterPage + 1) * CHAPTERS_PER_PAGE),
    [chapterPage, reader.chapters],
  );

  useEffect(() => {
    if (!hasLibrary) {
      setReaderLevel('library');
      return;
    }
    if (readerLevel === 'content' && !hasBook) {
      setReaderLevel('toc');
    }
  }, [hasBook, hasLibrary, readerLevel]);

  useEffect(() => {
    setChapterPage(0);
  }, [reader.currentBookId]);

  useEffect(() => {
    setChapterPage((page) => Math.min(page, chapterPageCount - 1));
  }, [chapterPageCount]);

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
      <article className={`reader-detail-card reader-level-${readerLevel}`} onWheel={handleWheel}>
        <div className="reader-card-header">
          <div className="card-copy">
            <span className="eyebrow">小说阅读</span>
            <strong className="truncate">{headerTitle}</strong>
          </div>
          <button type="button" className="reader-import-button" onClick={onOpenReaderFile}>
            导入
          </button>
        </div>

        {readerLevel === 'toc' ? (
          <div className="reader-step-nav" aria-label="阅读层级">
            <button type="button" className="active" onClick={() => setReaderLevel('toc')}>
              目录
            </button>
            <button type="button" disabled={!hasBook} onClick={() => setReaderLevel('content')}>
              正文
            </button>
          </div>
        ) : null}

        {readerLevel === 'library' ? (
          <div className="reader-level-panel">
            {hasLibrary ? (
              <div className="reader-library-list" aria-label="已导入书籍">
                {sortedBooks.map((book) => (
                  <button
                    type="button"
                    key={book.id}
                    className={`reader-book-option ${book.id === reader.currentBookId ? 'active' : ''}`}
                    onClick={() => openBook(book.id)}
                    title={book.filePath}
                  >
                    <span className="reader-row-main">
                      <strong className="truncate">{book.title}</strong>
                      <em>{book.exists ? (book.id === reader.currentBookId ? '当前书籍' : '进入目录') : '文件丢失'}</em>
                    </span>
                    <span className="reader-row-accessory" aria-hidden="true">
                      ›
                    </span>
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
                ‹ 书库
              </button>
              <span className="truncate">{currentBook?.title || reader.title}</span>
            </div>
            {hasBook ? (
              <>
                <button type="button" className="reader-resume-option" onClick={continueReading}>
                  <span className="reader-row-main">
                    <strong className="truncate">继续阅读</strong>
                    <em>从上次退出的位置开始</em>
                  </span>
                  <span className="reader-progress-pill">{readerProgress}%</span>
                </button>
                {reader.chapters.length ? (
                  <>
                    <div className="reader-chapter-pager">
                      <button type="button" disabled={chapterPage === 0} onClick={() => setChapterPage((page) => Math.max(0, page - 1))}>
                        上一组
                      </button>
                      <span>
                        {chapterPage * CHAPTERS_PER_PAGE + 1}-{Math.min((chapterPage + 1) * CHAPTERS_PER_PAGE, reader.chapters.length)} / {reader.chapters.length}
                      </span>
                      <button
                        type="button"
                        disabled={chapterPage >= chapterPageCount - 1}
                        onClick={() => setChapterPage((page) => Math.min(chapterPageCount - 1, page + 1))}
                      >
                        下一组
                      </button>
                    </div>
                    <div className="reader-chapter-list" aria-label="章节目录">
                      {visibleChapters.map((chapter, index) => (
                        <button type="button" key={chapter.id} className="reader-chapter-option" onClick={() => openChapter(chapter.position)}>
                          <span className="reader-row-main">
                            <strong className="truncate">{chapter.title}</strong>
                            <em>第 {chapterPage * CHAPTERS_PER_PAGE + index + 1} 节</em>
                          </span>
                          <span className="reader-row-accessory" aria-hidden="true">
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
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
          <div className="reader-content-panel">
            <div className="reader-path-row">
              <button type="button" className="reader-link-button" onClick={() => setReaderLevel('toc')}>
                ‹ 目录
              </button>
              <span className="truncate">{reader.title}</span>
            </div>

            <p className={`reader-detail-page ${hasBook ? '' : 'empty'}`} style={{ fontSize: `${reader.fontSize}px` }}>
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

            <div className="reader-content-options">
              <div className="reader-density-group">
                <span>每页字数</span>
                <div className="reader-char-pills" role="group" aria-label="每页字数">
                  {CHARS_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={reader.charsPerPage === option ? 'active' : ''}
                      onClick={() => onChangeCharsPerPage(option)}
                      aria-pressed={reader.charsPerPage === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div className="reader-density-group">
                <span>字体</span>
                <div className="reader-char-pills" role="group" aria-label="字体大小">
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button
                      type="button"
                      key={option}
                      className={reader.fontSize === option ? 'active' : ''}
                      onClick={() => onChangeFontSize(option)}
                      aria-pressed={reader.fontSize === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </DetailShell>
  );
}
