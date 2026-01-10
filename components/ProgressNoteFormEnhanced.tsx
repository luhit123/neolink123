import React, { useState, useEffect } from 'react';
import { ProgressNote, VitalSigns, ClinicalExamination } from '../types';
import LoadingOverlay from './LoadingOverlay';

interface ProgressNoteFormProps {
    onSave: (note: ProgressNote) => void;
    onCancel: () => void;
    existingNote?: ProgressNote;
    lastNote?: ProgressNote;
    userEmail?: string;
    userName?: string;
    patientAge?: number;
    patientUnit?: string;
}

// Clinical Findings Database
const CLINICAL_FINDINGS = {
    cns: {
        normal: [
            'Alert and active',
            'Good cry, strong',
            'Normal muscle tone',
            'Active movements all limbs',
            'Good sucking reflex',
            'Fontanelle normal',
            'No seizures',
            'Pupils equal and reactive'
        ],
        abnormal: [
            'Lethargy',
            'Hypotonia',
            'Hypertonia',
            'Seizures observed',
            'Poor cry / weak cry',
            'Jitteriness',
            'Decreased activity',
            'Bulging fontanelle',
            'Depressed fontanelle',
            'Asymmetric movements',
            'Hyporeflexia',
            'Hyperreflexia'
        ]
    },
    cvs: {
        normal: [
            'S1S2 heard, regular',
            'No murmur detected',
            'CRT < 2 seconds',
            'Peripheral pulses palpable',
            'Normal heart rate',
            'No cyanosis',
            'Warm peripheries',
            'Normal BP for age'
        ],
        abnormal: [
            'Murmur detected (systolic/diastolic)',
            'CRT > 3 seconds',
            'Tachycardia',
            'Bradycardia',
            'Weak peripheral pulses',
            'Central cyanosis',
            'Peripheral cyanosis',
            'Cold peripheries',
            'Mottled skin',
            'Irregular rhythm',
            'Gallop rhythm',
            'Hypotension'
        ]
    },
    chest: {
        normal: [
            'Bilateral equal air entry',
            'No added sounds',
            'No retractions',
            'No grunting',
            'Clear lung fields',
            'Normal respiratory effort',
            'Chest moves symmetrically',
            'No nasal flaring'
        ],
        abnormal: [
            'Subcostal retractions',
            'Intercostal retractions',
            'Suprasternal retractions',
            'Grunting present',
            'Nasal flaring',
            'Decreased air entry (right/left)',
            'Crackles/crepitations',
            'Wheeze',
            'Stridor',
            'Asymmetric chest movement',
            'Tachypnea',
            'Apnea episodes',
            'Desaturation episodes'
        ]
    },
    perAbdomen: {
        normal: [
            'Soft and non-tender',
            'No distension',
            'Bowel sounds present',
            'No organomegaly',
            'No palpable masses',
            'Umbilicus clean and dry',
            'Normal passage of stools',
            'Feeding tolerance good'
        ],
        abnormal: [
            'Distended',
            'Tender on palpation',
            'Bowel sounds absent',
            'Bowel sounds hyperactive',
            'Hepatomegaly',
            'Splenomegaly',
            'Palpable mass',
            'Umbilicus red/discharge',
            'Abdominal wall discoloration',
            'Visible bowel loops',
            'No stool passage (specify hours)',
            'Vomiting/regurgitation',
            'Feeding intolerance'
        ]
    }
};

// Quick Templates - Only "All Systems Normal" kept
const QUICK_TEMPLATES = {
    'All Systems Normal': {
        cns: ['Alert and active', 'Good cry, strong', 'Normal muscle tone', 'Active movements all limbs'],
        cvs: ['S1S2 heard, regular', 'No murmur detected', 'CRT < 2 seconds'],
        chest: ['Bilateral equal air entry', 'No added sounds', 'No retractions'],
        perAbdomen: ['Soft and non-tender', 'No distension', 'Bowel sounds present']
    }
};

const ProgressNoteFormEnhanced: React.FC<ProgressNoteFormProps> = ({
    onSave,
    onCancel,
    existingNote,
    lastNote,
    userEmail,
    userName,
    patientAge = 0,
    patientUnit = 'NICU'
}) => {
    // Collapsible sections state
    const [expandedSections, setExpandedSections] = useState({
        vitals: true,
        examination: true,
        note: true
    });

    // Animation states for click feedback
    const [clickedButton, setClickedButton] = useState<string | null>(null);

    // Loading state
    const [isSaving, setIsSaving] = useState(false);

    // Individual examination system collapse state (collapsed by default for compact view)
    const [expandedSystems, setExpandedSystems] = useState({
        cns: false,
        cvs: false,
        chest: false,
        perAbdomen: false
    });

    const toggleSystem = (system: keyof typeof expandedSystems) => {
        setExpandedSystems(prev => ({ ...prev, [system]: !prev[system] }));
    };

    // Collapsible state for normal/abnormal findings within each system
    const [expandedFindings, setExpandedFindings] = useState({
        cns_normal: true,
        cns_abnormal: false,
        cvs_normal: true,
        cvs_abnormal: false,
        chest_normal: true,
        chest_abnormal: false,
        perAbdomen_normal: true,
        perAbdomen_abnormal: false
    });

    const toggleFindings = (key: keyof typeof expandedFindings) => {
        setExpandedFindings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Vital Signs State
    const [vitals, setVitals] = useState<VitalSigns>(existingNote?.vitals || {
        temperature: '',
        hr: '',
        rr: '',
        bp: '',
        spo2: '',
        crt: '',
        weight: ''
    });

    // General Examination State
    const [generalExam, setGeneralExam] = useState({
        pallor: 'No',
        icterus: 'No',
        cyanosis: 'No',
        edema: 'No',
        edemaLocation: '',
        dehydration: 'No',
        lymphadenopathy: 'No',
        clubbing: 'No',
        skinRash: 'No',
        rashDescription: ''
    });

    // Selected Findings State (multi-select checkboxes)
    const [selectedFindings, setSelectedFindings] = useState<{
        cns: string[];
        cvs: string[];
        chest: string[];
        perAbdomen: string[];
    }>({
        cns: [],
        cvs: [],
        chest: [],
        perAbdomen: []
    });

    // Custom text for additional findings
    const [customFindings, setCustomFindings] = useState({
        cns: '',
        cvs: '',
        chest: '',
        perAbdomen: ''
    });

    // Other findings
    const [otherFindings, setOtherFindings] = useState('');

    // General Clinical Note
    const [clinicalNote, setClinicalNote] = useState(existingNote?.note || '');

    // Helper function to generate random value within range
    const randomInRange = (min: number, max: number, decimals: number = 1): string => {
        const value = Math.random() * (max - min) + min;
        return value.toFixed(decimals);
    };

    // Helper function to generate random BP
    const randomBP = (systolicMin: number, systolicMax: number, diastolicMin: number, diastolicMax: number): string => {
        const systolic = Math.round(Math.random() * (systolicMax - systolicMin) + systolicMin);
        const diastolic = Math.round(Math.random() * (diastolicMax - diastolicMin) + diastolicMin);
        return `${systolic}/${diastolic}`;
    };

    // Quick fill functions with random normal values for different age groups
    const getNewbornVitals = () => ({
        temperature: randomInRange(36.5, 37.5, 1),
        hr: randomInRange(120, 160, 0),
        rr: randomInRange(40, 60, 0),
        bp: randomBP(60, 70, 35, 45),
        spo2: randomInRange(95, 100, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    const getPretermVitals = () => ({
        temperature: randomInRange(36.5, 37.2, 1),
        hr: randomInRange(140, 170, 0),
        rr: randomInRange(45, 65, 0),
        bp: randomBP(50, 60, 30, 40),
        spo2: randomInRange(90, 96, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    const getInfantVitals = () => ({
        temperature: randomInRange(36.5, 37.5, 1),
        hr: randomInRange(100, 140, 0),
        rr: randomInRange(30, 50, 0),
        bp: randomBP(70, 90, 40, 60),
        spo2: randomInRange(95, 100, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    const getToddlerVitals = () => ({
        temperature: randomInRange(36.5, 37.5, 1),
        hr: randomInRange(90, 130, 0),
        rr: randomInRange(24, 40, 0),
        bp: randomBP(80, 100, 50, 65),
        spo2: randomInRange(95, 100, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    const getPreschoolVitals = () => ({
        temperature: randomInRange(36.5, 37.5, 1),
        hr: randomInRange(80, 120, 0),
        rr: randomInRange(22, 34, 0),
        bp: randomBP(85, 105, 55, 70),
        spo2: randomInRange(95, 100, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    const getSchoolAgeVitals = () => ({
        temperature: randomInRange(36.5, 37.5, 1),
        hr: randomInRange(70, 110, 0),
        rr: randomInRange(18, 30, 0),
        bp: randomBP(90, 110, 60, 75),
        spo2: randomInRange(95, 100, 0),
        crt: '<2',
        weight: vitals.weight || ''
    });

    // Handle vital sign button click with animation
    const handleVitalClick = (buttonName: string, vitalsData: any) => {
        setClickedButton(buttonName);
        setVitals(vitalsData);
        setTimeout(() => setClickedButton(null), 600);
    };

    // Load existing note's examination data
    useEffect(() => {
        if (existingNote?.examination) {
            // Parse existing examination text back into selections
            // This is a simple implementation - you can enhance this
            setCustomFindings({
                cns: existingNote.examination.cns || '',
                cvs: existingNote.examination.cvs || '',
                chest: existingNote.examination.chest || '',
                perAbdomen: existingNote.examination.perAbdomen || ''
            });
            setOtherFindings(existingNote.examination.otherFindings || '');
        }
    }, [existingNote]);

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const copyFromLastNote = () => {
        if (lastNote) {
            if (lastNote.vitals) setVitals(lastNote.vitals);
            alert('✓ Copied vitals from last note');
        }
    };

    const handleToggleFinding = (system: 'cns' | 'cvs' | 'chest' | 'perAbdomen', finding: string) => {
        setSelectedFindings(prev => {
            const current = prev[system];
            const isSelected = current.includes(finding);

            return {
                ...prev,
                [system]: isSelected
                    ? current.filter(f => f !== finding)
                    : [...current, finding]
            };
        });
    };

    const handleSelectAllNormal = () => {
        const template = QUICK_TEMPLATES['All Systems Normal'];
        setClickedButton('allNormal');
        setSelectedFindings({
            cns: template.cns,
            cvs: template.cvs,
            chest: template.chest,
            perAbdomen: template.perAbdomen
        });
        setCustomFindings({ cns: '', cvs: '', chest: '', perAbdomen: '' });
        setTimeout(() => setClickedButton(null), 600);
    };

    const handleApplyTemplate = (templateName: keyof typeof QUICK_TEMPLATES) => {
        const template = QUICK_TEMPLATES[templateName];
        setSelectedFindings({
            cns: template.cns,
            cvs: template.cvs,
            chest: template.chest,
            perAbdomen: template.perAbdomen
        });
    };

    const handleClearSystem = (system: 'cns' | 'cvs' | 'chest' | 'perAbdomen') => {
        setSelectedFindings(prev => ({ ...prev, [system]: [] }));
        setCustomFindings(prev => ({ ...prev, [system]: '' }));
    };

    const buildExaminationText = (): ClinicalExamination => {
        // Build general examination summary
        const generalExamParts = [];
        if (generalExam.pallor !== 'No') generalExamParts.push(`Pallor: ${generalExam.pallor}`);
        if (generalExam.icterus !== 'No') generalExamParts.push(`Icterus: ${generalExam.icterus}`);
        if (generalExam.cyanosis !== 'No') generalExamParts.push(`Cyanosis: ${generalExam.cyanosis}`);
        if (generalExam.edema !== 'No') {
            const edemaText = generalExam.edemaLocation
                ? `Edema: ${generalExam.edema} (${generalExam.edemaLocation})`
                : `Edema: ${generalExam.edema}`;
            generalExamParts.push(edemaText);
        }
        if (generalExam.dehydration !== 'No') generalExamParts.push(`Dehydration: ${generalExam.dehydration}`);
        if (generalExam.lymphadenopathy !== 'No') generalExamParts.push(`Lymphadenopathy: ${generalExam.lymphadenopathy}`);
        if (generalExam.clubbing !== 'No') generalExamParts.push(`Clubbing: ${generalExam.clubbing}`);
        if (generalExam.skinRash !== 'No') {
            const rashText = generalExam.rashDescription
                ? `Skin Rash: ${generalExam.skinRash} (${generalExam.rashDescription})`
                : `Skin Rash: ${generalExam.skinRash}`;
            generalExamParts.push(rashText);
        }

        const generalExamText = generalExamParts.length > 0
            ? `[General Examination] ${generalExamParts.join('; ')}`
            : '';

        return {
            cns: [
                ...selectedFindings.cns,
                customFindings.cns ? `Additional: ${customFindings.cns}` : ''
            ].filter(Boolean).join(', '),

            cvs: [
                ...selectedFindings.cvs,
                customFindings.cvs ? `Additional: ${customFindings.cvs}` : ''
            ].filter(Boolean).join(', '),

            chest: [
                ...selectedFindings.chest,
                customFindings.chest ? `Additional: ${customFindings.chest}` : ''
            ].filter(Boolean).join(', '),

            perAbdomen: [
                ...selectedFindings.perAbdomen,
                customFindings.perAbdomen ? `Additional: ${customFindings.perAbdomen}` : ''
            ].filter(Boolean).join(', '),

            otherFindings: [generalExamText, otherFindings].filter(Boolean).join('\n\n')
        };
    };

    const handleQuickSave = async () => {
        setIsSaving(true);

        // Give user visual feedback with loading overlay
        await new Promise(resolve => setTimeout(resolve, 800));

        const examination = buildExaminationText();

        const progressNote: ProgressNote = {
            date: new Date().toISOString(),
            note: clinicalNote || undefined,
            vitals: Object.values(vitals).some(v => v) ? vitals : undefined,
            examination: Object.values(examination).some(v => v) ? examination : undefined,
            // Medications are now managed separately via MedicationManagement component
            addedBy: userName || undefined,
            addedByEmail: userEmail || undefined
        };

        onSave(progressNote);
        setIsSaving(false);
    };

    // System Renderer Component
    const renderSystemFindings = (
        system: 'cns' | 'cvs' | 'chest' | 'perAbdomen',
        title: string,
        icon: React.ReactNode,
        color: string
    ) => {
        const findings = CLINICAL_FINDINGS[system];
        const selected = selectedFindings[system];
        const isExpanded = expandedSystems[system];

        return (
            <div className={`bg-gradient-to-br from-${color}-50 to-${color}-100 rounded-xl border-2 border-${color}-200 overflow-hidden shadow-md`}>
                {/* Header - Clickable to toggle */}
                <button
                    type="button"
                    onClick={() => toggleSystem(system)}
                    className={`w-full px-4 py-3 bg-${color}-100 flex items-center justify-between hover:bg-${color}-200 transition-all cursor-pointer`}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br from-${color}-400 to-${color}-600 flex items-center justify-center shadow-md`}>
                            {icon}
                        </div>
                        <span className="text-base font-bold text-slate-800">{title}</span>
                        {selected.length > 0 && (
                            <span className={`px-3 py-1 bg-${color}-200 text-${color}-800 text-xs rounded-full font-semibold`}>
                                {selected.length} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearSystem(system);
                            }}
                            className={`text-xs px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 rounded-lg font-semibold transition-all border border-${color}-200`}
                        >
                            Clear
                        </button>
                        <svg className={`w-5 h-5 text-${color}-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                {/* Compact Preview when Collapsed */}
                {!isExpanded && (selected.length > 0 || customFindings[system]) && (
                    <div className={`px-4 py-2 bg-white/60 border-t border-${color}-200`}>
                        <div className={`text-xs font-semibold text-${color}-700 mb-1`}>Selected:</div>
                        <div className="text-sm text-slate-700 line-clamp-2">
                            {[...selected, customFindings[system] ? `Additional: ${customFindings[system]}` : '']
                                .filter(Boolean)
                                .join(', ')}
                        </div>
                    </div>
                )}

                {/* Full Content - Only show when expanded */}
                {isExpanded && (
                <div className="p-2 sm:p-4 bg-white/80">
                    {/* Normal Findings - Collapsible */}
                    <div className="mb-3">
                        <button
                            type="button"
                            onClick={() => toggleFindings(`${system}_normal` as keyof typeof expandedFindings)}
                            className="w-full flex items-center justify-between gap-2 mb-2 p-2 rounded-lg hover:bg-emerald-50 transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold text-emerald-700">Normal Findings (Quick Select)</span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-emerald-600 transition-transform ${expandedFindings[`${system}_normal` as keyof typeof expandedFindings] ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {expandedFindings[`${system}_normal` as keyof typeof expandedFindings] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                                {findings.normal.map((finding, idx) => (
                                    <label
                                        key={idx}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                                            selected.includes(finding)
                                                ? `bg-emerald-100 border-2 border-emerald-400 shadow-sm`
                                                : 'bg-white border-2 border-slate-200 hover:border-emerald-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(finding)}
                                            onChange={() => handleToggleFinding(system, finding)}
                                            className="w-4 h-4 text-emerald-600 bg-white border-slate-300 rounded focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-slate-700 flex-1">{finding}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Abnormal Findings - Collapsible */}
                    <div className="mb-3">
                        <button
                            type="button"
                            onClick={() => toggleFindings(`${system}_abnormal` as keyof typeof expandedFindings)}
                            className="w-full flex items-center justify-between gap-2 mb-2 p-2 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <span className="text-sm font-bold text-red-700">Abnormal Findings</span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-red-600 transition-transform ${expandedFindings[`${system}_abnormal` as keyof typeof expandedFindings] ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {expandedFindings[`${system}_abnormal` as keyof typeof expandedFindings] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                                {findings.abnormal.map((finding, idx) => (
                                    <label
                                        key={idx}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
                                            selected.includes(finding)
                                                ? 'bg-red-100 border-2 border-red-400 shadow-sm'
                                                : 'bg-white border-2 border-slate-200 hover:border-red-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(finding)}
                                            onChange={() => handleToggleFinding(system, finding)}
                                            className="w-4 h-4 text-red-600 bg-white border-slate-300 rounded focus:ring-red-500"
                                        />
                                        <span className="text-sm text-slate-700 flex-1">{finding}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Custom Findings */}
                    <div className="mt-3">
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Additional / Custom Findings
                        </label>
                        <textarea
                            value={customFindings[system]}
                            onChange={(e) => setCustomFindings({ ...customFindings, [system]: e.target.value })}
                            placeholder="Type any additional findings not listed above..."
                            rows={2}
                            className="w-full px-3 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all resize-none"
                        />
                    </div>

                    {/* Preview */}
                    {(selected.length > 0 || customFindings[system]) && (
                        <div className="mt-3 p-3 bg-sky-50 border-2 border-sky-200 rounded-lg">
                            <div className="text-xs font-semibold text-sky-700 mb-1">Preview:</div>
                            <div className="text-sm text-slate-700">
                                {[...selected, customFindings[system] ? `Additional: ${customFindings[system]}` : '']
                                    .filter(Boolean)
                                    .join(', ')}
                            </div>
                        </div>
                    )}
                </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-3 sm:space-y-4 bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-6 mb-4">
            {/* Header with Quick Templates */}
            <div className="flex flex-col gap-2 sm:gap-4 pb-2 sm:pb-4 border-b-2 border-sky-100">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <span>{existingNote ? 'Edit Progress Note' : 'New Progress Note'}</span>
                    </h4>

                    <div className="flex items-center gap-2">
                        {lastNote && !existingNote && (
                            <button
                                type="button"
                                onClick={copyFromLastNote}
                                className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border-2 border-purple-200 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy Last
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* VITAL SIGNS - STATE-OF-THE-ART ENHANCED */}
            <div className="bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 rounded-lg sm:rounded-xl border-2 border-red-200 overflow-hidden shadow-lg">
                <button
                    type="button"
                    onClick={() => toggleSection('vitals')}
                    className="w-full px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between hover:bg-red-100/50 transition-all"
                >
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-md animate-pulse">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-base sm:text-lg font-bold text-slate-800 block">Vital Signs</span>
                            <span className="text-xs text-slate-600">Quick-fill available</span>
                        </div>
                        {Object.values(vitals).some(v => v) && (
                            <span className="ml-auto sm:ml-2 px-2 sm:px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold border border-emerald-200">
                                {Object.values(vitals).filter(v => v).length}/7
                            </span>
                        )}
                    </div>
                    <svg className={`w-5 h-5 text-red-600 transition-transform ${expandedSections.vitals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.vitals && (
                    <div className="p-2 sm:p-5 bg-white/70">
                        {/* Quick-Fill Buttons with Animation */}
                        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border-2 border-emerald-200">
                            <div className="w-full flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-xs sm:text-sm font-bold text-emerald-800">Quick-Fill Normal Ranges by Age:</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('newborn', getNewbornVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'newborn' ? 'scale-95 ring-4 ring-emerald-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'newborn' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Newborn (0-28d)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('preterm', getPretermVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'preterm' ? 'scale-95 ring-4 ring-blue-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'preterm' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Preterm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('infant', getInfantVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'infant' ? 'scale-95 ring-4 ring-purple-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'infant' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Infant (1-12mo)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('toddler', getToddlerVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'toddler' ? 'scale-95 ring-4 ring-amber-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'toddler' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Toddler (1-3yr)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('preschool', getPreschoolVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'preschool' ? 'scale-95 ring-4 ring-cyan-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'preschool' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    Preschool (3-5yr)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleVitalClick('school', getSchoolAgeVitals())}
                                    className={`px-2 sm:px-3 py-2 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1 ${
                                        clickedButton === 'school' ? 'scale-95 ring-4 ring-rose-300' : ''
                                    }`}
                                >
                                    {clickedButton === 'school' ? (
                                        <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    School (6-12yr)
                                </button>
                            </div>
                        </div>

                        {/* Vital Signs Grid with Reference Ranges */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                            {/* Temperature */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    🌡️ Temp (°C)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.temperature}
                                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                    placeholder="36.5-37.5"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: 36.5-37.5</div>
                                {vitals.temperature && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* Heart Rate */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    ❤️ HR (bpm)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.hr}
                                    onChange={(e) => setVitals({ ...vitals, hr: e.target.value })}
                                    placeholder="120-160"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: 120-160</div>
                                {vitals.hr && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* Respiratory Rate */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    💨 RR (/min)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.rr}
                                    onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                                    placeholder="40-60"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: 40-60</div>
                                {vitals.rr && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* Blood Pressure */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    🩸 BP (mmHg)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.bp}
                                    onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                                    placeholder="60-80/40-50"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: 60-80/40-50</div>
                                {vitals.bp && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* SpO2 */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    🫁 SpO₂ (%)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.spo2}
                                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                                    placeholder="95-100"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: 95-100</div>
                                {vitals.spo2 && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* CRT */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    ⏱️ CRT (sec)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.crt}
                                    onChange={(e) => setVitals({ ...vitals, crt: e.target.value })}
                                    placeholder="<2"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Normal: &lt;2 sec</div>
                                {vitals.crt && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            {/* Weight */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-red-700 mb-1">
                                    ⚖️ Weight (kg)
                                </label>
                                <input
                                    type="text"
                                    value={vitals.weight}
                                    onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                                    placeholder="2.5-4.0"
                                    className="w-full px-2 sm:px-3 py-2 bg-white border-2 border-red-200 rounded-lg text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                                />
                                <div className="text-[10px] text-slate-500 mt-0.5">Varies by age</div>
                                {vitals.weight && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>
                        </div>

                        {/* Vital Signs Summary Preview */}
                        {Object.values(vitals).some(v => v) && (
                            <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-bold text-emerald-800">Vitals Summary Preview:</span>
                                </div>
                                <div className="text-xs text-slate-700 bg-white/60 p-2 rounded">
                                    {vitals.temperature && `Temp: ${vitals.temperature}°C`}
                                    {vitals.hr && ` | HR: ${vitals.hr} bpm`}
                                    {vitals.rr && ` | RR: ${vitals.rr}/min`}
                                    {vitals.bp && ` | BP: ${vitals.bp} mmHg`}
                                    {vitals.spo2 && ` | SpO₂: ${vitals.spo2}%`}
                                    {vitals.crt && ` | CRT: ${vitals.crt} sec`}
                                    {vitals.weight && ` | Weight: ${vitals.weight} kg`}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GENERAL EXAMINATION - State-of-the-Art */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-lg sm:rounded-xl border-2 border-amber-300 overflow-hidden shadow-lg">
                <button
                    type="button"
                    onClick={() => toggleSection('examination')}
                    className="w-full px-3 sm:px-5 py-2 sm:py-3 flex items-center justify-between hover:bg-amber-100/50 transition-all"
                >
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-base sm:text-lg font-bold text-slate-800 block">General Examination</span>
                            <span className="text-xs text-slate-600">Pallor, Icterus, Edema, Cyanosis</span>
                        </div>
                    </div>
                    <svg className={`w-5 h-5 text-amber-600 transition-transform ${expandedSections.examination ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.examination && (
                    <div className="p-3 sm:p-5 bg-white/70">
                        {/* Quick Normal Button */}
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={() => setGeneralExam({
                                    pallor: 'No',
                                    icterus: 'No',
                                    cyanosis: 'No',
                                    edema: 'No',
                                    edemaLocation: '',
                                    dehydration: 'No',
                                    lymphadenopathy: 'No',
                                    clubbing: 'No',
                                    skinRash: 'No',
                                    rashDescription: ''
                                })}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                All Normal (No Abnormalities)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {/* Pallor */}
                            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl border-2 border-rose-200 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-rose-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    Pallor
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Mild', 'Moderate', 'Severe'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, pallor: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.pallor === option
                                                    ? 'bg-rose-500 text-white shadow-md'
                                                    : 'bg-white text-rose-700 border-2 border-rose-200 hover:border-rose-400'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Icterus */}
                            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-yellow-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    Icterus / Jaundice
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Mild', 'Moderate', 'Severe'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, icterus: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.icterus === option
                                                    ? 'bg-yellow-500 text-white shadow-md'
                                                    : 'bg-white text-yellow-700 border-2 border-yellow-300 hover:border-yellow-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cyanosis */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-blue-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                    Cyanosis
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Central', 'Peripheral', 'Both'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, cyanosis: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.cyanosis === option
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-white text-blue-700 border-2 border-blue-300 hover:border-blue-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Edema */}
                            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border-2 border-purple-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Edema
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {['No', 'Pedal', 'Facial', 'Generalized', 'Sacral'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, edema: option, edemaLocation: option !== 'No' ? option : '' })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.edema === option
                                                    ? 'bg-purple-600 text-white shadow-md'
                                                    : 'bg-white text-purple-700 border-2 border-purple-300 hover:border-purple-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                {generalExam.edema !== 'No' && (
                                    <input
                                        type="text"
                                        value={generalExam.edemaLocation}
                                        onChange={(e) => setGeneralExam({ ...generalExam, edemaLocation: e.target.value })}
                                        placeholder="Specify location/details..."
                                        className="w-full px-3 py-2 bg-white border-2 border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                )}
                            </div>

                            {/* Dehydration */}
                            <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl border-2 border-cyan-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-cyan-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                    </svg>
                                    Dehydration
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Mild', 'Moderate', 'Severe'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, dehydration: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.dehydration === option
                                                    ? 'bg-cyan-600 text-white shadow-md'
                                                    : 'bg-white text-cyan-700 border-2 border-cyan-300 hover:border-cyan-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lymphadenopathy */}
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Lymphadenopathy
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Cervical', 'Axillary', 'Inguinal', 'Generalized'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, lymphadenopathy: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.lymphadenopathy === option
                                                    ? 'bg-emerald-600 text-white shadow-md'
                                                    : 'bg-white text-emerald-700 border-2 border-emerald-300 hover:border-emerald-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Clubbing */}
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border-2 border-orange-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-orange-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                                    </svg>
                                    Clubbing
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {['No', 'Present'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, clubbing: option })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.clubbing === option
                                                    ? 'bg-orange-600 text-white shadow-md'
                                                    : 'bg-white text-orange-700 border-2 border-orange-300 hover:border-orange-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Skin Rash */}
                            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-pink-300 p-3 sm:p-4">
                                <label className="block text-sm font-bold text-pink-700 mb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Skin Rash
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {['No', 'Present'].map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setGeneralExam({ ...generalExam, skinRash: option, rashDescription: option === 'No' ? '' : generalExam.rashDescription })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                generalExam.skinRash === option
                                                    ? 'bg-pink-600 text-white shadow-md'
                                                    : 'bg-white text-pink-700 border-2 border-pink-300 hover:border-pink-500'
                                            }`}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                                {generalExam.skinRash === 'Present' && (
                                    <input
                                        type="text"
                                        value={generalExam.rashDescription}
                                        onChange={(e) => setGeneralExam({ ...generalExam, rashDescription: e.target.value })}
                                        placeholder="Describe rash (location, type, etc.)..."
                                        className="w-full px-3 py-2 bg-white border-2 border-pink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        {Object.values(generalExam).some(v => v && v !== 'No') && (
                            <div className="mt-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-lg">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-xs font-bold text-amber-800">General Examination Summary:</span>
                                </div>
                                <div className="text-xs text-slate-700 bg-white/60 p-2 rounded">
                                    {generalExam.pallor !== 'No' && `Pallor: ${generalExam.pallor} | `}
                                    {generalExam.icterus !== 'No' && `Icterus: ${generalExam.icterus} | `}
                                    {generalExam.cyanosis !== 'No' && `Cyanosis: ${generalExam.cyanosis} | `}
                                    {generalExam.edema !== 'No' && `Edema: ${generalExam.edema}${generalExam.edemaLocation ? ` (${generalExam.edemaLocation})` : ''} | `}
                                    {generalExam.dehydration !== 'No' && `Dehydration: ${generalExam.dehydration} | `}
                                    {generalExam.lymphadenopathy !== 'No' && `Lymphadenopathy: ${generalExam.lymphadenopathy} | `}
                                    {generalExam.clubbing !== 'No' && `Clubbing: ${generalExam.clubbing} | `}
                                    {generalExam.skinRash !== 'No' && `Rash: ${generalExam.skinRash}${generalExam.rashDescription ? ` (${generalExam.rashDescription})` : ''}`}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* EXAMINATION - Enhanced with Quick Select */}
            <div className="space-y-2 sm:space-y-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-md">
                            <svg className="w-4 sm:w-5 h-4 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800">Systemic Examination</h3>
                    </div>

                    {/* All Systems Normal Button */}
                    <button
                        type="button"
                        onClick={handleSelectAllNormal}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg font-bold transition-all shadow-md flex items-center gap-2 ${
                            clickedButton === 'allNormal' ? 'scale-95 ring-4 ring-emerald-300' : ''
                        }`}
                    >
                        {clickedButton === 'allNormal' ? (
                            <>
                                <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Applied!
                            </>
                        ) : (
                            <>
                                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="hidden sm:inline">All Systems Normal</span>
                                <span className="sm:hidden">All Normal</span>
                            </>
                        )}
                    </button>
                </div>

                {/* CNS */}
                {renderSystemFindings(
                    'cns',
                    'CNS (Central Nervous System)',
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>,
                    'blue'
                )}

                {/* CVS */}
                {renderSystemFindings(
                    'cvs',
                    'CVS (Cardiovascular System)',
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>,
                    'red'
                )}

                {/* CHEST */}
                {renderSystemFindings(
                    'chest',
                    'CHEST (Respiratory System)',
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>,
                    'purple'
                )}

                {/* PER ABDOMEN */}
                {renderSystemFindings(
                    'perAbdomen',
                    'PER ABDOMEN (Gastrointestinal)',
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>,
                    'amber'
                )}

                {/* Other Findings */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg sm:rounded-xl border-2 border-slate-200 p-2 sm:p-4">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5 sm:mb-2">
                        Other Findings (Skin, IV lines, Monitors, etc.)
                    </label>
                    <textarea
                        value={otherFindings}
                        onChange={(e) => setOtherFindings(e.target.value)}
                        placeholder="Any other clinical findings..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all resize-none"
                    />
                </div>
            </div>

            {/* CLINICAL NOTE */}
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-lg sm:rounded-xl border-2 border-sky-200 p-3 sm:p-5 shadow-sm">
                <label className="block text-sm sm:text-base font-bold text-sky-800 mb-2 sm:mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    Clinical Note / Assessment / Plan
                </label>
                <textarea
                    value={clinicalNote}
                    onChange={(e) => setClinicalNote(e.target.value)}
                    placeholder="Patient progress, assessment, and plan of care..."
                    rows={5}
                    className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder-slate-400 transition-all resize-none"
                />
            </div>

            {/* Action Buttons - Sticky at bottom with backdrop */}
            <div className="sticky bottom-0 left-0 right-0 flex gap-2 sm:gap-3 justify-end pt-3 sm:pt-4 pb-2 border-t-2 border-sky-100 bg-white/95 backdrop-blur-sm -mx-3 sm:-mx-6 px-3 sm:px-6 mt-4 rounded-b-xl shadow-lg z-10">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 rounded-lg sm:rounded-xl font-semibold transition-all shadow-sm hover:shadow"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleQuickSave}
                    className="px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg sm:rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Progress Note
                </button>
            </div>

            {/* Loading Overlay */}
            <LoadingOverlay
                show={isSaving}
                message="Saving progress note..."
            />
        </div>
    );
};

export default ProgressNoteFormEnhanced;
