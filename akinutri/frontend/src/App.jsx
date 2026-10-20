import React, { lazy, Suspense, useEffect, useState } from 'react';
<<<<<<< HEAD
import {
  Leaf,
  LayoutDashboard,
  Wheat,
  BookOpen,
  History,
  ChevronRight,
  ShieldCheck,
  GitCompareArrows,
  Truck,
  LogIn,
  UsersRound,
} from 'lucide-react';
import useWorkspace from './hooks/useWorkspace';
import Workspace from './components/Workspace';
import TracoPanel from './components/TracoPanel';
import Footer from './components/Footer';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';
import AnimaisPage from './components/AnimaisPage';
import useVisibleMotion from './hooks/useVisibleMotion';

const Catalogo = lazy(() => import('./components/Catalogo'));
const ComparisonPage = lazy(() => import('./components/ComparisonPage'));
const MixingPage = lazy(() => import('./components/MixingPage'));
const KnowledgePage = lazy(() => import('./components/KnowledgePage'));
const HistoryPage = lazy(() => import('./components/HistoryPage'));
const tabs = [
  ['workspace', 'Formulação', LayoutDashboard],
  ['comparacao', 'Comparação A/B', GitCompareArrows],
  ['batida', 'Batida do vagão', Truck],
  ['insumos', 'Insumos', Wheat],
  ['regras', 'Base de conhecimento', BookOpen],
  ['historico', 'Histórico de análises', History],
  ['animais', 'Animais e GP', UsersRound],
];
const titles = {
  workspace: ['Da análise ao cocho.', 'Formule, confira e explique a dieta do seu lote.'],
  comparacao: [
    'Duas dietas. Uma comparação clara.',
    'Compare dietas com os mesmos fatos e confira a economia projetada.',
  ],
  batida: [
    'A dieta na medida do seu vagão.',
    'Quantidades em matéria natural, por lote e por batida.',
  ],
  insumos: [
    'Conheça o que entra na dieta.',
    'Composição, custo e origem dos alimentos em uma biblioteca local.',
  ],
  regras: [
    'Cada decisão tem uma regra.',
    'Conhecimento explícito, versionado e aberto à conferência.',
  ],
  historico: [
    'O registro de cada decisão.',
    'Fatos, preços e regras preservados no momento da análise.',
  ],
  animais: [
    'A vida do rebanho, em contexto.',
    'Acompanhe grupos de produção, movimentações e dietas ao longo do tempo.',
  ],
  resultado: [
    'Uma análise, todos os detalhes.',
    'Resultado histórico com integridade conferida pelo backend.',
  ],
};
const currentRoute = () => {
  const value = window.location.hash.slice(1);
  if (value === 'login' || value === 'register' || value in titles) return value;
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/login' || path === '/register') return path.slice(1);
  return 'workspace';
};

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  if (route === 'login') return <LoginPage />;
  if (route === 'register') return <RegisterPage />;
  return <WorkspaceApp tab={route} />;
}

function WorkspaceApp({ tab }) {
  const workspace = useWorkspace();
  const statusMotion = useVisibleMotion();
  const [batchSession, setBatchSession] = useState(null);
  const batch = (id) => {
    setBatchSession(id);
    window.location.hash = 'batida';
=======
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
>>>>>>> 69cc92da86f2c3b0c89ecee41bd8e5faed79aef4
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
<<<<<<< HEAD
        Ir para o conteúdo
      </a>
      <aside className="sidebar" aria-label="Navegação principal">
        <a className="brand" href="#workspace" aria-label="AkiNutri · Formulação">
          <span className="brand-icon">
            <Leaf size={27} aria-hidden="true" />
          </span>
          <span>
            AkiNutri<span className="brand-dot">.</span>
            <small>NUTRIÇÃO EXPLICÁVEL</small>
          </span>
        </a>
        <div className="workspace-tag">
          <span className="tiny-square">A</span>
          <div>
            Hackathon UFJF<small>Tema T2 · Pecuária leiteira</small>
          </div>
          <ChevronRight size={15} aria-hidden="true" />
        </div>
        <p className="nav-label">ESPAÇO DE TRABALHO</p>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              title={label}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {tab === id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="engine-card">
            <ShieldCheck size={23} aria-hidden="true" />
            <strong>Você pode conferir.</strong>
            <p>
              Regras explícitas.
              <br />
              Cálculo local. Registro imutável.
            </p>
            <span>
              BASE v{workspace.base?.version || '0.1.0'} <span className="live-dot" />
            </span>
          </div>
          <div className="local-status">
            <span className="live-dot" /> Ambiente local <small>localhost</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header ref={statusMotion} className="topbar motion-scope">
          <div>
            <span className="breadcrumb-muted">AkiNutri</span>
            <ChevronRight size={13} aria-hidden="true" />
            <span>{tabs.find((t) => t[0] === tab)?.[1] || 'Resultado da análise'}</span>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <span className="live-dot pulse" /> Motor determinístico ativo
            </span>
            <a className="login-entry-link" href="#login">
              Entrar <LogIn size={15} aria-hidden="true" />
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex="-1">
          <div className="page-eyebrow">
            PECUÁRIA LEITEIRA <span>/</span> SISTEMA ESPECIALISTA
          </div>
          <div className="page-heading">
            <div>
              <h1>{titles[tab][0]}</h1>
              <p>{titles[tab][1]}</p>
            </div>
            <span className="edition">POC LOCAL · v0.2</span>
          </div>
          {workspace.error && (
            <div role="alert" className="error">
              {workspace.error}
              {!workspace.base && (
                <button className="text-button" onClick={workspace.retry}>
                  Tentar novamente
                </button>
              )}
            </div>
          )}
          <div className="sr-only" role="status" aria-live="polite">
            {workspace.busy
              ? 'Executando análise determinística…'
              : workspace.result
                ? `Análise ${workspace.result.session_id} concluída.`
                : ''}
          </div>
          {workspace.loading ? (
            <div className="card loading-state" role="status">
              Conectando à base de conhecimento local…
            </div>
          ) : (
            workspace.base && (
              <Suspense
                fallback={
                  <div className="card" role="status">
                    Carregando módulo…
                  </div>
                }
              >
                <div className="route-content" key={tab}>
                  {tab === 'workspace' && <Workspace workspace={workspace} onBatch={batch} />}
                  {tab === 'comparacao' && (
                    <ComparisonPage
                      history={workspace.history}
                      defaults={workspace.lastSessions}
                      onBatch={batch}
                    />
                  )}
                  {tab === 'batida' && (
                    <MixingPage
                      key={batchSession}
                      history={workspace.history}
                      initialSession={batchSession}
                    />
                  )}
                  {tab === 'insumos' && (
                    <Catalogo
                      insumos={workspace.insumos}
                      reload={async () => {
                        await workspace.refresh();
                        workspace.invalidate();
                      }}
                    />
                  )}
                  {tab === 'regras' && <KnowledgePage base={workspace.base} />}
                  {tab === 'historico' && (
                    <HistoryPage history={workspace.history} busy={workspace.busy} onOpen={open} />
                  )}
                  {tab === 'animais' && <AnimaisPage />}
                  {tab === 'resultado' &&
                    (workspace.result ? (
                      <>
                        <div className="actions no-print">
                          <button
                            className="button secondary"
                            onClick={() => batch(workspace.result.session_id)}
                          >
                            Preparar batida do vagão
                          </button>
                        </div>
                        <TracoPanel result={workspace.result} snapshot={workspace.snapshot} />
                      </>
                    ) : (
                      <p className="notice">
                        Selecione uma sessão no <a href="#historico">histórico</a> para consultar o
                        resultado.
                      </p>
                    ))}
                </div>
              </Suspense>
            )
          )}
        </main>
        <Footer base={workspace.base} />
      </div>
    </div>
=======
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
>>>>>>> 69cc92da86f2c3b0c89ecee41bd8e5faed79aef4
  );
}
