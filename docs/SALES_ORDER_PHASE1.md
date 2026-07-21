# 受注管理 Phase 1

## 目的

見積書または成約確認書を基に、受注内容を営業手帳へ保存する。
元帳票を後から変更しても、受注作成時点の内容が変わらないようにスナップショット保存する。

## 対象範囲

- 受注一覧
- 受注作成
- 受注詳細
- 見積書から受注作成
- 成約確認書から受注作成
- 顧客カルテ、案件詳細への受注導線
- 受注変更履歴
- 論理削除
- バックアップ/復元対象への追加

## Phase 1 では実装しない

- 在庫引当
- 出荷
- 納品書
- 請求書連携
- 帳票センター

## DB構造

### sales_orders

- `id`: 主キー
- `user_id`: Supabase AuthのユーザーID
- `sales_order_number`: 受注番号。発行元ごとに `SO-YYYY-000001` 形式で採番
- `issuer_id`: 発行元ID
- `issuer_snapshot`: 受注作成時点の発行元情報
- `customer_id`: 顧客ID
- `customer_snapshot`: 受注作成時点の顧客情報
- `contact_id`: 顧客担当者ID
- `project_id`: 案件ID
- `quote_id`: 元見積ID
- `confirmation_quote_id`: 元成約確認書に相当する見積ID
- `source_type`: `manual` / `quote` / `confirmation`
- `source_snapshot`: 元見積または元成約確認書のスナップショット
- `subject`: 件名
- `order_date`: 受注日
- `expected_delivery_date`: 納品予定日
- `status`: `下書き` / `受注確定` / `変更中` / `完了` / `取消`
- `subtotal`, `tax_amount`, `grand_total`: 金額
- `is_deleted`, `deleted_at`: 論理削除

### sales_order_lines

受注明細を商品単位で保存する。
内部連携は `product_id` と `inventory_id` を使用し、商品コードや在庫コードは表示用スナップショットとして保持する。

### sales_order_history

受注作成、更新、ステータス変更、取消の履歴を保存する。
確定後の変更も `before_snapshot` / `after_snapshot` で追跡する。

## RLS

3テーブルすべてでRLSを有効化し、`authenticated` かつ `auth.uid() = user_id` の場合のみアクセスできる。

## 画面導線

- 受注一覧: サイドバーの「受注」から表示
- 見積書から受注: 受注一覧の「見積から作成」、顧客カルテの見積カード
- 成約確認書から受注: 受注一覧の「成約確認書から作成」、顧客カルテの成約済み見積カード
- 案件詳細から受注: 案件編集パネルの「この案件で受注作成」
- 顧客カルテから受注: 上部主要ボタン「受注作成」

## スナップショット保存

受注作成時に以下をコピーする。

- 元見積または成約確認書全体: `sales_orders.source_snapshot`
- 発行元情報: `sales_orders.issuer_snapshot`
- 顧客情報: `sales_orders.customer_snapshot`
- 明細ごとの元データ: `sales_order_lines.source_line_snapshot`

これにより、元帳票やマスターを後から変更しても過去の受注内容は変わらない。

## 重複警告

同じ `quote_id` または `confirmation_quote_id` から既に受注がある場合、保存フォーム上に警告を表示する。
Phase 1では業務判断を優先し、警告後の保存自体は可能とする。

## 今後の拡張

- 在庫引当
- 出荷指示
- 納品書
- 請求書連携
- 受注PDF
- 承認フロー
- 受注ステータス別ダッシュボード
