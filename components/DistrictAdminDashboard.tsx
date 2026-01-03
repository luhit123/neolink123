import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Institution } from '../types';
import { ASSAM_DISTRICTS } from '../constants';

interface DistrictAdminDashboardProps {
    userEmail: string;
    onLogout: () => void;
    onViewInstitution: (institutionId: string, institutionName: string) => void;
}

const DistrictAdminDashboard: React.FC<DistrictAdminDashboardProps> = ({ userEmail, onLogout, onViewInstitution }) => {
    const [assignedDistrict, setAssignedDistrict] = useState<string | null>(null);
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // 1. Fetch District Admin's assigned district
    useEffect(() => {
        const fetchDistrict = async () => {
            try {
                const usersRef = collection(db, 'approved_users');
                const q = query(usersRef, where('email', '==', userEmail.toLowerCase())); // Ensure case insensitivity
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const userData = snapshot.docs[0].data();
                    if (userData.assignedDistrict) {
                        setAssignedDistrict(userData.assignedDistrict);
                    } else {
                        setError('No district assigned to your account. Please contact Super Admin.');
                        setLoading(false);
                    }
                } else {
                    // Fallback check in 'users' collection if not in approved_users (though role usually comes from approved_users)
                    setError('User profile not found.');
                    setLoading(false);
                }
            } catch (err: any) {
                console.error('Error fetching district admin profile:', err);
                setError('Failed to load profile.');
                setLoading(false);
            }
        };

        fetchDistrict();
    }, [userEmail]);

    // 2. Fetch Institutions for the assigned district
    useEffect(() => {
        if (!assignedDistrict) return;

        setLoading(true);
        const institutionsRef = collection(db, 'institutions');
        const q = query(institutionsRef, where('district', '==', assignedDistrict));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            } as Institution));
            setInstitutions(data);
            setLoading(false);
        }, (err) => {
            console.error('Error fetching district institutions:', err);
            setError('Failed to load institutions for your district.');
            setLoading(false);
        });

        return () => unsubscribe();
    }, [assignedDistrict]);

    if (loading && !assignedDistrict) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            {/* Navbar */}
            <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform duration-300">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    District Admin Portal
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    {assignedDistrict ? `${assignedDistrict} District` : 'Loading...'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{userEmail}</span>
                                <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                    District Admin
                                </span>
                            </div>
                            <button
                                onClick={onLogout}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors shadow-sm hover:shadow"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-100 dark:border-slate-700/50">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Institutions</p>
                                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{institutions.length}</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Institutions List */}
                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Healthcare Institutions in {assignedDistrict}</h2>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse bg-white dark:bg-slate-800 rounded-xl h-64 shadow-lg"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {institutions.map(inst => (
                            <div key={inst.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                                <div className="p-6 flex-grow">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-2">{inst.name}</h3>
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full dark:bg-green-900/30 dark:text-green-300 whitespace-nowrap">
                                            Active
                                        </span>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <span className="w-24 text-slate-400">Type:</span>
                                            <span className="font-medium">{inst.institutionType || 'General'}</span>
                                        </div>
                                        <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <span className="w-24 text-slate-400">Facilities:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {inst.facilities?.map(f => (
                                                    <span key={f} className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                                                        {f}
                                                    </span>
                                                )) || <span className="text-slate-400 italic">None listed</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                                            <span className="w-24 text-slate-400">Admin:</span>
                                            <span className="truncate" title={inst.adminEmail}>{inst.adminEmail}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
                                    <button
                                        onClick={() => onViewInstitution(inst.id, inst.name)}
                                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>Access Dashboard</span>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DistrictAdminDashboard;
