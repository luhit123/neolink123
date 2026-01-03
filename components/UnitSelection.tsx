import React from 'react';
import { Unit } from '../types';

interface UnitSelectionProps {
  selectedUnit: Unit;
  onSelectUnit: (unit: Unit) => void;
  availableUnits?: Unit[];
}

const UnitSelection: React.FC<UnitSelectionProps> = ({ selectedUnit, onSelectUnit, availableUnits }) => {
  // Use provided availableUnits or default to all units
  const unitsToShow = availableUnits || Object.values(Unit);

  return (
    <div className="flex flex-wrap gap-1 bg-slate-700/50 p-1 rounded-lg border border-slate-600">
      {unitsToShow.map((unit) => (
        <button
          key={unit}
          onClick={() => onSelectUnit(unit)}
          className={`px-6 py-2 rounded-md text-sm font-semibold transition-all duration-300 flex-1 ${selectedUnit === unit
            ? 'bg-blue-500 text-white shadow-md'
            : 'text-slate-300 hover:bg-slate-600/50'
            }`}
        >
          {unit}
        </button>
      ))}
    </div>
  );
};

export default UnitSelection;
