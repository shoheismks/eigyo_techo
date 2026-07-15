import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { uploadAttachment } from '../../../shared/services/storageService.js';
import {
  businessCodeDuplicateMessage,
  businessCodeFormatMessage,
  hasDuplicateBusinessCode,
  isValidBusinessCode,
  normalizeBusinessCode,
} from '../../../shared/utils/businessCode.js';
import ProjectPanel from '../../deals/components/ProjectPanel.jsx';

const emptySupplier = {
  supplierCode: '',
  name: '',
  area: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  tags: '',
  memo: '',
};

const emptyHistory = {
  date: '',
  summary: '',
  createdByName: '',
  quoteFile: null,
};

function includesText(value, keyword) {
  return String(value ?? '').toLowerCase().includes(keyword);
}

export default function Suppliers({
  suppliers,
  projects = [],
  customers = [],
  contacts = [],
  products = [],
  inventories = [],
  quotes = [],
  samples = [],
  complaints = [],
  events = [],
  attachments = [],
  addSupplier,
  updateSupplier,
  removeSupplier,
  addProject,
  updateProject,
  removeProject,
  setActivePage,
  onOpenKarte,
  onCreateQuote,
  userId,
}) {
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState(emptySupplier);
  const [historySupplierId, setHistorySupplierId] = useState('');
  const [historyForm, setHistoryForm] = useState(emptyHistory);
  const [uploadError, setUploadError] = useState('');
  const [formError, setFormError] = useState('');

  const filteredSuppliers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (!normalizedKeyword) {
        return true;
      }

      return [
        supplier.supplierCode,
        supplier.name,
        supplier.area,
        supplier.address,
        supplier.email,
        supplier.memo,
        ...(supplier.tags ?? []),
      ].some((value) => includesText(value, normalizedKeyword));
    });
  }, [keyword, suppliers]);

  const desktopColumns = useMemo(
    () => [
      { key: 'supplierCode', label: '仕入先コード', minWidth: '150px', render: (supplier) => supplier.supplierCode || '-' },
      { key: 'name', label: '仕入先名', minWidth: '240px', width: '18%', render: (supplier) => <strong>{supplier.name}</strong> },
      { key: 'supplierType', label: '種別', minWidth: '100px', width: '100px', render: (supplier) => supplier.supplierType || '-' },
      { key: 'area', label: '国/地域', minWidth: '110px', width: '110px', render: (supplier) => supplier.country || supplier.area || '-' },
      { key: 'contactPerson', label: '担当者', minWidth: '160px', width: '12%', render: (supplier) => supplier.contactPerson || supplier.createdByName || '-' },
      { key: 'email', label: 'メール', minWidth: '220px', width: '16%', render: (supplier) => supplier.email || '-' },
      { key: 'phone', label: '電話', minWidth: '130px', width: '130px', render: (supplier) => supplier.phone || '-' },
      {
        key: 'products',
        label: '取扱商品',
        minWidth: '240px',
        width: '16%',
        render: (supplier) => {
          if (Array.isArray(supplier.products) && supplier.products.length > 0) return supplier.products.join(', ');
          return (supplier.tags ?? []).join(', ') || '-';
        },
      },
      { key: 'temperatureZone', label: '温度帯', minWidth: '100px', width: '100px', render: (supplier) => supplier.temperatureZone || '-' },
      {
        key: 'histories',
        label: '商談',
        minWidth: '90px',
        render: (supplier) => `${(supplier.dealHistories ?? []).length}件`,
      },
    ],
    [],
  );

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const supplierCode = normalizeBusinessCode(form.supplierCode);
    if (!isValidBusinessCode(supplierCode)) {
      setFormError(businessCodeFormatMessage('仕入先コード'));
      return;
    }

    if (hasDuplicateBusinessCode(suppliers, 'supplierCode', supplierCode)) {
      setFormError(businessCodeDuplicateMessage('仕入先コード'));
      return;
    }

    if (!form.name.trim()) {
      return;
    }

    setFormError('');
    addSupplier({
      ...form,
      supplierCode,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    });
    setForm(emptySupplier);
  }

  async function addSupplierHistory(event) {
    event.preventDefault();
    const supplier = suppliers.find((item) => item.id === historySupplierId);
    if (!supplier || !historyForm.summary.trim()) {
      return;
    }

    setUploadError('');
    let quoteFile = null;
    try {
      if (historyForm.quoteFile) {
        quoteFile = await uploadAttachment({
          file: historyForm.quoteFile,
          userId,
          ownerType: 'supplier-deal',
          ownerId: supplier.id,
          field: 'quoteFile',
        });
      }
    } catch (error) {
      setUploadError(error.message || '見積ファイルのアップロードに失敗しました。');
      return;
    }

    updateSupplier(supplier.id, {
      dealHistories: [
        {
          id: crypto.randomUUID(),
          date: historyForm.date || new Date().toISOString().slice(0, 10),
          summary: historyForm.summary,
          createdAt: new Date().toISOString(),
          createdBy: userId,
          createdByName: historyForm.createdByName,
          quoteFile,
        },
        ...(supplier.dealHistories ?? []),
      ],
    });
    setHistoryForm(emptyHistory);
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Suppliers</p>
        <h1>仕入先</h1>
        <p>仕入先情報、商談メモ、相手からの見積ファイルをSupabaseで管理します。</p>
      </section>

      <section className="search-panel">
        <label className="field-label">
          検索
          <input value={keyword} placeholder="仕入先名、エリア、タグ、メモで検索" onChange={(event) => setKeyword(event.target.value)} />
        </label>
      </section>

      <section className="detail-section">
        <h2>仕入先を追加</h2>
        {formError && <p className="form-error-message">{formError}</p>}
        <form className="history-add-form" onSubmit={handleSubmit}>
          <label className="field-label">
            仕入先コード
            <input
              value={form.supplierCode}
              placeholder="例: SUP-001"
              onChange={(event) => updateField('supplierCode', event.target.value)}
              onBlur={() => updateField('supplierCode', normalizeBusinessCode(form.supplierCode))}
            />
          </label>
          <label className="field-label">仕入先名<input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label>
          <div className="date-grid">
            <label className="field-label">エリア<input value={form.area} onChange={(event) => updateField('area', event.target.value)} /></label>
            <label className="field-label">電話<input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} /></label>
          </div>
          <label className="field-label">住所<input value={form.address} onChange={(event) => updateField('address', event.target.value)} /></label>
          <div className="date-grid">
            <label className="field-label">メール<input value={form.email} onChange={(event) => updateField('email', event.target.value)} /></label>
            <label className="field-label">Web<input value={form.website} onChange={(event) => updateField('website', event.target.value)} /></label>
          </div>
          <label className="field-label">タグ<input value={form.tags} placeholder="例: 輸入, チーズ, 冷凍" onChange={(event) => updateField('tags', event.target.value)} /></label>
          <label className="field-label">メモ<textarea value={form.memo} onChange={(event) => updateField('memo', event.target.value)} /></label>
          <button className="primary-button" type="submit">追加</button>
        </form>
      </section>

      <section className="detail-section">
        <h2>仕入先商談メモ</h2>
        <form className="history-add-form" onSubmit={addSupplierHistory}>
          <label className="field-label">
            仕入先
            <select value={historySupplierId} onChange={(event) => setHistorySupplierId(event.target.value)}>
              <option value="">選択してください</option>
              {suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="field-label">日付<input type="date" value={historyForm.date} onChange={(event) => setHistoryForm({ ...historyForm, date: event.target.value })} /></label>
          <label className="field-label">メモ<textarea value={historyForm.summary} onChange={(event) => setHistoryForm({ ...historyForm, summary: event.target.value })} /></label>
          <label className="field-label">記載者<input value={historyForm.createdByName} onChange={(event) => setHistoryForm({ ...historyForm, createdByName: event.target.value })} /></label>
          <label className="field-label file-field">見積ファイル<input type="file" onChange={(event) => setHistoryForm({ ...historyForm, quoteFile: event.target.files?.[0] ?? null })} /></label>
          {uploadError && <p className="error-text">{uploadError}</p>}
          <button className="primary-button" type="submit">商談メモを追加</button>
        </form>
      </section>

      <ProjectPanel
        title="仕入先案件"
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
        setActivePage={setActivePage}
        onOpenKarte={onOpenKarte}
        onCreateQuote={onCreateQuote}
      />

      <section className="result-stack suppliers-list-section">
        <div className="section-heading">
          <h2>仕入先一覧</h2>
          <span>{filteredSuppliers.length}件</span>
        </div>
        <DesktopTable
          actions={(supplier) => (
            <button className="ghost-button danger" onClick={() => removeSupplier(supplier.id)}>削除</button>
          )}
          className="suppliers-common-table"
          columns={desktopColumns}
          actionWidth={110}
          minWidth={1460}
          rows={filteredSuppliers}
        />
        <div className="card-grid two-column-grid desktop-card-fallback">
          {filteredSuppliers.map((supplier) => (
            <article className="company-card" key={supplier.id}>
              <div className="company-heading">
                <h3>{supplier.name}</h3>
                <p>{supplier.area || 'エリア未設定'}</p>
              </div>
              <p className="inline-helper">{supplier.memo || 'メモなし'}</p>
              <div className="lead-badges">
                {(supplier.tags ?? []).map((tag) => <span className="info-badge ready" key={tag}>{tag}</span>)}
                <span className="info-badge">{(supplier.dealHistories ?? []).length} 商談</span>
              </div>
              <div className="card-actions">
                <button className="ghost-button danger" onClick={() => removeSupplier(supplier.id)}>削除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
