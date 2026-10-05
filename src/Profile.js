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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return { success: false, error: 'Server busy processing another profile. Please retry in a few seconds.' };
  }

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
      appendRecordBySchema(contributorSheet, CONFIG.sheetNames.contributors, {
        contributorid: contributorId,
        name: sanitizeString(data.contributor.name),
        mobile: "'" + sanitizeString(data.contributor.mobile),
        email: sanitizeString(data.contributor.email),
        timestamp: timestamp
      });
    }

    // 3. Save Location (with GPS latitude/longitude from client-side HTML5 Geolocation)
    const locationId = generateLocationID();
    const locationSheet = getSheet(CONFIG.sheetNames.locations);
    appendRecordBySchema(locationSheet, CONFIG.sheetNames.locations, {
      locationid: locationId,
      usuallocationtype: sanitizeString(data.location.usualLocationType),
      state: sanitizeString(data.location.state),
      city: sanitizeString(data.location.city),
      area: sanitizeString(data.location.area),
      landmark: sanitizeString(data.location.landmark),
      gpscoordinates: sanitizeString(data.location.gpsCoordinates),
      gpslatitude: sanitizeString(data.location.gpsLatitude),
      gpslongitude: sanitizeString(data.location.gpsLongitude),
      gpscapturedmethod: sanitizeString(data.location.gpsCapturedMethod || 'Manual Entry'),
      seenregularly: sanitizeString(data.location.seenRegularly),
      timestamp: timestamp
    });

    // 4. Generate Unique CAR Profile ID
    const carProfileId = generateCARProfileID();

    // 5. Save Animal
    const animalName = buildUniqueAnimalName(data.animal.animalName || 'Unknown');
    const animalSheet = getSheet(CONFIG.sheetNames.animals);
    appendRecordBySchema(animalSheet, CONFIG.sheetNames.animals, {
      carprofileid: "'" + carProfileId,
      animalname: animalName,
      animaltype: sanitizeString(data.animal.animalType),
      breedtype: sanitizeString(data.animal.breedType),
      nativedogtype: sanitizeString(data.animal.nativeDogType),
      breedotherdetails: sanitizeString(data.animal.breedOtherDetails),
      sex: sanitizeString(data.animal.sex),
      age: sanitizeString(data.animal.age),
      vaccinated_rabies: normalizeAnimalStatus(data.animal.vaccinatedRabies, "Don't Know"),
      sterilized: normalizeAnimalStatus(data.animal.sterilized || data.baselineStatus.sterilisationStatus, "Don't Know"),
      vaccinated_rabies_initial: normalizeAnimalStatus(data.animal.vaccinatedRabies, "Don't Know"),
      sterilized_initial: normalizeAnimalStatus(data.animal.sterilized || data.baselineStatus.sterilisationStatus, "Don't Know"),
      caregiveranswer: sanitizeString(data.animal.caregiverAnswer),
      caregivertype: sanitizeString(data.animal.caregiverType),
      caregiverotherdetails: sanitizeString(data.animal.caregiverOtherDetails),
      careprovided: sanitizeString(data.animal.careProvided),
      careotherdetails: sanitizeString(data.animal.careOtherDetails),
      contributorid: contributorId,
      locationid: locationId,
      timestamp: timestamp
    });

    // 6. Save Baseline Status
    const baselineId = generateBaselineID();
    const baselineSheet = getSheet(CONFIG.sheetNames.baselineStatus);
    appendRecordBySchema(baselineSheet, CONFIG.sheetNames.baselineStatus, {
      baselineid: baselineId,
      carprofileid: "'" + carProfileId,
      healthstatus: sanitizeString(data.baselineStatus.healthStatus),
      vaccinationstatus: sanitizeString(data.baselineStatus.vaccinationStatus),
      sterilisationstatus: sanitizeString(data.baselineStatus.sterilisationStatus),
      behavior: sanitizeString(data.baselineStatus.behavior),
      abcstatus: sanitizeString(data.baselineStatus.abcStatus),
      abcoutcome: sanitizeString(data.baselineStatus.abcOutcome),
      identificationmarks: sanitizeString(data.baselineStatus.identificationMarks),
      identificationotherdetails: sanitizeString(data.baselineStatus.identificationOtherDetails),
      additionaldetails: sanitizeString(data.baselineStatus.additionalDetails),
      lastvaccinated: sanitizeString(data.baselineStatus.lastVaccinated),
      timestamp: timestamp
    });

    // 7. Save Media (If any uploaded photos/documents) - Now uses animal-type subfolders and renaming
    if (data.media && data.media.length > 0) {
      const contributorName = sanitizeString(data.contributor.name);
      const animalType = data.animal.animalType || 'Other';

      data.media.forEach(fileObj => {
        saveMediaFile(carProfileId, contributorName, animalType, fileObj);
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
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function normalizeAnimalStatus(value, fallback) {
  const status = sanitizeString(value).toLowerCase();
  if (status === 'yes' || status === 'vaccinated' || status === 'sterilised' || status === 'sterilized') return 'Yes';
  if (status === 'no' || status === 'unsterilised' || status === 'unsterilized') return 'No';
  if (status === "don't know" || status === 'unknown') return "Don't Know";
  return fallback;
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
  const cleanMobileSearch = String(mobile).replace(/[\s\-+\']/g, '');

  for (let i = 1; i < data.length; i++) {
    const cleanMobileRow = String(data[i][2]).replace(/[\s\-+\']/g, '');
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

  // BUG-07 FIX: When no existing suffixes exist, nextIndex should start at 1 (not 2).
  // suffixes filters for values > 0, so when empty, max should be 0, giving nextIndex = 1.
  const nextIndex = suffixes.length > 0 ? Math.max(...suffixes) + 1 : 1;
  return cleanName + ' (' + nextIndex + ')';
}
