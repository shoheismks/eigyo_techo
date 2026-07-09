import { APP_VERSION_LABEL } from '../../../shared/constants/appMeta.js';

const manualSections = [
  {
    title: 'ログイン',
    body: 'メールアドレスとパスワードでログインします。ログアウトは設定画面またはPCヘッダーから行います。',
  },
  {
    title: 'ホーム',
    body: '今日フォロー、今週フォロー、通知、高スコア顧客を確認します。朝一番に見る画面です。',
  },
  {
    title: '顧客',
    body: '取引先を検索・絞り込みし、顧客カルテやメール作成へ進みます。PCはテーブル、スマホはカード表示です。',
  },
  {
    title: '担当者',
    body: '氏名、部署、役職、メール、電話、決裁権、人物メモを管理します。',
  },
  {
    title: '名刺',
    body: 'スマホでは撮影、PCでは画像アップロードで名刺を追加し、OCR結果を確認して担当者化します。',
  },
  {
    title: '商品',
    body: '商品マスター、画像、資料、スペックシート、原価、希望販売価格、粗利率を管理します。',
  },
  {
    title: '在庫',
    body: '商品ごとの複数在庫を管理します。フリー、ファーム、出庫待ちなどの状態を見積で参照できます。',
  },
  {
    title: '仕入先',
    body: '国内仕入先と海外メーカーを管理します。国、Incoterms、MOQ、リードタイムなどを記録できます。',
  },
  {
    title: '見積PDF',
    body: '顧客カルテから見積を作成し、PDFプレビュー、ダウンロード、Storage保存を行います。',
  },
  {
    title: 'サンプル',
    body: '発送日、到着日、フォロー日、評価、次回アクション、追跡番号を管理します。',
  },
  {
    title: 'クレーム',
    body: '原因、対応、再発防止、対応期限を記録します。履歴は削除せず資産として残します。',
  },
  {
    title: 'ダッシュボード',
    body: '見積額、粗利、商品別・顧客別見積、在庫引当、クレーム、期限切れフォローを集計します。',
  },
  {
    title: '検索',
    body: 'PCヘッダー検索、顧客検索、商品検索から会社名、商品、タグ、メモを探します。',
  },
  {
    title: 'バックアップ',
    body: '設定画面からJSON Export / Importができます。Storageはファイル本体ではなくURLとメタ情報のみ扱います。',
  },
  {
    title: 'FAQ',
    body: '同期されない場合は同じアカウントか、保存先がSupabaseかを確認し、クラウドから再読み込みを実行してください。',
  },
];

export default function HelpPage({ setActivePage }) {
  return (
    <section className="page help-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Help</p>
          <h1>操作マニュアル</h1>
          <p>営業手帳の基本操作を画面ごとに確認できます。詳細版はMarkdownの `docs/MANUAL.md` にあります。</p>
        </div>
        <div className="version-badge">{APP_VERSION_LABEL}</div>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <h2>クイックガイド</h2>
          <button type="button" className="text-button" onClick={() => setActivePage('Settings')}>
            設定へ
          </button>
        </div>
        <div className="help-grid">
          {manualSections.map((section) => (
            <article className="help-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sync-status-card">
        <div>
          <span>Markdown manual</span>
          <strong>docs/MANUAL.md</strong>
        </div>
        <p>PDF化や印刷用の正式マニュアルは、このMarkdownを元に作成できます。</p>
      </section>
    </section>
  );
}
