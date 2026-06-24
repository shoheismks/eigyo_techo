import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

const AuthContext = createContext(null);

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
      if (ignore) {
        return;
      }

      if (error) {
        setAuthError(error.message);
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
      const message = 'Supabase環境変数が未設定です。';
      setAuthError(message);
      return { ok: false, error: message };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  async function signUp(email, password) {
    setAuthError('');
    if (!supabase) {
      const message = 'Supabase環境変数が未設定です。';
      setAuthError(message);
      return { ok: false, error: message };
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }

  async function signOut() {
    setAuthError('');
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
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
