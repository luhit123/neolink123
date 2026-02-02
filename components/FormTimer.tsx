import React, { useState, useEffect, useRef } from 'react';

interface FormTimerProps {
  isRunning: boolean;
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
  compact?: boolean;
  label?: string;
}

/**
 * Elegant Form Timer Component
 * Shows elapsed time while filling forms
 */
const FormTimer: React.FC<FormTimerProps> = ({
  isRunning,
  onTimeUpdate,
  className = '',
  compact = false,
  label = 'Entry Time'
}) => {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = new Date();
      }
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          const newSeconds = prev + 1;
          onTimeUpdate?.(newSeconds);
          return newSeconds;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, onTimeUpdate]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get color based on time (encouraging colors)
  const getTimeColor = () => {
    if (seconds < 120) return 'from-green-400 to-emerald-500'; // Under 2 min - great!
    if (seconds < 300) return 'from-blue-400 to-cyan-500'; // 2-5 min - good
    if (seconds < 600) return 'from-amber-400 to-orange-500'; // 5-10 min - okay
    return 'from-purple-400 to-pink-500'; // 10+ min - detailed entry
  };

  // Get pulse intensity based on time
  const getPulseClass = () => {
    if (seconds % 60 === 0 && seconds > 0) return 'animate-bounce';
    return '';
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r ${getTimeColor()} text-white text-xs font-mono shadow-sm ${className}`}>
        <div className={`w-1.5 h-1.5 rounded-full bg-white ${isRunning ? 'animate-pulse' : ''}`} />
        <span>{formatTime(seconds)}</span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${getTimeColor()} text-white shadow-lg ${getPulseClass()}`}>
        {/* Animated background dots */}
        <div className="absolute inset-0 overflow-hidden rounded-xl opacity-30">
          <div className="absolute w-2 h-2 bg-white rounded-full animate-ping" style={{ top: '20%', left: '10%', animationDuration: '2s' }} />
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full animate-ping" style={{ top: '60%', right: '15%', animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <div className="absolute w-1 h-1 bg-white rounded-full animate-ping" style={{ top: '40%', left: '50%', animationDuration: '3s', animationDelay: '1s' }} />
        </div>

        {/* Timer icon */}
        <div className="relative">
          <svg className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Time display */}
        <div className="relative flex flex-col">
          <span className="text-[10px] opacity-80 leading-none">{label}</span>
          <span className="font-mono font-bold text-sm leading-tight tracking-wider">
            {formatTime(seconds)}
          </span>
        </div>

        {/* Recording indicator */}
        {isRunning && (
          <div className="relative flex items-center gap-1">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
            <span className="text-[9px] font-medium opacity-90">REC</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FormTimer;
