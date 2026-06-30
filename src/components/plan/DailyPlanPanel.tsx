import { useEffect, useMemo, useState } from 'react';
import { PlanInput } from './PlanInput';
import { SortablePlanList } from './SortablePlanList';
import type { DailyPlan, DailyPlanTemplate } from './types';

const EMPTY_PLAN: DailyPlan = {
  date: '',
  items: [],
};

type PlanView = 'today' | 'templates';
type TemplateErrors = {
  name?: string;
  items?: string;
};

function sortPlanItems(items: DailyPlan['items']) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;

    if (a.done && b.done) {
      const aCompleted = a.completedAt || '';
      const bCompleted = b.completedAt || '';
      if (aCompleted !== bCompleted) return aCompleted.localeCompare(bCompleted);
    }

    return a.order - b.order;
  });
}

function normalizePlan(plan: DailyPlan) {
  return {
    ...plan,
    items: sortPlanItems(plan.items).map((item, index) => ({ ...item, order: index })),
  };
}

function splitTemplateLines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

export function DailyPlanPanel() {
  const [view, setView] = useState<PlanView>('today');
  const [plan, setPlan] = useState<DailyPlan>(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [canRollback, setCanRollback] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [templates, setTemplates] = useState<DailyPlanTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [templateMessage, setTemplateMessage] = useState('');
  const [templateErrors, setTemplateErrors] = useState<TemplateErrors>({});

  const refreshRollbackState = async () => {
    setCanRollback(await window.dailyPlanAPI.canRollback());
  };

  const refreshPlan = async () => {
    const todayPlan = await window.dailyPlanAPI.runCarryOver();
    setPlan(normalizePlan(todayPlan));
    setTemplates(await window.dailyPlanAPI.getTemplates());
    await refreshRollbackState();
  };

  useEffect(() => {
    let mounted = true;

    void window.dailyPlanAPI
      .runCarryOver()
      .then(async (todayPlan) => {
        if (!mounted) return;
        setPlan(normalizePlan(todayPlan));
        setTemplates(await window.dailyPlanAPI.getTemplates());
        setCanRollback(await window.dailyPlanAPI.canRollback());
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const doneCount = useMemo(() => plan.items.filter((item) => item.done).length, [plan.items]);

  const addItem = async (text: string) => {
    const nextPlan = await window.dailyPlanAPI.addPlanItem(text);
    setPlan(normalizePlan(nextPlan));
    await refreshRollbackState();
  };

  const toggleItem = (id: string) => {
    const completedAt = new Date().toISOString();
    setPlan((current) =>
      normalizePlan({
        ...current,
        items: current.items.map((item) =>
          item.id === id
            ? {
                ...item,
                done: !item.done,
                completedAt: item.done ? null : completedAt,
              }
            : item,
        ),
      }),
    );

    void window.dailyPlanAPI.togglePlanItem(id).then(async (nextPlan) => {
      setPlan(normalizePlan(nextPlan));
      await refreshRollbackState();
    });
  };

  const deleteItem = (id: string) => {
    void window.dailyPlanAPI.deletePlanItem(id).then(async (nextPlan) => {
      setPlan(normalizePlan(nextPlan));
      await refreshRollbackState();
    });
  };

  const reorderItems = (ids: string[]) => {
    setPlan((current) => {
      const byId = new Map(current.items.map((item) => [item.id, item]));
      const ordered = ids.map((id) => byId.get(id)).filter((item): item is DailyPlan['items'][number] => Boolean(item));
      return normalizePlan({ ...current, items: ordered.map((item, index) => ({ ...item, order: item.done ? item.order : index })) });
    });

    void window.dailyPlanAPI.reorderPlanItems(ids).then(async (nextPlan) => {
      setPlan(normalizePlan(nextPlan));
      await refreshRollbackState();
    });
  };

  const rollbackPlan = async () => {
    if (!canRollback || rollingBack) return;

    setRollingBack(true);
    try {
      setPlan(normalizePlan(await window.dailyPlanAPI.rollbackTodayPlan()));
      await refreshRollbackState();
    } finally {
      setRollingBack(false);
    }
  };

  const saveTemplate = async () => {
    const cleanName = templateName.trim();
    const items = splitTemplateLines(templateText);

    if (!cleanName) {
      setTemplateErrors({ name: '先填写模板名称。' });
      setTemplateMessage('');
      return;
    }

    if (items.length === 0) {
      setTemplateErrors({ items: '每行写一条固定任务。' });
      setTemplateMessage('');
      return;
    }

    setTemplateErrors({});
    setTemplates(await window.dailyPlanAPI.saveTemplate(cleanName, items));
    setTemplateName('');
    setTemplateText('');
    setTemplateMessage('模板已保存，之后每天会自动加入计划');
    await refreshPlan();
  };

  const importTemplateNow = async (id: string) => {
    const nextPlan = await window.dailyPlanAPI.importTemplate(id);
    setPlan(normalizePlan(nextPlan));
    await refreshRollbackState();
    setTemplateMessage('已加入今天的计划');
  };

  const deleteTemplate = async (id: string) => {
    setTemplates(await window.dailyPlanAPI.deleteTemplate(id));
    setTemplateMessage('模板已删除');
  };

  if (view === 'templates') {
    return (
      <section className="daily-plan-panel">
        <header className="plan-panel-header">
          <div>
            <span className="eyebrow">每日计划</span>
            <strong>固定任务模板</strong>
          </div>
          <button type="button" className="plan-rollback-button" onClick={() => setView('today')}>
            返回
          </button>
        </header>

        <section className="plan-template-editor">
          <label className="sr-only" htmlFor="daily-plan-template-name">
            模板名称
          </label>
          <input
            id="daily-plan-template-name"
            value={templateName}
            placeholder="模板名称，例如：每日基础工作"
            aria-invalid={Boolean(templateErrors.name)}
            aria-describedby={templateErrors.name ? 'daily-plan-template-name-error' : undefined}
            onChange={(event) => {
              setTemplateName(event.target.value);
              if (templateErrors.name) setTemplateErrors((current) => ({ ...current, name: undefined }));
            }}
          />
          {templateErrors.name ? (
            <span id="daily-plan-template-name-error" className="field-error" role="alert">
              {templateErrors.name}
            </span>
          ) : null}
          <label className="sr-only" htmlFor="daily-plan-template-items">
            模板任务列表
          </label>
          <textarea
            id="daily-plan-template-items"
            value={templateText}
            placeholder={'每行一条任务，例如：\n检查店铺消息\n整理广告数据\n同步库存'}
            aria-invalid={Boolean(templateErrors.items)}
            aria-describedby={templateErrors.items ? 'daily-plan-template-items-error' : undefined}
            onChange={(event) => {
              setTemplateText(event.target.value);
              if (templateErrors.items) setTemplateErrors((current) => ({ ...current, items: undefined }));
            }}
          />
          {templateErrors.items ? (
            <span id="daily-plan-template-items-error" className="field-error" role="alert">
              {templateErrors.items}
            </span>
          ) : null}
          <button type="button" onClick={() => void saveTemplate()}>
            保存模板
          </button>
          {templateMessage ? <p>{templateMessage}</p> : null}
        </section>

        <div className="plan-list-scroll">
          {templates.length === 0 ? (
            <div className="plan-empty">
              <strong>还没有固定任务模板</strong>
              <span>把每天都会重复做的任务写在这里，以后会自动加入每日计划。</span>
            </div>
          ) : (
            <div className="plan-template-list full">
              {templates.map((template) => (
                <article className="plan-template-card" key={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <span>{template.items.length} 条任务 · 每天自动加入</span>
                    <em>{template.items.join(' / ')}</em>
                  </div>
                  <button type="button" onClick={() => void importTemplateNow(template.id)}>
                    加入今天
                  </button>
                  <button type="button" className="ghost" aria-label={`删除模板 ${template.name}`} onClick={() => void deleteTemplate(template.id)}>
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="daily-plan-panel">
      <header className="plan-panel-header">
        <div>
          <span className="eyebrow">每日计划</span>
          <strong>{plan.date || '今天'}</strong>
        </div>
        <div className="plan-header-actions">
          <button type="button" className="plan-rollback-button" onClick={() => void rollbackPlan()} disabled={!canRollback || rollingBack}>
            {rollingBack ? '正在撤回' : '撤回结转'}
          </button>
          <span className="plan-progress">
            已完成 {doneCount} / {plan.items.length}
          </span>
        </div>
      </header>

      <PlanInput onAdd={addItem} />

      <button type="button" className="plan-template-entry" onClick={() => setView('templates')}>
        <span>
          <strong>固定任务模板</strong>
          <em>{templates.length > 0 ? `${templates.length} 个模板 · 每天自动加入` : '设置每天都会重复做的任务'}</em>
        </span>
        <b>管理</b>
      </button>

      <div className="plan-list-scroll">
        {loading ? (
          <div className="plan-empty">
            <strong>正在读取今天的计划</strong>
          </div>
        ) : plan.items.length === 0 ? (
          <div className="plan-empty">
            <strong>还没有计划</strong>
            <span>添加今天的第一条计划。</span>
          </div>
        ) : (
          <SortablePlanList items={plan.items} onToggle={toggleItem} onDelete={deleteItem} onReorder={reorderItems} />
        )}
      </div>
    </section>
  );
}
