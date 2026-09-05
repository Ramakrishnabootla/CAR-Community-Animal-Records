/**
 * CAR Platform - Validation Module
 * Validates user inputs before saving to database
 */

/**
 * Validate complete profile data
 * @param {Object} data - Profile data object
 * @return {Object} {valid: boolean, errors: string[]}
 */
function validateProfileData(data) {
  const errors = [];

  // Validate Contributor
  const contributorErrors = validateContributor(data.contributor);
  errors.push(...contributorErrors);

  // Validate Animal
  const animalErrors = validateAnimal(data.animal);
  errors.push(...animalErrors);

  // Validate Location
  const locationErrors = validateLocation(data.location);
  errors.push(...locationErrors);

  if (!data.baselineStatus.healthStatus || data.baselineStatus.healthStatus.trim().length === 0) errors.push('Current health condition is required');
  if (!data.baselineStatus.behavior || data.baselineStatus.behavior.trim().length === 0) errors.push('Behaviour is required');
  if (!data.baselineStatus.identificationMarks || data.baselineStatus.identificationMarks.trim().length === 0) errors.push('Identification marks are required');

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate contributor data
 * @param {Object} contributor - Contributor object
 * @return {string[]} Array of error messages
 */
function validateContributor(contributor) {
  const errors = [];

  // Name (required, min 2 characters)
  if (!contributor.name || contributor.name.trim().length < 2) {
    errors.push('Contributor name is required (minimum 2 characters)');
  }

  // Mobile (required, valid format)
  if (!contributor.mobile || contributor.mobile.trim().length === 0) {
    errors.push('Mobile number is required');
  } else if (!isValidMobile(contributor.mobile)) {
    errors.push('Mobile number is invalid (must be 10 digits)');
  }

  // Email (optional, but if provided must be valid)
  if (contributor.email && contributor.email.trim().length > 0) {
    if (!isValidEmail(contributor.email)) {
      errors.push('Email address is invalid');
    }
  }

  return errors;
}

/**
 * Validate animal data
 * @param {Object} animal - Animal object
 * @return {string[]} Array of error messages
 */
function validateAnimal(animal) {
  const errors = [];

  // Animal Type (required)
  const validTypes = ['Dog', 'Cat', 'Bird', 'Cattle', 'Other'];
  if (!animal.animalType || !validTypes.includes(animal.animalType)) {
    errors.push('Animal type is required (Dog, Cat, Bird, Cattle, or Other)');
  }

  if (!animal.sex || animal.sex.trim().length === 0) errors.push('Sex is required');
  if (!animal.age || animal.age.trim().length === 0) errors.push('Approximate age is required');
  if (!animal.caregiverAnswer || animal.caregiverAnswer.trim().length === 0) errors.push('Caregiver answer is required');
  if (animal.caregiverAnswer === 'Yes' && (!animal.caregiverType || animal.caregiverType.trim().length === 0)) errors.push('Please tell us who takes care of the animal');

  return errors;
}

/**
 * Validate location data
 * @param {Object} location - Location object
 * @return {string[]} Array of error messages
 */
function validateLocation(location) {
  const errors = [];

  if (!location.area || location.area.trim().length === 0) errors.push('Area/Locality is required');
  if (!location.seenRegularly || location.seenRegularly.trim().length === 0) errors.push('Seen regularly answer is required');

  return errors;
}

/**
 * Check if mobile number is valid
 * @param {string} mobile - Mobile number
 * @return {boolean} True if valid
 */
function isValidMobile(mobile) {
  // Remove spaces, dashes, and + sign
  const cleaned = mobile.replace(/[\s\-+]/g, '');

  // Must be 10 digits (Indian format) or 12 digits with country code
  return /^[0-9]{10}$/.test(cleaned) || /^[0-9]{12}$/.test(cleaned);
}

/**
 * Check if email is valid
 * @param {string} email - Email address
 * @return {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize string input
 * @param {string} str - Input string
 * @param {string} defaultValue - Default if empty
 * @return {string} Sanitized string
 */
function sanitizeString(str, defaultValue = '') {
  if (!str || typeof str !== 'string') {
    return defaultValue;
  }
  return str.trim();
}
