import fs from 'node:fs';
import path from 'node:path';

export type FileNameTemplate = {
  id: string;
  name: string;
  pattern: string;
  createdAt: string;
};

const DEFAULT_TEMPLATES: FileNameTemplate[] = [
  {
    id: 'default-date-product-project-version',
    name: '日期_产品名_项目名_版本号',
    pattern: '日期_产品名_项目名_版本号',
    createdAt: 'default',
  },
  {
    id: 'default-date-shop-product-type-version',
    name: '日期_店铺名_产品名_文件类型_版本号',
    pattern: '日期_店铺名_产品名_文件类型_版本号',
    createdAt: 'default',
  },
  {
    id: 'default-product-project-date-v1',
    name: '产品名_项目名_日期_v1',
    pattern: '产品名_项目名_日期_v1',
    createdAt: 'default',
  },
];

function createId() {
  return `tpl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 160) : fallback;
}

function normalizeTemplate(value: Partial<FileNameTemplate> | null | undefined): FileNameTemplate | null {
  const pattern = cleanString(value?.pattern);
  if (!pattern) return null;
  const name = cleanString(value?.name, pattern);
  return {
    id: cleanString(value?.id) || createId(),
    name: name || pattern,
    pattern,
    createdAt: cleanString(value?.createdAt) || new Date().toISOString(),
  };
}

export class FileNamingStore {
  private readonly storePath: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'file-naming-store.json');
  }

  getTemplates() {
    return this.loadTemplates();
  }

  saveTemplate(template: Partial<FileNameTemplate>) {
    const normalized = normalizeTemplate({
      ...template,
      id: createId(),
      createdAt: new Date().toISOString(),
    });
    if (!normalized) return this.loadTemplates();

    const templates = this.loadTemplates();
    const exists = templates.some((item) => item.pattern === normalized.pattern);
    const nextTemplates = exists ? templates : [normalized, ...templates];
    this.saveTemplates(nextTemplates);
    return nextTemplates;
  }

  deleteTemplate(id: string) {
    const nextTemplates = this.loadTemplates().filter((item) => item.id !== id);
    this.saveTemplates(nextTemplates);
    return nextTemplates;
  }

  private loadTemplates() {
    if (!fs.existsSync(this.storePath)) return DEFAULT_TEMPLATES;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as { templates?: unknown };
      const templates = Array.isArray(parsed.templates)
        ? parsed.templates.map((item) => normalizeTemplate(item)).filter((item): item is FileNameTemplate => Boolean(item))
        : [];
      return templates.length ? templates : DEFAULT_TEMPLATES;
    } catch {
      return DEFAULT_TEMPLATES;
    }
  }

  private saveTemplates(templates: FileNameTemplate[]) {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify({ templates }, null, 2)}\n`, 'utf8');
  }
}
