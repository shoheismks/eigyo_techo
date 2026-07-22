# 顧客別価格マスター

## 目的

商品ごと・顧客ごとの販売単価を管理し、見積、成約確認書、受注、出荷、納品書へ作成時点の価格情報をスナップショットとして残す。

## 基本方針

- 内部の関連付けは商品コードではなく `product_id` を使う。
- 顧客別価格は商品マスターの希望販売価格より優先する。
- 価格は税抜単価として扱う。
- 過去帳票は作成時点の価格スナップショットを使い、後から価格マスターを変更しても変えない。
- 価格マスターは論理削除と無効化で履歴を保持する。

## DB

### customer_product_prices

- `id`
- `user_id`
- `customer_id`
- `parent_customer_id`
- `product_id`
- `brand_id`
- `price_type`
- `unit_price`
- `price_unit`
- `currency`
- `tax_rate`
- `minimum_quantity`
- `maximum_quantity`
- `valid_from`
- `valid_to`
- `priority`
- `notes`
- `apply_to_child_customers`
- `office_scope`
- `case_price`
- `kg_price`
- `piece_price`
- `pack_price`
- `is_active`
- `deleted_at`
- `created_at`
- `updated_at`

### customer_product_price_history

- `id`
- `user_id`
- `customer_product_price_id`
- `action`
- `before_data`
- `after_data`
- `reason`
- `changed_by`
- `created_at`

## 価格解決優先順位

1. 該当拠点の顧客別価格
2. 本社価格を配下拠点へ適用する設定
3. 企業グループ価格
4. 商品マスターの希望販売価格
5. 価格なし

同一条件に複数価格がある場合は、期間指定、数量条件、優先度、更新日時の順で候補を決める。完全に競合する場合は警告を表示する。

## 見積・受注への保存

見積明細と受注明細には、作成時点の以下を保存する。

- `original_unit_price`
- `price_source`
- `price_type`
- `price_master_id`
- `price_unit`
- `price_valid_from`
- `price_valid_to`
- `price_matched_rule`
- `price_warning`
- `is_manual_price`
- `price_override_reason`
- `price_overridden_at`

手動で単価を変更した場合は `is_manual_price = true` として、以後の数量変更で自動上書きしない。

## UI

- 顧客別価格マスター画面で登録、編集、複製、無効化、削除、履歴確認を行う。
- 検索対象は顧客、商品、商品コード、メーカー、カテゴリー、ブランド、メモ。
- PCはテーブル、スマホはカードで表示する。

## RLS

`auth.uid() = user_id` の行のみアクセス可能にする。`anon` 全許可は禁止する。

## Backup / Restore

以下をバックアップ対象に含める。

- `customerProductPrices`
- `customerProductPriceHistory`

旧バックアップに顧客別価格がなくても復元できるように、空配列として扱う。

## 今後の拡張

- CSV/Excelインポート
- 顧客カルテと商品詳細での価格一覧強化
- 価格改定通知
- 価格承認フロー
- ERP/WMS連携
