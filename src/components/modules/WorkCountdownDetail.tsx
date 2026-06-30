import { useEffect, useState } from 'react';
import { DetailShell } from './DetailShell';
import { DEFAULT_WORK_COUNTDOWN, getWorkCountdownStatus, type RoastTone, type WorkCountdownSettings } from './workCountdown';

type WorkCountdownDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

const roastLabels: Record<RoastTone, string> = {
  encourage: '超过 4 小时',
  normal: '1 到 4 小时',
  almost: '1 小时内',
};

function normalizeSettings(settings: WorkCountdownSettings | null): WorkCountdownSettings {
  return settings ?? DEFAULT_WORK_COUNTDOWN;
}

export function WorkCountdownDetail({ onBack, onClose }: WorkCountdownDetailProps) {
  const [settings, setSettings] = useState<WorkCountdownSettings>(DEFAULT_WORK_COUNTDOWN);
  const [now, setNow] = useState(() => new Date());
  const [savedText, setSavedText] = useState('');

  useEffect(() => {
    void window.workCountdownAPI.getSettings().then((nextSettings) => setSettings(normalizeSettings(nextSettings)));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const status = getWorkCountdownStatus(settings, now);

  const updateTime = (key: keyof Pick<WorkCountdownSettings, 'workStart' | 'lunchStart' | 'lunchEnd' | 'workEnd'>, value: string) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateRoasts = (tone: RoastTone, value: string) => {
    setSettings((current) => ({
      ...current,
      roasts: {
        ...current.roasts,
        [tone]: value.split('\n').map((item) => item.trim()).filter(Boolean),
      },
    }));
  };

  const saveSettings = async () => {
    const nextSettings = await window.workCountdownAPI.saveSettings(settings);
    setSettings(nextSettings);
    setSavedText('已保存');
    window.setTimeout(() => setSavedText(''), 1400);
  };

  return (
    <DetailShell title="下班倒计时" onBack={onBack} onClose={onClose}>
      <section className="work-countdown-panel">
        <div className={`work-countdown-hero tone-${status.tone}`}>
          <span>{status.label}</span>
          <strong>{status.remainingText}</strong>
          <em>{status.workDurationText}</em>
          <p>{status.roast}</p>
          <div className="work-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(100, Math.max(0, status.progress)) / 100})` }} />
          </div>
        </div>

        <div className="work-time-grid">
          <label>
            <span>上班</span>
            <input type="time" value={settings.workStart} onChange={(event) => updateTime('workStart', event.target.value)} />
          </label>
          <label>
            <span>午休开始</span>
            <input type="time" value={settings.lunchStart} onChange={(event) => updateTime('lunchStart', event.target.value)} />
          </label>
          <label>
            <span>下午上班</span>
            <input type="time" value={settings.lunchEnd} onChange={(event) => updateTime('lunchEnd', event.target.value)} />
          </label>
          <label>
            <span>下班</span>
            <input type="time" value={settings.workEnd} onChange={(event) => updateTime('workEnd', event.target.value)} />
          </label>
        </div>

        <div className="roast-editor">
          {(Object.keys(roastLabels) as RoastTone[]).map((tone) => (
            <label key={tone}>
              <span>{roastLabels[tone]}文案</span>
              <textarea value={settings.roasts[tone].join('\n')} onChange={(event) => updateRoasts(tone, event.target.value)} />
            </label>
          ))}
        </div>

        <div className="work-actions">
          <button type="button" onClick={() => setSettings(DEFAULT_WORK_COUNTDOWN)}>
            恢复默认
          </button>
          <button type="button" className="primary" onClick={saveSettings}>
            保存设置
          </button>
          <span>{savedText}</span>
        </div>
      </section>
    </DetailShell>
  );
}
