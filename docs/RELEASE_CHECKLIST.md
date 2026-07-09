# Version1.0 Release Checklist

営業手帳 Version1.0 Release Candidate の公開前チェックリストです。

## 基本

- [x] READMEをVersion1.0候補向けに更新
- [x] CHANGELOGを作成
- [x] リリースチェックリストを作成
- [x] `.env` をGitHubへ含めない方針をREADMEに明記
- [x] Vercel公開手順をREADMEに記載
- [x] Supabase / OpenAI / Google Placesなどの環境変数名をREADMEに記載

## Build

- [x] `npm run build` が成功
- [x] Vite 500kB超chunk警告なし
- [x] `dist/` が生成される

## Local Smoke Test

- [x] `npm run dev` でローカル起動
- [x] `http://127.0.0.1:5173/` がHTTP 200を返す
- [x] `http://127.0.0.1:5173/import?companyName=TestCompany` がHTTP 200を返す
- [x] `npm run preview` でbuild成果物を配信
- [x] `http://127.0.0.1:4173/` がHTTP 200を返す
- [x] `http://127.0.0.1:4173/import?companyName=TestCompany` がHTTP 200を返す

## Supabase

- [x] Supabase Auth連携の実装あり
- [x] Supabase DB migrationあり
- [x] RLS policy migrationあり
- [x] Storage bucket / object policy migrationあり
- [x] user_idによるユーザー分離方針あり
- [x] Supabase未設定時のLocalStorage fallbackあり
- [ ] 本番Supabaseへ最新migration適用
- [ ] 本番でPC/スマホ同一ユーザー同期を実データ確認

## Storage

- [x] 添付ファイルはStorageアップロード設計
- [x] DB/JSON ExportにはURLとメタ情報のみ保存
- [x] 一覧では添付ファイル本体を読み込まない設計
- [ ] 本番Storageで画像・PDFアップロード確認

## 認証

- [x] 未ログイン時はLogin画面を表示
- [x] ログアウトボタンあり
- [x] ログインユーザーのuserIdを主要データへ付与
- [ ] 本番で新規登録確認
- [ ] 本番でログイン確認
- [ ] 本番でログアウト確認

## 主要機能

- [x] ホームダッシュボード
- [x] 取引先一覧
- [x] 顧客カルテ
- [x] 担当者
- [x] 名刺
- [x] 商談・案件管理
- [x] 商品マスター
- [x] 仕入先管理
- [x] 見積履歴
- [x] サンプル管理
- [x] 商品採用履歴
- [x] クレーム管理
- [x] カレンダー
- [x] 通知カード
- [x] AIメール・AI商談準備の土台
- [x] JSON Export / Import
- [x] Chrome拡張取り込み

## PC表示

- [x] 768px以上はサイドバー表示
- [x] 下部ナビを非表示
- [x] 一覧はテーブル中心
- [x] 顧客カルテは複数カラム表示
- [ ] 実ブラウザで主要画面の横幅確認

## スマホ表示

- [x] 767px以下は下部5タブ表示
- [x] カードUI
- [x] 入力フォームは縦並び
- [ ] 実機またはモバイル表示で主要画面確認

## Chrome拡張

- [x] 送信先は `https://eigyo-techo.vercel.app/import?companyName=`
- [x] 選択テキストのみ送信
- [x] 自動スクレイピングなし
- [x] `/import` のSPA rewriteあり
- [ ] Chrome拡張を実ブラウザに読み込み確認

## 外部API

- [x] Google Places API未設定時は仮データfallback
- [x] OpenAI API未設定時はテンプレートfallback
- [x] Gmail / Outlookは下書き作成のmock実装
- [x] LINEは将来連携用の土台
- [ ] 本番OpenAI API接続確認

## バックアップ

- [x] JSON Exportあり
- [x] JSON Importあり
- [x] Importは既存データを削除しない
- [x] Storage本体はJSONへ含めない
- [ ] ExportしたJSONを別ブラウザでImport確認

## リリース判定

Version1.0候補としてビルド可能。  
本番公開前に残る必須確認は、本番Supabase migration適用、本番Auth確認、PC/スマホ実ブラウザ確認、Storageアップロード確認です。
