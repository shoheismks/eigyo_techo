export default function SettingsPage({ user, syncState, syncError, reloadFromCloud, signOut }) {
  return (
    <section className="page">
      <div className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>設定</h1>
        <p>ログイン情報と保存先の状態を確認できます。</p>
      </div>

      <section className={`sync-status-card ${syncState === 'supabase' ? 'cloud' : 'local'}`}>
        <div>
          <span>ログイン中</span>
          <strong>{user?.email}</strong>
        </div>
        <div>
          <span>保存先</span>
          <strong>{syncState === 'supabase' ? 'Supabase' : syncState === 'syncing' ? '同期中...' : 'LocalStorage'}</strong>
        </div>
        <button type="button" className="ghost-button" onClick={reloadFromCloud} disabled={syncState === 'syncing'}>
          クラウドから再読み込み
        </button>
        {syncError && <p>{syncError}</p>}
        <button type="button" className="text-button danger" onClick={signOut}>
          ログアウト
        </button>
      </section>
    </section>
  );
}
