import { useState } from 'react';
import { DetailShell } from './DetailShell';

const SUPPORT_EMAIL = 'lijingsheng02@gmail.com';

type AuthorSupportDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

export function AuthorSupportDetail({ onBack, onClose }: AuthorSupportDetailProps) {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    await navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <DetailShell title="作者支持" onBack={onBack} onClose={onClose}>
      <section className="settings-detail-card author-support-card">
        <span className="eyebrow">联系与支持</span>
        <strong className="truncate">梨子开发的 Windows 灵动岛</strong>
        <p className="settings-note">
          如果你需要定制功能、优化使用流程、调整界面、迁移数据，或者遇到异常和不顺手的地方，可以通过邮箱联系我。
        </p>

        <div className="author-support-email">
          <span>邮箱</span>
          <strong>{SUPPORT_EMAIL}</strong>
        </div>

        <div className="backup-actions">
          <button type="button" onClick={copyEmail}>
            {copied ? '已复制' : '复制邮箱'}
          </button>
          <a className="button-like" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Dynamic Island 功能定制 / 使用反馈')}`}>
            写邮件联系
          </a>
        </div>
      </section>

      <section className="settings-detail-card author-support-card">
        <span className="eyebrow">可支持内容</span>
        <strong className="truncate">定制、优化与问题反馈</strong>
        <div className="support-list">
          <span>定制新的办公效率功能</span>
          <span>优化现有功能的交互和界面</span>
          <span>修复使用中遇到的异常问题</span>
          <span>协助迁移或备份本地数据</span>
        </div>
      </section>
    </DetailShell>
  );
}
