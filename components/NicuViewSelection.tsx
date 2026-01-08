import React from 'react';

type NicuView = 'All' | 'Inborn' | 'Outborn';

interface NicuViewSelectionProps {
  selectedView: NicuView;
  onSelectView: (view: NicuView) => void;
}

const NicuViewSelection: React.FC<NicuViewSelectionProps> = ({ selectedView, onSelectView }) => {
  const views: NicuView[] = ['All', 'Inborn', 'Outborn'];

  return (
    <select
      value={selectedView}
      onChange={(e) => onSelectView(e.target.value as NicuView)}
      className="bg-slate-700 text-white text-xs sm:text-sm font-semibold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      {views.map((view) => (
        <option key={view} value={view}>
          {view}
        </option>
      ))}
    </select>
  );
};

export default NicuViewSelection;
