export type RoastTone = 'encourage' | 'normal' | 'almost';

export type WorkCountdownSettings = {
  workStart: string;
  lunchStart: string;
  lunchEnd: string;
  workEnd: string;
  roasts: Record<RoastTone, string[]>;
};

export type WorkCountdownStatus = {
  label: string;
  remainingText: string;
  workDurationText: string;
  roast: string;
  tone: RoastTone;
  progress: number;
  isOffWork: boolean;
};

export const DEFAULT_WORK_COUNTDOWN: WorkCountdownSettings = {
  workStart: '09:00',
  lunchStart: '12:00',
  lunchEnd: '13:30',
  workEnd: '18:00',
  roasts: {
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
  },
};

function parseTimeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesNow(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.ceil(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins} 分钟`;
  if (mins <= 0) return `${hours} 小时`;
  return `${hours} 小时 ${mins} 分钟`;
}

function pickRoast(roasts: string[], seed: number) {
  if (!roasts.length) return '';
  return roasts[Math.abs(seed) % roasts.length];
}

export function getWorkCountdownStatus(settings: WorkCountdownSettings, date = new Date()): WorkCountdownStatus {
  const now = minutesNow(date);
  const workStart = parseTimeToMinutes(settings.workStart);
  const lunchStart = parseTimeToMinutes(settings.lunchStart);
  const lunchEnd = parseTimeToMinutes(settings.lunchEnd);
  const workEnd = parseTimeToMinutes(settings.workEnd);
  const totalWorkMinutes = Math.max(1, workEnd - workStart - Math.max(0, lunchEnd - lunchStart));
  const morningWorked = Math.max(0, Math.min(now, lunchStart) - workStart);
  const afternoonWorked = Math.max(0, Math.min(now, workEnd) - lunchEnd);
  const workedMinutes = Math.max(0, Math.min(totalWorkMinutes, morningWorked + afternoonWorked));
  const minutesToOffWork = workEnd - now;
  const tone: RoastTone = minutesToOffWork > 240 ? 'encourage' : minutesToOffWork > 60 ? 'normal' : 'almost';
  const seed = date.getFullYear() + date.getMonth() + date.getDate() + date.getHours();

  if (now < workStart) {
    return {
      label: '距离上班还有',
      remainingText: formatMinutes(workStart - now),
      workDurationText: '今日已工作 0 分钟',
      roast: '还没开始打工，先别让公司提前污染心情。',
      tone: 'encourage',
      progress: 0,
      isOffWork: false,
    };
  }

  if (now < lunchStart) {
    return {
      label: '距离午休还有',
      remainingText: formatMinutes(lunchStart - now),
      workDurationText: `今日已工作 ${formatMinutes(workedMinutes)}`,
      roast: pickRoast(settings.roasts.encourage, seed),
      tone: 'encourage',
      progress: (workedMinutes / totalWorkMinutes) * 100,
      isOffWork: false,
    };
  }

  if (now < lunchEnd) {
    return {
      label: '距离下午上班还有',
      remainingText: formatMinutes(lunchEnd - now),
      workDurationText: `今日已工作 ${formatMinutes(workedMinutes)}`,
      roast: '午休时间神圣不可侵犯，公司的破事先排队等死。',
      tone: 'normal',
      progress: (workedMinutes / totalWorkMinutes) * 100,
      isOffWork: false,
    };
  }

  if (now < workEnd) {
    return {
      label: '距离下班还有',
      remainingText: formatMinutes(minutesToOffWork),
      workDurationText: `今日已工作 ${formatMinutes(workedMinutes)}`,
      roast: pickRoast(settings.roasts[tone], seed),
      tone,
      progress: (workedMinutes / totalWorkMinutes) * 100,
      isOffWork: false,
    };
  }

  return {
    label: '已经下班',
    remainingText: '自由时间',
    workDurationText: `今日已工作 ${formatMinutes(totalWorkMinutes)}`,
    roast: '今天的打工副本已通关，公司请停止追杀。',
    tone: 'almost',
    progress: 100,
    isOffWork: true,
  };
}
