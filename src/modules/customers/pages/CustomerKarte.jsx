import { useEffect, useMemo, useState } from 'react';
import { ADOPTION_STATUSES, emptyAdoption, normalizeAdoption } from '../../products/hooks/useAdoptions.js';
import { normalizeAttachmentRecord } from '../../../shared/hooks/useAttachments.js';
import { formatPrice, parsePrice } from '../../products/hooks/useProducts.js';
import {
  calculateInventoryGrossMarginRate,
  inventoryCostTotal,
  inventoryLabel,
} from '../../inventory/hooks/useInventory.js';
import { QUOTE_STATUSES, emptyQuote, normalizeQuote } from '../../quotes/hooks/useQuotes.js';
import {
  buildQuotePdfContext,
  createQuotePdfFile,
  downloadQuotePdf,
  renderQuotePreviewHtml,
} from '../../quotes/services/quotePdfService.js';
import { SAMPLE_STATUSES, emptySample, normalizeSample } from '../../samples/hooks/useSamples.js';
import { createDummyKarteAnalysis, getCustomerKarte } from '../services/customerKarteService.js';
import {
  generateAiMeetingPrep,
  generateProductProposalNote,
  generateSalesAssistantNote,
} from '../../../services/aiService.js';
import { createEmptyMeetingMinutes, generateMeetingMinutesDraft } from '../../../services/meetingMinutesService.js';
import { createLineFollowNote } from '../../../services/lineIntegrationService.js';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import { PIPELINE_STATUSES } from '../../deals/constants.js';

function googleSearchUrl(companyName) {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ja-JP');
}

function displayText(value, fallback = '-') {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  return value || fallback;
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function dueLabel(value, inactive = false) {
  if (inactive) return '';
  const days = daysUntil(value);
  if (days === null) return '';
  if (days < 0) return '期限切れ';
  if (days === 0) return '今日';
  if (days <= 7) return `あと${days}日`;
  return '';
}

function dueClass(value, inactive = false) {
  const label = dueLabel(value, inactive);
  if (label === '期限切れ') return 'failed';
  if (label === '今日') return 'ready';
  return label ? 'muted' : '';
}

function createSampleForm(customerId = '', user) {
  return normalizeSample({
    ...emptySample,
    customerId,
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function createQuoteForm(customerId = '', user) {
  return normalizeQuote({
    ...emptyQuote,
    customerId,
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function calculateQuoteFinancials(quote, selectedInventories = []) {
  const quantity = parsePrice(quote.quantity);
  const unitPrice = parsePrice(quote.unitPrice);
  const manualCost = parsePrice(quote.costPrice);
  const explicitTotal = parsePrice(quote.totalAmount);
  const totalAmount = explicitTotal !== ''
    ? explicitTotal
    : quantity !== '' && unitPrice !== ''
      ? quantity * unitPrice
      : '';
  const inventoryCost = selectedInventories.length > 0 ? inventoryCostTotal(selectedInventories) : '';
  const costTotal = inventoryCost !== ''
    ? inventoryCost
    : quantity !== '' && manualCost !== ''
      ? quantity * manualCost
      : '';
  const grossMarginAmount = totalAmount !== '' && costTotal !== '' ? totalAmount - costTotal : '';
  const grossMarginRate =
    totalAmount !== '' && totalAmount > 0 && grossMarginAmount !== ''
      ? `${((grossMarginAmount / totalAmount) * 100).toFixed(1).replace(/\.0$/, '')}%`
      : '';

  return {
    totalAmount,
    costTotal,
    grossMarginAmount,
    grossMarginRate,
  };
}

function createAdoptionForm(customerId = '', user) {
  return normalizeAdoption({
    ...emptyAdoption,
    customerId,
    userId: user?.id ?? '',
  }, user?.id ?? '');
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
      <strong>{displayText(value)}</strong>
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
          <p>{reply.summary || '-'}</p>
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
  inventories = [],
  adoptions = [],
  suppliers = [],
  complaints,
  events = [],
  attachments,
  samples = [],
  quotes = [],
  updateCustomer,
  addAttachment,
  addSample,
  updateSample,
  addQuote,
  updateQuote,
  addAdoption,
  updateAdoption,
  setActivePage,
  user,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [meetingPrep, setMeetingPrep] = useState(null);
  const [assistantNote, setAssistantNote] = useState('');
  const [productProposalNote, setProductProposalNote] = useState('');
  const [meetingMinutes, setMeetingMinutes] = useState(() => createEmptyMeetingMinutes());
  const [lineNote, setLineNote] = useState('');
  const [meetingPrepLoading, setMeetingPrepLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [productProposalLoading, setProductProposalLoading] = useState(false);
  const [minutesLoading, setMinutesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [timelineOrder, setTimelineOrder] = useState('desc');
  const [sampleForm, setSampleForm] = useState(() => createSampleForm(customerId, user));
  const [quoteForm, setQuoteForm] = useState(() => createQuoteForm(customerId, user));
  const [quoteFile, setQuoteFile] = useState(null);
  const [quotePreviewHtml, setQuotePreviewHtml] = useState('');
  const [quoteUploading, setQuoteUploading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [adoptionForm, setAdoptionForm] = useState(() => createAdoptionForm(customerId, user));

  const karte = useMemo(
    () => getCustomerKarte({ customerId, customers, contacts, businessCards, products, inventories, complaints, events, attachments, samples, quotes, adoptions }),
    [attachments, businessCards, complaints, contacts, customerId, customers, products, inventories, samples, quotes, adoptions, events],
  );
  const quoteInventoryOptions = useMemo(
    () =>
      inventories.filter(
        (inventory) =>
          quoteForm.productIds.length === 0 ||
          quoteForm.productIds.includes(inventory.productId),
      ),
    [inventories, quoteForm.productIds],
  );
  const selectedQuoteInventories = useMemo(
    () => inventories.filter((inventory) => quoteForm.inventoryIds.includes(inventory.id)),
    [inventories, quoteForm.inventoryIds],
  );
  const inventoryGrossMarginRate = useMemo(
    () => calculateInventoryGrossMarginRate(selectedQuoteInventories, quoteForm.totalAmount),
    [quoteForm.totalAmount, selectedQuoteInventories],
  );
  const quoteFinancials = useMemo(
    () => calculateQuoteFinancials(quoteForm, selectedQuoteInventories),
    [quoteForm, selectedQuoteInventories],
  );
  const karteInventories = useMemo(() => {
    if (!karte) return [];

    const productIds = new Set([
      ...karte.products.map((product) => product.id),
      ...karte.adoptions.map((adoption) => adoption.productId),
      ...karte.samples.flatMap((sample) => sample.productIds ?? []),
      ...karte.estimates.flatMap((quote) => quote.productIds ?? []),
    ].filter(Boolean));

    return inventories.filter((inventory) => productIds.has(inventory.productId));
  }, [inventories, karte]);
  const sortedActivityTimeline = useMemo(() => {
    if (!karte) return [];
    const nextTimeline = [...karte.activityTimeline];
    return timelineOrder === 'asc' ? nextTimeline.reverse() : nextTimeline;
  }, [karte, timelineOrder]);

  useEffect(() => {
    setSampleForm(createSampleForm(customerId, user));
    setQuoteForm(createQuoteForm(customerId, user));
    setAdoptionForm(createAdoptionForm(customerId, user));
    setQuoteFile(null);
    setQuotePreviewHtml('');
    setQuoteError('');
  }, [customerId, user?.email, user?.id]);

  if (!karte) {
    return (
      <main className="page">
        <section className="empty-state">
          <h3>顧客が見つかりません</h3>
          <p>取引先一覧から顧客を選び直してください。</p>
          <button className="primary-button" type="button" onClick={() => setActivePage('Customers')}>
            取引先一覧へ
          </button>
        </section>
      </main>
    );
  }

  const { customer } = karte;
  const isHighRank = ['S', 'A'].includes(customer.customerRank || customer.rank);
  const hasComplaints =
    karte.complaints.length > 0 || karte.dealHistories.some((history) => history.hasComplaint);
  const canCreateMail = !customer.isDoNotContact;
  const nextFollowDate = customer.nextFollowUpDate || customer.nextFollowDate;

  function updateCustomerField(field, value) {
    updateCustomer(customer.id, { [field]: value });
  }

  function updateTags(value) {
    updateCustomerField(
      'tags',
      value.split(',').map((tag) => tag.trim()).filter(Boolean),
    );
  }

  function updateSampleField(field, value) {
    setSampleForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSampleArrayField(field, id) {
    setSampleForm((current) => {
      const values = new Set(current[field] ?? []);
      if (values.has(id)) {
        values.delete(id);
      } else {
        values.add(id);
      }
      return { ...current, [field]: [...values] };
    });
  }

  function updateQuoteField(field, value) {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  }

  function updateAdoptionField(field, value) {
    setAdoptionForm((current) => ({ ...current, [field]: value }));
  }

  function toggleQuoteArrayField(field, id) {
    setQuoteForm((current) => {
      const values = new Set(current[field] ?? []);
      if (values.has(id)) {
        values.delete(id);
      } else {
        values.add(id);
      }
      return { ...current, [field]: [...values] };
    });
  }

  function toggleQuoteInventory(inventory) {
    setQuoteForm((current) => {
      const inventoryIds = new Set(current.inventoryIds ?? []);
      const productIds = new Set(current.productIds ?? []);

      if (inventoryIds.has(inventory.id)) {
        inventoryIds.delete(inventory.id);
      } else {
        inventoryIds.add(inventory.id);
        if (inventory.productId) {
          productIds.add(inventory.productId);
        }
      }

      return { ...current, inventoryIds: [...inventoryIds], productIds: [...productIds] };
    });
  }

  function buildCurrentQuoteContext(quoteId = quoteForm.id || crypto.randomUUID()) {
    const normalizedQuote = normalizeQuote({
      ...quoteForm,
      id: quoteId,
      customerId: customer.id,
      totalAmount: quoteFinancials.totalAmount || quoteForm.totalAmount,
      inventoryCostTotal: quoteFinancials.costTotal || quoteForm.inventoryCostTotal,
      grossMarginAmount: quoteFinancials.grossMarginAmount || quoteForm.grossMarginAmount,
      grossMarginRate: quoteForm.grossMarginRate || quoteFinancials.grossMarginRate || inventoryGrossMarginRate,
      createdBy: user?.id ?? customer.userId,
      createdByName: user?.email ?? '',
    }, user?.id ?? customer.userId);

    return buildQuotePdfContext({
      quote: normalizedQuote,
      customer,
      contacts: karte.contacts,
      products,
      inventories,
      suppliers,
      financials: quoteFinancials,
    });
  }

  function handleQuotePreview() {
    setQuotePreviewHtml(renderQuotePreviewHtml(buildCurrentQuoteContext()));
  }

  function handleQuoteDownload() {
    downloadQuotePdf(buildCurrentQuoteContext());
  }

  function handleAddSample(event) {
    event.preventDefault();
    if (!addSample || !sampleForm.sampleName.trim()) {
      return;
    }

    addSample(normalizeSample({
      ...sampleForm,
      customerId: customer.id,
      createdBy: user?.id ?? customer.userId,
      createdByName: user?.email ?? '',
    }, user?.id ?? customer.userId));
    setSampleForm(createSampleForm(customer.id, user));
  }

  async function handleAddQuote(event) {
    event.preventDefault();
    if (!addQuote || !quoteForm.quoteNumber.trim()) {
      return;
    }

    setQuoteUploading(true);
    setQuoteError('');

    try {
      const quoteId = quoteForm.id || crypto.randomUUID();
      let uploadedFile = null;
      let uploadedPdf = null;
      const context = buildCurrentQuoteContext(quoteId);
      const pdfFile = createQuotePdfFile(context);

      if (quoteFile) {
        uploadedFile = await uploadAttachment({
          file: quoteFile,
          userId: user?.id ?? customer.userId,
          ownerType: 'quote',
          ownerId: quoteId,
          field: 'quoteFile',
        });
      }

      uploadedPdf = await uploadAttachment({
        file: pdfFile,
        userId: user?.id ?? customer.userId,
        ownerType: 'quote',
        ownerId: quoteId,
        field: 'quotePdf',
      });

      addQuote(normalizeQuote({
        ...quoteForm,
        id: quoteId,
        customerId: customer.id,
        totalAmount: quoteFinancials.totalAmount || quoteForm.totalAmount,
        inventoryCostTotal: quoteFinancials.costTotal || quoteForm.inventoryCostTotal,
        grossMarginAmount: quoteFinancials.grossMarginAmount || quoteForm.grossMarginAmount,
        grossMarginRate: quoteForm.grossMarginRate || quoteFinancials.grossMarginRate || inventoryGrossMarginRate,
        fileUrl: uploadedFile?.publicUrl || uploadedFile?.url || quoteForm.fileUrl,
        fileName: uploadedFile?.name || quoteFile?.name || quoteForm.fileName,
        pdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || quoteForm.pdfUrl,
        pdfFileName: uploadedPdf?.name || pdfFile.name || quoteForm.pdfFileName,
        pdfStoragePath: uploadedPdf?.path || quoteForm.pdfStoragePath,
        pdfGeneratedAt: new Date().toISOString(),
        createdBy: user?.id ?? customer.userId,
        createdByName: user?.email ?? '',
      }, user?.id ?? customer.userId));
      setQuoteForm(createQuoteForm(customer.id, user));
      setQuoteFile(null);
      setQuotePreviewHtml('');
    } catch (error) {
      setQuoteError(error.message || '見積PDFの作成またはアップロードに失敗しました。');
    } finally {
      setQuoteUploading(false);
    }
  }

  function handleAddAdoption(event) {
    event.preventDefault();
    if (!addAdoption || !adoptionForm.productId) {
      return;
    }

    addAdoption(normalizeAdoption({
      ...adoptionForm,
      customerId: customer.id,
      userId: user?.id ?? customer.userId,
    }, user?.id ?? customer.userId));
    setAdoptionForm(createAdoptionForm(customer.id, user));
  }

  async function handleMeetingPrep() {
    setMeetingPrepLoading(true);
    try {
      const nextPrep = await generateAiMeetingPrep(karte);
      setMeetingPrep(nextPrep);
    } finally {
      setMeetingPrepLoading(false);
    }
  }

  async function handleSalesAssistant() {
    setAssistantLoading(true);
    try {
      setAssistantNote(await generateSalesAssistantNote(karte));
    } finally {
      setAssistantLoading(false);
    }
  }

  async function handleProductProposal() {
    setProductProposalLoading(true);
    try {
      setProductProposalNote(await generateProductProposalNote(karte));
    } finally {
      setProductProposalLoading(false);
    }
  }

  function updateMeetingMinutes(field, value) {
    setMeetingMinutes((current) => ({ ...current, [field]: value }));
  }

  async function handleMeetingAudio(file) {
    if (!file) return;
    updateMeetingMinutes('audioFileName', file.name);
  }

  async function handleGenerateMinutes() {
    setMinutesLoading(true);
    try {
      setMeetingMinutes(await generateMeetingMinutesDraft({
        transcript: meetingMinutes.transcript,
        audioFileName: meetingMinutes.audioFileName,
        customerName: customer.companyName,
      }));
    } finally {
      setMinutesLoading(false);
    }
  }

  function handleCreateLineNote() {
    setLineNote(createLineFollowNote({ customer, contacts: karte.contacts }));
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
          <button className="text-button" type="button" onClick={() => setActivePage('Customers')}>
            一覧へ
          </button>
          <p className="eyebrow">Customer Karte</p>
          <h1>{customer.companyName}</h1>
          <div className="lead-badges">
            <span className="status-pill active">{customer.status || '未接触'}</span>
            <span className="info-badge ready">Rank {customer.customerRank || customer.rank || 'D'}</span>
            <span className="info-badge">Score {customer.score ?? 0}</span>
            {hasComplaints && <span className="info-badge failed">クレームあり</span>}
            {customer.isDoNotContact && <span className="info-badge failed">NG/配信停止</span>}
          </div>
        </div>
        <div className="karte-header-actions">
          <a className="ghost-button external-button" href={googleSearchUrl(customer.companyName)} target="_blank" rel="noreferrer">Google検索</a>
          {customer.website && <a className="ghost-button external-button" href={customer.website} target="_blank" rel="noreferrer">公式サイト</a>}
          {canCreateMail && <button className="primary-button" type="button" onClick={() => setActivePage('MailAI')}>AIメール作成</button>}
        </div>
      </header>

      <div className="karte-grid">
        <Section title="会社基本情報">
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
            <select value={customer.status || '未接触'} onChange={(event) => updateCustomerField('status', event.target.value)}>
              {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </Section>

        <Section title="担当者一覧" count={karte.contacts.length}>
          <div className="karte-card-list">
            {karte.contacts.length > 0 ? karte.contacts.map((contact) => (
              <article className="karte-mini-card" key={contact.id}>
                <h3>{contact.name || '氏名未入力'}</h3>
                <p>{displayText([contact.department, contact.role])}</p>
                <p>{displayText([contact.email, contact.mobile || contact.phone])}</p>
                <div className="lead-badges">
                  <span className="info-badge">決裁権 {contact.decisionPower || '-'}</span>
                  <span className="info-badge ready">Rank {contact.importanceRank || 'D'}</span>
                  <span className="info-badge">Score {contact.importanceScore ?? 0}</span>
                </div>
                <p className="inline-helper">{contact.memo || '人物メモなし'}</p>
              </article>
            )) : <p className="inline-helper">担当者はまだ登録されていません。</p>}
          </div>
        </Section>

        <Section title="名刺情報" count={karte.businessCards.length} defaultOpen={karte.businessCards.length > 0}>
          <div className="karte-card-list">
            {karte.businessCards.length > 0 ? karte.businessCards.map((card) => (
              <article className="karte-mini-card" key={card.id}>
                <h3>{card.extracted?.name || '氏名未取得'}</h3>
                <p>{card.extracted?.companyName || customer.companyName}</p>
                {card.imageFile?.url && (
                  <img className="karte-thumb" loading="lazy" src={card.imageFile.url} alt="名刺画像" />
                )}
                <p className="inline-helper">{card.rawText?.slice(0, 180) || 'OCRテキストなし'}</p>
              </article>
            )) : <p className="inline-helper">名刺はまだ登録されていません。</p>}
          </div>
        </Section>

        <Section title="活動タイムライン" count={karte.activityTimeline.length}>
          <div className="timeline-toolbar">
            <span>表示順</span>
            <div className="segmented-control compact-segmented" aria-label="活動タイムラインの表示順">
              <button
                type="button"
                className={timelineOrder === 'desc' ? 'selected' : ''}
                onClick={() => setTimelineOrder('desc')}
              >
                新しい順
              </button>
              <button
                type="button"
                className={timelineOrder === 'asc' ? 'selected' : ''}
                onClick={() => setTimelineOrder('asc')}
              >
                古い順
              </button>
            </div>
          </div>
          <div className="timeline-list">
            {sortedActivityTimeline.length > 0 ? sortedActivityTimeline.map((activity) => (
              <article className={`history-card timeline-card timeline-event-card ${activity.type === 'クレーム記録' ? 'ng-card' : ''}`} key={activity.id}>
                <div className="history-meta timeline-event-heading">
                  <span>{formatDate(activity.date)} / {activity.type}</span>
                  <small>{activity.createdBy}</small>
                </div>
                <p>{activity.content}</p>
                <div className="timeline-event-grid">
                  <div>
                    <span>記載者</span>
                    <strong>{activity.createdBy}</strong>
                  </div>
                  <div>
                    <span>関連担当者</span>
                    <strong>{displayText(activity.relatedContacts)}</strong>
                  </div>
                  <div>
                    <span>添付ファイル</span>
                    <strong>{activity.hasAttachment ? 'あり' : 'なし'}</strong>
                  </div>
                </div>
              </article>
            )) : <p className="inline-helper">活動履歴はまだありません。</p>}
          </div>
        </Section>

        <Section title="商談履歴" count={karte.dealHistories.length}>
          <div className="timeline-list">
            {karte.dealHistories.length > 0 ? karte.dealHistories.map((history) => (
              <article className={`history-card timeline-card ${history.hasComplaint ? 'ng-card' : ''}`} key={history.id}>
                <div className="history-meta">
                  <span>{formatDate(history.date)} / {history.type || '商談'}</span>
                  <small>{history.createdByName || history.createdBy || '-'}</small>
                </div>
                <p>{history.summary || '-'}</p>
                <p className="inline-helper">相手: {displayText(history.contactNames)}</p>
                <p className="inline-helper">同行者: {displayText(history.companionNames)}</p>
                {history.nextAction && <p className="inline-helper">次回: {history.nextAction}</p>}
                {history.hasComplaint && <p className="ng-banner">クレームフラグあり</p>}
                <ReplyTree replies={history.replies ?? []} />
              </article>
            )) : <p className="inline-helper">商談履歴はまだありません。</p>}
          </div>
        </Section>

        <Section title="クレーム履歴" count={karte.complaints.length} defaultOpen={hasComplaints}>
          <div className="karte-card-list">
            {karte.complaints.length > 0 ? karte.complaints.map((complaint) => (
              <article className="karte-mini-card ng-panel" key={complaint.id}>
                <h3>{complaint.title || '件名未入力'}</h3>
                <p>{complaint.status || '-'} / {complaint.severity || '-'}</p>
                <p>{complaint.memo || '-'}</p>
                <small>{complaint.createdByName || complaint.createdBy || '-'}</small>
              </article>
            )) : <p className="inline-helper">クレーム履歴はありません。</p>}
          </div>
        </Section>

        <Section title="提案商品" count={karte.products.length}>
          <div className="karte-card-list">
            {karte.products.length > 0 ? karte.products.map((product) => (
              <article className="product-card" key={product.id}>
                {product.imageFile?.url && <img className="product-preview-image" loading="lazy" src={product.imageFile.url} alt={product.name} />}
                <h3>{product.name}</h3>
                <dl className="company-details">
                  <div><dt>メーカー</dt><dd>{product.manufacturerName || '-'}</dd></div>
                  <div><dt>産地</dt><dd>{product.origin || '-'}</dd></div>
                  <div><dt>温度帯</dt><dd>{product.temperatureZone || '-'}</dd></div>
                  <div><dt>荷姿</dt><dd>{product.packageStyle || '-'}</dd></div>
                  <div><dt>原価</dt><dd>{formatPrice(product.costPrice)}円/{product.costUnit || '-'}</dd></div>
                  <div><dt>希望価格</dt><dd>{formatPrice(product.desiredSellingPrice)}円/{product.sellingPriceUnit || '-'}</dd></div>
                  <div><dt>粗利率</dt><dd>{product.grossMarginRate || '-'}</dd></div>
                </dl>
              </article>
            )) : <p className="inline-helper">提案商品はまだ登録されていません。</p>}
          </div>
        </Section>

        <Section title="在庫・仕入参照" count={karteInventories.length} defaultOpen={karteInventories.length > 0}>
          {karteInventories.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {karteInventories.map((inventory) => {
                const product = products.find((item) => item.id === inventory.productId);
                const supplier = suppliers.find((item) => item.id === inventory.supplierId);
                return (
                  <article className="karte-mini-card" key={inventory.id}>
                    <div className="history-meta">
                      <span>{inventoryLabel(inventory, product, supplier)}</span>
                      <small>{inventory.stockType || '-'}</small>
                    </div>
                    <div className="lead-badges">
                      <span className="info-badge ready">{inventory.inventoryStatus || '-'}</span>
                      {inventory.firmDeadline && <span className="info-badge">ファーム {inventory.firmDeadline}</span>}
                      {inventory.eta && <span className="info-badge">ETA {inventory.eta}</span>}
                      {inventory.expiryDate && <span className="info-badge">賞味 {inventory.expiryDate}</span>}
                    </div>
                    <dl className="company-details">
                      <div><dt>商品</dt><dd>{product?.name || '-'}</dd></div>
                      <div><dt>仕入先</dt><dd>{supplier?.name || supplier?.companyName || '-'}</dd></div>
                      <div><dt>コスト</dt><dd>{formatPrice(inventory.cost) || '-'} {inventory.currency}/{inventory.unit}</dd></div>
                      <div><dt>数量</dt><dd>{inventory.quantity || '-'} {inventory.unit}</dd></div>
                      <div><dt>所有者</dt><dd>{inventory.owner || '-'}</dd></div>
                      <div><dt>LOT</dt><dd>{inventory.lot || '-'}</dd></div>
                    </dl>
                    {inventory.memo && <p className="inline-helper">{inventory.memo}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="inline-helper">この顧客に関連する商品の在庫はまだ登録されていません。</p>
          )}
        </Section>

        <Section title="採用品一覧" count={karte.adoptions.length} defaultOpen={karte.adoptions.length > 0}>
          <form className="sample-form" onSubmit={handleAddAdoption}>
            <div className="date-grid">
              <label className="field-label">
                商品
                <select value={adoptionForm.productId} onChange={(event) => updateAdoptionField('productId', event.target.value)}>
                  <option value="">選択してください</option>
                  {products.map((product) => (
                    <option value={product.id} key={product.id}>{product.name || '商品名未設定'}</option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                ステータス
                <select value={adoptionForm.status} onChange={(event) => updateAdoptionField('status', event.target.value)}>
                  {ADOPTION_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                採用日
                <input type="date" value={adoptionForm.adoptedDate} onChange={(event) => updateAdoptionField('adoptedDate', event.target.value)} />
              </label>
              <label className="field-label">
                月間数量
                <input value={adoptionForm.monthlyVolume} onChange={(event) => updateAdoptionField('monthlyVolume', event.target.value)} />
              </label>
              <label className="field-label">
                単位
                <input value={adoptionForm.unit} placeholder="kg / ケース など" onChange={(event) => updateAdoptionField('unit', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                販売価格
                <input inputMode="decimal" value={adoptionForm.sellingPrice} onChange={(event) => updateAdoptionField('sellingPrice', event.target.value)} />
              </label>
              <label className="field-label">
                粗利率
                <input value={adoptionForm.grossMarginRate} placeholder="例: 20%" onChange={(event) => updateAdoptionField('grossMarginRate', event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              メモ
              <textarea value={adoptionForm.memo} onChange={(event) => updateAdoptionField('memo', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!adoptionForm.productId}>
              採用履歴を登録
            </button>
          </form>
          <AdoptionList
            adoptions={karte.adoptions}
            products={products}
            updateAdoption={updateAdoption}
          />
          {karte.adoptions.length === 0 && <p className="inline-helper">採用品はまだ登録されていません。</p>}
        </Section>

        <Section title="見積履歴" count={karte.estimates.length} defaultOpen={karte.estimates.length > 0}>
          <form className="sample-form" onSubmit={handleAddQuote}>
            <div className="date-grid">
              <label className="field-label">
                見積番号
                <input
                  value={quoteForm.quoteNumber}
                  placeholder="例: Q-2026-001"
                  onChange={(event) => updateQuoteField('quoteNumber', event.target.value)}
                />
              </label>
              <label className="field-label">
                ステータス
                <select value={quoteForm.status} onChange={(event) => updateQuoteField('status', event.target.value)}>
                  {QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                提出日
                <input type="date" value={quoteForm.submittedDate} onChange={(event) => updateQuoteField('submittedDate', event.target.value)} />
              </label>
              <label className="field-label">
                有効期限
                <input type="date" value={quoteForm.validUntil} onChange={(event) => updateQuoteField('validUntil', event.target.value)} />
              </label>
              <label className="field-label">
                通貨
                <input value={quoteForm.currency} onChange={(event) => updateQuoteField('currency', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                仕入先
                <select value={quoteForm.supplierId} onChange={(event) => updateQuoteField('supplierId', event.target.value)}>
                  <option value="">未選択</option>
                  {suppliers.map((supplier) => (
                    <option value={supplier.id} key={supplier.id}>
                      {supplier.name || supplier.companyName || '仕入先名未設定'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                合計金額
                <input inputMode="decimal" value={quoteForm.totalAmount} onChange={(event) => updateQuoteField('totalAmount', event.target.value)} />
              </label>
              <label className="field-label">
                粗利率
                <input value={quoteForm.grossMarginRate} placeholder="例: 20%" onChange={(event) => updateQuoteField('grossMarginRate', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                数量
                <input inputMode="decimal" value={quoteForm.quantity} placeholder="例: 10" onChange={(event) => updateQuoteField('quantity', event.target.value)} />
              </label>
              <label className="field-label">
                単価
                <input inputMode="decimal" value={quoteForm.unitPrice} placeholder="例: 1200" onChange={(event) => updateQuoteField('unitPrice', event.target.value)} />
              </label>
              <label className="field-label">
                単位
                <input value={quoteForm.unit} placeholder="kg / ケース など" onChange={(event) => updateQuoteField('unit', event.target.value)} />
              </label>
              <label className="field-label">
                原価
                <input inputMode="decimal" value={quoteForm.costPrice} placeholder="例: 800" onChange={(event) => updateQuoteField('costPrice', event.target.value)} />
              </label>
            </div>
            <div className="price-preview">
              <div>
                <span>見積金額</span>
                <strong>{formatPrice(quoteFinancials.totalAmount || quoteForm.totalAmount) || '-'} {quoteForm.currency}</strong>
              </div>
              <div>
                <span>原価合計</span>
                <strong>{formatPrice(quoteFinancials.costTotal || quoteForm.inventoryCostTotal) || '-'} {quoteForm.currency}</strong>
              </div>
              <div>
                <span>粗利額</span>
                <strong>{formatPrice(quoteFinancials.grossMarginAmount || quoteForm.grossMarginAmount) || '-'} {quoteForm.currency}</strong>
              </div>
              <div>
                <span>粗利率</span>
                <strong>{quoteForm.grossMarginRate || quoteFinancials.grossMarginRate || inventoryGrossMarginRate || '-'}</strong>
              </div>
            </div>
            <div className="sample-picker-grid">
              <div>
                <span>関連担当者</span>
                {karte.contacts.length > 0 ? karte.contacts.map((contact) => (
                  <label className="mini-check" key={contact.id}>
                    <input
                      type="checkbox"
                      checked={quoteForm.contactIds.includes(contact.id)}
                      onChange={() => toggleQuoteArrayField('contactIds', contact.id)}
                    />
                    {contact.name || '名称未設定'}
                  </label>
                )) : <p className="inline-helper">担当者は未登録です。</p>}
              </div>
              <div>
                <span>関連商品</span>
                {products.length > 0 ? products.map((product) => (
                  <label className="mini-check" key={product.id}>
                    <input
                      type="checkbox"
                      checked={quoteForm.productIds.includes(product.id)}
                      onChange={() => toggleQuoteArrayField('productIds', product.id)}
                    />
                    {product.name || '商品名未設定'}
                  </label>
                )) : <p className="inline-helper">商品は未登録です。</p>}
              </div>
            </div>
            <div className="sample-picker-grid">
              <div>
                <span>参照在庫</span>
                {quoteInventoryOptions.length > 0 ? quoteInventoryOptions.map((inventory) => {
                  const product = products.find((item) => item.id === inventory.productId);
                  const supplier = suppliers.find((item) => item.id === inventory.supplierId);
                  return (
                    <label className="mini-check" key={inventory.id}>
                      <input
                        type="checkbox"
                        checked={quoteForm.inventoryIds.includes(inventory.id)}
                        onChange={() => toggleQuoteInventory(inventory)}
                      />
                      {inventoryLabel(inventory, product, supplier)}
                    </label>
                  );
                }) : <p className="inline-helper">選択中の商品に紐づく在庫はありません。</p>}
              </div>
              <div>
                <span>在庫粗利計算</span>
                <dl className="company-details">
                  <div><dt>在庫コスト合計</dt><dd>{formatPrice(inventoryCostTotal(selectedQuoteInventories)) || '-'}</dd></div>
                  <div><dt>在庫ベース粗利率</dt><dd>{inventoryGrossMarginRate || '-'}</dd></div>
                </dl>
                {inventoryGrossMarginRate && !quoteForm.grossMarginRate && (
                  <p className="inline-helper">粗利率が未入力の場合、登録時に在庫ベース粗利率を保存します。</p>
                )}
              </div>
            </div>
            <label className="field-label file-field">
              見積ファイル
              <input type="file" onChange={(event) => setQuoteFile(event.target.files?.[0] ?? null)} />
              <span>{quoteFile?.name || quoteForm.fileName || '未添付'}</span>
            </label>
            <div className="date-grid">
              <label className="field-label">
                支払条件
                <input value={quoteForm.paymentTerms} placeholder="例: 月末締め翌月末払い" onChange={(event) => updateQuoteField('paymentTerms', event.target.value)} />
              </label>
              <label className="field-label">
                納品条件
                <input value={quoteForm.deliveryTerms} placeholder="例: 冷凍便 / FOB / CIF など" onChange={(event) => updateQuoteField('deliveryTerms', event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              備考
              <textarea value={quoteForm.remarks} onChange={(event) => updateQuoteField('remarks', event.target.value)} />
            </label>
            <label className="field-label">
              メモ
              <textarea value={quoteForm.memo} onChange={(event) => updateQuoteField('memo', event.target.value)} />
            </label>
            <label className="field-label">
              失注理由
              <textarea value={quoteForm.lostReason} onChange={(event) => updateQuoteField('lostReason', event.target.value)} />
            </label>
            {quoteUploading && <p className="notice-text">見積ファイルをアップロード中...</p>}
            {quoteError && <p className="error-text">{quoteError}</p>}
            <div className="mail-action-row">
              <button className="ghost-button" type="button" onClick={handleQuotePreview} disabled={!quoteForm.quoteNumber.trim()}>
                PDFプレビュー
              </button>
              <button className="ghost-button" type="button" onClick={handleQuoteDownload} disabled={!quoteForm.quoteNumber.trim()}>
                PDFダウンロード
              </button>
              <button className="primary-button" type="submit" disabled={!quoteForm.quoteNumber.trim() || quoteUploading}>
                PDF出力して見積を登録
              </button>
            </div>
            {quotePreviewHtml && (
              <div className="quote-preview-frame" dangerouslySetInnerHTML={{ __html: quotePreviewHtml }} />
            )}
          </form>
          <QuoteList
            quotes={karte.estimates}
            products={products}
            inventories={inventories}
            suppliers={suppliers}
            contacts={karte.contacts}
            updateQuote={updateQuote}
          />
          {karte.estimates.length === 0 && <p className="inline-helper">見積履歴はまだありません。</p>}
        </Section>

        <Section title="サンプル管理" count={karte.samples.length} defaultOpen={karte.samples.length > 0}>
          <form className="sample-form" onSubmit={handleAddSample}>
            <div className="date-grid">
              <label className="field-label">
                サンプル名
                <input
                  value={sampleForm.sampleName}
                  placeholder="例: 和牛ベーコン試食"
                  onChange={(event) => updateSampleField('sampleName', event.target.value)}
                />
              </label>
              <label className="field-label">
                ステータス
                <select value={sampleForm.status} onChange={(event) => updateSampleField('status', event.target.value)}>
                  {SAMPLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                発送日
                <input type="date" value={sampleForm.shippedDate} onChange={(event) => updateSampleField('shippedDate', event.target.value)} />
              </label>
              <label className="field-label">
                到着日
                <input type="date" value={sampleForm.arrivalDate} onChange={(event) => updateSampleField('arrivalDate', event.target.value)} />
              </label>
              <label className="field-label">
                フォロー日
                <input type="date" value={sampleForm.followUpDate} onChange={(event) => updateSampleField('followUpDate', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                発送方法
                <input value={sampleForm.shippingMethod} onChange={(event) => updateSampleField('shippingMethod', event.target.value)} />
              </label>
              <label className="field-label">
                追跡番号
                <input value={sampleForm.trackingNumber} onChange={(event) => updateSampleField('trackingNumber', event.target.value)} />
              </label>
            </div>
            <div className="sample-picker-grid">
              <div>
                <span>関連担当者</span>
                {karte.contacts.length > 0 ? karte.contacts.map((contact) => (
                  <label className="mini-check" key={contact.id}>
                    <input
                      type="checkbox"
                      checked={sampleForm.contactIds.includes(contact.id)}
                      onChange={() => toggleSampleArrayField('contactIds', contact.id)}
                    />
                    {contact.name || '名称未設定'}
                  </label>
                )) : <p className="inline-helper">担当者は未登録です。</p>}
              </div>
              <div>
                <span>関連商品</span>
                {products.length > 0 ? products.map((product) => (
                  <label className="mini-check" key={product.id}>
                    <input
                      type="checkbox"
                      checked={sampleForm.productIds.includes(product.id)}
                      onChange={() => toggleSampleArrayField('productIds', product.id)}
                    />
                    {product.name || '商品名未設定'}
                  </label>
                )) : <p className="inline-helper">商品は未登録です。</p>}
              </div>
            </div>
            <label className="field-label">
              フィードバック
              <textarea value={sampleForm.feedback} onChange={(event) => updateSampleField('feedback', event.target.value)} />
            </label>
            <label className="field-label">
              次アクション
              <textarea value={sampleForm.nextAction} onChange={(event) => updateSampleField('nextAction', event.target.value)} />
            </label>
            <label className="field-label">
              メモ
              <textarea value={sampleForm.memo} onChange={(event) => updateSampleField('memo', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!sampleForm.sampleName.trim()}>
              サンプルを登録
            </button>
          </form>
          <SampleList
            samples={karte.samples}
            products={products}
            contacts={karte.contacts}
            updateSample={updateSample}
          />
          {karte.samples.length === 0 && <p className="inline-helper">サンプル履歴はまだありません。</p>}
        </Section>

        <Section title="添付ファイル" count={karte.attachments.length}>
          <label className="field-label file-field">
            顧客資料を追加
            <input type="file" onChange={(event) => handleAttachment(event.target.files?.[0])} />
          </label>
          {uploading && <p className="notice-text">アップロード中...</p>}
          {uploadError && <p className="error-text">{uploadError}</p>}
          <div className="karte-card-list">
            {karte.attachments.length > 0 ? karte.attachments.map((attachment) => (
              <article className="karte-mini-card" key={attachment.id}>
                <h3>{attachment.name || 'ファイル'}</h3>
                <p>{attachment.contentType || 'file'} / {Math.ceil((attachment.sizeBytes ?? 0) / 1024)}KB</p>
                <p>アップロード日: {formatDateTime(attachment.createdAt)}</p>
                {attachment.publicUrl && <a className="ghost-button external-button" href={attachment.publicUrl} target="_blank" rel="noreferrer">開く</a>}
              </article>
            )) : <p className="inline-helper">添付ファイルはまだありません。</p>}
          </div>
        </Section>

        <Section title="予定" count={karte.events.length} defaultOpen={karte.events.length > 0}>
          <RecordList
            records={karte.events.map((event) => ({
              ...event,
              title: event.title || event.eventType,
              summary: [event.eventType, event.status, event.location].filter(Boolean).join(' / '),
              date: event.startAt || event.nextFollowDate || event.createdAt,
            }))}
            emptyText="予定はまだありません。"
          />
        </Section>

        <Section title="フォロー予定">
          <div className="karte-field-grid">
            <Field label="次回フォロー日" value={nextFollowDate} />
            <Field label="最終接触日" value={customer.lastContactDate} />
            <Field label="未対応タスク" value={customer.pipelineMemo || customer.memo} />
            <Field label="今日やるべきこと" value={nextFollowDate ? 'フォロー内容を確認して連絡する' : '次回フォロー日を設定する'} />
          </div>
          <label className="field-label">
            次回フォロー日
            <input
              type="date"
              value={nextFollowDate || ''}
              onChange={(event) => updateCustomer(customer.id, { nextFollowUpDate: event.target.value, nextFollowDate: event.target.value })}
            />
          </label>
        </Section>

        <Section title="AI分析枠" defaultOpen={false}>
          <div className="mail-action-row">
            <button className="primary-button" type="button" onClick={handleSalesAssistant} disabled={assistantLoading}>
              {assistantLoading ? 'AI営業秘書生成中...' : 'AI営業秘書'}
            </button>
            <button className="primary-button" type="button" onClick={handleProductProposal} disabled={productProposalLoading}>
              {productProposalLoading ? 'AI商品提案生成中...' : 'AI商品提案'}
            </button>
          </div>
          {assistantNote && (
            <label className="field-label">
              AI営業秘書メモ
              <textarea value={assistantNote} onChange={(event) => setAssistantNote(event.target.value)} />
            </label>
          )}
          {productProposalNote && (
            <label className="field-label">
              AI商品提案メモ
              <textarea value={productProposalNote} onChange={(event) => setProductProposalNote(event.target.value)} />
            </label>
          )}
          <div className="sample-form">
            <div className="section-heading">
              <h3>AI議事録</h3>
              <button className="ghost-button" type="button" onClick={handleGenerateMinutes} disabled={minutesLoading}>
                {minutesLoading ? '要約中...' : '議事録を作成'}
              </button>
            </div>
            <label className="field-label file-field">
              音声添付
              <input type="file" accept="audio/*" onChange={(event) => handleMeetingAudio(event.target.files?.[0])} />
              <span>{meetingMinutes.audioFileName || '未添付'}</span>
            </label>
            <label className="field-label">
              文字起こし
              <textarea value={meetingMinutes.transcript} onChange={(event) => updateMeetingMinutes('transcript', event.target.value)} />
            </label>
            <label className="field-label">
              要約
              <textarea value={meetingMinutes.summary} onChange={(event) => updateMeetingMinutes('summary', event.target.value)} />
            </label>
            <label className="field-label">
              決定事項
              <textarea value={meetingMinutes.decisions} onChange={(event) => updateMeetingMinutes('decisions', event.target.value)} />
            </label>
            <label className="field-label">
              宿題
              <textarea value={meetingMinutes.homework} onChange={(event) => updateMeetingMinutes('homework', event.target.value)} />
            </label>
            <label className="field-label">
              次回アクション
              <textarea value={meetingMinutes.nextActions} onChange={(event) => updateMeetingMinutes('nextActions', event.target.value)} />
            </label>
          </div>
          <div className="sample-form">
            <div className="section-heading">
              <h3>LINE枠</h3>
              <button className="ghost-button" type="button" onClick={handleCreateLineNote}>
                LINE連携メモ作成
              </button>
            </div>
            <label className="field-label">
              LINE連携メモ
              <textarea value={lineNote} onChange={(event) => setLineNote(event.target.value)} />
            </label>
          </div>
          <button className="primary-button" type="button" onClick={handleMeetingPrep} disabled={meetingPrepLoading}>
            {meetingPrepLoading ? 'AI商談準備中...' : 'AI商談準備'}
          </button>
          {meetingPrep && (
            <div className="ai-analysis-grid meeting-prep-grid">
              <AnalysisBlock title="この顧客の特徴" items={meetingPrep.features} />
              <AnalysisBlock title="前回までの流れ" items={meetingPrep.previousFlow} />
              <AnalysisBlock title="注意点" items={meetingPrep.cautions} />
              <AnalysisBlock title="想定ニーズ" items={meetingPrep.needs} />
              <AnalysisBlock title="提案すべき商品" items={meetingPrep.recommendedProducts} />
              <AnalysisBlock title="商談で確認すべき質問" items={meetingPrep.questions} />
              <AnalysisBlock title="次回アクション案" items={meetingPrep.nextActions} />
            </div>
          )}
          <button className="primary-button" type="button" onClick={() => setAnalysis(createDummyKarteAnalysis(karte))}>
            AI分析を表示
          </button>
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
    </main>
  );
}

function RecordList({ records, emptyText }) {
  if (!records.length) {
    return <p className="inline-helper">{emptyText}</p>;
  }

  return (
    <div className="karte-card-list">
      {records.map((record) => (
        <article className="karte-mini-card" key={`${record.activityType || 'record'}-${record.id}`}>
          <h3>{record.title || record.type || record.name || '記録'}</h3>
          <p>{record.summary || record.memo || record.name || '-'}</p>
          <small>{formatDate(record.date || record.createdAt)}</small>
          {record.publicUrl && <a className="ghost-button external-button" href={record.publicUrl} target="_blank" rel="noreferrer">開く</a>}
        </article>
      ))}
    </div>
  );
}

function SampleList({ samples, products, contacts, updateSample }) {
  if (!samples.length) {
    return null;
  }

  function productNames(sample) {
    const matchedProducts = products
      .filter((product) => (sample.productIds ?? []).includes(product.id))
      .map((product) => [
        product.name,
        product.manufacturerName,
        product.origin,
        product.temperatureZone,
      ].filter(Boolean).join(' / '))
      .filter(Boolean);

    return matchedProducts.join(', ') || displayText(sample.productNames);
  }

  function contactNames(sample) {
    return contacts
      .filter((contact) => (sample.contactIds ?? []).includes(contact.id))
      .map((contact) => contact.name)
      .filter(Boolean)
      .join(', ') || '-';
  }

  return (
    <div className="karte-card-list sample-card-list">
      {samples.map((sample) => {
        const arrivalLabel = dueLabel(sample.arrivalDate, ['到着済', '評価待ち', '採用', '不採用', '保留'].includes(sample.status));
        const followLabel = dueLabel(sample.followUpDate, ['採用', '不採用'].includes(sample.status));

        return (
        <article className="karte-mini-card sample-card" key={sample.id}>
          <div className="history-meta">
            <span>{sample.sampleName || sample.title || sample.name || sample.type || 'サンプル'}</span>
            <small>{sample.status || '-'}</small>
          </div>
          <div className="lead-badges">
            {arrivalLabel && <span className={`info-badge ${dueClass(sample.arrivalDate)}`}>到着 {arrivalLabel}</span>}
            {followLabel && <span className={`info-badge ${dueClass(sample.followUpDate)}`}>フォロー {followLabel}</span>}
            {sample.trackingNumber && <span className="info-badge ready">追跡あり</span>}
            {sample.feedback && <span className="info-badge ready">評価あり</span>}
          </div>
          {sample.customerId && (
            <div className="sample-status-row">
              <label className="field-label">
                ステータス
                <select
                  value={sample.status || '発送前'}
                  onChange={(event) => updateSample?.(sample.id, { status: event.target.value })}
                >
                  {SAMPLE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
          )}
          <dl className="company-details">
            <div><dt>商品</dt><dd>{productNames(sample)}</dd></div>
            <div><dt>担当者</dt><dd>{contactNames(sample)}</dd></div>
            <div><dt>発送日</dt><dd>{formatDate(sample.shippedDate)}</dd></div>
            <div><dt>到着日</dt><dd>{formatDate(sample.arrivalDate)}</dd></div>
            <div><dt>フォロー日</dt><dd>{formatDate(sample.followUpDate)}</dd></div>
            <div><dt>発送方法</dt><dd>{sample.shippingMethod || '-'}</dd></div>
            <div><dt>追跡番号</dt><dd>{sample.trackingNumber || '-'}</dd></div>
          </dl>
          {sample.customerId ? (
            <>
              <label className="field-label">
                フィードバック
                <textarea
                  value={sample.feedback || ''}
                  onChange={(event) => updateSample?.(sample.id, { feedback: event.target.value })}
                />
              </label>
              <label className="field-label">
                次アクション
                <textarea
                  value={sample.nextAction || ''}
                  onChange={(event) => updateSample?.(sample.id, { nextAction: event.target.value })}
                />
              </label>
            </>
          ) : (
            <p className="inline-helper">{sample.summary || sample.memo || sample.name || '-'}</p>
          )}
          {sample.memo && sample.customerId && <p className="inline-helper">{sample.memo}</p>}
        </article>
        );
      })}
    </div>
  );
}

function AdoptionList({ adoptions, products, updateAdoption }) {
  if (!adoptions.length) {
    return null;
  }

  function productName(adoption) {
    return products.find((product) => product.id === adoption.productId)?.name || adoption.productName || '-';
  }

  return (
    <div className="karte-card-list sample-card-list">
      {adoptions.map((adoption) => (
        <article className="karte-mini-card adoption-card" key={adoption.id}>
          <div className="history-meta">
            <span>{productName(adoption)}</span>
            <small>{adoption.status || '-'}</small>
          </div>
          <div className="sample-status-row">
            <label className="field-label">
              ステータス
              <select
                value={adoption.status || '採用中'}
                onChange={(event) => updateAdoption?.(adoption.id, { status: event.target.value })}
              >
                {ADOPTION_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <dl className="company-details">
            <div><dt>採用日</dt><dd>{formatDate(adoption.adoptedDate)}</dd></div>
            <div><dt>月間数量</dt><dd>{adoption.monthlyVolume || '-'}</dd></div>
            <div><dt>販売価格</dt><dd>{adoption.sellingPrice || '-'}</dd></div>
            <div><dt>単位</dt><dd>{adoption.unit || '-'}</dd></div>
            <div><dt>粗利率</dt><dd>{adoption.grossMarginRate || '-'}</dd></div>
          </dl>
          <label className="field-label">
            メモ
            <textarea
              value={adoption.memo || ''}
              onChange={(event) => updateAdoption?.(adoption.id, { memo: event.target.value })}
            />
          </label>
        </article>
      ))}
    </div>
  );
}

function QuoteList({ quotes, products, inventories = [], suppliers = [], contacts, updateQuote }) {
  if (!quotes.length) {
    return null;
  }

  function productNames(quote) {
    const matchedProducts = products
      .filter((product) => (quote.productIds ?? []).includes(product.id))
      .map((product) => [
        product.name,
        product.manufacturerName,
        product.origin,
        product.temperatureZone,
      ].filter(Boolean).join(' / '))
      .filter(Boolean);

    return matchedProducts.join(', ') || displayText(quote.productNames);
  }

  function contactNames(quote) {
    return contacts
      .filter((contact) => (quote.contactIds ?? []).includes(contact.id))
      .map((contact) => contact.name)
      .filter(Boolean)
      .join(', ') || '-';
  }

  function inventoryNames(quote) {
    return inventories
      .filter((inventory) => (quote.inventoryIds ?? []).includes(inventory.id))
      .map((inventory) => {
        const product = products.find((item) => item.id === inventory.productId);
        const supplier = suppliers.find((item) => item.id === inventory.supplierId);
        return inventoryLabel(inventory, product, supplier);
      })
      .filter(Boolean)
      .join(', ') || '-';
  }

  return (
    <div className="karte-card-list sample-card-list">
      {quotes.map((quote) => {
        const inactive = ['採用', '失注', '期限切れ'].includes(quote.status);
        const validLabel = dueLabel(quote.validUntil, inactive);

        return (
        <article className="karte-mini-card quote-card" key={quote.id}>
          <div className="history-meta">
            <span>{quote.quoteNumber || quote.title || quote.type || '見積'}</span>
            <small>{quote.status || '-'}</small>
          </div>
          <div className="lead-badges">
            {validLabel && <span className={`info-badge ${dueClass(quote.validUntil, inactive)}`}>有効期限 {validLabel}</span>}
            {quote.fileUrl && <span className="info-badge ready">見積ファイルあり</span>}
            {quote.pdfUrl && <span className="info-badge ready">PDFあり</span>}
            {(quote.productIds ?? []).length > 0 && <span className="info-badge ready">商品連携あり</span>}
            {(quote.inventoryIds ?? []).length > 0 && <span className="info-badge ready">在庫参照あり</span>}
          </div>
          {quote.customerId && (
            <div className="sample-status-row">
              <label className="field-label">
                ステータス
                <select
                  value={quote.status || '提出済'}
                  onChange={(event) => updateQuote?.(quote.id, { status: event.target.value })}
                >
                  {QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
          )}
          <dl className="company-details">
            <div><dt>商品</dt><dd>{productNames(quote)}</dd></div>
            <div><dt>参照在庫</dt><dd>{inventoryNames(quote)}</dd></div>
            <div><dt>担当者</dt><dd>{contactNames(quote)}</dd></div>
            <div><dt>提出日</dt><dd>{formatDate(quote.submittedDate || quote.date || quote.createdAt)}</dd></div>
            <div><dt>有効期限</dt><dd>{formatDate(quote.validUntil)}</dd></div>
            <div><dt>数量</dt><dd>{quote.quantity || '-'} {quote.unit || ''}</dd></div>
            <div><dt>単価</dt><dd>{quote.unitPrice || '-'}</dd></div>
            <div><dt>原価</dt><dd>{quote.costPrice || '-'}</dd></div>
            <div><dt>合計金額</dt><dd>{quote.totalAmount || '-'}</dd></div>
            <div><dt>粗利額</dt><dd>{quote.grossMarginAmount || '-'}</dd></div>
            <div><dt>粗利率</dt><dd>{quote.grossMarginRate || '-'}</dd></div>
            <div><dt>支払条件</dt><dd>{quote.paymentTerms || '-'}</dd></div>
            <div><dt>納品条件</dt><dd>{quote.deliveryTerms || '-'}</dd></div>
          </dl>
          {quote.customerId ? (
            <>
              <label className="field-label">
                メモ
                <textarea
                  value={quote.memo || ''}
                  onChange={(event) => updateQuote?.(quote.id, { memo: event.target.value })}
                />
              </label>
              {quote.status === '失注' && (
                <label className="field-label">
                  失注理由
                  <textarea
                    value={quote.lostReason || ''}
                    onChange={(event) => updateQuote?.(quote.id, { lostReason: event.target.value })}
                  />
                </label>
              )}
              <label className="field-label">
                備考
                <textarea
                  value={quote.remarks || ''}
                  onChange={(event) => updateQuote?.(quote.id, { remarks: event.target.value })}
                />
              </label>
            </>
          ) : (
            <p className="inline-helper">{quote.summary || quote.memo || quote.name || '-'}</p>
          )}
          {quote.fileUrl && (
            <a className="ghost-button external-button" href={quote.fileUrl} target="_blank" rel="noreferrer">
              {quote.fileName || '見積ファイルを開く'}
            </a>
          )}
          {quote.pdfUrl && (
            <a className="ghost-button external-button" href={quote.pdfUrl} target="_blank" rel="noreferrer">
              {quote.pdfFileName || '見積PDFを開く'}
            </a>
          )}
        </article>
        );
      })}
    </div>
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
