import { useState } from 'react';
import { uploadAttachment } from '../shared/services/storageService.js';

function extractContactFromText(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = text.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/)?.[0] ?? '';
  return {
    companyName: lines[0] ?? '',
    name: lines[1] ?? '',
    role: lines[2] ?? '',
    email,
    phone,
  };
}

export default function BusinessCards({
  businessCards,
  addBusinessCard,
  contacts,
  addContact,
  userId,
}) {
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  async function runOcr() {
    if (!file) {
      setError('名刺画像を選択してください。');
      return;
    }

    setIsOcrRunning(true);
    setError('');
    setNotice('');

    try {
      const runtimeImport = new Function('specifier', 'return import(specifier)');
      const Tesseract = await runtimeImport('tesseract.js');
      const result = await Tesseract.recognize(file, 'jpn+eng');
      setRawText(result.data.text);
      setNotice('OCRが完了しました。内容を確認して保存してください。');
    } catch {
      setError('OCRライブラリが未導入です。今は下のテキスト欄に名刺情報を貼り付けてください。');
    } finally {
      setIsOcrRunning(false);
    }
  }

  async function saveCard() {
    if (!rawText.trim()) {
      setError('名刺テキストを入力してください。');
      return;
    }

    setError('');
    const extracted = extractContactFromText(rawText);
    let imageFile = null;

    try {
      if (file) {
        imageFile = await uploadAttachment({
          file,
          userId,
          ownerType: 'business-card',
          ownerId: crypto.randomUUID(),
          field: 'image',
        });
      }
    } catch (uploadError) {
      setError(uploadError.message || '名刺画像のアップロードに失敗しました。');
      return;
    }

    const contactId = addContact({
      ...extracted,
      memo: rawText,
      tags: ['名刺'],
    });

    addBusinessCard({
      contactId,
      rawText,
      imageFile,
      extracted,
    });

    setFile(null);
    setRawText('');
    setNotice('名刺から担当者を追加しました。');
  }

  return (
    <main className="page">
      <section className="page-header">
        <p className="eyebrow">Business cards</p>
        <h1>名刺OCR</h1>
        <p>OCRはこの画面でだけ遅延読み込みします。画像は圧縮してSupabase Storageへ保存します。</p>
      </section>

      <section className="detail-section">
        <label className="field-label file-field">
          名刺画像
          <input type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button className="ghost-button" type="button" disabled={isOcrRunning} onClick={runOcr}>
          {isOcrRunning ? 'OCR中...' : 'OCRする'}
        </button>
        <label className="field-label">
          OCR結果・手入力
          <textarea value={rawText} placeholder="会社名、氏名、役職、メール、電話など" onChange={(event) => setRawText(event.target.value)} />
        </label>
        <button className="primary-button" type="button" onClick={saveCard}>担当者へ保存</button>
        {notice && <p className="notice-text">{notice}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>

      <section className="result-stack">
        <div className="section-heading">
          <h2>名刺一覧</h2>
          <span>{businessCards.length}件</span>
        </div>
        <div className="card-grid two-column-grid">
          {businessCards.map((card) => (
            <article className="company-card" key={card.id}>
              <div className="company-heading">
                <h3>{card.extracted?.name || '氏名未取得'}</h3>
                <p>{card.extracted?.companyName || '会社未取得'}</p>
              </div>
              <p className="inline-helper">{card.rawText.slice(0, 160)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
