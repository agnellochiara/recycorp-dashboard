import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, isAdmin: false, user: null });

  const refresh = useCallback(async () => {
    const s = await authService.getSession();
    setState({ loading: false, ...s });
  }, []);

  useEffect(() => {
    refresh();
    const off = authService.onChange(refresh);
    return off;
  }, [refresh]);

  const signIn = useCallback(async (credentials) => {
    const res = await authService.signIn(credentials);
    if (res.ok) await refresh();
    return res;
  }, [refresh]);

  const signOut = useCallback(async () => {
    await authService.signOut();
    await refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...state, mode: authService.mode, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
