import React from 'react';
import useVisibleMotion from '../hooks/useVisibleMotion';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Cpu,
  ExternalLink,
  Leaf,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const references = [
  {
    name: 'NASEM (2021)',
    title: 'Nutrient Requirements of Dairy Cattle',
    href: 'https://www.ncbi.nlm.nih.gov/books/NBK600592/',
    acronym: 'National Academies of Sciences, Engineering, and Medicine',
    note: 'Referência para requisitos nutricionais de bovinos leiteiros.',
  },
  {
    name: 'Penn State Extension',
    title: 'Carbohydrate Nutrition Guidelines',
    href: 'https://extension.psu.edu/carbohydrate-nutrition-for-lactating-dairy-cattle',
    acronym: 'Diretrizes de carboidratos para vacas leiteiras em lactação',
    note: 'Inclui orientações para dietas',
    term: 'TMR',
    termTitle: 'Total Mixed Ration: ração total misturada',
    noteSuffix: '(ração total misturada).',
  },
  {
    name: 'BR-CORTE / CNCPS',
    title: 'Referências de composição bromatológica',
    href: 'https://brcorte.com.br/',
    acronym: 'Sistema Cornell de carboidratos e proteína líquida',
    note: 'Consultar as referências de',
    term: 'FDN',
    termTitle: 'Fibra em detergente neutro',
    noteSuffix: '(fibra em detergente neutro).',
  },
];

const presentationUrl =
  'https://github.com/hlanzieri/hackathon-rerum/blob/main/akinutri/docs/APRESENTACAO.md';
const testsUrl = 'https://github.com/hlanzieri/hackathon-rerum/blob/main/akinutri/docs/TESTES.md';

function FooterLink({ href, children, external = false }) {
  return (
    <a
      className="institutional-footer__link"
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span>{children}</span>
      {external && <ExternalLink size={14} aria-hidden="true" />}
    </a>
  );
}

export default function Footer({ base }) {
  const motionRef = useVisibleMotion();
  return (
    <footer ref={motionRef} className="institutional-footer no-print">
      <div className="institutional-footer__inner">
        <div className="institutional-footer__grid">
          <section aria-labelledby="footer-brand">
            <a className="institutional-footer__brand" href="/dashboard" id="footer-brand">
              <Leaf size={27} aria-hidden="true" />
              <span>
                <strong>AkiNutri</strong>
                <small>NUTRIÇÃO DE PRECISÃO</small>
              </span>
            </a>
            <p className="institutional-footer__description">
              Sistema Especialista determinístico para verificação e otimização de custo de dietas
              de bovinos leiteiros via Programação Linear (
              <abbr title="Programação Linear">LP</abbr>).
            </p>
            <div className="institutional-footer__project">
              <Award size={16} aria-hidden="true" />
              <span>Projeto RERUM / UFJF — XXVIII Semana da Computação 2026</span>
            </div>
          </section>

          <section aria-labelledby="footer-science">
            <h2 id="footer-science">Fundamentação Zootécnica</h2>
            <ul className="institutional-footer__list">
              {references.map((reference) => (
                <li key={reference.name}>
                  <BookOpen size={16} aria-hidden="true" />
                  <div>
                    <FooterLink href={reference.href} external>
                      <abbr title={reference.acronym}>{reference.name}</abbr>
                    </FooterLink>
                    <p>{reference.title}</p>
                    <small>
                      {reference.note}
                      {reference.term && (
                        <>
                          {' '}
                          <abbr title={reference.termTitle}>{reference.term}</abbr>{' '}
                          {reference.noteSuffix}
                        </>
                      )}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="footer-integrity">
            <h2 id="footer-integrity">Integridade do Motor</h2>
            <ul className="institutional-footer__list institutional-footer__integrity">
              <li>
                <Cpu size={16} aria-hidden="true" />
                <div>
                  <strong>Engine</strong>
                  <span>Determinístico LP (SciPy HiGHS-DS)</span>
                </div>
              </li>
              <li>
                <BookOpen size={16} aria-hidden="true" />
                <div>
                  <strong>Base de Conhecimento</strong>
                  <span>
                    {base ? `v${base.version} (base_v${base.version}.json)` : 'Aguardando base'}
                  </span>
                </div>
              </li>
              <li>
                <ShieldCheck size={16} aria-hidden="true" />
                <div>
                  <strong>Hash de Validação</strong>
                  <code>{base?.sha256 ? `SHA-256: ${base.sha256}` : 'Não disponível'}</code>
                </div>
              </li>
              <li>
                <span
                  className={`institutional-footer__status-dot${base ? ' is-active' : ''}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>Status de Execução</strong>
                  <span>{base ? 'Base carregada e identificada' : 'Aguardando conexão'}</span>
                </div>
              </li>
            </ul>
          </section>

          <section aria-labelledby="footer-system">
            <h2 id="footer-system">Links do Sistema</h2>
            <ul className="institutional-footer__actions">
              <li>
                <Terminal size={16} aria-hidden="true" />
                <FooterLink href="/docs">Documentação da API · Swagger / FastAPI</FooterLink>
              </li>
              <li>
                <ExternalLink size={16} aria-hidden="true" />
                <FooterLink href="/dashboard/batida">
                  Batida do Vagão · exportar relatório PDF / imprimir
                </FooterLink>
              </li>
              <li>
                <BookOpen size={16} aria-hidden="true" />
                <FooterLink href="/dashboard/regras">
                  Visualizar JSON da Base de Conhecimento
                </FooterLink>
              </li>
              <li>
                <Award size={16} aria-hidden="true" />
                <FooterLink href={presentationUrl} external>
                  Roteiro de Apresentação
                </FooterLink>
              </li>
              <li>
                <ShieldCheck size={16} aria-hidden="true" />
                <FooterLink href={testsUrl} external>
                  Testes Automatizados
                </FooterLink>
              </li>
            </ul>
          </section>
        </div>

        <div className="institutional-footer__bottom">
          <div className="institutional-footer__disclaimer">
            <AlertTriangle size={19} aria-hidden="true" />
            <p>
              <strong>Isenção de Responsabilidade Técnica:</strong> O AkiNutri é um sistema
              especialista de suporte à decisão. As formulações sugeridas utilizam modelos
              matemáticos e regras de triagem zootécnica. É indispensável a validação no campo por
              um zootecnista ou médico veterinário credenciado antes da implementação do plano
              alimentar no rebanho.
            </p>
          </div>
          <p className="institutional-footer__copyright">
            © 2026 AkiNutri Enterprise v0.2. Desenvolvido para o Hackathon UFJF / RERUM. Licença
            Open Source MIT.
          </p>
        </div>
      </div>
    </footer>
  );
}
