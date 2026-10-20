import React, { useEffect } from 'react';
import { navigate } from '../navigation';
export default function AuthGuard({ auth, children }) {
  useEffect(() => {
    if (!auth.checking && !auth.user)
      navigate('/login', { replace: true, state: { from: window.location.pathname } });
  }, [auth.checking, auth.user]);
  if (auth.checking || !auth.user)
    return (
      <div className="route-loading" role="status">
        Verificando acesso…
      </div>
    );
  return children;
}
