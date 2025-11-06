
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  return (
    <div className="bg-slate-800 p-3 md:p-6 rounded-lg md:rounded-xl shadow-lg border border-slate-700 hover:border-cyan-500/50 transition-all duration-300 active:scale-95 md:hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-slate-400 truncate">{title}</p>
          <p className="text-xl md:text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className={`p-2 md:p-3 rounded-full ${color} flex-shrink-0 ml-2`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
