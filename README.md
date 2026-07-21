# 営業手帳

食品業界向けの営業CRMです。取引先、担当者、名刺、商談、商品、仕入先、見積、サンプル、クレーム、添付ファイルを管理し、AIメールやAI商談準備の土台を備えています。

公開URL:

```text
https://eigyo-techo.vercel.app/
```

## Version

Version 1.0 Release Candidate

## Trial Operation

1-2週間の実運用に向けたチェックリスト、既知バグ一覧、改善メモ欄、フィードバック記録、Ver1.0運用手順は以下を参照してください。

- [TRIAL_OPERATION.md](docs/TRIAL_OPERATION.md)

## 主な機能

- Supabase Authによるメールアドレス・パスワードログイン
- 取引先管理、顧客カルテ、担当者、名刺管理
- 商談履歴、活動タイムライン、フォロー管理
- 商品マスター、商品画像、資料、スペックシートのURL管理
- 仕入先管理、海外メーカー項目
- 見積履歴、サンプル管理、採用履歴
- クレーム管理、通知カード、カレンダー表示
- AIメール、AI商談準備、AI営業支援のダミー生成
- Chrome拡張から選択した会社名を `/import?companyName=` で取り込み
- Supabase DB / Supabase Storage連携
- LocalStorage fallback
- JSON Export / JSON Import
- PCはサイドバー・テーブル中心、スマホは5タブ・カードUI

## 技術構成

- React
- Vite
- Supabase Auth
- Supabase Database
- Supabase Storage
- Chrome Extension
- Vercel

## セットアップ

```bash
npm install
npm run dev
```

ローカルURL:

```text
http://127.0.0.1:5173/
```

## ビルド

```bash
npm run build
```

ビルド成果物は `dist/` に生成されます。

## 環境変数

`.env.example` を参考に `.env` を作成してください。`.env` はGitHubへ上げないでください。

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

フロントエンドに露出するVite環境変数へ秘密キーやservice role keyを入れないでください。

## Supabase

Supabase未設定または接続失敗時はLocalStorage fallbackで最低限動作します。PC・スマホ同期を使う場合は、Vercel環境変数に以下を設定してください。

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` または `VITE_SUPABASE_ANON_KEY`

推奨は `VITE_SUPABASE_PUBLISHABLE_KEY` です。両方が設定されている場合はpublishable keyを優先します。

### Migration

Supabase CLIを使う場合は `supabase/migrations/` を順番に適用してください。

主な対象:

- extensions
- tables
- indexes
- storage
- RLS
- functions
- triggers
- views
- Step18 optimization migration

SQL Editorで手動実行する場合も、ファイル名順に実行してください。既存データを消すSQLは含めない方針です。

### Storage

Storage bucket:

```text
app-attachments
```

DBにはファイル本体ではなく、Storage URL、path、ファイル名、content type、sizeなどのメタ情報だけを保存します。

## Chrome拡張

Chrome拡張は `extension/` にあります。

使い方:

1. Chromeで `chrome://extensions` を開く
2. デベロッパーモードを有効化
3. 「パッケージ化されていない拡張機能を読み込む」から `extension/` を選択
4. 任意のWebページで会社名テキストを選択
5. 右クリックの「営業手帳に追加」を押す

送信先:

```text
https://eigyo-techo.vercel.app/import?companyName=選択した会社名
```

ページ全体のスクレイピングは行いません。ユーザーが選択したテキストだけを送信します。

## Vercel公開

1. GitHubリポジトリをVercelでImport
2. Framework Presetは `Vite`
3. Build Commandは `npm run build`
4. Output Directoryは `dist`
5. Environment Variablesに必要なVite環境変数を登録
6. Deploy

`/import` などの直接アクセスに対応するため、`vercel.json` でSPA rewriteを設定しています。

## バックアップ・復元

設定画面からJSON Export / JSON Importができます。

- Exportはアプリ内データをJSONで保存します
- Importは既存データを削除せず、同じIDは更新、ないIDは追加します
- Storageのファイル本体は含めず、URLとメタ情報のみ含めます

## 開発ドキュメント

- [PROJECT_RULE.md](docs/PROJECT_RULE.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [DATABASE.md](docs/DATABASE.md)
- [FEATURE_SPEC.md](docs/FEATURE_SPEC.md)
- [BUSINESS_RULE.md](docs/BUSINESS_RULE.md)
- [API_SPEC.md](docs/API_SPEC.md)
- [BUGFIX_RULE.md](docs/BUGFIX_RULE.md)
- [MANUAL.md](docs/MANUAL.md)
- [DATA_RULE.md](docs/DATA_RULE.md)
- [ADMIN.md](docs/ADMIN.md)
- [ROADMAP.md](docs/ROADMAP.md)
- [SALES_ORDER_PHASE1.md](docs/SALES_ORDER_PHASE1.md)
- [SALES_ORDER_PHASE2.md](docs/SALES_ORDER_PHASE2.md)
- [SALES_ORDER_PHASE3.md](docs/SALES_ORDER_PHASE3.md)
- [SALES_ORDER_PHASE4.md](docs/SALES_ORDER_PHASE4.md)
- [RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)
- [TRIAL_OPERATION.md](docs/TRIAL_OPERATION.md)
- [CHANGELOG.md](CHANGELOG.md)

今後の実装は上記ドキュメントを前提に進めます。

## GitHubへ上げないもの

- `.env`
- APIキー
- OAuth secret
- Supabase service role key
- `node_modules`
- `dist`

## リリース確認

Version1.0候補の確認項目は [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) を参照してください。

### Version1.0前 安定化確認

2026-07-05 時点で以下を確認済みです。

- PCヘッダー検索から取引先一覧へ検索語が反映されること
- Supabase優先同期とLocalStorageフォールバックの実装経路
- Supabase Storageへ添付し、DBにはURLとメタ情報のみ保存する方針
- Chrome拡張取り込み用 `/import?companyName=` のローカルHTTP 200応答
- 在庫管理、見積PDF、経営判断ダッシュボード、顧客カルテのbuild経路
- `npm.cmd run build` が成功すること
