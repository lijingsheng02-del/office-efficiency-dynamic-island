import fs from 'node:fs';
import path from 'node:path';

export type RoastTone = 'encourage' | 'normal' | 'almost';

export type WorkCountdownSettings = {
  workStart: string;
  lunchStart: string;
  lunchEnd: string;
  workEnd: string;
  roasts: Record<RoastTone, string[]>;
};

const DEFAULT_ROASTS: Record<RoastTone, string[]> = {
  encourage: [
    '公司这台破风箱还在嘎吱转，先别急，今天的电费还没替它烧够。',
    '离下班还早，建议把灵魂调成省电模式，别给公司白送算力。',
    'KPI 还在墙上装神弄鬼，你先活着，别被流程榨成表格渣。',
    '这公司最稳定的产出就是废话，今天也请你从废话堆里爬出来。',
  ],
  normal: [
    '公司画的饼已经凉透了，别啃，等下班才是正餐。',
    '会议像下水道返味，一开就知道今天又要污染脑子。',
    '这破流程拧不出效率，只会把人的耐心拧成麻花。',
    '工位不是牢房，但公司这套系统很努力在模仿。',
    '再忍一下，别跟公司的低级管理逻辑一般见识。',
  ],
  almost: [
    '快下班了，公司的精神污染即将断电。',
    '最后一小时，别让公司临门一脚把你踢回加班地狱。',
    '自由快到了，别被临时需求这种脏东西绊住。',
    '马上撤离，这公司今天的离谱额度已经刷爆。',
    '准备关机，别让公司再从你身上薅一根情绪羊毛。',
  ],
};

const DEFAULT_SETTINGS: WorkCountdownSettings = {
  workStart: '09:00',
  lunchStart: '12:00',
  lunchEnd: '13:30',
  workEnd: '18:00',
  roasts: DEFAULT_ROASTS,
};

function normalizeTime(value: unknown, fallback: string) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function normalizeRoasts(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const roasts = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  return roasts.length ? roasts : fallback;
}

function normalizeSettings(value: Partial<WorkCountdownSettings> | null | undefined): WorkCountdownSettings {
  return {
    workStart: normalizeTime(value?.workStart, DEFAULT_SETTINGS.workStart),
    lunchStart: normalizeTime(value?.lunchStart, DEFAULT_SETTINGS.lunchStart),
    lunchEnd: normalizeTime(value?.lunchEnd, DEFAULT_SETTINGS.lunchEnd),
    workEnd: normalizeTime(value?.workEnd, DEFAULT_SETTINGS.workEnd),
    roasts: {
      encourage: normalizeRoasts(value?.roasts?.encourage, DEFAULT_ROASTS.encourage),
      normal: normalizeRoasts(value?.roasts?.normal, DEFAULT_ROASTS.normal),
      almost: normalizeRoasts(value?.roasts?.almost, DEFAULT_ROASTS.almost),
    },
  };
}

export class WorkCountdownStore {
  private readonly storePath: string;

  constructor(userDataPath: string) {
    this.storePath = path.join(userDataPath, 'work-countdown-store.json');
  }

  getSettings() {
    return this.loadStore();
  }

  saveSettings(settings: WorkCountdownSettings) {
    const normalized = normalizeSettings(settings);
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
  }

  private loadStore() {
    if (!fs.existsSync(this.storePath)) return { ...DEFAULT_SETTINGS, roasts: { ...DEFAULT_ROASTS } };

    try {
      return normalizeSettings(JSON.parse(fs.readFileSync(this.storePath, 'utf8')) as Partial<WorkCountdownSettings>);
    } catch {
      return { ...DEFAULT_SETTINGS, roasts: { ...DEFAULT_ROASTS } };
    }
  }
}
