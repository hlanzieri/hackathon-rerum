import React, { lazy, Suspense, useEffect, useState } from 'react';
import useAuth from './hooks/useAuth';
import AuthGuard from './components/AuthGuard';
import { currentRoute, isProtectedPath, navigate, interceptNavigation } from './navigation';
import RouteBoundary from './components/RouteBoundary';
import MainPage from './components/MainPage';
const LoginPage = lazy(() => import('./components/LoginPage'));
const RegisterPage = lazy(() => import('./components/RegisterPage'));
const DashboardShell = lazy(() => import('./components/DashboardShell'));
const Loading = () => (
  <div className="route-loading" role="status">
    Verificando acesso…
  </div>
);
export default function App() {
  const [tab, setTab] = useState(currentRoute);
  const auth = useAuth();
  const protectedPage = isProtectedPath(window.location.pathname);
  useEffect(() => {
    const update = () => setTab(currentRoute());
    window.addEventListener('popstate', update);
    document.addEventListener('click', interceptNavigation);
    return () => {
      window.removeEventListener('popstate', update);
      document.removeEventListener('click', interceptNavigation);
    };
  }, []);
  useEffect(() => {
    document.title = `${['home', 'sobre'].includes(tab) ? 'Nutrição explicável' : ['login', 'register'].includes(tab) ? 'Acesso à conta' : 'Espaço de trabalho'} · AkiNutri`;
  }, [tab]);
  const onLogin = async () => {
    await auth.refresh();
    const destination = window.history.state?.from;
    navigate(destination && isProtectedPath(destination) ? destination : '/dashboard', {
      replace: true,
    });
  };
  return (
    <RouteBoundary key={auth.user?.id || 'public'}>
      <Suspense fallback={<Loading />}>
        {protectedPage ? (
          <AuthGuard auth={auth}>
            {tab === 'notfound' ? (
              <p>
                Página não encontrada. <a href="/dashboard">Voltar ao painel</a>
              </p>
            ) : (
              <DashboardShell
                key={auth.user?.id}
                tab={tab}
                session={auth.user}
                onLogout={auth.logout}
                authError={auth.error}
              />
            )}
          </AuthGuard>
        ) : tab === 'login' ? (
          <LoginPage onLogin={onLogin} />
        ) : tab === 'register' ? (
          <RegisterPage onLogin={onLogin} />
        ) : tab === 'notfound' ? (
          <p>
            Página não encontrada. <a href="/">Início</a>
          </p>
        ) : (
          <MainPage about={tab === 'sobre'} session={auth.user} />
        )}
      </Suspense>
    </RouteBoundary>
  );
}
