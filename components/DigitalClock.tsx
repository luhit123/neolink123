import React, { useState, useEffect } from 'react';

const DigitalClock: React.FC = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl p-1.5 shadow-lg border border-slate-700/50 flex flex-col items-center justify-center min-w-[120px] hover:scale-105 transition-transform duration-300 group">
            <div className="text-lg sm:text-xl font-bold bg-gradient-to-r from-medical-teal via-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-widest font-mono group-hover:from-medical-teal-light group-hover:via-cyan-300 group-hover:to-blue-400 transition-all">
                {formatTime(time)}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium mt-0.5 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                {formatDate(time)}
            </div>
        </div>
    );
};

export default DigitalClock;
