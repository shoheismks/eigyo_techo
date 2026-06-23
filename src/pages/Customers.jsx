import { useMemo, useState } from 'react';
import CompanyCard from '../components/CompanyCard.jsx';
import { discoverContactInfo } from '../services/contactDiscoveryService.js';

const STATUS_FILTERS = [
  'すべて',
  '未接触',
  '送信済',
  '返信あり',
  '商談中',
  '見積提出',
  '成約',
  '失注',
];

export default function Customers({ customers, updateCustomer, removeCustomer }) {
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [sortMode, setSortMode] = useState('created');
  const [loadingCustomerId, setLoadingCustomerId] = useState('');
  const [contactErrors, setContactErrors] = useState({});

  const filteredCustomers = useMemo(() => {
    const nextCustomers = customers.filter(
      (customer) => statusFilter === 'すべて' || customer.status === statusFilter,
    );

    if (sortMode === 'score') {
      return [...nextCustomers].sort((a, b) => b.score - a.score);
    }

    return nextCustomers;
  }, [customers, statusFilter, sortMode]);

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

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Customers</p>
        <h1>得意先一覧</h1>
        <p>保存した営業先のステータス、メモ、連絡先、優先スコアを管理します。</p>
      </section>

      <div className="segmented-control" aria-label="ステータスで絞り込み">
        {STATUS_FILTERS.map((status) => (
          <button
            className={statusFilter === status ? 'selected' : ''}
            key={status}
            onClick={() => setStatusFilter(status)}
          >
            {status}
          </button>
        ))}
      </div>

      <section className="search-panel compact-panel">
        <label className="field-label">
          並び替え
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="created">追加順</option>
            <option value="score">高スコア順</option>
          </select>
        </label>
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>営業手帳</h2>
          <span>{filteredCustomers.length}件</span>
        </div>
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <CompanyCard
              key={customer.id}
              company={customer}
              onStatusChange={(status) => updateCustomer(customer.id, { status })}
              onMemoChange={(memo) => updateCustomer(customer.id, { memo })}
              onRemove={() => removeCustomer(customer.id)}
              onDiscoverContact={() => handleDiscoverContact(customer)}
              contactLoading={loadingCustomerId === customer.id}
              contactError={contactErrors[customer.id]}
            />
          ))
        ) : (
          <div className="empty-state">
            <h3>該当する得意先がありません</h3>
            <p>営業先検索から候補を追加するか、絞り込みを変更してください。</p>
          </div>
        )}
      </section>
    </main>
  );
}
