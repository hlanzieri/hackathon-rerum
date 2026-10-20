<<<<<<< HEAD
import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Leaf,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { apiUrl } from '../api';

export default function LoginPage() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          remember: form.get('remember') === 'on',
        }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('O servidor retornou uma resposta inválida.');
      }
      const detail = Array.isArray(data.detail)
        ? data.detail.map((item) => item.msg).join(' ')
        : data.detail;
      if (!response.ok) throw new Error(detail || 'Não foi possível entrar.');
      if (!data.user) throw new Error('Resposta inválida do servidor.');
      window.location.hash = 'workspace';
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'Não foi possível conectar ao servidor. Tente novamente.'
          : requestError instanceof Error
            ? requestError.message
            : 'Não foi possível entrar. Tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="Sobre o AkiNutri">
        <a className="login-brand" href="#workspace" aria-label="AkiNutri · Página inicial">
          <span className="login-brand__icon">
            <Leaf size={24} aria-hidden="true" />
          </span>
          <span>
            AkiNutri<span>.</span>
          </span>
        </a>
        <div className="login-story__content">
          <span className="login-overline">
            <Sprout size={15} aria-hidden="true" /> NUTRIÇÃO DE PRECISÃO
          </span>
          <h1>Decisões melhores começam com clareza.</h1>
          <p>
            Um espaço para formular, comparar e entender cada decisão na nutrição do seu rebanho.
          </p>
          <div className="login-highlight">
            <div className="login-highlight__icon">
              <ShieldCheck size={21} aria-hidden="true" />
            </div>
            <div>
              <strong>Ciência em cada escolha</strong>
              <span>Regras transparentes. Resultados que você pode conferir.</span>
            </div>
          </div>
        </div>
        <div className="login-story__footer">
          <span className="login-story__dot" />
          Projeto RERUM · UFJF
          <span>POC local · 2026</span>
        </div>
        <div className="login-orbit login-orbit--one" aria-hidden="true" />
        <div className="login-orbit login-orbit--two" aria-hidden="true" />
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <span className="login-mobile-brand">
            <Leaf size={21} aria-hidden="true" /> AkiNutri
          </span>
          <span className="login-kicker">BEM-VINDO DE VOLTA</span>
          <h2 id="login-title">Acesse sua conta</h2>
          <p className="login-intro">Entre para continuar cuidando de cada detalhe.</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">E-mail</label>
            <input
              autoComplete="username"
              id="login-email"
              name="email"
              placeholder="voce@exemplo.com"
              required
              type="email"
            />

            <div className="login-password-heading">
              <label htmlFor="login-password">Senha</label>
              <span>Esqueceu a senha?</span>
            </div>
            <div className="login-password">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                placeholder="Digite sua senha"
                required
                type={passwordVisible ? 'text' : 'password'}
              />
              <button
                aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                className="login-password__toggle"
                onClick={() => setPasswordVisible((visible) => !visible)}
                type="button"
              >
                {passwordVisible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <label className="login-remember">
              <input name="remember" type="checkbox" />
              <span>Manter conectado</span>
            </label>

            <button className="login-submit" disabled={loading} type="submit">
              {loading ? (
                <>
                  <LoaderCircle className="login-spinner" size={17} aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
            {error && (
              <p className="login-notice" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="login-demo-note">
            <span className="login-demo-note__dot" />
            <span>
              <strong>Privacidade da sessão</strong>
              <small>O token fica em um cookie HttpOnly, fora do JavaScript.</small>
            </span>
          </div>
          <p className="login-register-prompt">
            Não tem uma conta? <a href="/register">Cadastre-se</a>
          </p>
        </div>
        <p className="login-copyright">© 2026 AkiNutri · Desenvolvido para o Hackathon UFJF</p>
      </section>
    </main>
=======
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
>>>>>>> 69cc92da86f2c3b0c89ecee41bd8e5faed79aef4
  );
}
