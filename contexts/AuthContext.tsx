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
  refresh: (showLoading?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>(ViewState.LOGIN);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const getCsrfFromCookie = () => {
    const entry = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('csrf_token='));
    return entry ? entry.split('=')[1] : null;
  };

  // Fonctions de persistance localStorage
  const saveViewToStorage = (view: ViewState) => {
    try {
      localStorage.setItem('preview_dicom_view', view);
    } catch (error) {
      console.warn('Could not save view to localStorage:', error);
    }
  };

  const loadViewFromStorage = (): ViewState | null => {
    try {
      const saved = localStorage.getItem('preview_dicom_view');
      if (saved && Object.values(ViewState).includes(saved as ViewState)) {
        return saved as ViewState;
      }
    } catch (error) {
      console.warn('Could not load view from localStorage:', error);
    }
    return null;
  };

  const clearViewFromStorage = () => {
    try {
      localStorage.removeItem('preview_dicom_view');
    } catch (error) {
      console.warn('Could not clear view from localStorage:', error);
    }
  };

  // Fonction setView avec sauvegarde automatique
  const setView = (newView: ViewState) => {
    setViewState(newView);
    saveViewToStorage(newView);
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
    const defaultView = mappedUser.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD;
    setView(defaultView);
  };

  const refresh = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const csrf = csrfToken || getCsrfFromCookie();
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
      });

      if (!response.ok) {
        throw new Error('Impossible de rafraîchir la session');
      }

      const data = await response.json();
      const mappedUser = mapUser(data.user);
      setUser(mappedUser);
      setAccessToken(data.access_token);
      setCsrfToken(data.csrf_token);

      // Restaurer la vue sauvegardée si compatible avec le rôle
      const savedView = loadViewFromStorage();
      let targetView: ViewState;

      if (savedView && savedView !== ViewState.LOGIN) {
        // Vérifier que la vue sauvegardée est compatible avec le rôle
        const isAdminView = savedView === ViewState.ADMIN_DASHBOARD;
        const isUserAdmin = mappedUser.role === 'admin';

        if (isAdminView && isUserAdmin) {
          // Admin peut voir ADMIN_DASHBOARD
          targetView = savedView;
        } else if (!isAdminView && savedView === ViewState.USER_DASHBOARD) {
          // Tout le monde peut voir USER_DASHBOARD
          targetView = savedView;
        } else {
          // Vue incompatible, utiliser la vue par défaut
          targetView = mappedUser.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD;
        }
      } else {
        // Pas de vue sauvegardée, utiliser la vue par défaut
        targetView = mappedUser.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD;
      }

      setView(targetView);
    } catch (error) {
      console.error('[AuthContext] Refresh failed:', error);
      console.error('[AuthContext] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      setUser(null);
      setAccessToken(null);
      setViewState(ViewState.LOGIN);
      clearViewFromStorage();
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setViewState(ViewState.LOGIN);
    clearViewFromStorage();
  };

  useEffect(() => {
    refresh(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, accessToken, csrfToken, isLoading, view: viewState, setView, login, logout, refresh }}
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
