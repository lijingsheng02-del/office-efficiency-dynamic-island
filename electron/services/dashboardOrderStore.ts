import fs from 'node:fs';
import path from 'node:path';

export type DashboardModuleKey =
  | 'daily-plan'
  | 'work-countdown'
  | 'reader'
  | 'photos'
  | 'calculator'
  | 'password-vault'
  | 'file-namer'
  | 'temp-clipboard'
  | 'personalization'
  | 'author-support'
  | 'settings';

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
const DEFAULT_SHORTCUTS: DashboardModuleKey[] = ['daily-plan', 'work-countdown', 'reader'];

function normalizeOrder(value: unknown): DashboardModuleKey[] {
  const valid = new Set(DEFAULT_ORDER);
  const result = Array.isArray(value) ? value.filter((item): item is DashboardModuleKey => valid.has(item)) : [];
  return [...result, ...DEFAULT_ORDER.filter((item) => !result.includes(item))];
}

export class DashboardOrderStore {
  private readonly storePath: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'dashboard-module-order.json');
  }

  getOrder() {
    return this.loadStore().order;
  }

  getShortcuts() {
    return this.loadStore().shortcuts;
  }

  saveOrder(order: DashboardModuleKey[]) {
    const store = this.loadStore();
    const normalized = normalizeOrder(order);
    this.saveStore({ ...store, order: normalized });
    return normalized;
  }

  saveShortcuts(shortcuts: DashboardModuleKey[]) {
    const store = this.loadStore();
    const normalized = normalizeOrder(shortcuts).slice(0, 3);
    this.saveStore({ ...store, shortcuts: normalized });
    return normalized;
  }

  private loadStore() {
    if (!fs.existsSync(this.storePath)) return { order: DEFAULT_ORDER, shortcuts: DEFAULT_SHORTCUTS };

    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { order?: unknown; shortcuts?: unknown };
      return {
        order: normalizeOrder(parsed.order),
        shortcuts: normalizeOrder(parsed.shortcuts).slice(0, 3),
      };
    } catch {
      return { order: DEFAULT_ORDER, shortcuts: DEFAULT_SHORTCUTS };
    }
  }

  private saveStore(store: { order: DashboardModuleKey[]; shortcuts: DashboardModuleKey[] }) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }
}
