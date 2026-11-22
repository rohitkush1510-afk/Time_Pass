import { createContext, useContext, useState, useEffect } from 'react';
import { request } from '../api';

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

function readSavedUser() {
  try {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSavedUser);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')));

  // restore/verify the session on refresh using the token we stored
  useEffect(() => {
    if (!localStorage.getItem('token')) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const me = await request('/auth/me');
        if (!cancelled) {
          setUser(me);
          localStorage.setItem('user', JSON.stringify(me));
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  async function login(email, password) {
    const data = await request('/auth/login', 'POST', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(name, email, password, role) {
    await request('/auth/register', 'POST', { name, email, password, role });
    return login(email, password); // log him in right after registering
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
