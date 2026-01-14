import React, { useState, useEffect } from 'react';
import { getAllStateNames, getDistrictsByState } from '../../data/indiaGeoData';
import { getEnhancedLocationByPinCode, EnhancedLocationData } from '../../services/pinCodeService';

export interface AddressData {
  address?: string;
  village?: string;
  postOffice?: string;
  pinCode?: string;
  district?: string;
  state?: string;
  block?: string;
}

interface PostOfficeOption {
  name: string;
  branchType: string;
  deliveryStatus: string;
  block: string;
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
  const [pinCodeSuccess, setPinCodeSuccess] = useState<boolean>(false);
  const [postOffices, setPostOffices] = useState<PostOfficeOption[]>([]);
  const [locationDetails, setLocationDetails] = useState<{
    block?: string;
    region?: string;
    division?: string;
    circle?: string;
  } | null>(null);

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

  const handlePinCodeChange = async (value: string) => {
    const cleanValue = value.replace(/\D/g, '').slice(0, 6);
    onChange({ ...address, pinCode: cleanValue });
    setPinCodeError('');
    setPinCodeSuccess(false);
    setPostOffices([]);
    setLocationDetails(null);

    // Auto-search when 6 digits entered
    if (cleanValue.length === 6) {
      setIsLoadingPinCode(true);
      try {
        const location = await getEnhancedLocationByPinCode(cleanValue);
        if (location) {
          // Store all post offices for dropdown selection
          setPostOffices(location.allPostOffices);
          setLocationDetails({
            block: location.block,
            region: location.region,
            division: location.division,
            circle: location.circle
          });

          onChange({
            ...address,
            pinCode: cleanValue,
            state: location.state,
            district: location.district,
            postOffice: location.postOffice,
            block: location.block
          });
          setPinCodeSuccess(true);
        } else {
          setPinCodeError('Invalid PIN code - not found in postal database');
        }
      } catch (error) {
        console.error('Error looking up PIN code:', error);
        setPinCodeError('Failed to lookup PIN code. Please check your internet connection.');
      } finally {
        setIsLoadingPinCode(false);
      }
    }
  };

  const handlePostOfficeSelect = (postOfficeName: string) => {
    const selectedPO = postOffices.find(po => po.name === postOfficeName);
    if (selectedPO) {
      onChange({
        ...address,
        postOffice: postOfficeName,
        block: selectedPO.block || address.block
      });
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PIN Code with Auto-lookup */}
        <div>
          <label htmlFor="pinCode" className="block text-sm font-medium text-black font-bold mb-1">
            PIN Code {required && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              id="pinCode"
              name="pinCode"
              value={address.pinCode || ''}
              onChange={(e) => handlePinCodeChange(e.target.value)}
              maxLength={6}
              placeholder="Enter 6-digit PIN code"
              required={required}
              className={`w-full px-4 py-2 bg-white border-2 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 ${
                pinCodeSuccess
                  ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                  : pinCodeError
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-blue-600 focus:ring-blue-600 focus:border-blue-600'
              }`}
            />
            {isLoadingPinCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {pinCodeSuccess && !isLoadingPinCode && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          {pinCodeError && (
            <p className="text-xs text-red-600 mt-1 font-medium">{pinCodeError}</p>
          )}
          {pinCodeSuccess && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✓ PIN code verified - Location auto-filled
            </p>
          )}
          {!pinCodeSuccess && !pinCodeError && (
            <p className="text-xs text-blue-600 mt-1">
              📌 Enter PIN to auto-fill Post Office, District & State
            </p>
          )}
        </div>

        {/* Post Office - Dropdown when multiple available */}
        <div>
          <label htmlFor="postOffice" className="block text-sm font-medium text-black font-bold mb-1">
            Post Office {postOffices.length > 1 && <span className="text-blue-600 text-xs font-normal">({postOffices.length} found)</span>}
          </label>
          {postOffices.length > 1 ? (
            <select
              id="postOffice"
              name="postOffice"
              value={address.postOffice || ''}
              onChange={(e) => handlePostOfficeSelect(e.target.value)}
              className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              <option value="">Select Post Office</option>
              {postOffices.map((po, idx) => (
                <option key={idx} value={po.name}>
                  {po.name} ({po.branchType}{po.deliveryStatus === 'Delivery' ? ' - Delivery' : ''})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              id="postOffice"
              name="postOffice"
              value={address.postOffice || ''}
              onChange={(e) => handleChange('postOffice', e.target.value)}
              placeholder="Auto-filled from PIN code"
              className="w-full px-4 py-2 bg-white border-2 border-blue-600 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          )}
        </div>
      </div>

      {/* Location Details Panel - Shows when PIN code found */}
      {locationDetails && (locationDetails.block || locationDetails.region || locationDetails.division) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Detected Location Details
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {locationDetails.block && (
              <div>
                <span className="text-blue-600 font-medium">Block:</span>
                <span className="text-blue-900 ml-1">{locationDetails.block}</span>
              </div>
            )}
            {locationDetails.division && (
              <div>
                <span className="text-blue-600 font-medium">Division:</span>
                <span className="text-blue-900 ml-1">{locationDetails.division}</span>
              </div>
            )}
            {locationDetails.region && (
              <div>
                <span className="text-blue-600 font-medium">Region:</span>
                <span className="text-blue-900 ml-1">{locationDetails.region}</span>
              </div>
            )}
            {locationDetails.circle && (
              <div>
                <span className="text-blue-600 font-medium">Circle:</span>
                <span className="text-blue-900 ml-1">{locationDetails.circle}</span>
              </div>
            )}
          </div>
        </div>
      )}

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

        {/* District Dropdown - Cascades from State */}
        <div>
          <label htmlFor="district" className="block text-sm font-medium text-black font-bold mb-1">
            District {required && <span className="text-red-500">*</span>}
          </label>
          <select
            id="district"
            name="district"
            value={address.district || ''}
            onChange={(e) => handleChange('district', e.target.value)}
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
          </select>
        </div>
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
