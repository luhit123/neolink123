import React from 'react';

type NicuView = 'All' | 'Inborn' | 'Outborn';

interface NicuViewSelectionProps {
  selectedView: NicuView;
  onSelectView: (view: NicuView) => void;
}

const NicuViewSelection: React.FC<NicuViewSelectionProps> = ({ selectedView, onSelectView }) => {
  const views: NicuView[] = ['All', 'Inborn', 'Outborn'];

  return (
    <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <h3 className="text-md font-semibold text-slate-300">NICU Patient View:</h3>
        <div className="flex bg-slate-700/50 p-1 rounded-lg border border-slate-600">
          {views.map((view) => (
            <button
              key={view}
              onClick={() => onSelectView(view)}
              className={`px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 min-w-[100px] ${
                selectedView === view
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NicuViewSelection;
