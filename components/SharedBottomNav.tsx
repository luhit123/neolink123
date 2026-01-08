import React from 'react';
import { haptics } from '../utils/haptics';

interface SharedBottomNavProps {
    activeTab: 'home' | 'patients' | 'analytics' | 'more';
    onTabChange: (tab: 'home' | 'patients' | 'analytics' | 'more') => void;
    onAddPatient: () => void;
    unreadReferrals?: number;
    className?: string;
    showAddButton?: boolean; // If we want to show the add button in the bar vs FAB handled externally
}

const SharedBottomNav: React.FC<SharedBottomNavProps> = ({
    activeTab,
    onTabChange,
    onAddPatient,
    unreadReferrals = 0,
    className = '',
    showAddButton = false
}) => {
    return (
        <div className={`fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-2xl z-50 px-2 py-2 safe-area-bottom ${className}`}>
            <div className="flex items-center justify-around max-w-md mx-auto">
                {/* Home */}
                <button
                    onClick={() => {
                        haptics.tap();
                        onTabChange('home');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 ${activeTab === 'home'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <svg className="w-5 h-5" fill={activeTab === 'home' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={activeTab === 'home'
                            ? "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" // Solid-ish for active
                            : "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"}
                        />
                        {/* Using simpler path for unselected home to match style */}
                        {activeTab === 'home' && <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor" stroke="none" />}
                        {activeTab !== 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="none" />}
                    </svg>
                    <span className="text-[10px] font-semibold">Home</span>
                </button>

                {/* Patients */}
                <button
                    onClick={() => {
                        haptics.tap();
                        onTabChange('patients');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 ${activeTab === 'patients'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-[10px] font-semibold">Patients</span>
                </button>

                {/* Add Patient - Optional center button if not using FAB */}
                {showAddButton && (
                    <button
                        onClick={() => {
                            haptics.tap();
                            onAddPatient();
                        }}
                        className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg -mt-4"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-[10px] font-semibold">Add</span>
                    </button>
                )}

                {/* Spacing for FAB if Add button is hidden */}
                {!showAddButton && <div className="w-12" />}

                {/* Analytics */}
                <button
                    onClick={() => {
                        haptics.tap();
                        onTabChange('analytics');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 ${activeTab === 'analytics'
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-slate-500 dark:text-slate-400'}`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-[10px] font-semibold">Analytics</span>
                </button>

                {/* More Actions */}
                <button
                    onClick={() => {
                        haptics.tap();
                        onTabChange('more');
                    }}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 ${activeTab === 'more'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'} relative`}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span className="text-[10px] font-semibold">More</span>
                    {unreadReferrals > 0 && (
                        <span className="absolute -top-0.5 right-2 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {unreadReferrals}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SharedBottomNav;
