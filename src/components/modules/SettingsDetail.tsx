import { useState } from 'react';
import { DetailShell } from './DetailShell';

type BackupStatus = 'idle' | 'running' | 'success' | 'error';

type SettingsDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

function getStatusText(status: BackupStatus, action: 'export' | 'import' | null) {
  if (status === 'running') return action === 'import' ? '正在恢复本地数据...' : '正在生成备份文件...';
  if (status === 'success') return action === 'import' ? '数据已恢复，正在重新加载' : '备份文件已保存';
  if (status === 'error') return action === 'import' ? '恢复失败，请检查备份文件后重试' : '备份失败，请稍后重试';
  return '';
}

export function SettingsDetail({ onBack, onClose }: SettingsDetailProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle');
  const [backupAction, setBackupAction] = useState<'export' | 'import' | null>(null);
  const [progress, setProgress] = useState(0);

  const runWithProgress = async (action: 'export' | 'import', task: () => Promise<{ ok: boolean; canceled: boolean }>) => {
    setBackupAction(action);
    setBackupStatus('running');
    setProgress(18);

    window.setTimeout(() => setProgress((current) => Math.max(current, 64)), 120);
    const result = await task();

    if (result.canceled) {
      setBackupStatus('idle');
      setProgress(0);
      setBackupAction(null);
      return;
    }

    if (result.ok) {
      setProgress(100);
      setBackupStatus('success');
      if (action === 'import') {
        window.setTimeout(() => window.location.reload(), 700);
      } else {
        window.setTimeout(() => {
          setBackupStatus('idle');
          setProgress(0);
          setBackupAction(null);
        }, 1800);
      }
      return;
    }

    setProgress(100);
    setBackupStatus('error');
  };

  const exportData = () => {
    void runWithProgress('export', () => window.backupAPI.exportData());
  };

  const importData = () => {
    const confirmed = window.confirm('恢复备份会覆盖当前本地数据。确定继续吗？');
    if (!confirmed) return;
    void runWithProgress('import', () => window.backupAPI.importData());
  };

  const openDataDirectory = () => {
    void window.backupAPI.openDataDirectory();
  };

  const statusText = getStatusText(backupStatus, backupAction);
  const controlsDisabled = backupStatus === 'running';

  return (
    <DetailShell title="设置" onBack={onBack} onClose={onClose}>
      <section className="settings-detail-card">
        <span className="eyebrow">数据备份与迁移</span>
        <strong className="truncate">备份、恢复或查看本地数据</strong>
        <p className="settings-note">备份会包含每日计划、结转记录、阅读进度、照片轮播、主题、置顶、停靠位置和其他本地设置。</p>

        <div className="backup-actions">
          <button type="button" onClick={exportData} disabled={controlsDisabled}>
            备份数据
          </button>
          <button type="button" onClick={importData} disabled={controlsDisabled}>
            恢复备份
          </button>
          <button type="button" onClick={openDataDirectory} disabled={controlsDisabled}>
            打开数据目录
          </button>
        </div>

        {(backupStatus !== 'idle' || progress > 0) && (
          <div className={`backup-progress ${backupStatus}`}>
            <div className="backup-progress-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <span>{statusText}</span>
          </div>
        )}
      </section>
    </DetailShell>
  );
}
