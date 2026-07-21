import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import {
  businessCodeDuplicateMessage,
  businessCodeFormatMessage,
  hasDuplicateBusinessCode,
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import { PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_TYPES } from '../constants.js';
import { emptyProject } from '../hooks/useProjects.js';
import {
  PROJECT_PRODUCT_REASON_OPTIONS,
  PROJECT_PRODUCT_STATUSES,
  PROJECT_PRODUCT_UNITS,
  calculateProjectProductProposal,
  emptyProjectProductProposal,
  normalizeProjectProductProposal,
  summarizeProjectProductProposals,
} from '../services/projectProductProposalService.js';
import { productDisplayName } from '../../products/hooks/useProducts.js';
import { inventoryLabel } from '../../inventory/hooks/useInventory.js';

function formatCurrency(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString('ja-JP')}円` : String(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').replace(/%/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQuoteAmount(quote) {
  return toNumber(quote.subtotal) || toNumber(quote.totalAmount) || toNumber(quote.grandTotal) || toNumber(quote.quantity) * toNumber(quote.unitPrice);
}

function getQuoteCost(quote) {
  return toNumber(quote.inventoryCostTotal) || toNumber(quote.costAmount) || toNumber(quote.quantity) * toNumber(quote.costPrice);
}

function getQuoteGrossMargin(quote) {
  const explicit = toNumber(quote.grossMarginAmount);
  if (explicit !== 0) return explicit;
  return getQuoteAmount(quote) - getQuoteCost(quote);
}

function getQuoteExpenses(quote) {
  const expenseTotal =
    toNumber(quote.freight) +
    toNumber(quote.storageFee) +
    toNumber(quote.customsFee) +
    toNumber(quote.inspectionFee) +
    toNumber(quote.processingFee) +
    toNumber(quote.salesCommission) +
    toNumber(quote.otherExpense) +
    toNumber(quote.commonExpenseAmount);
  const operatingProfit = getQuoteGrossMargin(quote) - expenseTotal;
  const realProfit =
    operatingProfit +
    toNumber(quote.fxGainLoss) -
    toNumber(quote.discount) -
    toNumber(quote.disposalLoss);

  return {
    expenseTotal,
    operatingProfit,
    realProfit,
  };
}

function getDaysSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
}

function getProbability(project) {
  const statusIndex = PROJECT_STATUSES.indexOf(project.status);
  const probabilities = [10, 20, 35, 50, 65, 80, 85, 90, 45, 0, 100];
  if (statusIndex >= 0) return probabilities[statusIndex] ?? 30;
  return toNumber(project.winProbability || project.probability) || 30;
}

function includesText(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

function toggleArrayValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function makeInitialProject(defaultCustomerId = '', defaultSupplierId = '') {
  return {
    ...emptyProject,
    projectCode: '',
    title: '',
    customerId: defaultCustomerId,
    supplierId: defaultSupplierId,
    type: defaultSupplierId ? '仕入交渉' : '新規提案',
    status: 'リード',
    priority: '通常',
    startDate: new Date().toISOString().slice(0, 10),
  };
}

function formatDate(value) {
  if (!value) return '-';
  return String(value).slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return date.toLocaleString('ja-JP');
}

function hasSameDay(a, b) {
  return a && b && String(a).slice(0, 10) === String(b).slice(0, 10);
}

function getContactNames(contactIds = [], contacts = []) {
  return contactIds
    .map((id) => contacts.find((contact) => contact.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

function isLinkedByProject(record, project, linkedIds = []) {
  if (!record) return false;
  return (
    record.projectId === project.id ||
    record.project_id === project.id ||
    record.dealId === project.id ||
    record.deal_id === project.id ||
    linkedIds.includes(record.id)
  );
}

function isOwnerRelated(record, project) {
  return (
    (project.customerId && record.customerId === project.customerId) ||
    (project.customerId && record.customer_id === project.customerId) ||
    (project.supplierId && record.supplierId === project.supplierId) ||
    (project.supplierId && record.supplier_id === project.supplierId)
  );
}

function isQuoteRelatedToProject(quote, project) {
  const explicitlyLinked = isLinkedByProject(quote, project, project.quoteIds);
  const titleLinked =
    quote.projectName &&
    quote.projectName === project.title &&
    (!project.customerId || quote.customerId === project.customerId) &&
    (!project.supplierId || quote.supplierId === project.supplierId);
  return explicitlyLinked || titleLinked;
}

function buildProjectDashboard(project, { quotes = [], events = [], contacts = [] }) {
  const relatedQuotes = quotes.filter((quote) => isQuoteRelatedToProject(quote, project));
  const proposalTotals = summarizeProjectProductProposals(project.productProposals ?? []);
  const quoteTotals = relatedQuotes.reduce((totals, quote) => {
    const amount = getQuoteAmount(quote);
    const cost = getQuoteCost(quote);
    const grossMargin = getQuoteGrossMargin(quote);
    const expenses = getQuoteExpenses(quote);

    return {
      sales: totals.sales + amount,
      cost: totals.cost + cost,
      grossMargin: totals.grossMargin + grossMargin,
      expenseTotal: totals.expenseTotal + expenses.expenseTotal,
      operatingProfit: totals.operatingProfit + expenses.operatingProfit,
      realProfit: totals.realProfit + expenses.realProfit,
    };
  }, {
    sales: 0,
    cost: 0,
    grossMargin: 0,
    expenseTotal: 0,
    operatingProfit: 0,
    realProfit: 0,
  });

  const hasFinancialSource = relatedQuotes.length > 0 || (project.productProposals ?? []).length > 0;
  const sales = hasFinancialSource ? quoteTotals.sales + proposalTotals.sales : toNumber(project.expectedSales);
  const grossMargin = hasFinancialSource ? quoteTotals.grossMargin + proposalTotals.grossMargin : toNumber(project.expectedGrossProfit);
  const operatingProfit = hasFinancialSource ? quoteTotals.operatingProfit + proposalTotals.operatingProfit : toNumber(project.expectedOperatingProfit);
  const realProfit = hasFinancialSource ? quoteTotals.realProfit + proposalTotals.realProfit : operatingProfit;
  const nextSchedule = events
    .filter((event) => isLinkedByProject(event, project))
    .filter((event) => event.startAt || event.nextFollowDate)
    .sort((a, b) => String(a.startAt || a.nextFollowDate).localeCompare(String(b.startAt || b.nextFollowDate)))[0];
  const lastUpdatedAt = project.updatedAt || project.createdAt || project.startDate;
  const stagnantDays = getDaysSince(lastUpdatedAt);

  return {
    probability: getProbability(project),
    sales,
    cost: quoteTotals.cost + proposalTotals.cost,
    grossMargin,
    expenseTotal: quoteTotals.expenseTotal + proposalTotals.expenseTotal,
    operatingProfit,
    realProfit,
    nextAction: project.nextActionDate || '-',
    nextSchedule: nextSchedule?.startAt || nextSchedule?.nextFollowDate || '',
    lastUpdatedAt,
    stagnantDays,
    owner: getContactNames(project.contactIds, contacts) || project.ownerUserId || '-',
    priority: project.priority || '-',
    status: project.status || '-',
    quoteCount: relatedQuotes.length,
    proposalCount: project.productProposals?.length ?? 0,
    warning: stagnantDays >= 14,
  };
}

function timelineItem({ id, date, type, content, owner = '', writer = '', contacts = '', action = null, hasAttachment = false }) {
  return {
    id,
    date: date || '',
    type,
    content,
    owner,
    writer,
    contacts,
    action,
    hasAttachment,
  };
}

function buildProjectTimeline({
  project,
  customer,
  supplier,
  contacts = [],
  products = [],
  inventories = [],
  issuers = [],
  quotes = [],
  invoices = [],
  samples = [],
  complaints = [],
  events = [],
  attachments = [],
}) {
  const items = [];
  const owner = customer?.companyName || supplier?.name || '';

  items.push(timelineItem({
    id: `project-created-${project.id}`,
    date: project.createdAt || project.startDate,
    type: '案件作成',
    content: `${project.title || '案件'}を作成`,
    owner,
    writer: project.createdBy || project.ownerUserId || '-',
    contacts: getContactNames(project.contactIds, contacts),
    action: project.customerId ? { label: '顧客カルテ', type: 'customer', id: project.customerId } : project.supplierId ? { label: '仕入先', type: 'supplier', id: project.supplierId } : null,
  }));

  if (project.updatedAt && !hasSameDay(project.updatedAt, project.createdAt)) {
    items.push(timelineItem({
      id: `project-updated-${project.id}`,
      date: project.updatedAt,
      type: '案件更新',
      content: `ステータス: ${project.status || '-'} / 次回: ${project.nextActionDate || '-'}`,
      owner,
      writer: project.createdBy || project.ownerUserId || '-',
      contacts: getContactNames(project.contactIds, contacts),
    }));
  }

  if (project.status) {
    items.push(timelineItem({
      id: `project-status-${project.id}`,
      date: project.updatedAt || project.createdAt,
      type: 'ステータス変更',
      content: `現在のステータス: ${project.status}`,
      owner,
      writer: project.ownerUserId || project.createdBy || '-',
      contacts: getContactNames(project.contactIds, contacts),
    }));
  }

  (customer?.dealHistories ?? [])
    .filter((history) => isLinkedByProject(history, project) || isOwnerRelated(history, project))
    .forEach((history) => {
      items.push(timelineItem({
        id: `deal-${history.id}`,
        date: history.date || history.createdAt,
        type: '商談',
        content: history.summary || history.type || '商談履歴',
        owner,
        writer: history.createdByName || history.createdBy || '-',
        contacts: (history.contactNames ?? []).join(', ') || getContactNames(history.contactIds, contacts),
        action: project.customerId ? { label: '顧客カルテ', type: 'customer', id: project.customerId } : null,
        hasAttachment: Boolean(history.attachments?.length),
      }));
    });

  events
    .filter((event) => isLinkedByProject(event, project) || isOwnerRelated(event, project))
    .forEach((event) => {
      items.push(timelineItem({
        id: `event-${event.id}`,
        date: event.startAt || event.nextFollowDate || event.createdAt,
        type: '予定',
        content: `${event.title || event.eventType || '予定'} / ${event.status || '-'}`,
        owner,
        writer: event.createdByName || event.createdBy || '-',
        contacts: getContactNames(event.contactIds, contacts),
        action: { label: 'カレンダー', type: 'calendar' },
      }));
    });

  quotes
    .filter((quote) => isQuoteRelatedToProject(quote, project))
    .forEach((quote) => {
      items.push(timelineItem({
        id: `quote-${quote.id}`,
        date: quote.submittedDate || quote.issueDate || quote.createdAt,
        type: '見積',
        content: `${quote.quoteNumber || '見積'} / ${quote.status || '-'} / ${formatCurrency(quote.grandTotal || quote.totalAmount)}`,
        owner,
        writer: quote.createdByName || quote.createdBy || '-',
        contacts: getContactNames(quote.contactIds, contacts),
        action: project.customerId ? { label: '顧客カルテ', type: 'customer', id: project.customerId } : null,
        hasAttachment: Boolean(quote.pdfUrl || quote.fileUrl || quote.attachments?.length),
      }));
    });

  samples
    .filter((sample) => isLinkedByProject(sample, project, project.sampleIds))
    .forEach((sample) => {
      items.push(timelineItem({
        id: `sample-${sample.id}`,
        date: sample.shippedDate || sample.arrivalDate || sample.followUpDate || sample.createdAt,
        type: 'サンプル',
        content: `${sample.sampleName || 'サンプル'} / ${sample.status || '-'}`,
        owner,
        writer: sample.createdByName || sample.createdBy || '-',
        contacts: getContactNames(sample.contactIds, contacts),
        action: project.customerId ? { label: '顧客カルテ', type: 'customer', id: project.customerId } : null,
      }));
    });

  products
    .filter((product) => project.productIds?.includes(product.id))
    .forEach((product) => {
      items.push(timelineItem({
        id: `product-${product.id}`,
        date: project.updatedAt || project.createdAt,
        type: '商品提案',
        content: `${productDisplayName(product, '商品')}を案件に紐付け`,
        owner,
        writer: project.ownerUserId || project.createdBy || '-',
        action: { label: '商品', type: 'products' },
        hasAttachment: Boolean(product.imageFile?.url || product.productMaterialFile?.url || product.specSheetFile?.url),
      }));
    });

  (project.productProposals ?? [])
    .map((proposal) => ({
      proposal,
      product: products.find((product) => product.id === proposal.productId),
    }))
    .forEach(({ proposal, product }) => {
      const totals = calculateProjectProductProposal(proposal);
      items.push(timelineItem({
        id: `product-proposal-${proposal.id}`,
        date: proposal.updatedAt || proposal.createdAt || project.updatedAt || project.createdAt,
        type: '商品提案',
        content: `${product?.name || '商品'} / ${proposal.status || '-'} / 見込粗利 ${formatCurrency(totals.grossProfit)}`,
        owner,
        writer: project.ownerUserId || project.createdBy || '-',
        action: { label: '商品', type: 'products' },
        hasAttachment: Boolean(product?.imageFile?.url || product?.productMaterialFile?.url || product?.specSheetFile?.url),
      }));
    });

  inventories
    .filter((inventory) => project.inventoryIds?.includes(inventory.id))
    .forEach((inventory) => {
      items.push(timelineItem({
        id: `inventory-${inventory.id}`,
        date: project.updatedAt || inventory.updatedAt || inventory.createdAt,
        type: '在庫選択',
        content: `${inventory.inventoryCode || inventory.inventoryName || inventory.lot || inventory.id} / ${inventory.inventoryStatus || '-'} / ${inventory.quantity || '-'} ${inventory.unit || ''}`,
        owner,
        writer: project.ownerUserId || project.createdBy || '-',
        action: { label: '商品', type: 'products' },
      }));
    });

  complaints
    .filter((complaint) => isLinkedByProject(complaint, project, project.complaintIds))
    .forEach((complaint) => {
      items.push(timelineItem({
        id: `complaint-${complaint.id}`,
        date: complaint.createdAt || complaint.updatedAt,
        type: 'クレーム',
        content: `${complaint.title || 'クレーム'} / ${complaint.status || '-'}`,
        owner,
        writer: complaint.createdByName || complaint.createdBy || '-',
        action: project.customerId ? { label: '顧客カルテ', type: 'customer', id: project.customerId } : null,
        hasAttachment: Boolean(complaint.attachments?.length),
      }));
    });

  attachments
    .filter((attachment) =>
      attachment.projectId === project.id ||
      attachment.project_id === project.id ||
      attachment.ownerType === 'project' && attachment.ownerId === project.id ||
      attachment.owner_type === 'project' && attachment.owner_id === project.id ||
      attachment.metadata?.projectId === project.id)
    .forEach((attachment) => {
      items.push(timelineItem({
        id: `attachment-${attachment.id}`,
        date: attachment.createdAt || attachment.uploadedAt || attachment.updatedAt,
        type: '添付ファイル',
        content: attachment.fileName || attachment.name || '添付ファイル',
        owner,
        writer: attachment.uploadedByName || attachment.uploadedBy || '-',
        hasAttachment: true,
      }));
    });

  return items
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function ProjectPanel({
  title = '案件',
  projects = [],
  customers = [],
  suppliers = [],
  contacts = [],
  products = [],
  inventories = [],
  issuers = [],
  quotes = [],
  samples = [],
  complaints = [],
  events = [],
  attachments = [],
  addProject,
  updateProject,
  removeProject,
  defaultCustomerId = '',
  defaultSupplierId = '',
  setActivePage,
  onOpenKarte,
  onCreateQuote,
  onCreateInvoice,
}) {
  const [keyword, setKeyword] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(() => makeInitialProject(defaultCustomerId, defaultSupplierId));
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [timelineOrder, setTimelineOrder] = useState('desc');

  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  const scopedProjects = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return projects
      .filter((project) => !defaultCustomerId || project.customerId === defaultCustomerId)
      .filter((project) => !defaultSupplierId || project.supplierId === defaultSupplierId)
      .filter((project) => {
        if (!normalizedKeyword) return true;
        const customer = customerMap.get(project.customerId);
        const supplier = supplierMap.get(project.supplierId);
        return [
          project.title,
          project.projectCode,
          project.type,
          project.status,
          project.priority,
          project.memo,
          customer?.companyName,
          supplier?.name,
        ].some((value) => includesText(value, normalizedKeyword));
      });
  }, [customerMap, defaultCustomerId, defaultSupplierId, keyword, projects, supplierMap]);

  const relatedContacts = useMemo(
    () => contacts.filter((contact) => !form.customerId || contact.customerId === form.customerId),
    [contacts, form.customerId],
  );

  const relatedInventories = useMemo(
    () => inventories.filter((inventory) => !form.productIds.length || form.productIds.includes(inventory.productId)),
    [form.productIds, inventories],
  );

  const relatedQuotes = useMemo(
    () => quotes.filter((quote) => (!form.customerId || quote.customerId === form.customerId) && (!form.supplierId || quote.supplierId === form.supplierId)),
    [form.customerId, form.supplierId, quotes],
  );

  const relatedSamples = useMemo(
    () => samples.filter((sample) => !form.customerId || sample.customerId === form.customerId),
    [form.customerId, samples],
  );

  const relatedComplaints = useMemo(
    () => complaints.filter((complaint) => !form.customerId || complaint.customerId === form.customerId),
    [complaints, form.customerId],
  );

  const projectTimeline = useMemo(
    () => editingProject
      ? buildProjectTimeline({
        project: editingProject,
        customer: customerMap.get(editingProject.customerId),
        supplier: supplierMap.get(editingProject.supplierId),
        contacts,
        products,
        inventories,
        quotes,
        samples,
        complaints,
        events,
        attachments,
      })
      : [],
    [attachments, complaints, contacts, customerMap, editingProject, events, inventories, products, quotes, samples, supplierMap],
  );

  const orderedTimeline = useMemo(() => {
    const nextTimeline = [...projectTimeline];
    return timelineOrder === 'asc' ? nextTimeline.reverse() : nextTimeline;
  }, [projectTimeline, timelineOrder]);

  const projectDashboards = useMemo(() => {
    return new Map(projects.map((project) => [
      project.id,
      buildProjectDashboard(project, { quotes, events, contacts }),
    ]));
  }, [contacts, events, projects, quotes]);

  const editingDashboard = editingProject ? projectDashboards.get(editingProject.id) : null;

  const columns = useMemo(
    () => [
      { key: 'projectCode', label: '案件コード', minWidth: '140px', render: (project) => project.projectCode || '-' },
      { key: 'title', label: '件名', minWidth: '220px', render: (project) => <strong>{project.title}</strong> },
      { key: 'owner', label: '会社', minWidth: '190px', render: (project) => customerMap.get(project.customerId)?.companyName || supplierMap.get(project.supplierId)?.name || '-' },
      { key: 'type', label: '種別', minWidth: '120px', render: (project) => project.type || '-' },
      { key: 'status', label: 'ステータス', minWidth: '120px', render: (project) => project.status || '-' },
      { key: 'probability', label: '受注確率', minWidth: '100px', render: (project) => `${projectDashboards.get(project.id)?.probability ?? 0}%` },
      { key: 'sales', label: '想定売上', minWidth: '120px', render: (project) => formatCurrency(projectDashboards.get(project.id)?.sales) },
      { key: 'grossMargin', label: '想定粗利', minWidth: '120px', render: (project) => formatCurrency(projectDashboards.get(project.id)?.grossMargin) },
      { key: 'operatingProfit', label: '営業利益', minWidth: '120px', render: (project) => formatCurrency(projectDashboards.get(project.id)?.operatingProfit) },
      { key: 'priority', label: '優先度', minWidth: '90px', render: (project) => project.priority || '-' },
      { key: 'nextActionDate', label: '次回アクション', minWidth: '130px', render: (project) => project.nextActionDate || '-' },
      { key: 'stagnantDays', label: '停滞日数', minWidth: '90px', render: (project) => `${projectDashboards.get(project.id)?.stagnantDays ?? 0}日` },
    ],
    [customerMap, projectDashboards, supplierMap],
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startCreate() {
    setEditingProject(null);
    setForm(makeInitialProject(defaultCustomerId, defaultSupplierId));
    setError('');
    setFormOpen(true);
  }

  function startEdit(project) {
    setEditingProject(project);
    setForm(project);
    setError('');
    setFormOpen(true);
  }

  function saveProject(event) {
    event.preventDefault();
    const projectCode = normalizeBusinessCode(form.projectCode);
    if (!isValidBusinessCode(projectCode)) {
      setError(businessCodeFormatMessage('案件コード'));
      return;
    }

    if (hasDuplicateBusinessCode(projects, 'projectCode', projectCode, editingProject?.id)) {
      setError(businessCodeDuplicateMessage('案件コード'));
      return;
    }

    if (!form.title.trim()) {
      setError('件名は必須です。');
      return;
    }
    if (!form.customerId && !form.supplierId) {
      setError('取引先または仕入先のどちらかを選択してください。');
      return;
    }

    const productProposals = (form.productProposals ?? []).map((proposal) => normalizeProjectProductProposal(proposal));
    const proposalTotals = summarizeProjectProductProposals(productProposals);
    const payload = {
      ...form,
      projectCode,
      title: form.title.trim(),
      productProposals,
      expectedSales: form.expectedSales || proposalTotals.sales || '',
      expectedGrossProfit: form.expectedGrossProfit || proposalTotals.grossMargin || '',
      expectedOperatingProfit: form.expectedOperatingProfit || proposalTotals.operatingProfit || '',
    };

    if (editingProject) {
      updateProject(editingProject.id, payload);
    } else {
      addProject(payload);
    }
    setFormOpen(false);
    setEditingProject(null);
  }

  function duplicateProject(project) {
    addProject({
      ...project,
      id: crypto.randomUUID(),
      projectCode: '',
      title: `${project.title} コピー`,
      status: 'リード',
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  function finishProject(project) {
    updateProject(project.id, { status: '終了' });
  }

  function createQuoteForProject(project) {
    onCreateQuote?.({
      projectId: project.id,
      customerId: project.customerId || '',
      supplierId: project.supplierId || '',
      issuerId: project.defaultIssuerId || '',
      projectName: project.title || '',
      contactIds: project.contactIds ?? [],
      productIds: project.productIds ?? [],
      inventoryIds: project.inventoryIds ?? [],
      productProposals: project.productProposals ?? [],
    });
  }

  function createInvoiceForProject(project) {
    const relatedQuote = quotes.find((quote) => isQuoteRelatedToProject(quote, project));
    onCreateInvoice?.({
      quoteId: relatedQuote?.id || '',
      projectId: project.id,
      customerId: project.customerId || '',
      supplierId: project.supplierId || '',
    });
  }

  function toggleFormArray(field, value) {
    setForm((current) => ({ ...current, [field]: toggleArrayValue(current[field] ?? [], value) }));
  }

  return (
    <section className="detail-section project-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <span>{scopedProjects.length}件</span>
        </div>
        <button type="button" className="primary-button compact-action-button" onClick={startCreate}>
          ＋ 案件追加
        </button>
      </div>

      <label className="field-label project-search">
        案件検索
        <input value={keyword} placeholder="件名・会社・ステータス・メモで検索" onChange={(event) => setKeyword(event.target.value)} />
      </label>

      {formOpen && (
        <form className="project-editor" onSubmit={saveProject} onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault();
        }}>
          <div className="section-heading">
            <h3>{editingProject ? '案件編集' : '案件追加'}</h3>
            <div className="mail-action-row">
              {editingProject && (
                <button type="button" className="primary-button" onClick={() => createQuoteForProject(editingProject)}>
                  見積作成
                </button>
              )}
              <button type="button" className="text-button" onClick={() => setFormOpen(false)}>閉じる</button>
            </div>
          </div>
          {error && <p className="form-error-message">{error}</p>}
          <div className="project-form-grid">
            <label className="field-label">案件コード<input value={form.projectCode || ''} placeholder="例: PJ-001" onChange={(event) => updateForm('projectCode', event.target.value)} onBlur={() => updateForm('projectCode', normalizeBusinessCode(form.projectCode))} /></label>
            <label className="field-label project-editor-wide">件名 <span className="required-mark">必須</span><input value={form.title} onChange={(event) => updateForm('title', event.target.value)} /></label>
            <label className="field-label">取引先<select value={form.customerId} onChange={(event) => updateForm('customerId', event.target.value)}><option value="">未選択</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}</select></label>
            <label className="field-label">仕入先<select value={form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)}><option value="">未選択</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label className="field-label">既定発行元<select value={form.defaultIssuerId || ''} onChange={(event) => updateForm('defaultIssuerId', event.target.value)}><option value="">未設定</option>{issuers.filter((issuer) => issuer.isActive !== false).map((issuer) => <option value={issuer.id} key={issuer.id}>{issuer.name || issuer.legalName}</option>)}</select></label>
            <label className="field-label">種別<select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>{PROJECT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="field-label">ステータス<select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>{PROJECT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="field-label">優先度<select value={form.priority} onChange={(event) => updateForm('priority', event.target.value)}>{PROJECT_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label className="field-label">担当者ID<input value={form.ownerUserId} onChange={(event) => updateForm('ownerUserId', event.target.value)} /></label>
            <label className="field-label">開始日<input type="date" value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} /></label>
            <label className="field-label">予定成約日<input type="date" value={form.expectedCloseDate} onChange={(event) => updateForm('expectedCloseDate', event.target.value)} /></label>
            <label className="field-label">次回アクション<input type="date" value={form.nextActionDate} onChange={(event) => updateForm('nextActionDate', event.target.value)} /></label>
            <label className="field-label">見込売上<input type="number" value={form.expectedSales} onChange={(event) => updateForm('expectedSales', event.target.value)} /></label>
            <label className="field-label">見込粗利<input type="number" value={form.expectedGrossProfit} onChange={(event) => updateForm('expectedGrossProfit', event.target.value)} /></label>
            <label className="field-label">見込営業利益<input type="number" value={form.expectedOperatingProfit} onChange={(event) => updateForm('expectedOperatingProfit', event.target.value)} /></label>
            <label className="field-label project-editor-wide">メモ<textarea value={form.memo} onChange={(event) => updateForm('memo', event.target.value)} /></label>
          </div>

          <ProjectCheckboxes title="担当者" items={relatedContacts} selectedIds={form.contactIds} getLabel={(item) => item.name} onToggle={(id) => toggleFormArray('contactIds', id)} />
          <ProjectCheckboxes title="商品" items={products} selectedIds={form.productIds} getLabel={(item) => productDisplayName(item)} onToggle={(id) => toggleFormArray('productIds', id)} />
          <ProjectCheckboxes title="在庫" items={relatedInventories} selectedIds={form.inventoryIds} getLabel={(item) => inventoryLabel(item, products.find((product) => product.id === item.productId), suppliers.find((supplier) => supplier.id === item.supplierId)) || item.id} onToggle={(id) => toggleFormArray('inventoryIds', id)} />
          <ProjectCheckboxes title="見積" items={relatedQuotes} selectedIds={form.quoteIds} getLabel={(item) => item.quoteNumber || item.projectName || item.id} onToggle={(id) => toggleFormArray('quoteIds', id)} />
          <ProjectCheckboxes title="サンプル" items={relatedSamples} selectedIds={form.sampleIds} getLabel={(item) => item.sampleName || item.id} onToggle={(id) => toggleFormArray('sampleIds', id)} />
          <ProjectCheckboxes title="クレーム" items={relatedComplaints} selectedIds={form.complaintIds} getLabel={(item) => item.title || item.memo || item.id} onToggle={(id) => toggleFormArray('complaintIds', id)} />

          <ProjectProductProposalManager
            products={products}
            proposals={form.productProposals ?? []}
            onChange={(nextProposals) => {
              setForm((current) => ({
                ...current,
                productProposals: nextProposals,
                productIds: Array.from(new Set([
                  ...(current.productIds ?? []),
                  ...nextProposals.map((proposal) => proposal.productId).filter(Boolean),
                ])),
              }));
            }}
          />

          {editingProject && editingDashboard && (
            <ProjectDecisionDashboard dashboard={editingDashboard} />
          )}

          {editingProject && (
            <ProjectActivityTimeline
              onNavigate={(activity) => navigateActivity(activity, { onOpenKarte, setActivePage })}
              order={timelineOrder}
              setOrder={setTimelineOrder}
              timeline={orderedTimeline}
            />
          )}

          <div className="customer-editor-actions">
            <button type="button" className="ghost-button" onClick={() => setFormOpen(false)}>キャンセル</button>
            <button type="submit" className="primary-button">保存</button>
          </div>
        </form>
      )}

      <DesktopTable
        actions={(project) => (
          <>
            {project.customerId && <button type="button" className="ghost-button" onClick={() => onOpenKarte?.(project.customerId)}>取引先</button>}
            {project.supplierId && <button type="button" className="ghost-button" onClick={() => setActivePage?.('Suppliers')}>仕入先</button>}
            <button type="button" className="ghost-button" onClick={() => createQuoteForProject(project)}>見積作成</button>
            <button type="button" className="ghost-button" onClick={() => createInvoiceForProject(project)}>請求書</button>
            <button type="button" className="ghost-button" onClick={() => startEdit(project)}>編集</button>
            <button type="button" className="ghost-button" onClick={() => duplicateProject(project)}>複製</button>
            <button type="button" className="ghost-button" onClick={() => finishProject(project)}>終了</button>
            <button type="button" className="ghost-button danger" onClick={() => removeProject(project.id)}>削除</button>
          </>
        )}
        actionWidth="360px"
        className="projects-common-table"
        columns={columns}
        minWidth={1680}
        rows={scopedProjects}
        emptyMessage="案件がありません"
      />

      <div className="card-grid two-column-grid desktop-card-fallback">
        {scopedProjects.map((project) => {
          const dashboard = projectDashboards.get(project.id);
          return (
          <article className={`company-card ${dashboard?.warning ? 'ng-card' : ''}`} key={project.id}>
            <div className="company-heading">
              <h3>{project.title}</h3>
              <p>{customerMap.get(project.customerId)?.companyName || supplierMap.get(project.supplierId)?.name || '会社未設定'}</p>
            </div>
            <div className="lead-badges">
              <span className="info-badge ready">{project.status}</span>
              <span className="info-badge">{project.type}</span>
              <span className="info-badge">{project.priority}</span>
              {dashboard?.warning && <span className="info-badge failed">停滞 {dashboard.stagnantDays}日</span>}
            </div>
            <p className="inline-helper">受注確率: {dashboard?.probability ?? 0}% / 売上: {formatCurrency(dashboard?.sales)} / 営業利益: {formatCurrency(dashboard?.operatingProfit)}</p>
            <p className="inline-helper">次回: {dashboard?.nextAction || '-'} / 予定: {formatDate(dashboard?.nextSchedule) || '-'}</p>
            <p>{project.memo || 'メモなし'}</p>
            <div className="card-actions">
              <button type="button" className="primary-button" onClick={() => createQuoteForProject(project)}>見積作成</button>
              <button type="button" className="ghost-button" onClick={() => createInvoiceForProject(project)}>請求書</button>
              <button type="button" className="ghost-button" onClick={() => startEdit(project)}>編集</button>
              <button type="button" className="ghost-button" onClick={() => duplicateProject(project)}>複製</button>
              <button type="button" className="ghost-button" onClick={() => finishProject(project)}>終了</button>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function ProjectDecisionDashboard({ dashboard }) {
  const kpis = [
    { label: '受注確率', value: `${dashboard.probability}%` },
    { label: '想定売上', value: formatCurrency(dashboard.sales) },
    { label: '想定粗利', value: formatCurrency(dashboard.grossMargin) },
    { label: '想定営業利益', value: formatCurrency(dashboard.operatingProfit) },
    { label: '想定実質利益', value: formatCurrency(dashboard.realProfit) },
    { label: '経費合計', value: formatCurrency(dashboard.expenseTotal) },
    { label: '次回アクション', value: dashboard.nextAction || '-' },
    { label: '次回予定', value: formatDate(dashboard.nextSchedule) || '-' },
    { label: '最終更新日', value: formatDate(dashboard.lastUpdatedAt) || '-' },
    { label: '停滞日数', value: `${dashboard.stagnantDays}日` },
    { label: '担当者', value: dashboard.owner || '-' },
    { label: '重要度', value: dashboard.priority || '-' },
    { label: '現在ステータス', value: dashboard.status || '-' },
    { label: '関連見積', value: `${dashboard.quoteCount}件` },
  ];

  return (
    <section className={`project-decision-dashboard project-editor-wide ${dashboard.warning ? 'stagnant' : ''}`}>
      <div className="section-heading">
        <div>
          <h3>営業判断ダッシュボード</h3>
          <span>案件単位</span>
        </div>
        {dashboard.warning && <span className="info-badge failed">更新停滞</span>}
      </div>
      <div className="score-panel project-kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
          </div>
        ))}
      </div>
      {dashboard.warning && (
        <p className="form-error-message">14日以上更新がない案件です。次回アクションまたは予定を確認してください。</p>
      )}
    </section>
  );
}

function ProjectProductProposalManager({ products, proposals, onChange }) {
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(() => emptyProjectProductProposal(products[0]?.id ?? ''));
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const normalizedProposals = useMemo(
    () => proposals.map((proposal) => normalizeProjectProductProposal(proposal)),
    [proposals],
  );
  const proposalColumns = useMemo(
    () => [
      { key: 'productCode', label: '商品コード', minWidth: '120px', render: (proposal) => productMap.get(proposal.productId)?.productCode || '-' },
      { key: 'product', label: '商品', minWidth: '220px', render: (proposal) => productDisplayName(productMap.get(proposal.productId), '-') },
      { key: 'status', label: '進捗', minWidth: '100px', render: (proposal) => proposal.status },
      { key: 'monthly', label: '月間', minWidth: '90px', render: (proposal) => proposal.monthlyExpectedQuantity || '-' },
      { key: 'annual', label: '年間', minWidth: '90px', render: (proposal) => proposal.annualExpectedQuantity || calculateProjectProductProposal(proposal).annualQuantity || '-' },
      { key: 'unit', label: '単位', minWidth: '70px', render: (proposal) => proposal.unit || '-' },
      { key: 'selling', label: '想定売価', minWidth: '120px', render: (proposal) => formatCurrency(proposal.expectedSellingPrice) },
      { key: 'cost', label: '想定原価', minWidth: '120px', render: (proposal) => formatCurrency(proposal.expectedCost) },
      { key: 'gross', label: '想定粗利', minWidth: '120px', render: (proposal) => formatCurrency(calculateProjectProductProposal(proposal).grossProfit) },
      { key: 'operating', label: '営業利益', minWidth: '120px', render: (proposal) => formatCurrency(calculateProjectProductProposal(proposal).operatingProfit) },
      { key: 'reason', label: '理由', minWidth: '160px', render: (proposal) => proposal.reasonCategory || proposal.adoptionReason || proposal.rejectionReason || '-' },
    ],
    [productMap],
  );

  function startNew() {
    setEditingId('');
    setDraft(emptyProjectProductProposal(products[0]?.id ?? ''));
  }

  function startEdit(proposal) {
    setEditingId(proposal.id);
    setDraft(normalizeProjectProductProposal(proposal));
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      const next = normalizeProjectProductProposal({
        ...current,
        [field]: value,
        updatedAt: new Date().toISOString(),
      });
      return next;
    });
  }

  function saveProposal() {
    const payload = normalizeProjectProductProposal(draft);
    const exists = normalizedProposals.some((proposal) => proposal.id === payload.id);
    const nextProposals = exists
      ? normalizedProposals.map((proposal) => (proposal.id === payload.id ? payload : proposal))
      : [...normalizedProposals, payload];
    onChange(nextProposals);
    startNew();
  }

  function removeProposal(id) {
    onChange(normalizedProposals.filter((proposal) => proposal.id !== id));
    if (editingId === id) startNew();
  }

  function duplicateProposal(proposal) {
    onChange([
      ...normalizedProposals,
      normalizeProjectProductProposal({
        ...proposal,
        id: crypto.randomUUID(),
        status: '未提案',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ]);
  }

  const draftTotals = calculateProjectProductProposal(draft);

  return (
    <section className="project-product-manager project-editor-wide">
      <div className="section-heading">
        <div>
          <h3>案件商品提案・採用管理</h3>
          <span>{normalizedProposals.length}件</span>
        </div>
        <button type="button" className="ghost-button" onClick={startNew}>新規入力</button>
      </div>

      <div className="project-form-grid">
        <label className="field-label project-editor-wide">
          商品
          <select value={draft.productId} onChange={(event) => updateDraft('productId', event.target.value)}>
            <option value="">商品を選択</option>
            {products.map((product) => (
              <option value={product.id} key={product.id}>{productDisplayName(product)}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          進捗状態
          <select value={draft.status} onChange={(event) => updateDraft('status', event.target.value)}>
            {PROJECT_PRODUCT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="field-label">月間見込数量<input inputMode="decimal" value={draft.monthlyExpectedQuantity} onChange={(event) => updateDraft('monthlyExpectedQuantity', event.target.value)} /></label>
        <label className="field-label">年間見込数量<input inputMode="decimal" value={draft.annualExpectedQuantity} onChange={(event) => updateDraft('annualExpectedQuantity', event.target.value)} /></label>
        <label className="field-label">
          単位
          <select value={draft.unit} onChange={(event) => updateDraft('unit', event.target.value)}>
            {PROJECT_PRODUCT_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
          </select>
        </label>
        <label className="field-label">想定売価<input inputMode="decimal" value={draft.expectedSellingPrice} onChange={(event) => updateDraft('expectedSellingPrice', event.target.value)} /></label>
        <label className="field-label">想定原価<input inputMode="decimal" value={draft.expectedCost} onChange={(event) => updateDraft('expectedCost', event.target.value)} /></label>
        <label className="field-label">想定経費<input inputMode="decimal" value={draft.expectedExpense} onChange={(event) => updateDraft('expectedExpense', event.target.value)} /></label>
        <label className="field-label">
          採用/不採用理由
          <select value={draft.reasonCategory} onChange={(event) => updateDraft('reasonCategory', event.target.value)}>
            <option value="">未選択</option>
            {PROJECT_PRODUCT_REASON_OPTIONS.map((reason) => <option key={reason}>{reason}</option>)}
          </select>
        </label>
        <label className="field-label">競合商品<input value={draft.competitorProduct} onChange={(event) => updateDraft('competitorProduct', event.target.value)} /></label>
        <label className="field-label project-editor-wide">採用理由<textarea value={draft.adoptionReason} onChange={(event) => updateDraft('adoptionReason', event.target.value)} /></label>
        <label className="field-label project-editor-wide">不採用理由<textarea value={draft.rejectionReason} onChange={(event) => updateDraft('rejectionReason', event.target.value)} /></label>
        <label className="field-label project-editor-wide">メモ<textarea value={draft.memo} onChange={(event) => updateDraft('memo', event.target.value)} /></label>
      </div>

      <div className="score-panel project-kpi-grid proposal-kpi-grid">
        <div><span>想定粗利</span><strong>{formatCurrency(draftTotals.grossProfit)}</strong></div>
        <div><span>想定営業利益</span><strong>{formatCurrency(draftTotals.operatingProfit)}</strong></div>
        <div><span>想定実質利益</span><strong>{formatCurrency(draftTotals.realProfit)}</strong></div>
      </div>

      <div className="customer-editor-actions">
        <button type="button" className="ghost-button" onClick={startNew}>クリア</button>
        <button type="button" className="primary-button" onClick={saveProposal}>{editingId ? '商品提案を更新' : '商品提案を追加'}</button>
      </div>

      <DesktopTable
        actions={(proposal) => (
          <>
            <button type="button" className="ghost-button" onClick={() => startEdit(proposal)}>編集</button>
            <button type="button" className="ghost-button" onClick={() => duplicateProposal(proposal)}>複製</button>
            <button type="button" className="ghost-button danger" onClick={() => removeProposal(proposal.id)}>削除</button>
          </>
        )}
        actionWidth="220px"
        className="project-product-table"
        columns={proposalColumns}
        minWidth={1280}
        rows={normalizedProposals}
        emptyMessage="案件の商品提案はまだありません"
      />

      <div className="card-grid two-column-grid desktop-card-fallback">
        {normalizedProposals.map((proposal) => {
          const totals = calculateProjectProductProposal(proposal);
          return (
            <article className="company-card" key={proposal.id}>
              <div className="company-heading">
                <h3>{productDisplayName(productMap.get(proposal.productId), '商品未選択')}</h3>
                <p>{proposal.status}</p>
              </div>
              <p className="inline-helper">年間 {proposal.annualExpectedQuantity || totals.annualQuantity || '-'} {proposal.unit} / 粗利 {formatCurrency(totals.grossProfit)}</p>
              <p>{proposal.memo || proposal.adoptionReason || proposal.rejectionReason || 'メモなし'}</p>
              <div className="card-actions">
                <button type="button" className="ghost-button" onClick={() => startEdit(proposal)}>編集</button>
                <button type="button" className="ghost-button" onClick={() => duplicateProposal(proposal)}>複製</button>
                <button type="button" className="ghost-button danger" onClick={() => removeProposal(proposal.id)}>削除</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProjectCheckboxes({ title, items, selectedIds, getLabel, onToggle }) {
  if (!items.length) return null;
  return (
    <fieldset className="project-checkboxes">
      <legend>{title}</legend>
      <div>
        {items.slice(0, 24).map((item) => (
          <label className="switch-row" key={item.id}>
            <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span>{getLabel(item) || item.id}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProjectActivityTimeline({ timeline, order, setOrder, onNavigate }) {
  return (
    <section className="project-timeline project-editor-wide">
      <div className="section-heading">
        <div>
          <h3>活動タイムライン</h3>
          <span>{timeline.length}件</span>
        </div>
        <div className="segmented-control compact-segmented" aria-label="案件タイムライン表示順">
          <button type="button" className={order === 'desc' ? 'selected' : ''} onClick={() => setOrder('desc')}>
            新しい順
          </button>
          <button type="button" className={order === 'asc' ? 'selected' : ''} onClick={() => setOrder('asc')}>
            古い順
          </button>
        </div>
      </div>

      {timeline.length > 0 ? (
        <div className="timeline-list">
          {timeline.map((activity) => (
            <article className={`history-card timeline-card project-timeline-card ${activity.type === 'クレーム' ? 'ng-card' : ''}`} key={activity.id}>
              <div className="history-meta timeline-event-heading">
                <span>{formatDateTime(activity.date)} / {activity.type}</span>
                <small>{activity.writer || '-'}</small>
              </div>
              <p>{activity.content}</p>
              <div className="timeline-event-grid">
                <div>
                  <span>担当者</span>
                  <strong>{activity.contacts || '-'}</strong>
                </div>
                <div>
                  <span>記載者</span>
                  <strong>{activity.writer || '-'}</strong>
                </div>
                <div>
                  <span>添付</span>
                  <strong>{activity.hasAttachment ? 'あり' : 'なし'}</strong>
                </div>
              </div>
              {activity.action && (
                <div className="card-actions compact-actions">
                  <button type="button" className="ghost-button" onClick={() => onNavigate(activity)}>
                    {activity.action.label}へ
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="inline-helper">この案件の活動履歴はまだありません。</p>
      )}
    </section>
  );
}

function navigateActivity(activity, { onOpenKarte, setActivePage }) {
  const action = activity.action;
  if (!action) return;

  if (action.type === 'customer' && action.id) {
    onOpenKarte?.(action.id);
    return;
  }

  if (action.type === 'supplier') {
    setActivePage?.('Suppliers');
    return;
  }

  if (action.type === 'calendar') {
    setActivePage?.('Calendar');
    return;
  }

  if (action.type === 'products') {
    setActivePage?.('Products');
  }
}
