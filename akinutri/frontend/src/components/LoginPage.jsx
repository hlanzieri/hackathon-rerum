import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Sprout, ClipboardCheck, Check, ArrowUpRight } from 'lucide-react';
import FieldGraphic from './FieldGraphic';
import PublicHeader from './PublicHeader';
import { createSession } from '../session';
export default function LoginPage({ onLogin }) {
  useEffect(() => {
    document.getElementById('route-focus')?.focus();
  }, []);
  const [role, setRole] = useState('produtor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 254;
  const passwordValid = password.length >= 8 && password.length <= 128 && !!password.trim();
  function demo(profile) {
    try {
      onLogin(createSession(`${profile}@demo.akinutri.local`, profile));
    } catch {
      setErrors({
        storage: 'Não foi possível criar a sessão local. Verifique o armazenamento da aba.',
      });
    }
  }
  const emailRef = useRef(null),
    passwordRef = useRef(null);
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'Informe um e-mail válido.';
    if (password.length < 8 || !password.trim()) next.password = 'Use ao menos 8 caracteres.';
    if (password.length > 128) next.password = 'Use no máximo 128 caracteres.';
    setErrors(next);
    setAttempt((value) => value + 1);
    if (Object.keys(next).length) {
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    try {
      const session = createSession(email, role);
      setPassword('');
      onLogin(session);
    } catch {
      setErrors({
        storage:
          'Não foi possível criar a sessão. Permita o armazenamento desta aba e tente novamente.',
      });
    }
  }
  return (
    <div className="public-shell login-shell">
      <PublicHeader />
      <main id="public-content" tabIndex="-1" className="login-main">
        <section className="login-context">
          <p className="editorial-kicker">
            <span className="signal-dot" /> CADERNO DE OPERAÇÃO / AKINUTRI
          </p>
          <h2>
            A precisão começa
            <br />
            antes do <em>cocho.</em>
          </h2>
          <p>
            Conheça o lote. Confira o alimento. Entenda cada número antes de levar a dieta ao vagão.
          </p>
          <FieldGraphic />
          <div className="field-case">
            <span>CENÁRIO DE OPERAÇÃO</span>
            <p>
              O preço da soja mudou. Recalcule o menor custo, confira as restrições e leve uma nova
              ficha ao operador.
            </p>
            <small>Exemplo de uso · sem promessa de economia</small>
          </div>
          <div className="input-ticker">
            <span>
              REFERÊNCIA DEMO <small>R$/kg MN</small>
            </span>
            <div>
              <span>
                MILHO <b>1,25</b>
              </span>
              <span>
                SOJA <b>2,20</b>
              </span>
              <span>
                SILAGEM <b>0,32</b>
              </span>
            </div>
          </div>
          <a className="editorial-link" href="#home">
            Conhecer o sistema <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </section>
        <section className="card login-card" aria-labelledby="route-focus">
          <p className="page-eyebrow">ACESSO DEMONSTRATIVO</p>
          <h1 id="route-focus" tabIndex="-1">
            Acesse seu espaço de trabalho
          </h1>
          <p className="login-intro">Sessão local de até 8 horas, mantida nesta aba.</p>
          <form
            noValidate
            onSubmit={submit}
            className={Object.keys(errors).length ? 'form-invalid' : ''}
            data-attempt={attempt}
          >
            <fieldset className="profile-choice">
              <legend>Como você vai usar o AkiNutri?</legend>
              {[
                ['produtor', 'Produtor Rural', Sprout],
                ['consultor', 'Zootecnista / Consultor', ClipboardCheck],
              ].map(([value, label, Icon]) => (
                <label key={value} className={role === value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="profile"
                    value={value}
                    checked={role === value}
                    onChange={() => setRole(value)}
                  />
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
            <label className="login-field" htmlFor="login-email">
              E-mail
              <input
                ref={emailRef}
                id="login-email"
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </label>
            {emailValid && (
              <span className="field-valid">
                <Check size={13} aria-hidden="true" /> Formato válido
              </span>
            )}
            {errors.email && (
              <p className="field-error" id="email-error">
                {errors.email}
              </p>
            )}
            <label className="login-field" htmlFor="login-password">
              Senha de demonstração
              <input
                ref={passwordRef}
                id="login-password"
                type="password"
                autoComplete="off"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={`password-hint${errors.password ? ' password-error' : ''}`}
              />
            </label>
            {passwordValid && (
              <span className="field-valid">
                <Check size={13} aria-hidden="true" /> Tamanho válido
              </span>
            )}
            <p id="password-hint" className="field-hint">
              Use um texto fictício de 8 a 128 caracteres. Não use sua senha pessoal.
            </p>
            {errors.password && (
              <p className="field-error" id="password-error">
                {errors.password}
              </p>
            )}
            <div role="status" className="sr-only">
              {Object.values(errors).join(' ')}
            </div>
            {errors.storage && (
              <p role="alert" className="error">
                {errors.storage}
              </p>
            )}
            <button className="button primary login-submit" type="submit">
              Entrar no ambiente local <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <div className="quick-demo">
            <span>EXPLORAR SEM PREENCHER</span>
            <div>
              <button type="button" className="button secondary" onClick={() => demo('produtor')}>
                Demo produtor <ArrowUpRight size={15} aria-hidden="true" />
              </button>
              <button type="button" className="button secondary" onClick={() => demo('consultor')}>
                Demo consultor <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="notice login-disclosure">
            Este acesso valida o formulário e organiza a interface. Não verifica credenciais nem
            autentica a API. A senha não é armazenada ou enviada. Perfis não concedem permissões de
            servidor.
          </p>
        </section>
      </main>
    </div>
  );
}
