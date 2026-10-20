export const paths = {
  home: '/',
  sobre: '/sobre',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  workspace: '/dashboard',
  comparacao: '/dashboard/comparacao',
  batida: '/dashboard/batida',
  insumos: '/dashboard/insumos',
  regras: '/dashboard/regras',
  historico: '/dashboard/historico',
  resultado: '/dashboard/resultado',
  animais: '/dashboard/animais',
};
export const isProtectedPath = (path) => path === '/dashboard' || path.startsWith('/dashboard/');
export function currentRoute() {
  // One-time migration of old bookmarks; all subsequent routing uses pathname.
  const legacy = new URL(window.location.href).hash.slice(1);
  if (window.location.pathname === '/' && paths[legacy]) {
    window.history.replaceState(window.history.state, '', paths[legacy]);
  }
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/dashboard') return 'workspace';
  return Object.keys(paths).find((key) => paths[key] === path) || 'notfound';
}
export function navigate(path, { replace = false, state = null } = {}) {
  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin) return;
  window.history[replace ? 'replaceState' : 'pushState'](
    state,
    '',
    target.pathname + target.search,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function interceptNavigation(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const anchor = event.target.closest?.('a[href]');
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
  const target = new URL(anchor.href, window.location.origin);
  if (
    target.origin !== window.location.origin ||
    target.hash ||
    target.pathname === '/docs' ||
    !Object.values(paths).includes(target.pathname)
  )
    return;
  event.preventDefault();
  navigate(target.pathname + target.search);
}
