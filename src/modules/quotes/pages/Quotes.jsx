import { useMemo, useState } from 'react';
import ActionBar from '../../../shared/components/ActionBar.jsx';
import DataTable from '../../../shared/components/DataTable.jsx';
import KpiCards from '../../../shared/components/KpiCards.jsx';
import PageLayout from '../../../shared/components/PageLayout.jsx';
import { quoteValidUntilDisplay } from '../hooks/useQuotes.js';

const PAGE_SIZE = 40;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ja-JP');
}

function formatMoney(value) {
  const number = Number(value || 0);
  return number.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
}

function customerName(quote, customers) {
  const customer = customers.find((item) => item.id === quote.customerId);
  return customer?.companyName || quote.billingCustomerSnapshot?.companyName || quote.transactionCustomerSnapshot?.companyName || '-';
}

function contactNames(quote, contacts) {
  const ids = Array.isArray(quote.contactIds) ? quote.contactIds : [];
  return ids.map((id) => contacts.find((contact) => contact.id === id)?.name).filter(Boolean).join(', ') || '-';
}

function projectName(quote, projects) {
  return quote.projectName || projects.find((project) => project.id === quote.projectId)?.title || '-';
}

export default function Quotes({
  quotes = [],
  customers = [],
  contacts = [],
  projects = [],
  syncError = '',
  legacyLocalDataWarning = '',
  onCreateQuote,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const statuses = useMemo(() => [...new Set(quotes.map((quote) => quote.status).filter(Boolean))].sort(), [quotes]);
  const filteredQuotes = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (statusFilter !== 'all' && quote.status !== statusFilter) return false;
      if (!keyword) return true;
      return [
        quote.quoteNumber,
        quote.projectName,
        quote.status,
        customerName(quote, customers),
        contactNames(quote, contacts),
        projectName(quote, projects),
      ].some((value) => String(value ?? '').toLowerCase().includes(keyword));
    });
  }, [contacts, customers, projects, quotes, search, statusFilter]);

  const visibleQuotes = filteredQuotes.slice(0, visibleCount);
  const submittedCount = quotes.filter((quote) => String(quote.status || '').includes('提出')).length;
  const acceptedCount = quotes.filter((quote) => String(quote.status || '').includes('採用') || quote.acceptedAt).length;
  const totalAmount = filteredQuotes.reduce((sum, quote) => sum + Number(quote.grandTotal || quote.totalAmount || 0), 0);

  const columns = useMemo(() => [
    { key: 'quoteNumber', label: '見積番号', minWidth: '150px', sortable: true, render: (quote) => <strong>{quote.quoteNumber || '-'}</strong> },
    { key: 'customer', label: '顧客', minWidth: '220px', sortable: true, value: (quote) => customerName(quote, customers), render: (quote) => customerName(quote, customers) },
    { key: 'project', label: '案件', minWidth: '180px', sortable: true, value: (quote) => projectName(quote, projects), render: (quote) => projectName(quote, projects) },
    { key: 'contact', label: '担当者', minWidth: '140px', value: (quote) => contactNames(quote, contacts), render: (quote) => contactNames(quote, contacts) },
    { key: 'issueDate', label: '作成日', minWidth: '120px', sortable: true, value: (quote) => quote.issueDate || quote.createdAt, render: (quote) => formatDate(quote.issueDate || quote.createdAt) },
    { key: 'validUntil', label: '有効期限', minWidth: '140px', sortable: true, value: (quote) => quoteValidUntilDisplay(quote), render: (quote) => quoteValidUntilDisplay(quote) || '-' },
    { key: 'amount', label: '見積金額', minWidth: '140px', sortable: true, value: (quote) => Number(quote.grandTotal || quote.totalAmount || 0), render: (quote) => formatMoney(quote.grandTotal || quote.totalAmount || 0) },
    { key: 'grossMarginRate', label: '粗利率', minWidth: '100px', sortable: true, render: (quote) => quote.grossMarginRate || '-' },
    { key: 'status', label: 'ステータス', minWidth: '120px', sortable: true, render: (quote) => <span className="customer-status-badge">{quote.status || '-'}</span> },
  ], [contacts, customers, projects]);

  return (
    <PageLayout
      className="quotes-page"
      eyebrow="QUOTES"
      title="見積一覧"
      description="見積の検索、確認、CSV出力を共通テーブルで管理します。"
      kpis={<KpiCards cards={[
        { id: 'all', label: '見積件数', value: filteredQuotes.length, targetId: 'quotes-table' },
        { id: 'submitted', label: '提出済', value: submittedCount, targetId: 'quotes-table' },
        { id: 'accepted', label: '採用', value: acceptedCount, targetId: 'quotes-table' },
        { id: 'amount', label: '見積金額', value: formatMoney(totalAmount), targetId: 'quotes-table' },
      ]} />}
      actionBar={<ActionBar searchValue={search} onSearch={setSearch} searchPlaceholder="見積番号・顧客・案件で検索" newLabel="＋新規見積" onNew={() => onCreateQuote?.({})}>
        <label className="field-label compact-field-label">
          ステータス
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setVisibleCount(PAGE_SIZE); }}>
            <option value="all">すべて</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </ActionBar>}
    >
      {syncError && <div className="form-error-message">{syncError}</div>}
      <section className="result-stack" id="quotes-table">
        <div className="section-heading">
          <h2>見積一覧</h2>
          <span>{filteredQuotes.length}件</span>
        </div>
        <DataTable
          columns={columns}
          rows={visibleQuotes}
          className="quotes-common-table"
          minWidth={1250}
          csvFileName="quotes.csv"
          emptyMessage="見積がありません"
          paginate={false}
        />
        {visibleCount < filteredQuotes.length && (
          <button className="ghost-button" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>さらに表示</button>
        )}
      </section>
    </PageLayout>
  );
}
