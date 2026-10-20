import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { readToken, clearToken } from '../authToken';
import { navigate } from '../navigation';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      if (!readToken()) {
        if (current === generation.current) setUser(null);
        return null;
      }
      const data = await api('/auth/me');
      if (!data?.user?.id) throw new Error('Não foi possível confirmar a sessão.');
      if (current === generation.current) {
        setUser(data.user);
        setExpiresAt(data.expires_at ? data.expires_at * 1000 : null);
        setError('');
      }
      return data.user;
    } catch (failure) {
      if (current === generation.current) {
        clearToken();
        setUser(null);
      }
      throw failure;
    } finally {
      if (current === generation.current) setChecking(false);
    }
  }, []);
  useEffect(() => {
    // Legacy browser identities are never authentication credentials.
    try {
      sessionStorage.removeItem('akinutri.session.v1');
    } catch {
      /* unavailable storage */
    }
    refresh().catch(() => {});
    const unauthorized = () => {
      clearToken();
      generation.current++;
      setUser(null);
      setChecking(false);
    };
    const focus = () => refresh().catch(() => {});
    window.addEventListener('akinutri:unauthorized', unauthorized);
    window.addEventListener('focus', focus);
    return () => {
      generation.current++;
      window.removeEventListener('akinutri:unauthorized', unauthorized);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!user || !expiresAt) return;
    let timer;
    const schedule = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        generation.current++;
        setUser(null);
        setChecking(true);
        refresh().catch(() => {});
      } else {
        timer = setTimeout(schedule, Math.min(remaining, 2147483647));
      }
    };
    schedule();
    return () => clearTimeout(timer);
  }, [user, expiresAt, refresh]);
  const logout = async () => {
    try {
      await api('/auth/logout', 'POST');
      generation.current++;
      setUser(null);
      setError('');
      clearToken();
      navigate('/login', { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  };
  return { user, checking, refresh, logout, error };
}
