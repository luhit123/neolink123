import React, { useState, useEffect } from 'react';

export interface ShiftFilterConfigs {
    enabled: boolean;
    startTime: string; // "HH:mm" format
    endTime: string; // "HH:mm" format
}

interface ShiftFilterProps {
    onFilterChange: (config: ShiftFilterConfigs) => void;
}

const ShiftFilter: React.FC<ShiftFilterProps> = ({ onFilterChange }) => {
    const [enabled, setEnabled] = useState(() => {
        try {
            const stored = localStorage.getItem('shiftFilterEnabled');
            return stored ? JSON.parse(stored) : false;
        } catch {
            return false;
        }
    });
    const [startTime, setStartTime] = useState(() => localStorage.getItem('shiftFilterStartTime') || '08:00');
    const [endTime, setEndTime] = useState(() => localStorage.getItem('shiftFilterEndTime') || '20:00');

    useEffect(() => {
        localStorage.setItem('shiftFilterEnabled', JSON.stringify(enabled));
        localStorage.setItem('shiftFilterStartTime', startTime);
        localStorage.setItem('shiftFilterEndTime', endTime);
        onFilterChange({ enabled, startTime, endTime });
    }, [enabled, startTime, endTime, onFilterChange]);

    return (
        <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
                <label className="text-md font-semibold text-slate-300 whitespace-nowrap cursor-pointer flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => setEnabled(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-600 text-teal-600 focus:ring-teal-500 bg-slate-700"
                    />
                    Filter by Shift Duty
                </label>
            </div>

            <div className={`flex flex-col sm:flex-row items-center gap-2 transition-opacity duration-200 ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Start:</span>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="form-input py-1 px-2 text-sm w-32"
                        disabled={!enabled}
                    />
                </div>
                <span className="text-slate-400 hidden sm:inline">-</span>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">End:</span>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="form-input py-1 px-2 text-sm w-32"
                        disabled={!enabled}
                    />
                </div>
            </div>
        </div>
    );
};

export default ShiftFilter;
