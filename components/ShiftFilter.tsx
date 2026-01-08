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
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer bg-slate-100 dark:bg-slate-800 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">⏰ Shift</span>
            </label>

            {enabled && (
                <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 sm:px-3 py-1 sm:py-2">
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="bg-transparent border-0 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium focus:ring-0 cursor-pointer w-16 sm:w-20"
                    />
                    <span className="text-slate-400 text-xs">→</span>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="bg-transparent border-0 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium focus:ring-0 cursor-pointer w-16 sm:w-20"
                    />
                </div>
            )}
        </div>
    );
};

export default ShiftFilter;
