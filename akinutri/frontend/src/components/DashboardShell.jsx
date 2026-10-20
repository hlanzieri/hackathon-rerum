import React, { lazy, Suspense, useEffect, useState } from 'react';
import {
  Leaf,
  LayoutDashboard,
  Wheat,
  BookOpen,
  History,
  ChevronRight,
  ShieldCheck,
  LogOut,
  GitCompareArrows,
  Truck,
  UsersRound,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import useWorkspace from '../hooks/useWorkspace';
import { paths, navigate } from '../navigation';
import Workspace from './Workspace';
import TracoPanel from './TracoPanel';
import Footer from './Footer';
import useVisibleMotion from '../hooks/useVisibleMotion';
import DashboardMetrics from './DashboardMetrics';

const Catalogo = lazy(() => import('./Catalogo'));
const ComparisonPage = lazy(() => import('./ComparisonPage'));
const MixingPage = lazy(() => import('./MixingPage'));
const KnowledgePage = lazy(() => import('./KnowledgePage'));
const AnimaisPage = lazy(() => import('./AnimaisPage'));
const HistoryPage = lazy(() => import('./HistoryPage'));
const tabs = [
  ['animais', 'Animais e GP', UsersRound],
  ['workspace', 'Formulação', LayoutDashboard],
  ['comparacao', 'Comparação A/B', GitCompareArrows],
  ['batida', 'Batida do vagão', Truck],
  ['insumos', 'Insumos', Wheat],
  ['regras', 'Base de conhecimento', BookOpen],
  ['historico', 'Histórico de análises', History],
  ['resultado', 'Resultado e traço', ShieldCheck],
];
const titles = {
  animais: [
    'A vida do rebanho, em contexto.',
    'Acompanhe grupos, movimentações e dietas ao longo do tempo.',
  ],
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
    'Composição, custo e origem dos alimentos em uma biblioteca de insumos.',
  ],
  regras: [
    'Cada decisão tem uma regra.',
    'Conhecimento explícito, versionado e aberto à conferência.',
  ],
  historico: [
    'O registro de cada decisão.',
    'Fatos, preços e regras preservados no momento da análise.',
  ],
  resultado: [
    'Uma análise, todos os detalhes.',
    'Resultado histórico com integridade conferida pelo backend.',
  ],
};
export default function DashboardShell({ tab, session, onLogout, authError }) {
  useEffect(() => {
    document.getElementById('route-focus')?.focus();
  }, [tab]);
  const workspace = useWorkspace();
  const statusMotion = useVisibleMotion();
  const [batchSession, setBatchSession] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const batch = (id) => {
    setBatchSession(id);
    navigate('/dashboard/batida');
  };
  async function open(id) {
    if (await workspace.openSession(id)) navigate('/dashboard/resultado');
  }
  return (
    <div className={`app-shell enterprise-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a
        className="skip-link"
        href=""
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <aside className="sidebar" aria-label="Navegação principal">
        <a className="brand" href="/dashboard" aria-label="AkiNutri · Formulação">
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
            {session.fazenda_nome || 'Minha propriedade'}
            <small>Gestão nutricional do rebanho</small>
          </div>
          <ChevronRight size={15} aria-hidden="true" />
        </div>
        <p className="nav-label">ESPAÇO DE TRABALHO</p>
        <button
          className="sidebar-toggle"
          aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}
          aria-expanded={!collapsed}
          aria-controls="workspace-navigation"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={17} aria-hidden="true" />
          )}
          <span>Recolher navegação</span>
        </button>
        <nav id="workspace-navigation">
          {tabs.map(([id, label, Icon]) => (
            <a
              key={id}
              href={paths[id]}
              className={`nav-item ${tab === id ? 'active' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              title={label}
              aria-label={label}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
              {tab === id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="session-card">
            <span className="session-avatar" aria-hidden="true">
              {session.role === 'produtor' ? 'PR' : 'ZC'}
            </span>
            <strong>{session.name}</strong>
            <span title={session.email}>{session.email}</span>
            <small>{session.role === 'zootecnista' ? 'Zootecnista' : 'Produtor rural'}</small>
            <button className="button secondary" onClick={onLogout}>
              <LogOut size={16} aria-hidden="true" /> Sair
            </button>
          </div>
          <div className="engine-card">
            <ShieldCheck size={23} aria-hidden="true" />
            <strong>Você pode conferir.</strong>
            <p>
              Regras explícitas.
              <br />
              Cálculo determinístico. Registro imutável.
            </p>
            <span>
              BASE v{workspace.base?.version || '0.1.0'} <span className="live-dot" />
            </span>
          </div>
          <div className="local-status">
            <span className="live-dot" /> Sessão autenticada
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
          <a className="dashboard-home" href="/">
            Sobre o AkiNutri
          </a>
          <span className="local-badge">
            <span className="live-dot pulse" /> Motor Determinístico Ativo
          </span>
        </header>
        <main id="main-content" tabIndex="-1">
          <div className="page-eyebrow">
            PECUÁRIA LEITEIRA <span>/</span> SISTEMA ESPECIALISTA
          </div>
          <div className="page-heading">
            <div>
              <h1 id="route-focus" tabIndex="-1">
                {titles[tab][0]}
              </h1>
              <p>{titles[tab][1]}</p>
            </div>
            <span className="edition">BASE v{workspace.base?.version || '0.1.0'}</span>
          </div>
          {authError && (
            <p role="alert" className="error">
              {authError}
            </p>
          )}
          <DashboardMetrics workspace={workspace} />
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
              Carregando base de conhecimento…
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
                  {tab === 'animais' && <AnimaisPage />}
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
                        Selecione uma sessão no <a href="/dashboard/historico">histórico</a> para
                        consultar o resultado.
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
  );
}
