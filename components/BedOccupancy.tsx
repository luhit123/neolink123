import React, { useMemo, useState } from 'react';
import { Patient, Unit, BedCapacity } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';

interface BedOccupancyProps {
    patients: Patient[];
    bedCapacity?: BedCapacity;
}

type TimeRange = '7days' | '30days' | '3months' | '6months' | '12months' | 'current';

const BedOccupancy: React.FC<BedOccupancyProps> = ({ patients, bedCapacity }) => {
    const [timeRange, setTimeRange] = useState<TimeRange>('current');

    const timeRanges = [
        { value: 'current' as TimeRange, label: 'Current Status', icon: '🏥' },
        { value: '7days' as TimeRange, label: 'Last 7 Days', icon: '📅' },
        { value: '30days' as TimeRange, label: 'Last 30 Days', icon: '📆' },
        { value: '3months' as TimeRange, label: 'Last 3 Months', icon: '🗓️' },
        { value: '6months' as TimeRange, label: 'Last 6 Months', icon: '📊' },
        { value: '12months' as TimeRange, label: 'Last 12 Months', icon: '📈' },
    ];

    // Use bed capacity from props or defaults
    const TOTAL_NICU_BEDS = bedCapacity?.NICU || 20;
    const TOTAL_PICU_BEDS = bedCapacity?.PICU || 10;

    // Current active patients (for bed grid)
    const activePatients = useMemo(() => patients.filter(p => p.outcome === 'In Progress'), [patients]);
    const nicuPatients = activePatients.filter(p => p.unit === Unit.NICU);
    const picuPatients = activePatients.filter(p => p.unit === Unit.PICU);

    // Historical occupancy data
    const historicalData = useMemo(() => {
        if (timeRange === 'current') return [];

        const now = new Date();
        const dataPoints = [];

        // Determine time range and granularity
        let days = 0;
        let stepDays = 1;

        switch (timeRange) {
            case '7days':
                days = 7;
                stepDays = 1;
                break;
            case '30days':
                days = 30;
                stepDays = 1;
                break;
            case '3months':
                days = 90;
                stepDays = 3;
                break;
            case '6months':
                days = 180;
                stepDays = 7;
                break;
            case '12months':
                days = 365;
                stepDays = 15;
                break;
        }

        // Generate data points
        for (let i = days; i >= 0; i -= stepDays) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            // Count patients who were in progress on this date
            const patientsOnDate = patients.filter(p => {
                const admissionDate = new Date(p.admissionDate);
                const releaseDate = p.releaseDate || p.finalDischargeDate;
                const endDate = releaseDate ? new Date(releaseDate) : new Date();

                // Patient was occupying a bed if admitted before/on date and not discharged yet
                return admissionDate <= date && endDate >= date;
            });

            const nicuCount = patientsOnDate.filter(p => p.unit === Unit.NICU).length;
            const picuCount = patientsOnDate.filter(p => p.unit === Unit.PICU).length;

            dataPoints.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                NICU: nicuCount,
                PICU: picuCount,
                'NICU Capacity': TOTAL_NICU_BEDS,
                'PICU Capacity': TOTAL_PICU_BEDS,
            });
        }

        return dataPoints;
    }, [patients, timeRange, TOTAL_NICU_BEDS, TOTAL_PICU_BEDS]);

    const renderBedGrid = (totalBeds: number, occupiedPatients: Patient[], title: string, colorClass: string) => {
        const occupiedCount = occupiedPatients.length;
        const overflow = Math.max(0, occupiedCount - totalBeds);
        const occupancyRate = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;
        const isOverflow = occupiedCount > totalBeds;

        const beds = Array.from({ length: totalBeds }, (_, i) => {
            const patient = occupiedPatients[i];
            return {
                id: i + 1,
                isOccupied: !!patient,
                patientName: patient?.name
            };
        });

        return (
            <div className={`bg-white rounded-xl shadow-xl border-2 p-6 transition-all duration-200 hover:shadow-2xl ${isOverflow ? 'border-red-300' : 'border-sky-200'}`}>
                {/* Background Decoration */}
                <div className={`absolute top-0 right-0 w-32 h-32 ${isOverflow ? 'bg-red-500/10' : 'bg-sky-500/10'} rounded-full blur-3xl -mr-16 -mt-16`}></div>

                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-sky-900 flex items-center gap-2">
                            {title}
                            {isOverflow && (
                                <span className="px-2 py-1 bg-red-100 border border-red-300 text-red-600 text-xs font-bold rounded animate-pulse">
                                    OVERFLOW
                                </span>
                            )}
                        </h3>
                        <p className={`text-sm ${isOverflow ? 'text-red-600 font-bold' : 'text-sky-600'}`}>
                            {occupiedCount} / {totalBeds} Beds {isOverflow && `(+${overflow})`}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-black ${isOverflow ? 'text-red-600' : 'text-sky-600'}`}>
                            {occupancyRate}%
                        </div>
                        <div className="text-xs text-sky-500 uppercase font-semibold">Occupancy</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-sky-100 rounded-full mb-6 overflow-hidden">
                    <div
                        className={`h-full ${isOverflow ? 'bg-red-500' : 'bg-gradient-to-r from-sky-500 to-blue-500'} transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                    ></div>
                </div>

                {/* Beds Grid */}
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {beds.map((bed) => (
                        <div
                            key={bed.id}
                            className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all relative group cursor-default ${bed.isOccupied
                                    ? 'bg-sky-100 text-sky-700 border-2 border-sky-400 shadow-md'
                                    : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                                }`}
                        >
                            {bed.id}
                            {bed.isOccupied && (
                                <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-sky-900 text-white text-xs rounded shadow-xl whitespace-nowrap z-20 pointer-events-none transition-opacity">
                                    {bed.patientName}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Time Range Filter */}
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                    <svg className="w-6 h-6 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="text-lg font-bold text-sky-900">Bed Occupancy Analysis</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                    {timeRanges.map((range) => (
                        <button
                            key={range.value}
                            onClick={() => setTimeRange(range.value)}
                            className={`
                                px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2
                                ${timeRange === range.value
                                    ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg scale-105'
                                    : 'bg-white text-sky-700 border-2 border-sky-200 hover:border-sky-400 hover:shadow-md'
                                }
                            `}
                        >
                            <span>{range.icon}</span>
                            <span>{range.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Historical Trend Chart */}
            {timeRange !== 'current' && historicalData.length > 0 && (
                <div className="bg-white rounded-xl shadow-xl border-2 border-sky-200 p-6 transition-all duration-200 hover:shadow-2xl">
                    <h3 className="text-xl font-bold text-sky-900 mb-4 flex items-center gap-2">
                        <span className="text-2xl">📊</span>
                        Bed Occupancy Trends
                    </h3>
                    <div className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historicalData}>
                                <defs>
                                    <linearGradient id="colorNICU" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                                    </linearGradient>
                                    <linearGradient id="colorPICU" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#0369a1"
                                    tick={{ fontSize: 11, fill: '#0369a1' }}
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                />
                                <YAxis stroke="#0369a1" tick={{ fontSize: 11, fill: '#0369a1' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '2px solid #0ea5e9',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="NICU"
                                    stroke="#0ea5e9"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorNICU)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="PICU"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorPICU)"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="NICU Capacity"
                                    stroke="#0ea5e9"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="PICU Capacity"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Current Bed Status Grid */}
            {timeRange === 'current' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderBedGrid(TOTAL_NICU_BEDS, nicuPatients, 'NICU Occupancy', 'sky')}
                    {renderBedGrid(TOTAL_PICU_BEDS, picuPatients, 'PICU Occupancy', 'blue')}
                </div>
            )}
        </div>
    );
};

export default BedOccupancy;
