import { useMemo, useState } from 'react';

const emptyForm = {
  customerId: '',
  companyName: '',
  name: '',
  department: '',
  role: '',
  companySize: '',
  email: '',
  phone: '',
  memo: '',
  tags: '',
};

function includesText(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

export default function Contacts({ contacts, customers, addContact, updateContact, removeContact }) {
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState(emptyForm);

  const filteredContacts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [
        contact.companyName,
        contact.name,
        contact.department,
        contact.role,
        contact.email,
        contact.phone,
        contact.memo,
        ...(contact.tags ?? []),
      ].some((value) => includesText(value, normalizedKeyword));
    });
  }, [contacts, keyword]);

  function updateField(field, value) {
    const selectedCustomer = field === 'customerId'
      ? customers.find((customer) => customer.id === value)
      : null;
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(selectedCustomer
        ? { companyName: selectedCustomer.companyName, customerId: selectedCustomer.id }
        : {}),
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      return;
    }

    addContact({
      ...form,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
    setForm(emptyForm);
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Contacts</p>
        <h1>担当者</h1>
        <p>担当者別メモ、役職、会社規模から重要度スコアを自動計算します。</p>
      </section>

      <section className="search-panel">
        <label className="field-label">
          検索
          <input value={keyword} placeholder="会社名、氏名、役職、メモで検索" onChange={(event) => setKeyword(event.target.value)} />
        </label>
      </section>

      <section className="detail-section">
        <h2>担当者を追加</h2>
        <form className="history-add-form" onSubmit={handleSubmit}>
          <label className="field-label">
            取引先
            <select value={form.customerId} onChange={(event) => updateField('customerId', event.target.value)}>
              <option value="">未紐づけ</option>
              {customers.map((customer) => (
                <option value={customer.id} key={customer.id}>{customer.companyName}</option>
              ))}
            </select>
          </label>
          <div className="date-grid">
            <label className="field-label">
              会社名
              <input value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
            </label>
            <label className="field-label">
              氏名
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
            </label>
          </div>
          <div className="date-grid">
            <label className="field-label">
              部署
              <input value={form.department} onChange={(event) => updateField('department', event.target.value)} />
            </label>
            <label className="field-label">
              役職
              <input value={form.role} placeholder="例: 代表取締役、購買部長" onChange={(event) => updateField('role', event.target.value)} />
            </label>
          </div>
          <label className="field-label">
            会社規模
            <input value={form.companySize} placeholder="例: 大手、従業員500名、中堅" onChange={(event) => updateField('companySize', event.target.value)} />
          </label>
          <div className="date-grid">
            <label className="field-label">
              メール
              <input value={form.email} onChange={(event) => updateField('email', event.target.value)} />
            </label>
            <label className="field-label">
              電話
              <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </label>
          </div>
          <label className="field-label">
            タグ
            <input value={form.tags} placeholder="例: 決裁者, 購買, キーマン" onChange={(event) => updateField('tags', event.target.value)} />
          </label>
          <label className="field-label">
            担当者別メモ
            <textarea value={form.memo} onChange={(event) => updateField('memo', event.target.value)} />
          </label>
          <button className="primary-button" type="submit">追加</button>
        </form>
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>担当者一覧</h2>
          <span>{filteredContacts.length}件</span>
        </div>
        <div className="card-grid two-column-grid">
          {filteredContacts.map((contact) => (
            <article className="company-card" key={contact.id}>
              <div className="company-heading">
                <h3>{contact.name}</h3>
                <p>{contact.companyName || '会社未設定'} / {contact.role || '役職未設定'}</p>
              </div>
              <div className="score-panel">
                <div>
                  <span>重要度</span>
                  <strong>{contact.importanceScore}</strong>
                </div>
                <div>
                  <span>ランク</span>
                  <strong>{contact.importanceRank}</strong>
                </div>
              </div>
              <p className="inline-helper">{contact.memo || 'メモなし'}</p>
              <div className="lead-badges">
                {(contact.tags ?? []).map((tag) => <span className="info-badge ready" key={tag}>{tag}</span>)}
              </div>
              <div className="card-actions">
                <button className="ghost-button" onClick={() => updateContact(contact.id, { memo: `${contact.memo}\n${new Date().toLocaleDateString('ja-JP')} メモ追記:` })}>メモ追記</button>
                <button className="ghost-button danger" onClick={() => removeContact(contact.id)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
