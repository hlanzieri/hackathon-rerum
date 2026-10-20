import React, { lazy, Suspense, useEffect, useState } from 'react';
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
} from 'lucide-react';
import useWorkspace from './hooks/useWorkspace';
import Workspace from './components/Workspace';
import TracoPanel from './components/TracoPanel';
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
  resultado: [
    'Uma análise, todos os detalhes.',
    'Resultado histórico com integridade conferida pelo backend.',
  ],
};
const currentRoute = () => {
  const value = window.location.hash.slice(1);
  return value in titles ? value : 'workspace';
};

export default function App() {
  const workspace = useWorkspace();
  const statusMotion = useVisibleMotion();
  const [tab, setTab] = useState(currentRoute),
    [batchSession, setBatchSession] = useState(null);
  useEffect(() => {
    const update = () => setTab(currentRoute());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const batch = (id) => {
    setBatchSession(id);
    window.location.hash = 'batida';
  };
  async function open(id) {
    if (await workspace.openSession(id)) window.location.hash = 'resultado';
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
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
          <span className="local-badge">
            <span className="live-dot pulse" /> Motor determinístico ativo
          </span>
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
          <footer className="page-footer">
            <span>AkiNutri · Hackathon UFJF 2026</span>
            <span>Conhecimento explícito. Decisão rastreável.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
