import { useEffect, useMemo, useState } from 'react';
import { DetailShell } from './DetailShell';

type SeparatorKey = 'underscore' | 'dash' | 'space' | 'none';
type DateFormatKey = 'yyyymmdd' | 'dash' | 'cn' | 'monthDay';

type FileNameTemplate = {
  id: string;
  name: string;
  pattern: string;
  createdAt: string;
};

type FileNameFields = {
  projectName: string;
  productName: string;
  shopName: string;
  fileType: string;
  date: string;
  version: string;
  remark: string;
};

const DEFAULT_PATTERN = '日期_产品名_项目名_文件类型_版本号';
const TOKEN_KEYS = ['日期', '产品名', '项目名', '店铺名', '文件类型', '版本号', '备注'] as const;
const separators: Record<SeparatorKey, string> = {
  underscore: '_',
  dash: '-',
  space: ' ',
  none: '',
};

const separatorLabels: Record<SeparatorKey, string> = {
  underscore: '下划线 _',
  dash: '短横线 -',
  space: '空格',
  none: '无分隔符',
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(date = new Date(), format: DateFormatKey) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  if (format === 'dash') return `${year}-${month}-${day}`;
  if (format === 'cn') return `${year}年${month}月${day}日`;
  if (format === 'monthDay') return `${month}.${day}`;
  return `${year}${month}${day}`;
}

function sanitizePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitPattern(pattern: string) {
  return pattern
    .split(/[_\-\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function tokenValue(token: string, fields: FileNameFields) {
  const values: Record<string, string> = {
    日期: fields.date,
    产品名: fields.productName,
    项目名: fields.projectName,
    店铺名: fields.shopName,
    文件类型: fields.fileType,
    版本号: fields.version,
    备注: fields.remark,
  };
  return values[token] ?? token;
}

function generateFileName(pattern: string, fields: FileNameFields, separator: SeparatorKey) {
  const parts = splitPattern(pattern)
    .map((token) => sanitizePart(tokenValue(token, fields)))
    .filter(Boolean);
  return parts.join(separators[separator]);
}

function safeCopy(value: string) {
  if (!value) return;
  void navigator.clipboard?.writeText(value);
}

export function FileNamerDetail({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [dateFormat, setDateFormat] = useState<DateFormatKey>('yyyymmdd');
  const [separator, setSeparator] = useState<SeparatorKey>('underscore');
  const [templates, setTemplates] = useState<FileNameTemplate[]>([]);
  const [selectedPattern, setSelectedPattern] = useState(DEFAULT_PATTERN);
  const [customPattern, setCustomPattern] = useState(DEFAULT_PATTERN);
  const [templateName, setTemplateName] = useState('');
  const [message, setMessage] = useState('');
  const [templatePatternError, setTemplatePatternError] = useState('');
  const [fields, setFields] = useState<FileNameFields>(() => ({
    projectName: '',
    productName: '',
    shopName: '',
    fileType: '',
    date: formatDate(new Date(), 'yyyymmdd'),
    version: 'v1',
    remark: '',
  }));

  useEffect(() => {
    void window.fileNamingAPI.getTemplates().then((nextTemplates) => {
      setTemplates(nextTemplates);
      setSelectedPattern(nextTemplates[0]?.pattern ?? DEFAULT_PATTERN);
      setCustomPattern(nextTemplates[0]?.pattern ?? DEFAULT_PATTERN);
    });
  }, []);

  useEffect(() => {
    setFields((current) => ({ ...current, date: formatDate(new Date(), dateFormat) }));
  }, [dateFormat]);

  const generatedName = useMemo(() => generateFileName(selectedPattern, fields, separator), [fields, selectedPattern, separator]);

  const updateField = (key: keyof FileNameFields, value: string) => {
    setMessage('');
    setFields((current) => ({ ...current, [key]: value }));
  };

  const chooseTemplate = (pattern: string) => {
    setSelectedPattern(pattern);
    setCustomPattern(pattern);
  };

  const saveTemplate = async () => {
    const pattern = customPattern.trim();
    if (!pattern) {
      setTemplatePatternError('模板结构不能为空。');
      setMessage('');
      return;
    }
    setTemplatePatternError('');
    const nextTemplates = await window.fileNamingAPI.saveTemplate({
      name: templateName.trim() || pattern,
      pattern,
    });
    setTemplates(nextTemplates);
    setSelectedPattern(pattern);
    setTemplateName('');
    setMessage('模板已保存');
  };

  const deleteTemplate = async (id: string) => {
    const nextTemplates = await window.fileNamingAPI.deleteTemplate(id);
    setTemplates(nextTemplates);
    if (!nextTemplates.some((template) => template.pattern === selectedPattern)) {
      chooseTemplate(nextTemplates[0]?.pattern ?? DEFAULT_PATTERN);
    }
  };

  const insertToken = (token: (typeof TOKEN_KEYS)[number]) => {
    const nextPattern = customPattern ? `${customPattern}_${token}` : token;
    setCustomPattern(nextPattern);
    setSelectedPattern(nextPattern);
  };

  return (
    <DetailShell title="文件命名助手" onBack={onBack} onClose={onClose}>
      <section className="file-namer-page">
        <div className="file-namer-result">
          <span className="eyebrow">生成结果</span>
          <strong>{generatedName || '先输入产品名、项目名或文件类型'}</strong>
          <button type="button" onClick={() => safeCopy(generatedName)} disabled={!generatedName}>
            复制文件名
          </button>
        </div>

        <div className="file-namer-grid">
          <label>
            项目名
            <input value={fields.projectName} placeholder="A+图片" onChange={(event) => updateField('projectName', event.target.value)} />
          </label>
          <label>
            产品名
            <input value={fields.productName} placeholder="Dog Bowl" onChange={(event) => updateField('productName', event.target.value)} />
          </label>
          <label>
            店铺名
            <input value={fields.shopName} placeholder="店铺名，可选" onChange={(event) => updateField('shopName', event.target.value)} />
          </label>
          <label>
            文件类型
            <input value={fields.fileType} placeholder="主图" onChange={(event) => updateField('fileType', event.target.value)} />
          </label>
          <label>
            日期
            <input value={fields.date} onChange={(event) => updateField('date', event.target.value)} />
          </label>
          <label>
            版本号
            <input value={fields.version} placeholder="v1" onChange={(event) => updateField('version', event.target.value)} />
          </label>
        </div>

        <label className="file-namer-full">
          备注
          <input value={fields.remark} placeholder="可选，例如 已压缩 / 初稿" onChange={(event) => updateField('remark', event.target.value)} />
        </label>

        <div className="file-namer-options">
          <div>
            <span>日期格式</span>
            <div className="file-namer-segments">
              {[
                ['yyyymmdd', '20260605'],
                ['dash', '2026-06-05'],
                ['cn', '2026年06月05日'],
                ['monthDay', '06.05'],
              ].map(([key, label]) => (
                <button type="button" key={key} className={dateFormat === key ? 'active' : ''} onClick={() => setDateFormat(key as DateFormatKey)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>分隔符</span>
            <div className="file-namer-segments">
              {(Object.keys(separatorLabels) as SeparatorKey[]).map((key) => (
                <button type="button" key={key} className={separator === key ? 'active' : ''} onClick={() => setSeparator(key)}>
                  {separatorLabels[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="file-template-panel">
          <div className="file-template-head">
            <div>
              <span className="eyebrow">命名模板</span>
              <strong>选择或保存常用结构</strong>
            </div>
            {message ? <span>{message}</span> : null}
          </div>

          <div className="file-template-list">
            {templates.map((template) => (
              <button
                type="button"
                key={template.id}
                className={selectedPattern === template.pattern ? 'active' : ''}
                onClick={() => chooseTemplate(template.pattern)}
              >
                <span className="truncate">{template.name}</span>
                <em className="truncate">{template.pattern}</em>
              </button>
            ))}
          </div>

          <div className="file-token-row">
            {TOKEN_KEYS.map((token) => (
              <button type="button" key={token} onClick={() => insertToken(token)}>
                {token}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="file-template-name">
            模板名称
          </label>
          <input id="file-template-name" value={templateName} placeholder="模板名称，可选" onChange={(event) => setTemplateName(event.target.value)} />
          <div className="file-template-editor">
            <label className="sr-only" htmlFor="file-template-pattern">
              模板结构
            </label>
            <input
              id="file-template-pattern"
              value={customPattern}
              placeholder="例如 日期_产品名_项目名_版本号"
              aria-invalid={Boolean(templatePatternError)}
              aria-describedby={templatePatternError ? 'file-template-pattern-error' : undefined}
              onChange={(event) => {
                setCustomPattern(event.target.value);
                setSelectedPattern(event.target.value);
                if (templatePatternError) setTemplatePatternError('');
              }}
            />
            <button type="button" onClick={() => void saveTemplate()}>
              保存模板
            </button>
          </div>
          {templatePatternError ? (
            <span id="file-template-pattern-error" className="field-error" role="alert">
              {templatePatternError}
            </span>
          ) : null}

          <div className="file-template-delete-row">
            {templates
              .filter((template) => !template.id.startsWith('default-'))
              .map((template) => (
                <button type="button" key={template.id} onClick={() => void deleteTemplate(template.id)}>
                  删除 {template.name}
                </button>
              ))}
          </div>
        </section>
      </section>
    </DetailShell>
  );
}
