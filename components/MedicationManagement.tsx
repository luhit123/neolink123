import React, { useState, useMemo } from 'react';
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
    patientName?: string;
    patientAge?: string;
    patientUnit?: string;
}

// Medication categories for color coding
const MEDICATION_CATEGORIES: Record<string, { color: string; bgColor: string; borderColor: string; icon: string }> = {
    'Antibiotic': { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-300', icon: '💊' },
    'Antifungal': { color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300', icon: '🦠' },
    'Inotrope': { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: '❤️' },
    'Vasopressor': { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-300', icon: '💓' },
    'IV Fluid': { color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300', icon: '💧' },
    'TPN': { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-300', icon: '🥛' },
    'Nutrition': { color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300', icon: '🍼' },
    'Analgesic': { color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-300', icon: '💉' },
    'Sedative': { color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300', icon: '😴' },
    'Anticonvulsant': { color: 'text-violet-700', bgColor: 'bg-violet-50', borderColor: 'border-violet-300', icon: '⚡' },
    'Respiratory': { color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-300', icon: '🫁' },
    'Cardiac': { color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-300', icon: '🫀' },
    'GI': { color: 'text-lime-700', bgColor: 'bg-lime-50', borderColor: 'border-lime-300', icon: '🩺' },
    'Vitamin': { color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: '✨' },
    'Other': { color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-300', icon: '💊' }
};

// Categorize medication based on name
const categorizeMedication = (name: string): string => {
    const lowerName = name.toLowerCase();

    // Antibiotics
    if (/ampicillin|amoxicillin|penicillin|gentamicin|amikacin|vancomycin|meropenem|cefotaxime|ceftazidime|ceftriaxone|cefepime|piperacillin|tazobactam|metronidazole|clindamycin|azithromycin|erythromycin|ciprofloxacin|levofloxacin|colistin|linezolid|teicoplanin/.test(lowerName)) {
        return 'Antibiotic';
    }
    // Antifungals
    if (/fluconazole|amphotericin|micafungin|caspofungin|voriconazole|nystatin/.test(lowerName)) {
        return 'Antifungal';
    }
    // Inotropes & Vasopressors
    if (/dopamine|dobutamine|epinephrine|adrenaline|norepinephrine|noradrenaline|milrinone|vasopressin|phenylephrine/.test(lowerName)) {
        return 'Inotrope';
    }
    // IV Fluids
    if (/normal saline|ns|dns|d5|d10|ringer|lactate|dextrose|isolyte|plasmalyte/.test(lowerName)) {
        return 'IV Fluid';
    }
    // TPN/Nutrition
    if (/tpn|parenteral|lipid|intralipid|smoflipid|aminoven|primene|vaminolact/.test(lowerName)) {
        return 'TPN';
    }
    if (/feed|milk|formula|ebm|breast|fortifier|enfamil|similac|nan|prenan/.test(lowerName)) {
        return 'Nutrition';
    }
    // Analgesics/Sedatives
    if (/morphine|fentanyl|paracetamol|acetaminophen|ibuprofen|tramadol/.test(lowerName)) {
        return 'Analgesic';
    }
    if (/midazolam|lorazepam|diazepam|chloral|dexmedetomidine|propofol|ketamine/.test(lowerName)) {
        return 'Sedative';
    }
    // Anticonvulsants
    if (/phenobarbital|phenobarbitone|phenytoin|levetiracetam|topiramate|valproate/.test(lowerName)) {
        return 'Anticonvulsant';
    }
    // Respiratory
    if (/caffeine|aminophylline|theophylline|salbutamol|albuterol|budesonide|surfactant|curosurf|beractant/.test(lowerName)) {
        return 'Respiratory';
    }
    // Cardiac
    if (/digoxin|captopril|enalapril|furosemide|lasix|spironolactone|hydrochlorothiazide|sildenafil|prostag|alprostadil|ibuprofen/.test(lowerName)) {
        return 'Cardiac';
    }
    // GI
    if (/ranitidine|omeprazole|pantoprazole|domperidone|metoclopramide|ondansetron|lactulose|glycerin/.test(lowerName)) {
        return 'GI';
    }
    // Vitamins
    if (/vitamin|multivitamin|iron|calcium|zinc|phosphorus|potassium|sodium|magnesium/.test(lowerName)) {
        return 'Vitamin';
    }

    return 'Other';
};

// Parse frequency to get time slots
const getTimeSlots = (frequency: string): string[] => {
    const freq = frequency?.toLowerCase() || '';
    if (freq.includes('continuous') || freq.includes('infusion')) return ['Continuous'];
    if (freq.includes('stat') || freq.includes('once')) return ['STAT'];
    if (freq.includes('od') || freq.includes('daily') || freq.includes('q24h')) return ['08:00'];
    if (freq.includes('bd') || freq.includes('q12h') || freq.includes('twice')) return ['08:00', '20:00'];
    if (freq.includes('tid') || freq.includes('q8h') || freq.includes('three')) return ['06:00', '14:00', '22:00'];
    if (freq.includes('qid') || freq.includes('q6h') || freq.includes('four')) return ['06:00', '12:00', '18:00', '24:00'];
    if (freq.includes('q4h')) return ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'];
    if (freq.includes('prn')) return ['PRN'];
    return ['As ordered'];
};

const MedicationManagement: React.FC<MedicationManagementProps> = ({
    medications,
    onUpdate,
    userRole,
    userName,
    userEmail,
    readOnly = false,
    patientName,
    patientAge,
    patientUnit
}) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
    const [showStopped, setShowStopped] = useState(false);
    const [newMedication, setNewMedication] = useState<Medication>({
        name: '',
        dose: '',
        route: 'IV',
        frequency: 'q12h'
    });

    // Separate active and stopped medications
    const activeMedications = useMemo(() =>
        medications.filter(m => m.isActive !== false), [medications]);
    const stoppedMedications = useMemo(() =>
        medications.filter(m => m.isActive === false), [medications]);

    // Group medications by category
    const groupedMedications = useMemo(() => {
        const groups: Record<string, (Medication & { index: number; category: string })[]> = {};

        activeMedications.forEach((med, idx) => {
            const category = categorizeMedication(med.name);
            const originalIndex = medications.findIndex(m => m === med);
            if (!groups[category]) groups[category] = [];
            groups[category].push({ ...med, index: originalIndex, category });
        });

        // Sort categories by priority
        const categoryOrder = ['Antibiotic', 'Antifungal', 'Inotrope', 'IV Fluid', 'TPN', 'Nutrition', 'Respiratory', 'Cardiac', 'Analgesic', 'Sedative', 'Anticonvulsant', 'GI', 'Vitamin', 'Other'];
        const sortedGroups: typeof groups = {};
        categoryOrder.forEach(cat => {
            if (groups[cat]) sortedGroups[cat] = groups[cat];
        });

        return sortedGroups;
    }, [activeMedications, medications]);

    const handleSelectMedication = (medication: MedicationDatabase) => {
        setNewMedication({
            name: medication.name,
            dose: medication.commonDoses?.[0] || '',
            route: medication.routes?.[0] || 'IV',
            frequency: medication.frequencies?.[0] || 'q12h',
        });
    };

    const handleAddMedication = () => {
        if (newMedication.name.trim() && newMedication.dose.trim()) {
            const medicationWithMeta = {
                ...newMedication,
                addedBy: userName || userEmail || userRole,
                addedAt: new Date().toISOString(),
                startDate: new Date().toISOString(),
                isActive: true,
                isCustom: false
            };
            onUpdate([...medications, medicationWithMeta]);
            setNewMedication({ name: '', dose: '', route: 'IV', frequency: 'q12h' });
            setShowAddForm(false);
        }
    };

    const handleStopMedication = (index: number) => {
        if (confirm('Stop this medication?')) {
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
        if (confirm('Remove this medication permanently?')) {
            onUpdate(medications.filter((_, i) => i !== index));
        }
    };

    const calculateDaysRunning = (startDate: string, stopDate?: string): number => {
        const start = new Date(startDate);
        const end = stopDate ? new Date(stopDate) : new Date();
        return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    const currentDate = new Date().toLocaleDateString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
    });

    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Professional Drug Chart Header */}
            <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white">
                <div className="px-4 py-3 border-b border-slate-600">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                <span className="text-2xl">💊</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold tracking-wide">MEDICATION ADMINISTRATION RECORD</h2>
                                <p className="text-xs text-slate-300 font-medium">
                                    {patientUnit || 'NICU/PICU'} Drug Chart • {currentDate} • {currentTime}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* View Toggle */}
                            <div className="flex bg-slate-600/50 rounded-lg p-0.5">
                                <button
                                    onClick={() => setViewMode('chart')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'chart'
                                            ? 'bg-white text-slate-800'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    Chart
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                                        viewMode === 'list'
                                            ? 'bg-white text-slate-800'
                                            : 'text-slate-300 hover:text-white'
                                    }`}
                                >
                                    List
                                </button>
                            </div>
                            {!readOnly && (
                                <button
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 shadow-lg"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Drug
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="px-4 py-2 flex items-center gap-4 text-sm bg-slate-900/30">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-emerald-300 font-bold">{activeMedications.length}</span>
                        <span className="text-slate-400">Active</span>
                    </div>
                    <div className="w-px h-4 bg-slate-600"></div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                        <span className="text-red-300 font-bold">{stoppedMedications.length}</span>
                        <span className="text-slate-400">Stopped</span>
                    </div>
                    {stoppedMedications.length > 0 && (
                        <>
                            <div className="w-px h-4 bg-slate-600"></div>
                            <button
                                onClick={() => setShowStopped(!showStopped)}
                                className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                                {showStopped ? 'Hide' : 'Show'} stopped
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Add Medication Form */}
            <AnimatePresence>
                {showAddForm && !readOnly && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
                    >
                        <div className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xl">➕</span>
                                <h3 className="font-bold text-slate-800">Add New Medication</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-600 mb-1">DRUG NAME *</label>
                                    <MedicationAutocomplete
                                        value={newMedication.name}
                                        onChange={(value) => setNewMedication({ ...newMedication, name: value })}
                                        onSelect={handleSelectMedication}
                                        placeholder="Type drug name..."
                                        className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">DOSE *</label>
                                    <input
                                        type="text"
                                        value={newMedication.dose}
                                        onChange={(e) => setNewMedication({ ...newMedication, dose: e.target.value })}
                                        placeholder="e.g., 50mg/kg"
                                        className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">ROUTE</label>
                                    <select
                                        value={newMedication.route}
                                        onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        <option value="IV">IV (Intravenous)</option>
                                        <option value="PO">PO (Oral)</option>
                                        <option value="IM">IM (Intramuscular)</option>
                                        <option value="SC">SC (Subcutaneous)</option>
                                        <option value="NG">NG/OG Tube</option>
                                        <option value="INH">Inhalation</option>
                                        <option value="TOP">Topical</option>
                                        <option value="PR">PR (Rectal)</option>
                                        <option value="ETT">Via ETT</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 mb-1">FREQUENCY</label>
                                    <select
                                        value={newMedication.frequency}
                                        onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        <option value="Continuous">Continuous Infusion</option>
                                        <option value="STAT">STAT (Once)</option>
                                        <option value="q4h">Q4H (Every 4 hours)</option>
                                        <option value="q6h">Q6H (Every 6 hours)</option>
                                        <option value="q8h">Q8H (Every 8 hours)</option>
                                        <option value="q12h">Q12H (Every 12 hours)</option>
                                        <option value="q24h">Q24H (Once daily)</option>
                                        <option value="BD">BD (Twice daily)</option>
                                        <option value="TID">TID (Three times daily)</option>
                                        <option value="PRN">PRN (As needed)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setNewMedication({ name: '', dose: '', route: 'IV', frequency: 'q12h' });
                                    }}
                                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddMedication}
                                    disabled={!newMedication.name.trim() || !newMedication.dose.trim()}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                                >
                                    Add to Chart
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="p-4">
                {activeMedications.length === 0 && stoppedMedications.length === 0 ? (
                    <div className="text-center py-12 px-4">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                            <span className="text-4xl">💊</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">No Medications Prescribed</h3>
                        <p className="text-slate-500 text-sm mb-4">
                            Click "Add Drug" to prescribe the first medication
                        </p>
                        <p className="text-xs text-slate-400">
                            Medications mentioned in clinical notes will be automatically extracted here
                        </p>
                    </div>
                ) : viewMode === 'chart' ? (
                    /* Professional Drug Chart View */
                    <div className="space-y-4">
                        {Object.entries(groupedMedications).map(([category, meds]) => {
                            const catStyle = MEDICATION_CATEGORIES[category] || MEDICATION_CATEGORIES['Other'];

                            return (
                                <div key={category} className={`rounded-lg border-2 ${catStyle.borderColor} overflow-hidden`}>
                                    {/* Category Header */}
                                    <div className={`${catStyle.bgColor} px-4 py-2 border-b ${catStyle.borderColor}`}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{catStyle.icon}</span>
                                            <h3 className={`font-bold text-sm uppercase tracking-wide ${catStyle.color}`}>
                                                {category}s
                                            </h3>
                                            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${catStyle.bgColor} ${catStyle.color} border ${catStyle.borderColor}`}>
                                                {meds.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Drug Chart Table */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide w-48">Drug</th>
                                                    <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide w-28">Dose</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-16">Route</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-24">Frequency</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-24">Started</th>
                                                    <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-16">Day</th>
                                                    <th className="px-3 py-2 text-left font-bold text-slate-600 text-xs uppercase tracking-wide">Times</th>
                                                    {!readOnly && (
                                                        <th className="px-3 py-2 text-center font-bold text-slate-600 text-xs uppercase tracking-wide w-20">Actions</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {meds.map((med, idx) => {
                                                    const daysRunning = med.startDate ? calculateDaysRunning(med.startDate) : 1;
                                                    const timeSlots = getTimeSlots(med.frequency || '');

                                                    return (
                                                        <tr key={med.index} className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                                                            <td className="px-3 py-3">
                                                                <div className="font-bold text-slate-800">{med.name}</div>
                                                                {med.addedBy && (
                                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                                        by {med.addedBy}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <span className="font-mono font-bold text-slate-700">{med.dose}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                                                                    med.route === 'IV' ? 'bg-blue-100 text-blue-700' :
                                                                    med.route === 'PO' ? 'bg-green-100 text-green-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {med.route}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className="text-xs font-semibold text-slate-600">{med.frequency}</span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className="text-xs text-slate-600">
                                                                    {med.startDate ? formatDate(med.startDate) : '-'}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                                                                    D{daysRunning}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {timeSlots.map((time, i) => (
                                                                        <span
                                                                            key={i}
                                                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                                                                time === 'Continuous' ? 'bg-orange-100 text-orange-700' :
                                                                                time === 'PRN' ? 'bg-purple-100 text-purple-700' :
                                                                                time === 'STAT' ? 'bg-red-100 text-red-700' :
                                                                                'bg-slate-100 text-slate-600'
                                                                            }`}
                                                                        >
                                                                            {time}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            {!readOnly && (
                                                                <td className="px-3 py-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <button
                                                                            onClick={() => handleStopMedication(med.index)}
                                                                            className="p-1.5 rounded bg-orange-100 hover:bg-orange-200 text-orange-600 transition-colors"
                                                                            title="Stop medication"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                                                            </svg>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleRemoveMedication(med.index)}
                                                                            className="p-1.5 rounded bg-red-100 hover:bg-red-200 text-red-600 transition-colors"
                                                                            title="Remove"
                                                                        >
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Stopped Medications Section */}
                        {showStopped && stoppedMedications.length > 0 && (
                            <div className="rounded-lg border-2 border-red-200 overflow-hidden opacity-75">
                                <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">🛑</span>
                                        <h3 className="font-bold text-sm uppercase tracking-wide text-red-700">
                                            Stopped Medications
                                        </h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-red-50/50 border-b border-red-100">
                                                <th className="px-3 py-2 text-left font-bold text-red-600 text-xs uppercase w-48">Drug</th>
                                                <th className="px-3 py-2 text-left font-bold text-red-600 text-xs uppercase w-28">Dose</th>
                                                <th className="px-3 py-2 text-center font-bold text-red-600 text-xs uppercase w-24">Started</th>
                                                <th className="px-3 py-2 text-center font-bold text-red-600 text-xs uppercase w-24">Stopped</th>
                                                <th className="px-3 py-2 text-center font-bold text-red-600 text-xs uppercase w-20">Duration</th>
                                                <th className="px-3 py-2 text-left font-bold text-red-600 text-xs uppercase">Stopped By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stoppedMedications.map((med, idx) => {
                                                const daysRan = med.startDate && med.stopDate
                                                    ? calculateDaysRunning(med.startDate, med.stopDate)
                                                    : '-';
                                                return (
                                                    <tr key={idx} className="border-b border-red-50 text-slate-500">
                                                        <td className="px-3 py-2 line-through">{med.name}</td>
                                                        <td className="px-3 py-2 font-mono">{med.dose}</td>
                                                        <td className="px-3 py-2 text-center text-xs">
                                                            {med.startDate ? formatDate(med.startDate) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-xs text-red-600 font-semibold">
                                                            {med.stopDate ? formatDate(med.stopDate) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-xs">{daysRan} days</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-xs">{med.stoppedBy || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* List View (Simplified) */
                    <div className="space-y-3">
                        {activeMedications.map((med, idx) => {
                            const originalIndex = medications.findIndex(m => m === med);
                            const category = categorizeMedication(med.name);
                            const catStyle = MEDICATION_CATEGORIES[category] || MEDICATION_CATEGORIES['Other'];
                            const daysRunning = med.startDate ? calculateDaysRunning(med.startDate) : 1;

                            return (
                                <motion.div
                                    key={originalIndex}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-4 rounded-xl border-2 ${catStyle.borderColor} ${catStyle.bgColor}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-xl">{catStyle.icon}</span>
                                                <h4 className="font-bold text-slate-800 text-lg">{med.name}</h4>
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${catStyle.color} ${catStyle.bgColor} border ${catStyle.borderColor}`}>
                                                    {category}
                                                </span>
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                                                    Day {daysRunning}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">Dose</span>
                                                    <span className="font-bold text-slate-700">{med.dose}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">Route</span>
                                                    <span className="font-bold text-slate-700">{med.route}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">Frequency</span>
                                                    <span className="font-bold text-slate-700">{med.frequency}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-slate-500 font-semibold block">Started</span>
                                                    <span className="font-bold text-slate-700">
                                                        {med.startDate ? formatDate(med.startDate) : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            {med.addedBy && (
                                                <div className="mt-2 text-xs text-slate-500">
                                                    Prescribed by: <span className="font-semibold">{med.addedBy}</span>
                                                </div>
                                            )}
                                        </div>
                                        {!readOnly && (
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleStopMedication(originalIndex)}
                                                    className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Stop
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveMedication(originalIndex)}
                                                    className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer with Legend */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="font-bold text-slate-600 uppercase tracking-wide">Legend:</span>
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(MEDICATION_CATEGORIES).slice(0, 6).map(([cat, style]) => (
                            <div key={cat} className="flex items-center gap-1">
                                <span>{style.icon}</span>
                                <span className={`font-semibold ${style.color}`}>{cat}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedicationManagement;
