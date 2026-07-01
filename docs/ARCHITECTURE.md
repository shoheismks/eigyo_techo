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
