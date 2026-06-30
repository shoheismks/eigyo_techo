# 営業手帳

営業先を探し、保存し、連絡先取得、AIメール作成、案件管理まで行うスマホファーストの営業支援Webアプリです。

## 公開URL

```text
https://eigyo-techo.vercel.app/
```

## 主な機能

- 営業先検索
- 無料優先の企業情報補完
- 得意先管理
- 案件管理、パイプライン管理
- 今日フォローすべき案件のダッシュボード
- 企業スコアリング
- OpenAI APIによる営業メール案生成
- Gmail / Outlook 下書き作成のモック実装
- Supabase同期
- Supabase未設定またはオフライン時のLocalStorage fallback

## 技術構成

- React
- Vite
- Supabase
- LocalStorage fallback

## セットアップ

```bash
npm install
npm run dev
```

ローカル起動後、以下を開きます。

```text
http://127.0.0.1:5173/
```

## ビルド

```bash
npm run build
```

## 環境変数

`.env.example` を参考に、ローカルでは `.env` を作成してください。

```text
VITE_GOOGLE_PLACES_API_KEY=
VITE_NTA_CORPORATE_APP_ID=
VITE_NTA_CORPORATE_API_URL=https://api.houjin-bangou.nta.go.jp/4/name
VITE_GBIZINFO_API_KEY=
VITE_GBIZINFO_API_URL=https://info.gbiz.go.jp/hojin/v1/hojin
VITE_OPENAI_API_KEY=
VITE_OPENAI_MODEL=gpt-5.2
VITE_SUPABASE_URL=https://rwiviwmyqguaazqyzdny.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
```

重要: `.env` やAPIキー、認証情報はGitHubへコミットしないでください。

## Supabase

Supabaseを未設定でもアプリはLocalStorageで動作します。Supabaseを利用する場合は、Vercelまたはローカルの環境変数に以下を設定します。

- `VITE_SUPABASE_URL=https://rwiviwmyqguaazqyzdny.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` または `VITE_SUPABASE_ANON_KEY`

ブラウザアプリでは `VITE_SUPABASE_PUBLISHABLE_KEY` の利用を推奨します。どちらも設定されている場合は `VITE_SUPABASE_PUBLISHABLE_KEY` を優先します。

Home下部に現在の保存先が表示されます。PCとスマホで同期されない場合は、両方の端末で「保存先: Supabase」になっているか確認し、「クラウドから再読み込み」を押してください。

### customers テーブル

現在のアプリは `customers`, `products`, `contacts`, `suppliers`, `business_cards`, `complaints`, `samples`, `quotes`, `attachments`, `mail_drafts` テーブルを使用します。Supabase SQL Editorで [supabase/customers.sql](supabase/customers.sql) を実行してください。

`Could not find the table 'public.customers' in the schema cache` が出る場合は、テーブルがまだ作成されていません。

主なカラム想定は以下です。

```sql
create table customers (
  id text primary key,
  place_id text,
  corporate_number text,
  company_name text,
  industry text,
  area text,
  address text,
  phone text,
  website text,
  email text,
  email_type text,
  inquiry_url text,
  status text,
  tags jsonb,
  memo text,
  next_follow_up_date date,
  is_do_not_contact boolean default false,
  do_not_contact_reason text,
  deal_histories jsonb,
  proposed_products jsonb,
  source text,
  contact_status text,
  last_contact_date date,
  next_follow_date date,
  pipeline_memo text,
  score integer,
  rank text,
  score_reasons jsonb,
  created_at timestamptz,
  updated_at timestamptz
);
```

このSQLは初期公開確認用として `anon` に `select`, `insert`, `update`, `delete` を許可します。ログイン機能を追加する場合は、ユーザー単位のRLSポリシーへ変更してください。

## Vercel公開手順

1. GitHubリポジトリをVercelでimportします。
2. Framework Preset は `Vite` を選びます。
3. Build Command は `npm run build` のままで問題ありません。
4. Output Directory は `dist` のままで問題ありません。
5. Vercelの `Environment Variables` に必要な環境変数を登録します。
6. Deployします。

## API連携

### Google Places

`VITE_GOOGLE_PLACES_API_KEY` が未設定の場合は仮データ検索にフォールバックします。

### 無料優先の企業情報補完

「補完」画面では会社名を一括貼り付けできます。国税庁 法人番号APIのアプリケーションIDがある場合は正式社名、所在地、法人番号の取得を試みます。未設定でもGoogle検索URLとgBizINFO確認URLを生成し、人間が公式サイトを確認して入力できます。

Google検索API、Google Mapsスクレイピング、Baseconnect自動巡回は行いません。公式サイトURLを手動入力した会社だけ、公開メールアドレスと問い合わせフォームURLの抽出を試みます。

## Chrome拡張

`extension/` にローカル開発用のChrome拡張があります。

1. 営業手帳を `http://localhost:5173/` で起動します。
2. Chromeで `chrome://extensions` を開きます。
3. デベロッパーモードを有効にします。
4. `パッケージ化されていない拡張機能を読み込む` から `extension/` を選択します。
5. 任意のWebページで会社名テキストを選択し、右クリックの「営業手帳に追加」を押します。

拡張はユーザーが選択したテキストだけを営業手帳へ送信します。ページ全体のスクレイピングや自動巡回は行いません。

### OpenAI

`VITE_OPENAI_API_KEY` が未設定または通信エラーの場合はテンプレート生成にフォールバックします。

注意: Viteの環境変数はブラウザに露出します。本番でOpenAI APIキーを安全に扱う場合は、バックエンドAPIまたはVercel Functions経由に移行してください。

### Gmail / Outlook

現在は下書き作成のモック実装です。自動送信は行いません。後でGoogle OAuth、Gmail API、Microsoft OAuth、Microsoft Graph APIへ差し替えられるようにサービス層を分けています。

## GitHubに上げないもの

- `.env`
- APIキー
- OAuthクライアントシークレット
- Supabase service role key
- `node_modules`
- `dist`
