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

- `customers`, `contacts`, `business_cards`, `products`, `suppliers`, `quotes`, `samples`, `deal_histories`, `claims`, `attachments`, `notifications` はユーザーごとに分離する。
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

## 7. OCR / 音声

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

## 8. API設計方針

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
