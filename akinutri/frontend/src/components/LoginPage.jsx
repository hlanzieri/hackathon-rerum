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
import { storeToken } from '../authToken';
import { navigate } from '../navigation';

export default function LoginPage({ onLogin } = {}) {
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
      storeToken(data.access_token, form.get('remember') === 'on');
      if (onLogin) await onLogin();
      else navigate('/dashboard');
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
        <a className="login-brand" href="/" aria-label="AkiNutri · Página inicial">
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
          <span>Gestão nutricional · 2026</span>
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
              <span>Use a senha cadastrada</span>
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
              <small>Seu acesso e seus registros ficam vinculados à sua conta.</small>
            </span>
          </div>
          <p className="login-register-prompt">
            Não tem uma conta? <a href="/register">Cadastre-se</a>
          </p>
        </div>
        <p className="login-copyright">© 2026 AkiNutri · Desenvolvido para o Hackathon UFJF</p>
      </section>
    </main>
  );
}
