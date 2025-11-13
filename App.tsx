import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { UserRole } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.Doctor);
  const [loading, setLoading] = useState(true);
  const [showSuperAdminPanel, setShowSuperAdminPanel] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        try {
          // Check if user exists in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            // User exists - get their role
            const userData = userDoc.data();
            setUserRole(userData.role || UserRole.Doctor);
          } else {
            // New user - create with Doctor role
            const newUserData = {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || 'User',
              role: UserRole.Doctor,
              createdAt: new Date().toISOString()
            };

            await setDoc(userRef, newUserData);
            setUserRole(UserRole.Doctor);
            console.log('✅ New user created with Doctor role:', firebaseUser.email);
          }
        } catch (error) {
          console.error('❌ Error managing user:', error);
        }
      } else {
        setUser(null);
        setUserRole(UserRole.Doctor);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setUserRole(UserRole.Doctor);
      setShowSuperAdminPanel(false);
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Login />;
  }

  // Show SuperAdmin Dashboard
  if (showSuperAdminPanel && userRole === UserRole.SuperAdmin) {
    return (
      <SuperAdminDashboard
        userEmail={user.email!}
        onBack={() => setShowSuperAdminPanel(false)}
      />
    );
  }

  // Main Application
  return (
    <div className="bg-slate-900 min-h-screen text-slate-300">
      <Header
        userRole={userRole}
        onLogout={handleLogout}
        userName={user.displayName || user.email || 'User'}
        collegeName="NeoLink Medical"
      />

      <main>
        <div className="container mx-auto p-4 sm:p-6">
          {/* User Info Card */}
          <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-cyan-500/20">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-slate-400 text-sm">Logged in as:</p>
                <p className="text-white font-semibold">{user.email}</p>
                <p className="text-cyan-400 text-sm mt-1">Role: {userRole}</p>
              </div>

              {/* SuperAdmin Panel Button */}
              {userRole === UserRole.SuperAdmin && (
                <button
                  onClick={() => setShowSuperAdminPanel(true)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  SuperAdmin Dashboard
                </button>
              )}
            </div>
          </div>

          <Dashboard userRole={userRole} />
        </div>
      </main>
    </div>
  );
}

export default App;
