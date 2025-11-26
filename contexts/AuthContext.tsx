import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, ViewState } from '../types';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  '/api';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  view: ViewState;
  setView: (view: ViewState) => void;
  csrfToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.LOGIN);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const getCsrfFromCookie = () => {
    const entry = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('csrf_token='));
    return entry ? entry.split('=')[1] : null;
  };

  const mapUser = (raw: any): User => ({
    id: raw.id,
    username: raw.email,
    role: raw.role === 'admin' ? 'admin' : 'user',
    name: raw.full_name,
    email: raw.email,
    groupId: raw.group?.id ?? raw.group_id,
    groupName: raw.group?.name,
    status: raw.status || 'active',
    expirationDate: raw.expiration_date,
  });

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Identifiants invalides');
    }

    const data = await response.json();
    const mappedUser = mapUser(data.user);
    setUser(mappedUser);
    setAccessToken(data.access_token);
    setCsrfToken(data.csrf_token);
    setView(mappedUser.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD);
  };

  const refresh = async () => {
    const csrf = csrfToken || getCsrfFromCookie();
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
    });

    if (!response.ok) {
      setUser(null);
      setAccessToken(null);
      setView(ViewState.LOGIN);
      return;
    }

    const data = await response.json();
    const mappedUser = mapUser(data.user);
    setUser(mappedUser);
    setAccessToken(data.access_token);
    setCsrfToken(data.csrf_token);
    setView(mappedUser.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setView(ViewState.LOGIN);
  };

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, csrfToken, isLoading, view, setView, login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
