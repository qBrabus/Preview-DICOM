import React, { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { PatientDashboard } from './components/PatientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { User, ViewState } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);

  useEffect(() => {
    const storedUser = localStorage.getItem('previewdcm:user');
    const storedView = localStorage.getItem('previewdcm:view');
    const storedToken = localStorage.getItem('previewdcm:token');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setCurrentUser(parsedUser);
        setAccessToken(storedToken);
        setCurrentView((storedView as ViewState) || ViewState.USER_DASHBOARD);
      } catch (error) {
        console.error('Failed to restore session', error);
        localStorage.removeItem('previewdcm:user');
        localStorage.removeItem('previewdcm:view');
      }
    }
  }, []);

  const handleLogin = (user: User, token: string) => {
    setCurrentUser(user);
    setAccessToken(token);
    const nextView = user.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD;
    setCurrentView(nextView);
    localStorage.setItem('previewdcm:user', JSON.stringify(user));
    localStorage.setItem('previewdcm:view', nextView);
    localStorage.setItem('previewdcm:token', token);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAccessToken(null);
    setCurrentView(ViewState.LOGIN);
    localStorage.removeItem('previewdcm:user');
    localStorage.removeItem('previewdcm:view');
    localStorage.removeItem('previewdcm:token');
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    localStorage.setItem('previewdcm:view', view);
  };

  // Render logic based on state
  if (currentView === ViewState.LOGIN) {
    return <Login onLogin={handleLogin} onNavigate={handleNavigate} />;
  }

  if (currentView === ViewState.ADMIN_DASHBOARD) {
    // Basic protection for admin route mock
    return <AdminDashboard onNavigate={handleNavigate} accessToken={accessToken} />;
  }

  // Default to User Dashboard if logged in
  if (currentUser) {
    return (
      <PatientDashboard
        user={currentUser}
        accessToken={accessToken}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />
    );
  }

  // Fallback
  return <Login onLogin={handleLogin} onNavigate={handleNavigate} />;
};

export default App;
