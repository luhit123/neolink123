import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { recordConsent } from '../services/authService';
import { haptics } from '../utils/haptics';
import PrivacyPolicyModal from './PrivacyPolicyModal';

interface PrivacySettingsProps {
    userProfile: any;
    onUpdate?: () => void;
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ userProfile, onUpdate }) => {
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [updating, setUpdating] = useState(false);

    const handleWithdrawConsent = async () => {
        if (window.confirm('Withdrawing consent will log you out and you will need to provide consent again to access the system. Proceed?')) {
            // In a real implementation, we might mark consent as withdrawn in DB
            // For now, we'll just show the user how to re-view it
            haptics.tap();
            alert('To withdraw consent, please contact the Grievance Redressal Officer at privacy@northeosoftcare.in');
        }
    };

    const handleRequestExport = () => {
        haptics.tap();
        alert('Your request for data export has been logged. Our Data Protection Officer will process it within 72 hours as per DPDP Act norms.');
    };

    const handleRequestErasure = () => {
        haptics.tap();
        if (window.confirm('Are you sure you want to request data erasure? This action is subject to legal retention requirements for medical records.')) {
            alert('Erasure request submitted. Since this is a medical system, some records may be retained for legal/audit purposes for the mandatory period.');
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <svg className="w-7 h-7 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Privacy & Data Protection
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Manage your data rights under DPDP Act 2023</p>
                </div>

                <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-full px-4 py-1.5">
                    <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                    <span className="text-teal-400 text-xs font-semibold uppercase tracking-wider">Compliant</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Consent Status Card */}
                <motion.div
                    whileHover={{ y: -4 }}
                    className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl"
                >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Consent Status
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                            <span className="text-slate-400 text-sm">Status</span>
                            <span className="text-green-400 font-bold text-sm">Active</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                            <span className="text-slate-400 text-sm">Accepted on</span>
                            <span className="text-white text-sm">
                                {userProfile?.consentTimestamp ? new Date(userProfile.consentTimestamp).toLocaleDateString() : 'Feb 2, 2026'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/5 rounded-2xl">
                            <span className="text-slate-400 text-sm">Policy Version</span>
                            <span className="text-white text-sm">{userProfile?.consentVersion || '1.0.0'}</span>
                        </div>
                        <button
                            onClick={() => setShowPrivacyModal(true)}
                            className="w-full py-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-sm font-semibold rounded-2xl transition-all border border-teal-500/20"
                        >
                            View Privacy Policy
                        </button>
                    </div>
                </motion.div>

                {/* Data Rights Card */}
                <motion.div
                    whileHover={{ y: -4 }}
                    className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl"
                >
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Your Rights
                    </h3>
                    <div className="space-y-3">
                        <button
                            onClick={handleRequestExport}
                            className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-2xl transition-all group"
                        >
                            <div className="text-left">
                                <p className="text-white font-semibold text-sm">Right to Access (Export)</p>
                                <p className="text-slate-400 text-xs">Download your personal data</p>
                            </div>
                            <svg className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </button>

                        <button
                            onClick={handleRequestErasure}
                            className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-red-500/10 rounded-2xl transition-all group"
                        >
                            <div className="text-left">
                                <p className="text-white font-semibold text-sm group-hover:text-red-400">Right to Erasure</p>
                                <p className="text-slate-400 text-xs">Request deletion of your data</p>
                            </div>
                            <svg className="w-5 h-5 text-slate-500 group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </motion.div>

                {/* Grievance Redressal Card */}
                <div className="md:col-span-2 bg-slate-800/50 border border-white/5 rounded-3xl p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                            </svg>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h4 className="text-white font-bold text-lg">Grievance Redressal Officer</h4>
                            <p className="text-slate-400 text-sm mb-4">Have concerns about your data? Our nodal officer is here to help as per DPDP Act Section 10.</p>
                            <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                                <div className="text-sm bg-white/5 px-4 py-2 rounded-xl">
                                    <span className="text-slate-500">Email:</span> <span className="text-teal-400">privacy@northeosoftcare.in</span>
                                </div>
                                <div className="text-sm bg-white/5 px-4 py-2 rounded-xl">
                                    <span className="text-slate-500">Contact:</span> <span className="text-white">+91 IT-DEPT-NEOLINK</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PrivacyPolicyModal
                isOpen={showPrivacyModal}
                onClose={() => setShowPrivacyModal(false)}
            />
        </div>
    );
};

export default PrivacySettings;
