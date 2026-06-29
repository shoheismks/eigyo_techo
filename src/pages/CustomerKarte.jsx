import { useMemo, useState } from 'react';
import { PIPELINE_STATUSES } from './Pipeline.jsx';
import { createDummyKarteAnalysis, getCustomerKarte } from '../services/customerKarteService.js';
import { uploadAttachment } from '../services/storageService.js';
import { normalizeAttachmentRecord } from '../hooks/useAttachments.js';

const DEAL_TYPES = ['メール', '電話', '商談', '訪問', '見積', 'その他'];
const COMPLAINT_STATUSES = ['未対応', '対応中', '完了'];
const COMPLAINT_SEVERITIES = ['通常', '高', '重大'];

const emptyContact = {
  name: '',
  department: '',
  role: '',
  email: '',
  phone: '',
  mobile: '',
  decisionPower: '',
  memo: '',
};

const emptyBusinessCard = {
  file: null,
  rawText: '',
  name: '',
  companyName: '',
  department: '',
  role: '',
  email: '',
  phone: '',
  mobile: '',
  memo: '',
};

const emptyDeal = {
  date: '',
  type: '商談',
  contactIds: [],
  companionNames: '',
  createdByName: '',
  summary: '',
  nextAction: '',
  hasComplaint: false,
};

const emptyComplaint = {
  title: '',
  complaintType: '',
  occurredAt: '',
  status: '未対応',
  severity: '通常',
  cause: '',
  prevention: '',
  dueDate: '',
  resolvedAt: '',
  memo: '',
  createdByName: '',
};

function googleSearchUrl(companyName) {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName)}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ja-JP');
}

function formatPrice(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString('ja-JP') : value;
}

function parseBusinessCardText(text, fallbackCompanyName = '') {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phones = text.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/g) ?? [];
  const companyName = lines.find((line) => /株式会社|有限会社|合同会社|Inc\.|Co\./i.test(line)) ?? fallbackCompanyName;
  const name = lines.find((line) => !line.includes('@') && line.length <= 16 && !line.match(/\d/)) ?? '';
  const role = lines.find((line) => /代表|社長|部長|課長|主任|マネージャー|営業|購買|取締役/.test(line)) ?? '';

  return {
    companyName,
    name,
    role,
    email,
    phone: phones[0] ?? '',
    mobile: phones[1] ?? '',
  };
}

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="karte-section">
      <button className="karte-section-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <small>{count !== undefined ? `${count}件` : ''}</small>
        <strong>{open ? '-' : '+'}</strong>
      </button>
      {open && <div className="karte-section-body">{children}</div>}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div className="karte-field">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

function ReplyTree({ replies = [], depth = 1 }) {
  if (!replies.length) return null;

  return (
    <div className="history-replies">
      {replies.map((reply) => (
        <article className="history-reply" style={{ marginLeft: `${Math.min(depth, 3) * 14}px` }} key={reply.id}>
          <div className="history-meta">
            <span>{reply.type || '返信'}</span>
            <small>{formatDateTime(reply.createdAt)}</small>
          </div>
          <p>{reply.summary || '内容未入力'}</p>
          <ReplyTree replies={reply.replies ?? []} depth={depth + 1} />
        </article>
      ))}
    </div>
  );
}

export default function CustomerKarte({
  customerId,
  customers,
  contacts,
  businessCards,
  products,
  complaints,
  attachments,
  updateCustomer,
  addContact,
  addBusinessCard,
  addComplaint,
  addAttachment,
  setActivePage,
  user,
}) {
  const [contactForm, setContactForm] = useState(emptyContact);
  const [businessCardForm, setBusinessCardForm] = useState(emptyBusinessCard);
  const [showBusinessCardForm, setShowBusinessCardForm] = useState(false);
  const [previewCardUrl, setPreviewCardUrl] = useState('');
  const [dealForm, setDealForm] = useState(emptyDeal);
  const [complaintForm, setComplaintForm] = useState(emptyComplaint);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrError, setOcrError] = useState('');

  const karte = useMemo(
    () => getCustomerKarte({ customerId, customers, contacts, businessCards, products, complaints, attachments }),
    [attachments, businessCards, complaints, contacts, customerId, customers, products],
  );

  if (!karte) {
    return (
      <main className="page">
        <section className="empty-state">
          <h3>顧客が見つかりません</h3>
          <p>取引先一覧から顧客を選び直してください。</p>
          <button className="primary-button" onClick={() => setActivePage('Customers')}>取引先一覧へ</button>
        </section>
      </main>
    );
  }

  const { customer } = karte;
  const isHighRank = ['S', 'A'].includes(customer.customerRank || customer.rank);
  const hasComplaints = karte.complaints.length > 0 || karte.dealHistories.some((history) => history.hasComplaint);
  const canCreateMail = !customer.isDoNotContact;

  function updateCustomerField(field, value) {
    updateCustomer(customer.id, { [field]: value });
  }

  function updateTags(value) {
    updateCustomerField(
      'tags',
      value.split(',').map((tag) => tag.trim()).filter(Boolean),
    );
  }

  function handleAddContact(event) {
    event.preventDefault();
    if (!contactForm.name.trim()) return;

    addContact({
      ...contactForm,
      customerId: customer.id,
      companyName: customer.companyName,
      tags: contactForm.decisionPower ? [contactForm.decisionPower] : [],
    });
    setContactForm(emptyContact);
  }

  async function runBusinessCardOcr() {
    if (!businessCardForm.file) {
      setOcrError('名刺画像を選択してください。');
      return;
    }

    setOcrStatus('OCR中...');
    setOcrError('');

    try {
      const runtimeImport = new Function('specifier', 'return import(specifier)');
      const Tesseract = await runtimeImport('tesseract.js');
      const result = await Tesseract.recognize(businessCardForm.file, 'jpn+eng');
      const rawText = result.data.text ?? '';
      const extracted = parseBusinessCardText(rawText, customer.companyName);
      setBusinessCardForm((current) => ({ ...current, rawText, ...extracted }));
      setOcrStatus('OCR結果を確認して保存してください。');
    } catch {
      setOcrError('OCRライブラリが未導入または読み込み失敗です。手入力で保存できます。');
      setOcrStatus('');
    }
  }

  async function saveBusinessCard(event) {
    event.preventDefault();

    if (!businessCardForm.name.trim() && !businessCardForm.rawText.trim()) {
      setOcrError('氏名またはOCR結果を入力してください。');
      return;
    }

    setUploading(true);
    setOcrError('');
    setOcrStatus('');

    const cardId = crypto.randomUUID();
    let imageFile = null;

    try {
      if (businessCardForm.file) {
        imageFile = await uploadAttachment({
          file: businessCardForm.file,
          userId: user?.id ?? customer.userId,
          ownerType: 'business-card',
          ownerId: cardId,
          field: 'image',
        });
      }

      const contactId = addContact({
        customerId: customer.id,
        companyName: businessCardForm.companyName || customer.companyName,
        name: businessCardForm.name || '氏名未取得',
        department: businessCardForm.department,
        role: businessCardForm.role,
        email: businessCardForm.email,
        phone: businessCardForm.phone,
        mobile: businessCardForm.mobile,
        memo: businessCardForm.memo || businessCardForm.rawText,
        tags: ['名刺'],
      });

      addBusinessCard({
        id: cardId,
        contactId,
        customerId: customer.id,
        rawText: businessCardForm.rawText,
        imageFile,
        extracted: {
          companyName: businessCardForm.companyName || customer.companyName,
          name: businessCardForm.name,
          department: businessCardForm.department,
          role: businessCardForm.role,
          email: businessCardForm.email,
          phone: businessCardForm.phone,
          mobile: businessCardForm.mobile,
        },
      });

      setBusinessCardForm(emptyBusinessCard);
      setShowBusinessCardForm(false);
      setOcrStatus('名刺から担当者を作成しました。');
    } catch (error) {
      setOcrError(error.message || '名刺の保存に失敗しました。');
    } finally {
      setUploading(false);
    }
  }

  function handleAddDeal(event) {
    event.preventDefault();
    if (!dealForm.summary.trim()) return;

    const selectedContacts = karte.contacts.filter((contact) => dealForm.contactIds.includes(contact.id));
    const now = new Date().toISOString();
    updateCustomerField('dealHistories', [
      {
        id: crypto.randomUUID(),
        date: dealForm.date || now.slice(0, 10),
        type: dealForm.type,
        summary: dealForm.summary,
        nextAction: dealForm.nextAction,
        contactIds: selectedContacts.map((contact) => contact.id),
        contactNames: selectedContacts.map((contact) => contact.name),
        companionUsers: [],
        companionNames: dealForm.companionNames.split(',').map((name) => name.trim()).filter(Boolean),
        createdBy: user?.id ?? customer.userId,
        createdByName: dealForm.createdByName || user?.email || '',
        hasComplaint: dealForm.hasComplaint,
        createdAt: now,
        replies: [],
      },
      ...(customer.dealHistories ?? []),
    ]);
    updateCustomer(customer.id, { lastContactDate: dealForm.date || now.slice(0, 10) });
    setDealForm(emptyDeal);
  }

  function handleAddComplaint(event) {
    event.preventDefault();
    if (!complaintForm.title.trim()) return;

    addComplaint({
      ...complaintForm,
      customerId: customer.id,
      customerName: customer.companyName,
      title: complaintForm.title,
      status: complaintForm.status,
      severity: complaintForm.severity,
      memo: [
        complaintForm.complaintType && `種別: ${complaintForm.complaintType}`,
        complaintForm.memo,
        complaintForm.cause && `原因: ${complaintForm.cause}`,
        complaintForm.prevention && `再発防止策: ${complaintForm.prevention}`,
        complaintForm.occurredAt && `発生日: ${complaintForm.occurredAt}`,
        complaintForm.dueDate && `対応期限: ${complaintForm.dueDate}`,
        complaintForm.resolvedAt && `解決日: ${complaintForm.resolvedAt}`,
      ].filter(Boolean).join('\n'),
      createdBy: user?.id ?? customer.userId,
      createdByName: complaintForm.createdByName || user?.email || '',
    });
    setComplaintForm(emptyComplaint);
  }

  function handleAddProduct() {
    if (!selectedProductId) return;
    const current = customer.proposedProducts ?? [];
    if (current.includes(selectedProductId)) return;
    updateCustomerField('proposedProducts', [...current, selectedProductId]);
    setSelectedProductId('');
  }

  async function handleAttachment(file, field = 'customer-file') {
    if (!file) return;

    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadAttachment({
        file,
        userId: user?.id ?? customer.userId,
        ownerType: 'customer',
        ownerId: customer.id,
        field,
      });
      addAttachment(normalizeAttachmentRecord({
        ...uploaded,
        userId: user?.id ?? customer.userId,
        ownerType: 'customer',
        ownerId: customer.id,
        metadata: { customerId: customer.id, companyName: customer.companyName },
      }, user?.id ?? customer.userId));
    } catch (error) {
      setUploadError(error.message || '添付ファイルのアップロードに失敗しました。');
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="page karte-page">
      <header className={`karte-header ${isHighRank ? 'high-rank' : ''} ${hasComplaints ? 'has-complaint' : ''}`}>
        <div>
          <button className="text-button" onClick={() => setActivePage('Customers')}>一覧へ</button>
          <p className="eyebrow">Customer Karte</p>
          <h1>{customer.companyName}</h1>
          <div className="lead-badges">
            <span className="status-pill active">{customer.status}</span>
            <span className="info-badge ready">Rank {customer.customerRank || customer.rank || 'D'}</span>
            <span className="info-badge">Score {customer.score ?? 0}</span>
            {hasComplaints && <span className="info-badge failed">クレームあり</span>}
            {customer.isDoNotContact && <span className="info-badge failed">NG/配信停止</span>}
          </div>
        </div>
        <div className="karte-header-actions">
          <a className="ghost-button external-button" href={googleSearchUrl(customer.companyName)} target="_blank" rel="noreferrer">Google検索</a>
          {customer.website && <a className="ghost-button external-button" href={customer.website} target="_blank" rel="noreferrer">公式サイト</a>}
          {canCreateMail && <button className="primary-button" onClick={() => setActivePage('MailAI')}>AIメール作成</button>}
        </div>
      </header>

      <div className="karte-grid">
        <Section title="基本情報">
          <div className="karte-field-grid">
            <Field label="会社名" value={customer.companyName} />
            <Field label="正式社名" value={customer.officialName || customer.companyName} />
            <Field label="業種" value={customer.industry} />
            <Field label="地域" value={customer.area} />
            <Field label="住所" value={customer.address} />
            <Field label="電話" value={customer.phone} />
            <Field label="Webサイト" value={customer.website} />
            <Field label="メール" value={customer.email} />
            <Field label="問い合わせURL" value={customer.inquiryUrl} />
            <Field label="ステータス" value={customer.status} />
            <Field label="重要度スコア" value={customer.score ?? 0} />
            <Field label="重要度ランク" value={customer.customerRank || customer.rank || 'D'} />
          </div>
          <label className="field-label">
            タグ
            <input value={(customer.tags ?? []).join(', ')} onChange={(event) => updateTags(event.target.value)} />
          </label>
          <label className="field-label">
            会社備考
            <textarea value={customer.companyNote || ''} onChange={(event) => updateCustomerField('companyNote', event.target.value)} />
          </label>
          <label className="field-label">
            ステータス
            <select value={customer.status} onChange={(event) => updateCustomerField('status', event.target.value)}>
              {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </Section>

        <Section title="担当者・名刺" count={karte.contacts.length + karte.businessCards.length}>
          <form className="karte-inline-form" onSubmit={handleAddContact}>
            <div className="date-grid">
              <input placeholder="氏名" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
              <input placeholder="部署" value={contactForm.department} onChange={(event) => setContactForm({ ...contactForm, department: event.target.value })} />
            </div>
            <div className="date-grid">
              <input placeholder="役職" value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} />
              <input placeholder="決裁権" value={contactForm.decisionPower} onChange={(event) => setContactForm({ ...contactForm, decisionPower: event.target.value })} />
            </div>
            <div className="date-grid">
              <input placeholder="メール" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} />
              <input placeholder="電話/携帯" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} />
            </div>
            <textarea placeholder="人物メモ" value={contactForm.memo} onChange={(event) => setContactForm({ ...contactForm, memo: event.target.value })} />
            <button className="primary-button" type="submit">担当者追加</button>
            <button className="ghost-button" type="button" onClick={() => setShowBusinessCardForm((value) => !value)}>名刺を追加</button>
          </form>

          {showBusinessCardForm && (
            <form className="karte-inline-form business-card-form" onSubmit={saveBusinessCard}>
              <label className="field-label file-field">
                名刺画像
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => setBusinessCardForm({ ...businessCardForm, file: event.target.files?.[0] ?? null })}
                />
              </label>
              <button className="ghost-button" type="button" disabled={uploading} onClick={runBusinessCardOcr}>OCRする</button>
              <label className="field-label">
                OCR結果
                <textarea
                  value={businessCardForm.rawText}
                  placeholder="OCR結果を確認・編集できます。手入力でも保存できます。"
                  onChange={(event) => {
                    const rawText = event.target.value;
                    setBusinessCardForm({ ...businessCardForm, rawText, ...parseBusinessCardText(rawText, customer.companyName) });
                  }}
                />
              </label>
              <div className="date-grid">
                <input placeholder="会社名" value={businessCardForm.companyName} onChange={(event) => setBusinessCardForm({ ...businessCardForm, companyName: event.target.value })} />
                <input placeholder="氏名" value={businessCardForm.name} onChange={(event) => setBusinessCardForm({ ...businessCardForm, name: event.target.value })} />
              </div>
              <div className="date-grid">
                <input placeholder="部署" value={businessCardForm.department} onChange={(event) => setBusinessCardForm({ ...businessCardForm, department: event.target.value })} />
                <input placeholder="役職" value={businessCardForm.role} onChange={(event) => setBusinessCardForm({ ...businessCardForm, role: event.target.value })} />
              </div>
              <div className="date-grid">
                <input placeholder="メール" value={businessCardForm.email} onChange={(event) => setBusinessCardForm({ ...businessCardForm, email: event.target.value })} />
                <input placeholder="電話" value={businessCardForm.phone} onChange={(event) => setBusinessCardForm({ ...businessCardForm, phone: event.target.value })} />
              </div>
              <input placeholder="携帯" value={businessCardForm.mobile} onChange={(event) => setBusinessCardForm({ ...businessCardForm, mobile: event.target.value })} />
              <textarea placeholder="人物メモ" value={businessCardForm.memo} onChange={(event) => setBusinessCardForm({ ...businessCardForm, memo: event.target.value })} />
              <button className="primary-button" type="submit" disabled={uploading}>{uploading ? '保存中...' : '名刺から担当者を作成'}</button>
              {ocrStatus && <p className="notice-text">{ocrStatus}</p>}
              {ocrError && <p className="error-text">{ocrError}</p>}
            </form>
          )}

          <div className="karte-card-list">
            {karte.contacts.map((contact) => {
              const cards = karte.businessCards.filter((card) => card.contactId === contact.id);
              return (
                <article className="karte-mini-card" key={contact.id}>
                  <h3>{contact.name}</h3>
                  <p>{contact.department || '-'} / {contact.role || '-'}</p>
                  <p>{contact.email || '-'} / {contact.mobile || contact.phone || '-'}</p>
                  <div className="lead-badges">
                    <span className="info-badge">重要度 {contact.importanceScore ?? 0}</span>
                    <span className="info-badge ready">Rank {contact.importanceRank || 'D'}</span>
                    {cards.length > 0 && <span className="info-badge ready">名刺 {cards.length}枚</span>}
                  </div>
                  <p className="inline-helper">{contact.memo || '人物メモなし'}</p>
                  <div className="business-card-thumb-grid">
                    {cards.map((card) => card.imageFile?.url && (
                      <button className="image-button" type="button" key={card.id} onClick={() => setPreviewCardUrl(card.imageFile.url)}>
                        <img className="karte-thumb" loading="lazy" src={card.imageFile.url} alt={`${contact.name}の名刺`} />
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          {karte.businessCards.length > 0 && (
            <div className="karte-card-list">
              <h3>登録済み名刺</h3>
              {karte.businessCards.map((card) => (
                <article className="karte-mini-card" key={card.id}>
                  <h3>{card.extracted?.name || '氏名未取得'}</h3>
                  <p>{card.extracted?.companyName || customer.companyName}</p>
                  {card.imageFile?.url && (
                    <button className="image-button" type="button" onClick={() => setPreviewCardUrl(card.imageFile.url)}>
                      <img className="karte-thumb" loading="lazy" src={card.imageFile.url} alt="名刺画像" />
                    </button>
                  )}
                  <p className="inline-helper">{card.rawText?.slice(0, 160) || 'OCRテキストなし'}</p>
                </article>
              ))}
            </div>
          )}
        </Section>

        <Section title="商談履歴" count={karte.dealHistories.length}>
          <form className="karte-inline-form" onSubmit={handleAddDeal}>
            <div className="date-grid">
              <input type="date" value={dealForm.date} onChange={(event) => setDealForm({ ...dealForm, date: event.target.value })} />
              <select value={dealForm.type} onChange={(event) => setDealForm({ ...dealForm, type: event.target.value })}>{DEAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            </div>
            <label className="field-label">
              商談相手
              <select multiple value={dealForm.contactIds} onChange={(event) => setDealForm({ ...dealForm, contactIds: [...event.target.selectedOptions].map((option) => option.value) })}>
                {karte.contacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.name}</option>)}
              </select>
            </label>
            <div className="date-grid">
              <input placeholder="同行者（カンマ区切り）" value={dealForm.companionNames} onChange={(event) => setDealForm({ ...dealForm, companionNames: event.target.value })} />
              <input placeholder="記載者" value={dealForm.createdByName} onChange={(event) => setDealForm({ ...dealForm, createdByName: event.target.value })} />
            </div>
            <textarea placeholder="商談内容" value={dealForm.summary} onChange={(event) => setDealForm({ ...dealForm, summary: event.target.value })} />
            <input placeholder="次回アクション" value={dealForm.nextAction} onChange={(event) => setDealForm({ ...dealForm, nextAction: event.target.value })} />
            <label className="switch-row"><input type="checkbox" checked={dealForm.hasComplaint} onChange={(event) => setDealForm({ ...dealForm, hasComplaint: event.target.checked })} /><span>クレームフラグ</span></label>
            <button className="primary-button" type="submit">商談履歴追加</button>
          </form>
          <div className="timeline-list">
            {karte.dealHistories.map((history) => (
              <article className={`history-card timeline-card ${history.hasComplaint ? 'ng-card' : ''}`} key={history.id}>
                <div className="history-meta"><span>{history.date || '-'} / {history.type}</span><small>{history.createdByName || history.createdBy || '-'}</small></div>
                <p>{history.summary || '内容未入力'}</p>
                <p className="inline-helper">相手: {(history.contactNames ?? []).join(', ') || '-'}</p>
                <p className="inline-helper">同行者: {(history.companionNames ?? []).join(', ') || '-'}</p>
                {history.nextAction && <p className="inline-helper">次回: {history.nextAction}</p>}
                {history.hasComplaint && <p className="ng-banner">クレームフラグあり</p>}
                <ReplyTree replies={history.replies ?? []} />
              </article>
            ))}
          </div>
        </Section>

        <Section title="クレーム履歴" count={karte.complaints.length} defaultOpen={hasComplaints}>
          <form className="karte-inline-form" onSubmit={handleAddComplaint}>
            <input placeholder="件名" value={complaintForm.title} onChange={(event) => setComplaintForm({ ...complaintForm, title: event.target.value })} />
            <div className="date-grid">
              <input placeholder="種別" value={complaintForm.complaintType} onChange={(event) => setComplaintForm({ ...complaintForm, complaintType: event.target.value })} />
              <input type="date" value={complaintForm.occurredAt} onChange={(event) => setComplaintForm({ ...complaintForm, occurredAt: event.target.value })} />
            </div>
            <div className="date-grid">
              <select value={complaintForm.status} onChange={(event) => setComplaintForm({ ...complaintForm, status: event.target.value })}>{COMPLAINT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
              <select value={complaintForm.severity} onChange={(event) => setComplaintForm({ ...complaintForm, severity: event.target.value })}>{COMPLAINT_SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}</select>
            </div>
            <textarea placeholder="内容" value={complaintForm.memo} onChange={(event) => setComplaintForm({ ...complaintForm, memo: event.target.value })} />
            <div className="date-grid">
              <input placeholder="原因" value={complaintForm.cause} onChange={(event) => setComplaintForm({ ...complaintForm, cause: event.target.value })} />
              <input placeholder="再発防止策" value={complaintForm.prevention} onChange={(event) => setComplaintForm({ ...complaintForm, prevention: event.target.value })} />
            </div>
            <div className="date-grid">
              <input type="date" value={complaintForm.dueDate} onChange={(event) => setComplaintForm({ ...complaintForm, dueDate: event.target.value })} />
              <input type="date" value={complaintForm.resolvedAt} onChange={(event) => setComplaintForm({ ...complaintForm, resolvedAt: event.target.value })} />
            </div>
            <input placeholder="記載者" value={complaintForm.createdByName} onChange={(event) => setComplaintForm({ ...complaintForm, createdByName: event.target.value })} />
            <button className="primary-button" type="submit">クレーム追加</button>
          </form>
          {karte.complaints.map((complaint) => (
            <article className="karte-mini-card ng-panel" key={complaint.id}>
              <h3>{complaint.title}</h3>
              <p>{complaint.status} / {complaint.severity}</p>
              <p>{complaint.memo || '-'}</p>
              <small>{complaint.createdByName || complaint.createdBy || '-'}</small>
            </article>
          ))}
        </Section>

        <Section title="提案商品" count={karte.products.length}>
          <div className="karte-inline-form">
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
              <option value="">商品を選択</option>
              {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
            </select>
            <button className="primary-button" type="button" onClick={handleAddProduct}>提案商品追加</button>
          </div>
          <div className="karte-card-list">
            {karte.products.map((product) => (
              <article className="product-card" key={product.id}>
                {product.imageFile?.url && <img className="product-preview-image" loading="lazy" src={product.imageFile.url} alt={product.name} />}
                <h3>{product.name}</h3>
                <dl className="company-details">
                  <div><dt>メーカー</dt><dd>{product.manufacturerName || '-'}</dd></div>
                  <div><dt>産地</dt><dd>{product.origin || '-'}</dd></div>
                  <div><dt>温度帯</dt><dd>{product.temperatureZone || '-'}</dd></div>
                  <div><dt>荷姿</dt><dd>{product.packageStyle || '-'}</dd></div>
                  <div><dt>原価</dt><dd>{formatPrice(product.costPrice)}円/{product.costUnit}</dd></div>
                  <div><dt>希望価格</dt><dd>{formatPrice(product.desiredSellingPrice)}円/{product.sellingPriceUnit}</dd></div>
                  <div><dt>粗利率</dt><dd>{product.grossMarginRate || '-'}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </Section>

        <Section title="添付ファイル" count={karte.attachments.length}>
          <label className="field-label file-field">顧客資料を追加<input type="file" onChange={(event) => handleAttachment(event.target.files?.[0])} /></label>
          {uploading && <p className="notice-text">アップロード中...</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}
          <div className="karte-card-list">
            {karte.attachments.map((attachment) => (
              <article className="karte-mini-card" key={attachment.id}>
                <h3>{attachment.name}</h3>
                <p>{attachment.contentType || 'file'} / {Math.ceil((attachment.sizeBytes ?? 0) / 1024)}KB</p>
                <p>アップロード日: {formatDateTime(attachment.createdAt)}</p>
                {attachment.publicUrl && <a className="ghost-button external-button" href={attachment.publicUrl} target="_blank" rel="noreferrer">開く</a>}
              </article>
            ))}
          </div>
        </Section>

        <Section title="フォロー情報">
          <div className="karte-field-grid">
            <Field label="次回フォロー日" value={customer.nextFollowUpDate || customer.nextFollowDate} />
            <Field label="最終接触日" value={customer.lastContactDate} />
            <Field label="未対応タスク" value={customer.pipelineMemo || customer.memo} />
            <Field label="今日やるべきこと" value={customer.nextFollowUpDate || customer.nextFollowDate ? 'フォロー内容を確認して連絡する' : '次回フォロー日を設定する'} />
          </div>
          <label className="field-label">次回フォロー日<input type="date" value={customer.nextFollowUpDate || customer.nextFollowDate || ''} onChange={(event) => updateCustomer(customer.id, { nextFollowUpDate: event.target.value, nextFollowDate: event.target.value })} /></label>
        </Section>

        <Section title="AI分析枠" defaultOpen={false}>
          <button className="primary-button" type="button" onClick={() => setAnalysis(createDummyKarteAnalysis(karte))}>AI分析を実行</button>
          {analysis && (
            <div className="ai-analysis-grid">
              <AnalysisBlock title="この顧客の特徴" items={analysis.features} />
              <AnalysisBlock title="提案しやすい商品" items={analysis.recommendedProducts} />
              <AnalysisBlock title="注意点" items={analysis.cautions} />
              <AnalysisBlock title="次にやるべきアクション" items={analysis.nextActions} />
            </div>
          )}
        </Section>
      </div>

      {previewCardUrl && (
        <div className="image-modal" role="dialog" aria-modal="true" onClick={() => setPreviewCardUrl('')}>
          <button className="image-modal-close" type="button">閉じる</button>
          <img src={previewCardUrl} alt="名刺拡大表示" />
        </div>
      )}
    </main>
  );
}

function AnalysisBlock({ title, items }) {
  return (
    <article className="karte-mini-card">
      <h3>{title}</h3>
      <ul className="karte-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}
