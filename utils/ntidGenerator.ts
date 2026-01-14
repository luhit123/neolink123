// Neolink Tracking ID (NTID) Generator
// Format: ABC202501xxxx (3 letter institution prefix + year + month + 4 random digits)

export const generateNTID = (institutionName: string): string => {
  // Get first 3 letters of institution name (uppercase, alphanumeric only)
  const prefix = institutionName
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X'); // Pad with X if less than 3 characters

  // Get current year and month
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  // Generate 4 random digits
  const random = Math.floor(1000 + Math.random() * 9000).toString();

  return `${prefix}${year}${month}${random}`;
};

// Validate NTID format
export const isValidNTID = (ntid: string): boolean => {
  // Format: ABC202501xxxx (3 letters + 4 digit year + 2 digit month + 4 digits = 13 characters)
  const pattern = /^[A-Z]{3}\d{10}$/;
  return pattern.test(ntid);
};

// Extract info from NTID
export const parseNTID = (ntid: string): { prefix: string; year: string; month: string; serial: string } | null => {
  if (!isValidNTID(ntid)) return null;

  return {
    prefix: ntid.substring(0, 3),
    year: ntid.substring(3, 7),
    month: ntid.substring(7, 9),
    serial: ntid.substring(9, 13)
  };
};
