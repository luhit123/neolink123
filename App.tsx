import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import CollegeSelection from './components/CollegeSelection';
import { UserRole } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';

function App() {
  const [userRole, setUserRole] = useLocalStorage<UserRole | null>('userRole', null);
  const [selectedCollege, setSelectedCollege] = useState<string | null>(
    localStorage.getItem('collegeName')
  );

  const handleSelectCollege = (collegeName: string) => {
    localStorage.setItem('collegeName', collegeName);
    setSelectedCollege(collegeName);
  };

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
  };

  const handleLogout = () => {
    setUserRole(null);
    // Don't clear college selection on logout, keep it for next login
  };

  // If no college selected, show college selection
  if (!selectedCollege) {
    return <CollegeSelection onSelectCollege={handleSelectCollege} />;
  }

  return (
    <div className="bg-slate-900 min-h-screen text-slate-300 font-sans">
      {userRole ? (
        <>
          <Header userRole={userRole} onLogout={handleLogout} />
          <main>
            <Dashboard userRole={userRole} />
          </main>
        </>
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </div>
  );
}

export default App;
