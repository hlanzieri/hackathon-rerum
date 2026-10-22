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
  UserRound,
} from 'lucide-react';
import { apiUrl } from '../api';
import { storeToken } from '../authToken';
import { navigate } from '../navigation';

function requestErrorMessage(data) {
  if (Array.isArray(data.detail)) return data.detail.map((item) => item.msg).join(' ');
  return data.detail || 'Não foi possível criar sua conta.';
}

export default function RegisterPage({ onLogin } = {}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const nome = form.get('name').trim();
    const email = form.get('email').trim();
    const senha = form.get('password');
    const confirmPassword = form.get('confirm-password');

    if (senha !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/auth/register'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          email,
          senha,
          cargo: form.get('cargo'),
          fazenda_nome: form.get('fazenda_nome').trim(),
        }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('O servidor retornou uma resposta inválida.');
      }
      if (!response.ok) throw new Error(requestErrorMessage(data));
      if (!data.user) throw new Error('Resposta inválida do servidor.');
      storeToken(data.access_token, false);
      if (onLogin) await onLogin();
      else navigate('/dashboard');
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'Não foi possível conectar ao servidor. Tente novamente.'
          : requestError instanceof Error
            ? requestError.message
            : 'Não foi possível criar sua conta. Tente novamente.',
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
          <h1>Seu próximo passo começa aqui.</h1>
          <p>
            Crie sua conta para organizar formulações e tomar decisões com mais clareza para o seu
            rebanho.
          </p>
          <div className="login-highlight">
            <div className="login-highlight__icon">
              <ShieldCheck size={21} aria-hidden="true" />
            </div>
            <div>
              <strong>Uma conta, suas decisões</strong>
              <span>Seu acesso é protegido por uma sessão segura.</span>
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

      <section className="login-panel" aria-labelledby="register-title">
        <div className="login-form-wrap">
          <span className="login-mobile-brand">
            <Leaf size={21} aria-hidden="true" /> AkiNutri
          </span>
          <span className="login-kicker">COMECE POR AQUI</span>
          <h2 id="register-title">Crie sua conta</h2>
          <p className="login-intro">Preencha seus dados para acessar o AkiNutri.</p>

          <form className="login-form register-form" onSubmit={handleSubmit}>
            <label htmlFor="register-name">Nome</label>
            <div className="login-password">
              <UserRound size={17} aria-hidden="true" />
              <input
                autoComplete="name"
                id="register-name"
                maxLength={120}
                name="name"
                placeholder="Seu nome completo"
                required
                type="text"
              />
            </div>

            <label className="register-field-label" htmlFor="register-email">
              E-mail
            </label>
            <input
              autoComplete="email"
              id="register-email"
              name="email"
              placeholder="voce@exemplo.com"
              required
              type="email"
            />

            <label className="register-field-label" htmlFor="register-cargo">
              Perfil
            </label>
            <select id="register-cargo" name="cargo" aria-label="Perfil" defaultValue="produtor">
              <option value="produtor">Produtor</option>
              <option value="zootecnista">Zootecnista</option>
            </select>
            <label className="register-field-label" htmlFor="register-fazenda">
              Nome da fazenda
            </label>
            <input
              id="register-fazenda"
              name="fazenda_nome"
              maxLength="180"
              autoComplete="organization"
              placeholder="Sua propriedade"
            />
            <label className="register-field-label" htmlFor="register-password">
              Senha
            </label>
            <div className="login-password">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="new-password"
                id="register-password"
                minLength={8}
                name="password"
                placeholder="Mínimo de 8 caracteres"
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

            <label className="register-field-label" htmlFor="register-confirm-password">
              Confirmar senha
            </label>
            <div className="login-password">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="new-password"
                id="register-confirm-password"
                minLength={8}
                name="confirm-password"
                placeholder="Digite a senha novamente"
                required
                type={confirmationVisible ? 'text' : 'password'}
              />
              <button
                aria-label={confirmationVisible ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                className="login-password__toggle"
                onClick={() => setConfirmationVisible((visible) => !visible)}
                type="button"
              >
                {confirmationVisible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>

            <button className="login-submit register-submit" disabled={loading} type="submit">
              {loading ? (
                <>
                  <LoaderCircle className="login-spinner" size={17} aria-hidden="true" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </button>
            {error && (
              <p className="login-notice" role="alert">
                {error}
              </p>
            )}
          </form>

          <p className="login-register-prompt">
            Já tem uma conta? <a href="/login">Entrar</a>
          </p>
        </div>
        <p className="login-copyright">© 2026 AkiNutri · Desenvolvido para o Hackathon UFJF</p>
      </section>
    </main>
  );
}
