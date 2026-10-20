export const TOKEN_KEY = 'akinutri.access_token.v1';
export function readToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* identity still clears in memory */
  }
}
export function storeToken(token, remember = false) {
  if (typeof token !== 'string' || !token)
    throw new Error('Não foi possível confirmar a credencial de acesso.');
  clearToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    throw new Error('Permita o armazenamento da sessão no navegador para entrar.');
  }
}
