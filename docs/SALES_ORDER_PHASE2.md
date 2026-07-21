# 受注管理 Phase 2

## 目的

受注と在庫ロットを連携し、受注明細単位で在庫引当を行う。

## 対象範囲

- `sales_orders` と `inventory_reservations` の連携
- 受注明細ごとの引当
- FEFO自動引当
- ロット指定引当
- 一部引当
- 引当解除
- 再引当
- 受注詳細の在庫状況カード
- 受注詳細の在庫引当セクション
- 受注一覧の引当状況表示

## 対象外

- 出荷
- 納品書
- 請求連携
- 帳票センター

## DB変更

### sales_orders

- `priority`: 1から5。既定値は3。
- `reservation_status`: `unreserved`, `partial`, `reserved`, `shortage`
- `reserved_total`: 受注全体の引当済数量
- `shortage_total`: 受注全体の未引当数量

### sales_order_lines

- `reserved_quantity`: 明細ごとの引当済数量
- `shortage_quantity`: 明細ごとの未引当数量
- `reservation_status`: `unreserved`, `partial`, `reserved`, `shortage`

### inventory_reservations

- `sales_order_line_id`: 受注明細ID。受注明細単位の引当に使用する。

## RPC

### `reserve_sales_order_line_fefo`

受注明細の未引当数量を、FEFO順で引当する。

FEFO順:

1. 賞味期限が近い順
2. 同じ場合は入庫日順
3. 最後は作成日順

除外対象:

- 期限切れ
- 隔離ロット
- 使用可能在庫0
- 削除済みロット

### `reserve_sales_order_line_lot`

指定ロットから受注明細へ引当する。

### `release_sales_order_line_reservations`

受注明細の引当を解除する。

### `reallocate_sales_order_line_fefo`

既存引当を勝手に解除せず、不足分をFEFOで追加引当する。

### `reserve_sales_order_fefo`

1受注内の全明細をFEFOで引当する。

### `reserve_sales_orders_fefo`

未完了受注を以下の順で一括引当する。

1. `priority`
2. `expected_delivery_date`
3. `order_date`

既存引当は解除しない。

## トランザクション方針

引当・解除はRPC内で実行する。フロントから複数テーブルを直接連続更新しない。

RPC内で対象ロットを `for update` / `for update skip locked` でロックし、同時更新によるマイナス在庫と二重引当を防ぐ。

## RLS

既存方針を維持する。

- `authenticated` のみ
- `auth.uid() = user_id`

## UI

- 受注一覧に引当状況を表示する。
- 受注詳細に在庫状況カードを表示する。
- 受注明細ごとに、受注数量、引当済、未引当、使用可能在庫、不足数量を表示する。
- 不足数量は赤色で表示する。
- 優先度を編集できる。
- スマホではカード表示を維持する。

## 今後

- 在庫引当から出荷へ連携
- 納品書作成
- 請求書連携
- 引当変更の詳細監査ログ強化
