import React, { useMemo, useState } from 'react';
import { Patient, Unit, BedCapacity, ObservationPatient, ObservationOutcome } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ComposedChart, Bar, Scatter, Cell, ReferenceArea } from 'recharts';
import { getCanonicalAdmissionType, getCanonicalOutcome } from '../utils/analytics';

interface BedOccupancyProps {
    patients: Patient[];
    bedCapacity?: BedCapacity;
    availableUnits?: Unit[];
    observationPatients?: ObservationPatient[];
    nicuView?: 'All' | 'Inborn' | 'Outborn';
}

type TimeRange = '24hours' | '7days' | '30days' | '3months' | 'current' | 'custom';

interface OverflowEvent {
    date: Date;
    unit: string;
    overflow: number;
    totalPatients: number;
    capacity: number;
    isOngoing?: boolean;
}

const BedOccupancy: React.FC<BedOccupancyProps> = ({ patients, bedCapacity, availableUnits, observationPatients = [], nicuView: propNicuView = 'All' }) => {
    // NICU filtering is controlled by parent-level universal filter.
    const nicuView = propNicuView;

    const [timeRange, setTimeRange] = useState<TimeRange>('current');
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date.toISOString().split('T')[0];
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        return new Date().toISOString().split('T')[0];
    });

    // Bed capacities
    const TOTAL_NICU_INBORN_BEDS = bedCapacity?.NICU_INBORN || (bedCapacity?.NICU ? Math.floor(bedCapacity.NICU / 2) : 10);
    const TOTAL_NICU_OUTBORN_BEDS = bedCapacity?.NICU_OUTBORN || (bedCapacity?.NICU ? Math.ceil(bedCapacity.NICU / 2) : 10);
    const TOTAL_PICU_BEDS = bedCapacity?.PICU || 10;
    const TOTAL_SNCU_BEDS = bedCapacity?.SNCU || 15;

    // Current active patients
    const activePatients = useMemo(
        () => patients.filter(p => getCanonicalOutcome(p) === 'In Progress'),
        [patients]
    );
    const activeObservationPatients = useMemo(() =>
        observationPatients.filter(p => p.outcome === ObservationOutcome.InObservation),
        [observationPatients]
    );

    // Split by unit and type
    const nicuInbornPatients = activePatients.filter(p => {
        if (p.unit !== Unit.NICU) return false;
        return getCanonicalAdmissionType(p) === 'Inborn';
    });
    const nicuInbornObs = activeObservationPatients.filter(p => {
        if (p.unit !== Unit.NICU) return false;
        const normalized = String(p.admissionType || '').trim().toLowerCase();
        return normalized.includes('inborn');
    });

    const nicuOutbornPatients = activePatients.filter(p => {
        if (p.unit !== Unit.NICU) return false;
        return getCanonicalAdmissionType(p) === 'Outborn';
    });
    const nicuOutbornObs = activeObservationPatients.filter(p => {
        if (p.unit !== Unit.NICU) return false;
        const normalized = String(p.admissionType || '').trim().toLowerCase();
        return normalized.includes('outborn');
    });

    const picuPatients = activePatients.filter(p => p.unit === Unit.PICU);
    const picuObs = activeObservationPatients.filter(p => p.unit === Unit.PICU);

    const sncuPatients = activePatients.filter(p => p.unit === Unit.SNCU);
    const sncuObs = activeObservationPatients.filter(p => p.unit === Unit.SNCU);

    // Calculate current stats
    const unitStats = useMemo(() => {
        const stats = [];

        if (!availableUnits || availableUnits.includes(Unit.NICU)) {
            if (nicuView !== 'Outborn') {
                const total = nicuInbornPatients.length + nicuInbornObs.length;
                stats.push({
                    id: 'nicu-inborn',
                    name: 'NICU Inborn',
                    shortName: 'Inborn',
                    occupied: total,
                    capacity: TOTAL_NICU_INBORN_BEDS,
                    overflow: Math.max(0, total - TOTAL_NICU_INBORN_BEDS),
                    occupancyRate: TOTAL_NICU_INBORN_BEDS > 0 ? Math.round((total / TOTAL_NICU_INBORN_BEDS) * 100) : 0,
                    available: Math.max(0, TOTAL_NICU_INBORN_BEDS - total),
                    observation: nicuInbornObs.length,
                    admitted: nicuInbornPatients.length,
                    color: '#10b981',
                    bgGradient: 'from-emerald-500 to-emerald-600',
                    lightBg: 'bg-emerald-50',
                    borderColor: 'border-emerald-200'
                });
            }
            if (nicuView !== 'Inborn') {
                const total = nicuOutbornPatients.length + nicuOutbornObs.length;
                stats.push({
                    id: 'nicu-outborn',
                    name: 'NICU Outborn',
                    shortName: 'Outborn',
                    occupied: total,
                    capacity: TOTAL_NICU_OUTBORN_BEDS,
                    overflow: Math.max(0, total - TOTAL_NICU_OUTBORN_BEDS),
                    occupancyRate: TOTAL_NICU_OUTBORN_BEDS > 0 ? Math.round((total / TOTAL_NICU_OUTBORN_BEDS) * 100) : 0,
                    available: Math.max(0, TOTAL_NICU_OUTBORN_BEDS - total),
                    observation: nicuOutbornObs.length,
                    admitted: nicuOutbornPatients.length,
                    color: '#f59e0b',
                    bgGradient: 'from-amber-500 to-amber-600',
                    lightBg: 'bg-amber-50',
                    borderColor: 'border-amber-200'
                });
            }
        }

        if (!availableUnits || availableUnits.includes(Unit.PICU)) {
            const total = picuPatients.length + picuObs.length;
            stats.push({
                id: 'picu',
                name: 'PICU',
                shortName: 'PICU',
                occupied: total,
                capacity: TOTAL_PICU_BEDS,
                overflow: Math.max(0, total - TOTAL_PICU_BEDS),
                occupancyRate: TOTAL_PICU_BEDS > 0 ? Math.round((total / TOTAL_PICU_BEDS) * 100) : 0,
                available: Math.max(0, TOTAL_PICU_BEDS - total),
                observation: picuObs.length,
                admitted: picuPatients.length,
                color: '#8b5cf6',
                bgGradient: 'from-violet-500 to-violet-600',
                lightBg: 'bg-violet-50',
                borderColor: 'border-violet-200'
            });
        }

        if (!availableUnits || availableUnits.includes(Unit.SNCU)) {
            const total = sncuPatients.length + sncuObs.length;
            stats.push({
                id: 'sncu',
                name: 'SNCU',
                shortName: 'SNCU',
                occupied: total,
                capacity: TOTAL_SNCU_BEDS,
                overflow: Math.max(0, total - TOTAL_SNCU_BEDS),
                occupancyRate: TOTAL_SNCU_BEDS > 0 ? Math.round((total / TOTAL_SNCU_BEDS) * 100) : 0,
                available: Math.max(0, TOTAL_SNCU_BEDS - total),
                observation: sncuObs.length,
                admitted: sncuPatients.length,
                color: '#0ea5e9',
                bgGradient: 'from-sky-500 to-sky-600',
                lightBg: 'bg-sky-50',
                borderColor: 'border-sky-200'
            });
        }

        return stats;
    }, [nicuInbornPatients, nicuInbornObs, nicuOutbornPatients, nicuOutbornObs, picuPatients, picuObs, sncuPatients, sncuObs,
        TOTAL_NICU_INBORN_BEDS, TOTAL_NICU_OUTBORN_BEDS, TOTAL_PICU_BEDS, TOTAL_SNCU_BEDS, availableUnits, nicuView]);

    // Check for any current overflow
    const hasCurrentOverflow = unitStats.some(s => s.overflow > 0);
    const totalOverflow = unitStats.reduce((sum, s) => sum + s.overflow, 0);

    // Helper to check if a patient is Inborn
    const isInborn = (p: Patient) => {
        if (p.unit !== Unit.NICU) return false;
        return getCanonicalAdmissionType(p) === 'Inborn';
    };

    // Helper to check if a patient is Outborn
    const isOutborn = (p: Patient) => {
        if (p.unit !== Unit.NICU) return false;
        return getCanonicalAdmissionType(p) === 'Outborn';
    };

    // Historical data with overflow detection
    const historicalData = useMemo(() => {
        if (timeRange === 'current') return [];

        const now = new Date();
        const dataPoints = [];
        let startDate: Date;
        let endDate = now;
        let stepHours = 24;

        if (timeRange === 'custom') {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999);
            const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            // Determine step based on range
            if (daysDiff <= 1) stepHours = 2;
            else if (daysDiff <= 7) stepHours = 8;
            else if (daysDiff <= 30) stepHours = 24;
            else stepHours = 48;
        } else {
            let days = 0;
            switch (timeRange) {
                case '24hours':
                    days = 1;
                    stepHours = 2;
                    break;
                case '7days':
                    days = 7;
                    stepHours = 8; // Every 8 hours for better accuracy
                    break;
                case '30days':
                    days = 30;
                    stepHours = 24;
                    break;
                case '3months':
                    days = 90;
                    stepHours = 48;
                    break;
            }
            startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        }

        const totalSteps = Math.ceil((endDate.getTime() - startDate.getTime()) / (stepHours * 60 * 60 * 1000));

        for (let i = 0; i <= totalSteps; i++) {
            const date = new Date(startDate.getTime() + (i * stepHours * 60 * 60 * 1000));
            if (date > now) break; // Don't go past current time

            const patientsOnDate = patients.filter(p => {
                const admissionDate = new Date(p.admissionDateTime || p.admissionDate);
                if (isNaN(admissionDate.getTime())) return false;

                let outcomeDate: Date | null = null;
                if (getCanonicalOutcome(p) !== 'In Progress') {
                    if (p.releaseDate) outcomeDate = new Date(p.releaseDate);
                    else if (p.finalDischargeDate) outcomeDate = new Date(p.finalDischargeDate);
                    else if (p.stepDownDate) outcomeDate = new Date(p.stepDownDate);
                }

                // Patient was present at this time
                return admissionDate <= date && (!outcomeDate || outcomeDate > date);
            });

            // NICU Inborn/Outborn - use helper functions
            const nicuInborn = patientsOnDate.filter(isInborn).length;
            const nicuOutborn = patientsOnDate.filter(isOutborn).length;
            const picu = patientsOnDate.filter(p => p.unit === Unit.PICU).length;
            const sncu = patientsOnDate.filter(p => p.unit === Unit.SNCU).length;

            const dateLabel = timeRange === '24hours' || (timeRange === 'custom' && stepHours <= 8)
                ? date.toLocaleTimeString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });

            dataPoints.push({
                date: dateLabel,
                fullDate: date,
                'NICU Inborn': nicuInborn,
                'NICU Outborn': nicuOutborn,
                'PICU': picu,
                'SNCU': sncu,
                'Inborn Capacity': TOTAL_NICU_INBORN_BEDS,
                'Outborn Capacity': TOTAL_NICU_OUTBORN_BEDS,
                'PICU Capacity': TOTAL_PICU_BEDS,
                'SNCU Capacity': TOTAL_SNCU_BEDS,
                'Inborn Overflow': Math.max(0, nicuInborn - TOTAL_NICU_INBORN_BEDS),
                'Outborn Overflow': Math.max(0, nicuOutborn - TOTAL_NICU_OUTBORN_BEDS),
                'PICU Overflow': Math.max(0, picu - TOTAL_PICU_BEDS),
                'SNCU Overflow': Math.max(0, sncu - TOTAL_SNCU_BEDS),
            });
        }

        return dataPoints;
    }, [patients, timeRange, customStartDate, customEndDate, TOTAL_NICU_INBORN_BEDS, TOTAL_NICU_OUTBORN_BEDS, TOTAL_PICU_BEDS, TOTAL_SNCU_BEDS]);

    // Detect ALL overflow occurrences from historical data
    const overflowEvents = useMemo(() => {
        const events: OverflowEvent[] = [];
        const seenDates: Set<string> = new Set();

        historicalData.forEach((point, index) => {
            const checks = [
                { unit: 'NICU Inborn', overflow: point['Inborn Overflow'], total: point['NICU Inborn'], capacity: TOTAL_NICU_INBORN_BEDS },
                { unit: 'NICU Outborn', overflow: point['Outborn Overflow'], total: point['NICU Outborn'], capacity: TOTAL_NICU_OUTBORN_BEDS },
                { unit: 'PICU', overflow: point['PICU Overflow'], total: point['PICU'], capacity: TOTAL_PICU_BEDS },
                { unit: 'SNCU', overflow: point['SNCU Overflow'], total: point['SNCU'], capacity: TOTAL_SNCU_BEDS },
            ];

            checks.forEach(({ unit, overflow, total, capacity }) => {
                if (overflow > 0) {
                    // Create unique key for this date+unit combo (per day)
                    const dateKey = `${point.fullDate.toDateString()}-${unit}`;

                    // Track max overflow per day per unit
                    if (!seenDates.has(dateKey)) {
                        seenDates.add(dateKey);

                        // Check if this is the last data point (ongoing overflow)
                        const isOngoing = index === historicalData.length - 1;

                        events.push({
                            date: point.fullDate,
                            unit,
                            overflow,
                            totalPatients: total,
                            capacity,
                            isOngoing
                        });
                    } else {
                        // Update if this has higher overflow
                        const existingIdx = events.findIndex(e =>
                            e.date.toDateString() === point.fullDate.toDateString() && e.unit === unit
                        );
                        if (existingIdx >= 0 && events[existingIdx].overflow < overflow) {
                            events[existingIdx].overflow = overflow;
                            events[existingIdx].totalPatients = total;
                        }
                    }
                }
            });
        });

        // Sort by date descending (most recent first)
        return events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);
    }, [historicalData, TOTAL_NICU_INBORN_BEDS, TOTAL_NICU_OUTBORN_BEDS, TOTAL_PICU_BEDS, TOTAL_SNCU_BEDS]);

    // Get status color based on occupancy
    const getStatusColor = (rate: number) => {
        if (rate >= 100) return { bg: 'bg-red-500', text: 'text-red-500', light: 'bg-red-100', status: 'OVERFLOW' };
        if (rate >= 90) return { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100', status: 'CRITICAL' };
        if (rate >= 75) return { bg: 'bg-yellow-500', text: 'text-yellow-500', light: 'bg-yellow-100', status: 'HIGH' };
        if (rate >= 50) return { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100', status: 'MODERATE' };
        return { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100', status: 'NORMAL' };
    };

    const formatDateTime = (date: Date) => {
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            {/* Header with Alert */}
            <div className={`rounded-2xl p-4 shadow-lg border-2 ${hasCurrentOverflow
                ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400'
                : 'bg-gradient-to-r from-slate-700 to-slate-800 border-slate-600'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasCurrentOverflow ? 'bg-white/20' : 'bg-white/10'}`}>
                            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Bed Occupancy Analysis</h2>
                            <p className="text-sm text-white/80">
                                {hasCurrentOverflow
                                    ? `${totalOverflow} bed${totalOverflow > 1 ? 's' : ''} over capacity`
                                    : 'All units within capacity'
                                }
                            </p>
                        </div>
                    </div>
                    {hasCurrentOverflow && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl animate-pulse">
                            <span className="w-3 h-3 bg-white rounded-full"></span>
                            <span className="text-white font-bold text-sm">OVERFLOW ALERT</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex flex-wrap gap-2 pb-2">
                {[
                    { value: 'current' as TimeRange, label: 'Current', icon: '🏥' },
                    { value: '24hours' as TimeRange, label: '24h', icon: '⏱️' },
                    { value: '7days' as TimeRange, label: '7d', icon: '📅' },
                    { value: '30days' as TimeRange, label: '30d', icon: '📆' },
                    { value: '3months' as TimeRange, label: '3mo', icon: '📊' },
                    { value: 'custom' as TimeRange, label: 'Custom', icon: '🎯' },
                ].map((range) => (
                    <button
                        key={range.value}
                        onClick={() => {
                            setTimeRange(range.value);
                            if (range.value === 'custom') {
                                setShowCustomDatePicker(true);
                            } else {
                                setShowCustomDatePicker(false);
                            }
                        }}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-1.5
                            ${timeRange === range.value
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-105'
                                : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-blue-400 hover:shadow'
                            }`}
                    >
                        <span>{range.icon}</span>
                        <span>{range.label}</span>
                    </button>
                ))}
            </div>

            {/* Custom Date Picker */}
            {showCustomDatePicker && timeRange === 'custom' && (
                <div className="bg-white rounded-2xl border-2 border-blue-200 p-4 shadow-lg">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">📅</span>
                        Select Date Range
                    </h4>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">From Date</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                max={customEndDate}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none text-sm"
                            />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-semibold text-slate-500 mb-1">To Date</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                min={customStartDate}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none text-sm"
                            />
                        </div>
                        <button
                            onClick={() => setShowCustomDatePicker(false)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
                        >
                            Apply
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        Showing data from {new Date(customStartDate).toLocaleDateString()} to {new Date(customEndDate).toLocaleDateString()}
                    </p>
                </div>
            )}

            {/* Current Status View */}
            {timeRange === 'current' && (
                <div className="space-y-4">
                    {/* Unit Cards with Integrated Bed Grids */}
                    {unitStats.map((unit) => {
                        const status = getStatusColor(unit.occupancyRate);
                        const isOverflow = unit.overflow > 0;
                        const isExpanded = expandedUnits.has(unit.id);

                        let unitPatients: any[] = [];
                        if (unit.id === 'nicu-inborn') {
                            unitPatients = [...nicuInbornPatients, ...nicuInbornObs.map(p => ({ ...p, name: p.babyName, isObservation: true }))];
                        } else if (unit.id === 'nicu-outborn') {
                            unitPatients = [...nicuOutbornPatients, ...nicuOutbornObs.map(p => ({ ...p, name: p.babyName, isObservation: true }))];
                        } else if (unit.id === 'picu') {
                            unitPatients = [...picuPatients, ...picuObs.map(p => ({ ...p, name: p.babyName, isObservation: true }))];
                        } else if (unit.id === 'sncu') {
                            unitPatients = [...sncuPatients, ...sncuObs.map(p => ({ ...p, name: p.babyName, isObservation: true }))];
                        }

                        const beds = Array.from({ length: Math.max(unit.capacity, unitPatients.length) }, (_, i) => ({
                            id: i + 1,
                            patient: unitPatients[i],
                            isOverflow: i >= unit.capacity
                        }));

                        return (
                            <div
                                key={unit.id}
                                className={`rounded-2xl overflow-hidden border-2 ${isOverflow ? 'border-red-300' : unit.borderColor} shadow-lg`}
                            >
                                {/* Unit Header */}
                                <div
                                    onClick={() => {
                                        const newExpanded = new Set(expandedUnits);
                                        if (isExpanded) {
                                            newExpanded.delete(unit.id);
                                        } else {
                                            newExpanded.add(unit.id);
                                        }
                                        setExpandedUnits(newExpanded);
                                    }}
                                    className={`p-4 cursor-pointer transition-all
                                        ${isOverflow
                                            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                            : `bg-gradient-to-r ${unit.bgGradient} text-white`
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{unit.name}</h3>
                                                <p className="text-sm opacity-80">
                                                    {unit.occupied} of {unit.capacity} beds • {unit.occupancyRate}% • {status.status}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {isOverflow && (
                                                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold animate-pulse">
                                                    +{unit.overflow} OVERFLOW
                                                </span>
                                            )}
                                            <svg className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Quick Stats Row */}
                                    <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/20">
                                        <div className="text-center">
                                            <p className="text-xl font-bold">{unit.occupied}</p>
                                            <p className="text-[10px] opacity-70">Active</p>
                                            {unit.observation > 0 && (
                                                <p className="text-[9px] opacity-60">+{unit.observation} obs</p>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold">{unit.observation}</p>
                                            <p className="text-[10px] opacity-70">Obs</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold">{unit.available}</p>
                                            <p className="text-[10px] opacity-70">Available</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xl font-bold text-yellow-300">{isOverflow ? `+${unit.overflow}` : '0'}</p>
                                            <p className="text-[10px] opacity-70">Overflow</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bed Grid - Always Visible */}
                                <div className={`p-4 ${unit.lightBg}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-sm font-bold text-slate-700">Bed Layout</h4>
                                        <div className="flex gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <span className="w-3 h-3 rounded bg-white border border-slate-300"></span>
                                                Empty
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-3 h-3 rounded bg-blue-500"></span>
                                                Occupied
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="w-3 h-3 rounded bg-orange-400"></span>
                                                Obs
                                            </span>
                                            {isOverflow && (
                                                <span className="flex items-center gap-1">
                                                    <span className="w-3 h-3 rounded bg-red-500"></span>
                                                    Over
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                        {beds.map((bed) => (
                                            <div
                                                key={bed.id}
                                                className={`relative aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all group
                                                    ${bed.isOverflow
                                                        ? 'bg-red-500 text-white border-2 border-red-600 animate-pulse'
                                                        : bed.patient
                                                            ? (bed.patient.isObservation
                                                                ? 'bg-orange-400 text-white border-2 border-orange-500'
                                                                : 'bg-blue-500 text-white border-2 border-blue-600')
                                                            : 'bg-white text-slate-400 border-2 border-slate-200'
                                                    }`}
                                            >
                                                {bed.isOverflow ? '!' : bed.id}
                                                {bed.patient && (
                                                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-xl whitespace-nowrap z-20 pointer-events-none transition-opacity">
                                                        {bed.patient.name}
                                                        {bed.patient.isObservation && <span className="ml-1 text-orange-300">(Obs)</span>}
                                                        {bed.isOverflow && <span className="ml-1 text-red-300">(Overflow)</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Patient List when Expanded */}
                                    {isExpanded && unitPatients.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-200">
                                            <h4 className="text-sm font-bold text-slate-700 mb-2">Patient Details</h4>
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {unitPatients.map((p, idx) => (
                                                    <div
                                                        key={p.id || idx}
                                                        className={`flex items-center justify-between p-2 rounded-lg ${
                                                            idx >= unit.capacity ? 'bg-red-100 border border-red-300' : 'bg-white border border-slate-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                                                                idx >= unit.capacity
                                                                    ? 'bg-red-500 text-white'
                                                                    : p.isObservation
                                                                        ? 'bg-orange-400 text-white'
                                                                        : 'bg-blue-500 text-white'
                                                            }`}>
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-sm font-medium text-slate-700">{p.name || p.babyName}</span>
                                                            {p.isObservation && <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">Obs</span>}
                                                            {idx >= unit.capacity && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Overflow</span>}
                                                        </div>
                                                        <span className="text-xs text-slate-500">
                                                            {new Date(p.admissionDateTime || p.admissionDate || p.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Historical Trend View */}
            {(timeRange !== 'current' || timeRange === 'custom') && historicalData.length > 0 && (
                <div className="space-y-4">
                    {/* State-of-the-Art Overflow Chart */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-4 md:p-6 overflow-hidden relative">
                        {/* Animated Background Glow for Overflow */}
                        {overflowEvents.length > 0 && (
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 rounded-full blur-3xl animate-pulse" />
                        )}

                        <div className="relative">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                        <span className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </span>
                                        Bed Occupancy & Overflow Analysis
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Red zones indicate capacity overflow • Dashed lines show max capacity
                                    </p>
                                </div>
                                {overflowEvents.length > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-xl">
                                        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                                        <span className="text-red-400 font-bold text-sm">{overflowEvents.length} Overflow Events</span>
                                    </div>
                                )}
                            </div>

                            {/* Legend with Overflow Indicator */}
                            <div className="flex flex-wrap gap-4 mb-4">
                                {(nicuView !== 'Outborn') && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                        <span className="text-emerald-400 text-xs font-medium">NICU Inborn</span>
                                        <span className="text-slate-500 text-xs">Cap: {TOTAL_NICU_INBORN_BEDS}</span>
                                    </div>
                                )}
                                {(nicuView !== 'Inborn') && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
                                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                        <span className="text-amber-400 text-xs font-medium">NICU Outborn</span>
                                        <span className="text-slate-500 text-xs">Cap: {TOTAL_NICU_OUTBORN_BEDS}</span>
                                    </div>
                                )}
                                {(!availableUnits || availableUnits.includes(Unit.PICU)) && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 rounded-lg border border-violet-500/30">
                                        <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                                        <span className="text-violet-400 text-xs font-medium">PICU</span>
                                        <span className="text-slate-500 text-xs">Cap: {TOTAL_PICU_BEDS}</span>
                                    </div>
                                )}
                                {(!availableUnits || availableUnits.includes(Unit.SNCU)) && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/20 rounded-lg border border-sky-500/30">
                                        <div className="w-3 h-3 rounded-full bg-sky-500"></div>
                                        <span className="text-sky-400 text-xs font-medium">SNCU</span>
                                        <span className="text-slate-500 text-xs">Cap: {TOTAL_SNCU_BEDS}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-lg border border-red-500/30">
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-red-400 text-xs font-bold">OVERFLOW ZONE</span>
                                </div>
                            </div>

                            <div className="h-[350px] md:h-[450px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={historicalData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                                        <defs>
                                            {/* Normal Gradients */}
                                            <linearGradient id="inbornGradNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
                                            </linearGradient>
                                            <linearGradient id="outbornGradNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                            </linearGradient>
                                            <linearGradient id="picuGradNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                            </linearGradient>
                                            <linearGradient id="sncuGradNew" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                                            </linearGradient>
                                            {/* Overflow Gradient - Dramatic Red */}
                                            <linearGradient id="overflowGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                                                <stop offset="50%" stopColor="#dc2626" stopOpacity={0.8}/>
                                                <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.6}/>
                                            </linearGradient>
                                            {/* Glow Effect */}
                                            <filter id="glow">
                                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                <feMerge>
                                                    <feMergeNode in="coloredBlur"/>
                                                    <feMergeNode in="SourceGraphic"/>
                                                </feMerge>
                                            </filter>
                                        </defs>

                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#64748b"
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={70}
                                            axisLine={{ stroke: '#475569' }}
                                        />
                                        <YAxis
                                            stroke="#64748b"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={{ stroke: '#475569' }}
                                            domain={[0, 'auto']}
                                        />
                                        <Tooltip
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    const hasOverflow = payload.some((p: any) =>
                                                        p.name?.includes('Overflow') && p.value > 0
                                                    );
                                                    return (
                                                        <div className={`p-4 rounded-xl shadow-2xl border ${hasOverflow ? 'bg-red-900/95 border-red-500' : 'bg-slate-900/95 border-slate-600'}`}>
                                                            <p className="font-bold text-white mb-2 text-sm">{label}</p>
                                                            <div className="space-y-1">
                                                                {payload.filter((p: any) => !p.name?.includes('Capacity') && !p.name?.includes('Overflow')).map((entry: any, idx: number) => (
                                                                    <div key={idx} className="flex items-center justify-between gap-4">
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                                                            <span className="text-slate-300 text-xs">{entry.name}</span>
                                                                        </span>
                                                                        <span className="font-bold text-white text-xs">{entry.value}</span>
                                                                    </div>
                                                                ))}
                                                                {payload.filter((p: any) => p.name?.includes('Overflow') && p.value > 0).map((entry: any, idx: number) => (
                                                                    <div key={`of-${idx}`} className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-red-500/50">
                                                                        <span className="flex items-center gap-2">
                                                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                                            <span className="text-red-300 text-xs font-bold">{entry.name}</span>
                                                                        </span>
                                                                        <span className="font-black text-red-400 text-sm">+{entry.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {hasOverflow && (
                                                                <div className="mt-2 pt-2 border-t border-red-500/30">
                                                                    <p className="text-red-400 text-xs font-bold flex items-center gap-1">
                                                                        <span className="animate-pulse">⚠️</span> CAPACITY EXCEEDED
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />

                                        {/* Capacity Reference Lines with Labels */}
                                        {(nicuView !== 'Outborn') && (
                                            <ReferenceLine
                                                y={TOTAL_NICU_INBORN_BEDS}
                                                stroke="#10b981"
                                                strokeDasharray="8 4"
                                                strokeWidth={2}
                                                label={{
                                                    value: `Inborn Max: ${TOTAL_NICU_INBORN_BEDS}`,
                                                    fill: '#10b981',
                                                    fontSize: 10,
                                                    fontWeight: 'bold',
                                                    position: 'right'
                                                }}
                                            />
                                        )}
                                        {(nicuView !== 'Inborn') && (
                                            <ReferenceLine
                                                y={TOTAL_NICU_OUTBORN_BEDS}
                                                stroke="#f59e0b"
                                                strokeDasharray="8 4"
                                                strokeWidth={2}
                                                label={{
                                                    value: `Outborn Max: ${TOTAL_NICU_OUTBORN_BEDS}`,
                                                    fill: '#f59e0b',
                                                    fontSize: 10,
                                                    fontWeight: 'bold',
                                                    position: 'right'
                                                }}
                                            />
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.PICU)) && (
                                            <ReferenceLine
                                                y={TOTAL_PICU_BEDS}
                                                stroke="#8b5cf6"
                                                strokeDasharray="8 4"
                                                strokeWidth={2}
                                            />
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.SNCU)) && (
                                            <ReferenceLine
                                                y={TOTAL_SNCU_BEDS}
                                                stroke="#0ea5e9"
                                                strokeDasharray="8 4"
                                                strokeWidth={2}
                                            />
                                        )}

                                        {/* Main Occupancy Areas */}
                                        {(nicuView !== 'Outborn') && (
                                            <Area
                                                type="monotone"
                                                dataKey="NICU Inborn"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                fill="url(#inbornGradNew)"
                                                dot={false}
                                                activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                                            />
                                        )}
                                        {(nicuView !== 'Inborn') && (
                                            <Area
                                                type="monotone"
                                                dataKey="NICU Outborn"
                                                stroke="#f59e0b"
                                                strokeWidth={3}
                                                fill="url(#outbornGradNew)"
                                                dot={false}
                                                activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                                            />
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.PICU)) && (
                                            <Area
                                                type="monotone"
                                                dataKey="PICU"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                fill="url(#picuGradNew)"
                                                dot={false}
                                                activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                                            />
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.SNCU)) && (
                                            <Area
                                                type="monotone"
                                                dataKey="SNCU"
                                                stroke="#0ea5e9"
                                                strokeWidth={3}
                                                fill="url(#sncuGradNew)"
                                                dot={false}
                                                activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }}
                                            />
                                        )}

                                        {/* OVERFLOW BARS - Stacked on top, dramatic red */}
                                        {(nicuView !== 'Outborn') && (
                                            <Bar
                                                dataKey="Inborn Overflow"
                                                fill="url(#overflowGrad)"
                                                radius={[4, 4, 0, 0]}
                                                name="🔴 Inborn Overflow"
                                            >
                                                {historicalData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-inborn-${index}`}
                                                        fill={entry['Inborn Overflow'] > 0 ? '#ef4444' : 'transparent'}
                                                        filter={entry['Inborn Overflow'] > 0 ? 'url(#glow)' : undefined}
                                                    />
                                                ))}
                                            </Bar>
                                        )}
                                        {(nicuView !== 'Inborn') && (
                                            <Bar
                                                dataKey="Outborn Overflow"
                                                fill="url(#overflowGrad)"
                                                radius={[4, 4, 0, 0]}
                                                name="🔴 Outborn Overflow"
                                            >
                                                {historicalData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-outborn-${index}`}
                                                        fill={entry['Outborn Overflow'] > 0 ? '#f97316' : 'transparent'}
                                                        filter={entry['Outborn Overflow'] > 0 ? 'url(#glow)' : undefined}
                                                    />
                                                ))}
                                            </Bar>
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.PICU)) && (
                                            <Bar
                                                dataKey="PICU Overflow"
                                                fill="url(#overflowGrad)"
                                                radius={[4, 4, 0, 0]}
                                                name="🔴 PICU Overflow"
                                            >
                                                {historicalData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-picu-${index}`}
                                                        fill={entry['PICU Overflow'] > 0 ? '#a855f7' : 'transparent'}
                                                        filter={entry['PICU Overflow'] > 0 ? 'url(#glow)' : undefined}
                                                    />
                                                ))}
                                            </Bar>
                                        )}
                                        {(!availableUnits || availableUnits.includes(Unit.SNCU)) && (
                                            <Bar
                                                dataKey="SNCU Overflow"
                                                fill="url(#overflowGrad)"
                                                radius={[4, 4, 0, 0]}
                                                name="🔴 SNCU Overflow"
                                            >
                                                {historicalData.map((entry, index) => (
                                                    <Cell
                                                        key={`cell-sncu-${index}`}
                                                        fill={entry['SNCU Overflow'] > 0 ? '#06b6d4' : 'transparent'}
                                                        filter={entry['SNCU Overflow'] > 0 ? 'url(#glow)' : undefined}
                                                    />
                                                ))}
                                            </Bar>
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Overflow Summary Cards */}
                            {overflowEvents.length > 0 && (
                                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {['NICU Inborn', 'NICU Outborn', 'PICU', 'SNCU'].map((unit) => {
                                        const unitEvents = overflowEvents.filter(e => e.unit === unit);
                                        const maxOverflow = unitEvents.length > 0 ? Math.max(...unitEvents.map(e => e.overflow)) : 0;
                                        const totalDays = unitEvents.length;

                                        if (totalDays === 0) return null;

                                        return (
                                            <div key={unit} className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                                <p className="text-red-400 text-xs font-bold">{unit}</p>
                                                <div className="flex items-end justify-between mt-1">
                                                    <div>
                                                        <p className="text-2xl font-black text-white">{totalDays}</p>
                                                        <p className="text-[10px] text-slate-400">overflow days</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-red-400">+{maxOverflow}</p>
                                                        <p className="text-[10px] text-slate-400">max over</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }).filter(Boolean)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Overflow Events Timeline */}
                    {overflowEvents.length > 0 && (
                        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 p-4 md:p-6">
                            <h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2">
                                <span className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </span>
                                Overflow History ({overflowEvents.length} events)
                            </h3>
                            <p className="text-sm text-red-600 mb-4">
                                Showing all days when bed capacity was exceeded in the selected period
                            </p>
                            <div className="space-y-3">
                                {overflowEvents.map((event, index) => {
                                    const hoursAgo = Math.round((new Date().getTime() - event.date.getTime()) / (1000 * 60 * 60));
                                    const daysAgo = Math.floor(hoursAgo / 24);
                                    const timeAgoText = daysAgo > 0 ? `${daysAgo}d ago` : hoursAgo > 0 ? `${hoursAgo}h ago` : 'Now';

                                    return (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-4 p-3 rounded-xl border shadow-sm ${
                                                event.isOngoing ? 'bg-red-100 border-red-300' : 'bg-white border-red-200'
                                            }`}
                                        >
                                            <div className="flex-shrink-0 w-14 h-14 bg-red-100 rounded-xl flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black text-red-600">+{event.overflow}</span>
                                                <span className="text-[9px] text-red-500 font-semibold">OVER</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800">{event.unit}</p>
                                                    {event.isOngoing && (
                                                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                                            ONGOING
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-500">
                                                    <span className="font-semibold text-red-600">{event.totalPatients}</span> patients in <span className="font-semibold">{event.capacity}</span> bed unit
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <p className="text-sm font-bold text-slate-800">
                                                    {event.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {event.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                                <p className="text-xs text-red-500 font-semibold">
                                                    {timeAgoText}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {overflowEvents.length === 0 && (
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6 text-center">
                            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-green-800">No Overflow Events</h3>
                            <p className="text-sm text-green-600 mt-1">All units stayed within capacity during this period</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BedOccupancy;
