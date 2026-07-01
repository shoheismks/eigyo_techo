# プロジェクト概要

営業手帳は食品業界向け営業CRMである。

目的は

・営業活動の効率化
・情報共有
・AIによる営業支援
・商談履歴の資産化

である。

# 基本方針

最優先

・既存機能を壊さない
・後方互換性を維持する
・段階的リファクタリングを行う
・可読性を優先する
・保守しやすい構成にする

# 技術構成

React
Vite
Supabase
Supabase Storage

Chrome Extension

PC・スマホ対応

# UI方針

スマホ

・現場入力向け
・5タブ構成
・カードUI

PC

・業務管理向け
・Sidebar
・Table中心
・一覧＋詳細
・全画面利用

# データ方針

顧客中心ではなく

会社
└ 担当者
    ├ 名刺
    ├ 商談
    ├ メール
    ├ LINE
    ├ 見積
    ├ サンプル
    └ クレーム

という構造を基本とする。

# 保存方針

DB

Supabase

ファイル

Supabase Storage

LocalStorageは設定保存程度のみ。

# パフォーマンス

・Lazy Loading
・useMemo
・必要時のみ取得
・画像は遅延読み込み
・Storage URLのみ一覧取得
・不要な再レンダリング禁止

# レスポンシブ

767px以下

スマホUI

768px以上

PC UI

# コード規約

・機能単位でmodule化
・共通部品を再利用
・巨大コンポーネントを作らない
・責務を分離する

# ディレクトリ

modules/
shared/
layouts/
lib/
docs/

# AI機能

今後追加予定

AIメール
AI商談準備
AI議事録
AI商品提案
AI営業秘書

すべて後からOpenAI APIへ接続しやすい構成にする。

# 重要事項

今後Codexへ渡す指示は、このPROJECT_RULE.mdを前提とする。

毎回同じ設計や方針を書き直さず、このドキュメントを参照して実装すること。
