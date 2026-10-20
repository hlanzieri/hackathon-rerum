import React, { useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  Braces,
  Wheat,
  Scale,
  ClipboardCheck,
  Truck,
  ScanLine,
} from 'lucide-react';
import PublicHeader from './PublicHeader';
import Footer from './Footer';
import RationPreview from './RationPreview';
import useVisibleMotion from '../hooks/useVisibleMotion';
import useReveal from '../hooks/useReveal';
const steps = [
  [
    Wheat,
    '01',
    'Perfil do lote',
    'Animais, alimentos e custos locais. O ponto de partida é o que existe na propriedade.',
  ],
  [
    ScanLine,
    '02',
    'Consumo & escopo',
    'Estimativa NASEM opcional e conferência das condições de aplicação das regras.',
  ],
  [
    Scale,
    '03',
    'Otimização LP',
    'O menor custo possível dentro dos limites nutricionais e de inclusão informados.',
  ],
  [
    ClipboardCheck,
    '04',
    'Traço auditável',
    'Cada restrição, seu valor observado, sua fonte e a versão da base utilizada.',
  ],
  [
    Truck,
    '05',
    'Ficha do vagão',
    'Matéria natural por lote e por batida. Uma análise que chega à operação.',
  ],
];
export default function MainPage({ about, session }) {
  const details = useRef(null);
  const motion = useVisibleMotion();
  useReveal(motion);
  useEffect(() => {
    if (about) details.current?.focus();
  }, [about]);
  return (
    <div className="public-shell editorial-shell">
      <PublicHeader />
      <main
        id="public-content"
        tabIndex="-1"
        className="institutional-main motion-scope"
        ref={motion}
      >
        <section className="institutional-hero" aria-labelledby="route-focus">
          <div className="hero-copy reveal-item">
            <p className="editorial-kicker">
              <span className="signal-dot pulse" /> REGRAS EXPLÍCITAS / OTIMIZADOR LP
            </p>
            <p className="hero-folio">
              CADERNO DE CAMPO <span>01 — PECUÁRIA LEITEIRA</span>
            </p>
            <h1 id="route-focus" tabIndex="-1">
              Do lote ao vagão.
              <br />
              Precisão em
              <br />
              <em>cada escolha.</em>
            </h1>
            <p className="hero-lead">
              A dieta do seu rebanho merece mais que uma resposta convincente. Merece um cálculo que
              você possa conferir.
            </p>
            <div className="actions">
              <a className="button primary" href={session ? '#workspace' : '#login'}>
                {session ? 'Voltar à formulação' : 'Abrir meu espaço de trabalho'}
                <ArrowUpRight size={19} aria-hidden="true" />
              </a>
              <a className="editorial-link" href="#sobre">
                Conheça o método <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <Fingerprint size={17} aria-hidden="true" /> Traço verificável
              </span>
              <span>
                <Braces size={17} aria-hidden="true" /> Base versionada
              </span>
              <span>100% LOCAL</span>
            </div>
          </div>
          <div className="hero-lab reveal-item">
            <RationPreview />
          </div>
        </section>
        <div className="principles-strip">
          <span>CONHECIMENTO QUE SE EXPLICA.</span>
          <p>
            NASEM 2021 <i>/</i> Regras IF / THEN <i>/</i> SciPy HiGHS <i>/</i> Do kg de MS ao kg no
            vagão
          </p>
        </div>
        <section className="decision-section reveal-item" aria-labelledby="decision-title">
          <div className="section-index">01 / O CRITÉRIO</div>
          <div className="decision-intro">
            <h2 id="decision-title">
              O custo de uma dieta
              <br />
              não pode ser um palpite.
            </h2>
            <p>
              Texto fluente não comprova balanço nutricional. Aqui, o resultado precisa caber nas
              restrições — e deixar um registro que explique cada escolha.
            </p>
          </div>
          <div className="comparison-scroll">
            <table className="method-comparison">
              <caption className="sr-only">
                Comparação entre geração de texto isolada e o motor AkiNutri
              </caption>
              <thead>
                <tr>
                  <th scope="col">NA PRÁTICA</th>
                  <th scope="col">LLM sem motor externo</th>
                  <th scope="col">
                    AkiNutri <span>REGRAS + LP</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">De onde vem o número?</th>
                  <td>Pode gerar valores sem cálculo verificável.</td>
                  <td>Equações e dados declarados, aplicados por código determinístico.</td>
                </tr>
                <tr>
                  <th scope="row">Como se busca menor custo?</th>
                  <td>Uma resposta textual não garante otimização.</td>
                  <td>Programação linear com restrições e limites explícitos.</td>
                </tr>
                <tr>
                  <th scope="row">É possível conferir depois?</th>
                  <td>Depende de ferramentas e registros adicionais.</td>
                  <td>Fatos, preços, regras e traço preservados por sessão.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section
          ref={details}
          tabIndex="-1"
          className="institutional-section reveal-item"
          aria-labelledby="method-title"
        >
          <div className="section-index">02 / O CAMINHO</div>
          <div className="section-editorial-heading">
            <h2 id="method-title">
              Do cocho ao vagão.
              <br />
              <em>Sem perder o fio da decisão.</em>
            </h2>
            <p>
              Uma sequência de trabalho para quem formula,
              <br />
              confere e coloca a dieta em prática.
            </p>
          </div>
          <ol className="field-timeline">
            {steps.map(([Icon, n, title, text]) => (
              <li key={n}>
                <div className="timeline-illustration">
                  <Icon size={32} strokeWidth={1.25} aria-hidden="true" />
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="science-section reveal-item" aria-labelledby="science-title">
          <div>
            <div className="section-index">03 / A BASE</div>
            <h2 id="science-title">
              Ciência na origem.
              <br />
              <em>Transparência no resultado.</em>
            </h2>
            <p>
              A equação 2-1 do NASEM 2021 fundamenta a estimativa opcional de consumo para
              Holandesas em lactação, dentro do escopo implementado. A referência acompanha a
              análise.
            </p>
            <a
              className="editorial-link"
              href="https://www.ncbi.nlm.nih.gov/books/NBK600610/"
              target="_blank"
              rel="noreferrer"
            >
              Consultar a fonte científica <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="code-ledger">
            <div>
              <span className="signal-dot" /> MOTOR DETERMINÍSTICO <code>v0.1.0</code>
            </div>
            <p>
              <span>01</span> <b>IF</b> fatos estão no escopo
            </p>
            <p>
              <span>02</span> <b>THEN</b> aplicar regras versionadas
            </p>
            <p>
              <span>03</span> <b>SOLVE</b> menor custo sob restrições
            </p>
            <p>
              <span>04</span> <b>VERIFY</b> resultado + traço de inferência
            </p>
            <footer>Nenhuma LLM decide ingredientes, limites ou custos.</footer>
          </div>
        </section>
        <section className="institutional-cta">
          <span className="cta-mark">A.</span>
          <div>
            <h2>A próxima decisão começa no seu lote.</h2>
            <p>
              MVP demonstrativo. Perfis e insumos exigem validação técnica para uso no campo; não
              reproduz integralmente o NASEM.
            </p>
          </div>
          <a className="button primary" href="#login">
            Experimentar o AkiNutri <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </section>
      </main>
      <Footer base={null} />
    </div>
  );
}
