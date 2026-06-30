import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { IslandPhoto, ModuleKey, PhotoIntervalMs, ReaderState, ThemeMode } from '../DynamicIsland';
import { DEFAULT_WORK_COUNTDOWN, getWorkCountdownStatus, type WorkCountdownSettings } from '../modules/workCountdown';
import type { DailyPlan } from '../plan/types';
import { ModuleCard } from './ModuleCard';

type DashboardModuleKey = Exclude<ModuleKey, 'dashboard'>;

type DashboardProps = {
  time: string;
  date: string;
  reader: ReaderState;
  readerProgress: number;
  photos: IslandPhoto[];
  photoIntervalMs: PhotoIntervalMs;
  theme: ThemeMode;
  onOpenModule: (module: DashboardModuleKey) => void;
};

type ModuleInfo = {
  module: DashboardModuleKey;
  icon: string;
  title: string;
  description: string;
  status: string;
  progress?: number;
};

type DashboardView = 'home' | 'more';
type ModuleCategory = 'today' | 'tools' | 'personal';
type DashboardLoadState = 'loading' | 'ready' | 'error';

const DEFAULT_ORDER: DashboardModuleKey[] = [
  'daily-plan',
  'work-countdown',
  'reader',
  'temp-clipboard',
  'photos',
  'calculator',
  'password-vault',
  'file-namer',
  'personalization',
  'author-support',
  'settings',
];
const FEATURED_COUNT = 4;
const CATEGORY_LABELS: Record<ModuleCategory, { title: string; description: string }> = {
  today: { title: '今日', description: '计划、阅读和下班状态' },
  tools: { title: '工具', description: '剪贴板、计算、命名和账号' },
  personal: { title: '个性化', description: '外观、备份和联系支持' },
};
const MODULE_CATEGORIES: Record<ModuleCategory, DashboardModuleKey[]> = {
  today: ['daily-plan', 'work-countdown', 'reader'],
  tools: ['temp-clipboard', 'photos', 'calculator', 'password-vault', 'file-namer'],
  personal: ['personalization', 'settings', 'author-support'],
};
const EMPTY_PLAN: DailyPlan = {
  date: '',
  items: [],
};

const actionLabels: Record<DashboardModuleKey, string> = {
  'daily-plan': '计划',
  'work-countdown': '下班',
  reader: '阅读',
  photos: '照片',
  calculator: '计算',
  'password-vault': '账号',
  'file-namer': '命名',
  'temp-clipboard': '剪贴板',
  personalization: '个性',
  'author-support': '支持',
  settings: '设置',
};

function formatPhotoInterval(intervalMs: PhotoIntervalMs) {
  if (intervalMs === 10000) return '10 \u79d2\u5207\u6362';
  if (intervalMs === 30000) return '30 \u79d2\u5207\u6362';
  if (intervalMs === 60000) return '1 \u5206\u949f\u5207\u6362';
  return '10 \u5206\u949f\u5207\u6362';
}

function normalizeOrder(order: unknown) {
  const valid = new Set(DEFAULT_ORDER);
  const result = Array.isArray(order) ? order.filter((item): item is DashboardModuleKey => valid.has(item)) : [];
  return [...result, ...DEFAULT_ORDER.filter((item) => !result.includes(item))];
}

function normalizeShortcuts(shortcuts: unknown) {
  return normalizeOrder(shortcuts).slice(0, 3);
}

function sanitizeDailyPlan(plan: unknown): DailyPlan {
  if (!plan || typeof plan !== 'object') return EMPTY_PLAN;
  const candidate = plan as Partial<DailyPlan>;
  return {
    date: typeof candidate.date === 'string' ? candidate.date : '',
    items: Array.isArray(candidate.items) ? candidate.items : [],
  };
}

function getLoadErrorMessage(errorCount: number) {
  if (!errorCount) return '';
  return errorCount === 1 ? '部分数据读取失败，已使用默认值。' : '多个本地数据读取失败，已使用默认值。';
}

function SortableModuleCard({ info, onOpenModule }: { info: ModuleInfo; onOpenModule: (module: DashboardModuleKey) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: info.module });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div ref={setNodeRef} className="module-sortable-item">
      <ModuleCard
        {...info}
        dragging={isDragging}
        style={style}
        dragAttributes={attributes}
        dragListeners={listeners}
        onOpen={onOpenModule}
      />
    </div>
  );
}

function CategorySection({
  category,
  modules,
  moduleInfoByKey,
  onOpenModule,
}: {
  category: ModuleCategory;
  modules: DashboardModuleKey[];
  moduleInfoByKey: Record<DashboardModuleKey, ModuleInfo>;
  onOpenModule: (module: DashboardModuleKey) => void;
}) {
  if (!modules.length) return null;

  const label = CATEGORY_LABELS[category];

  return (
    <section className="module-category">
      <header>
        <div>
          <strong>{label.title}</strong>
          <span>{label.description}</span>
        </div>
        <em>{modules.length} 项</em>
      </header>
      <div className="module-category-list">
        {modules.map((module) => (
          <ModuleCard
            key={module}
            {...moduleInfoByKey[module]}
            compact
            showDragHandle={false}
            onOpen={onOpenModule}
          />
        ))}
      </div>
    </section>
  );
}

export function Dashboard({
  time,
  date,
  reader,
  readerProgress,
  photos,
  photoIntervalMs,
  theme,
  onOpenModule,
}: DashboardProps) {
  const [plan, setPlan] = useState<DailyPlan>(EMPTY_PLAN);
  const [workSettings, setWorkSettings] = useState<WorkCountdownSettings>(DEFAULT_WORK_COUNTDOWN);
  const [moduleOrder, setModuleOrder] = useState<DashboardModuleKey[]>(DEFAULT_ORDER);
  const [shortcuts, setShortcuts] = useState<DashboardModuleKey[]>(['daily-plan', 'work-countdown', 'reader']);
  const [editingShortcuts, setEditingShortcuts] = useState(false);
  const [view, setView] = useState<DashboardView>('home');
  const [loadState, setLoadState] = useState<DashboardLoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const loadDashboardData = useCallback(async (mounted: () => boolean) => {
    setLoadState('loading');
    setLoadMessage('');

    const [planResult, workResult, orderResult, shortcutsResult] = await Promise.allSettled([
      window.dailyPlanAPI.getTodayPlan(),
      window.workCountdownAPI.getSettings(),
      window.dashboardAPI.getModuleOrder(),
      window.dashboardAPI.getShortcuts(),
    ]);

    if (!mounted()) return;

    if (planResult.status === 'fulfilled') setPlan(sanitizeDailyPlan(planResult.value));
    if (workResult.status === 'fulfilled') setWorkSettings(workResult.value);
    if (orderResult.status === 'fulfilled') setModuleOrder(normalizeOrder(orderResult.value));
    if (shortcutsResult.status === 'fulfilled') setShortcuts(normalizeShortcuts(shortcutsResult.value));

    const errorCount = [planResult, workResult, orderResult, shortcutsResult].filter((result) => result.status === 'rejected').length;
    setLoadMessage(getLoadErrorMessage(errorCount));
    setLoadState(errorCount ? 'error' : 'ready');
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadDashboardData(() => mounted);
    return () => {
      mounted = false;
    };
  }, [loadDashboardData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const doneCount = useMemo(() => plan.items.filter((item) => item.done).length, [plan.items]);
  const pendingCount = Math.max(0, plan.items.length - doneCount);
  const workStatus = getWorkCountdownStatus(workSettings, now);
  const moduleInfoByKey = useMemo<Record<DashboardModuleKey, ModuleInfo>>(
    () => ({
      'daily-plan': {
        module: 'daily-plan',
        icon: '\u2713',
        title: '\u6bcf\u65e5\u8ba1\u5212',
        description: '今天要做的事，未完成会自动结转',
        status: `${doneCount} / ${plan.items.length} 已完成 · 未完成 ${pendingCount} 条`,
        progress: plan.items.length ? (doneCount / plan.items.length) * 100 : 0,
      },
      'work-countdown': {
        module: 'work-countdown',
        icon: '\u73ed',
        title: '\u4e0b\u73ed\u5012\u8ba1\u65f6',
        description: workStatus.roast,
        status: `${workStatus.label} ${workStatus.remainingText}`,
        progress: workStatus.progress,
      },
      reader: {
        module: 'reader',
        icon: '\u4e66',
        title: '\u5c0f\u8bf4\u9605\u8bfb',
        description: reader.title || '\u7ee7\u7eed\u9605\u8bfb\u4e0a\u6b21\u5185\u5bb9',
        status: reader.title ? `阅读进度 ${readerProgress}%` : '还没有选择小说文件',
        progress: readerProgress,
      },
      photos: {
        module: 'photos',
        icon: '\u56fe',
        title: '\u7167\u7247\u8f6e\u64ad',
        description: '在收起胶囊里循环显示照片',
        status: photos.length ? `${photos.length} \u5f20\u7167\u7247 · ${formatPhotoInterval(photoIntervalMs)}` : '\u672a\u6dfb\u52a0\u7167\u7247',
      },
      calculator: {
        module: 'calculator',
        icon: '\u7b97',
        title: '\u8ba1\u7b97\u5668',
        description: '\u5feb\u901f\u56db\u5219\u8fd0\u7b97',
        status: '轻量快速计算',
      },
      'password-vault': {
        module: 'password-vault',
        icon: '\u94a5',
        title: '\u8d26\u53f7\u5bc6\u7801\u5e93',
        description: '加密保存常用账号和密码',
        status: '进入前需要验证查看密码',
      },
      'file-namer': {
        module: 'file-namer',
        icon: '\u540d',
        title: '\u6587\u4ef6\u547d\u540d\u52a9\u624b',
        description: '生成统一、干净、可复制的文件名',
        status: '模板 · 日期 · 分隔符',
      },
      'temp-clipboard': {
        module: 'temp-clipboard',
        icon: '\u526a',
        title: '\u4e34\u65f6\u526a\u8d34\u677f\u5c9b',
        description: '批量采集内容，再按需粘贴',
        status: '暂存内容 1 小时后自动清理',
      },
      personalization: {
        module: 'personalization',
        icon: '\u2726',
        title: '\u4e2a\u6027\u5316',
        description: '调整颜色、透明度、壁纸和贴纸',
        status: theme === 'dark' ? '当前深色主题' : '当前浅色主题',
      },
      'author-support': {
        module: 'author-support',
        icon: '\u2606',
        title: '\u4f5c\u8005\u652f\u6301',
        description: '定制功能、使用优化和问题反馈',
        status: 'lijingsheng02@gmail.com',
      },
      settings: {
        module: 'settings',
        icon: '\u2699',
        title: '\u8bbe\u7f6e',
        description: '备份、恢复或查看本地数据',
        status: '导出 · 导入 · 数据目录',
      },
    }),
    [doneCount, pendingCount, photoIntervalMs, photos.length, plan.items.length, reader.title, readerProgress, theme, workStatus],
  );
  const orderedModules = normalizeOrder(moduleOrder);
  const featuredModules = orderedModules.slice(0, FEATURED_COUNT);
  const moreModules = orderedModules.filter((module) => !featuredModules.includes(module));
  const visibleShortcuts = normalizeOrder(shortcuts).slice(0, 3);
  const categorizedMoreModules = useMemo(
    () =>
      (Object.keys(MODULE_CATEGORIES) as ModuleCategory[]).reduce(
        (result, category) => {
          result[category] = MODULE_CATEGORIES[category].filter((module) => moreModules.includes(module));
          return result;
        },
        {} as Record<ModuleCategory, DashboardModuleKey[]>,
      ),
    [moreModules],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as DashboardModuleKey;
    const overId = event.over?.id as DashboardModuleKey | undefined;
    if (!overId || activeId === overId) return;

    const oldIndex = orderedModules.indexOf(activeId);
    const newIndex = orderedModules.indexOf(overId);
    const nextOrder = arrayMove(orderedModules, oldIndex, newIndex);
    setModuleOrder(nextOrder);
    void window.dashboardAPI.saveModuleOrder(nextOrder).catch(() => {
      setLoadState('error');
      setLoadMessage('排序保存失败，重启后可能恢复到上次顺序。');
    });
  };

  const toggleShortcut = (module: DashboardModuleKey) => {
    const exists = visibleShortcuts.includes(module);
    const nextShortcuts = exists
      ? visibleShortcuts.filter((item) => item !== module)
      : [...visibleShortcuts, module].slice(-3);
    setShortcuts(nextShortcuts);
    void window.dashboardAPI.saveShortcuts(nextShortcuts).catch(() => {
      setLoadState('error');
      setLoadMessage('快捷入口保存失败，重启后可能恢复到上次设置。');
    });
  };

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">{'\u5f53\u524d\u65f6\u95f4'}</span>
          <strong>{time}</strong>
          <span className="muted-text">{date}</span>
        </div>
        {view === 'more' ? (
          <button type="button" className="dashboard-back-button" onClick={() => setView('home')}>
            返回
          </button>
        ) : null}
      </header>

      <div className={`dashboard-status ${loadState}`} role={loadState === 'error' ? 'alert' : 'status'} aria-live="polite">
        {loadState === 'loading' ? <span>正在读取本地数据...</span> : null}
        {loadState === 'error' ? (
          <>
            <span>{loadMessage}</span>
            <button type="button" onClick={() => void loadDashboardData(() => true)}>
              重试
            </button>
          </>
        ) : null}
      </div>

      {view === 'home' ? (
        <div className="dashboard-home">
          <div className="dashboard-section-title">
            <span>常用功能</span>
            <em>拖动卡片可调整首页顺序</em>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedModules} strategy={verticalListSortingStrategy}>
              <div className="module-grid">
                {featuredModules.map((module) => (
                  <SortableModuleCard key={module} info={moduleInfoByKey[module]} onOpenModule={onOpenModule} />
                ))}
                <button type="button" className="module-more-card" onClick={() => setView('more')}>
                  <span className="module-icon" aria-hidden="true">
                    ···
                  </span>
                  <span className="module-copy">
                    <strong>更多功能</strong>
                    <span>查看今日、工具和个性化分类</span>
                    <em>还有 {moreModules.length} 个功能</em>
                  </span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="dashboard-more">
          {(Object.keys(MODULE_CATEGORIES) as ModuleCategory[]).map((category) => (
            <CategorySection
              key={category}
              category={category}
              modules={categorizedMoreModules[category]}
              moduleInfoByKey={moduleInfoByKey}
              onOpenModule={onOpenModule}
            />
          ))}
        </div>
      )}

      <footer className="dashboard-actions dashboard-actions-four">
        {visibleShortcuts.map((module) => (
          <button type="button" key={module} onClick={() => onOpenModule(module)}>
            {actionLabels[module]}
          </button>
        ))}
        <button type="button" className={editingShortcuts ? 'active' : ''} onClick={() => setEditingShortcuts((current) => !current)}>
          {'\u8c03\u6574'}
        </button>
      </footer>
      {editingShortcuts ? (
        <div className="shortcut-editor">
          <span>选择底部常驻的 3 个功能；首页顺序请拖动上方卡片</span>
          <div>
            {orderedModules.map((module) => (
              <button
                type="button"
                key={module}
                className={visibleShortcuts.includes(module) ? 'selected' : ''}
                onClick={() => toggleShortcut(module)}
              >
                {actionLabels[module]}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
