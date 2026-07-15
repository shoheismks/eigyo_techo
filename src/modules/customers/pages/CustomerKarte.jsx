import { useEffect, useMemo, useState } from 'react';
import { emptyContact, normalizeContact } from '../../contacts/hooks/useContacts.js';
import { normalizeBusinessCard } from '../../businessCards/hooks/useBusinessCards.js';
import { normalizeComplaint } from '../../claims/hooks/useComplaints.js';
import { ADOPTION_STATUSES, emptyAdoption, normalizeAdoption } from '../../products/hooks/useAdoptions.js';
import { normalizeAttachmentRecord } from '../../../shared/hooks/useAttachments.js';
import { formatPrice, parsePrice, productDisplayName } from '../../products/hooks/useProducts.js';
import {
  INVENTORY_STATUSES,
  INVENTORY_TYPES,
  INVENTORY_UNITS,
  emptyInventory,
  calculateInventoryGrossMarginRate,
  inventoryLabel,
  inventoryQuoteCostTotal,
  normalizeInventory,
} from '../../inventory/hooks/useInventory.js';
import {
  QUOTE_STATUSES,
  calculateQuoteTotals,
  emptyQuote,
  emptyQuoteLine,
  normalizeQuote,
} from '../../quotes/hooks/useQuotes.js';
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
import {
  businessCodeDuplicateMessage,
  businessCodeFormatMessage,
  hasDuplicateBusinessCode,
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import { PIPELINE_STATUSES } from '../../deals/constants.js';
import ProjectPanel from '../../deals/components/ProjectPanel.jsx';

const DEAL_TYPES = ['メール', '電話', '商談', '訪問', '見積', 'その他'];
const REPLY_TYPES = ['返信', '訂正', '補足', '次回アクション', '社内メモ'];

const emptyHistoryForm = {
  date: '',
  type: '商談',
  summary: '',
  nextAction: '',
  createdBy: '',
};

const emptyReplyForm = {
  type: '訂正',
  summary: '',
  createdBy: '',
};

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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysString(value, days) {
  const date = new Date(`${value || todayString()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function generateQuoteNumber(quotes = []) {
  const today = todayString().replaceAll('-', '');
  const prefix = `Q-${today}`;
  const count = quotes.filter((quote) => String(quote.quoteNumber || '').startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

function createSampleForm(customerId = '', user) {
  return normalizeSample({
    ...emptySample,
    customerId,
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function createContactForm(customer = {}, user) {
  return normalizeContact({
    ...emptyContact,
    customerId: customer.id ?? '',
    companyName: customer.companyName ?? '',
    userId: user?.id ?? customer.userId ?? '',
  }, user?.id ?? customer.userId ?? '');
}

function createBusinessCardForm(customerId = '', user) {
  return normalizeBusinessCard({
    customerId,
    userId: user?.id ?? '',
    extracted: {},
  }, user?.id ?? '');
}

function createComplaintForm(customer = {}, user) {
  return normalizeComplaint({
    customerId: customer.id ?? '',
    customerName: customer.companyName ?? '',
    createdBy: user?.id ?? customer.userId ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? customer.userId ?? '');
}

function createInventoryForm(customer = {}, user, productId = '') {
  return normalizeInventory({
    ...emptyInventory,
    productId,
    owner: customer.companyName ?? '',
    userId: user?.id ?? customer.userId ?? '',
    createdBy: user?.id ?? customer.userId ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? customer.userId ?? '');
}

function createReply(reply, userId = '') {
  return {
    id: crypto.randomUUID(),
    type: reply.type,
    summary: reply.summary,
    createdAt: new Date().toISOString(),
    createdBy: reply.createdBy,
    userId,
    replies: [],
  };
}

function addReplyToTree(items, targetId, reply) {
  return items.map((item) => {
    if (item.id === targetId) {
      return {
        ...item,
        replies: [...(item.replies ?? []), reply],
      };
    }

    return {
      ...item,
      replies: addReplyToTree(item.replies ?? [], targetId, reply),
    };
  });
}

function createQuoteForm(customerId = '', user, quotes = []) {
  return normalizeQuote({
    ...emptyQuote,
    customerId,
    quoteNumber: generateQuoteNumber(quotes),
    issueDate: todayString(),
    submittedDate: todayString(),
    validUntil: addDaysString(todayString(), 14),
    taxRate: '10',
    quoteLines: [emptyQuoteLine()],
    createdBy: user?.id ?? '',
    createdByName: user?.email ?? '',
  }, user?.id ?? '');
}

function calculateQuoteFinancials(quote, selectedInventories = []) {
  const totals = calculateQuoteTotals(quote);
  if ((quote.quoteLines ?? []).length > 0) {
    return totals;
  }

  const quantity = parsePrice(quote.quantity);
  const unitPrice = parsePrice(quote.unitPrice);
  const manualCost = parsePrice(quote.costPrice);
  const explicitTotal = parsePrice(quote.totalAmount);
  const totalAmount = explicitTotal !== ''
    ? explicitTotal
    : quantity !== '' && unitPrice !== ''
      ? quantity * unitPrice
      : '';
  const inventoryCost = selectedInventories.length > 0
    ? inventoryQuoteCostTotal(selectedInventories, quantity)
    : '';
  const costTotal = inventoryCost !== ''
    ? inventoryCost
    : quantity !== '' && manualCost !== ''
      ? quantity * manualCost
      : '';
  const grossMarginAmount = subtotal !== '' && costTotal !== '' ? subtotal - costTotal : '';
  const grossMarginRate =
    subtotal !== '' && subtotal > 0 && grossMarginAmount !== ''
      ? `${((grossMarginAmount / subtotal) * 100).toFixed(1).replace(/\.0$/, '')}%`
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

function Section({ title, count, defaultOpen = true, action, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="karte-section">
      <div className="karte-section-header">
        <button className="karte-section-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <small>{count !== undefined ? `${count}件` : ''}</small>
        <strong>{open ? '-' : '+'}</strong>
        </button>
        {action}
      </div>
      {open && <div className="karte-section-body">{children}</div>}
    </section>
  );
}

function AddCard({ title, description, onClick }) {
  return (
    <button className="karte-add-card" type="button" onClick={onClick}>
      <strong>＋ {title}</strong>
      {description && <span>{description}</span>}
    </button>
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
  projects = [],
  complaints,
  events = [],
  attachments,
  samples = [],
  quotes = [],
  updateCustomer,
  addProject,
  updateProject,
  removeProject,
  addAttachment,
  addSample,
  updateSample,
  addQuote,
  updateQuote,
  addAdoption,
  updateAdoption,
  addContact,
  updateContact,
  addBusinessCard,
  updateBusinessCard,
  addComplaint,
  updateComplaint,
  addInventory,
  updateInventory,
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
  const [customerCodeError, setCustomerCodeError] = useState('');
  const [sampleForm, setSampleForm] = useState(() => createSampleForm(customerId, user));
  const [quoteForm, setQuoteForm] = useState(() => createQuoteForm(customerId, user));
  const [quoteFile, setQuoteFile] = useState(null);
  const [quotePreviewHtml, setQuotePreviewHtml] = useState('');
  const [quoteUploading, setQuoteUploading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteSort, setQuoteSort] = useState('createdAt-desc');
  const [adoptionForm, setAdoptionForm] = useState(() => createAdoptionForm(customerId, user));
  const [contactForm, setContactForm] = useState(() => createContactForm({ id: customerId }, user));
  const [businessCardForm, setBusinessCardForm] = useState(() => createBusinessCardForm(customerId, user));
  const [complaintForm, setComplaintForm] = useState(() => createComplaintForm({ id: customerId }, user));
  const [inventoryForm, setInventoryForm] = useState(() => createInventoryForm({ id: customerId }, user));
  const [historyForm, setHistoryForm] = useState(emptyHistoryForm);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyForm, setReplyForm] = useState(emptyReplyForm);

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
    () => calculateInventoryGrossMarginRate(selectedQuoteInventories, quoteForm.totalAmount, quoteForm.quantity),
    [quoteForm.quantity, quoteForm.totalAmount, selectedQuoteInventories],
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
  const visibleQuotes = useMemo(() => {
    if (!karte) return [];
    const keyword = quoteSearch.trim().toLowerCase();
    const filteredQuotes = karte.estimates.filter((quote) => {
      if (!keyword) return true;
      const productNames = products
        .filter((product) => (quote.productIds ?? []).includes(product.id))
        .map((product) => productDisplayName(product))
        .join(' ');
      const contactNames = contacts
        .filter((contact) => (quote.contactIds ?? []).includes(contact.id))
        .map((contact) => contact.name)
        .join(' ');
      return [
        quote.quoteNumber,
        quote.projectName,
        quote.status,
        quote.memo,
        quote.remarks,
        productNames,
        contactNames,
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });

    return [...filteredQuotes].sort((a, b) => {
      if (quoteSort === 'amount-desc') return (parsePrice(b.grandTotal || b.totalAmount) || 0) - (parsePrice(a.grandTotal || a.totalAmount) || 0);
      if (quoteSort === 'valid-asc') return String(a.validUntil || '9999-12-31').localeCompare(String(b.validUntil || '9999-12-31'));
      if (quoteSort === 'status-asc') return String(a.status || '').localeCompare(String(b.status || ''));
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }, [contacts, karte, products, quoteSearch, quoteSort]);

  useEffect(() => {
    setSampleForm(createSampleForm(customerId, user));
    setQuoteForm(createQuoteForm(customerId, user, quotes));
    setAdoptionForm(createAdoptionForm(customerId, user));
    setContactForm(createContactForm({ id: customerId }, user));
    setBusinessCardForm(createBusinessCardForm(customerId, user));
    setComplaintForm(createComplaintForm({ id: customerId }, user));
    setInventoryForm(createInventoryForm({ id: customerId }, user));
    setHistoryForm(emptyHistoryForm);
    setReplyTarget(null);
    setReplyForm(emptyReplyForm);
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

  function updateCustomerCode(value) {
    const customerCode = normalizeBusinessCode(value);
    if (!isValidBusinessCode(customerCode)) {
      setCustomerCodeError(businessCodeFormatMessage('顧客コード'));
      return;
    }

    if (hasDuplicateBusinessCode(customers, 'customerCode', customerCode, customer.id)) {
      setCustomerCodeError(businessCodeDuplicateMessage('顧客コード'));
      return;
    }

    setCustomerCodeError('');
    updateCustomerField('customerCode', customerCode);
  }

  function updateTags(value) {
    updateCustomerField(
      'tags',
      value.split(',').map((tag) => tag.trim()).filter(Boolean),
    );
  }

  function updateContactField(field, value) {
    setContactForm((current) => ({ ...current, [field]: value }));
  }

  function startAddContact() {
    setContactForm(createContactForm(customer, user));
  }

  function startEditContact(contact) {
    setContactForm(normalizeContact(contact, user?.id ?? customer.userId));
  }

  function handleSaveContact(event) {
    event.preventDefault();
    if (!contactForm.name.trim()) return;

    const payload = normalizeContact({
      ...contactForm,
      customerId: customer.id,
      companyName: customer.companyName,
      userId: user?.id ?? customer.userId,
    }, user?.id ?? customer.userId);
    const exists = karte.contacts.some((contact) => contact.id === payload.id);
    if (exists && updateContact) {
      updateContact(payload.id, payload);
    } else if (addContact) {
      addContact(payload);
    }
    setContactForm(createContactForm(customer, user));
  }

  function updateBusinessCardField(field, value) {
    setBusinessCardForm((current) => ({ ...current, [field]: value }));
  }

  function updateBusinessCardExtracted(field, value) {
    setBusinessCardForm((current) => ({
      ...current,
      extracted: { ...(current.extracted ?? {}), [field]: value },
    }));
  }

  function startAddBusinessCard() {
    setBusinessCardForm(createBusinessCardForm(customer.id, user));
  }

  function startEditBusinessCard(card) {
    setBusinessCardForm(normalizeBusinessCard(card, user?.id ?? customer.userId));
  }

  function handleSaveBusinessCard(event) {
    event.preventDefault();
    const payload = normalizeBusinessCard({
      ...businessCardForm,
      customerId: customer.id,
      userId: user?.id ?? customer.userId,
    }, user?.id ?? customer.userId);
    const exists = karte.businessCards.some((card) => card.id === payload.id);
    if (exists && updateBusinessCard) {
      updateBusinessCard(payload.id, payload);
    } else if (addBusinessCard) {
      addBusinessCard(payload);
    }
    setBusinessCardForm(createBusinessCardForm(customer.id, user));
  }

  function updateComplaintField(field, value) {
    setComplaintForm((current) => ({ ...current, [field]: value }));
  }

  function startAddComplaint() {
    setComplaintForm(createComplaintForm(customer, user));
  }

  function startEditComplaint(complaint) {
    setComplaintForm(normalizeComplaint(complaint, user?.id ?? customer.userId));
  }

  function handleSaveComplaint(event) {
    event.preventDefault();
    if (!complaintForm.title.trim()) return;

    const payload = normalizeComplaint({
      ...complaintForm,
      customerId: customer.id,
      customerName: customer.companyName,
      userId: user?.id ?? customer.userId,
      createdBy: complaintForm.createdBy || user?.id || customer.userId,
      createdByName: complaintForm.createdByName || user?.email || '',
    }, user?.id ?? customer.userId);
    const exists = karte.complaints.some((complaint) => complaint.id === payload.id);
    if (exists && updateComplaint) {
      updateComplaint(payload.id, payload);
    } else if (addComplaint) {
      addComplaint(payload);
    }
    setComplaintForm(createComplaintForm(customer, user));
  }

  function updateInventoryField(field, value) {
    setInventoryForm((current) => ({ ...current, [field]: value }));
  }

  function startAddInventory(productId = '') {
    setInventoryForm(createInventoryForm(customer, user, productId));
  }

  function startEditInventory(inventory) {
    setInventoryForm(normalizeInventory(inventory, user?.id ?? customer.userId));
  }

  function handleSaveInventory(event) {
    event.preventDefault();
    if (!inventoryForm.productId) return;

    const payload = normalizeInventory({
      ...inventoryForm,
      userId: user?.id ?? customer.userId,
      createdBy: inventoryForm.createdBy || user?.id || customer.userId,
      createdByName: inventoryForm.createdByName || user?.email || '',
    }, user?.id ?? customer.userId);
    const exists = inventories.some((inventory) => inventory.id === payload.id);
    if (exists && updateInventory) {
      updateInventory(payload.id, payload);
    } else if (addInventory) {
      addInventory(payload);
    }
    setInventoryForm(createInventoryForm(customer, user, payload.productId));
  }

  function updateHistoryForm(field, value) {
    setHistoryForm((current) => ({ ...current, [field]: value }));
  }

  function handleAddHistory(event) {
    event.preventDefault();
    if (!historyForm.summary.trim()) return;

    const now = new Date().toISOString();
    updateCustomerField('dealHistories', [
      {
        ...historyForm,
        id: crypto.randomUUID(),
        userId: user?.id ?? customer.userId,
        date: historyForm.date || todayString(),
        createdAt: now,
        createdBy: historyForm.createdBy || user?.id || customer.userId,
        createdByName: user?.email || '',
        replies: [],
      },
      ...(customer.dealHistories ?? []),
    ]);
    setHistoryForm(emptyHistoryForm);
  }

  function startReply(history, type = '訂正') {
    setReplyTarget(history.id);
    setReplyForm({ ...emptyReplyForm, type, createdBy: user?.email || user?.id || '' });
  }

  function updateReplyForm(field, value) {
    setReplyForm((current) => ({ ...current, [field]: value }));
  }

  function handleAddReply(event) {
    event.preventDefault();
    if (!replyTarget || !replyForm.summary.trim()) return;

    updateCustomerField(
      'dealHistories',
      addReplyToTree(customer.dealHistories ?? [], replyTarget, createReply(replyForm, user?.id ?? customer.userId)),
    );
    setReplyTarget(null);
    setReplyForm(emptyReplyForm);
  }

  function updateSampleField(field, value) {
    setSampleForm((current) => ({ ...current, [field]: value }));
  }

  function startAddSample() {
    setSampleForm(createSampleForm(customer.id, user));
  }

  function startEditSample(sample) {
    setSampleForm(normalizeSample(sample, user?.id ?? customer.userId));
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

  function validateQuoteNumber(quoteNumber, quoteId = '') {
    const normalizedQuoteNumber = normalizeBusinessCode(quoteNumber);
    if (!isValidBusinessCode(normalizedQuoteNumber)) {
      return {
        ok: false,
        value: normalizedQuoteNumber,
        message: businessCodeFormatMessage('見積番号'),
      };
    }

    if (hasDuplicateBusinessCode(quotes, 'quoteNumber', normalizedQuoteNumber, quoteId)) {
      return {
        ok: false,
        value: normalizedQuoteNumber,
        message: businessCodeDuplicateMessage('見積番号'),
      };
    }

    return { ok: true, value: normalizedQuoteNumber, message: '' };
  }

  function updateAdoptionField(field, value) {
    setAdoptionForm((current) => ({ ...current, [field]: value }));
  }

  function startAddAdoption() {
    setAdoptionForm(createAdoptionForm(customer.id, user));
  }

  function startEditAdoption(adoption) {
    setAdoptionForm(normalizeAdoption(adoption, user?.id ?? customer.userId));
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

  function updateQuoteLine(lineId, field, value) {
    setQuoteForm((current) => {
      const quoteLines = (current.quoteLines?.length ? current.quoteLines : [emptyQuoteLine()]).map((line) => {
        if (line.id !== lineId) return line;

        if (field === 'productId') {
          const product = products.find((item) => item.id === value);
          return {
            ...line,
            productId: value,
            description: productDisplayName(product, line.description),
          };
        }

        if (field === 'inventoryId') {
          const inventory = inventories.find((item) => item.id === value);
          const product = products.find((item) => item.id === inventory?.productId);
          return {
            ...line,
            inventoryId: value,
            productId: inventory?.productId || line.productId,
            description: productDisplayName(product, inventory?.inventoryName || line.description),
            unit: inventory?.unit || line.unit,
            costPrice: inventory?.cost || inventory?.costPrice || line.costPrice,
          };
        }

        return { ...line, [field]: value };
      });
      const productIds = [...new Set(quoteLines.map((line) => line.productId).filter(Boolean))];
      const inventoryIds = [...new Set(quoteLines.map((line) => line.inventoryId).filter(Boolean))];
      return { ...current, quoteLines, productIds, inventoryIds };
    });
  }

  function addQuoteLine() {
    setQuoteForm((current) => ({ ...current, quoteLines: [...(current.quoteLines ?? []), emptyQuoteLine()] }));
  }

  function removeQuoteLine(lineId) {
    setQuoteForm((current) => {
      const quoteLines = (current.quoteLines ?? []).filter((line) => line.id !== lineId);
      const nextLines = quoteLines.length > 0 ? quoteLines : [emptyQuoteLine()];
      return {
        ...current,
        quoteLines: nextLines,
        productIds: [...new Set(nextLines.map((line) => line.productId).filter(Boolean))],
        inventoryIds: [...new Set(nextLines.map((line) => line.inventoryId).filter(Boolean))],
      };
    });
  }

  function buildCurrentQuoteContext(quoteId = quoteForm.id || crypto.randomUUID()) {
    const normalizedQuote = normalizeQuote({
      ...quoteForm,
      id: quoteId,
      customerId: customer.id,
      subtotal: quoteFinancials.subtotal,
      taxAmount: quoteFinancials.taxAmount,
      grandTotal: quoteFinancials.grandTotal,
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
    const validation = validateQuoteNumber(quoteForm.quoteNumber, quoteForm.id);
    if (!validation.ok) {
      setQuoteError(validation.message);
      return;
    }

    setQuoteError('');
    setQuoteForm((current) => ({ ...current, quoteNumber: validation.value }));
    const context = buildCurrentQuoteContext();
    context.quote.quoteNumber = validation.value;
    setQuotePreviewHtml(renderQuotePreviewHtml(context));
  }

  function handleQuoteDownload() {
    const validation = validateQuoteNumber(quoteForm.quoteNumber, quoteForm.id);
    if (!validation.ok) {
      setQuoteError(validation.message);
      return;
    }

    setQuoteError('');
    setQuoteForm((current) => ({ ...current, quoteNumber: validation.value }));
    const context = buildCurrentQuoteContext();
    context.quote.quoteNumber = validation.value;
    downloadQuotePdf(context);
  }

  function handleAddSample(event) {
    event.preventDefault();
    if (!sampleForm.sampleName.trim()) {
      return;
    }

    const payload = normalizeSample({
      ...sampleForm,
      customerId: customer.id,
      createdBy: user?.id ?? customer.userId,
      createdByName: user?.email ?? '',
    }, user?.id ?? customer.userId);
    const exists = karte.samples.some((sample) => sample.id === payload.id);
    if (exists && updateSample) {
      updateSample(payload.id, payload);
    } else if (addSample) {
      addSample(payload);
    }
    setSampleForm(createSampleForm(customer.id, user));
  }

  async function handleAddQuote(event) {
    event.preventDefault();
    const quoteValidation = validateQuoteNumber(quoteForm.quoteNumber, quoteForm.id);
    if (!addQuote || !quoteValidation.value) {
      return;
    }

    if (!quoteValidation.ok) {
      setQuoteError(quoteValidation.message);
      return;
    }

    setQuoteUploading(true);
    setQuoteError('');

    try {
      const quoteId = quoteForm.id || crypto.randomUUID();
      let uploadedFile = null;
      let uploadedPdf = null;
      const context = buildCurrentQuoteContext(quoteId);
      context.quote.quoteNumber = quoteValidation.value;
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

      const pdfGeneratedAt = new Date().toISOString();
      const currentQuote = karte.estimates.find((quote) => quote.id === quoteId);
      const nextStatus = quoteForm.status || '作成中';
      const normalizedPayload = normalizeQuote({
        ...quoteForm,
        id: quoteId,
        quoteNumber: quoteValidation.value,
        customerId: customer.id,
        subtotal: quoteFinancials.subtotal,
        taxAmount: quoteFinancials.taxAmount,
        grandTotal: quoteFinancials.grandTotal,
        totalAmount: quoteFinancials.totalAmount || quoteForm.totalAmount,
        inventoryCostTotal: quoteFinancials.costTotal || quoteForm.inventoryCostTotal,
        grossMarginAmount: quoteFinancials.grossMarginAmount || quoteForm.grossMarginAmount,
        grossMarginRate: quoteForm.grossMarginRate || quoteFinancials.grossMarginRate || inventoryGrossMarginRate,
        status: nextStatus,
        fileUrl: uploadedFile?.publicUrl || uploadedFile?.url || quoteForm.fileUrl,
        fileName: uploadedFile?.name || quoteFile?.name || quoteForm.fileName,
        pdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || quoteForm.pdfUrl,
        pdfFileName: uploadedPdf?.name || pdfFile.name || quoteForm.pdfFileName,
        pdfStoragePath: uploadedPdf?.path || quoteForm.pdfStoragePath,
        pdfGeneratedAt,
        pdfHistory: [
          ...(quoteForm.pdfHistory ?? []),
          {
            id: crypto.randomUUID(),
            generatedAt: pdfGeneratedAt,
            fileName: uploadedPdf?.name || pdfFile.name,
            url: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
          },
        ],
        submittedAt: nextStatus === '提出済' ? quoteForm.submittedAt || pdfGeneratedAt : quoteForm.submittedAt,
        acceptedAt: nextStatus === '採用' ? quoteForm.acceptedAt || pdfGeneratedAt : quoteForm.acceptedAt,
        updatedBy: user?.id ?? customer.userId,
        updatedByName: user?.email ?? '',
        createdBy: quoteForm.createdBy || user?.id || customer.userId,
        createdByName: quoteForm.createdByName || user?.email || '',
      }, user?.id ?? customer.userId);

      if (currentQuote && updateQuote) {
        updateQuote(quoteId, normalizedPayload);
      } else {
        addQuote(normalizedPayload);
      }
      setQuoteForm(createQuoteForm(customer.id, user, quotes));
      setQuoteFile(null);
      setQuotePreviewHtml('');
    } catch (error) {
      setQuoteError(error.message || '見積PDFの作成またはアップロードに失敗しました。');
    } finally {
      setQuoteUploading(false);
    }
  }

  function handleEditQuote(quote) {
    setQuoteForm(normalizeQuote(quote, user?.id ?? customer.userId));
    setQuoteFile(null);
    setQuotePreviewHtml('');
    setQuoteError('');
  }

  function handleDuplicateQuote(quote) {
    setQuoteForm(normalizeQuote({
      ...quote,
      id: crypto.randomUUID(),
      quoteNumber: generateQuoteNumber(quotes),
      status: '作成中',
      issueDate: todayString(),
      submittedDate: todayString(),
      validUntil: addDaysString(todayString(), 14),
      fileUrl: '',
      fileName: '',
      pdfUrl: '',
      pdfFileName: '',
      pdfStoragePath: '',
      pdfGeneratedAt: '',
      pdfHistory: [],
      submittedAt: '',
      acceptedAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, user?.id ?? customer.userId));
    setQuoteFile(null);
    setQuotePreviewHtml('');
  }

  async function handleRegenerateQuote(quote) {
    if (!updateQuote) return;
    setQuoteUploading(true);
    setQuoteError('');

    try {
      const normalizedQuote = normalizeQuote(quote, user?.id ?? customer.userId);
      const financials = calculateQuoteTotals(normalizedQuote);
      const context = buildQuotePdfContext({
        quote: normalizedQuote,
        customer,
        contacts: karte.contacts,
        products,
        inventories,
        suppliers,
        financials,
      });
      const pdfFile = createQuotePdfFile(context);
      const uploadedPdf = await uploadAttachment({
        file: pdfFile,
        userId: user?.id ?? customer.userId,
        ownerType: 'quote',
        ownerId: normalizedQuote.id,
        field: 'quotePdf',
      });
      const generatedAt = new Date().toISOString();
      updateQuote(normalizedQuote.id, normalizeQuote({
        ...normalizedQuote,
        subtotal: financials.subtotal,
        taxAmount: financials.taxAmount,
        grandTotal: financials.grandTotal,
        totalAmount: financials.totalAmount,
        inventoryCostTotal: financials.costTotal,
        grossMarginAmount: financials.grossMarginAmount,
        grossMarginRate: financials.grossMarginRate,
        pdfUrl: uploadedPdf?.publicUrl || uploadedPdf?.url || normalizedQuote.pdfUrl,
        pdfFileName: uploadedPdf?.name || pdfFile.name,
        pdfStoragePath: uploadedPdf?.path || normalizedQuote.pdfStoragePath,
        pdfGeneratedAt: generatedAt,
        pdfHistory: [
          ...(normalizedQuote.pdfHistory ?? []),
          {
            id: crypto.randomUUID(),
            generatedAt,
            fileName: uploadedPdf?.name || pdfFile.name,
            url: uploadedPdf?.publicUrl || uploadedPdf?.url || '',
          },
        ],
        updatedBy: user?.id ?? customer.userId,
        updatedByName: user?.email ?? '',
      }, user?.id ?? customer.userId));
    } catch (error) {
      setQuoteError(error.message || 'PDF再出力に失敗しました。');
    } finally {
      setQuoteUploading(false);
    }
  }

  function handleAddAdoption(event) {
    event.preventDefault();
    if (!adoptionForm.productId) {
      return;
    }

    const payload = normalizeAdoption({
      ...adoptionForm,
      customerId: customer.id,
      userId: user?.id ?? customer.userId,
    }, user?.id ?? customer.userId);
    const exists = karte.adoptions.some((adoption) => adoption.id === payload.id);
    if (exists && updateAdoption) {
      updateAdoption(payload.id, payload);
    } else if (addAdoption) {
      addAdoption(payload);
    }
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
            <Field label="顧客コード" value={customer.customerCode} />
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
            顧客コード
            <input
              value={customer.customerCode || ''}
              placeholder="例: CUST-001"
              onChange={(event) => updateCustomerField('customerCode', event.target.value)}
              onBlur={(event) => updateCustomerCode(event.target.value)}
            />
          </label>
          {customerCodeError && <p className="form-error-message">{customerCodeError}</p>}
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

        <Section title="担当者一覧" count={karte.contacts.length} action={<button className="ghost-button compact-action-button" type="button" onClick={startAddContact}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleSaveContact}>
            <div className="date-grid">
              <label className="field-label">
                氏名
                <input value={contactForm.name} onChange={(event) => updateContactField('name', event.target.value)} />
              </label>
              <label className="field-label">
                部署
                <input value={contactForm.department} onChange={(event) => updateContactField('department', event.target.value)} />
              </label>
              <label className="field-label">
                役職
                <input value={contactForm.role} onChange={(event) => updateContactField('role', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                メール
                <input value={contactForm.email} onChange={(event) => updateContactField('email', event.target.value)} />
              </label>
              <label className="field-label">
                電話
                <input value={contactForm.phone} onChange={(event) => updateContactField('phone', event.target.value)} />
              </label>
              <label className="field-label">
                携帯
                <input value={contactForm.mobile} onChange={(event) => updateContactField('mobile', event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              人物メモ
              <textarea value={contactForm.memo} onChange={(event) => updateContactField('memo', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!contactForm.name.trim()}>
              {karte.contacts.some((contact) => contact.id === contactForm.id) ? '担当者を更新' : '担当者を追加'}
            </button>
          </form>
          <div className="karte-card-list">
            {karte.contacts.length > 0 ? karte.contacts.map((contact) => (
              <article className="karte-mini-card clickable-card" key={contact.id} onClick={() => startEditContact(contact)}>
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
            )) : <AddCard title="担当者を追加" description="この顧客の担当者を登録します" onClick={startAddContact} />}
          </div>
        </Section>

        <Section title="名刺情報" count={karte.businessCards.length} defaultOpen={karte.businessCards.length > 0} action={<button className="ghost-button compact-action-button" type="button" onClick={startAddBusinessCard}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleSaveBusinessCard}>
            <div className="date-grid">
              <label className="field-label">
                氏名
                <input value={businessCardForm.extracted?.name || ''} onChange={(event) => updateBusinessCardExtracted('name', event.target.value)} />
              </label>
              <label className="field-label">
                会社名
                <input value={businessCardForm.extracted?.companyName || customer.companyName} onChange={(event) => updateBusinessCardExtracted('companyName', event.target.value)} />
              </label>
              <label className="field-label">
                担当者
                <select value={businessCardForm.contactId || ''} onChange={(event) => updateBusinessCardField('contactId', event.target.value)}>
                  <option value="">未選択</option>
                  {karte.contacts.map((contact) => <option value={contact.id} key={contact.id}>{contact.name || '名称未設定'}</option>)}
                </select>
              </label>
            </div>
            <label className="field-label">
              OCRテキスト
              <textarea value={businessCardForm.rawText || ''} onChange={(event) => updateBusinessCardField('rawText', event.target.value)} />
            </label>
            <button className="primary-button" type="submit">
              {karte.businessCards.some((card) => card.id === businessCardForm.id) ? '名刺を更新' : '名刺を追加'}
            </button>
          </form>
          <div className="karte-card-list">
            {karte.businessCards.length > 0 ? karte.businessCards.map((card) => (
              <article className="karte-mini-card clickable-card" key={card.id} onClick={() => startEditBusinessCard(card)}>
                <h3>{card.extracted?.name || '氏名未取得'}</h3>
                <p>{card.extracted?.companyName || customer.companyName}</p>
                {card.imageFile?.url && (
                  <img className="karte-thumb" loading="lazy" src={card.imageFile.url} alt="名刺画像" />
                )}
                <p className="inline-helper">{card.rawText?.slice(0, 180) || 'OCRテキストなし'}</p>
              </article>
            )) : <AddCard title="名刺を追加" description="OCR結果を確認しながら保存します" onClick={startAddBusinessCard} />}
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

        <ProjectPanel
          title="案件"
          projects={projects}
          customers={customers}
          suppliers={suppliers}
          contacts={contacts}
          products={products}
          inventories={inventories}
          quotes={quotes}
          samples={samples}
          complaints={complaints}
          events={events}
          attachments={attachments}
          addProject={addProject}
          updateProject={updateProject}
          removeProject={removeProject}
          defaultCustomerId={customer.id}
          setActivePage={setActivePage}
        />

        <Section title="商談履歴" count={karte.dealHistories.length} action={<button className="ghost-button compact-action-button" type="button" onClick={() => setHistoryForm(emptyHistoryForm)}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleAddHistory}>
            <div className="date-grid">
              <label className="field-label">
                商談日
                <input type="date" value={historyForm.date} onChange={(event) => updateHistoryForm('date', event.target.value)} />
              </label>
              <label className="field-label">
                種別
                <select value={historyForm.type} onChange={(event) => updateHistoryForm('type', event.target.value)}>
                  {DEAL_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
            </div>
            <label className="field-label">
              商談内容
              <textarea value={historyForm.summary} onChange={(event) => updateHistoryForm('summary', event.target.value)} />
            </label>
            <label className="field-label">
              次回アクション
              <input value={historyForm.nextAction} onChange={(event) => updateHistoryForm('nextAction', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!historyForm.summary.trim()}>
              商談履歴を追加
            </button>
          </form>
          {replyTarget && (
            <form className="sample-form" onSubmit={handleAddReply}>
              <div className="date-grid">
                <label className="field-label">
                  追記種別
                  <select value={replyForm.type} onChange={(event) => updateReplyForm('type', event.target.value)}>
                    {REPLY_TYPES.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  記載者
                  <input value={replyForm.createdBy} onChange={(event) => updateReplyForm('createdBy', event.target.value)} />
                </label>
              </div>
              <label className="field-label">
                返信/訂正内容
                <textarea value={replyForm.summary} onChange={(event) => updateReplyForm('summary', event.target.value)} />
              </label>
              <div className="mail-action-row">
                <button className="primary-button" type="submit" disabled={!replyForm.summary.trim()}>追記する</button>
                <button className="ghost-button" type="button" onClick={() => setReplyTarget(null)}>キャンセル</button>
              </div>
            </form>
          )}
          <div className="timeline-list">
            {karte.dealHistories.length > 0 ? karte.dealHistories.map((history) => (
              <article className={`history-card timeline-card clickable-card ${history.hasComplaint ? 'ng-card' : ''}`} key={history.id} onClick={() => startReply(history, '訂正')}>
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
            )) : <AddCard title="商談履歴を追加" description="初回接触や商談内容を記録します" onClick={() => setHistoryForm(emptyHistoryForm)} />}
          </div>
        </Section>

        <Section title="クレーム履歴" count={karte.complaints.length} defaultOpen={hasComplaints} action={<button className="ghost-button compact-action-button" type="button" onClick={startAddComplaint}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleSaveComplaint}>
            <div className="date-grid">
              <label className="field-label">
                件名
                <input value={complaintForm.title} onChange={(event) => updateComplaintField('title', event.target.value)} />
              </label>
              <label className="field-label">
                状況
                <input value={complaintForm.status} onChange={(event) => updateComplaintField('status', event.target.value)} />
              </label>
              <label className="field-label">
                重要度
                <input value={complaintForm.severity} onChange={(event) => updateComplaintField('severity', event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              内容
              <textarea value={complaintForm.memo} onChange={(event) => updateComplaintField('memo', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!complaintForm.title.trim()}>
              {karte.complaints.some((complaint) => complaint.id === complaintForm.id) ? 'クレームを更新' : 'クレームを追加'}
            </button>
          </form>
          <div className="karte-card-list">
            {karte.complaints.length > 0 ? karte.complaints.map((complaint) => (
              <article className="karte-mini-card ng-panel clickable-card" key={complaint.id} onClick={() => startEditComplaint(complaint)}>
                <h3>{complaint.title || '件名未入力'}</h3>
                <p>{complaint.status || '-'} / {complaint.severity || '-'}</p>
                <p>{complaint.memo || '-'}</p>
                <small>{complaint.createdByName || complaint.createdBy || '-'}</small>
              </article>
            )) : <AddCard title="クレームを追加" description="対応期限や原因メモを記録します" onClick={startAddComplaint} />}
          </div>
        </Section>

        <Section title="提案商品" count={karte.products.length} action={<button className="ghost-button compact-action-button" type="button" onClick={() => setActivePage('Products')}>＋追加</button>}>
          <div className="karte-card-list">
            {karte.products.length > 0 ? karte.products.map((product) => (
              <article className="product-card clickable-card" key={product.id} onClick={() => setActivePage('Products')}>
                {product.imageFile?.url && <img className="product-preview-image" loading="lazy" src={product.imageFile.url} alt={product.name} />}
                <h3>{productDisplayName(product)}</h3>
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
            )) : <AddCard title="商品提案を追加" description="商品マスターから提案商品を選びます" onClick={() => setActivePage('Products')} />}
          </div>
        </Section>

        <Section title="在庫・仕入参照" count={karteInventories.length} defaultOpen={karteInventories.length > 0} action={<button className="ghost-button compact-action-button" type="button" onClick={() => startAddInventory(karte.products[0]?.id || products[0]?.id || '')}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleSaveInventory}>
            <div className="date-grid">
              <label className="field-label">
                商品
                <select value={inventoryForm.productId} onChange={(event) => updateInventoryField('productId', event.target.value)}>
                  <option value="">未選択</option>
                  {products.map((product) => <option value={product.id} key={product.id}>{productDisplayName(product, '商品名未設定')}</option>)}
                </select>
              </label>
              <label className="field-label">
                仕入先
                <select value={inventoryForm.supplierId} onChange={(event) => updateInventoryField('supplierId', event.target.value)}>
                  <option value="">未選択</option>
                  {suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name || supplier.companyName || '名称未設定'}</option>)}
                </select>
              </label>
              <label className="field-label">
                在庫コード
                <input value={inventoryForm.inventoryCode} onChange={(event) => updateInventoryField('inventoryCode', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                コスト
                <input inputMode="decimal" value={inventoryForm.cost} onChange={(event) => updateInventoryField('cost', event.target.value)} />
              </label>
              <label className="field-label">
                数量
                <input inputMode="decimal" value={inventoryForm.quantity} onChange={(event) => updateInventoryField('quantity', event.target.value)} />
              </label>
              <label className="field-label">
                単位
                <select value={inventoryForm.unit} onChange={(event) => updateInventoryField('unit', event.target.value)}>
                  {INVENTORY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                現物/先物
                <select value={inventoryForm.stockType} onChange={(event) => updateInventoryField('stockType', event.target.value)}>
                  {INVENTORY_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="field-label">
                ステータス
                <select value={inventoryForm.inventoryStatus} onChange={(event) => updateInventoryField('inventoryStatus', event.target.value)}>
                  {INVENTORY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
              <label className="field-label">
                所有者
                <input value={inventoryForm.owner} onChange={(event) => updateInventoryField('owner', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                ファーム期限
                <input type="date" value={inventoryForm.firmDeadline} onChange={(event) => updateInventoryField('firmDeadline', event.target.value)} />
              </label>
              <label className="field-label">
                ETA
                <input type="date" value={inventoryForm.eta} onChange={(event) => updateInventoryField('eta', event.target.value)} />
              </label>
              <label className="field-label">
                賞味期限
                <input type="date" value={inventoryForm.expiryDate} onChange={(event) => updateInventoryField('expiryDate', event.target.value)} />
              </label>
            </div>
            <label className="field-label">
              メモ
              <textarea value={inventoryForm.memo} onChange={(event) => updateInventoryField('memo', event.target.value)} />
            </label>
            <button className="primary-button" type="submit" disabled={!inventoryForm.productId}>
              {inventories.some((inventory) => inventory.id === inventoryForm.id) ? '在庫を更新' : '在庫を追加'}
            </button>
          </form>
          {karteInventories.length > 0 ? (
            <div className="karte-card-list sample-card-list">
              {karteInventories.map((inventory) => {
                const product = products.find((item) => item.id === inventory.productId);
                const supplier = suppliers.find((item) => item.id === inventory.supplierId);
                return (
                  <article className="karte-mini-card clickable-card" key={inventory.id} onClick={() => startEditInventory(inventory)}>
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
            <AddCard title="在庫を追加" description="商品に紐づく在庫を登録します" onClick={() => startAddInventory(karte.products[0]?.id || products[0]?.id || '')} />
          )}
        </Section>

        <Section title="採用品一覧" count={karte.adoptions.length} defaultOpen={karte.adoptions.length > 0} action={<button className="ghost-button compact-action-button" type="button" onClick={startAddAdoption}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleAddAdoption}>
            <div className="date-grid">
              <label className="field-label">
                商品
                <select value={adoptionForm.productId} onChange={(event) => updateAdoptionField('productId', event.target.value)}>
                  <option value="">選択してください</option>
                  {products.map((product) => (
                    <option value={product.id} key={product.id}>{productDisplayName(product, '商品名未設定')}</option>
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
            onEditAdoption={startEditAdoption}
          />
          {karte.adoptions.length === 0 && <AddCard title="採用品を追加" description="この顧客で採用された商品を記録します" onClick={startAddAdoption} />}
        </Section>

        <Section title="見積履歴" count={karte.estimates.length} defaultOpen={karte.estimates.length > 0} action={<button className="ghost-button compact-action-button" type="button" onClick={() => setQuoteForm(createQuoteForm(customer.id, user, quotes))}>＋追加</button>}>
          <form className="sample-form" onSubmit={handleAddQuote}>
            <div className="date-grid">
              <label className="field-label">
                見積番号
                <input
                  value={quoteForm.quoteNumber}
                  placeholder="例: Q-2026-001"
                  onChange={(event) => updateQuoteField('quoteNumber', event.target.value)}
                  onBlur={(event) => updateQuoteField('quoteNumber', normalizeBusinessCode(event.target.value))}
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
            <div className="date-grid">
              <label className="field-label">
                作成日
                <input type="date" value={quoteForm.issueDate} onChange={(event) => updateQuoteField('issueDate', event.target.value)} />
              </label>
              <label className="field-label">
                案件
                <input value={quoteForm.projectName} placeholder="例: 冷凍肉提案" onChange={(event) => updateQuoteField('projectName', event.target.value)} />
              </label>
              <label className="field-label">
                運賃
                <input inputMode="decimal" value={quoteForm.freight} onChange={(event) => updateQuoteField('freight', event.target.value)} />
              </label>
              <label className="field-label">
                値引
                <input inputMode="decimal" value={quoteForm.discount} onChange={(event) => updateQuoteField('discount', event.target.value)} />
              </label>
              <label className="field-label">
                消費税率(%)
                <input inputMode="decimal" value={quoteForm.taxRate} onChange={(event) => updateQuoteField('taxRate', event.target.value)} />
              </label>
            </div>
            <div className="date-grid">
              <label className="field-label">
                保管料
                <input inputMode="decimal" value={quoteForm.storageFee} onChange={(event) => updateQuoteField('storageFee', event.target.value)} />
              </label>
              <label className="field-label">
                通関費
                <input inputMode="decimal" value={quoteForm.customsFee} onChange={(event) => updateQuoteField('customsFee', event.target.value)} />
              </label>
              <label className="field-label">
                検品費
                <input inputMode="decimal" value={quoteForm.inspectionFee} onChange={(event) => updateQuoteField('inspectionFee', event.target.value)} />
              </label>
              <label className="field-label">
                加工費
                <input inputMode="decimal" value={quoteForm.processingFee} onChange={(event) => updateQuoteField('processingFee', event.target.value)} />
              </label>
              <label className="field-label">
                販売手数料
                <input inputMode="decimal" value={quoteForm.salesCommission} onChange={(event) => updateQuoteField('salesCommission', event.target.value)} />
              </label>
              <label className="field-label">
                廃棄損
                <input inputMode="decimal" value={quoteForm.disposalLoss} onChange={(event) => updateQuoteField('disposalLoss', event.target.value)} />
              </label>
              <label className="field-label">
                為替差損益
                <input inputMode="decimal" value={quoteForm.fxGainLoss} onChange={(event) => updateQuoteField('fxGainLoss', event.target.value)} />
              </label>
              <label className="field-label">
                その他経費
                <input inputMode="decimal" value={quoteForm.otherExpense} onChange={(event) => updateQuoteField('otherExpense', event.target.value)} />
              </label>
              <label className="field-label">
                共通経費
                <input inputMode="decimal" value={quoteForm.commonExpenseAmount} onChange={(event) => updateQuoteField('commonExpenseAmount', event.target.value)} />
              </label>
              <label className="field-label">
                共通経費の按分
                <select value={quoteForm.allocationBasis} onChange={(event) => updateQuoteField('allocationBasis', event.target.value)}>
                  <option value="sales">売上額比</option>
                  <option value="quantity">数量比</option>
                  <option value="weight">重量比</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              経費メモ
              <textarea value={quoteForm.expenseMemo} onChange={(event) => updateQuoteField('expenseMemo', event.target.value)} />
            </label>
            <div className="sample-form">
              <div className="history-meta">
                <span>見積明細</span>
                <button className="ghost-button" type="button" onClick={addQuoteLine}>明細を追加</button>
              </div>
              {(quoteForm.quoteLines?.length ? quoteForm.quoteLines : [emptyQuoteLine()]).map((line, index) => {
                const lineProductInventories = inventories.filter((inventory) => !line.productId || inventory.productId === line.productId);
                const calculatedLine = calculateQuoteTotals({ quoteLines: [line] }).lines[0];

                return (
                  <article className="karte-mini-card" key={line.id}>
                    <div className="history-meta">
                      <span>明細 {index + 1}</span>
                      <button className="ghost-button" type="button" onClick={() => removeQuoteLine(line.id)}>削除</button>
                    </div>
                    <div className="date-grid">
                      <label className="field-label">
                        商品
                        <select value={line.productId || ''} onChange={(event) => updateQuoteLine(line.id, 'productId', event.target.value)}>
                          <option value="">未選択</option>
                          {products.map((product) => (
                            <option value={product.id} key={product.id}>{productDisplayName(product, '商品名未設定')}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        利用在庫
                        <select value={line.inventoryId || ''} onChange={(event) => updateQuoteLine(line.id, 'inventoryId', event.target.value)}>
                          <option value="">未選択</option>
                          {lineProductInventories.map((inventory) => {
                            const product = products.find((item) => item.id === inventory.productId);
                            const supplier = suppliers.find((item) => item.id === inventory.supplierId);
                            return (
                              <option value={inventory.id} key={inventory.id}>
                                {inventoryLabel(inventory, product, supplier)}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>
                    <label className="field-label">
                      商品名・摘要
                      <input value={line.description || ''} onChange={(event) => updateQuoteLine(line.id, 'description', event.target.value)} />
                    </label>
                    <div className="date-grid">
                      <label className="field-label">
                        数量
                        <input inputMode="decimal" value={line.quantity || ''} onChange={(event) => updateQuoteLine(line.id, 'quantity', event.target.value)} />
                      </label>
                      <label className="field-label">
                        重量
                        <input inputMode="decimal" value={line.weight || ''} onChange={(event) => updateQuoteLine(line.id, 'weight', event.target.value)} />
                      </label>
                      <label className="field-label">
                        単位
                        <input value={line.unit || ''} onChange={(event) => updateQuoteLine(line.id, 'unit', event.target.value)} />
                      </label>
                      <label className="field-label">
                        販売単価
                        <input inputMode="decimal" value={line.unitPrice || ''} onChange={(event) => updateQuoteLine(line.id, 'unitPrice', event.target.value)} />
                      </label>
                      <label className="field-label">
                        原価
                        <input inputMode="decimal" value={line.costPrice || ''} onChange={(event) => updateQuoteLine(line.id, 'costPrice', event.target.value)} />
                      </label>
                    </div>
                    <dl className="company-details">
                      <div><dt>売価</dt><dd>{formatPrice(calculatedLine?.amount) || '-'}</dd></div>
                      <div><dt>粗利額</dt><dd>{formatPrice(calculatedLine?.grossMarginAmount) || '-'}</dd></div>
                      <div><dt>粗利率</dt><dd>{calculatedLine?.grossMarginRate || '-'}</dd></div>
                    </dl>
                  </article>
                );
              })}
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
                    {productDisplayName(product, '商品名未設定')}
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
                  <div><dt>在庫コスト合計</dt><dd>{formatPrice(inventoryQuoteCostTotal(selectedQuoteInventories, quoteForm.quantity)) || '-'}</dd></div>
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
          <div className="date-grid">
            <label className="field-label">
              見積検索
              <input value={quoteSearch} placeholder="見積番号・案件・商品で検索" onChange={(event) => setQuoteSearch(event.target.value)} />
            </label>
            <label className="field-label">
              並び替え
              <select value={quoteSort} onChange={(event) => setQuoteSort(event.target.value)}>
                <option value="createdAt-desc">作成日が新しい順</option>
                <option value="valid-asc">有効期限が近い順</option>
                <option value="amount-desc">金額が高い順</option>
                <option value="status-asc">ステータス順</option>
              </select>
            </label>
          </div>
          <QuoteListV1
            quotes={visibleQuotes}
            products={products}
            inventories={inventories}
            suppliers={suppliers}
            contacts={karte.contacts}
            updateQuote={updateQuote}
            onEditQuote={handleEditQuote}
            onDuplicateQuote={handleDuplicateQuote}
            onRegenerateQuote={handleRegenerateQuote}
          />
          {karte.estimates.length === 0 && <AddCard title="見積を追加" description="見積PDFまで作成して履歴に保存します" onClick={() => setQuoteForm(createQuoteForm(customer.id, user, quotes))} />}
        </Section>

        <Section title="サンプル管理" count={karte.samples.length} defaultOpen={karte.samples.length > 0} action={<button className="ghost-button compact-action-button" type="button" onClick={startAddSample}>＋追加</button>}>
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
                    {productDisplayName(product, '商品名未設定')}
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
            onEditSample={startEditSample}
          />
          {karte.samples.length === 0 && <AddCard title="サンプルを追加" description="発送日やフォロー日を登録します" onClick={startAddSample} />}
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

function SampleList({ samples, products, contacts, updateSample, onEditSample }) {
  if (!samples.length) {
    return null;
  }

  function productNames(sample) {
    const matchedProducts = products
      .filter((product) => (sample.productIds ?? []).includes(product.id))
      .map((product) => [
        product.productCode,
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
        <article className="karte-mini-card sample-card clickable-card" key={sample.id} onClick={() => onEditSample?.(sample)}>
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
                  onClick={(event) => event.stopPropagation()}
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
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateSample?.(sample.id, { feedback: event.target.value })}
                />
              </label>
              <label className="field-label">
                次アクション
                <textarea
                  value={sample.nextAction || ''}
                  onClick={(event) => event.stopPropagation()}
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

function AdoptionList({ adoptions, products, updateAdoption, onEditAdoption }) {
  if (!adoptions.length) {
    return null;
  }

  function productName(adoption) {
    return productDisplayName(products.find((product) => product.id === adoption.productId), adoption.productName || '-');
  }

  return (
    <div className="karte-card-list sample-card-list">
      {adoptions.map((adoption) => (
        <article className="karte-mini-card adoption-card clickable-card" key={adoption.id} onClick={() => onEditAdoption?.(adoption)}>
          <div className="history-meta">
            <span>{productName(adoption)}</span>
            <small>{adoption.status || '-'}</small>
          </div>
          <div className="sample-status-row">
            <label className="field-label">
              ステータス
              <select
                value={adoption.status || '採用中'}
                onClick={(event) => event.stopPropagation()}
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
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => updateAdoption?.(adoption.id, { memo: event.target.value })}
            />
          </label>
        </article>
      ))}
    </div>
  );
}

function QuoteListV1({
  quotes,
  products,
  inventories = [],
  suppliers = [],
  contacts,
  updateQuote,
  onEditQuote,
  onDuplicateQuote,
  onRegenerateQuote,
}) {
  if (!quotes.length) return null;

  function productNames(quote) {
    if ((quote.quoteLines ?? []).length > 0) {
      return quote.quoteLines
        .map((line) => line.description || productDisplayName(products.find((product) => product.id === line.productId), ''))
        .filter(Boolean)
        .join(', ') || '-';
    }
    return products
      .filter((product) => (quote.productIds ?? []).includes(product.id))
      .map((product) => [product.productCode, product.name, product.manufacturerName, product.origin].filter(Boolean).join(' / '))
      .filter(Boolean)
      .join(', ') || '-';
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
        const totals = calculateQuoteTotals(quote);

        return (
          <article className="karte-mini-card quote-card clickable-card" key={quote.id} onClick={() => onEditQuote?.(quote)}>
            <div className="history-meta">
              <span>{quote.quoteNumber || '見積番号未設定'}</span>
              <small>{quote.status || '-'}</small>
            </div>
            <div className="lead-badges">
              {validLabel && <span className={`info-badge ${dueClass(quote.validUntil, inactive)}`}>有効期限 {validLabel}</span>}
              {quote.fileUrl && <span className="info-badge ready">添付あり</span>}
              {quote.pdfUrl && <span className="info-badge ready">PDFあり</span>}
              {(quote.inventoryIds ?? []).length > 0 && <span className="info-badge ready">在庫連携あり</span>}
            </div>
            <div className="sample-status-row">
              <label className="field-label">
                ステータス
                <select
                  value={quote.status || '作成中'}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    const nextStatus = event.target.value;
                    const now = new Date().toISOString();
                    updateQuote?.(quote.id, {
                      status: nextStatus,
                      submittedAt: nextStatus === '提出済' ? quote.submittedAt || now : quote.submittedAt,
                      acceptedAt: nextStatus === '採用' ? quote.acceptedAt || now : quote.acceptedAt,
                    });
                  }}
                >
                  {QUOTE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <dl className="company-details">
              <div><dt>案件</dt><dd>{quote.projectName || '-'}</dd></div>
              <div><dt>担当者</dt><dd>{contactNames(quote)}</dd></div>
              <div><dt>商品</dt><dd>{productNames(quote)}</dd></div>
              <div><dt>利用在庫</dt><dd>{inventoryNames(quote)}</dd></div>
              <div><dt>作成日</dt><dd>{formatDate(quote.issueDate)}</dd></div>
              <div><dt>提出日</dt><dd>{formatDate(quote.submittedDate)}</dd></div>
              <div><dt>有効期限</dt><dd>{formatDate(quote.validUntil)}</dd></div>
              <div><dt>小計</dt><dd>{formatPrice(totals.subtotal) || '-'}</dd></div>
              <div><dt>消費税</dt><dd>{formatPrice(totals.taxAmount) || '-'}</dd></div>
              <div><dt>税込合計</dt><dd>{formatPrice(totals.grandTotal) || '-'}</dd></div>
              <div><dt>粗利額</dt><dd>{formatPrice(totals.grossMarginAmount) || '-'}</dd></div>
              <div><dt>粗利率</dt><dd>{totals.grossMarginRate || '-'}</dd></div>
              <div><dt>支払条件</dt><dd>{quote.paymentTerms || '-'}</dd></div>
              <div><dt>納品条件</dt><dd>{quote.deliveryTerms || '-'}</dd></div>
              <div><dt>PDF出力</dt><dd>{formatDateTime(quote.pdfGeneratedAt)}</dd></div>
            </dl>
            <label className="field-label">
              メモ
              <textarea
                value={quote.memo || ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateQuote?.(quote.id, { memo: event.target.value })}
              />
            </label>
            {quote.status === '失注' && (
              <label className="field-label">
                失注理由
                <textarea
                  value={quote.lostReason || ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => updateQuote?.(quote.id, { lostReason: event.target.value })}
                />
              </label>
            )}
            <div className="mail-action-row">
              {quote.fileUrl && (
                <a className="ghost-button external-button" href={quote.fileUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  添付を開く
                </a>
              )}
              {quote.pdfUrl && (
                <a className="ghost-button external-button" href={quote.pdfUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  PDFを開く
                </a>
              )}
              <button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); onEditQuote?.(quote); }}>
                編集
              </button>
              <button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); onDuplicateQuote?.(quote); }}>
                複製
              </button>
              <button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); onRegenerateQuote?.(quote); }}>
                PDF再出力
              </button>
            </div>
          </article>
        );
      })}
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
        product.productCode,
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
