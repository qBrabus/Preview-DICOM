import React, { useState } from 'react';
import { Login } from './components/Login';
import { PatientDashboard } from './components/PatientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { User, ViewState } from './types';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.LOGIN);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView(user.role === 'admin' ? ViewState.ADMIN_DASHBOARD : ViewState.USER_DASHBOARD);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(ViewState.LOGIN);
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
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
