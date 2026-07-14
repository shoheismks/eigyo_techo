import { useMemo, useState } from 'react';
import DesktopTable from '../../../shared/components/DesktopTable.jsx';
import { PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_TYPES } from '../constants.js';
import { emptyProject } from '../hooks/useProjects.js';

function formatCurrency(value) {
  if (value === '' || value === null || value === undefined) return '-';
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString('ja-JP')}円` : String(value);
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
    title: '',
    customerId: defaultCustomerId,
    supplierId: defaultSupplierId,
    type: defaultSupplierId ? '仕入交渉' : '新規提案',
    status: 'リード',
    priority: '通常',
    startDate: new Date().toISOString().slice(0, 10),
  };
}

export default function ProjectPanel({
  title = '案件',
  projects = [],
  customers = [],
  suppliers = [],
  contacts = [],
  products = [],
  inventories = [],
  quotes = [],
  samples = [],
  complaints = [],
  addProject,
  updateProject,
  removeProject,
  defaultCustomerId = '',
  defaultSupplierId = '',
  setActivePage,
  onOpenKarte,
}) {
  const [keyword, setKeyword] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [form, setForm] = useState(() => makeInitialProject(defaultCustomerId, defaultSupplierId));
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');

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

  const columns = useMemo(
    () => [
      { key: 'title', label: '件名', minWidth: '220px', render: (project) => <strong>{project.title}</strong> },
      { key: 'owner', label: '会社', minWidth: '190px', render: (project) => customerMap.get(project.customerId)?.companyName || supplierMap.get(project.supplierId)?.name || '-' },
      { key: 'type', label: '種別', minWidth: '120px', render: (project) => project.type || '-' },
      { key: 'status', label: 'ステータス', minWidth: '120px', render: (project) => project.status || '-' },
      { key: 'priority', label: '優先度', minWidth: '90px', render: (project) => project.priority || '-' },
      { key: 'nextActionDate', label: '次回アクション', minWidth: '130px', render: (project) => project.nextActionDate || '-' },
      { key: 'profit', label: '見込利益', minWidth: '120px', render: (project) => formatCurrency(project.expectedOperatingProfit || project.expectedGrossProfit) },
    ],
    [customerMap, supplierMap],
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
    if (!form.title.trim()) {
      setError('件名は必須です。');
      return;
    }
    if (!form.customerId && !form.supplierId) {
      setError('取引先または仕入先のどちらかを選択してください。');
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
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
      title: `${project.title} コピー`,
      status: 'リード',
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  function finishProject(project) {
    updateProject(project.id, { status: '終了' });
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
            <button type="button" className="text-button" onClick={() => setFormOpen(false)}>閉じる</button>
          </div>
          {error && <p className="form-error-message">{error}</p>}
          <div className="project-form-grid">
            <label className="field-label project-editor-wide">件名 <span className="required-mark">必須</span><input value={form.title} onChange={(event) => updateForm('title', event.target.value)} /></label>
            <label className="field-label">取引先<select value={form.customerId} onChange={(event) => updateForm('customerId', event.target.value)}><option value="">未選択</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.companyName}</option>)}</select></label>
            <label className="field-label">仕入先<select value={form.supplierId} onChange={(event) => updateForm('supplierId', event.target.value)}><option value="">未選択</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
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
          <ProjectCheckboxes title="商品" items={products} selectedIds={form.productIds} getLabel={(item) => item.name} onToggle={(id) => toggleFormArray('productIds', id)} />
          <ProjectCheckboxes title="在庫" items={relatedInventories} selectedIds={form.inventoryIds} getLabel={(item) => item.inventoryName || item.lot || item.id} onToggle={(id) => toggleFormArray('inventoryIds', id)} />
          <ProjectCheckboxes title="見積" items={relatedQuotes} selectedIds={form.quoteIds} getLabel={(item) => item.quoteNumber || item.projectName || item.id} onToggle={(id) => toggleFormArray('quoteIds', id)} />
          <ProjectCheckboxes title="サンプル" items={relatedSamples} selectedIds={form.sampleIds} getLabel={(item) => item.sampleName || item.id} onToggle={(id) => toggleFormArray('sampleIds', id)} />
          <ProjectCheckboxes title="クレーム" items={relatedComplaints} selectedIds={form.complaintIds} getLabel={(item) => item.title || item.memo || item.id} onToggle={(id) => toggleFormArray('complaintIds', id)} />

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
            <button type="button" className="ghost-button" onClick={() => startEdit(project)}>編集</button>
            <button type="button" className="ghost-button" onClick={() => duplicateProject(project)}>複製</button>
            <button type="button" className="ghost-button" onClick={() => finishProject(project)}>終了</button>
            <button type="button" className="ghost-button danger" onClick={() => removeProject(project.id)}>削除</button>
          </>
        )}
        actionWidth="360px"
        className="projects-common-table"
        columns={columns}
        minWidth={1220}
        rows={scopedProjects}
        emptyMessage="案件がありません"
      />

      <div className="card-grid two-column-grid desktop-card-fallback">
        {scopedProjects.map((project) => (
          <article className="company-card" key={project.id}>
            <div className="company-heading">
              <h3>{project.title}</h3>
              <p>{customerMap.get(project.customerId)?.companyName || supplierMap.get(project.supplierId)?.name || '会社未設定'}</p>
            </div>
            <div className="lead-badges">
              <span className="info-badge ready">{project.status}</span>
              <span className="info-badge">{project.type}</span>
              <span className="info-badge">{project.priority}</span>
            </div>
            <p className="inline-helper">次回: {project.nextActionDate || '-'} / 見込利益: {formatCurrency(project.expectedOperatingProfit || project.expectedGrossProfit)}</p>
            <p>{project.memo || 'メモなし'}</p>
            <div className="card-actions">
              <button type="button" className="ghost-button" onClick={() => startEdit(project)}>編集</button>
              <button type="button" className="ghost-button" onClick={() => duplicateProject(project)}>複製</button>
              <button type="button" className="ghost-button" onClick={() => finishProject(project)}>終了</button>
            </div>
          </article>
        ))}
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
