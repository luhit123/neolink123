import React, { useState, useEffect } from 'react';
import { getAllStateNames, getDistrictsByState } from '../../data/indiaGeoData';
import { getLocationByPinCode } from '../../services/pinCodeService';

export interface AddressData {
  address?: string;
  village?: string;
  postOffice?: string;
  pinCode?: string;
  district?: string;
  state?: string;
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
  const [isLoadingPinCode, setIsLoadingPinCode] = useState(false);
  const [pinCodeError, setPinCodeError] = useState<string>('');

  // Update districts when state changes
  useEffect(() => {
    if (address.state) {
      const stateDistricts = getDistrictsByState(address.state);
      setDistricts(stateDistricts);

      // If current district is not in new state, clear it
      if (address.district && !stateDistricts.includes(address.district)) {
        onChange({ ...address, district: '' });
      }
    } else {
      setDistricts([]);
    }
  }, [address.state]);

  const handleChange = (field: keyof AddressData, value: string) => {
    onChange({ ...address, [field]: value });

    // Clear district when state changes
    if (field === 'state') {
      onChange({ ...address, state: value, district: '' });
    }
  };

  const handlePinCodeChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    onChange({ ...address, pinCode: cleanValue });
    setPinCodeError('');
  };

  const handlePinCodeBlur = async () => {
    if (!address.pinCode || address.pinCode.length !== 6) {
      return;
    }

    setIsLoadingPinCode(true);
    setPinCodeError('');

    try {
      const location = await getLocationByPinCode(address.pinCode);

      if (location) {
        // Auto-fill state, district, and post office
        onChange({
          ...address,
          state: location.state,
          district: location.district,
          postOffice: location.postOffice
        });
      } else {
        setPinCodeError('Invalid PIN code or not found');
      }
    } catch (error) {
      console.error('Error looking up PIN code:', error);
      setPinCodeError('Failed to lookup PIN code');
    } finally {
      setIsLoadingPinCode(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PIN Code with Auto-lookup */}
        <div>
          <label htmlFor="pinCode" className="block text-sm font-medium text-sky-700 mb-1">
            PIN Code {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              id="pinCode"
              name="pinCode"
              value={address.pinCode || ''}
              onChange={(e) => handlePinCodeChange(e.target.value)}
              onBlur={handlePinCodeBlur}
              maxLength={6}
              placeholder="Enter 6-digit PIN code"
              required={required}
              className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
            />
            {isLoadingPinCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          {pinCodeError && (
            <p className="text-xs text-red-600 mt-1">{pinCodeError}</p>
          )}
          <p className="text-xs text-sky-600 mt-1">
            📌 Auto-fills Post Office, District & State
          </p>
        </div>

        {/* Post Office - Auto-filled from PIN */}
        <div>
          <label htmlFor="postOffice" className="block text-sm font-medium text-sky-700 mb-1">
            Post Office
          </label>
          <input
            type="text"
            id="postOffice"
            name="postOffice"
            value={address.postOffice || ''}
            onChange={(e) => handleChange('postOffice', e.target.value)}
            placeholder="Auto-filled from PIN code"
            className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* State Dropdown */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-sky-700 mb-1">
            State {required && <span className="text-red-500">*</span>}
          </label>
          <select
            id="state"
            name="state"
            value={address.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            required={required}
            className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          >
            <option value="">Select State</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        {/* District Dropdown - Cascades from State */}
        <div>
          <label htmlFor="district" className="block text-sm font-medium text-sky-700 mb-1">
            District {required && <span className="text-red-500">*</span>}
          </label>
          <select
            id="district"
            name="district"
            value={address.district || ''}
            onChange={(e) => handleChange('district', e.target.value)}
            required={required}
            disabled={!address.state}
            className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {address.state ? 'Select District' : 'Select State first'}
            </option>
            {districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Village/Ward - Optional */}
      {showVillage && (
        <div>
          <label htmlFor="village" className="block text-sm font-medium text-sky-700 mb-1">
            Village/Ward Name
          </label>
          <input
            type="text"
            id="village"
            name="village"
            value={address.village || ''}
            onChange={(e) => handleChange('village', e.target.value)}
            placeholder="Enter village or ward name"
            className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
      )}

      {/* Full Address */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-sky-700 mb-1">
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
          className="w-full px-4 py-2 bg-white border-2 border-sky-200 rounded-lg text-slate-800 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400 resize-y"
        />
      </div>
    </div>
  );
};

export default AddressInput;
