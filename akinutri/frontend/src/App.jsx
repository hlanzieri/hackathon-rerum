import React, { lazy, Suspense, useEffect, useState } from 'react';
import { clearSession, readSession } from './session';
import RouteBoundary from './components/RouteBoundary';
import MainPage from './components/MainPage';
const LoginPage = lazy(() => import('./components/LoginPage'));
const DashboardShell = lazy(() => import('./components/DashboardShell'));
const protectedRoutes = new Set([
  'dashboard',
  'workspace',
  'comparacao',
  'batida',
  'insumos',
  'regras',
  'historico',
  'resultado',
]);
const route = () => {
  const hash = window.location.hash.slice(1);
  return protectedRoutes.has(hash) || ['home', 'sobre', 'login'].includes(hash) ? hash : 'home';
};
export default function App() {
  const [tab, setTab] = useState(route);
  const [session, setSession] = useState(readSession);
  const [destination, setDestination] = useState(() =>
    protectedRoutes.has(route()) ? route() : 'workspace',
  );
  const protectedPage = protectedRoutes.has(tab);
  useEffect(() => {
    const update = () => {
      setSession(readSession());
      setTab(route());
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (protectedPage && !session) {
      setDestination(tab);
      window.location.replace('#login');
    }
  }, [protectedPage, session, tab]);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (Date.now() >= session.expiresAt) {
        clearSession();
        setSession(null);
      }
    };
    const timer = setTimeout(expire, Math.max(0, session.expiresAt - Date.now()));
    window.addEventListener('focus', expire);
    document.addEventListener('visibilitychange', expire);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', expire);
      document.removeEventListener('visibilitychange', expire);
    };
  }, [session]);
  useEffect(() => {
    document.title = `${['home', 'sobre'].includes(tab) ? 'Nutrição explicável' : tab === 'login' ? 'Acesso local' : 'Espaço de trabalho'} · AkiNutri`;
  }, [tab]);
  const logout = () => {
    clearSession();
    setSession(null);
    setDestination('workspace');
    window.location.hash = 'login';
  };
  return (
    <RouteBoundary key={session ? 'signed-in' : 'public'}>
      <Suspense
        fallback={
          <div className="route-loading" role="status">
            Carregando AkiNutri…
          </div>
        }
      >
        {protectedPage && session ? (
          <DashboardShell
            tab={tab === 'dashboard' ? 'workspace' : tab}
            session={session}
            onLogout={logout}
          />
        ) : tab === 'login' || protectedPage ? (
          <LoginPage
            onLogin={(value) => {
              setSession(value);
              window.location.hash = destination;
            }}
          />
        ) : (
          <MainPage about={tab === 'sobre'} session={session} />
        )}
      </Suspense>
    </RouteBoundary>
  );
}
