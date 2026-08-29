/**
 * CAR Platform - Profile Module
 * Saves complete animal profiles across linked sheets
 */

/**
 * Save complete animal profile to Google Sheets database
 * @param {Object} data - Profile data containing contributor, animal, location, baseline status, and media files
 * @return {Object} {success: boolean, carProfileId: string, error: string}
 */
function apiSaveProfile(data) {
  try {
    // 1. Validate complete profile data
    const validationResult = validateProfileData(data);
    validationResult.errors.push(...validateMediaFiles(data.media));
    validationResult.valid = validationResult.errors.length === 0;
    if (!validationResult.valid) {
      return {
        success: false,
        error: 'Validation errors: ' + validationResult.errors.join('; ')
      };
    }

    const timestamp = new Date();

    // 2. Save Contributor (Check for existing contributor by mobile to avoid duplicates)
    let contributorId = findContributorByMobile(data.contributor.mobile);
    if (!contributorId) {
      contributorId = generateContributorID();
      const contributorSheet = getSheet(CONFIG.sheetNames.contributors);
      contributorSheet.appendRow([
        contributorId,
        sanitizeString(data.contributor.name),
        sanitizeString(data.contributor.mobile),
        sanitizeString(data.contributor.email),
        timestamp
      ]);
    }

    // 3. Save Location
    const locationId = generateLocationID();
    const locationSheet = getSheet(CONFIG.sheetNames.locations);
    locationSheet.appendRow([
      locationId,
      sanitizeString(data.location.usualLocationType),
      sanitizeString(data.location.state),
      sanitizeString(data.location.city),
      sanitizeString(data.location.area),
      sanitizeString(data.location.landmark),
      sanitizeString(data.location.gpsLocation || data.location.gpsCoordinates),
      sanitizeString(data.location.seenRegularly),
      timestamp
    ]);

    // 4. Generate Unique CAR Profile ID
    const carProfileId = generateCARProfileID();

    // 5. Save Animal
    let animalName = sanitizeString(data.animal.animalName);
    if (!animalName) {
      animalName = 'Unknown';
    }
    animalName = buildUniqueAnimalName(animalName);

    const animalSheet = getSheet(CONFIG.sheetNames.animals);
    animalSheet.appendRow([
      carProfileId,
      animalName,
      data.animal.animalType,
      sanitizeString(data.animal.breedType),
      data.animal.animalType === 'Dog' ? data.animal.nativeDogType : '',
      sanitizeString(data.animal.breedOtherDetails),
      data.animal.sex || 'Unknown',
      data.animal.age || 'Unknown',
      sanitizeString(data.animal.caregiverAnswer),
      sanitizeString(data.animal.caregiverType),
      sanitizeString(data.animal.caregiverOtherDetails),
      sanitizeString(data.animal.careProvided),
      sanitizeString(data.animal.careOtherDetails),
      contributorId,
      locationId,
      timestamp
    ]);

    // 6. Save Baseline Status
    const baselineId = generateBaselineID();
    const baselineSheet = getSheet(CONFIG.sheetNames.baselineStatus);
    baselineSheet.appendRow([
      baselineId,
      carProfileId,
      data.baselineStatus.healthStatus || 'Unknown',
      data.baselineStatus.vaccinationStatus || 'Unknown',
      data.baselineStatus.sterilisationStatus || 'Unknown',
      sanitizeString(data.baselineStatus.behavior),
      sanitizeString(data.baselineStatus.abcStatus),
      sanitizeString(data.baselineStatus.abcOutcome),
      sanitizeString(data.baselineStatus.identificationMarks),
      sanitizeString(data.baselineStatus.identificationOtherDetails),
      sanitizeString(data.baselineStatus.additionalDetails),
      timestamp
    ]);

    // 7. Save Media (If any uploaded photos/documents)
    if (data.media && data.media.length > 0) {
      const mediaFolder = getOrCreateMediaFolder();
      const animalFolder = getOrCreateChildFolder(mediaFolder, carProfileId);

      data.media.forEach(fileObj => {
        saveMediaFile(carProfileId, animalFolder.getId(), fileObj);
      });
    }

    // 8. Trigger notifications (Email confirmation only for Week 1)
    if (data.contributor.email) {
      sendEmailConfirmation(data.contributor.name, data.contributor.email, animalName, carProfileId);
    }

    return {
      success: true,
      carProfileId: carProfileId
    };

  } catch (err) {
    Logger.log('Error saving profile: ' + err.toString());
    return {
      success: false,
      error: 'Server error: ' + err.toString()
    };
  }
}

/**
 * Find existing Contributor ID by mobile number
 * @param {string} mobile - Mobile number to search
 * @return {string|null} Contributor ID if found, null otherwise
 */
function findContributorByMobile(mobile) {
  const sheet = getSheet(CONFIG.sheetNames.contributors);
  const data = sheet.getDataRange().getValues();

  // Clean the mobile number to compare
  const cleanMobileSearch = mobile.replace(/[\s\-+]/g, '');

  for (let i = 1; i < data.length; i++) {
    const cleanMobileRow = String(data[i][2]).replace(/[\s\-+]/g, '');
    if (cleanMobileRow === cleanMobileSearch) {
      return data[i][0]; // Return ContributorID
    }
  }

  return null;
}

function buildUniqueAnimalName(name) {
  const cleanName = sanitizeString(name) || 'Unknown';
  const sheet = getSheet(CONFIG.sheetNames.animals);
  const rows = sheet.getDataRange().getValues();
  const existingNames = rows.slice(1)
    .map(row => sanitizeString(row[1]))
    .filter(Boolean)
    .filter(value => value.toLowerCase() === cleanName.toLowerCase() || value.toLowerCase().startsWith(cleanName.toLowerCase() + ' (' ));

  if (!existingNames.length) {
    return cleanName;
  }

  const suffixes = existingNames
    .map(value => {
      const match = String(value).match(/\((\d+)\)$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(value => value > 0);

  const nextIndex = Math.max(1, ...suffixes, 1) + 1;
  return cleanName + ' (' + nextIndex + ')';
}
