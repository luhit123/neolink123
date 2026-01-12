import React, { useState } from 'react';
import { Medication, MedicationDatabase } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import MedicationAutocomplete from './MedicationAutocomplete';

interface MedicationManagementProps {
    medications: Medication[];
    onUpdate: (medications: Medication[]) => void;
    userRole: string;
    userName?: string;
    userEmail?: string;
    readOnly?: boolean;
}

const MedicationManagement: React.FC<MedicationManagementProps> = ({
    medications,
    onUpdate,
    userRole,
    userName,
    userEmail,
    readOnly = false
}) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newMedication, setNewMedication] = useState<Medication>({
        name: '',
        dose: '',
        route: 'IV',
        frequency: 'Continuous Infusion'
    });

    const handleSelectMedication = (medication: MedicationDatabase) => {
        // Auto-fill dose, route, and frequency from database
        setNewMedication({
            name: medication.name,
            dose: medication.commonDoses?.[0] || '', // Use first common dose
            route: medication.routes?.[0] || 'IV', // Use first route
            frequency: medication.frequencies?.[0] || 'TID', // Use first frequency
        });
    };

    const handleAddMedication = () => {
        if (newMedication.name.trim() && newMedication.dose.trim()) {
            const medicationWithMeta = {
                ...newMedication,
                addedBy: userName || userEmail || userRole,
                addedAt: new Date().toISOString(),
                startDate: new Date().toISOString(), // Track when medication was started
                isActive: true, // Medication is active by default
                isCustom: false // Will be set to true if not from database
            };
            onUpdate([...medications, medicationWithMeta]);
            setNewMedication({ name: '', dose: '', route: 'IV', frequency: 'Continuous Infusion' });
            setShowAddForm(false);
        }
    };

    const handleStopMedication = (index: number) => {
        if (confirm('Stop this medication? This will mark it as stopped.')) {
            const updatedMedications = medications.map((med, i) => {
                if (i === index) {
                    return {
                        ...med,
                        isActive: false,
                        stopDate: new Date().toISOString(),
                        stoppedBy: userName || userEmail || userRole,
                        stoppedAt: new Date().toISOString()
                    };
                }
                return med;
            });
            onUpdate(updatedMedications);
        }
    };

    const handleRemoveMedication = (index: number) => {
        if (confirm('Remove this medication permanently from the list?')) {
            onUpdate(medications.filter((_, i) => i !== index));
        }
    };

    const handleEditMedication = (index: number) => {
        const med = medications[index];
        setNewMedication(med);
        setShowAddForm(true);
        // Remove the old entry
        onUpdate(medications.filter((_, i) => i !== index));
    };

    const calculateDaysRunning = (startDate: string, stopDate?: string): number => {
        const start = new Date(startDate);
        const end = stopDate ? new Date(stopDate) : new Date();
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const groupedMedications = medications.reduce((acc, med, index) => {
        const today = new Date().toDateString();
        const medDate = med.addedAt ? new Date(med.addedAt).toDateString() : today;
        const key = medDate === today ? 'Today' : medDate;

        if (!acc[key]) acc[key] = [];
        acc[key].push({ ...med, index });
        return acc;
    }, {} as Record<string, (Medication & { index: number })[]>);

    return (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg sm:rounded-xl border-2 border-purple-200 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-3 sm:px-5 py-3 sm:py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <svg className="w-5 sm:w-6 h-5 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white">Medication Management</h3>
                            <p className="text-xs text-purple-100">Nurses & Doctors can manage</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {medications.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="px-2 sm:px-3 py-1 bg-green-500/30 text-white text-xs font-bold rounded-full backdrop-blur-sm border border-green-300/30">
                                    {medications.filter(m => m.isActive !== false).length} Active
                                </span>
                                {medications.filter(m => m.isActive === false).length > 0 && (
                                    <span className="px-2 sm:px-3 py-1 bg-red-500/30 text-white text-xs font-bold rounded-full backdrop-blur-sm border border-red-300/30">
                                        {medications.filter(m => m.isActive === false).length} Stopped
                                    </span>
                                )}
                            </div>
                        )}
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() => setShowAddForm(!showAddForm)}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white hover:bg-purple-50 text-purple-700 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Add Med
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-3 sm:p-5 bg-white/60">
                {/* Add Medication Form */}
                <AnimatePresence>
                    {showAddForm && !readOnly && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 bg-gradient-to-br from-white to-purple-50 rounded-xl border-2 border-purple-200 p-3 sm:p-4 shadow-lg"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <h4 className="font-bold text-purple-800">Add New Medication</h4>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-purple-700 mb-1 flex items-center gap-2">
                                            Drug Name *
                                            <span className="text-[10px] text-purple-500 font-normal">(Type to search)</span>
                                        </label>
                                        <MedicationAutocomplete
                                            value={newMedication.name}
                                            onChange={(value) => setNewMedication({ ...newMedication, name: value })}
                                            onSelect={handleSelectMedication}
                                            placeholder="Type medication name..."
                                            className="w-full px-3 py-2 bg-white border-2 border-purple-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-purple-700 mb-1">Dose *</label>
                                        <input
                                            type="text"
                                            value={newMedication.dose}
                                            onChange={(e) => setNewMedication({ ...newMedication, dose: e.target.value })}
                                            placeholder="e.g., 50mg/kg"
                                            className="w-full px-3 py-2 bg-white border-2 border-purple-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-purple-700 mb-1">Route</label>
                                        <select
                                            value={newMedication.route}
                                            onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border-2 border-purple-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                                        >
                                            <option value="IV">IV</option>
                                            <option value="PO">PO (Oral)</option>
                                            <option value="IM">IM</option>
                                            <option value="SC">SC</option>
                                            <option value="Topical">Topical</option>
                                            <option value="Inhalation">Inhalation</option>
                                            <option value="NG">NG Tube</option>
                                            <option value="Rectal">Rectal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-purple-700 mb-1">Frequency</label>
                                        <select
                                            value={newMedication.frequency}
                                            onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border-2 border-purple-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400"
                                        >
                                            <option value="Continuous Infusion">Continuous Infusion</option>
                                            <option value="STAT">STAT (Once)</option>
                                            <option value="OD">OD (Once daily)</option>
                                            <option value="BD">BD (Twice daily)</option>
                                            <option value="TID">TID (Three times)</option>
                                            <option value="QID">QID (Four times)</option>
                                            <option value="Q4H">Q4H (Every 4 hours)</option>
                                            <option value="Q6H">Q6H (Every 6 hours)</option>
                                            <option value="Q8H">Q8H (Every 8 hours)</option>
                                            <option value="Q12H">Q12H (Every 12 hours)</option>
                                            <option value="PRN">PRN (As needed)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleAddMedication}
                                        disabled={!newMedication.name.trim() || !newMedication.dose.trim()}
                                        className="flex-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-lg text-sm font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        ✓ Add Medication
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddForm(false);
                                            setNewMedication({ name: '', dose: '', route: 'IV', frequency: 'Continuous Infusion' });
                                        }}
                                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Medications List */}
                {medications.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-purple-200">
                        <svg className="w-16 h-16 mx-auto mb-3 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <p className="text-slate-500 font-semibold">No medications added yet</p>
                        <p className="text-slate-400 text-sm mt-1">Click "Add Med" to add the first medication</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(groupedMedications).map(([date, meds]) => (
                            <div key={date}>
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-px flex-1 bg-purple-200"></div>
                                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wide">{date}</span>
                                    <div className="h-px flex-1 bg-purple-200"></div>
                                </div>

                                <div className="space-y-2">
                                    {meds.map((med) => {
                                        const isActive = med.isActive !== false; // Default to true if not set
                                        const daysRunning = med.startDate ? calculateDaysRunning(med.startDate, med.stopDate) : null;

                                        return (
                                            <motion.div
                                                key={med.index}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                className={`rounded-xl p-3 sm:p-4 border-2 transition-all shadow-sm hover:shadow-md ${
                                                    isActive
                                                        ? 'bg-white border-purple-100 hover:border-purple-300'
                                                        : 'bg-slate-50 border-slate-200 opacity-70'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                isActive
                                                                    ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                                                                    : 'bg-gradient-to-br from-slate-400 to-slate-500'
                                                            }`}>
                                                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                                                </svg>
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className="font-bold text-slate-800 text-sm sm:text-base">{med.name}</h4>
                                                                    {isActive ? (
                                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase">
                                                                            Running
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase">
                                                                            Stopped
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {med.isCustom && (
                                                                    <span className="text-[10px] text-orange-600 font-semibold">Custom Medication</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-2 ml-10">
                                                            <div>
                                                                <span className="text-xs text-purple-600 font-semibold block">Dose</span>
                                                                <span className="text-sm text-slate-700 font-medium">{med.dose}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-purple-600 font-semibold block">Route</span>
                                                                <span className="text-sm text-slate-700 font-medium">{med.route}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-purple-600 font-semibold block">Frequency</span>
                                                                <span className="text-sm text-slate-700 font-medium">{med.frequency}</span>
                                                            </div>
                                                        </div>

                                                        {/* Start Date and Days Running */}
                                                        {med.startDate && (
                                                            <div className="mt-2 ml-10 flex flex-wrap items-center gap-3">
                                                                <div className="flex items-center gap-1 text-xs">
                                                                    <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    <span className="text-slate-600">
                                                                        Started: <span className="font-semibold text-slate-800">{new Date(med.startDate).toLocaleDateString()}</span>
                                                                    </span>
                                                                </div>
                                                                {daysRunning !== null && (
                                                                    <div className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                                        {isActive ? 'Running' : 'Ran'} for {daysRunning} {daysRunning === 1 ? 'day' : 'days'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Stop Date */}
                                                        {med.stopDate && (
                                                            <div className="mt-2 ml-10 flex items-center gap-1 text-xs">
                                                                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                                <span className="text-slate-600">
                                                                    Stopped: <span className="font-semibold text-red-700">{new Date(med.stopDate).toLocaleDateString()}</span>
                                                                    {med.stoppedBy && <span className="ml-2 text-slate-500">by {med.stoppedBy}</span>}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {med.addedBy && (
                                                            <div className="mt-2 ml-10 text-xs text-slate-500">
                                                                Added by: <span className="font-semibold">{med.addedBy}</span>
                                                                {med.addedAt && ` • ${new Date(med.addedAt).toLocaleString()}`}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!readOnly && (
                                                        <div className="flex flex-col gap-1">
                                                            {isActive && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleStopMedication(med.index)}
                                                                    className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
                                                                    title="Stop medication"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                                                    </svg>
                                                                    <span className="hidden sm:inline">Stop</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEditMedication(med.index)}
                                                                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-all"
                                                                title="Edit"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMedication(med.index)}
                                                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                                                title="Remove"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MedicationManagement;
