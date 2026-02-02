import React from 'react';

type NicuView = 'All' | 'Inborn' | 'Outborn';

interface NicuViewSelectionProps {
  selectedView: NicuView;
  onSelectView: (view: NicuView) => void;
  showAllOption?: boolean;
}

const NicuViewSelection: React.FC<NicuViewSelectionProps> = ({
  selectedView,
  onSelectView,
  showAllOption = true
}) => {
  const views: { key: NicuView; label: string; icon: string; color: string }[] = [
    ...(showAllOption ? [{ key: 'All' as NicuView, label: 'All', icon: '📊', color: 'purple' }] : []),
    { key: 'Inborn', label: 'Inborn', icon: '🏥', color: 'green' },
    { key: 'Outborn', label: 'Outborn', icon: '🚑', color: 'orange' },
  ];

  return (
    <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
      {views.map((view) => {
        const isSelected = selectedView === view.key;
        const colorClasses = {
          purple: isSelected ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'text-slate-600 hover:bg-purple-100',
          green: isSelected ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'text-slate-600 hover:bg-green-100',
          orange: isSelected ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'text-slate-600 hover:bg-orange-100',
        };

        return (
          <button
            key={view.key}
            onClick={() => onSelectView(view.key)}
            className={`
              flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm
              transition-all duration-200 whitespace-nowrap
              ${colorClasses[view.color as keyof typeof colorClasses]}
              ${isSelected ? 'scale-105' : 'hover:scale-102'}
            `}
          >
            <span className="text-sm sm:text-base">{view.icon}</span>
            <span>{view.label}</span>
            {isSelected && (
              <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default NicuViewSelection;
