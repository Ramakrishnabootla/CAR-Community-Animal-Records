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

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(carId).trim()) {
      return true;
    }
  }

  return false;
}

function generateContributorID() {
  return 'CON-' + generateRandomString(5);
}

function generateLocationID() {
  return 'LOC-' + generateRandomString(5);
}

function generateBaselineID() {
  return 'BAS-' + generateRandomString(5);
}

function generateMediaID() {
  return 'MED-' + generateRandomString(5);
}

function generateHoldID() {
  return 'HLD-' + generateRandomString(5);
}

function generateCorrectionID() {
  return 'COR-' + generateRandomString(5);
}
