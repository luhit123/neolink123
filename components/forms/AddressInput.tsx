import React, { useState, useEffect } from 'react';
import { getAllStateNames, getDistrictsByState } from '../../data/indiaGeoData';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export interface AddressData {
  address?: string;
  village?: string;
  postOffice?: string;
  pinCode?: string;
  district?: string;
  state?: string;
  block?: string;
}

interface AddressInputProps {
  address: AddressData;
  onChange: (address: AddressData) => void;
  required?: boolean;
  showVillage?: boolean;
  className?: string;
}

const AddressInput: React.FC<AddressInputProps> = ({
  address,
  onChange,
  required = false,
  showVillage = true,
  className = ''
}) => {
  const [states] = useState<string[]>(getAllStateNames());
  const [districts, setDistricts] = useState<string[]>([]);
  const [customDistricts, setCustomDistricts] = useState<string[]>([]);
  const [showCustomDistrictInput, setShowCustomDistrictInput] = useState(false);
  const [customDistrictName, setCustomDistrictName] = useState('');
  const [savingDistrict, setSavingDistrict] = useState(false);
  const [districtSaveSuccess, setDistrictSaveSuccess] = useState(false);

  // Load custom districts from Firebase on mount
  useEffect(() => {
    const loadCustomDistricts = async () => {
      try {
        const customDistrictsRef = collection(db, 'customDistricts');
        const snapshot = await getDocs(customDistrictsRef);
        const customDists = snapshot.docs.map(doc => ({
          name: doc.data().name as string,
          state: doc.data().state as string
        }));
        // Store all custom districts
        setCustomDistricts(customDists.map(d => `${d.name}|${d.state}`));
      } catch (error) {
        console.error('Error loading custom districts:', error);
      }
    };
    loadCustomDistricts();
  }, []);

  // Update districts when state changes
  useEffect(() => {
    if (address.state) {
      const stateDistricts = getDistrictsByState(address.state);
      // Add custom districts for this state
      const customForState = customDistricts
        .filter(cd => cd.split('|')[1] === address.state)
        .map(cd => cd.split('|')[0]);

      // Combine and sort, removing duplicates
      const allDistricts = [...new Set([...stateDistricts, ...customForState])].sort();
      setDistricts(allDistricts);

      // If current district is not in new state, clear it
      if (address.district && !allDistricts.includes(address.district)) {
        // Check if it might be a custom district not yet loaded
        // Don't clear in that case
      }
    } else {
      setDistricts([]);
    }
    setShowCustomDistrictInput(false);
  }, [address.state, customDistricts]);

  const handleChange = (field: keyof AddressData, value: string) => {
    onChange({ ...address, [field]: value });

    // Clear district when state changes
    if (field === 'state') {
      onChange({ ...address, state: value, district: '' });
    }
  };

  const handleDistrictChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustomDistrictInput(true);
    } else {
      setShowCustomDistrictInput(false);
      onChange({ ...address, district: value });
    }
  };

  const handleAddCustomDistrict = async () => {
    if (!customDistrictName.trim() || !address.state) return;

    setSavingDistrict(true);
    setDistrictSaveSuccess(false);

    try {
      // Check if district already exists for this state
      const customDistrictsRef = collection(db, 'customDistricts');
      const q = query(
        customDistrictsRef,
        where('name', '==', customDistrictName.trim()),
        where('state', '==', address.state)
      );
      const existingDocs = await getDocs(q);

      if (existingDocs.empty) {
        // Add new custom district
        await addDoc(customDistrictsRef, {
          name: customDistrictName.trim(),
          state: address.state,
          createdAt: new Date().toISOString()
        });
      }

      // Update local state
      const newCustomKey = `${customDistrictName.trim()}|${address.state}`;
      if (!customDistricts.includes(newCustomKey)) {
        setCustomDistricts(prev => [...prev, newCustomKey]);
      }

      // Set the district value
      onChange({ ...address, district: customDistrictName.trim() });
      setDistrictSaveSuccess(true);
      setShowCustomDistrictInput(false);
      setCustomDistrictName('');

      // Clear success message after 2 seconds
      setTimeout(() => setDistrictSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving custom district:', error);
      alert('Failed to save district. Please try again.');
    } finally {
      setSavingDistrict(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* State Dropdown */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-black font-bold mb-1">
            State {required && <span className="text-red-500">*</span>}
          </label>
          <select
            id="state"
            name="state"
            value={address.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            required={required}
            className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          >
            <option value="">Select State</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        {/* District Dropdown with Custom Entry Option */}
        <div>
          <label htmlFor="district" className="block text-sm font-medium text-black font-bold mb-1">
            District {required && <span className="text-red-500">*</span>}
          </label>
          {!showCustomDistrictInput ? (
            <div className="space-y-2">
              <select
                id="district"
                name="district"
                value={address.district || ''}
                onChange={(e) => handleDistrictChange(e.target.value)}
                required={required}
                disabled={!address.state}
                className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {address.state ? 'Select District' : 'Select State first'}
                </option>
                {districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
                {address.state && (
                  <option value="__custom__" className="text-blue-600 font-medium">
                    ➕ District not listed? Add manually...
                  </option>
                )}
              </select>
              {districtSaveSuccess && (
                <p className="text-xs text-green-600 font-medium">
                  ✓ District saved and will be available for future use
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customDistrictName}
                  onChange={(e) => setCustomDistrictName(e.target.value)}
                  placeholder="Enter district name..."
                  className="flex-1 px-4 py-2 bg-white border-2 border-green-500 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddCustomDistrict}
                  disabled={!customDistrictName.trim() || savingDistrict}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingDistrict ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : 'Add'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCustomDistrictInput(false);
                  setCustomDistrictName('');
                }}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Cancel - back to dropdown
              </button>
              <p className="text-xs text-blue-600">
                💡 New districts will be saved and available for future admissions
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Post Office */}
        <div>
          <label htmlFor="postOffice" className="block text-sm font-medium text-black font-bold mb-1">
            Post Office
          </label>
          <input
            type="text"
            id="postOffice"
            name="postOffice"
            value={address.postOffice || ''}
            onChange={(e) => handleChange('postOffice', e.target.value)}
            placeholder="Enter post office name"
            className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        {/* Village/Ward - Optional */}
        {showVillage && (
          <div>
            <label htmlFor="village" className="block text-sm font-medium text-black font-bold mb-1">
              Village/Ward Name
            </label>
            <input
              type="text"
              id="village"
              name="village"
              value={address.village || ''}
              onChange={(e) => handleChange('village', e.target.value)}
              placeholder="Enter village or ward name"
              className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        )}
      </div>

      {/* Full Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-black font-bold mb-1">
          Full Address {required && <span className="text-red-500">*</span>}
        </label>
        <textarea
          id="address"
          name="address"
          value={address.address || ''}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="House/Flat No., Street, Locality..."
          rows={3}
          required={required}
          className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-y"
        />
      </div>
    </div>
  );
};

export default AddressInput;
