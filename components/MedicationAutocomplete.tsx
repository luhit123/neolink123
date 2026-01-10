import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { MedicationDatabase } from '../types';

interface MedicationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (medication: MedicationDatabase) => void;
  placeholder?: string;
  className?: string;
}

const MedicationAutocomplete: React.FC<MedicationAutocompleteProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Type medication name...',
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<MedicationDatabase[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search medications in Firebase
  useEffect(() => {
    const searchMedications = async () => {
      if (value.trim().length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setLoading(true);

      try {
        // Search by name (case-insensitive prefix match)
        const searchTerm = value.trim().toLowerCase();

        // Fetch ALL active medications (no orderBy to avoid compound index issues)
        const q = query(
          collection(db, 'medications'),
          where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const meds = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as MedicationDatabase[];

        // Filter medications that match the search term
        const filtered = meds.filter(med => {
          const nameMatch = med.name.toLowerCase().includes(searchTerm);
          const brandMatch = med.brandNames?.some(brand =>
            brand.toLowerCase().includes(searchTerm)
          );
          const searchTermMatch = med.searchTerms?.some(term =>
            term.toLowerCase().includes(searchTerm)
          );
          const indicationMatch = med.indication?.toLowerCase().includes(searchTerm);

          return nameMatch || brandMatch || searchTermMatch || indicationMatch;
        });

        // Sort by relevance (exact matches first, then starts-with, then contains)
        filtered.sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();

          // Exact match
          if (aName === searchTerm) return -1;
          if (bName === searchTerm) return 1;

          // Starts with
          if (aName.startsWith(searchTerm) && !bName.startsWith(searchTerm)) return -1;
          if (bName.startsWith(searchTerm) && !aName.startsWith(searchTerm)) return 1;

          // Alphabetical for remaining
          return aName.localeCompare(bName);
        });

        setSuggestions(filtered.slice(0, 10)); // Limit to top 10 results
        setShowSuggestions(filtered.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error searching medications:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchMedications, 300);
    return () => clearTimeout(debounce);
  }, [value]);

  const handleSelectMedication = (med: MedicationDatabase) => {
    onChange(med.name);
    setShowSuggestions(false);

    if (onSelect) {
      onSelect(med);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectMedication(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Antibiotic': 'bg-blue-100 text-blue-700',
      'Analgesic / Pain Relief': 'bg-purple-100 text-purple-700',
      'Antipyretic / Fever Reducer': 'bg-orange-100 text-orange-700',
      'Respiratory Support': 'bg-green-100 text-green-700',
      'Cardiovascular': 'bg-red-100 text-red-700',
      'Inotrope / Vasopressor': 'bg-red-100 text-red-700',
      'Anticonvulsant': 'bg-yellow-100 text-yellow-700',
      'Sedative / Analgesic': 'bg-indigo-100 text-indigo-700',
      'Diuretic': 'bg-cyan-100 text-cyan-700',
      'Steroid / Corticosteroid': 'bg-pink-100 text-pink-700',
      'Surfactant': 'bg-teal-100 text-teal-700',
      'IV Fluid / Electrolyte': 'bg-sky-100 text-sky-700',
      'Vitamin / Supplement': 'bg-lime-100 text-lime-700',
    };

    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder={placeholder}
          className={`${className} pr-10`}
          autoComplete="off"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-sky-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {!loading && value.trim() && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setSuggestions([]);
              setShowSuggestions(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-sky-300 rounded-xl shadow-2xl max-h-96 overflow-y-auto">
          <div className="p-2 space-y-1">
            {suggestions.map((med, index) => (
              <button
                key={med.id}
                type="button"
                onClick={() => handleSelectMedication(med)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  index === selectedIndex
                    ? 'bg-sky-100 border-2 border-sky-400'
                    : 'bg-white hover:bg-sky-50 border-2 border-transparent hover:border-sky-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                        {med.name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getCategoryColor(med.category)}`}>
                        {med.category}
                      </span>
                    </div>

                    {med.brandNames && med.brandNames.length > 0 && (
                      <p className="text-xs text-slate-500 mb-1">
                        Also known as: {med.brandNames.slice(0, 2).join(', ')}
                      </p>
                    )}

                    <p className="text-xs text-slate-600 line-clamp-1">
                      {med.indication}
                    </p>

                    {med.commonDoses && med.commonDoses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] text-slate-500 font-semibold">Doses:</span>
                        {med.commonDoses.slice(0, 3).map((dose, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-semibold"
                          >
                            {dose}
                          </span>
                        ))}
                      </div>
                    )}

                    {med.routes && med.routes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[10px] text-slate-500 font-semibold">Routes:</span>
                        {med.routes.map((route, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold"
                          >
                            {route}
                          </span>
                        ))}
                      </div>
                    )}

                    {med.warnings && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                        <p className="text-[10px] text-amber-800">
                          <span className="font-bold">⚠️ </span>
                          {med.warnings.slice(0, 100)}
                          {med.warnings.length > 100 && '...'}
                        </p>
                      </div>
                    )}
                  </div>

                  <svg className="w-5 h-5 text-sky-500 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          {value.trim().length >= 2 && suggestions.length === 0 && !loading && (
            <div className="p-4 text-center text-slate-500 text-sm">
              <svg className="w-12 h-12 mx-auto mb-2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold">No medications found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          <div className="p-2 bg-sky-50 border-t-2 border-sky-200 text-[10px] text-sky-700 text-center">
            💡 Use ↑↓ arrows to navigate, Enter to select, Esc to close
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationAutocomplete;
