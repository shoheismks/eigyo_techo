import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { authError, hasSupabaseConfig, signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    const action = mode === 'login' ? signIn : signUp;
    const result = await action(email.trim(), password);

    if (result.ok && mode === 'signup') {
      setMessage('登録しました。確認メールが届く設定の場合はメールを確認してください。');
    }

    setIsSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Eigyo Techo</p>
        <h1>営業手帳</h1>
        <p className="hero-copy">
          顧客情報、商品マスター、商談履歴をユーザーごとに管理します。
        </p>

        <div className="auth-tabs" role="tablist" aria-label="ログイン切り替え">
          <button
            className={mode === 'login' ? 'selected' : ''}
            type="button"
            onClick={() => setMode('login')}
          >
            ログイン
          </button>
          <button
            className={mode === 'signup' ? 'selected' : ''}
            type="button"
            onClick={() => setMode('signup')}
          >
            新規登録
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">
            メールアドレス
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field-label">
            パスワード
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              type="password"
              value={password}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button className="primary-button" disabled={isSubmitting || !hasSupabaseConfig} type="submit">
            {isSubmitting ? '処理中...' : mode === 'login' ? 'ログイン' : '新規登録'}
          </button>
        </form>

        {!hasSupabaseConfig && (
          <p className="error-text">Supabase環境変数が未設定です。.env を確認してください。</p>
        )}
        {message && <p className="notice-text">{message}</p>}
        {authError && <p className="error-text">{authError}</p>}
      </section>
    </main>
  );
}
