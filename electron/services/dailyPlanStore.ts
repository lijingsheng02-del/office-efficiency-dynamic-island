import fs from 'node:fs';
import path from 'node:path';

export type PlanItem = {
  id: string;
  sourceId: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
  carryOverFrom?: string | null;
  order: number;
};

export type DailyPlan = {
  date: string;
  items: PlanItem[];
};

export type DailyPlanTemplate = {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
};

export type PlanStore = {
  lastOpenedDate: string;
  plansByDate: Record<string, DailyPlan>;
  rollbackByDate?: Record<string, DailyPlan>;
  templates?: DailyPlanTemplate[];
  templateImportByDate?: Record<string, string[]>;
};

const EMPTY_STORE: PlanStore = {
  lastOpenedDate: '',
  plansByDate: {},
  rollbackByDate: {},
  templates: [],
  templateImportByDate: {},
};

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortPlanItems(items: PlanItem[]) {
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

function normalizeOrders(items: PlanItem[]) {
  return sortPlanItems(items).map((item, index) => ({ ...item, order: index }));
}

function normalizeItem(item: Partial<PlanItem>, index: number): PlanItem | null {
  const text = typeof item.text === 'string' ? item.text.trim() : '';
  if (!text) return null;

  const id = typeof item.id === 'string' && item.id ? item.id : createId();

  return {
    id,
    sourceId: typeof item.sourceId === 'string' && item.sourceId ? item.sourceId : id,
    text,
    done: Boolean(item.done),
    createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : new Date().toISOString(),
    completedAt: typeof item.completedAt === 'string' ? item.completedAt : null,
    carryOverFrom: typeof item.carryOverFrom === 'string' ? item.carryOverFrom : null,
    order: Number.isFinite(item.order) ? Number(item.order) : index,
  };
}

function normalizePlan(date: string, plan: Partial<DailyPlan> | undefined): DailyPlan {
  const items = Array.isArray(plan?.items) ? plan.items : [];

  return {
    date,
    items: normalizeOrders(items.map((item, index) => normalizeItem(item, index)).filter((item): item is PlanItem => Boolean(item))),
  };
}

function normalizeTemplate(template: Partial<DailyPlanTemplate>): DailyPlanTemplate | null {
  const name = typeof template.name === 'string' ? template.name.trim() : '';
  const items = Array.isArray(template.items)
    ? [...new Set(template.items.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean))]
    : [];

  if (!name || items.length === 0) return null;

  return {
    id: typeof template.id === 'string' && template.id ? template.id : createId(),
    name,
    items,
    createdAt: typeof template.createdAt === 'string' && template.createdAt ? template.createdAt : new Date().toISOString(),
  };
}

function normalizeTemplates(templates: unknown) {
  if (!Array.isArray(templates)) return [];
  return templates.map((template) => normalizeTemplate(template as Partial<DailyPlanTemplate>)).filter((template): template is DailyPlanTemplate => Boolean(template));
}

function normalizeStore(raw: Partial<PlanStore> | null | undefined): PlanStore {
  const plansByDate: Record<string, DailyPlan> = {};
  const rollbackByDate: Record<string, DailyPlan> = {};
  const templateImportByDate: Record<string, string[]> = {};
  const rawPlans = raw?.plansByDate && typeof raw.plansByDate === 'object' ? raw.plansByDate : {};
  const rawRollback = raw?.rollbackByDate && typeof raw.rollbackByDate === 'object' ? raw.rollbackByDate : {};
  const rawTemplateImport =
    raw?.templateImportByDate && typeof raw.templateImportByDate === 'object' ? raw.templateImportByDate : {};

  for (const [date, plan] of Object.entries(rawPlans)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      plansByDate[date] = normalizePlan(date, plan);
    }
  }

  for (const [date, plan] of Object.entries(rawRollback)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      rollbackByDate[date] = normalizePlan(date, plan);
    }
  }

  for (const [date, ids] of Object.entries(rawTemplateImport)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(ids)) {
      templateImportByDate[date] = ids.filter((id): id is string => typeof id === 'string' && Boolean(id));
    }
  }

  return {
    lastOpenedDate: typeof raw?.lastOpenedDate === 'string' ? raw.lastOpenedDate : '',
    plansByDate,
    rollbackByDate,
    templates: normalizeTemplates(raw?.templates),
    templateImportByDate,
  };
}

export class DailyPlanStore {
  private readonly storePath: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'daily-plan-store.json');
  }

  getTodayPlan() {
    return this.runCarryOver();
  }

  getFirstPendingItem() {
    const plan = this.runCarryOver();
    return plan.items.find((item) => !item.done) ?? null;
  }

  addPlanItem(text: string) {
    const cleanText = text.trim();
    const store = this.loadStore();
    const today = this.getTodayKey();
    const plan = this.ensureTodayPlan(store);

    if (!cleanText) {
      return plan;
    }

    this.saveRollbackSnapshot(store, today, plan);
    const id = createId();
    const item: PlanItem = {
      id,
      sourceId: id,
      text: cleanText,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
      carryOverFrom: null,
      order: plan.items.length,
    };

    const pendingCount = plan.items.filter((current) => !current.done).length;
    plan.items = normalizeOrders([...plan.items, { ...item, order: pendingCount }]);
    store.plansByDate[today] = plan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return plan;
  }

  togglePlanItem(id: string) {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const plan = this.ensureTodayPlan(store);
    const now = new Date().toISOString();
    this.saveRollbackSnapshot(store, today, plan);

    plan.items = normalizeOrders(plan.items.map((item) => {
      if (item.id !== id) return item;
      const done = !item.done;
      return {
        ...item,
        done,
        completedAt: done ? now : null,
        order: done ? item.order : plan.items.filter((current) => !current.done).length,
      };
    }));

    store.plansByDate[today] = plan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return plan;
  }

  deletePlanItem(id: string) {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const plan = this.ensureTodayPlan(store);
    this.saveRollbackSnapshot(store, today, plan);

    plan.items = normalizeOrders(plan.items.filter((item) => item.id !== id));
    store.plansByDate[today] = plan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return plan;
  }

  reorderPlanItems(ids: string[]) {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const plan = this.ensureTodayPlan(store);
    this.saveRollbackSnapshot(store, today, plan);
    const itemById = new Map(plan.items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const reorderedPending: PlanItem[] = [];

    for (const id of ids) {
      const item = itemById.get(id);
      if (item && !item.done && !seen.has(id)) {
        reorderedPending.push(item);
        seen.add(id);
      }
    }

    for (const item of plan.items) {
      if (!item.done && !seen.has(item.id)) {
        reorderedPending.push(item);
      }
    }

    const reorderedPendingIds = new Map(reorderedPending.map((item, index) => [item.id, index]));
    plan.items = normalizeOrders(
      plan.items.map((item) => (item.done ? item : { ...item, order: reorderedPendingIds.get(item.id) ?? item.order })),
    );
    store.plansByDate[today] = plan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return plan;
  }

  getTemplates() {
    return this.loadStore().templates ?? [];
  }

  saveTemplate(name: string, items: string[]) {
    const store = this.loadStore();
    const template = normalizeTemplate({
      id: createId(),
      name,
      items,
      createdAt: new Date().toISOString(),
    });

    if (!template) {
      return store.templates ?? [];
    }

    const existing = store.templates ?? [];
    store.templates = [...existing.filter((item) => item.name !== template.name), template];
    this.saveStore(store);
    return store.templates;
  }

  deleteTemplate(id: string) {
    const store = this.loadStore();
    store.templates = (store.templates ?? []).filter((template) => template.id !== id);
    this.saveStore(store);
    return store.templates;
  }

  importTemplate(id: string) {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const plan = this.ensureTodayPlan(store);
    const template = (store.templates ?? []).find((item) => item.id === id);

    if (!template) {
      return plan;
    }

    const existingTexts = new Set(plan.items.map((item) => item.text.trim()));
    const cleanItems = template.items.map((item) => item.trim()).filter((item) => item && !existingTexts.has(item));

    if (cleanItems.length === 0) {
      return plan;
    }

    this.saveRollbackSnapshot(store, today, plan);
    const pendingCount = plan.items.filter((item) => !item.done).length;
    const now = new Date().toISOString();
    const nextItems = cleanItems.map((text, index) => {
      const itemId = createId();
      existingTexts.add(text);
      return {
        id: itemId,
        sourceId: itemId,
        text,
        done: false,
        createdAt: now,
        completedAt: null,
        carryOverFrom: null,
        order: pendingCount + index,
      };
    });

    plan.items = normalizeOrders([...plan.items, ...nextItems]);
    store.plansByDate[today] = plan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return plan;
  }

  rollbackTodayPlan() {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const rollbackPlan = store.rollbackByDate?.[today];

    if (!rollbackPlan) {
      return this.ensureTodayPlan(store);
    }

    const currentPlan = this.ensureTodayPlan(store);
    store.plansByDate[today] = normalizePlan(today, rollbackPlan);
    store.rollbackByDate ??= {};
    store.rollbackByDate[today] = normalizePlan(today, currentPlan);
    store.lastOpenedDate = today;
    this.saveStore(store);
    return store.plansByDate[today];
  }

  canRollbackTodayPlan() {
    const store = this.loadStore();
    const today = this.getTodayKey();
    return Boolean(store.rollbackByDate?.[today]);
  }

  runCarryOver() {
    const store = this.loadStore();
    const today = this.getTodayKey();
    const lastOpenedDate = store.lastOpenedDate;
    const todayPlan = normalizePlan(today, store.plansByDate[today]);

    if (lastOpenedDate && lastOpenedDate !== today) {
      const sourcePlan = normalizePlan(lastOpenedDate, store.plansByDate[lastOpenedDate]);
      const existingSourceIds = new Set(todayPlan.items.map((item) => item.sourceId));
      const carriedItems = sourcePlan.items
        .filter((item) => !item.done && !existingSourceIds.has(item.sourceId))
        .map((item) => ({
          ...item,
          id: createId(),
          done: false,
          completedAt: null,
          carryOverFrom: lastOpenedDate,
          createdAt: new Date().toISOString(),
        }));

      todayPlan.items = normalizeOrders([...carriedItems, ...todayPlan.items].map((item, index) => ({ ...item, order: index })));
    }

    this.importTemplatesForDate(store, today, todayPlan);

    store.plansByDate[today] = todayPlan;
    store.lastOpenedDate = today;
    this.saveStore(store);
    return todayPlan;
  }

  private getTodayKey() {
    return process.env.DAILY_PLAN_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.DAILY_PLAN_DATE)
      ? process.env.DAILY_PLAN_DATE
      : toDateKey(new Date());
  }

  private ensureTodayPlan(store: PlanStore) {
    const today = this.getTodayKey();
    const plan = normalizePlan(today, store.plansByDate[today]);
    store.plansByDate[today] = plan;
    return plan;
  }

  private saveRollbackSnapshot(store: PlanStore, date: string, plan: DailyPlan) {
    store.rollbackByDate ??= {};
    store.rollbackByDate[date] = normalizePlan(date, plan);
  }

  private importTemplatesForDate(store: PlanStore, date: string, plan: DailyPlan) {
    const templates = store.templates ?? [];
    if (templates.length === 0) return;

    store.templateImportByDate ??= {};
    const importedTemplateIds = new Set(store.templateImportByDate[date] ?? []);
    const pendingTemplates = templates.filter((template) => !importedTemplateIds.has(template.id));
    if (pendingTemplates.length === 0) return;

    const templateTexts = [...new Set(pendingTemplates.flatMap((template) => template.items.map((item) => item.trim()).filter(Boolean)))];
    if (templateTexts.length === 0) {
      store.templateImportByDate[date] = [...new Set([...importedTemplateIds, ...pendingTemplates.map((template) => template.id)])];
      return;
    }

    const templateTextSet = new Set(templateTexts);
    const withoutDuplicateCarryOver = plan.items.filter((item) => !(item.carryOverFrom && !item.done && templateTextSet.has(item.text.trim())));
    const existingTexts = new Set(withoutDuplicateCarryOver.map((item) => item.text.trim()));
    const now = new Date().toISOString();
    const newTemplateItems: PlanItem[] = templateTexts
      .filter((text) => !existingTexts.has(text))
      .map((text, index) => {
        const id = createId();
        return {
          id,
          sourceId: `template:${text}`,
          text,
          done: false,
          createdAt: now,
          completedAt: null,
          carryOverFrom: null,
          order: index,
        };
      });

    plan.items = normalizeOrders(
      [...newTemplateItems, ...withoutDuplicateCarryOver].map((item, index) => ({
        ...item,
        order: index,
      })),
    );
    store.templateImportByDate[date] = [...new Set([...importedTemplateIds, ...pendingTemplates.map((template) => template.id)])];
  }

  private loadStore() {
    if (!fs.existsSync(this.storePath)) {
      return { ...EMPTY_STORE, plansByDate: {}, rollbackByDate: {}, templates: [], templateImportByDate: {} };
    }

    try {
      return normalizeStore(JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<PlanStore>);
    } catch {
      return { ...EMPTY_STORE, plansByDate: {}, rollbackByDate: {}, templates: [], templateImportByDate: {} };
    }
  }

  private saveStore(store: PlanStore) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, 'utf8');
  }
}
