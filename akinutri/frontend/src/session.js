export const SESSION_KEY = 'akinutri.session.v1';
export const SESSION_DURATION = 8 * 60 * 60 * 1000;
export function validSession(value, now = Date.now()) {
  return (
    value?.version === 1 &&
    ['produtor', 'consultor'].includes(value.role) &&
    typeof value.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > now &&
    value.expiresAt <= now + SESSION_DURATION
  );
}
export function readSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    if (validSession(value)) return value;
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    clearSession();
  }
  return null;
}
export function createSession(email, role) {
  const value = {
    version: 1,
    email: email.trim().toLowerCase(),
    role,
    expiresAt: Date.now() + SESSION_DURATION,
  };
  if (!validSession(value)) throw new Error('Perfil ou e-mail inválido.');
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}
export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Clear the in-memory session regardless. */
  }
}
