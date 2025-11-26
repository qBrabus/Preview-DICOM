import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Login } from './components/Login';
import { PatientDashboard } from './components/PatientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ViewState } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const queryClient = new QueryClient();

const RoutedApp: React.FC = () => {
  const { user, isLoading, view, setView } = useAuth();

  const derivedView = React.useMemo(() => {
    if (!user) return ViewState.LOGIN;
    return view === ViewState.LOGIN
      ? user.role === 'admin'
        ? ViewState.ADMIN_DASHBOARD
        : ViewState.USER_DASHBOARD
      : view;
  }, [user, view]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">Chargement de la session...</div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (derivedView === ViewState.ADMIN_DASHBOARD && user.role === 'admin') {
    return <AdminDashboard onNavigate={setView} />;
  }

  return <PatientDashboard onNavigate={setView} />;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RoutedApp />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
