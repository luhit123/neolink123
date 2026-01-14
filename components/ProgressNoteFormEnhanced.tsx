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
    const [expandedSections, setExpandedSections] = useState({
        vitals: true,
        examination: true,
        note: true
    });

    const [clickedButton, setClickedButton] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [expandedSystems, setExpandedSystems] = useState({
        cns: false,
        cvs: false,
        chest: false,
        perAbdomen: false
    });

    const toggleSystem = (system: keyof typeof expandedSystems) => {
        setExpandedSystems(prev => ({ ...prev, [system]: !prev[system] }));
    };

    const [expandedFindings, setExpandedFindings] = useState({
        cns_normal: false,
        cns_abnormal: false,
        cvs_normal: false,
        cvs_abnormal: false,
        chest_normal: false,
        chest_abnormal: false,
        perAbdomen_normal: false,
        perAbdomen_abnormal: false
    });

    const toggleFindings = (key: keyof typeof expandedFindings) => {
        setExpandedFindings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [vitals, setVitals] = useState<VitalSigns>(existingNote?.vitals || {
        temperature: '',
        hr: '',
        rr: '',
        bp: '',
        spo2: '',
        crt: '',
        weight: ''
    });

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

    const [customFindings, setCustomFindings] = useState({
        cns: '',
        cvs: '',
        chest: '',
        perAbdomen: ''
    });

    const [otherFindings, setOtherFindings] = useState('');
    const [clinicalNote, setClinicalNote] = useState(existingNote?.note || '');

    const randomInRange = (min: number, max: number, decimals: number = 1): string => {
        const value = Math.random() * (max - min) + min;
        return value.toFixed(decimals);
    };

    const randomBP = (systolicMin: number, systolicMax: number, diastolicMin: number, diastolicMax: number): string => {
        const systolic = Math.round(Math.random() * (systolicMax - systolicMin) + systolicMin);
        const diastolic = Math.round(Math.random() * (diastolicMax - diastolicMin) + diastolicMin);
        return `${systolic}/${diastolic}`;
    };

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

    const handleVitalClick = (buttonName: string, vitalsData: any) => {
        setClickedButton(buttonName);
        setVitals(vitalsData);
        setTimeout(() => setClickedButton(null), 600);
    };

    useEffect(() => {
        if (existingNote?.examination) {
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
            alert('Copied vitals from last note');
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

    const handleClearSystem = (system: 'cns' | 'cvs' | 'chest' | 'perAbdomen') => {
        setSelectedFindings(prev => ({ ...prev, [system]: [] }));
        setCustomFindings(prev => ({ ...prev, [system]: '' }));
    };

    // Common/essential normal findings for quick selection (3-4 per system)
    const COMMON_NORMAL_FINDINGS = {
        cns: ['Alert and active', 'Normal muscle tone', 'Good cry, strong'],
        cvs: ['S1S2 heard, regular', 'No murmur detected', 'CRT < 2 seconds'],
        chest: ['Bilateral equal air entry', 'No added sounds', 'No retractions'],
        perAbdomen: ['Soft and non-tender', 'No distension', 'Bowel sounds present']
    };

    const handleSelectSystemNormal = (system: 'cns' | 'cvs' | 'chest' | 'perAbdomen') => {
        // Select only common/essential normal findings (3-4 per system)
        const commonFindings = COMMON_NORMAL_FINDINGS[system];
        setSelectedFindings(prev => ({ ...prev, [system]: commonFindings }));
        setCustomFindings(prev => ({ ...prev, [system]: '' }));
    };

    const buildExaminationText = (): ClinicalExamination => {
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
        await new Promise(resolve => setTimeout(resolve, 800));

        const examination = buildExaminationText();

        const progressNote: ProgressNote = {
            date: new Date().toISOString(),
            note: clinicalNote || undefined,
            vitals: Object.values(vitals).some(v => v) ? vitals : undefined,
            examination: Object.values(examination).some(v => v) ? examination : undefined,
            addedBy: userName || undefined,
            addedByEmail: userEmail || undefined
        };

        onSave(progressNote);
        setIsSaving(false);
    };

    const renderSystemFindings = (
        system: 'cns' | 'cvs' | 'chest' | 'perAbdomen',
        title: string,
        icon: React.ReactNode
    ) => {
        const findings = CLINICAL_FINDINGS[system];
        const selected = selectedFindings[system];
        const isExpanded = expandedSystems[system];

        return (
            <div className="bg-white rounded-lg border border-sky-200 overflow-hidden shadow-sm">
                <button
                    type="button"
                    onClick={() => toggleSystem(system)}
                    className="w-full px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between hover:from-sky-100 hover:to-blue-100 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                            {icon}
                        </div>
                        <span className="text-sm font-semibold text-sky-900">{title}</span>
                        {selected.length > 0 && (
                            <span className="px-2 py-0.5 bg-sky-200 text-sky-800 text-xs rounded-full font-medium">
                                {selected.length} selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSystemNormal(system);
                            }}
                            className="text-xs px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-lg font-bold transition-all shadow-sm flex items-center gap-1.5 animate-pulse hover:animate-none"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            ✓ Normal
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClearSystem(system);
                            }}
                            className="text-xs px-2 py-1 bg-white hover:bg-red-50 text-red-600 rounded font-medium transition-all border border-sky-200"
                        >
                            Clear
                        </button>
                        <svg className={`w-4 h-4 text-sky-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </button>

                {!isExpanded && (selected.length > 0 || customFindings[system]) && (
                    <div className="px-4 py-2 bg-sky-50/50 border-t border-sky-100">
                        <div className="text-xs text-sky-600 mb-1">Selected:</div>
                        <div className="text-sm text-sky-800 line-clamp-2">
                            {[...selected, customFindings[system] ? `Additional: ${customFindings[system]}` : '']
                                .filter(Boolean)
                                .join(', ')}
                        </div>
                    </div>
                )}

                {isExpanded && (
                    <div className="p-4 bg-white">
                        {/* Normal Findings */}
                        <div className="mb-3">
                            <button
                                type="button"
                                onClick={() => toggleFindings(`${system}_normal` as keyof typeof expandedFindings)}
                                className="w-full flex items-center justify-between gap-2 mb-2 p-2 rounded hover:bg-emerald-50 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-emerald-700">Normal Findings</span>
                                </div>
                                <svg
                                    className={`w-4 h-4 text-sky-400 transition-transform ${expandedFindings[`${system}_normal` as keyof typeof expandedFindings] ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {expandedFindings[`${system}_normal` as keyof typeof expandedFindings] && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {findings.normal.map((finding, idx) => (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                selected.includes(finding)
                                                    ? 'bg-emerald-50 border border-emerald-300'
                                                    : 'bg-sky-50/50 border border-sky-100 hover:border-emerald-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(finding)}
                                                onChange={() => handleToggleFinding(system, finding)}
                                                className="w-4 h-4 text-emerald-600 bg-white border-sky-300 rounded focus:ring-emerald-500"
                                            />
                                            <span className="text-sm text-sky-800">{finding}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Abnormal Findings */}
                        <div className="mb-3">
                            <button
                                type="button"
                                onClick={() => toggleFindings(`${system}_abnormal` as keyof typeof expandedFindings)}
                                className="w-full flex items-center justify-between gap-2 mb-2 p-2 rounded hover:bg-rose-50 transition-all"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-medium text-rose-700">Abnormal Findings</span>
                                </div>
                                <svg
                                    className={`w-4 h-4 text-sky-400 transition-transform ${expandedFindings[`${system}_abnormal` as keyof typeof expandedFindings] ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {expandedFindings[`${system}_abnormal` as keyof typeof expandedFindings] && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                    {findings.abnormal.map((finding, idx) => (
                                        <label
                                            key={idx}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                                selected.includes(finding)
                                                    ? 'bg-rose-50 border border-rose-300'
                                                    : 'bg-sky-50/50 border border-sky-100 hover:border-rose-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(finding)}
                                                onChange={() => handleToggleFinding(system, finding)}
                                                className="w-4 h-4 text-rose-600 bg-white border-sky-300 rounded focus:ring-rose-500"
                                            />
                                            <span className="text-sm text-sky-800">{finding}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Custom Findings */}
                        <div className="mt-3">
                            <label className="block text-xs font-medium text-sky-700 mb-1">
                                Additional Findings
                            </label>
                            <textarea
                                value={customFindings[system]}
                                onChange={(e) => setCustomFindings({ ...customFindings, [system]: e.target.value })}
                                placeholder="Type any additional findings..."
                                rows={2}
                                className="w-full px-3 py-2 bg-white border border-sky-200 rounded text-sky-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all resize-none"
                            />
                        </div>

                        {/* Preview */}
                        {(selected.length > 0 || customFindings[system]) && (
                            <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded">
                                <div className="text-xs font-medium text-sky-600 mb-1">Preview:</div>
                                <div className="text-sm text-sky-800">
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
        <div className="space-y-4 bg-gradient-to-br from-sky-50 via-white to-blue-50 rounded-xl shadow-lg p-4 sm:p-6 mb-4 border border-sky-200">
            {/* Header */}
            <div className="flex flex-col gap-3 pb-3 border-b border-sky-200">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-sky-900 flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        {existingNote ? 'Edit Progress Note' : 'New Progress Note'}
                    </h4>

                    {lastNote && !existingNote && (
                        <button
                            type="button"
                            onClick={copyFromLastNote}
                            className="px-3 py-1.5 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 rounded-lg text-sm font-medium transition-all flex items-center gap-1 shadow-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy Last
                        </button>
                    )}
                </div>
            </div>

            {/* VITAL SIGNS */}
            <div className="bg-white rounded-lg border border-sky-200 overflow-hidden shadow-sm">
                <button
                    type="button"
                    onClick={() => toggleSection('vitals')}
                    className="w-full px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between hover:from-sky-100 hover:to-blue-100 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-sky-900 block">Vital Signs</span>
                            <span className="text-xs text-sky-600">Quick-fill available</span>
                        </div>
                        {Object.values(vitals).some(v => v) && (
                            <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                                {Object.values(vitals).filter(v => v).length}/7
                            </span>
                        )}
                    </div>
                    <svg className={`w-4 h-4 text-sky-600 transition-transform ${expandedSections.vitals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.vitals && (
                    <div className="p-4 border-t border-sky-100 bg-white">
                        {/* Quick-Fill Buttons */}
                        <div className="mb-4 p-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-lg border border-sky-200">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="text-xs font-semibold text-sky-800">Quick-Fill by Age:</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {[
                                    { name: 'newborn', label: 'Newborn (0-28d)', fn: getNewbornVitals },
                                    { name: 'preterm', label: 'Preterm', fn: getPretermVitals },
                                    { name: 'infant', label: 'Infant (1-12mo)', fn: getInfantVitals },
                                    { name: 'toddler', label: 'Toddler (1-3yr)', fn: getToddlerVitals },
                                    { name: 'preschool', label: 'Preschool (3-5yr)', fn: getPreschoolVitals },
                                    { name: 'school', label: 'School (6-12yr)', fn: getSchoolAgeVitals }
                                ].map(({ name, label, fn }) => (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => handleVitalClick(name, fn())}
                                        className={`px-3 py-2 bg-white hover:bg-sky-100 text-sky-700 border border-sky-300 rounded-lg text-xs font-medium transition-all shadow-sm ${
                                            clickedButton === name ? 'ring-2 ring-sky-400 bg-sky-100' : ''
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Vital Signs Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { key: 'temperature', label: 'Temp (°C)', placeholder: '36.5-37.5', normal: '36.5-37.5' },
                                { key: 'hr', label: 'HR (bpm)', placeholder: '120-160', normal: '120-160' },
                                { key: 'rr', label: 'RR (/min)', placeholder: '40-60', normal: '40-60' },
                                { key: 'bp', label: 'BP (mmHg)', placeholder: '60-80/40-50', normal: '60-80/40-50' },
                                { key: 'spo2', label: 'SpO2 (%)', placeholder: '95-100', normal: '95-100' },
                                { key: 'crt', label: 'CRT (sec)', placeholder: '<2', normal: '<2 sec' },
                                { key: 'weight', label: 'Weight (kg)', placeholder: '2.5-4.0', normal: 'Varies' }
                            ].map(({ key, label, placeholder, normal }) => (
                                <div key={key} className="relative">
                                    <label className="block text-xs font-medium text-sky-700 mb-1">{label}</label>
                                    <input
                                        type="text"
                                        value={(vitals as any)[key]}
                                        onChange={(e) => setVitals({ ...vitals, [key]: e.target.value })}
                                        placeholder={placeholder}
                                        className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg text-sky-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all"
                                    />
                                    <div className="text-[10px] text-sky-500 mt-0.5">Normal: {normal}</div>
                                </div>
                            ))}
                        </div>

                        {/* Vitals Summary */}
                        {Object.values(vitals).some(v => v) && (
                            <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg">
                                <div className="text-xs font-medium text-sky-700 mb-1">Summary:</div>
                                <div className="text-xs text-sky-800">
                                    {vitals.temperature && `Temp: ${vitals.temperature}°C`}
                                    {vitals.hr && ` | HR: ${vitals.hr} bpm`}
                                    {vitals.rr && ` | RR: ${vitals.rr}/min`}
                                    {vitals.bp && ` | BP: ${vitals.bp} mmHg`}
                                    {vitals.spo2 && ` | SpO2: ${vitals.spo2}%`}
                                    {vitals.crt && ` | CRT: ${vitals.crt} sec`}
                                    {vitals.weight && ` | Weight: ${vitals.weight} kg`}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* GENERAL EXAMINATION */}
            <div className="bg-white rounded-lg border border-sky-200 overflow-hidden shadow-sm">
                <button
                    type="button"
                    onClick={() => toggleSection('examination')}
                    className="w-full px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 flex items-center justify-between hover:from-sky-100 hover:to-blue-100 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-sky-900 block">General Examination</span>
                            <span className="text-xs text-sky-600">Pallor, Icterus, Edema, Cyanosis</span>
                        </div>
                    </div>
                    <svg className={`w-4 h-4 text-sky-600 transition-transform ${expandedSections.examination ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {expandedSections.examination && (
                    <div className="p-4 border-t border-sky-100 bg-white">
                        {/* Quick Normal Button */}
                        <div className="mb-4">
                            <button
                                type="button"
                                onClick={() => setGeneralExam({
                                    pallor: 'No', icterus: 'No', cyanosis: 'No', edema: 'No',
                                    edemaLocation: '', dehydration: 'No', lymphadenopathy: 'No',
                                    clubbing: 'No', skinRash: 'No', rashDescription: ''
                                })}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                All Normal
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { key: 'pallor', label: 'Pallor', options: ['No', 'Mild', 'Moderate', 'Severe'] },
                                { key: 'icterus', label: 'Icterus', options: ['No', 'Mild', 'Moderate', 'Severe'] },
                                { key: 'cyanosis', label: 'Cyanosis', options: ['No', 'Central', 'Peripheral', 'Both'] },
                                { key: 'dehydration', label: 'Dehydration', options: ['No', 'Mild', 'Moderate', 'Severe'] },
                                { key: 'edema', label: 'Edema', options: ['No', 'Pedal', 'Facial', 'Generalized'] },
                                { key: 'lymphadenopathy', label: 'Lymphadenopathy', options: ['No', 'Cervical', 'Axillary', 'Generalized'] },
                                { key: 'clubbing', label: 'Clubbing', options: ['No', 'Present'] },
                                { key: 'skinRash', label: 'Skin Rash', options: ['No', 'Present'] }
                            ].map(({ key, label, options }) => (
                                <div key={key} className="bg-sky-50/50 rounded-lg p-3 border border-sky-100">
                                    <label className="block text-xs font-medium text-sky-700 mb-2">{label}</label>
                                    <div className="flex flex-wrap gap-1">
                                        {options.map(option => (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setGeneralExam({ ...generalExam, [key]: option })}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                                    (generalExam as any)[key] === option
                                                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm'
                                                        : 'bg-white text-sky-700 border border-sky-200 hover:border-sky-400'
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SYSTEMIC EXAMINATION */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-sky-900">Systemic Examination</h3>
                        <p className="text-xs text-sky-600">Click ✓ Normal on each system for quick entry</p>
                    </div>
                </div>

                {renderSystemFindings('cns', 'CNS (Central Nervous System)',
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                )}

                {renderSystemFindings('cvs', 'CVS (Cardiovascular System)',
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                )}

                {renderSystemFindings('chest', 'Chest (Respiratory System)',
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                )}

                {renderSystemFindings('perAbdomen', 'Per Abdomen (GI)',
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                )}

                {/* Other Findings */}
                <div className="bg-white rounded-lg border border-sky-200 p-4 shadow-sm">
                    <label className="block text-xs font-medium text-sky-700 mb-2">
                        Other Findings
                    </label>
                    <textarea
                        value={otherFindings}
                        onChange={(e) => setOtherFindings(e.target.value)}
                        placeholder="Any other clinical findings..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg text-sky-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 transition-all resize-none"
                    />
                </div>
            </div>

            {/* CLINICAL NOTE */}
            <div className="bg-white rounded-lg border border-sky-200 p-4 shadow-sm">
                <label className="block text-sm font-medium text-sky-800 mb-2 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    className="w-full px-3 py-2 bg-white border border-sky-200 rounded-lg text-sky-900 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 placeholder-sky-400 transition-all resize-none"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-sky-200">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-5 py-2.5 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 rounded-lg font-medium text-sm transition-all shadow-sm"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleQuickSave}
                    className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2 shadow-md"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Progress Note
                </button>
            </div>

            <LoadingOverlay show={isSaving} message="Saving progress note..." />
        </div>
    );
};

export default ProgressNoteFormEnhanced;
