import React from 'react';
import { Leaf } from 'lucide-react';
export default function PublicHeader() {
  return (
    <>
      <a
        className="skip-link"
        href=""
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('public-content')?.focus();
        }}
      >
        Ir para o conteúdo
      </a>
      <header className="public-header">
        <a className="brand" href="/" aria-label="AkiNutri · Início">
          <span className="brand-icon">
            <Leaf size={27} aria-hidden="true" />
          </span>
          <span>
            AkiNutri<span className="brand-dot">.</span>
            <small>NUTRIÇÃO EXPLICÁVEL</small>
          </span>
        </a>
        <nav aria-label="Navegação institucional">
          <a href="/sobre">Como funciona</a>
          <a className="button primary" href="/dashboard">
            Acessar painel
          </a>
        </nav>
      </header>
    </>
  );
}
