/**
 * CAR Platform - ID Generation Module
 * Generates unique IDs for CAR profiles and other entities
 */

/**
 * Generate CAR Profile ID in format: CAR-YYYYMMDD-XXXXX
 * @return {string} Unique CAR Profile ID
 */
function generateCARProfileID() {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const carId = createCARID();

    // Check uniqueness
    if (!carIDExists(carId)) {
      return carId;
    }
  }

  // If we reach here, we had collision issues
  throw new Error('Unable to generate unique CAR ID after ' + maxAttempts + ' attempts');
}

/**
 * Create a CAR ID string
 * @return {string} CAR ID
 */
function createCARID() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Generate 5-character random alphanumeric suffix
  const suffix = generateRandomString(5);

  return `CAR-${dateStr}-${suffix}`;
}

/**
 * Generate random alphanumeric string (uppercase)
 * @param {number} length - Length of string
 * @return {string} Random string
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Check if CAR ID already exists in Animals sheet
 * @param {string} carId - CAR Profile ID to check
 * @return {boolean} True if exists, false otherwise
 */
function carIDExists(carId) {
  const sheet = getSheet(CONFIG.sheetNames.animals);
  const data = sheet.getDataRange().getValues();

  // Skip header row (index 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === carId) {
      return true;
    }
  }

  return false;
}

/**
 * Generate Contributor ID in format: CON-XXXXX
 * @return {string} Unique Contributor ID
 */
function generateContributorID() {
  return 'CON-' + generateRandomString(5);
}

/**
 * Generate Location ID in format: LOC-XXXXX
 * @return {string} Unique Location ID
 */
function generateLocationID() {
  return 'LOC-' + generateRandomString(5);
}

/**
 * Generate Baseline ID in format: BAS-XXXXX
 * @return {string} Unique Baseline ID
 */
function generateBaselineID() {
  return 'BAS-' + generateRandomString(5);
}

/**
 * Generate Media ID in format: MED-XXXXX
 * @return {string} Unique Media ID
 */
function generateMediaID() {
  return 'MED-' + generateRandomString(5);
}
