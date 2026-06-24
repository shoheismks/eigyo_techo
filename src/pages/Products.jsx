import { useState } from 'react';

const emptyProduct = {
  name: '',
  category: '',
  description: '',
  cost: '',
  sellingPrice: '',
  grossMarginRate: '',
  memo: '',
};

export default function Products({ products, addProduct, updateProduct, removeProduct }) {
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState('');

  const editingProduct = products.find((product) => product.id === editingId);

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    if (editingId) {
      updateProduct(editingId, form);
    } else {
      addProduct(form);
    }

    setForm(emptyProduct);
    setEditingId('');
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category,
      description: product.description,
      cost: product.cost,
      sellingPrice: product.sellingPrice,
      grossMarginRate: product.grossMarginRate,
      memo: product.memo,
    });
  }

  function cancelEdit() {
    setEditingId('');
    setForm(emptyProduct);
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Products</p>
        <h1>商品マスター</h1>
        <p>提案に使う商品、価格、粗利、メモを登録します。</p>
      </section>

      <form className="search-panel" onSubmit={handleSubmit}>
        <div className="section-heading">
          <h2>{editingProduct ? '商品編集' : '商品追加'}</h2>
          {editingProduct && <button type="button" className="text-button" onClick={cancelEdit}>取消</button>}
        </div>
        <label className="field-label">
          商品名
          <input
            value={form.name}
            placeholder="例: 和牛ベーコン"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="field-label">
          カテゴリ
          <input
            value={form.category}
            placeholder="例: 食肉加工品"
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          />
        </label>
        <label className="field-label">
          説明
          <textarea
            value={form.description}
            placeholder="商品の特徴、用途、提案先など"
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </label>
        <div className="date-grid">
          <label className="field-label">
            原価
            <input
              value={form.cost}
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, cost: event.target.value })}
            />
          </label>
          <label className="field-label">
            販売価格
            <input
              value={form.sellingPrice}
              inputMode="decimal"
              onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
            />
          </label>
        </div>
        <label className="field-label">
          粗利率
          <input
            value={form.grossMarginRate}
            placeholder="例: 35%"
            onChange={(event) => setForm({ ...form, grossMarginRate: event.target.value })}
          />
        </label>
        <label className="field-label">
          メモ
          <textarea
            value={form.memo}
            placeholder="サンプル可否、ロット、注意点など"
            onChange={(event) => setForm({ ...form, memo: event.target.value })}
          />
        </label>
        <button className="primary-button" type="submit">
          {editingProduct ? '更新' : '追加'}
        </button>
      </form>

      <section className="result-stack">
        <div className="section-heading">
          <h2>商品一覧</h2>
          <span>{products.length}件</span>
        </div>
        {products.length > 0 ? (
          products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="company-heading">
                <h3>{product.name}</h3>
                <p>{product.category || 'カテゴリ未設定'}</p>
              </div>
              <dl className="company-details">
                <div>
                  <dt>説明</dt>
                  <dd>{product.description || '未入力'}</dd>
                </div>
                <div>
                  <dt>原価</dt>
                  <dd>{product.cost || '未入力'}</dd>
                </div>
                <div>
                  <dt>価格</dt>
                  <dd>{product.sellingPrice || '未入力'}</dd>
                </div>
                <div>
                  <dt>粗利</dt>
                  <dd>{product.grossMarginRate || '未入力'}</dd>
                </div>
              </dl>
              {product.memo && <p className="inline-helper">{product.memo}</p>}
              <div className="card-actions">
                <button className="ghost-button" onClick={() => startEdit(product)}>編集</button>
                <button className="ghost-button danger" onClick={() => removeProduct(product.id)}>削除</button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <h3>商品が未登録です</h3>
            <p>営業メールや提案商品に使う商品を追加してください。</p>
          </div>
        )}
      </section>
    </main>
  );
}
