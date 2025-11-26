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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">Chargement de la session...</div>
    );
  }

  if (!user && view === ViewState.LOGIN) {
    return <Login />;
  }

  if (view === ViewState.ADMIN_DASHBOARD && user?.role === 'admin') {
    return <AdminDashboard onNavigate={setView} />;
  }

  if (user) {
    return <PatientDashboard onNavigate={setView} />;
  }

  return <Login />;
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
