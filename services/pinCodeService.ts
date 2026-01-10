/**
 * PIN Code Lookup Service
 * Uses free Postal PIN Code API (https://www.postalpincode.in/Api-Details)
 * No authentication required
 */

export interface PostOffice {
  Name: string;
  Description: string | null;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block: string;
  State: string;
  Country: string;
  Pincode: string;
}

export interface PinCodeResponse {
  Message: string;
  Status: string;
  PostOffice: PostOffice[] | null;
}

interface CacheEntry {
  data: PinCodeResponse;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const pinCodeCache = new Map<string, CacheEntry>();

/**
 * Lookup PIN code and get post office details
 * @param pinCode - 6 digit PIN code
 * @returns Post office details including district, state, etc.
 */
export const lookupPinCode = async (pinCode: string): Promise<PinCodeResponse> => {
  // Validate PIN code format
  const cleanPin = pinCode.trim().replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanPin)) {
    return {
      Message: 'Invalid PIN code format. Must be 6 digits.',
      Status: 'Error',
      PostOffice: null
    };
  }

  // Check cache
  const cached = pinCodeCache.get(cleanPin);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('📌 PIN code from cache:', cleanPin);
    return cached.data;
  }

  // Fetch from API
  try {
    console.log('🌐 Fetching PIN code from API:', cleanPin);
    const response = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: PinCodeResponse[] = await response.json();

    // API returns array with single object
    const result = data[0];

    // Cache the result
    pinCodeCache.set(cleanPin, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Error fetching PIN code:', error);
    return {
      Message: 'Failed to fetch PIN code data. Please try again.',
      Status: 'Error',
      PostOffice: null
    };
  }
};

/**
 * Get primary post office name for a PIN code
 */
export const getPrimaryPostOffice = async (pinCode: string): Promise<string | null> => {
  const result = await lookupPinCode(pinCode);

  if (result.Status === 'Success' && result.PostOffice && result.PostOffice.length > 0) {
    // Find Head Post Office first, otherwise return first one
    const headPO = result.PostOffice.find(po => po.BranchType === 'Head Post Office');
    return headPO ? headPO.Name : result.PostOffice[0].Name;
  }

  return null;
};

/**
 * Get district and state for a PIN code
 */
export const getLocationByPinCode = async (pinCode: string): Promise<{
  district: string;
  state: string;
  postOffice: string;
} | null> => {
  const result = await lookupPinCode(pinCode);

  if (result.Status === 'Success' && result.PostOffice && result.PostOffice.length > 0) {
    const po = result.PostOffice[0];
    return {
      district: po.District,
      state: po.State,
      postOffice: po.Name
    };
  }

  return null;
};

/**
 * Validate if PIN code exists
 */
export const validatePinCode = async (pinCode: string): Promise<boolean> => {
  const result = await lookupPinCode(pinCode);
  return result.Status === 'Success' && result.PostOffice !== null;
};

/**
 * Clear PIN code cache
 */
export const clearPinCodeCache = () => {
  pinCodeCache.clear();
  console.log('📌 PIN code cache cleared');
};

/**
 * Get all post offices for a PIN code
 */
export const getAllPostOffices = async (pinCode: string): Promise<PostOffice[]> => {
  const result = await lookupPinCode(pinCode);

  if (result.Status === 'Success' && result.PostOffice) {
    return result.PostOffice;
  }

  return [];
};
