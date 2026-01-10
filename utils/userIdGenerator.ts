/**
 * User ID Generator for Institution Admins
 * Generates unique UserIDs based on district and sequence number
 */

/**
 * Generates UserID from district name and sequence number
 * Format: First 3 letters of district (uppercase) + 3-digit number
 * Example: "GUW001", "DIB002", "SIB003"
 */
export const generateUserID = (districtName: string, sequenceNumber: number): string => {
  // Extract first 3 letters of district, uppercase
  const districtPrefix = districtName
    .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
    .substring(0, 3)
    .toUpperCase();

  // Pad sequence number to 3 digits
  const sequencePart = sequenceNumber.toString().padStart(3, '0');

  return `${districtPrefix}${sequencePart}`;
};

/**
 * Validates UserID format
 * Must be 6 characters: 3 letters + 3 digits
 */
export const validateUserID = (userID: string): boolean => {
  const userIDRegex = /^[A-Z]{3}\d{3}$/;
  return userIDRegex.test(userID);
};

/**
 * Extracts district prefix from UserID
 */
export const extractDistrictPrefix = (userID: string): string => {
  if (!validateUserID(userID)) return '';
  return userID.substring(0, 3);
};

/**
 * Extracts sequence number from UserID
 */
export const extractSequenceNumber = (userID: string): number => {
  if (!validateUserID(userID)) return 0;
  return parseInt(userID.substring(3), 10);
};

/**
 * Get next available sequence number for a district
 * This should query existing institutions in Firestore
 */
export const getNextSequenceNumber = (existingUserIDs: string[], districtPrefix: string): number => {
  // Filter UserIDs that match the district prefix
  const matchingIDs = existingUserIDs.filter(id =>
    id.startsWith(districtPrefix.toUpperCase())
  );

  if (matchingIDs.length === 0) {
    return 1; // First institution in this district
  }

  // Extract sequence numbers and find the maximum
  const sequenceNumbers = matchingIDs
    .map(id => extractSequenceNumber(id))
    .filter(num => !isNaN(num));

  const maxSequence = Math.max(...sequenceNumbers);
  return maxSequence + 1;
};

/**
 * Example usage:
 * const userID = generateUserID("Guwahati", 1); // "GUW001"
 * const userID = generateUserID("Dibrugarh", 2); // "DIB002"
 * const userID = generateUserID("Sivasagar", 15); // "SIV015"
 */
