import { useMemo, useState } from 'react';

const emptyForm = {
  customerId: '',
  customerName: '',
  title: '',
  status: '未対応',
  severity: '通常',
  memo: '',
  createdByName: '',
};

export default function Complaints({ complaints, customers, addComplaint, updateComplaint, removeComplaint, userId }) {
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState(emptyForm);

  const filteredComplaints = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return complaints.filter((complaint) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [complaint.customerName, complaint.title, complaint.status, complaint.severity, complaint.memo]
        .some((value) => String(value ?? '').toLowerCase().includes(normalizedKeyword));
    });
  }, [complaints, keyword]);

  function updateField(field, value) {
    const selectedCustomer = field === 'customerId'
      ? customers.find((customer) => customer.id === value)
      : null;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(selectedCustomer ? { customerName: selectedCustomer.companyName } : {}),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.title.trim()) {
      return;
    }

    addComplaint({
      ...form,
      createdBy: userId,
    });
    setForm(emptyForm);
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Complaints</p>
        <h1>クレーム履歴</h1>
        <p>クレームメモ、対応状況、記載者をユーザーごとに保存します。</p>
      </section>

      <section className="search-panel">
        <label className="field-label">
          検索
          <input value={keyword} placeholder="取引先、件名、メモで検索" onChange={(event) => setKeyword(event.target.value)} />
        </label>
      </section>

      <section className="detail-section">
        <h2>クレームを追加</h2>
        <form className="history-add-form" onSubmit={handleSubmit}>
          <label className="field-label">
            取引先
            <select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}>
              <option value="">未紐づけ</option>
              {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}
            </select>
          </label>
          <label className="field-label">件名<input value={form.title} onChange={(event) => updateField('title', event.target.value)} required /></label>
          <div className="date-grid">
            <label className="field-label">状況<select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option>未対応</option><option>対応中</option><option>完了</option></select></label>
            <label className="field-label">重要度<select value={form.severity} onChange={(event) => updateField('severity', event.target.value)}><option>通常</option><option>高</option><option>重大</option></select></label>
          </div>
          <label className="field-label">記載者<input value={form.createdByName} onChange={(event) => updateField('createdByName', event.target.value)} /></label>
          <label className="field-label">クレームメモ<textarea value={form.memo} onChange={(event) => updateField('memo', event.target.value)} /></label>
          <button className="primary-button" type="submit">追加</button>
        </form>
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>クレーム一覧</h2>
          <span>{filteredComplaints.length}件</span>
        </div>
        <div className="card-grid two-column-grid">
          {filteredComplaints.map((complaint) => (
            <article className="company-card" key={complaint.id}>
              <div className="card-topline">
                <span className={`status-pill ${complaint.severity === '重大' ? 'lost' : 'active'}`}>{complaint.severity}</span>
                <span className="area-chip">{complaint.status}</span>
              </div>
              <div className="company-heading">
                <h3>{complaint.title}</h3>
                <p>{complaint.customerName || '取引先未設定'}</p>
              </div>
              <p className="inline-helper">{complaint.memo || 'メモなし'}</p>
              <div className="card-actions">
                <button className="ghost-button" onClick={() => updateComplaint(complaint.id, { status: '完了' })}>完了</button>
                <button className="ghost-button danger" onClick={() => removeComplaint(complaint.id)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
