import React from 'react';
export default class RouteBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="route-loading" role="alert">
          <h1>Não foi possível abrir este módulo.</h1>
          <p>Seu histórico permanece na sua conta. Recarregue para tentar novamente.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Recarregar aplicativo
          </button>
          <a href="/" onClick={() => this.setState({ failed: false })}>
            Página inicial
          </a>
        </main>
      );
    return this.props.children;
  }
}
