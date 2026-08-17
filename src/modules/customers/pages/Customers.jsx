import { useEffect, useMemo, useState } from 'react';
import CompanyCard from '../../../shared/components/CompanyCard.jsx';
import DataTable from '../../../shared/components/DataTable.jsx';
import {
  businessCodeDuplicateMessage,
  businessCodeFormatMessage,
  hasDuplicateBusinessCode,
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import { discoverContactInfo } from '../services/contactDiscoveryService.js';
import {
  OFFICE_TYPE_OPTIONS,
  buildHierarchicalCustomers,
  displayCustomerOfficeName,
  getChildOffices,
  getParentCustomer,
  officeTypeLabel,
  validateOfficeAssignment,
} from '../services/customerOfficeService.js';
import { PIPELINE_STATUSES } from '../../deals/constants.js';

const ALL = 'すべて';
const PAGE_SIZE = 40;

const INITIAL_CUSTOMER_FORM = {
  customerCode: '',
  corporateNumber: '',
  companyName: '',
  companyKana: '',
  industry: '',
  area: '',
  address: '',
  postalCode: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  salesOwner: '',
  customerRank: 'D',
  parentCustomerId: '',
  officeType: 'head_office',
  branchName: '',
  branchCode: '',
  billingCustomerId: '',
  shippingCustomerId: '',
  status: '未接触',
  tagsText: '',
  nextFollowUpDate: '',
  referralSource: '',
  prospectRank: '',
  paymentTerms: '',
  closingDay: '',
  deliveryDestination: '',
  billingDestination: '',
  creditMemo: '',
  memo: '',
};

function parseTags(value) {
  return value
    .split(/[,\n、]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function followDate(customer) {
  return customer.nextFollowUpDate || customer.nextFollowDate || '';
}

function hasComplaint(customer) {
  return Boolean(customer.hasComplaint || (customer.dealHistories ?? []).some((history) => history.hasComplaint));
}

function isOverdue(customer) {
  const date = followDate(customer);
  if (!date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return date < today && !['成約', '失注'].includes(customer.status);
}

function includesText(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function shortText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  return text.length > 28 ? `${text.slice(0, 28)}...` : text;
}

function rankBadgeClass(rank) {
  return `customer-rank-badge rank-${String(rank || 'D').toLowerCase()}`;
}

function statusBadgeClass(status) {
  const value = String(status || '');
  if (value.includes('成約') || value.includes('取引')) return 'customer-status-badge status-won';
  if (value.includes('商談') || value.includes('見積')) return 'customer-status-badge status-active';
  if (value.includes('返信')) return 'customer-status-badge status-reply';
  if (value.includes('失注') || value.includes('NG')) return 'customer-status-badge status-lost';
  return 'customer-status-badge status-neutral';
}

function complaintLabel(customer) {
  return hasComplaint(customer) ? 'あり' : 'なし';
}

function customerSortValue(customer, key) {
  if (key === 'customerCode') return customer.customerCode || '';
  if (key === 'companyName') return displayCustomerOfficeName(customer) || customer.companyName || '';
  if (key === 'industry') return customer.industry || '';
  if (key === 'area') return customer.area || '';
  if (key === 'rank') return customer.customerRank || customer.rank || 'D';
  if (key === 'status') return customer.status || '';
  if (key === 'follow') return followDate(customer) || '9999-12-31';
  if (key === 'contact') return customer.contactName || customer.contactPerson || customer.salesOwner || '';
  if (key === 'createdAt') return customer.createdAt || '';
  return customer[key] || '';
}

export default function Customers({
  customers,
  addCustomer,
  updateCustomer,
  removeCustomer,
  initialSearchQuery = '',
  onOpenDetail,
  onOpenKarte,
  onOpenPipeline,
  onCreateMail,
  syncState = '',
  syncError = '',
  legacyLocalDataWarning = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [rankFilter, setRankFilter] = useState(ALL);
  const [tagFilter, setTagFilter] = useState(ALL);
  const [areaFilter, setAreaFilter] = useState(ALL);
  const [complaintFilter, setComplaintFilter] = useState(ALL);
  const [followFilter, setFollowFilter] = useState(ALL);
  const [officeFilter, setOfficeFilter] = useState(ALL);
  const [sortMode, setSortMode] = useState('created');
  const [tableSort, setTableSort] = useState({ key: '', direction: 'asc' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPreviewId, setSelectedPreviewId] = useState('');
  const [loadingCustomerId, setLoadingCustomerId] = useState('');
  const [contactErrors, setContactErrors] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(INITIAL_CUSTOMER_FORM);
  const [formError, setFormError] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState('');

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
      setVisibleCount(PAGE_SIZE);
    }
  }, [initialSearchQuery]);

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeCreateModal();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!openActionMenuId) return undefined;

    function handlePointerDown() {
      setOpenActionMenuId('');
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpenActionMenuId('');
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openActionMenuId]);

  const tagOptions = useMemo(
    () => [ALL, ...new Set(customers.flatMap((customer) => customer.tags ?? []).filter(Boolean))],
    [customers],
  );

  const areaOptions = useMemo(
    () => [ALL, ...new Set(customers.map((customer) => customer.area).filter(Boolean))],
    [customers],
  );

  const headOfficeOptions = useMemo(
    () => customers.filter((customer) => !customer.parentCustomerId && (customer.officeType || 'head_office') === 'head_office'),
    [customers],
  );

  const customerOptions = useMemo(
    () => customers.filter((customer) => !customer.isDeleted),
    [customers],
  );

  const duplicateCandidates = useMemo(() => {
    const corporateNumber = customerForm.corporateNumber?.trim();
    const companyName = customerForm.companyName.trim().toLowerCase();
    if (!corporateNumber && !companyName) return [];

    return customers
      .filter((customer) => {
        if (corporateNumber && customer.corporateNumber === corporateNumber) return true;
        return companyName && customer.companyName.toLowerCase().includes(companyName);
      })
      .slice(0, 5);
  }, [customerForm.companyName, customerForm.corporateNumber, customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const nextCustomers = customers.filter((customer) => {
      const matchesStatus = statusFilter === ALL || customer.status === statusFilter;
      const matchesRank = rankFilter === ALL || (customer.customerRank || customer.rank || 'D') === rankFilter;
      const matchesTag = tagFilter === ALL || (customer.tags ?? []).includes(tagFilter);
      const matchesArea = areaFilter === ALL || customer.area === areaFilter;
      const complaint = hasComplaint(customer);
      const matchesComplaint =
        complaintFilter === ALL ||
        (complaintFilter === 'あり' && complaint) ||
        (complaintFilter === 'なし' && !complaint);
      const matchesFollow =
        followFilter === ALL ||
        (followFilter === '期限切れ' && isOverdue(customer)) ||
        (followFilter === '予定あり' && Boolean(followDate(customer)));
      const matchesOffice =
        officeFilter === ALL ||
        (officeFilter === 'head_office' && !customer.parentCustomerId) ||
        (officeFilter === 'branch_only' && Boolean(customer.parentCustomerId)) ||
        customer.officeType === officeFilter;
      const parentCustomer = getParentCustomer(customer, customers);
      const childOffices = getChildOffices(customer, customers);
      const searchableText = [
        customer.customerCode,
        customer.companyName,
        customer.branchName,
        customer.branchCode,
        officeTypeLabel(customer.officeType),
        parentCustomer?.companyName,
        parentCustomer?.branchName,
        ...childOffices.flatMap((office) => [office.companyName, office.branchName, office.branchCode]),
        customer.industry,
        customer.area,
        customer.address,
        customer.email,
        customer.memo,
        customer.companyNote,
        ...(customer.tags ?? []),
      ].join(' ').toLowerCase();
      const matchesSearch = !normalizedQuery || searchableText.includes(normalizedQuery);

      return (
        matchesStatus &&
        matchesRank &&
        matchesTag &&
        matchesArea &&
        matchesComplaint &&
        matchesFollow &&
        matchesOffice &&
        matchesSearch
      );
    });

    if (tableSort.key) {
      return [...nextCustomers].sort((a, b) => {
        const first = customerSortValue(a, tableSort.key);
        const second = customerSortValue(b, tableSort.key);
        const direction = tableSort.direction === 'asc' ? 1 : -1;

        if (typeof first === 'number' && typeof second === 'number') {
          return (first - second) * direction;
        }

        return String(first).localeCompare(String(second), 'ja-JP', { numeric: true }) * direction;
      });
    }

    if (sortMode === 'score') {
      return [...nextCustomers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    if (sortMode === 'follow') {
      return [...nextCustomers].sort((a, b) =>
        (followDate(a) || '9999-12-31').localeCompare(followDate(b) || '9999-12-31'),
      );
    }

    return buildHierarchicalCustomers(nextCustomers);
  }, [
    areaFilter,
    complaintFilter,
    customers,
    followFilter,
    officeFilter,
    rankFilter,
    searchQuery,
    sortMode,
    statusFilter,
    tableSort,
    tagFilter,
  ]);

  const visibleCustomers = filteredCustomers.slice(0, visibleCount);
  const selectedPreviewCustomer =
    visibleCustomers.find((customer) => customer.id === selectedPreviewId) ||
    visibleCustomers[0];

  useEffect(() => {
    if (visibleCustomers.length > 0 && !visibleCustomers.some((customer) => customer.id === selectedPreviewId)) {
      setSelectedPreviewId(visibleCustomers[0].id);
    }
  }, [selectedPreviewId, visibleCustomers]);

  const desktopColumns = useMemo(
    () => [
      {
        key: 'customerCode',
        label: '顧客コード',
        minWidth: '130px',
        render: (customer) => customer.customerCode || '-',
      },
      {
        key: 'companyName',
        label: '会社名',
        width: '20%',
        render: (customer) => (
          <div className={`office-tree-cell depth-${customer.officeDepth || 0}`}>
            {customer.officeDepth > 0 && <span className="office-tree-branch">└</span>}
            <strong>{displayCustomerOfficeName(customer)}</strong>
            {getChildOffices(customer, customers).length > 0 && (
              <small>{getChildOffices(customer, customers).length}拠点</small>
            )}
          </div>
        ),
      },
      {
        key: 'officeType',
        label: '拠点',
        minWidth: '110px',
        render: (customer) => officeTypeLabel(customer.officeType),
      },
      { key: 'industry', label: '業種', minWidth: '120px', render: (customer) => customer.industry || '-' },
      { key: 'area', label: '地域', minWidth: '100px', render: (customer) => customer.area || '-' },
      {
        key: 'rank',
        label: '重要度',
        minWidth: '88px',
        render: (customer) => (
          <>
            <strong>{customer.customerRank || customer.rank || 'D'}</strong>
            <small>{customer.score ?? 0}</small>
          </>
        ),
      },
      { key: 'status', label: 'ステータス', minWidth: '120px', render: (customer) => customer.status || '-' },
      {
        key: 'follow',
        label: '次回フォロー',
        minWidth: '130px',
        className: (customer) => (isOverdue(customer) ? 'danger' : ''),
        render: (customer) => followDate(customer) || '-',
      },
      {
        key: 'contact',
        label: '担当者',
        minWidth: '120px',
        render: (customer) => customer.contactName || customer.contactPerson || '-',
      },
      {
        key: 'tags',
        label: 'タグ',
        minWidth: '160px',
        render: (customer) => (customer.tags ?? []).slice(0, 3).join(', ') || '-',
      },
      {
        key: 'complaint',
        label: 'クレーム',
        minWidth: '100px',
        render: (customer) => (hasComplaint(customer) ? 'あり' : 'なし'),
      },
    ],
    [customers],
  );

  const customerDesktopColumns = useMemo(
    () => [
      {
        key: 'customerCode',
        label: '顧客コード',
        minWidth: '150px',
        sortable: true,
        render: (customer) => (
          <div className="customer-code-cell">
            <strong>{customer.customerCode || customer.branchCode || '-'}</strong>
            <small>登録日: {formatDate(customer.createdAt)}</small>
          </div>
        ),
      },
      {
        key: 'companyName',
        label: '会社名',
        minWidth: '220px',
        sortable: true,
        render: (customer) => (
          <div className={`customer-name-cell depth-${customer.officeDepth || 0}`}>
            {customer.officeDepth > 0 && <span className="office-tree-branch">└</span>}
            <div>
              <strong>{displayCustomerOfficeName(customer)}</strong>
              <small>{officeTypeLabel(customer.officeType)}{getChildOffices(customer, customers).length > 0 ? ` / ${getChildOffices(customer, customers).length}拠点` : ''}</small>
            </div>
          </div>
        ),
      },
      { key: 'industry', label: '業種', minWidth: '130px', sortable: true, render: (customer) => customer.industry || '-' },
      { key: 'area', label: '地域', minWidth: '110px', sortable: true, render: (customer) => customer.area || '-' },
      {
        key: 'rank',
        label: '重要度',
        minWidth: '90px',
        sortable: true,
        render: (customer) => {
          const rank = customer.customerRank || customer.rank || 'D';
          return (
            <span className={rankBadgeClass(rank)}>
              <strong>{rank}</strong>
              <small>{customer.score ?? 0}</small>
            </span>
          );
        },
      },
      {
        key: 'status',
        label: 'ステータス',
        minWidth: '120px',
        sortable: true,
        render: (customer) => <span className={statusBadgeClass(customer.status)}>{customer.status || '-'}</span>,
      },
      {
        key: 'follow',
        label: '次回フォロー',
        minWidth: '155px',
        sortable: true,
        className: (customer) => (isOverdue(customer) ? 'danger' : ''),
        render: (customer) => (
          <div className="customer-follow-cell">
            <strong>{formatDate(followDate(customer))}</strong>
            <small>{shortText(customer.pipelineMemo || customer.nextAction || customer.memo, '内容未設定')}</small>
          </div>
        ),
      },
      {
        key: 'contact',
        label: '担当者',
        minWidth: '125px',
        sortable: true,
        render: (customer) => customer.contactName || customer.contactPerson || customer.salesOwner || '未設定',
      },
      {
        key: 'tags',
        label: 'タグ',
        minWidth: '150px',
        render: (customer) => {
          const tags = (customer.tags ?? []).slice(0, 2);
          if (tags.length === 0) return '-';
          return (
            <div className="customer-tag-list">
              {tags.map((tag) => <span className="customer-tag-badge" key={tag}>{tag}</span>)}
              {(customer.tags ?? []).length > 2 && <span className="customer-tag-badge muted">+{(customer.tags ?? []).length - 2}</span>}
            </div>
          );
        },
      },
      {
        key: 'complaint',
        label: 'クレーム',
        minWidth: '95px',
        render: (customer) => (
          <span className={`customer-complaint-badge ${hasComplaint(customer) ? 'has-complaint' : ''}`}>
            {complaintLabel(customer)}
          </span>
        ),
      },
    ],
    [customers],
  );

  function handleTableSort(key) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setVisibleCount(PAGE_SIZE);
  }

  async function handleDiscoverContact(customer) {
    setLoadingCustomerId(customer.id);
    setContactErrors((current) => ({ ...current, [customer.id]: '' }));

    try {
      const discovered = await discoverContactInfo(customer);
      updateCustomer(customer.id, discovered);
    } catch {
      updateCustomer(customer.id, { contactStatus: '取得失敗' });
      setContactErrors((current) => ({
        ...current,
        [customer.id]: '取得失敗',
      }));
    } finally {
      setLoadingCustomerId('');
    }
  }

  function resetPaging(handler) {
    return (event) => {
      handler(event);
      setVisibleCount(PAGE_SIZE);
    };
  }

  function openCreateModal() {
    setCustomerForm(INITIAL_CUSTOMER_FORM);
    setFormError('');
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setFormError('');
  }

  function updateFormField(field, value) {
    setCustomerForm((current) => {
      if (field === 'officeType') {
        return {
          ...current,
          officeType: value,
          parentCustomerId: value === 'head_office' ? '' : current.parentCustomerId,
          isHeadOffice: value === 'head_office',
        };
      }

      return { ...current, [field]: value };
    });
  }

  function copyParentCompanyInfo() {
    const parent = customers.find((customer) => customer.id === customerForm.parentCustomerId);
    if (!parent) return;

    setCustomerForm((current) => ({
      ...current,
      companyName: parent.companyName || current.companyName,
      companyKana: parent.companyKana || current.companyKana,
      industry: parent.industry || current.industry,
      website: parent.website || current.website,
      corporateNumber: parent.corporateNumber || current.corporateNumber,
      billingCustomerId: current.billingCustomerId || parent.id,
    }));
  }

  function handleFormKeyDown(event) {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
    }
  }

  async function handleCreateCustomer() {
    const customerCode = normalizeBusinessCode(customerForm.customerCode);
    const companyName = customerForm.companyName.trim();

    if (!isValidBusinessCode(customerCode)) {
      setFormError(businessCodeFormatMessage('顧客コード'));
      return;
    }

    if (hasDuplicateBusinessCode(customers, 'customerCode', customerCode)) {
      setFormError(businessCodeDuplicateMessage('顧客コード'));
      return;
    }

    if (!companyName) {
      setFormError('会社名は必須です。');
      return;
    }

    const officeError = validateOfficeAssignment({
      officeType: customerForm.officeType,
      parentCustomerId: customerForm.parentCustomerId,
    }, customers);
    if (officeError) {
      setFormError(officeError);
      return;
    }

    const branchCode = customerForm.branchCode.trim();
    if (
      branchCode &&
      customers.some((customer) => (customer.branchCode || '').toLowerCase() === branchCode.toLowerCase())
    ) {
      setFormError('拠点コードが重複しています。');
      return;
    }

    const now = new Date().toISOString();
    const customerId = crypto.randomUUID();
    const tags = parseTags(customerForm.tagsText);

    setIsSavingCustomer(true);
    const savedCustomer = await addCustomer({
      id: customerId,
      customerCode,
      corporateNumber: customerForm.corporateNumber.trim(),
      companyName,
      companyKana: customerForm.companyKana.trim(),
      industry: customerForm.industry.trim(),
      area: customerForm.area.trim(),
      address: customerForm.address.trim(),
      postalCode: customerForm.postalCode.trim(),
      phone: customerForm.phone.trim(),
      fax: customerForm.fax.trim(),
      email: customerForm.email.trim(),
      website: customerForm.website.trim(),
      salesOwner: customerForm.salesOwner.trim(),
      importanceRank: customerForm.customerRank,
      customerRank: customerForm.customerRank,
      rank: customerForm.customerRank,
      parentCustomerId: customerForm.officeType === 'head_office' ? '' : customerForm.parentCustomerId,
      officeType: customerForm.officeType,
      branchName: customerForm.branchName.trim(),
      branchCode,
      isHeadOffice: customerForm.officeType === 'head_office',
      billingCustomerId: customerForm.billingCustomerId,
      shippingCustomerId: customerForm.shippingCustomerId,
      status: customerForm.status || '未接触',
      tags,
      nextFollowUpDate: customerForm.nextFollowUpDate,
      nextFollowDate: customerForm.nextFollowUpDate,
      referralSource: customerForm.referralSource.trim(),
      prospectRank: customerForm.prospectRank.trim(),
      paymentTerms: customerForm.paymentTerms.trim(),
      closingDay: customerForm.closingDay.trim(),
      deliveryDestination: customerForm.deliveryDestination.trim(),
      billingDestination: customerForm.billingDestination.trim(),
      creditMemo: customerForm.creditMemo.trim(),
      memo: customerForm.memo.trim(),
      source: 'Manual',
      createdAt: now,
      updatedAt: now,
    });

    setIsSavingCustomer(false);

    if (!savedCustomer) {
      setFormError(syncError || '顧客データの保存に失敗しました。');
      return;
    }

    setSelectedPreviewId(customerId);
    setSearchQuery('');
    setStatusFilter(ALL);
    setRankFilter(ALL);
    setTagFilter(ALL);
    setAreaFilter(ALL);
    setComplaintFilter(ALL);
    setFollowFilter(ALL);
    setOfficeFilter(ALL);
    setSortMode('created');
    setTableSort({ key: '', direction: 'asc' });
    setVisibleCount((count) => Math.max(count, PAGE_SIZE));
    closeCreateModal();
  }

  return (
    <main className="page customers-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Customers</p>
          <h1>取引先一覧</h1>
          <p>PCでは比較・絞り込みしやすいテーブルで、スマホではカードで確認できます。</p>
        </div>
      </section>

      {syncError && syncState === 'error' && <p className="form-error-message">{syncError}</p>}

      <section className="search-panel compact-panel desktop-filter-panel">
        <label className="field-label filter-search">
          検索
          <input
            value={searchQuery}
            placeholder="会社名・担当者・タグ・メモで検索"
            onChange={resetPaging((event) => setSearchQuery(event.target.value))}
          />
        </label>
        <label className="field-label">
          ステータス
          <select value={statusFilter} onChange={resetPaging((event) => setStatusFilter(event.target.value))}>
            {[ALL, ...PIPELINE_STATUSES].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          重要度
          <select value={rankFilter} onChange={resetPaging((event) => setRankFilter(event.target.value))}>
            {[ALL, 'S', 'A', 'B', 'C', 'D'].map((rank) => (
              <option key={rank}>{rank}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          タグ
          <select value={tagFilter} onChange={resetPaging((event) => setTagFilter(event.target.value))}>
            {tagOptions.map((tag) => (
              <option key={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          地域
          <select value={areaFilter} onChange={resetPaging((event) => setAreaFilter(event.target.value))}>
            {areaOptions.map((area) => (
              <option key={area}>{area}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          クレーム
          <select value={complaintFilter} onChange={resetPaging((event) => setComplaintFilter(event.target.value))}>
            {[ALL, 'あり', 'なし'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          フォロー
          <select value={followFilter} onChange={resetPaging((event) => setFollowFilter(event.target.value))}>
            {[ALL, '期限切れ', '予定あり'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          拠点区分
          <select value={officeFilter} onChange={resetPaging((event) => setOfficeFilter(event.target.value))}>
            <option value={ALL}>{ALL}</option>
            <option value="head_office">本社のみ</option>
            <option value="branch_only">支社・支店のみ</option>
            {OFFICE_TYPE_OPTIONS.filter((option) => option.value !== 'head_office').map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="field-label">
          並び替え
          <select value={sortMode} onChange={resetPaging((event) => {
            setSortMode(event.target.value);
            setTableSort({ key: '', direction: 'asc' });
          })}>
            <option value="created">追加順</option>
            <option value="score">高スコア順</option>
            <option value="follow">次回フォロー日順</option>
          </select>
        </label>
      </section>

      <section className="result-stack customers-list-section">
        <div className="section-heading">
          <h2>営業手帳</h2>
          <div className="section-heading-actions">
            <span>{filteredCustomers.length}件</span>
            <button type="button" className="primary-button compact-action-button" onClick={openCreateModal}>
              ＋ 新規取引先
            </button>
          </div>
        </div>

        {visibleCustomers.length > 0 ? (
          <>
            <DataTable
              actions={(customer) => (
                <div
                  className={`customer-action-menu ${openActionMenuId === customer.id ? 'is-open' : ''}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="customer-action-trigger"
                    aria-haspopup="menu"
                    aria-expanded={openActionMenuId === customer.id}
                    aria-label="顧客の操作メニュー"
                    onClick={() => setOpenActionMenuId((currentId) => (currentId === customer.id ? '' : customer.id))}
                  >
                    ︙
                  </button>
                  {openActionMenuId === customer.id && (
                    <div className="customer-action-menu-panel" role="menu">
                      <button type="button" role="menuitem" onClick={() => { setOpenActionMenuId(''); onOpenKarte(customer.id); }}>カルテ</button>
                      <button type="button" role="menuitem" onClick={() => { setOpenActionMenuId(''); onOpenDetail(customer.id); }}>編集</button>
                      <button type="button" role="menuitem" onClick={() => { setOpenActionMenuId(''); onOpenPipeline?.(); }}>案件</button>
                      {!customer.isDoNotContact && (
                        <button type="button" role="menuitem" onClick={() => { setOpenActionMenuId(''); onCreateMail?.(); }}>メール</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              actionWidth="72px"
              className="customers-common-table"
              columns={customerDesktopColumns}
              minWidth={1320}
              onRowClick={(customer) => setSelectedPreviewId(customer.id)}
              rowClassName={(customer) => (customer.isDoNotContact ? 'ng-row' : '')}
              rows={visibleCustomers}
              selectedRowId={selectedPreviewCustomer?.id}
              sortDirection={tableSort.direction}
              sortKey={tableSort.key}
              onSort={handleTableSort}
            />

            <div className="card-list-mobile">
              {visibleCustomers.map((customer) => (
                <CompanyCard
                  key={customer.id}
                  company={customer}
                  actionLabel="詳細"
                  onAction={() => onOpenDetail(customer.id)}
                  karteLabel="カルテ"
                  onKarte={() => onOpenKarte(customer.id)}
                  onStatusChange={(status) => updateCustomer(customer.id, { status })}
                  onMemoChange={(memo) => updateCustomer(customer.id, { memo })}
                  onRemove={() => removeCustomer(customer.id)}
                  onDiscoverContact={() => handleDiscoverContact(customer)}
                  contactLoading={loadingCustomerId === customer.id}
                  contactError={contactErrors[customer.id]}
                />
              ))}
            </div>

            {visibleCount < filteredCustomers.length && (
              <button
                className="ghost-button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                さらに表示
              </button>
            )}
          </>
        ) : (
          <div className="empty-state">
            <h3>該当する取引先がありません</h3>
            <p>検索条件を変えるか、会社追加から新しい取引先を登録してください。</p>
          </div>
        )}
      </section>

      {isCreateModalOpen && (
        <div className="customer-editor-backdrop" onMouseDown={closeCreateModal}>
          <div className="customer-editor-modal" role="dialog" aria-modal="true" aria-labelledby="customer-editor-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="customer-editor-header">
              <div>
                <p className="eyebrow">New Customer</p>
                <h2 id="customer-editor-title">新規取引先追加</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeCreateModal}>閉じる</button>
            </div>

            {formError && <p className="form-error-message">{formError}</p>}

            <form className="customer-editor-form" onSubmit={(event) => event.preventDefault()} onKeyDown={handleFormKeyDown}>
              <section className="customer-editor-section">
                <h3>基本情報</h3>
                <div className="customer-editor-grid">
                  <label className="field-label">
                    顧客コード
                    <input
                      value={customerForm.customerCode}
                      placeholder="例: CUST-001"
                      onChange={(event) => updateFormField('customerCode', event.target.value)}
                      onBlur={() => updateFormField('customerCode', normalizeBusinessCode(customerForm.customerCode))}
                    />
                  </label>
                  <label className="field-label">
                    会社名 <span className="required-mark">必須</span>
                    <input value={customerForm.companyName} onChange={(event) => updateFormField('companyName', event.target.value)} />
                  </label>
                  <label className="field-label">
                    会社名（カナ）
                    <input value={customerForm.companyKana} onChange={(event) => updateFormField('companyKana', event.target.value)} />
                  </label>
                  <label className="field-label">
                    業種
                    <input value={customerForm.industry} onChange={(event) => updateFormField('industry', event.target.value)} />
                  </label>
                  <label className="field-label">
                    地域
                    <input value={customerForm.area} onChange={(event) => updateFormField('area', event.target.value)} />
                  </label>
                  <label className="field-label customer-editor-wide">
                    住所
                    <input value={customerForm.address} onChange={(event) => updateFormField('address', event.target.value)} />
                  </label>
                  <label className="field-label">
                    郵便番号
                    <input value={customerForm.postalCode} onChange={(event) => updateFormField('postalCode', event.target.value)} />
                  </label>
                  <label className="field-label">
                    代表電話
                    <input value={customerForm.phone} onChange={(event) => updateFormField('phone', event.target.value)} />
                  </label>
                  <label className="field-label">
                    FAX
                    <input value={customerForm.fax} onChange={(event) => updateFormField('fax', event.target.value)} />
                  </label>
                  <label className="field-label">
                    代表メール
                    <input type="email" value={customerForm.email} onChange={(event) => updateFormField('email', event.target.value)} />
                  </label>
                  <label className="field-label">
                    ホームページ
                    <input value={customerForm.website} onChange={(event) => updateFormField('website', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="customer-editor-section">
                <h3>企業グループ・拠点</h3>
                <div className="customer-editor-grid">
                  <label className="field-label">
                    法人番号
                    <input value={customerForm.corporateNumber} onChange={(event) => updateFormField('corporateNumber', event.target.value.trim())} />
                  </label>
                  <label className="field-label">
                    拠点区分
                    <select value={customerForm.officeType} onChange={(event) => updateFormField('officeType', event.target.value)}>
                      {OFFICE_TYPE_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    本社／親会社
                    <select
                      value={customerForm.parentCustomerId}
                      disabled={customerForm.officeType === 'head_office'}
                      onChange={(event) => updateFormField('parentCustomerId', event.target.value)}
                    >
                      <option value="">未設定</option>
                      {headOfficeOptions.map((customer) => (
                        <option value={customer.id} key={customer.id}>{displayCustomerOfficeName(customer)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    支社名／支店名
                    <input value={customerForm.branchName} onChange={(event) => updateFormField('branchName', event.target.value)} />
                  </label>
                  <label className="field-label">
                    拠点コード
                    <input value={customerForm.branchCode} onChange={(event) => updateFormField('branchCode', event.target.value.trim())} />
                  </label>
                  <label className="field-label">
                    請求先
                    <select value={customerForm.billingCustomerId} onChange={(event) => updateFormField('billingCustomerId', event.target.value)}>
                      <option value="">取引先拠点と同じ</option>
                      {customerOptions.map((customer) => (
                        <option value={customer.id} key={customer.id}>{displayCustomerOfficeName(customer)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    標準納品先
                    <select value={customerForm.shippingCustomerId} onChange={(event) => updateFormField('shippingCustomerId', event.target.value)}>
                      <option value="">取引先拠点と同じ</option>
                      {customerOptions.map((customer) => (
                        <option value={customer.id} key={customer.id}>{displayCustomerOfficeName(customer)}</option>
                      ))}
                    </select>
                  </label>
                  <div className="customer-editor-wide inline-helper">
                    本社・支社は別々の取引先として保存します。商談や帳票は実際の取引拠点に紐づきます。
                  </div>
                  {customerForm.parentCustomerId && (
                    <button type="button" className="ghost-button compact-action-button" onClick={copyParentCompanyInfo}>
                      本社の会社情報をコピー
                    </button>
                  )}
                </div>
                {duplicateCandidates.length > 0 && (
                  <div className="duplicate-candidates">
                    <p className="inline-helper">既存の本社・支社候補があります。自動統合はしません。</p>
                    {duplicateCandidates.map((candidate) => (
                      <button
                        type="button"
                        className="ghost-button compact-action-button"
                        key={candidate.id}
                        onClick={() => updateFormField('parentCustomerId', candidate.parentCustomerId || candidate.id)}
                      >
                        {displayCustomerOfficeName(candidate)}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="customer-editor-section">
                <h3>営業情報</h3>
                <div className="customer-editor-grid">
                  <label className="field-label">
                    担当営業
                    <input value={customerForm.salesOwner} onChange={(event) => updateFormField('salesOwner', event.target.value)} />
                  </label>
                  <label className="field-label">
                    重要度
                    <select value={customerForm.customerRank} onChange={(event) => updateFormField('customerRank', event.target.value)}>
                      {['A', 'B', 'C', 'D'].map((rank) => <option key={rank}>{rank}</option>)}
                    </select>
                  </label>
                  <label className="field-label">
                    ステータス
                    <select value={customerForm.status} onChange={(event) => updateFormField('status', event.target.value)}>
                      {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <label className="field-label">
                    フォロー日
                    <input type="date" value={customerForm.nextFollowUpDate} onChange={(event) => updateFormField('nextFollowUpDate', event.target.value)} />
                  </label>
                  <label className="field-label customer-editor-wide">
                    タグ（カンマ区切り）
                    <input value={customerForm.tagsText} placeholder="例: 高級, 冷凍, 重点" onChange={(event) => updateFormField('tagsText', event.target.value)} />
                  </label>
                  <label className="field-label">
                    紹介元
                    <input value={customerForm.referralSource} onChange={(event) => updateFormField('referralSource', event.target.value)} />
                  </label>
                  <label className="field-label">
                    見込みランク
                    <input value={customerForm.prospectRank} onChange={(event) => updateFormField('prospectRank', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="customer-editor-section">
                <h3>取引情報</h3>
                <div className="customer-editor-grid">
                  <label className="field-label">
                    支払条件
                    <input value={customerForm.paymentTerms} onChange={(event) => updateFormField('paymentTerms', event.target.value)} />
                  </label>
                  <label className="field-label">
                    締日
                    <input value={customerForm.closingDay} onChange={(event) => updateFormField('closingDay', event.target.value)} />
                  </label>
                  <label className="field-label">
                    納品先
                    <input value={customerForm.deliveryDestination} onChange={(event) => updateFormField('deliveryDestination', event.target.value)} />
                  </label>
                  <label className="field-label">
                    請求先
                    <input value={customerForm.billingDestination} onChange={(event) => updateFormField('billingDestination', event.target.value)} />
                  </label>
                  <label className="field-label customer-editor-wide">
                    与信メモ
                    <textarea value={customerForm.creditMemo} onChange={(event) => updateFormField('creditMemo', event.target.value)} />
                  </label>
                </div>
              </section>

              <section className="customer-editor-section">
                <h3>メモ</h3>
                <label className="field-label">
                  自由記述
                  <textarea value={customerForm.memo} onChange={(event) => updateFormField('memo', event.target.value)} />
                </label>
              </section>

              <div className="customer-editor-actions">
                <button type="button" className="ghost-button" onClick={closeCreateModal}>キャンセル</button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCreateCustomer}
                  disabled={isSavingCustomer}
                >
                  {isSavingCustomer ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
