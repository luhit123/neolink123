import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrivacyPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Privacy Policy & Data Protection
                            </h3>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                                aria-label="Close"
                            >
                                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-300">
                            <section>
                                <h4 className="text-white font-semibold mb-2">1. Compliance with DPDP Act 2023</h4>
                                <p className="text-sm leading-relaxed">
                                    NeoLink is committed to protecting your personal data in accordance with India&apos;s Digital Personal Data Protection (DPDP) Act 2023. As a government EHR system, we handle Protected Health Information (PHI) with the highest level of security and accountability.
                                </p>
                            </section>

                            <section>
                                <h4 className="text-white font-semibold mb-2">2. Purpose of Data Collection</h4>
                                <p className="text-sm leading-relaxed">
                                    Data is collected solely for the purpose of providing healthcare services, clinical documentation, medical research, and hospital administration. This includes patient demographics, medical history, and clinical notes.
                                </p>
                            </section>

                            <section>
                                <h4 className="text-white font-semibold mb-2">3. Data Residency & Sovereignty</h4>
                                <p className="text-sm leading-relaxed">
                                    All personal data is processed and stored on secure servers located within the territory of India (Mumbai Region). We ensure that no sensitive personal data is transferred outside India without explicit government authorization.
                                </p>
                            </section>

                            <section>
                                <h4 className="text-white font-semibold mb-2">4. Your Rights (Data Principal)</h4>
                                <ul className="text-sm list-disc pl-5 space-y-1">
                                    <li><strong>Right to Access:</strong> You can request a summary of the personal data being processed.</li>
                                    <li><strong>Right to Correction:</strong> You can request correction of inaccurate or incomplete data.</li>
                                    <li><strong>Right to Erasure:</strong> You can request deletion of data when it is no longer necessary for the specified purpose.</li>
                                    <li><strong>Right to Grievance Redressal:</strong> You have the right to register a complaint regarding data processing.</li>
                                </ul>
                            </section>

                            <section>
                                <h4 className="text-white font-semibold mb-2">5. Data Minimization</h4>
                                <p className="text-sm leading-relaxed">
                                    We follow the principle of data minimization—collecting only what is specifically required for healthcare delivery and clinical outcomes.
                                </p>
                            </section>

                            <section className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl">
                                <h4 className="text-teal-400 font-semibold mb-1">Grievance Redressal Officer</h4>
                                <p className="text-xs text-slate-400 italic mb-2">As required under Section 10 of DPDP Act 2023</p>
                                <div className="text-sm">
                                    <p><strong>Name:</strong> Nodal Officer, IT Department</p>
                                    <p><strong>Organization:</strong> Northeo Softcare Solutions</p>
                                    <p><strong>Email:</strong> privacy@northeosoftcare.in</p>
                                </div>
                            </section>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/10 bg-slate-800/50 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/20"
                            >
                                Close & Return
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PrivacyPolicyModal;
