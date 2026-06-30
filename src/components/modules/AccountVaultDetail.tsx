import { useEffect, useMemo, useRef, useState } from 'react';
import { DetailShell } from './DetailShell';

type AccountRecord = {
  id: string;
  platform: string;
  account: string;
  password: string;
  email: string;
  phone: string;
  note: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type AccountDraft = Omit<AccountRecord, 'id' | 'createdAt' | 'updatedAt'>;
type VaultFieldErrors = Partial<Record<'masterPassword' | 'confirmPassword' | 'platform' | 'account', string>>;

type AccountVaultDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

const EMPTY_DRAFT: AccountDraft = {
  platform: '',
  account: '',
  password: '',
  email: '',
  phone: '',
  note: '',
  url: '',
};

const AUTO_LOCK_MS = 3 * 60 * 1000;

function normalizeDraft(record: Partial<AccountRecord> = {}): AccountDraft {
  return {
    platform: record.platform ?? '',
    account: record.account ?? '',
    password: record.password ?? '',
    email: record.email ?? '',
    phone: record.phone ?? '',
    note: record.note ?? '',
    url: record.url ?? '',
  };
}

function matchesSearch(record: AccountRecord, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return [record.platform, record.account, record.email, record.phone, record.note, record.url]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

export function AccountVaultDetail({ onBack, onClose }: AccountVaultDetailProps) {
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [records, setRecords] = useState<AccountRecord[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [draftPasswordVisible, setDraftPasswordVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<VaultFieldErrors>({});
  const autoLockTimerRef = useRef<number | null>(null);

  const lockVault = () => {
    setUnlocked(false);
    setRecords([]);
    setMasterPassword('');
    setConfirmPassword('');
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setVisiblePasswords({});
    setDraftPasswordVisible(false);
    void window.passwordVaultAPI.lock();
  };

  const resetAutoLockTimer = () => {
    if (!unlocked) return;
    if (autoLockTimerRef.current !== null) {
      window.clearTimeout(autoLockTimerRef.current);
    }
    autoLockTimerRef.current = window.setTimeout(lockVault, AUTO_LOCK_MS);
  };

  useEffect(() => {
    let mounted = true;
    void window.passwordVaultAPI.getStatus().then((status) => {
      if (!mounted) return;
      setConfigured(status.configured);
      setUnlocked(status.unlocked);
      if (status.unlocked) {
        void window.passwordVaultAPI.list().then((nextRecords) => {
          if (mounted) setRecords(nextRecords);
        });
      }
    });

    return () => {
      mounted = false;
      if (autoLockTimerRef.current !== null) {
        window.clearTimeout(autoLockTimerRef.current);
      }
      void window.passwordVaultAPI.lock();
    };
  }, []);

  useEffect(() => {
    resetAutoLockTimer();
  }, [unlocked]);

  const filteredRecords = useMemo(() => records.filter((record) => matchesSearch(record, search)), [records, search]);
  const isEditing = Boolean(editingId);

  const copyValue = async (value: string, label: string) => {
    resetAutoLockTimer();
    if (!value) {
      setMessage(`${label}为空，不能复制`);
      return;
    }
    const ok = await window.passwordVaultAPI.copyText(value);
    setMessage(ok ? `${label}已复制` : `${label}复制失败`);
  };

  const submitUnlock = async () => {
    setMessage('');
    setFieldErrors({});
    if (!masterPassword.trim()) {
      setFieldErrors({ masterPassword: '请输入查看密码。' });
      return;
    }
    try {
      const nextRecords = await window.passwordVaultAPI.unlock(masterPassword);
      setRecords(nextRecords);
      setUnlocked(true);
      setMasterPassword('');
    } catch {
      setFieldErrors({ masterPassword: '查看密码错误。' });
    }
  };

  const submitSetup = async () => {
    setMessage('');
    setFieldErrors({});
    if (masterPassword.length < 6) {
      setFieldErrors({ masterPassword: '查看密码至少 6 位。' });
      return;
    }
    if (masterPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: '两次输入的查看密码不一致。' });
      return;
    }

    try {
      await window.passwordVaultAPI.setup(masterPassword);
      setConfigured(true);
      setUnlocked(true);
      setMasterPassword('');
      setConfirmPassword('');
      setRecords([]);
    } catch {
      setFieldErrors({ masterPassword: '设置失败，请换一个查看密码重试。' });
    }
  };

  const resetVault = async () => {
    const confirmed = window.confirm('清空后无法恢复，确定要清空账号密码库并重新设置吗？');
    if (!confirmed) return;
    await window.passwordVaultAPI.reset();
    setConfigured(false);
    setUnlocked(false);
    setRecords([]);
    setMasterPassword('');
    setConfirmPassword('');
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setMessage('账号密码库已清空');
  };

  const saveRecord = async () => {
    resetAutoLockTimer();
    setMessage('');
    setFieldErrors({});
    if (!draft.platform.trim() || !draft.account.trim()) {
      setFieldErrors({
        platform: draft.platform.trim() ? undefined : '平台名称不能为空。',
        account: draft.account.trim() ? undefined : '账号不能为空。',
      });
      return;
    }

    if (editingId) {
      setRecords(await window.passwordVaultAPI.update(editingId, draft));
      setEditingId(null);
    } else {
      setRecords(await window.passwordVaultAPI.add(draft));
    }
    setDraft(EMPTY_DRAFT);
    setDraftPasswordVisible(false);
    setMessage('已保存');
  };

  const editRecord = (record: AccountRecord) => {
    resetAutoLockTimer();
    setEditingId(record.id);
    setDraft(normalizeDraft(record));
    setDraftPasswordVisible(true);
  };

  const deleteRecord = async (id: string) => {
    resetAutoLockTimer();
    const confirmed = window.confirm('确定删除这条账号记录吗？');
    if (!confirmed) return;
    setRecords(await window.passwordVaultAPI.delete(id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
      setDraftPasswordVisible(false);
    }
  };

  const updateDraft = (key: keyof AccountDraft, value: string) => {
    resetAutoLockTimer();
    if (key === 'platform' || key === 'account') {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const renderLockedState = () => (
    <section className="vault-lock-card">
      <span className="vault-lock-icon">钥</span>
      <strong>{configured ? '输入查看密码' : '设置查看密码'}</strong>
      <p>{configured ? '验证通过后才能查看已保存的账号内容。' : '查看密码不会明文保存；忘记后只能清空账号密码库重新设置。'}</p>
      <label className="sr-only" htmlFor="vault-master-password">
        {configured ? '查看密码' : '设置查看密码'}
      </label>
      <input
        id="vault-master-password"
        type="password"
        value={masterPassword}
        placeholder={configured ? '查看密码' : '设置查看密码'}
        aria-invalid={Boolean(fieldErrors.masterPassword)}
        aria-describedby={fieldErrors.masterPassword ? 'vault-master-password-error' : undefined}
        onChange={(event) => {
          setMasterPassword(event.target.value);
          if (fieldErrors.masterPassword) setFieldErrors((current) => ({ ...current, masterPassword: undefined }));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void (configured ? submitUnlock() : submitSetup());
        }}
      />
      {fieldErrors.masterPassword ? (
        <span id="vault-master-password-error" className="field-error" role="alert">
          {fieldErrors.masterPassword}
        </span>
      ) : null}
      {!configured ? (
        <>
          <label className="sr-only" htmlFor="vault-confirm-password">
            再次输入查看密码
          </label>
          <input
            id="vault-confirm-password"
            type="password"
            value={confirmPassword}
            placeholder="再次输入查看密码"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={fieldErrors.confirmPassword ? 'vault-confirm-password-error' : undefined}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (fieldErrors.confirmPassword) setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submitSetup();
            }}
          />
          {fieldErrors.confirmPassword ? (
            <span id="vault-confirm-password-error" className="field-error" role="alert">
              {fieldErrors.confirmPassword}
            </span>
          ) : null}
        </>
      ) : null}
      <button type="button" className="vault-primary-button" onClick={() => void (configured ? submitUnlock() : submitSetup())}>
        {configured ? '解锁' : '创建账号库'}
      </button>
      {configured ? (
        <button type="button" className="vault-ghost-button" onClick={() => void resetVault()}>
          忘记查看密码，清空账号库
        </button>
      ) : null}
      {message ? <span className="vault-message">{message}</span> : null}
    </section>
  );

  const renderVault = () => (
    <div className="vault-page" onPointerMove={resetAutoLockTimer} onKeyDown={resetAutoLockTimer}>
      <div className="vault-toolbar">
        <div>
          <span className="eyebrow">账号密码库</span>
          <strong>{records.length} 条记录</strong>
        </div>
        <button type="button" className="vault-lock-button" onClick={lockVault}>
          立即锁定
        </button>
      </div>

      <label className="sr-only" htmlFor="vault-search">
        搜索账号记录
      </label>
      <input id="vault-search" className="vault-search" value={search} placeholder="搜索平台、账号、邮箱、手机号..." onChange={(event) => setSearch(event.target.value)} />

      <section className="vault-editor">
        <div className="vault-editor-grid">
          <label>
            <span className="sr-only">平台名称</span>
            <input
              value={draft.platform}
              placeholder="平台名称"
              aria-invalid={Boolean(fieldErrors.platform)}
              aria-describedby={fieldErrors.platform ? 'vault-platform-error' : undefined}
              onChange={(event) => updateDraft('platform', event.target.value)}
            />
            {fieldErrors.platform ? (
              <span id="vault-platform-error" className="field-error" role="alert">
                {fieldErrors.platform}
              </span>
            ) : null}
          </label>
          <label>
            <span className="sr-only">账号</span>
            <input
              value={draft.account}
              placeholder="账号"
              aria-invalid={Boolean(fieldErrors.account)}
              aria-describedby={fieldErrors.account ? 'vault-account-error' : undefined}
              onChange={(event) => updateDraft('account', event.target.value)}
            />
            {fieldErrors.account ? (
              <span id="vault-account-error" className="field-error" role="alert">
                {fieldErrors.account}
              </span>
            ) : null}
          </label>
          <div className="vault-password-input">
            <label className="sr-only" htmlFor="vault-draft-password">
              密码
            </label>
            <input
              id="vault-draft-password"
              value={draft.password}
              placeholder="密码"
              type={draftPasswordVisible ? 'text' : 'password'}
              onChange={(event) => updateDraft('password', event.target.value)}
            />
            <button type="button" onClick={() => setDraftPasswordVisible((current) => !current)}>
              {draftPasswordVisible ? '隐藏' : '显示'}
            </button>
          </div>
          <label>
            <span className="sr-only">绑定邮箱</span>
            <input value={draft.email} placeholder="绑定邮箱" onChange={(event) => updateDraft('email', event.target.value)} />
          </label>
          <label>
            <span className="sr-only">绑定手机号</span>
            <input value={draft.phone} placeholder="绑定手机号" onChange={(event) => updateDraft('phone', event.target.value)} />
          </label>
          <label>
            <span className="sr-only">网址链接</span>
            <input value={draft.url} placeholder="网址链接" onChange={(event) => updateDraft('url', event.target.value)} />
          </label>
        </div>
        <label className="vault-note-field">
          <span className="sr-only">备注</span>
          <textarea value={draft.note} placeholder="备注" onChange={(event) => updateDraft('note', event.target.value)} />
        </label>
        <div className="vault-editor-actions">
          <button type="button" onClick={() => void saveRecord()}>
            {isEditing ? '保存修改' : '新增账号'}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
                setDraftPasswordVisible(false);
              }}
            >
              取消编辑
            </button>
          ) : null}
          {message ? <span>{message}</span> : null}
        </div>
      </section>

      <section className="vault-list">
        {filteredRecords.length === 0 ? (
          <div className="vault-empty">
            <strong>{records.length ? '没有匹配结果' : '还没有账号记录'}</strong>
            <span>{records.length ? '换一个关键词试试。' : '先添加第一条常用账号。'}</span>
          </div>
        ) : (
          filteredRecords.map((record) => {
            const passwordVisible = Boolean(visiblePasswords[record.id]);
            return (
              <article className="vault-record" key={record.id}>
                <div className="vault-record-head">
                  <div>
                    <strong className="truncate">{record.platform}</strong>
                    <span className="truncate">{record.url || record.note || '无备注'}</span>
                  </div>
                  <div className="vault-record-actions">
                    <button type="button" onClick={() => editRecord(record)}>
                      编辑
                    </button>
                    <button type="button" className="danger" onClick={() => void deleteRecord(record.id)}>
                      删除
                    </button>
                  </div>
                </div>

                <div className="vault-fields">
                  <span>
                    账号 <b>{record.account || '-'}</b>
                  </span>
                  <span>
                    密码 <b className={passwordVisible ? 'visible-password' : ''}>{passwordVisible ? record.password || '-' : record.password ? '••••••••' : '-'}</b>
                  </span>
                  <span>
                    邮箱 <b>{record.email || '-'}</b>
                  </span>
                  <span>
                    手机 <b>{record.phone || '-'}</b>
                  </span>
                </div>

                <div className="vault-copy-actions">
                  <button type="button" onClick={() => void copyValue(record.account, '账号')}>
                    复制账号
                  </button>
                  <button type="button" onClick={() => void copyValue(record.password, '密码')}>
                    复制密码
                  </button>
                  <button type="button" onClick={() => setVisiblePasswords((current) => ({ ...current, [record.id]: !passwordVisible }))}>
                    {passwordVisible ? '隐藏密码' : '显示密码'}
                  </button>
                  {record.url ? (
                    <button type="button" onClick={() => void copyValue(record.url, '网址')}>
                      复制网址
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );

  return (
    <DetailShell title="账号密码库" onBack={onBack} onClose={onClose}>
      {unlocked ? renderVault() : renderLockedState()}
    </DetailShell>
  );
}
