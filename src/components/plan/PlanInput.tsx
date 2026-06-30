import { KeyboardEvent, useState } from 'react';

type PlanInputProps = {
  onAdd: (text: string) => Promise<void>;
};

export function PlanInput({ onAdd }: PlanInputProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const cleanText = text.trim();
    if (!cleanText) {
      setError('先写下要添加的计划内容。');
      return;
    }
    if (saving) return;

    setError('');
    setSaving(true);
    try {
      await onAdd(cleanText);
      setText('');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="plan-input-row">
      <label className="sr-only" htmlFor="daily-plan-new-item">
        新增今日计划
      </label>
      <input
        id="daily-plan-new-item"
        value={text}
        placeholder="写下今天要做的一件事"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'daily-plan-new-item-error' : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError('');
        }}
        onKeyDown={handleKeyDown}
      />
      <button type="button" onClick={() => void submit()} disabled={!text.trim() || saving}>
        {saving ? '保存中' : '添加'}
      </button>
      {error ? (
        <span id="daily-plan-new-item-error" className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
