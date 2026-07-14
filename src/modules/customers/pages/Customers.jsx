import { useEffect, useMemo, useState } from 'react';
import CompanyCard from '../../../shared/components/CompanyCard.jsx';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { discoverContactInfo } from '../services/contactDiscoveryService.js';
import { PIPELINE_STATUSES } from '../../deals/constants.js';

const ALL = 'すべて';
const PAGE_SIZE = 40;

const INITIAL_CUSTOMER_FORM = {
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
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [rankFilter, setRankFilter] = useState(ALL);
  const [tagFilter, setTagFilter] = useState(ALL);
  const [areaFilter, setAreaFilter] = useState(ALL);
  const [complaintFilter, setComplaintFilter] = useState(ALL);
  const [followFilter, setFollowFilter] = useState(ALL);
  const [sortMode, setSortMode] = useState('created');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedPreviewId, setSelectedPreviewId] = useState('');
  const [loadingCustomerId, setLoadingCustomerId] = useState('');
  const [contactErrors, setContactErrors] = useState({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState(INITIAL_CUSTOMER_FORM);
  const [formError, setFormError] = useState('');

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

  const tagOptions = useMemo(
    () => [ALL, ...new Set(customers.flatMap((customer) => customer.tags ?? []).filter(Boolean))],
    [customers],
  );

  const areaOptions = useMemo(
    () => [ALL, ...new Set(customers.map((customer) => customer.area).filter(Boolean))],
    [customers],
  );

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
      const searchableText = [
        customer.companyName,
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
        matchesSearch
      );
    });

    if (sortMode === 'score') {
      return [...nextCustomers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    if (sortMode === 'follow') {
      return [...nextCustomers].sort((a, b) =>
        (followDate(a) || '9999-12-31').localeCompare(followDate(b) || '9999-12-31'),
      );
    }

    return nextCustomers;
  }, [
    areaFilter,
    complaintFilter,
    customers,
    followFilter,
    rankFilter,
    searchQuery,
    sortMode,
    statusFilter,
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
        key: 'companyName',
        label: '会社名',
        width: '18%',
        render: (customer) => <strong>{customer.companyName}</strong>,
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
    [],
  );

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
    setCustomerForm((current) => ({ ...current, [field]: value }));
  }

  function handleFormKeyDown(event) {
    if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
      event.preventDefault();
    }
  }

  function handleCreateCustomer() {
    const companyName = customerForm.companyName.trim();

    if (!companyName) {
      setFormError('会社名は必須です。');
      return;
    }

    const now = new Date().toISOString();
    const customerId = crypto.randomUUID();
    const tags = parseTags(customerForm.tagsText);

    addCustomer({
      id: customerId,
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

    setSelectedPreviewId(customerId);
    setSearchQuery('');
    setStatusFilter(ALL);
    setRankFilter(ALL);
    setTagFilter(ALL);
    setAreaFilter(ALL);
    setComplaintFilter(ALL);
    setFollowFilter(ALL);
    setSortMode('created');
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
          並び替え
          <select value={sortMode} onChange={resetPaging((event) => setSortMode(event.target.value))}>
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
            <DesktopTable
              actions={(customer) => (
                <>
                  <button type="button" className="ghost-button" onClick={() => onOpenKarte(customer.id)}>カルテ</button>
                  <button type="button" className="ghost-button" onClick={() => onOpenDetail(customer.id)}>編集</button>
                  <button type="button" className="ghost-button" onClick={onOpenPipeline}>案件</button>
                  {!customer.isDoNotContact && (
                    <button type="button" className="ghost-button" onClick={onCreateMail}>メール</button>
                  )}
                </>
              )}
              className="customers-common-table"
              columns={desktopColumns}
              minWidth={1120}
              onRowClick={(customer) => setSelectedPreviewId(customer.id)}
              rowClassName={(customer) => (customer.isDoNotContact ? 'ng-row' : '')}
              rows={visibleCustomers}
              selectedRowId={selectedPreviewCustomer?.id}
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
                <button type="button" className="primary-button" onClick={handleCreateCustomer}>保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
