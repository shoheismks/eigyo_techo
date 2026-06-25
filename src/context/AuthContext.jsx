import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

function getAuthErrorMessage(error) {
  if (!error?.message) {
    return '認証に失敗しました。メールアドレスとパスワードを確認してください。';
  }

  if (error.message.includes('Invalid login credentials')) {
    return 'メールアドレスまたはパスワードが違います。';
  }

  if (error.message.includes('Email not confirmed')) {
    return 'メール確認が完了していません。Supabaseから届いた確認メールを開いてください。';
  }

  if (error.message.includes('User already registered')) {
    return 'このメールアドレスはすでに登録されています。ログインしてください。';
  }

  if (error.message.includes('Password should be')) {
    return 'パスワードが短すぎます。6文字以上で設定してください。';
  }

  return error.message;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (ignore) return;

      if (error) {
        setAuthError(getAuthErrorMessage(error));
      }

      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }

    loadSession();

    if (!supabase) {
      return () => {
        ignore = true;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      ignore = true;
      data.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email, password) {
    setAuthError('');

    if (!supabase) {
      const message = 'Supabase設定が見つかりません。環境変数を確認してください。';
      setAuthError(message);
      return { ok: false, error: message };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      return { ok: false, error: message };
    }

    return { ok: true };
  }

  async function signUp(email, password) {
    setAuthError('');

    if (!supabase) {
      const message = 'Supabase設定が見つかりません。環境変数を確認してください。';
      setAuthError(message);
      return { ok: false, error: message };
    }

    const redirectTo = window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      return { ok: false, error: message };
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user ?? null);
    }

    return {
      ok: true,
      requiresEmailConfirmation: !data.session,
    };
  }

  async function signOut() {
    setAuthError('');

    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(getAuthErrorMessage(error));
      return { ok: false, error: getAuthErrorMessage(error) };
    }

    setSession(null);
    setUser(null);

    return { ok: true };
  }

  const value = useMemo(
    () => ({
      authError,
      hasSupabaseConfig,
      loading,
      session,
      signIn,
      signOut,
      signUp,
      user,
      userId: user?.id ?? '',
    }),
    [authError, loading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}