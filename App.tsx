import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import InstitutionAdminPanel from './components/InstitutionAdminPanel';
import AccessDenied from './components/AccessDenied';
import RoleSelector from './components/RoleSelector';
import { UserRole } from './types';
import { onAuthChange, logout as firebaseLogout } from './services/authService';
import { getUserProfile, saveUserProfile } from './services/firestoreService';
import { checkSuperAdmin, checkInstitutionAdmin, checkApprovedUser, initializeDemoInstitution } from './services/adminService';
import { User } from 'firebase/auth';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Get user profile from Firestore
          const profile = await getUserProfile(firebaseUser.uid);
          
          if (profile && profile.role) {
            // User has a role set
            const role = profile.role as UserRole;
            setUserRole(role);
            setSelectedCollege(profile.collegeName || 'NeoLink Medical');
            setCollegeId(profile.collegeId || 'default');
            setShowAccessDenied(false);
            
            // If SuperAdmin, initialize demo institution if needed
            if (role === UserRole.SuperAdmin) {
              initializeDemoInstitution(firebaseUser.email!);
            }
          } else {
            // No profile yet - create default one
            await saveUserProfile(firebaseUser.uid, {
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || 'User',
              role: UserRole.Doctor, // Default role
              collegeName: 'NeoLink Medical',
              collegeId: 'default'
            });
            setUserRole(UserRole.Doctor);
            setSelectedCollege('NeoLink Medical');
            setCollegeId('default');
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        // User is signed out
        setUserRole(null);
        setSelectedCollege(null);
        setCollegeId(null);
        setShowAccessDenied(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleUpdated = async (newRole: UserRole) => {
    setUserRole(newRole);
    // Force page reload to apply new role
    window.location.reload();
  };

  const handleLogout = async () => {
    try {
      await firebaseLogout();
      setUser(null);
      setUserRole(null);
      setSelectedCollege(null);
      setCollegeId(null);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Show loading state
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

  // Show login if not authenticated
  if (!user) {
    return <Login />;
  }

  // Show access denied if flagged
  if (showAccessDenied) {
    return <AccessDenied />;
  }

  // Show SuperAdmin Dashboard (highest priority)
  if (showAdminPanel && userRole === UserRole.SuperAdmin) {
    return <SuperAdminDashboard userEmail={user.email!} onBack={() => setShowAdminPanel(false)} />;
  }

  // Show Institution Admin Panel (only if NOT SuperAdmin)
  if (showAdminPanel && userRole === UserRole.InstitutionAdmin) {
    if (!collegeId || collegeId === 'default') {
      // No institution assigned yet
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl p-8 text-center max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">No Institution Assigned</h2>
            <p className="text-slate-400 mb-6">
              You need to be assigned to an institution by a SuperAdmin before you can manage users.
            </p>
            <button
              onClick={() => setShowAdminPanel(false)}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return <InstitutionAdminPanel institutionId={collegeId} userEmail={user.email!} onBack={() => setShowAdminPanel(false)} />;
  }

  // Show dashboard if fully authenticated and profile complete
  return (
    <div className="bg-slate-900 min-h-screen text-slate-300 font-sans">
      <Header 
        userRole={userRole!} 
        onLogout={handleLogout} 
        userName={user.displayName || 'User'}
        collegeName={selectedCollege || ''}
      />
      <main>
        {/* Role Selector */}
        {user && userRole && (
          <div className="container mx-auto p-4 sm:p-6">
            <RoleSelector
              userId={user.uid}
              currentRole={userRole}
              userEmail={user.email!}
              onRoleUpdated={handleRoleUpdated}
            />
            
            {/* Admin Panel Button */}
            {(userRole === UserRole.SuperAdmin || userRole === UserRole.InstitutionAdmin) && (
              <div className="mb-6">
                <button
                  onClick={() => {
                    console.log('Opening admin panel for role:', userRole);
                    setShowAdminPanel(true);
                  }}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 shadow-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {userRole === UserRole.SuperAdmin ? 'Open SuperAdmin Dashboard' : 'Open Admin Panel'}
                </button>
              </div>
            )}
          </div>
        )}
        
        <Dashboard userRole={userRole!} />
      </main>
    </div>
  );
}

export default App;
