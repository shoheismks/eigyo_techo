# ADMIN

営業手帳の管理者向けマニュアルです。

この文書は、ユーザー管理、Supabase、Storage、Migration、Backup/Restore、Vercel Deploy、障害時対応を管理する人が参照するためのものです。

## 1. 管理者の役割

管理者は以下を担当します。

- Supabaseプロジェクトの管理
- Vercelプロジェクトの管理
- 環境変数の登録と更新
- ユーザーのログイン状況確認
- Database / Storage / Authの運用確認
- Migrationの適用
- Backup / Restore方針の確認
- 障害時の一次対応
- APIキーや秘密情報の管理

## 2. ユーザー管理

営業手帳はSupabase Authのメールアドレス + パスワードログインを前提にしています。

### 確認場所

Supabase Dashboard:

```text
Authentication > Users
```

### 管理項目

- ユーザーのメールアドレス
- 作成日時
- 最終ログイン
- メール確認状態
- 無効化や削除の要否

### 運用ルール

- 退職者、利用停止者は速やかにAuthユーザーを停止または削除する。
- 複数人で同じアカウントを共有しない。
- 本番データを扱うユーザーは実名または業務用メールアドレスを使う。
- ユーザー削除前に、対象ユーザーのデータ移管が必要か確認する。

### 注意

現在のアプリは `user_id` によるユーザーごとのデータ分離を前提にしています。

RLSが有効なテーブルでは、原則として `auth.uid() = user_id` のデータだけにアクセスできます。

## 3. Supabase設定

### 利用サービス

- Supabase Auth
- Supabase Database
- Supabase Storage
- Row Level Security

### 必須設定

Supabaseプロジェクトで以下を確認します。

- Databaseテーブルが作成済みであること
- RLSが有効であること
- authenticatedユーザー向けpolicyが設定されていること
- Storage bucket `app-attachments` が存在すること
- Storage policyがユーザー単位で制御されていること

### 接続情報

Vercelまたはローカル `.env` に以下を設定します。

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
```

推奨は `VITE_SUPABASE_PUBLISHABLE_KEY` です。

両方が設定されている場合は、アプリ側でpublishable keyを優先します。

## 4. 環境変数

### ローカル

ローカルでは `.env.example` を参考に `.env` を作成します。

`.env` はGitHubへコミットしません。

### Vercel

Vercel Dashboard:

```text
Project > Settings > Environment Variables
```

### 主な環境変数

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_PLACES_API_KEY=
VITE_NTA_CORPORATE_APP_ID=
VITE_NTA_CORPORATE_API_URL=
VITE_GBIZINFO_API_KEY=
VITE_GBIZINFO_API_URL=
VITE_OPENAI_API_KEY=
VITE_OPENAI_MODEL=
```

### 禁止事項

- Supabase service role keyをフロントエンド環境変数に入れない。
- OAuth client secretをVite環境変数に入れない。
- `.env` をGitHubへpushしない。
- APIキーをREADMEやソースコードに直書きしない。

## 5. Storage

### Bucket

```text
app-attachments
```

### 保存対象

- 商品画像
- 商品資料
- スペックシート
- 名刺画像
- 見積PDF
- 添付資料
- 音声ファイル

### 保存方針

- ファイル本体はSupabase Storageへ保存する。
- DatabaseにはURL、path、ファイル名、content type、sizeなどのメタ情報のみ保存する。
- 一覧画面ではファイル本体を読み込まない。
- 画像はアップロード前に圧縮する。

### 障害時確認

- bucketが存在するか。
- Storage policyが正しいか。
- ユーザーがログインしているか。
- ブラウザがオンラインか。
- ファイルサイズやcontent typeに問題がないか。

## 6. Migration

Migrationは `supabase/migrations/` を正とします。

### 適用順序

ファイル名の日時順に適用します。

例:

```text
supabase/migrations/
```

### 運用ルール

- 既存データを消すSQLを本番へ直接流さない。
- Migration実行前にバックアップ方針を確認する。
- RLS、Storage policy、Indexの変更は本番影響を確認する。
- SQL Editorで実行する場合もファイル名順に実行する。
- Migration追加時は `docs/DATABASE.md` も更新する。

### よくあるエラー

| エラー | 確認点 |
| --- | --- |
| relation does not exist | テーブル作成Migrationが未実行 |
| permission denied | RLS policyまたはrole設定 |
| column does not exist | カラム追加Migrationが未実行 |
| bucket not found | Storage bucket未作成 |

## 7. Backup / Restore

### アプリ内バックアップ

設定画面からJSON Export / JSON Importができます。

Export:

- Database由来のアプリデータをJSONで出力する。
- Storageのファイル本体は含めない。
- Storage URLとメタ情報のみ含める。

Import:

- 既存データを削除しない。
- 同じIDは更新する。
- 存在しないIDは追加する。

### 管理者向けバックアップ

Supabase DashboardまたはCLIでDatabase backupを確認します。

重要な変更前には以下を確認します。

- 直近バックアップが存在するか。
- Restore手順が分かるか。
- 対象環境が本番か開発か。

## 8. Vercel Deploy

### 通常手順

1. GitHubへ変更をpushする。
2. Vercelが自動Deployする。
3. Build logを確認する。
4. 公開URLを確認する。
5. ログイン、主要画面、保存動作を確認する。

### 設定

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

### SPA rewrite

`/import` などの直接アクセスに対応するため、`vercel.json` でSPA rewriteを設定します。

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Deploy後チェック

- トップページが表示される。
- `/import?companyName=テスト会社` が404にならない。
- ログインできる。
- Supabase保存できる。
- Storage添付できる。
- スマホ表示が崩れていない。

## 9. 障害時対応

### まず確認すること

1. Vercelの最新Deployが成功しているか。
2. Supabaseが稼働しているか。
3. Vercel環境変数が設定されているか。
4. ブラウザコンソールにエラーが出ていないか。
5. Supabase Database / Auth / Storageのどこで失敗しているか。

### ログインできない

- Supabase URL / keyが正しいか確認する。
- Authユーザーが存在するか確認する。
- メール確認が必要な設定になっていないか確認する。
- Vercel環境変数を更新後、再Deployしたか確認する。

### PCとスマホで同期されない

- 同じユーザーでログインしているか確認する。
- 保存先がSupabaseになっているか確認する。
- LocalStorage fallbackになっていないか確認する。
- RLSで `user_id` が一致しているか確認する。
- 保存後に再取得されているか確認する。

### 添付ファイルが保存できない

- `app-attachments` bucketがあるか確認する。
- Storage policyが正しいか確認する。
- ユーザーがログイン済みか確認する。
- ファイルサイズや形式を確認する。
- オフラインではStorageへ保存できない。

### 画面が404になる

- `vercel.json` のrewriteを確認する。
- Vercel Deployに `vercel.json` が含まれているか確認する。
- `/import` などの直接アクセスでSPAへrewriteされるか確認する。

### Buildが失敗する

ローカルで以下を実行します。

```bash
npm run build
```

PowerShellの実行ポリシーで失敗する場合は以下を使います。

```bash
npm.cmd run build
```

エラー箇所を確認し、最小修正で対応します。

## 10. セキュリティ注意事項

- service role keyをブラウザへ出さない。
- 本番DBでanon全許可policyを使わない。
- RLSを無効化しない。
- `.env` をGitHubへ上げない。
- APIキーをチャットやREADMEへ貼らない。
- 不要になったユーザーは停止する。
- 共有アカウント運用を避ける。

## 11. 管理者チェックリスト

定期的に以下を確認します。

- [ ] Vercel Deployが成功している
- [ ] Supabase Authユーザーに不要アカウントがない
- [ ] RLS policyがユーザー単位になっている
- [ ] Storage bucketとpolicyが有効
- [ ] MigrationとDATABASE.mdが対応している
- [ ] README / ADMIN / MANUALが最新
- [ ] Backup / Restore手順を確認済み
- [ ] 主要画面で保存・表示ができる

## 最後

管理者作業は、本番データに直接影響します。

変更前には対象環境、バックアップ、影響範囲を確認してください。
