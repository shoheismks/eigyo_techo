# 営業手帳 API・連携仕様

営業手帳が利用する外部API・内部API・連携仕様を整理する。

今後、AI・LINE・Gmail・Outlook・Chrome拡張連携を追加する時は、この `API_SPEC.md` を参照する。

## 1. Supabase

### Auth

- Supabase Authを利用する。
- 初期ログイン方式はメールアドレス・パスワードとする。
- 将来Google Loginを追加しやすい構成にする。
- 未ログイン時はアプリ本体を表示しない。

### Database

- 顧客、担当者、商談、商品、仕入先、見積、サンプル、クレーム、通知などを保存する。
- 各テーブルは原則として `user_id` を持つ。
- PC・スマホ間で同じログインユーザーのデータを同期する。
- LocalStorageは設定保存やオフライン時のバックアップ程度に限定する。

### Storage

- 添付ファイル本体はSupabase Storageに保存する。
- DBにはURL、Storage path、ファイル名、ファイル種別、アップロード者などのメタ情報のみ保存する。
- 保存対象は名刺画像、商品画像、商品資料、スペックシート、見積PDF、音声、写真、添付資料とする。

### RLS

- RLSを有効化する。
- 原則として `auth.uid() = user_id` のデータのみ参照・追加・更新・削除できる。
- anon全許可は禁止する。
- Storageもユーザー単位のパスで分離し、他ユーザーのファイルを参照できないようにする。

### ユーザーごとのデータ分離

- `customers`, `contacts`, `business_cards`, `products`, `suppliers`, `quotes`, `samples`, `deal_histories`, `claims`, `attachments`, `events`, `notifications` はユーザーごとに分離する。
- 共有機能を追加する場合は、別途チーム・権限テーブルを設計する。

## 2. Chrome拡張

- Webページ上でユーザーが選択したテキストのみを会社名として送信する。
- 送信先は営業手帳の `/import?companyName=` とする。
- 例: `https://eigyo-techo.vercel.app/import?companyName=会社名`
- 営業手帳側は `URLSearchParams` で `companyName` を取得し、`importCompanyName(companyName)` で保存する。
- 自動スクレイピングは禁止する。
- ページ全体の巡回、Google Mapsスクレイピング、Baseconnect自動巡回は禁止する。
- ユーザーが明示的に選択した情報のみ送信する。

## 3. OpenAI API

OpenAI APIは以下のAI機能に利用する。

- AIメール
- AI商談準備
- AI議事録
- AI商品提案
- AI営業秘書

### 利用ルール

- 生成結果は必ずユーザーが確認・編集してから利用する。
- 自動送信や自動登録は行わない。
- 個人メールアドレスを推測しない。
- 過度に誇張した営業表現を避ける。
- 食品営業で使いやすい自然な日本語を優先する。
- APIキー未設定・通信エラー時はテンプレートやダミー生成へフォールバックする。

### 実装方針

- OpenAI API処理は `shared/services` または専用serviceに分離する。
- UIコンポーネントにAPI通信処理を直書きしない。
- 将来モデル変更できるように、プロンプト作成・API呼び出し・レスポンス整形を分離する。

## 4. LINE Messaging API

- 将来対応とする。
- 個人LINEではなく、LINE公式アカウント連携を前提とする。
- Webhookで受信したメッセージを営業手帳へ保存する。
- 顧客、担当者、商談履歴、コミュニケーション履歴に紐づける。
- LINE連携ではユーザー同意と認証情報管理を必須とする。
- 返信自動化を行う場合も、初期段階ではユーザー確認を挟む。

## 5. Gmail / Outlook

- 将来対応とする。
- 初期実装は下書き作成を優先する。
- 自動送信は後回しにする。
- 送信履歴は顧客・担当者に紐づける。
- GmailはGoogle OAuth / Gmail APIへ差し替え可能な構成にする。
- OutlookはMicrosoft OAuth / Microsoft Graph APIへ差し替え可能な構成にする。
- メール本文はユーザー確認後に下書き化する。
- メールアドレスが未登録の場合は下書き作成を実行しない。

## 6. Google / 企業情報補完

- Google検索URL生成は可とする。
- 例: `https://www.google.com/search?q=会社名`
- Google Mapsスクレイピングは禁止する。
- Google検索結果の自動巡回は禁止する。
- 有料APIは後から差し替え可能な構成にする。
- Google Places APIを利用する場合も、APIキー未設定時は仮データや手動入力へフォールバックする。
- 無料優先の企業情報補完では、公開情報と人間確認を前提とする。

## 7. カレンダー

- 初期実装は外部カレンダーAPIへ接続しない。
- 予定はSupabase `events` に保存し、ユーザーごとにRLSで分離する。
- 顧客、担当者、案件、商談履歴、Home通知とは内部データで連携する。
- 将来Google Calendar / Microsoft 365 Calendarへ接続する場合も、ユーザー確認なしの外部送信は行わない。
- 外部連携用IDは `external_calendar_id` などの追加カラムで管理する。

## 8. OCR / 音声

### 名刺OCR

- 名刺画像から担当者情報を抽出する。
- OCR結果は必ず確認・編集してから保存する。
- スマホではカメラ、PCでは画像アップロードを基本とする。
- OCRライブラリは名刺画面でだけ遅延読み込みする。

### 音声議事録

- 商談音声から議事録を作成する。
- まずは手動入力併用とする。
- 音声ファイルはSupabase Storageに保存し、DBにはURLとメタ情報のみ保存する。
- 将来OpenAI Vision / Whisper等へ差し替え可能な構成にする。

## 9. API設計方針

- 各API処理は `shared/services` に分離する。
- UIコンポーネントにAPI処理を直書きしない。
- APIキーは `.env` / Vercel環境変数で管理する。
- 秘密キーをフロントに直書きしない。
- ブラウザに露出してはいけない秘密キーはサーバー側またはEdge Functionで扱う。
- エラーは画面に表示する。
- API失敗時も既存データを壊さない。
- 保存前に入力値を検証する。
- insert/update/delete後は必要に応じて再取得する。
- APIレスポンス形式はservice層でアプリ内部形式へ変換する。
- 外部APIへの依存をUIから切り離し、モック・フォールバック・本番APIを差し替えやすくする。

---

## Step26 追記: inventory module / quotePdfService / dashboardService

### inventory module

在庫管理はまず内部サービスとして実装し、将来の外部在庫システム連携に備える。

- 対象:
  - 商品在庫
  - ロット
  - 賞味期限
  - 入荷予定
  - 欠品・残少
  - 取扱停止
- 外部API:
  - 初期実装では未接続。
  - 将来、ERP / WMS / 仕入先CSV / EDI へ拡張可能にする。
- API設計方針:
  - UIに在庫判定ロジックを直書きしない。
  - 在庫ステータス判定はサービス層に分離する。
  - 在庫更新は監査ログを残せる構成にする。

### quotePdfService

`quotePdfService` は見積PDF生成を担当する内部サービスである。

- 入力:
  - customer
  - contacts
  - quote
  - products
  - supplier
  - company settings
- 出力:
  - PDF file
  - `pdf_url`
  - `pdf_storage_path`
  - `pdf_file_name`
  - `pdf_generated_at`
  - `pdf_version`
- 保存:
  - PDF本体はSupabase Storage。
  - DBにはURLとメタ情報のみ保存。
- 注意:
  - 自動送信は禁止。
  - ユーザー確認後にダウンロード、共有、メール添付へ進む。
  - 将来、Edge Functionsでサーバー側PDF生成へ移行可能にする。

### Step34 quotePdfService 追記

`quotePdfService` はVersion1.0の見積PDF生成を担当する内部サービスである。

- 入力:
  - `quote`
  - `customer`
  - `contacts`
  - `products`
  - `inventories`
  - `suppliers`
  - `financials`
- 出力:
  - A4縦相当のHTMLプレビュー
  - PDF `File`
  - ダウンロード用ファイル名
- 保存:
  - PDF本体はSupabase Storageへ保存する。
  - `quotes` には `pdf_url`, `pdf_file_name`, `pdf_storage_path`, `pdf_generated_at`, `pdf_history` を保存する。
- API方針:
  - UIコンポーネントへPDF生成ロジックを直書きしない。
  - 自動メール送信はしない。
  - Google Drive保存はVersion1.0では行わない。
  - 将来はEdge Functionsや専用PDFエンジンへ差し替え可能にする。

### dashboardService

`dashboardService` は営業データ集約を担当する内部サービスである。

- 集約対象:
  - customers
  - contacts
  - deal_histories
  - quotes
  - samples
  - claims
  - products
  - suppliers
  - inventories
  - adoptions
- 出力:
  - KPIカード
  - ステータス別件数
  - 見積金額
  - 粗利率
  - フォロー期限
  - 在庫リスク
  - クレーム未対応
- 方針:
  - UIコンポーネントに集計式を分散させない。
  - 初期はフロント側集計でよい。
  - データ量が増えたらSupabase View / RPC / Edge Functionsへ移行する。
  - 集計失敗時も元データを壊さない。

### Storage 方針追加

- 見積PDF:
  - `quote-pdfs` bucket または `app-attachments/quotes/` に保存。
- 在庫関連資料:
  - `app-attachments/inventory/` に保存。
- 経営レポート:
  - `app-attachments/reports/` に保存。

Storageに保存したファイル本体は一覧画面で読み込まず、DBのURLとメタ情報のみ表示する。
## 追記: 業務コード連携

- 商品コード、在庫コード、案件コード、見積番号、顧客コード、仕入先コードは外部連携用の任意コードとして扱う。
- 内部APIやSupabaseの関連付けは既存IDを使用する。
- コードは半角英数字と記号のみ許可し、空白・日本語・全角文字は禁止する。
- 大文字小文字を区別せず重複不可にする。
- バーコード、QR、CSV、ERP/WMS連携時もこのコード体系を参照する。
- 外部から取り込む場合は保存前に正規化と重複チェックを行う。
## 追加: 見積発行元 / Issuer API 方針

- 発行元マスターは Supabase `issuers` テーブルで管理する。
- RLSは `auth.uid() = user_id` とし、ユーザーごとに発行元を分離する。
- ロゴと印影は Supabase Storage `app-attachments` に保存し、DBにはURL、ファイル名、Storage pathのみ保存する。
- 見積作成時は `issuer_id` と `issuer_snapshot` を `quotes` に保存する。
- PDF再出力時は現在の発行元マスターではなく、まず `issuer_snapshot` を使用する。これにより過去見積の発行元情報を固定する。
- 顧客/案件の既定発行元は `customers.default_issuer_id` / `projects.default_issuer_id` とし、QuoteFormの初期値としてのみ利用する。
- 発行元とPDFテンプレートは別概念とし、見積には `pdf_template` を保存する。

## 成約確認書 約款・免責事項

- 約款・免責事項は外部APIではなく、発行元マスターと見積スナップショットで管理する。
- 発行元マスターの文面は `issuers` へ保存し、見積/成約確認書作成時に `quotes.terms_snapshot` へコピーする。
- PDF再出力時は現在の発行元マスターではなく、保存済みsnapshotを優先する。
- 顧客向けPDFには社内原価、粗利、営業利益、実質利益を表示しない。
- 電子署名サービスや法務レビューAPIとの接続は未実装。将来接続する場合も、確定前にユーザー確認を必須とする。

## 見積書PDF / 成約確認書PDF 分離

- `quotePdfService` は見積書PDFと成約確認書PDFの両方を生成するが、保存先と表示内容を分離する。
- 見積書PDFは `createQuotePdfFile` / `renderQuotePreviewHtml` を使用し、約款全文、免責事項全文、署名欄を表示しない。
- 成約確認書PDFは `createConfirmationPdfFile` / `renderConfirmationPreviewHtml` を使用し、保存済み `terms_snapshot`, `disclaimer_snapshot`, `visible_terms`, `special_terms` を表示する。
- 見積書PDFメタ情報は `quotes.pdf_url`, `pdf_file_name`, `pdf_storage_path`, `pdf_generated_at`, `pdf_history` に保存する。
- 成約確認書PDFメタ情報は `quotes.confirmation_pdf_url`, `confirmation_pdf_file_name`, `confirmation_pdf_storage_path`, `confirmation_pdf_generated_at`, `confirmation_pdf_history` に保存する。
- PDF本体は引き続き Supabase Storage `app-attachments` を利用する。
- どちらのPDFにも社内原価、粗利、営業利益、実質利益は表示しない。

## 請求書PDF / 入金管理 API 方針

- 請求書は `invoices`, `invoice_lines`, `invoice_payments`, `invoice_history` を Supabase Database に保存する。
- 請求書PDF本体は Supabase Storage `app-attachments` を利用し、DBには `invoice_pdf_url`, `invoice_pdf_file_name`, `invoice_pdf_storage_path`, `invoice_pdf_generated_at`, `invoice_pdf_history` のみ保存する。
- 成約確認書または見積書から作成する場合、元帳票の内容を `source_quote_snapshot` / `source_confirmation_snapshot` としてコピーする。
- 発行元情報、登録番号、振込先、税端数処理、請求書備考は作成時点で `issuer_snapshot` / `bank_snapshot` にコピーする。
- RLSは authenticated ユーザーのみ、`auth.uid() = user_id` のデータに限定する。
- 請求書番号は発行元ごとに採番し、入力済み番号はユーザー内で重複不可とする。
- PDF生成は `invoicePdfService` に分離し、UIコンポーネントへPDF内部処理を直書きしない。
- 入金登録は `invoice_payments` と請求書本体の `payments` snapshot の両方へ展開できる構成とし、将来会計APIや督促メールAPIに接続しやすくする。
- 請求書の法的有効性を自動保証する表示はしない。
---

## 追記: 在庫RPC API

在庫更新はフロント側の複数回 `update` ではなく、Supabase RPCで処理する。

- `receive_inventory`: 入庫。`inventory_lots` と `inventory_movements` を同時更新する。
- `issue_inventory`: 出庫。`SELECT FOR UPDATE` 相当の行ロック内で数量不足を拒否し、履歴を作る。
- `update_inventory_lot`: ロットメタ情報更新。数量変更時は `manual_adjustment` を残す。
- `reserve_inventory`: 在庫引当。使用可能在庫がマイナスになる引当を拒否する。
- `release_inventory_reservation`: 引当解除。
- `fulfill_inventory_reservation`: 引当済み在庫の出荷。
- `complete_stocktake`: 棚卸確定。棚卸明細と差異履歴を同時作成する。

すべて `authenticated` のみ実行可能とし、関数内で `auth.uid()` を使用して `user_id` を固定する。`service_role` はフロントへ渡さない。
