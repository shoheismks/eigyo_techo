# 営業手帳 機能仕様書

営業手帳の全機能仕様を管理する。

今後、機能追加・仕様変更を行う場合は、この `FEATURE_SPEC.md` を更新する。

## ステータス定義

- 実装済: 主要な画面・保存・表示が動作している。
- 開発中: 土台や一部UIはあるが、業務利用に必要な機能が残っている。
- 未実装: 設計のみ、または今後追加予定。

## ホーム

- ステータス: 実装済
- 目的: 朝アプリを開いたときに今日やるべき営業活動を把握する。
- 画面: `Home`
- 入力: なし。顧客、案件、見積、サンプル、クレーム、通知データを集計する。
- 出力: 今日フォロー、期限切れ、ステータス別件数、高スコア顧客、通知カード、同期状態。
- 保存先: なし。表示用集計。
- 関連データ: `customers`, `deal_histories`, `quotes`, `samples`, `claims`, `notifications`
- 今後の拡張: AI営業秘書、営業KPI、粗利分析、活動分析、カレンダー連携の強化。

## 顧客管理

- ステータス: 実装済
- 目的: 取引先会社情報を登録・検索・更新し、営業対象を管理する。
- 画面: `Customers`, `CustomerDetail`, `LeadSearch`, `CompanyEnrich`
- 入力: 会社名、正式社名、業種、地域、住所、電話、Webサイト、メール、問い合わせURL、タグ、ステータス、メモ、会社備考。
- 出力: 顧客一覧、検索結果、ステータス、重要度スコア、ランク、連絡先情報。
- 保存先: Supabase `customers`。接続失敗時はLocalStorageバックアップ。
- 関連データ: `contacts`, `business_cards`, `deal_histories`, `quotes`, `samples`, `claims`, `attachments`
- 今後の拡張: 法人番号API補完、gBizINFO連携、企業規模スコア、重複統合、全文検索。

## 顧客カルテ

- ステータス: 実装済
- 目的: 1社ごとの営業判断に必要な情報を1画面に集約する。
- 画面: `CustomerKarte`
- 入力: 顧客ID、担当者、商談履歴、クレーム、見積、サンプル、添付、提案商品。
- 出力: 基本情報、担当者、名刺、活動タイムライン、商談履歴、クレーム履歴、提案商品、見積履歴、サンプル履歴、添付ファイル、AI分析枠。
- 保存先: 関連テーブルごとにSupabaseへ保存。添付本体はStorage。
- 関連データ: `customers`, `contacts`, `business_cards`, `deal_histories`, `quotes`, `samples`, `claims`, `products`, `attachments`
- 今後の拡張: 詳細な権限管理、タイムラインの種類追加、活動履歴の自動生成、AI分析のOpenAI API接続。

## 担当者

- ステータス: 開発中
- 目的: 会社に紐づく担当者情報を管理し、商談・見積・サンプルと関連付ける。
- 画面: `CustomerKarte`, `BusinessCards`, `CustomerDetail`
- 入力: 氏名、部署、役職、メール、電話、携帯、決裁権、役職重要度、人物メモ。
- 出力: 担当者一覧、商談相手候補、メール作成時の参照情報。
- 保存先: Supabase `contacts`。必要に応じてLocalStorageバックアップ。
- 関連データ: `customers`, `business_cards`, `deal_histories`, `quotes`, `samples`
- 今後の拡張: 担当者別メモ、LINE ID、決裁フロー、影響力スコア、名刺からの自動更新。

## 名刺OCR

- ステータス: 開発中
- 目的: 名刺画像から担当者情報を抽出し、顧客に紐づける。
- 画面: `BusinessCards`, `CustomerKarte`
- 入力: 名刺画像、OCR結果、確認・編集済み担当者情報。
- 出力: 名刺画像プレビュー、OCRテキスト、担当者候補、担当者登録。
- 保存先: Supabase `business_cards`。名刺画像はSupabase Storage。
- 関連データ: `customers`, `contacts`, `attachments`
- 今後の拡張: OCR精度改善、複数名刺一括登録、名寄せ、スマホカメラUX改善。

## 商談

- ステータス: 実装済
- 目的: 営業活動・接触履歴を監査ログとして蓄積する。
- 画面: `Pipeline`, `CustomerKarte`, `CustomerDetail`
- 入力: 商談日、商談相手、同行者、種別、内容、次回アクション、記載者、返信、訂正、補足。
- 出力: 商談履歴、返信・訂正ツリー、案件ステータス、活動タイムライン。
- 保存先: Supabase `deal_histories`。接続失敗時はLocalStorageバックアップ。
- 関連データ: `customers`, `contacts`, `quotes`, `samples`, `claims`, `attachments`
- 今後の拡張: 音声議事録、AI要約、同行者のユーザー管理、編集不可ログのDB制約化。

## クレーム

- ステータス: 実装済
- 目的: クレームの発生、原因、対応、再発防止を管理する。
- 画面: `CustomerKarte`, `Pipeline`, `Home`
- 入力: クレーム種別、内容、発生日、対応状況、原因、再発防止策、対応期限、解決日、記載者。
- 出力: クレーム履歴、警告表示、通知、活動タイムライン。
- 保存先: Supabase `claims`。必要に応じてLocalStorageバックアップ。
- 関連データ: `customers`, `contacts`, `deal_histories`, `attachments`, `notifications`
- 今後の拡張: 重大度、品質報告書、仕入先責任管理、再発リスク分析。

## 商品マスター

- ステータス: 実装済
- 目的: 食品営業で提案する商品情報を管理する。
- 画面: `Products`, `ProductDetail`, `CustomerKarte`
- 入力: 商品名、カテゴリー、メーカー、産地、温度帯、荷姿、原価、希望販売価格、単位、粗利率、説明、メモ、画像、資料、スペックシート。
- 出力: 商品一覧、検索結果、商品詳細、見積履歴、サンプル履歴、採用顧客一覧。
- 保存先: Supabase `products`。商品画像・資料・スペックシートはSupabase Storage。
- 関連データ: `quotes`, `samples`, `suppliers`, `attachments`
- 今後の拡張: JANコード、アレルゲン、賞味期限、在庫連携、商品採用分析。

## 仕入先

- ステータス: 実装済
- 目的: 国内仕入先と仕入先商談を管理する。
- 画面: `Suppliers`
- 入力: 仕入先名、担当者、メール、電話、Webサイト、取扱商品、メモ、商談メモ、見積ファイル。
- 出力: 仕入先一覧、仕入先詳細、仕入先商談履歴、見積ファイル。
- 保存先: Supabase `suppliers`。見積ファイルはSupabase Storage。
- 関連データ: `products`, `quotes`, `attachments`
- 今後の拡張: 仕入先評価、品質管理、価格履歴、国内外タブの詳細化。

## 海外メーカー

- ステータス: 実装済
- 目的: 海外メーカー特有の取引条件を管理する。
- 画面: `Suppliers`
- 入力: 国、FOB港、Incoterms、MOQ、リードタイム、通貨、支払条件、温度帯、取扱商品。
- 出力: 海外メーカー一覧、取引条件、仕入先比較情報。
- 保存先: Supabase `suppliers`
- 関連データ: `products`, `quotes`, `attachments`
- 今後の拡張: 輸入書類、通関条件、為替影響、船積スケジュール。

## 見積

- ステータス: 実装済
- 目的: 顧客への見積提出履歴と有効期限を管理する。
- 画面: `CustomerKarte`, `ProductDetail`, `Home`, `Calendar`
- 入力: 見積番号、提出日、有効期限、通貨、合計金額、粗利率、ステータス、見積ファイル、メモ、失注理由。
- 出力: 見積履歴、見積期限通知、商品別見積履歴、活動タイムライン。
- 保存先: Supabase `quotes`。見積PDFはSupabase Storage。
- 関連データ: `customers`, `contacts`, `products`, `suppliers`, `attachments`, `notifications`
- 今後の拡張: 見積承認、版管理、メール送付ログ、自動PDF生成。

## サンプル管理

- ステータス: 実装済
- 目的: サンプル発送から評価・採用までの流れを管理する。
- 画面: `CustomerKarte`, `ProductDetail`, `Home`, `Calendar`
- 入力: サンプル名、顧客、担当者、商品、発送日、到着日、フォロー日、ステータス、評価、次回アクション、配送方法、追跡番号、メモ。
- 出力: サンプル履歴、フォロー予定、商品別サンプル履歴、活動タイムライン。
- 保存先: Supabase `samples`
- 関連データ: `customers`, `contacts`, `products`, `notifications`, `attachments`
- 今後の拡張: サンプル原価、数量、配送会社連携、採用履歴との連携。

## 添付ファイル

- ステータス: 開発中
- 目的: 顧客、商品、仕入先、商談、見積、クレームに紐づく資料を管理する。
- 画面: `CustomerKarte`, `ProductDetail`, `Suppliers`, `BusinessCards`
- 入力: ファイル、ファイル種別、関連ID、アップロード者。
- 出力: ファイル名、URL、種別、アップロード日、添付有無。
- 保存先: Supabase `attachments`。ファイル本体はSupabase Storage。
- 関連データ: `customers`, `contacts`, `products`, `suppliers`, `quotes`, `samples`, `deal_histories`, `claims`
- 今後の拡張: サムネイル、プレビュー、ウイルススキャン、保存期限、Storageパス整理。

## 検索

- ステータス: 実装済
- 目的: 必要な会社・担当者・商品・案件を素早く探す。
- 画面: `Customers`, `Products`, `Suppliers`, `Pipeline`, `CompanyEnrich`
- 入力: キーワード、ステータス、ランク、タグ、地域、カテゴリー、温度帯、メーカー、期限切れ条件。
- 出力: 絞り込み済み一覧、並び替え結果、高スコア順、フォロー日順。
- 保存先: なし。表示用処理。
- 関連データ: `customers`, `contacts`, `products`, `suppliers`, `deal_histories`, `quotes`, `samples`, `claims`
- 今後の拡張: Supabase全文検索、横断検索、保存済み検索条件、検索履歴。

## カレンダー

- ステータス: 実装済
- 目的: フォロー、商談、見積、サンプル、クレーム期限を確認し、予定を直接登録・編集する。
- 画面: `Calendar`
- 入力: 表示モード、対象日、件名、予定種別、顧客、担当者、案件、場所、開始日時、終了日時、終日、重要度、色、メモ、次回フォロー日、リマインダー、ステータス。
- 出力: 月表示、週表示、日表示、一覧表示、関連顧客カルテへの遷移、Home通知。
- 保存先: Supabase `events`。接続失敗時はLocalStorageバックアップ。
- 関連データ: `customers`, `contacts`, `deal_histories`, `quotes`, `samples`, `claims`, `events`
- 今後の拡張: 外部カレンダー連携、繰り返し予定、通知送信、参加者招待。

## 通知

- ステータス: 実装済
- 目的: 今日対応すべき営業活動を見落とさないようにする。
- 画面: `Home`
- 入力: フォロー日、見積期限、サンプルフォロー日、クレーム対応期限、未対応タスク。
- 出力: 通知カード、件数、優先度、関連顧客への導線。
- 保存先: 現在は画面表示時に判定。将来的にはSupabase `notifications`。
- 関連データ: `customers`, `quotes`, `samples`, `claims`, `deal_histories`
- 今後の拡張: 既読管理、スヌーズ、通知設定、Push通知。

## Chrome拡張

- ステータス: 実装済
- 目的: Webページ上で選択した会社名を右クリックから営業手帳に追加する。
- 画面: Chrome Extension, `/import`, `Customers`
- 入力: 選択テキスト、会社名URLパラメータ。
- 出力: 顧客登録、重複チェック、追加結果、得意先一覧への遷移。
- 保存先: Supabase `customers`。接続失敗時はLocalStorageバックアップ。
- 関連データ: `customers`
- 今後の拡張: 公開URLとの連携強化、取り込み確認画面、法人番号補完、複数候補管理。

## Supabase同期

- ステータス: 開発中
- 目的: PC・スマホで同じログインユーザーのデータを同期する。
- 画面: 全画面、特に `Home` の保存先表示。
- 入力: Supabase URL、anon key、ログインユーザー、各テーブルのCRUD。
- 出力: Supabase優先保存、LocalStorageバックアップ、クラウド再読み込み、同期状態表示。
- 保存先: Supabase Database。LocalStorageはバックアップ・設定保存程度。
- 関連データ: 全主要テーブル。
- 今後の拡張: 差分同期、競合解決、オフラインキュー、RLS監査。

## Storage

- ステータス: 開発中
- 目的: 添付ファイル本体をLocalStorageに保存せず、Supabase Storageで管理する。
- 画面: `BusinessCards`, `Products`, `ProductDetail`, `CustomerKarte`, `Suppliers`
- 入力: 画像、PDF、資料、音声、見積ファイル。
- 出力: Storage URL、ファイルメタ情報、サムネイル、添付有無。
- 保存先: Supabase Storage。DBにはURLとメタ情報のみ保存。
- 関連データ: `attachments`, `business_cards`, `products`, `quotes`, `suppliers`
- 今後の拡張: 画像圧縮、サムネイル生成、署名付きURL、権限別フォルダ、容量管理。

## AI営業

- ステータス: 開発中
- 目的: 営業活動全体をAIで支援し、次にやるべきことを提示する。
- 画面: `Home`, `CustomerKarte`
- 入力: 顧客情報、担当者、商談履歴、見積、サンプル、クレーム、商品、通知。
- 出力: 顧客特徴、注意点、次回アクション、優先順位、営業秘書コメント。
- 保存先: 現在は生成結果の表示中心。将来的には `ai_logs`。
- 関連データ: `customers`, `contacts`, `deal_histories`, `quotes`, `samples`, `claims`, `products`
- 今後の拡張: OpenAI API接続、営業KPI分析、日次サマリー、提案優先順位。

## AIメール

- ステータス: 実装済
- 目的: 顧客情報・商材・営業目的から営業メール案を作成する。
- 画面: `MailAI`
- 入力: 顧客、商品名、営業目的、タグ、商談履歴、提案商品、メモ。
- 出力: 丁寧版、簡潔版、提案型の件名・本文、コピー、Gmail/Outlook下書き作成。
- 保存先: SupabaseまたはLocalStorageのメール下書き。外部メールは現状モック。
- 関連データ: `customers`, `products`, `deal_histories`, `mail_drafts`
- 今後の拡張: OpenAI API精度向上、送信ログ、Gmail/Graph本接続、署名テンプレート。

## AI商談準備

- ステータス: 実装済
- 目的: 商談前に顧客の状況と確認事項を整理する。
- 画面: `CustomerKarte`
- 入力: 会社情報、担当者情報、商談履歴、見積履歴、サンプル履歴、クレーム履歴、提案商品。
- 出力: 顧客特徴、前回までの流れ、注意点、想定ニーズ、提案商品、質問、次回アクション案。
- 保存先: 現在は表示のみ。将来的には `ai_logs`。
- 関連データ: `customers`, `contacts`, `deal_histories`, `quotes`, `samples`, `claims`, `products`
- 今後の拡張: OpenAI API接続、商談チェックリスト化、商談後の自動記録。

## AI議事録

- ステータス: 未実装
- 目的: 商談音声やメモから議事録を作成し、商談履歴へ保存する。
- 画面: 将来 `Deals`, `CustomerKarte`
- 入力: 音声ファイル、商談メモ、参加者、顧客、担当者。
- 出力: 議事録、要約、決定事項、宿題、次回アクション。
- 保存先: Supabase `deal_histories`。音声はSupabase Storage。生成ログは `ai_logs`。
- 関連データ: `customers`, `contacts`, `deal_histories`, `attachments`
- 今後の拡張: 音声文字起こし、話者分離、議事録テンプレート、承認フロー。

## AI商品提案

- ステータス: 未実装
- 目的: 顧客情報や過去商談から提案すべき商品をAIで推薦する。
- 画面: 将来 `CustomerKarte`, `Products`, `Home`
- 入力: 顧客属性、タグ、商談履歴、採用品、見積、サンプル、商品マスター。
- 出力: 推奨商品、提案理由、想定ニーズ、提案メール材料。
- 保存先: 現在なし。将来的には `ai_logs` または提案履歴テーブル。
- 関連データ: `customers`, `products`, `quotes`, `samples`, `deal_histories`
- 今後の拡張: 類似顧客分析、粗利重視提案、在庫連携、提案結果学習。

## 今後追加予定機能

- LINE連携
- メール送信ログ
- AIログ管理
- 外部カレンダー連携
- 音声議事録
- 売上分析
- 粗利分析
- 営業KPI
- 商談分析
- 活動分析
- 在庫連携
- 仕入先評価
- 見積PDF自動生成
- 権限管理
- チーム共有
- オフライン差分同期

---

## Step26 追記: 在庫管理

- ステータス: 未実装
- 目的: 商品ごとの在庫状態を把握し、提案・見積・サンプル発送の判断に使う。
- 画面: Products、ProductDetail、Suppliers、Dashboard、将来のInventory画面。
- 入力:
  - 商品
  - 仕入先
  - 在庫ステータス
  - 現在庫
  - 引当数
  - 利用可能数
  - 単位
  - ロット番号
  - 賞味期限
  - 入荷予定日
  - 保管場所
  - メモ
- 出力:
  - 在庫ステータス表示
  - 欠品・残少・期限間近の警告
  - 見積・サンプル作成時の在庫確認
- 保存先: Supabase Database。添付がある場合のみSupabase Storage。
- 関連データ:
  - products
  - suppliers
  - quotes
  - samples
  - adoptions
- 今後の拡張:
  - 入出庫履歴
  - 棚卸
  - 複数倉庫
  - ERP/WMS連携

### 在庫ステータス

- 未連携
- 在庫あり
- 残少
- 欠品
- 入荷待ち
- 取扱停止
- 要確認

## Step26 追記: 見積PDF

- ステータス: 未実装
- 目的: 見積履歴からPDFを作成し、顧客へ提出できる状態で保存する。
- 画面: CustomerKarte、Quotes、ProductDetail。
- 入力:
  - 顧客情報
  - 担当者
  - 見積番号
  - 商品
  - 数量
  - 単価
  - 金額
  - 粗利率
  - 有効期限
  - 備考
- 出力:
  - 見積PDF
  - PDF URL
  - ファイル名
  - 生成日時
  - 版数
- 保存先:
  - PDF本体: Supabase Storage
  - メタ情報: Supabase Database `quotes`
- 関連データ:
  - customers
  - contacts
  - products
  - suppliers
  - quotes
  - attachments
- 今後の拡張:
  - 見積テンプレート
  - 承認フロー
  - Gmail/Outlook下書き添付
  - 電子署名
  - 送信履歴

### quotePdfService

`quotePdfService` は見積PDF生成を担当する。UIコンポーネントへPDF生成ロジックを直書きしない。

## Step26 追記: 経営判断ダッシュボード

- ステータス: 開発中
- 目的: 営業活動と商品・在庫・見積データを集約し、経営判断に必要な指標を確認する。
- 画面: Home、Dashboard、Analytics。
- 入力:
  - 顧客
  - 商談
  - 見積
  - サンプル
  - 採用
  - クレーム
  - 商品
  - 在庫
- 出力:
  - 今週のフォロー件数
  - 見積提出額
  - 採用見込み
  - 粗利率
  - 高重要度顧客
  - 欠品・残少商品
  - クレーム未対応
  - 担当者別活動量
- 保存先: 基本はSupabaseから都度集計。必要に応じて `dashboard_snapshots` に保存。
- 関連データ:
  - customers
  - deal_histories
  - quotes
  - samples
  - claims
  - products
  - inventories
- 今後の拡張:
  - 売上分析
  - 粗利分析
  - 営業KPI
  - 担当者別ランキング
  - 月次レポートPDF

---

## Step34 追記: 見積作成・PDF出力

- ステータス: 実装済
- 目的: 顧客・担当者・案件・商品・在庫を選択し、見積作成からPDF出力、再編集、再PDF出力まで行う。
- 画面: `CustomerKarte`, `Home`
- 入力: 顧客、担当者、案件名、商品明細、数量、単位、販売単価、利用在庫、運賃、値引、支払条件、納品条件、有効期限、備考。
- 出力: 見積番号、小計、消費税、税込合計、原価合計、粗利額、粗利率、PDFプレビュー、PDFファイル、顧客カルテの見積履歴、Homeの提出待ち/期限切れ/採用率/失注率。
- 保存先: Supabase `quotes`。PDF本体と添付ファイル本体はSupabase Storage。
- 関連データ: `customers`, `contacts`, `products`, `suppliers`, `inventories`, `attachments`
- 今後の拡張: 見積版管理、承認フロー、電子署名、Gmail/Outlook下書き添付、サーバー側PDF生成。

### dashboardService

`dashboardService` は営業データ集約を担当する。画面側では集計済みデータを受け取り、表示に集中する。
---

## Step35 追記: 経費控除後利益ダッシュボード

- ステータス: 実装済
- 目的: 売上、商品原価、粗利に加えて、諸経費控除後の営業利益と実質利益を確認し、食品営業の採算判断をしやすくする。
- 画面:
  - `AnalyticsPage`
  - `Home`
  - `CustomerKarte` の見積入力
- 入力:
  - 運賃
  - 保管料
  - 通関費
  - 検品費
  - 加工費
  - 販売手数料
  - 値引
  - 廃棄損
  - 為替差損益
  - その他経費
  - 共通経費
  - 共通経費按分基準: 重量比、数量比、売上額比
  - 経費メモ
- 出力:
  - 売上
  - 商品原価
  - 粗利額
  - 粗利率
  - 諸経費合計
  - 営業利益
  - 営業利益率
  - 実質利益
  - 実質利益率
  - 経費内訳
  - 顧客別、商品別、案件別、見積別、在庫別、仕入先別、月別集計
- 保存先:
  - Supabase Database `quotes`
  - 証憑ファイルがある場合は `attachments` とSupabase Storage
- 関連データ:
  - `customers`
  - `contacts`
  - `products`
  - `suppliers`
  - `inventories`
  - `quotes`
  - `attachments`
- 今後の拡張:
  - 経費専用テーブル
  - 入庫ロット別配賦
  - 会計ソフト連携
  - 月次PLレポート
  - 売上実績連携
