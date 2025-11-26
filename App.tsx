import React, { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { PatientDashboard } from './components/PatientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { User, ViewState } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);

  useEffect(() => {
    const storedUser = localStorage.getItem('previewdcm:user');
    const storedView = localStorage.getItem('previewdcm:view');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        setCurrentUser(parsedUser);
        setCurrentView((storedView as ViewState) || ViewState.USER_DASHBOARD);
      } catch (error) {
        console.error('Failed to restore session', error);
        localStorage.removeItem('previewdcm:user');
        localStorage.removeItem('previewdcm:view');
      }
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView(user.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD);
    localStorage.setItem('previewdcm:user', JSON.stringify(user));
    localStorage.setItem(
      'previewdcm:view',
      user.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD,
    );
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(ViewState.LOGIN);
    localStorage.removeItem('previewdcm:user');
    localStorage.removeItem('previewdcm:view');
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
    return <AdminDashboard onNavigate={handleNavigate} />;
  }

  // Default to User Dashboard if logged in
  if (currentUser) {
    return (
      <PatientDashboard 
        user={currentUser} 
        onLogout={handleLogout} 
        onNavigate={handleNavigate} 
      />
    );
  }

  // Fallback
  return <Login onLogin={handleLogin} onNavigate={handleNavigate} />;
};

export default App;
