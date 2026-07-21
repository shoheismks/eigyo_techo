# 営業手帳 システム構成

営業手帳は食品業界向け営業CRMである。

目的は以下である。

- 営業活動の効率化
- 営業情報の資産化
- AI営業支援
- PC・スマホ同期
- 食品営業に特化したCRM

## システム構成

```text
React
↓
Vite
↓
Supabase
├ Database
├ Auth
└ Storage

Chrome Extension

将来
├ OpenAI API
└ LINE Messaging API
```

## 画面構成

- Home
- Customers
- Customer Karte
- Contacts
- Business Cards
- Deals
- Products
- Suppliers
- Quotes
- Samples
- Claims
- Calendar
- Dashboard
- Settings

## データ構造

```text
Company
│
├ Contact
│   ├ Business Card
│   ├ Deal History
│   ├ Quote
│   ├ Sample
│   ├ Claim
│   └ Communication
│
├ Product
│
├ Attachment
│
└ Timeline
```

## 主要モジュール

- customers
- contacts
- businessCards
- products
- suppliers
- quotes
- samples
- claims
- dashboard
- calendar
- ai
- settings
- shared

## データフロー

```text
Chrome Extension
↓
Company登録
↓
担当者登録
↓
名刺OCR
↓
商談
↓
見積
↓
サンプル
↓
採用
↓
フォロー
↓
AI分析
```

## AI構成

将来追加予定のAI機能は以下である。

- AI営業秘書
- AIメール
- AI商談準備
- AI議事録
- AI商品提案
- AI分析

AIは独立モジュールとし、OpenAI APIへ接続しやすい構成にする。

## Storage

Storage保存対象は以下である。

- 商品画像
- 商品資料
- スペックシート
- 名刺画像
- 音声
- 見積
- 添付ファイル

DBにはURLのみ保存する。

## 認証

- Supabase Auth
- Email Login

将来追加予定:

- Google Login

## PC版

- Sidebar
- Table
- Dashboard
- 2〜3カラム
- 全画面

## スマホ版

- Bottom Navigation
- 5タブ
- カードUI
- 現場入力重視

## 検索

検索対象は以下である。

- 会社
- 担当者
- 商品
- 仕入先
- 商談
- クレーム
- サンプル
- 見積
- タグ

全文検索へ拡張可能な構成にする。

## 今後追加予定

- LINE連携
- 音声議事録
- AI営業
- 売上分析
- 粗利分析
- 営業KPI
- 商談分析
- 活動分析

## ディレクトリ構成

```text
src/
├ modules/
│  ├ customers
│  ├ contacts
│  ├ businessCards
│  ├ products
│  ├ suppliers
│  ├ quotes
│  ├ samples
│  ├ claims
│  ├ dashboard
│  ├ calendar
│  ├ ai
│  └ settings
├ shared/
│  ├ components
│  ├ hooks
│  ├ utils
│  └ services
├ layouts
└ lib

docs
```

## 設計方針

- 責務を分離する。
- 機能単位でmodule化する。
- 共通部品はsharedへ置く。
- 巨大コンポーネントを作らない。
- 既存機能を壊さない。
- 後方互換を維持する。
- 必要時のみデータ取得する。
- Storageは遅延取得する。
- PC・スマホを別UIとして設計する。

## 最後

今後の実装は、この `ARCHITECTURE.md` を設計書として参照する。

---

## Step26 追記: 在庫・見積PDF・営業データ集約

### 追加モジュール

- `inventory`
  - 商品ごとの在庫状態、数量、ロット、有効期限、倉庫・保管場所、入荷予定を管理する。
  - 仕入先、商品、見積、サンプル、採用品と連携する。
  - 食品営業で重要な「提案できる在庫か」「期限が近いか」「欠品中か」を判断できる構成にする。
- `quotes`
  - 既存の見積履歴に加えて、見積PDF生成・保存・履歴管理を扱う。
  - PDF本体はStorage、DBにはURL・ファイル名・生成日時・版数などのメタ情報のみ保存する。
- `dashboard`
  - 営業活動、見積、サンプル、採用、クレーム、在庫、粗利を集約する。
  - 経営判断ダッシュボードとして、営業KPI・案件状況・粗利・在庫リスクを確認できるようにする。
- `invoices`
  - 成約確認書または見積書から請求書を作成・保存・PDF出力する。
  - 入金履歴、未入金額、期限超過、取消履歴を管理する。
  - 顧客、案件、見積、成約確認書、発行元と関連付け、作成時点のsnapshotで過去文書の再現性を守る。

### 追加サービス

- `quotePdfService`
  - 見積データ、顧客情報、商品情報から見積PDFを生成するためのサービス。
  - 初期実装ではテンプレート生成、将来はPDFライブラリやサーバーサイド生成へ差し替え可能にする。
  - 自動送信は行わず、生成・確認・保存までを担当する。
- `dashboardService`
  - 顧客、担当者、商談、見積、サンプル、採用、クレーム、在庫データを集約する。
  - UIから直接集計ロジックを書かず、集計処理はこのサービスへ分離する。
  - 将来、Supabase View / RPC / Edge Functions に移行しやすい構成にする。
- `invoicePdfService`
  - 請求書データ、顧客情報、発行元情報、振込先、税率別集計から顧客向けPDFを生成する。
  - 社内原価、粗利、営業利益、実質利益は請求書PDFへ表示しない。
  - PDF本体はStorageへ保存し、DBにはURLとメタ情報のみ保存する。

### 在庫ステータス

- 未連携
- 在庫あり
- 残少
- 欠品
- 入荷待ち
- 取扱停止
- 要確認

### 見積PDF

- PDF本体はSupabase Storageに保存する。
- DBにはURL、Storage path、ファイル名、生成日時、生成者、版数、ステータスのみ保存する。
- 確定済みPDFは上書きせず、新しい版として保存する。
- 将来、承認フロー・送信履歴・電子署名に拡張できるようにする。

### 経営判断ダッシュボード

- 顧客数、担当者数、商談数
- ステータス別案件数
- 見積提出額、採用額、失注額
- 粗利率、粗利額
- サンプル評価状況
- クレーム未対応件数
- 在庫リスク商品
- 高重要度顧客
- フォロー期限切れ

一覧画面では詳細データを読み込まず、必要な集計値のみ取得する。
---

## 追記: 在庫正規化アーキテクチャ

在庫管理は旧 `inventories` から以下の正規化構造へ段階移行する。

```text
Product
└ Inventory Lot
   ├ Inventory Movement
   ├ Inventory Reservation
   └ Stocktake Line

Stocktake
└ Stocktake Line
```

UI互換のため、フロントでは `useInventory` が新テーブルを読み込み、既存画面へは従来の `inventories` 配列形式で提供する。新規入庫、出庫、棚卸、引当はRPCを経由する。旧 `inventories` は移行期間中のみ残す。
