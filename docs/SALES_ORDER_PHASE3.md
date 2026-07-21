# 受注管理 Phase 3: 出荷管理

## 目的

受注から出荷を登録し、在庫引当済みロットを基に出荷確定できるようにする。

Phase 3では出荷管理までを対象とし、納品書PDF、送り状発行、配送会社API、請求連携は対象外とする。

## 対象テーブル

### shipments

- 目的: 受注に紐づく出荷ヘッダーを管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `shipment_number`, `sales_order_id`, `customer_id`, `status`, `shipment_date`, `planned_delivery_date`, `carrier`, `tracking_number`, `delivery_address_snapshot`, `note`, `shipped_at`, `cancelled_at`, `status_history`, `created_at`, `updated_at`
- RLS: authenticated かつ `auth.uid() = user_id`
- ステータス: `Draft`, `Picking`, `Ready`, `Shipped`, `Cancelled`

### shipment_lines

- 目的: 出荷明細をロット、引当、受注明細単位で管理する。
- 主キー: `id`
- 主要カラム: `user_id`, `shipment_id`, `sales_order_line_id`, `inventory_reservation_id`, `inventory_lot_id`, `product_id`, `quantity`, `unit`, `lot_snapshot`, `expiry_snapshot`, `created_at`
- RLS: authenticated かつ `auth.uid() = user_id`

## 受注追加カラム

### sales_orders

- `shipment_status`: `unshipped`, `partial`, `shipped`
- `shipped_total`: 出荷済数量合計

### sales_order_lines

- `shipped_quantity`: 明細ごとの出荷済数量
- `remaining_quantity`: 明細ごとの残数量
- `shipment_status`: `unshipped`, `partial`, `shipped`

## RPC

出荷処理は必ずRPCで行い、フロントエンドから在庫・引当・履歴を複数updateしない。

- `generate_shipment_number`: `SHP-YYYYMMDD-000001` 形式で採番する。
- `create_sales_order_shipment`: 受注と引当済み数量から出荷を作成する。
- `update_sales_order_shipment_status`: `Picking`, `Ready`, `Shipped`, `Cancelled` へ状態変更する。
- `refresh_sales_order_shipment_status`: 出荷済数量から受注の出荷状態を再集計する。

## 在庫連携

- `Draft`, `Picking`, `Ready` では在庫数量を減算しない。
- `Shipped` になった時だけ `inventory_lots.quantity` を減算する。
- `Shipped` になった時だけ `inventory_reservations.fulfilled_quantity` を増やす。
- 出荷確定時に `inventory_movements.movement_type = shipment` を記録する。
- 出荷取消時に `inventory_movements.movement_type = shipment_cancel` を記録する。
- マイナス在庫、引当超過、受注数量超過は禁止する。

## UI

- 受注一覧に出荷状況を表示する。
- 受注詳細に出荷セクションを追加する。
- 受注詳細から全量出荷、一部出荷、ステータス変更、取消を実行できる。
- 出荷一覧では出荷番号、受注番号、顧客、出荷日、納品予定、ステータス、数量、配送会社、追跡番号を確認できる。
- 出荷詳細ではピッキングリストを表示する。

## 今回対象外

- 納品書PDF
- 送り状発行
- 配送会社API連携
- 請求書連携
- 帳票センター
