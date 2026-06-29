import { useMemo, useState } from 'react';
import CompanyCard from '../components/CompanyCard.jsx';
import { discoverContactInfo } from '../services/contactDiscoveryService.js';
import { PIPELINE_STATUSES } from './Pipeline.jsx';

const ALL = 'すべて';
const PAGE_SIZE = 40;

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
  contacts = [],
  updateCustomer,
  removeCustomer,
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
  const [loadingCustomerId, setLoadingCustomerId] = useState('');
  const [contactErrors, setContactErrors] = useState({});

  const tagOptions = useMemo(
    () => [
      ALL,
      ...new Set(customers.flatMap((customer) => customer.tags ?? []).filter(Boolean)),
    ],
    [customers],
  );

  const areaOptions = useMemo(
    () => [ALL, ...new Set(customers.map((customer) => customer.area).filter(Boolean))],
    [customers],
  );

  const contactsByCustomer = useMemo(() => {
    return contacts.reduce((summary, contact) => {
      if (!contact.customerId) return summary;
      summary[contact.customerId] = summary[contact.customerId] || [];
      summary[contact.customerId].push(contact);
      return summary;
    }, {});
  }, [contacts]);

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
      const contactNames = (contactsByCustomer[customer.id] ?? []).map((contact) => contact.name).join(' ');
      const searchableText = [
        customer.companyName,
        customer.industry,
        customer.area,
        customer.address,
        customer.email,
        customer.memo,
        customer.companyNote,
        contactNames,
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
    contactsByCustomer,
    customers,
    followFilter,
    rankFilter,
    searchQuery,
    sortMode,
    statusFilter,
    tagFilter,
  ]);

  const visibleCustomers = filteredCustomers.slice(0, visibleCount);

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

  return (
    <main className="page customers-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Customers</p>
          <h1>取引先一覧</h1>
          <p>PCでは比較・絞り込みしやすいテーブルで、スマホでは従来通りカードで確認できます。</p>
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

      <section className="result-stack">
        <div className="section-heading">
          <h2>営業手帳</h2>
          <span>{filteredCustomers.length}件</span>
        </div>

        {visibleCustomers.length > 0 ? (
          <>
            <div className="desktop-table customers-table">
              <div className="desktop-table-head">
                <span>会社名</span>
                <span>業種</span>
                <span>地域</span>
                <span>重要度</span>
                <span>ステータス</span>
                <span>担当者</span>
                <span>次回フォロー</span>
                <span>最終接触</span>
                <span>クレーム</span>
                <span>タグ</span>
                <span>操作</span>
              </div>

              {visibleCustomers.map((customer) => {
                const customerContacts = contactsByCustomer[customer.id] ?? [];
                return (
                  <div className={`desktop-table-row ${customer.isDoNotContact ? 'ng-row' : ''}`} key={customer.id}>
                    <strong>{customer.companyName}</strong>
                    <span>{customer.industry || '-'}</span>
                    <span>{customer.area || '-'}</span>
                    <span>
                      <b>{customer.customerRank || customer.rank || 'D'}</b>
                      <small>{customer.score ?? 0}</small>
                    </span>
                    <span>{customer.status || '-'}</span>
                    <span>{customerContacts.map((contact) => contact.name).filter(Boolean).slice(0, 2).join(', ') || '-'}</span>
                    <span className={isOverdue(customer) ? 'danger' : ''}>{followDate(customer) || '-'}</span>
                    <span>{customer.lastContactDate || '-'}</span>
                    <span>{hasComplaint(customer) ? 'あり' : 'なし'}</span>
                    <span>{(customer.tags ?? []).slice(0, 3).join(', ') || '-'}</span>
                    <span className="table-actions">
                      <button type="button" className="ghost-button" onClick={() => onOpenKarte(customer.id)}>カルテ</button>
                      <button type="button" className="ghost-button" onClick={() => onOpenDetail(customer.id)}>編集</button>
                      <button type="button" className="ghost-button" onClick={onOpenPipeline}>商談</button>
                      {!customer.isDoNotContact && (
                        <button type="button" className="ghost-button" onClick={onCreateMail}>メール</button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

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
    </main>
  );
}
