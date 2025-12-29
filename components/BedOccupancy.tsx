import React, { useMemo } from 'react';
import { Patient, Unit } from '../types';

interface BedOccupancyProps {
    patients: Patient[];
}

const BedOccupancy: React.FC<BedOccupancyProps> = ({ patients }) => {
    const activePatients = useMemo(() => patients.filter(p => p.outcome === 'In Progress'), [patients]);

    const nicuPatients = activePatients.filter(p => p.unit === Unit.NICU);
    const picuPatients = activePatients.filter(p => p.unit === Unit.PICU);

    // Assuming a fixed number of beds for visualization, e.g., 20 for NICU, 10 for PICU
    // In a real app, this would be dynamic or configured per institution
    const TOTAL_NICU_BEDS = 20;
    const TOTAL_PICU_BEDS = 10;

    const renderBedGrid = (totalBeds: number, occupiedPatients: Patient[], title: string, colorClass: string) => {
        const occupancyRate = Math.round((occupiedPatients.length / totalBeds) * 100);
        const beds = Array.from({ length: totalBeds }, (_, i) => {
            const patient = occupiedPatients[i];
            return {
                id: i + 1,
                isOccupied: !!patient,
                patientName: patient?.name
            };
        });

        return (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                {/* Background Decoration */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-${colorClass}-500/10 rounded-full blur-3xl -mr-16 -mt-16`}></div>

                <div className="flex justify-between items-end mb-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-sm text-slate-400">
                            {occupiedPatients.length} / {totalBeds} Beds Occupied
                        </p>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-black text-${colorClass}-400`}>{occupancyRate}%</div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Occupancy</div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-700 rounded-full mb-6 overflow-hidden">
                    <div
                        className={`h-full bg-${colorClass}-500 transition-all duration-1000 ease-out`}
                        style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                    ></div>
                </div>

                {/* Beds Grid */}
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {beds.map((bed) => (
                        <div
                            key={bed.id}
                            className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all relative group cursor-default ${bed.isOccupied
                                    ? `bg-${colorClass}-500/20 text-${colorClass}-400 border border-${colorClass}-500/50`
                                    : 'bg-slate-700/30 text-slate-600 border border-slate-700'
                                }`}
                        >
                            {bed.id}
                            {bed.isOccupied && (
                                <div className="absolute opacity-0 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-xl whitespace-nowrap z-20 pointer-events-none transition-opacity">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderBedGrid(TOTAL_NICU_BEDS, nicuPatients, 'NICU Occupancy', 'purple')}
            {renderBedGrid(TOTAL_PICU_BEDS, picuPatients, 'PICU Occupancy', 'cyan')}
        </div>
    );
};

export default BedOccupancy;
