# DATABASE

営業手帳で使用するデータベース構造を管理する。

今後テーブルを追加・変更する場合は、この `DATABASE.md` を正として更新する。

## テーブル一覧

- customers
- contacts
- business_cards
- products
- suppliers
- projects
- quotes
- samples
- deal_histories
- claims
- attachments
- events
- notifications
- users

## ER図

```mermaid
erDiagram
  users ||--o{ customers : owns
  users ||--o{ products : owns
  users ||--o{ suppliers : owns
  users ||--o{ projects : owns
  users ||--o{ events : owns
  users ||--o{ notifications : receives

  customers ||--o{ contacts : has
  contacts ||--o{ business_cards : has
  customers ||--o{ deal_histories : has
  contacts ||--o{ deal_histories : joins
  customers ||--o{ quotes : receives
  suppliers ||--o{ quotes : provides
  products ||--o{ quotes : included
  customers ||--o{ samples : receives
  products ||--o{ samples : included
  customers ||--o{ claims : has
  customers ||--o{ attachments : has
  customers ||--o{ events : schedules
  contacts ||--o{ attachments : has
  contacts ||--o{ events : attends
  products ||--o{ attachments : has
  suppliers ||--o{ attachments : has
  customers ||--o{ projects : has
  suppliers ||--o{ projects : has
  projects ||--o{ quotes : links
  projects ||--o{ samples : links
  projects ||--o{ claims : links

  customers {
    uuid id PK
    uuid user_id FK
    text company_name
    text status
    text rank
    timestamptz created_at
    timestamptz updated_at
  }

  contacts {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text name
    text position
    text email
  }

  business_cards {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    uuid contact_id FK
    text image_url
  }

  products {
    uuid id PK
    uuid user_id FK
    text name
    text category
    numeric cost_price
    numeric desired_selling_price
  }

  suppliers {
    uuid id PK
    uuid user_id FK
    text name
    text supplier_type
    text country
  }

  quotes {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    uuid supplier_id FK
    text quote_number
    text file_url
  }

  samples {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text sample_name
    text status
  }

  deal_histories {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text type
    text summary
  }

  claims {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text claim_type
    text status
  }

  attachments {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text file_url
    text file_name
  }

  events {
    uuid id PK
    uuid user_id FK
    uuid customer_id FK
    text title
    text event_type
    timestamptz start_at
    timestamptz end_at
    text status
  }

  notifications {
    uuid id PK
    uuid user_id FK
    text type
    text message
    boolean is_read
  }

  users {
    uuid id PK
    text email
    text display_name
  }
```

## customers

- 目的: 取引先会社情報を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `company_name`, `formal_name`, `industry`, `area`, `address`, `phone`, `website`, `email`, `inquiry_url`, `status`, `rank`, `score`, `tags`, `company_note`, `next_follow_up_date`, `last_contact_date`, `is_do_not_contact`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`
- 関連テーブル: `contacts`, `business_cards`, `deal_histories`, `quotes`, `samples`, `claims`, `attachments`, `events`, `notifications`
- Storage利用有無: なし
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `company_name`, `formal_name`, `industry`, `area`, `address`, `phone`, `website`, `email`, `tags`, `company_note`
- 今後追加予定項目: `corporate_number`, `company_size`, `annual_sales`, `employee_count`, `decision_flow`, `credit_note`

## contacts

- 目的: 会社に紐づく担当者情報を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `name`, `department`, `position`, `email`, `phone`, `mobile`, `has_decision_authority`, `position_score`, `memo`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `business_cards`, `deal_histories`, `quotes`, `samples`, `attachments`
- Storage利用有無: なし
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `name`, `department`, `position`, `email`, `phone`, `mobile`, `memo`
- 今後追加予定項目: `line_id`, `preferred_contact_method`, `birthday`, `influence_level`

## business_cards

- 目的: 名刺画像とOCR結果を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `contact_id`, `image_url`, `file_name`, `ocr_text`, `parsed_name`, `parsed_company`, `parsed_department`, `parsed_position`, `parsed_email`, `parsed_phone`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`, `contact_id -> contacts.id`
- 関連テーブル: `customers`, `contacts`, `attachments`
- Storage利用有無: あり。名刺画像をSupabase Storageに保存する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `ocr_text`, `parsed_name`, `parsed_company`, `parsed_department`, `parsed_position`, `parsed_email`, `parsed_phone`
- 今後追加予定項目: `ocr_provider`, `ocr_confidence`, `reviewed_at`, `reviewed_by`

## products

- 目的: 商品マスターを管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `name`, `category`, `manufacturer_name`, `origin`, `temperature_zone`, `package_style`, `cost_price`, `cost_unit`, `desired_selling_price`, `selling_price_unit`, `gross_margin_rate`, `description`, `memo`, `image_url`, `product_material_url`, `spec_sheet_url`, `tags`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`
- 関連テーブル: `quotes`, `samples`, `attachments`
- Storage利用有無: あり。商品画像、商品資料、スペックシートをSupabase Storageに保存する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `name`, `category`, `manufacturer_name`, `origin`, `temperature_zone`, `package_style`, `description`, `memo`, `tags`
- 今後追加予定項目: `jan_code`, `allergen_info`, `shelf_life`, `inventory_link_id`, `supplier_product_code`

## suppliers

- 目的: 国内仕入先と海外メーカー情報を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `name`, `country`, `supplier_type`, `contact_person`, `email`, `phone`, `website`, `products`, `incoterms`, `loading_port`, `currency`, `moq`, `lead_time`, `payment_terms`, `temperature_zone`, `tags`, `memo`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`
- 関連テーブル: `quotes`, `products`, `attachments`
- Storage利用有無: なし
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `name`, `country`, `supplier_type`, `contact_person`, `email`, `phone`, `website`, `products`, `incoterms`, `loading_port`, `currency`, `memo`, `tags`
- 今後追加予定項目: `factory_certifications`, `export_license`, `lead_time_note`, `quality_contact`, `sample_policy`

## projects

- 目的: 1つの取引先または仕入先に複数の営業案件・仕入案件を紐付け、商談、見積、サンプル、クレーム、予定、担当者を案件単位で管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `title`, `customer_id`, `supplier_id`, `contact_ids`, `type`, `status`, `priority`, `owner_user_id`, `product_ids`, `product_proposals`, `inventory_ids`, `quote_ids`, `sample_ids`, `complaint_ids`, `start_date`, `expected_close_date`, `next_action_date`, `expected_sales`, `expected_gross_profit`, `expected_operating_profit`, `memo`, `created_by`, `created_at`, `updated_at`
- 外部キー: 現時点では既存互換のためID文字列で保持。将来 `customers.id`, `suppliers.id`, `contacts.id`, `products.id`, `inventories.id`, `quotes.id`, `samples.id`, `claims.id` へ外部キー化を検討する。
- 関連テーブル: `customers`, `suppliers`, `contacts`, `products`, `inventories`, `quotes`, `samples`, `claims`, `events`, `attachments`
- Storage利用有無: なし。案件添付は `attachments.project_id` または `owner_type = project` でStorage URLのみ保持する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `title`, `type`, `status`, `priority`, `memo`, 関連する取引先名、仕入先名
- 今後追加予定項目: `lost_reason`, `probability`, `actual_sales`, `actual_gross_profit`, `actual_operating_profit`, `closed_at`, `updated_by`, `updated_by_name`

### projects.product_proposals

- 目的: 案件単位で複数商品の提案・採用進捗、見込数量、想定売価、原価、利益、採用/不採用理由、競合商品を管理する。
- 保存形式: `jsonb` 配列。1要素は `id`, `productId`, `status`, `monthlyExpectedQuantity`, `annualExpectedQuantity`, `unit`, `expectedSellingPrice`, `expectedCost`, `expectedExpense`, `expectedGrossProfit`, `expectedOperatingProfit`, `expectedRealProfit`, `reasonCategory`, `adoptionReason`, `rejectionReason`, `competitorProduct`, `memo`, `createdAt`, `updatedAt` を持つ。
- 関連テーブル: `projects`, `products`
- RLS有無: `projects` のRLSに従う。

## quotes

- 目的: 顧客への見積履歴と関連ファイルを管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `supplier_id`, `product_ids`, `contact_ids`, `quote_number`, `submitted_date`, `valid_until`, `currency`, `total_amount`, `gross_margin_rate`, `status`, `file_url`, `file_name`, `memo`, `lost_reason`, `created_by`, `created_by_name`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`, `supplier_id -> suppliers.id`
- 関連テーブル: `customers`, `suppliers`, `products`, `contacts`, `attachments`, `notifications`
- Storage利用有無: あり。見積PDFや関連資料をSupabase Storageに保存する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `quote_number`, `status`, `file_name`, `memo`, `lost_reason`, `created_by_name`
- 今後追加予定項目: `approval_status`, `approved_by`, `sent_at`, `mail_log_id`, `revision_number`

## samples

- 目的: サンプル発送、到着、評価、採用状況を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `contact_ids`, `product_ids`, `sample_name`, `shipped_date`, `arrival_date`, `follow_up_date`, `status`, `feedback`, `next_action`, `shipping_method`, `tracking_number`, `memo`, `created_by`, `created_by_name`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `contacts`, `products`, `notifications`, `attachments`
- Storage利用有無: なし。必要に応じて関連資料は `attachments` で管理する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `sample_name`, `status`, `feedback`, `next_action`, `shipping_method`, `tracking_number`, `memo`, `created_by_name`
- 今後追加予定項目: `temperature_condition`, `delivery_company`, `adoption_id`, `sample_cost`, `sample_quantity`

## deal_histories

- 目的: 商談履歴を監査ログとして管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `contact_ids`, `date`, `type`, `summary`, `next_action`, `created_by`, `created_by_name`, `companion_users`, `companion_names`, `replies`, `has_claim`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `contacts`, `quotes`, `samples`, `claims`, `attachments`
- Storage利用有無: なし。音声や資料は `attachments` で管理する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `type`, `summary`, `next_action`, `created_by_name`, `companion_names`, `replies`
- 今後追加予定項目: `meeting_start_at`, `meeting_end_at`, `location`, `voice_file_url`, `ai_minutes_id`

## claims

- 目的: クレーム履歴と対応状況を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `contact_ids`, `claim_type`, `content`, `occurred_date`, `status`, `cause`, `prevention`, `due_date`, `resolved_date`, `created_by`, `created_by_name`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `contacts`, `deal_histories`, `attachments`, `notifications`
- Storage利用有無: なし。証跡画像や資料は `attachments` で管理する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `claim_type`, `content`, `status`, `cause`, `prevention`, `created_by_name`
- 今後追加予定項目: `severity`, `internal_owner`, `supplier_id`, `quality_report_url`, `recurrence_risk`

## attachments

- 目的: 顧客、担当者、商品、仕入先、商談、見積、クレームに紐づくファイルメタ情報を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `contact_id`, `product_id`, `supplier_id`, `quote_id`, `sample_id`, `deal_history_id`, `claim_id`, `file_url`, `file_name`, `file_type`, `file_size`, `storage_path`, `uploaded_by`, `uploaded_by_name`, `uploaded_at`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`, `contact_id -> contacts.id`, `product_id -> products.id`, `supplier_id -> suppliers.id`, `quote_id -> quotes.id`, `sample_id -> samples.id`, `deal_history_id -> deal_histories.id`, `claim_id -> claims.id`
- 関連テーブル: `customers`, `contacts`, `products`, `suppliers`, `quotes`, `samples`, `deal_histories`, `claims`
- Storage利用有無: あり。ファイル本体はSupabase Storage、DBにはURLとメタ情報のみ保存する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `file_name`, `file_type`, `uploaded_by_name`
- 今後追加予定項目: `preview_url`, `thumbnail_url`, `checksum`, `retention_policy`, `virus_scan_status`

## events

- 目的: カレンダー予定、商談予定、フォロー予定、延期・完了状態を管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `title`, `event_type`, `customer_id`, `contact_ids`, `deal_id`, `location`, `start_at`, `end_at`, `all_day`, `priority`, `color`, `memo`, `next_follow_date`, `reminder`, `status`, `postponed_from_event_id`, `completed_at`, `created_by`, `created_by_name`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `contacts`, `deal_histories`, `notifications`
- Storage利用有無: なし。資料や画像は `attachments` で管理する。
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `title`, `event_type`, `location`, `memo`, `status`, `created_by_name`
- 今後追加予定項目: `external_calendar_id`, `recurrence_rule`, `attendee_user_ids`, `reminder_sent_at`

## notifications

- 目的: ホーム画面に表示する通知や未対応タスクを管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `related_table`, `related_id`, `type`, `title`, `message`, `due_date`, `priority`, `is_read`, `created_at`, `updated_at`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`
- 関連テーブル: `customers`, `quotes`, `samples`, `claims`, `deal_histories`
- Storage利用有無: なし
- RLS有無: あり。`auth.uid() = user_id`
- 検索対象項目: `type`, `title`, `message`, `priority`
- 今後追加予定項目: `snoozed_until`, `action_url`, `resolved_at`, `resolved_by`

## users

- 目的: Supabase Authユーザーに紐づくアプリ内プロフィールを管理する。
- 主キー: `id`
- 主要カラム: `id`, `email`, `display_name`, `avatar_url`, `role`, `created_at`, `updated_at`
- 外部キー: `id -> auth.users.id`
- 関連テーブル: `customers`, `contacts`, `business_cards`, `products`, `suppliers`, `quotes`, `samples`, `deal_histories`, `claims`, `attachments`, `events`, `notifications`
- Storage利用有無: あり。プロフィール画像を使用する場合のみSupabase Storageに保存する。
- RLS有無: あり。`auth.uid() = id`
- 検索対象項目: `email`, `display_name`, `role`
- 今後追加予定項目: `department`, `position`, `team_id`, `notification_settings`, `default_signature`

## 保存先

### Database

- 会社情報
- 担当者
- 商談
- 見積
- サンプル
- クレーム
- 予定

### Storage

- 商品画像
- 名刺画像
- 見積PDF
- 音声
- 添付資料

## 今後追加予定テーブル

- mail_logs
- line_logs
- ai_logs
- sales_reports
- inventory_links

---

## Step26 追記: 在庫・見積PDF・営業データ集約

### 追加予定テーブル: inventories

- 目的: 商品ごとの在庫状態を管理する。
- 主キー: `id`
- 主要カラム:
  - `user_id`
  - `product_id`
  - `supplier_id`
  - `inventory_status`
  - `current_stock`
  - `reserved_stock`
  - `available_stock`
  - `reorder_point`
  - `unit`
  - `warehouse_location`
  - `lot_number`
  - `expiry_date`
  - `next_arrival_date`
  - `memo`
  - `created_by`
  - `created_at`
  - `updated_at`
- 外部キー:
  - `product_id` -> `products.id`
  - `supplier_id` -> `suppliers.id`
  - `user_id` -> `auth.users.id`
- 関連テーブル:
  - `products`
  - `suppliers`
  - `quotes`
  - `samples`
  - `adoptions`
- Storage利用有無: なし
- RLS有無: あり。`auth.uid() = user_id` のデータのみアクセス可能。
- 検索対象項目:
  - 商品名
  - 仕入先名
  - 在庫ステータス
  - ロット番号
  - 倉庫・保管場所
- 今後追加予定項目:
  - 入出庫履歴
  - 複数倉庫
  - 温度帯別在庫
  - 賞味期限アラート

### 追加予定テーブル: inventory_movements

- 目的: 在庫の入出庫履歴を監査ログとして保持する。
- 主キー: `id`
- 主要カラム:
  - `user_id`
  - `inventory_id`
  - `product_id`
  - `movement_type`
  - `quantity`
  - `unit`
  - `movement_date`
  - `reason`
  - `related_quote_id`
  - `related_sample_id`
  - `created_by`
  - `created_by_name`
  - `created_at`
- 外部キー:
  - `inventory_id` -> `inventories.id`
  - `product_id` -> `products.id`
  - `related_quote_id` -> `quotes.id`
  - `related_sample_id` -> `samples.id`
- 関連テーブル:
  - `inventories`
  - `products`
  - `quotes`
  - `samples`
- Storage利用有無: なし
- RLS有無: あり
- 検索対象項目:
  - 入出庫種別
  - 理由
  - 商品
  - ロット番号
- 今後追加予定項目:
  - 棚卸差異
  - 自動引当
  - ERP/WMS連携

### quotes 拡張: 見積PDF

見積PDF対応のため、`quotes` には以下のメタ情報を持たせる。

- `pdf_url`
- `pdf_storage_path`
- `pdf_file_name`
- `pdf_generated_at`
- `pdf_generated_by`
- `pdf_version`
- `pdf_status`

PDF本体はStorageに保存し、DBにはURLとメタ情報のみ保存する。

### 追加予定テーブル: dashboard_snapshots

- 目的: 経営判断ダッシュボード用の集計結果を任意で保存する。
- 主キー: `id`
- 主要カラム:
  - `user_id`
  - `snapshot_date`
  - `period_type`
  - `metrics`
  - `created_at`
- 外部キー:
  - `user_id` -> `auth.users.id`
- 関連テーブル:
  - `customers`
  - `deal_histories`
  - `quotes`
  - `samples`
  - `claims`
  - `products`
  - `inventories`
- Storage利用有無: なし
- RLS有無: あり
- 検索対象項目:
  - 集計期間
  - 作成日
- 今後追加予定項目:
  - 売上実績
  - 粗利実績
  - 担当者別KPI
  - 部署別KPI

### Storage追加方針

- 見積PDF: `quote-pdfs` または `app-attachments/quotes/`
- 在庫関連資料: `app-attachments/inventory/`
- ダッシュボード出力: `app-attachments/reports/`

### Mermaid ER図 追記

```mermaid
erDiagram
  products ||--o{ inventories : has
  suppliers ||--o{ inventories : supplies
  inventories ||--o{ inventory_movements : logs
  customers ||--o{ quotes : receives
  quotes ||--o{ attachments : has_pdf
  products ||--o{ quotes : quoted_in
  customers ||--o{ samples : receives
  products ||--o{ samples : sampled_in
  customers ||--o{ dashboard_snapshots : aggregated_for
```

---

## Step34 追記: quotes 見積作成・PDF出力

Version1.0の見積作成では、`quotes` を見積ヘッダー、見積明細、PDFメタ情報の保存先として扱う。

- 目的: 顧客ごとの見積作成、再編集、PDF再出力、採用/失注管理を行う。
- 主キー: `id`
- 主要カラム: `user_id`, `customer_id`, `supplier_id`, `project_name`, `quote_number`, `issue_date`, `submitted_date`, `valid_until`, `status`, `quote_lines`, `product_ids`, `contact_ids`, `inventory_ids`, `freight`, `discount`, `tax_rate`, `subtotal`, `tax_amount`, `total_amount`, `grand_total`, `inventory_cost_total`, `gross_margin_amount`, `gross_margin_rate`, `payment_terms`, `delivery_terms`, `remarks`, `lost_reason`, `pdf_url`, `pdf_file_name`, `pdf_storage_path`, `pdf_generated_at`, `pdf_history`, `submitted_at`, `accepted_at`, `created_by`, `created_by_name`, `updated_by`, `updated_by_name`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`, `supplier_id -> suppliers.id`
- 関連テーブル: `customers`, `contacts`, `products`, `suppliers`, `inventories`, `attachments`
- Storage利用有無: あり。PDF本体と任意添付はSupabase Storageへ保存し、DBにはURLとpathのみ保存する。
- RLS有無: あり。`auth.uid() = user_id` のデータのみアクセス可能にする。
- 検索対象項目: `quote_number`, `project_name`, `status`, `memo`, `remarks`, `created_by_name`
- 今後追加予定項目: `revision_number`, `approval_status`, `approved_by`, `sent_at`, `mail_log_id`
---

## Step35 追記: 経費控除後利益ダッシュボード

経営ダッシュボードで粗利だけでなく、諸経費控除後の営業利益と実質利益を確認するため、`quotes` に経費項目と按分設定を追加する。

### quotes 拡張: 経費・利益管理

- 目的: 見積単位で直接経費と共通経費を保持し、顧客別、商品別、案件別、見積別、在庫別、仕入先別、月別の利益集計に利用する。
- 主キー: `id`
- 追加カラム:
  - `storage_fee`: 保管料
  - `customs_fee`: 通関費
  - `inspection_fee`: 検品費
  - `processing_fee`: 加工費
  - `sales_commission`: 販売手数料
  - `disposal_loss`: 廃棄損
  - `fx_gain_loss`: 為替差損益
  - `other_expense`: その他経費
  - `common_expense_amount`: 共通経費
  - `allocation_basis`: 共通経費の按分基準。`sales`, `quantity`, `weight`
  - `expense_memo`: 経費メモ、按分根拠、社内共有事項
- 既存カラム利用: `freight`, `discount`, `inventory_cost_total`, `gross_margin_amount`, `gross_margin_rate`, `quote_lines`
- 外部キー: `user_id -> users.id`, `customer_id -> customers.id`, `supplier_id -> suppliers.id`
- 関連テーブル: `customers`, `contacts`, `products`, `suppliers`, `inventories`, `attachments`
- Storage利用有無: なし。証憑ファイルがある場合は既存の `attachments` / Storage を利用する。
- RLS有無: あり。`auth.uid() = user_id` のデータのみアクセス可能にする。
- 検索対象項目: `quote_number`, `project_name`, `status`, `expense_memo`, `created_by_name`
- 今後追加予定項目: `quote_expenses`, 共通経費配賦履歴, 入庫ロット単位の原価差異, 会計システム連携

### 集計ルール

- 売上 = `subtotal` または `total_amount`
- 商品原価 = `inventory_cost_total` または明細の `costPrice * quantity`
- 粗利額 = 売上 - 商品原価
- 諸経費合計 = 運賃 + 保管料 + 通関費 + 検品費 + 加工費 + 販売手数料 + その他経費 + 共通経費
- 営業利益 = 粗利額 - 諸経費合計
- 実質利益 = 営業利益 + 為替差損益 - 値引 - 廃棄損
- 利益率 = 対象利益 ÷ 売上 × 100

### 共通経費按分

`common_expense_amount` は `allocation_basis` により明細へ配賦する。

- `sales`: 明細売上額比
- `quantity`: 数量比
- `weight`: 重量比。重量未入力の場合は数量を代替値とする。

按分結果はダッシュボード集計時に計算し、元データは変更しない。
## 追記: products.product_code

- 目的: 商品マスターの任意の商品コードを管理する。
- カラム: `products.product_code text`
- 入力ルール: 空欄可。入力する場合は半角英数字と記号のみ。日本語、全角文字、空白、前後空白は不可。
- 一意制約: `products_user_product_code_unique_idx` により `user_id + lower(product_code)` を部分unique化する。空欄/NULLは複数許可する。
- CHECK制約: `products_product_code_ascii_check` により使用可能文字と前後空白なしをDB側でも検証する。
- 検索対象: 商品名に加えて `product_code` を検索対象に含める。
- 関連付け: 見積、在庫、案件別商品提案などの関連付けは従来どおり `productId` / `product_id` を使用する。
## 追記: inventories.inventory_code

- 目的: 在庫レコードごとの任意の固有番号を管理し、現物識別・帳票表示・検索に使う。
- カラム: `inventories.inventory_code text`
- 入力ルール: 空欄可。入力する場合は半角英数字と記号のみ。日本語、全角文字、空白、前後空白は不可。
- 一意制約: `inventories_user_inventory_code_unique_idx` により `user_id + lower(inventory_code)` を部分unique化する。空欄/NULLは複数許可する。
- CHECK制約: `inventories_inventory_code_ascii_check` により使用可能文字と前後空白なしをDB側でも検証する。
- 検索対象: 商品名、商品コード、在庫コード、LOT、所有者。
- 関連付け: 見積、案件、商品との内部紐付けは従来どおり `inventoryId` / `inventory_id` を使用する。
## 追記: 業務コード体系

- 対象: `customers.customer_code`, `suppliers.supplier_code`, `projects.project_code`, `products.product_code`, `inventories.inventory_code`, `quotes.quote_number`
- 用途: バーコード、QR、CSV、ERP/WMS、見積PDF、現物識別で使う任意の業務用識別コード。
- 採番: 自動採番はしない。ユーザーが任意入力する。
- 空欄: 既存データは空欄のまま維持し、空欄/NULLは複数許可する。
- 重複: 入力済みコードは `user_id + lower(code)` の部分unique indexで大文字小文字を区別せず重複不可にする。
- 形式: 半角英数字と記号のみ。日本語、全角文字、空白は不可。保存時は前後空白を除去する。
- 内部関連付け: 既存の `id`, `productId`, `inventoryId`, `customerId`, `supplierId`, `projectId`, `quoteId` を維持する。業務コードは表示、検索、帳票、外部連携用とする。
- 追加migration: `20260715000200_add_business_codes.sql`
## 追加: 見積発行元マスター issuers

- 目的: 複数の所属会社・事業体を見積発行元として管理し、見積ごとに切り替える。
- 主キー: `id`
- 主要カラム: `user_id`, `name`, `legal_name`, `logo_url`, `logo_storage_path`, `address`, `phone`, `email`, `registration_number`, `bank_account`, `contact_person`, `seal_url`, `seal_storage_path`, `default_tax_rate`, `default_payment_terms`, `default_delivery_terms`, `default_remarks`, `default_pdf_template`, `is_default`, `is_active`, `created_at`, `updated_at`
- 関連テーブル: `quotes`, `customers`, `projects`
- Storage利用有無: あり。ロゴは `app-attachments/{user_id}/issuers/{issuer_id}/logos/`、印影は `app-attachments/{user_id}/issuers/{issuer_id}/seals/` に保存し、DBにはURLとpathのみ保存する。
- RLS有無: あり。`auth.uid() = user_id` のデータのみselect/insert/update/delete可能。
- 検索対象項目: `name`, `legal_name`, `registration_number`, `contact_person`
- `quotes` 追加項目: `project_id`, `issuer_id`, `issuer_snapshot`, `pdf_template`
- `customers` / `projects` 追加項目: `default_issuer_id`
- 追加migration: `20260716000100_add_quote_issuers.sql`
