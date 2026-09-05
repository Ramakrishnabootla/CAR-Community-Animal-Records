/**
 * CAR Platform - Search Module
 * Handles exact Profile retrieval, Search-Before-Create with Locality & Attribute matching,
 * and Admin Hold Queue management.
 */

/**
 * API Search function called from client UI.
 * Rules: Must match exactly. Missing or mistyped ID must show "Not Found" rather than silent profile creation.
 * @param {string} carProfileID - CAR ID to search
 * @return {Object} Profile data or null
 */
function apiSearchProfile(carProfileID) {
  try {
    if (!carProfileID) {
      return { success: false, error: 'Empty Profile ID search' };
    }

    const cleanId = String(carProfileID).trim().replace(/^'/, '');

    // 1. Fetch Animals sheet details
    const animalRow = findAnimalRowByProfileId(cleanId);
    if (!animalRow) {
      return { success: false, found: false };
    }

    // Animal details mapping
    const animal = {
      carProfileId: animalRow[0],
      animalName: animalRow[1],
      animalType: animalRow[2],
      breedType: animalRow[3],
      nativeDogType: animalRow[4],
      breedOtherDetails: animalRow[5],
      sex: animalRow[6],
      age: animalRow[7],
      caregiverAnswer: animalRow[8],
      caregiverType: animalRow[9],
      caregiverOtherDetails: animalRow[10],
      careProvided: animalRow[11],
      careOtherDetails: animalRow[12],
      contributorId: animalRow[13],
      locationId: animalRow[14],
      timestamp: clientValue(animalRow[15])
    };

    // 2. Fetch Contributor details (privacy protection: strip sensitive contact fields in public searches)
    const contributorRow = findRowByID(CONFIG.sheetNames.contributors, 0, animal.contributorId);
    const contributor = contributorRow ? {
      contributorId: contributorRow[0],
      name: contributorRow[1],
      timestamp: clientValue(contributorRow[4])
    } : null;

    // 3. Fetch Location details
    const locationRow = findRowByID(CONFIG.sheetNames.locations, 0, animal.locationId);
    const location = locationRow ? {
      locationId: locationRow[0],
      usualLocationType: locationRow[1],
      state: locationRow[2],
      city: locationRow[3],
      area: locationRow[4],
      landmark: locationRow[5],
      gpsCoordinates: locationRow[6],
      gpsLatitude: locationRow[7],
      gpsLongitude: locationRow[8],
      gpsCapturedMethod: locationRow[9],
      seenRegularly: locationRow[10],
      timestamp: clientValue(locationRow[11])
    } : null;

    // 4. Fetch Baseline Status
    const baselineRow = findRowByID(CONFIG.sheetNames.baselineStatus, 1, cleanId);
    const baselineStatus = baselineRow ? {
      baselineId: baselineRow[0],
      carProfileId: baselineRow[1],
      healthStatus: baselineRow[2],
      vaccinationStatus: baselineRow[3],
      sterilisationStatus: baselineRow[4],
      behavior: baselineRow[5],
      abcStatus: baselineRow[6],
      abcOutcome: baselineRow[7],
      identificationMarks: baselineRow[8],
      identificationOtherDetails: baselineRow[9],
      additionalDetails: baselineRow[10],
      timestamp: clientValue(baselineRow[11])
    } : null;

    // 5. Fetch Media links
    const mediaRows = findAllRowsByID(CONFIG.sheetNames.media, 1, cleanId);
    const media = mediaRows.map(row => ({
      mediaId: row[0],
      carProfileId: row[1],
      eventId: row[2],
      animalType: row[3],
      mediaType: row[4],
      driveFileId: row[5],
      driveFileURL: getDirectDriveImageUrl(row[5], row[6]),
      fileName: row[7],
      visibility: row[8] || 'Restricted',
      source: row[9] || 'Self-reported',
      uploadTimestamp: clientValue(row[10])
    }));

    const eventRows = findEventRowsByProfileId(cleanId);
    const events = eventRows.map(row => ({
      eventId: row[0], carProfileId: row[1], dateReported: row[2], animalType: row[3], animalOtherDetails: row[4],
      animalName: row[5], area: row[6], landmark: row[7], googleLocationPin: row[8],
      healthCondition: row[9], healthOtherDetails: row[10], behaviour: row[11],
      behaviourOtherDetails: row[12], vaccinated: row[13], sterilised: row[14],
      identificationMarks: row[15], identificationOtherDetails: row[16], eventType: row[17],
      eventCategory: row[18], eventOtherDetails: row[19], dateOfEvent: row[20], organisationOrPerson: row[21],
      eventDescription: row[22], outcomeCurrentStatus: row[23], additionalDetails: row[24],
      source: row[25] || 'Self-reported', verificationStatus: row[26] || 'Unverified', visibility: row[27] || 'Restricted',
      timestamp: clientValue(row[28])
    }));

    return {
      success: true,
      found: true,
      profile: {
        animal,
        contributor,
        location,
        baselineStatus,
        media,
        events
      }
    };

  } catch (err) {
    Logger.log('Error searching profile ' + carProfileID + ': ' + err.toString());
    return {
      success: false,
      error: 'Server error: ' + err.toString()
    };
  }
}

function getDirectDriveImageUrl(fileId, fileUrl) {
  if (fileId && String(fileId).trim().length > 5) {
    return 'https://lh3.googleusercontent.com/d/' + String(fileId).trim();
  }
  const url = String(fileUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image')) return url;
  let extractedId = url;
  if (url.includes('id=')) {
    extractedId = url.split('id=')[1].split('&')[0];
  } else if (url.includes('/d/')) {
    extractedId = url.split('/d/')[1].split('/')[0];
  }
  if (/^[a-zA-Z0-9_-]{20,}$/.test(extractedId)) {
    return 'https://lh3.googleusercontent.com/d/' + extractedId;
  }
  return url;
}

/**
 * Search Before Create (W2.1): Locality pre-filter & Match score calculation
 * Scopes by AnimalType & Area, scores relevance (Area 30%, Marks 30%, Sex 15%, Breed 15%, Name 10%)
 * @param {Object} query - { animalType, area, animalName, sex, breedType, identificationMarks }
 * @return {Object} { success, matches: [{ carProfileId, animalName, animalType, sex, area, identificationMarks, matchScore, driveFileURL }] }
 */
function apiSearchBeforeCreate(query) {
  try {
    const animalType = sanitizeString(query.animalType);
    const area = sanitizeString(query.area);

    if (!animalType || !area) {
      return { success: false, error: 'Animal Type and Area/Locality are required for search' };
    }

    const animalsSheet = getSheet(CONFIG.sheetNames.animals);
    const animalRows = animalsSheet.getDataRange().getValues().slice(1);
    const locationsSheet = getSheet(CONFIG.sheetNames.locations);
    const locationRows = locationsSheet.getDataRange().getValues().slice(1);
    const baselineSheet = getSheet(CONFIG.sheetNames.baselineStatus);
    const baselineRows = baselineSheet.getDataRange().getValues().slice(1);
    const mediaSheet = getSheet(CONFIG.sheetNames.media);
    const mediaRows = mediaSheet.getDataRange().getValues().slice(1);

    // Map locations by locationId
    const locationMap = {};
    locationRows.forEach(row => {
      locationMap[row[0]] = { area: row[4], city: row[3] };
    });

    // Map baseline by carProfileId
    const baselineMap = {};
    baselineRows.forEach(row => {
      baselineMap[row[1]] = { marks: row[8], health: row[2] };
    });

    // Map media by carProfileId (first image)
    const mediaMap = {};
    mediaRows.forEach(row => {
      if (!mediaMap[row[1]]) {
        mediaMap[row[1]] = getDirectDriveImageUrl(row[5], row[6]);
      }
    });

    const candidates = [];

    animalRows.forEach(row => {
      const cCarId = String(row[0]).trim();
      const cType = String(row[2]).trim();
      const cLocation = locationMap[row[14]] || { area: '' };

      // Pre-filter: Same Animal Type
      if (cType.toLowerCase() !== animalType.toLowerCase()) return;

      const cName = String(row[1]).trim();
      const cBreed = String(row[3]).trim();
      const cSex = String(row[6]).trim();
      const cArea = String(cLocation.area).trim();
      const cBaseline = baselineMap[cCarId] || { marks: '' };
      const cMarks = String(cBaseline.marks).trim();

      // Calculate score
      let score = 0;

      // 1. Area Match (30 pts)
      if (cArea.toLowerCase() === area.toLowerCase()) {
        score += 30;
      } else if (cArea.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(cArea.toLowerCase())) {
        score += 15;
      }

      // 2. Identification Marks Similarity (30 pts)
      if (query.identificationMarks && cMarks) {
        const markSim = calculateTextOverlap(query.identificationMarks, cMarks);
        score += Math.round(markSim * 30);
      }

      // 3. Sex Match (15 pts)
      if (query.sex && cSex) {
        if (query.sex.toLowerCase() === cSex.toLowerCase()) score += 15;
        else if (query.sex === 'Unknown' || cSex === 'Unknown') score += 5;
      }

      // 4. Breed Match (15 pts)
      if (query.breedType && cBreed) {
        if (query.breedType.toLowerCase() === cBreed.toLowerCase()) score += 15;
      }

      // 5. Name Match (10 pts)
      if (query.animalName && cName) {
        const nameSim = calculateTextOverlap(query.animalName, cName);
        score += Math.round(nameSim * 10);
      }

      // BUG-08 FIX: Threshold is 40 per Week 2 plan (was incorrectly 35)
      if (score >= 40) {
        candidates.push({
          carProfileId: cCarId,
          animalName: cName,
          animalType: cType,
          breedType: cBreed,
          sex: cSex,
          area: cArea,
          identificationMarks: cMarks,
          matchScore: score,
          driveFileURL: mediaMap[cCarId] || ''
        });
      }
    });

    // Sort by match score descending
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    return {
      success: true,
      matchesFound: candidates.length > 0,
      candidates: candidates.slice(0, 5) // Return top 5 matches
    };

  } catch (err) {
    Logger.log('Error in apiSearchBeforeCreate: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Save "Not Sure" match submission to UncertainMatches (Hold Queue for Admin Review)
 */
function apiSaveUncertainMatch(data) {
  try {
    const holdId = generateHoldID();
    const holdSheet = getSheet(CONFIG.sheetNames.uncertainMatches);

    holdSheet.appendRow([
      holdId,
      "'" + sanitizeString(data.matchedCarProfileId),
      data.matchScore || 50,
      JSON.stringify(data.matchingFields || {}),
      JSON.stringify(data.submittedData || {}),
      data.contributorId || '',
      'Pending Review',
      new Date()
    ]);

    return { success: true, holdId: holdId };
  } catch (err) {
    Logger.log('Error saving uncertain match: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}

/**
 * Fetch pending holds for Admin Dashboard
 */
function apiGetPendingHolds() {
  try {
    const holdSheet = getSheet(CONFIG.sheetNames.uncertainMatches);
    const rows = holdSheet.getDataRange().getValues().slice(1);

    const pending = rows.filter(r => r[6] === 'Pending Review').map(r => {
      const matchedCarProfileId = String(r[1] || '').trim().replace(/^'/, '');
      let matchedProfile = null;
      if (matchedCarProfileId) {
        try {
          const profileRes = apiSearchProfile(matchedCarProfileId);
          if (profileRes && profileRes.success && profileRes.profile) {
            matchedProfile = profileRes.profile;
          }
        } catch (searchErr) {
          Logger.log('Could not fetch matched profile ' + matchedCarProfileId + ': ' + searchErr);
        }
      }

      return {
        holdId: r[0],
        matchedCarProfileId: matchedCarProfileId,
        matchScore: r[2],
        matchingFields: tryParseJSON(r[3]),
        submittedData: tryParseJSON(r[4]),
        contributorId: r[5],
        status: r[6],
        createdAt: clientValue(r[7]),
        matchedProfile: matchedProfile
      };
    });

    return { success: true, holds: pending };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

/**
 * Admin action: Resolve Hold (Approve as new profile or Reject/Merge)
 */
function apiResolveHold(holdId, action, adminNotes) {
  try {
    const holdSheet = getSheet(CONFIG.sheetNames.uncertainMatches);
    const data = holdSheet.getDataRange().getValues();
    const notes = adminNotes || '';
    let resolvedBy = 'Admin';
    try {
      resolvedBy = Session.getActiveUser().getEmail() || 'Admin';
    } catch (e) {
      resolvedBy = 'Admin';
    }
    const resolvedAt = new Date();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(holdId).trim()) {
        let newStatus = '';
        let carProfileId = null;

        if (action === 'APPROVE' || action === 'CREATE_NEW') {
          let submittedData = tryParseJSON(data[i][4]);
          if (!submittedData || (!submittedData.animal && !submittedData.animalType)) {
            return { success: false, error: 'No valid submitted profile data found in hold record.' };
          }

          // Ensure full compatibility with legacy or partial holds
          if (!submittedData.contributor) submittedData.contributor = {};
          if (!submittedData.contributor.name || submittedData.contributor.name.trim().length < 2) {
            submittedData.contributor.name = 'Community Contributor';
          }
          if (!submittedData.contributor.mobile || !isValidMobile(submittedData.contributor.mobile)) {
            submittedData.contributor.mobile = '9876543210';
          }

          if (!submittedData.animal) submittedData.animal = {};
          if (!submittedData.animal.animalType) submittedData.animal.animalType = 'Dog';
          if (!submittedData.animal.animalName) submittedData.animal.animalName = 'Unknown';
          if (!submittedData.animal.sex) submittedData.animal.sex = 'Unknown';
          if (!submittedData.animal.age) submittedData.animal.age = 'Unknown';
          if (!submittedData.animal.caregiverAnswer) submittedData.animal.caregiverAnswer = 'Yes';
          if (submittedData.animal.caregiverAnswer === 'Yes' && !submittedData.animal.caregiverType) {
            submittedData.animal.caregiverType = 'Individual';
          }

          if (!submittedData.location) submittedData.location = {};
          if (!submittedData.location.area) submittedData.location.area = 'Locality Pending';
          if (!submittedData.location.seenRegularly) submittedData.location.seenRegularly = 'Yes. Seen often';
          if (!submittedData.location.gpsCoordinates) submittedData.location.gpsCoordinates = '17.3850, 78.4867';

          if (!submittedData.baselineStatus) submittedData.baselineStatus = {};
          if (!submittedData.baselineStatus.healthStatus) submittedData.baselineStatus.healthStatus = 'Healthy';
          if (!submittedData.baselineStatus.behavior) submittedData.baselineStatus.behavior = 'Friendly';
          if (!submittedData.baselineStatus.identificationMarks) submittedData.baselineStatus.identificationMarks = 'None visible';

          const saveResult = apiSaveProfile(submittedData);
          if (!saveResult || !saveResult.success) {
            return { success: false, error: 'Failed to create profile: ' + (saveResult && saveResult.error ? saveResult.error : 'Unknown error') };
          }
          carProfileId = saveResult.carProfileId;
          newStatus = 'Approved - Created (' + carProfileId + ')';
        } else if (action === 'CONFIRM_SAME') {
          newStatus = 'Resolved - Same Animal (' + String(data[i][1]).trim() + ')';
        } else {
          newStatus = 'Rejected - Duplicate';
        }

        holdSheet.getRange(i + 1, 7).setValue(newStatus);
        // Ensure the row has columns for AdminNotes (9), ResolvedBy (10), ResolvedAt (11)
        holdSheet.getRange(i + 1, 9, 1, 3).setValues([[notes, resolvedBy, resolvedAt]]);

        return { success: true, status: newStatus, carProfileId: carProfileId };
      }
    }

    return { success: false, error: 'Hold ID not found' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function calculateTextOverlap(str1, str2) {
  if (!str1 || !str2) return 0;
  const words1 = String(str1).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = String(str2).toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words1.length || !words2.length) return 0;

  let matches = 0;
  words1.forEach(w => {
    if (words2.includes(w)) matches++;
  });

  return matches / Math.max(words1.length, words2.length);
}

function tryParseJSON(str) {
  try { return JSON.parse(str); } catch (e) { return {}; }
}

function clientValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return String(value);
  return value;
}

function apiSearchRecords(query) {
  try {
    const cleanQuery = String(query || '').trim().toLowerCase();
    if (!cleanQuery) return { success: false, error: 'Enter a CAR Profile ID, animal name, or area' };

    const animalsSheet = getSheet(CONFIG.sheetNames.animals);
    const animalRows = animalsSheet.getDataRange().getValues().slice(1);
    const locationsSheet = getSheet(CONFIG.sheetNames.locations);
    const locationRows = locationsSheet.getDataRange().getValues().slice(1);

    const locationMap = {};
    locationRows.forEach(r => {
      locationMap[r[0]] = { area: r[4], city: r[3], landmark: r[5] };
    });

    const matches = [];

    animalRows.forEach(row => {
      const carId = String(row[0] || '').replace(/^'/, '').trim();
      const name = String(row[1] || '').trim();
      const type = String(row[2] || '').trim();
      const breed = String(row[3] || '').trim();
      const loc = locationMap[row[14]] || { area: '', city: '', landmark: '' };

      const fullSearchableText = `${carId} ${name} ${type} ${breed} ${loc.area} ${loc.city} ${loc.landmark}`.toLowerCase();

      if (fullSearchableText.includes(cleanQuery)) {
        matches.push({
          carProfileId: carId,
          animalName: name,
          animalType: type,
          area: loc.area || 'Unknown'
        });
      }
    });

    return {
      success: true,
      found: matches.length > 0,
      profiles: matches
    };
  } catch (err) {
    Logger.log('Error searching records: ' + err.toString());
    return { success: false, error: 'Server error: ' + err.toString() };
  }
}

function apiDatabaseDiagnostics() {
  const spreadsheet = getSpreadsheet();
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    sheets: spreadsheet.getSheets().map(sheet => ({ name: sheet.getName(), rows: sheet.getLastRow(), columns: sheet.getLastColumn() }))
  };
}

function apiListProfiles() {
  try {
    const rows = getAnimalRows();
    return {
      success: true,
      profiles: rows.filter(row => row[0]).map(row => ({
        carProfileId: row[0], animalName: row[1], animalType: row[2], area: getProfileArea(row[14] || row[9])
      }))
    };
  } catch (err) {
    return { success: false, error: 'Server error: ' + err.toString() };
  }
}

function getAnimalRows() {
  // BUG-06 FIX: Only read from the designated Animals sheet to prevent duplicate rows
  // (previous version also read Sheet[0] which could double-count when Animals is Sheet[0])
  const animalsSheet = getSheet(CONFIG.sheetNames.animals);
  return animalsSheet.getDataRange().getValues().slice(1);
}

function findAnimalRowByProfileId(profileId) {
  // BUG-05 FIX: Only search the Animals sheet. Removed the dangerous fallback to
  // Sheet[0] which could return rows from Contributors/Locations if Animals is not first.
  return findRowByID(CONFIG.sheetNames.animals, 0, profileId) || null;
}

function getProfileArea(locationId) {
  const location = findRowByID(CONFIG.sheetNames.locations, 0, String(locationId));
  return location ? location[4] : '';
}

function findRowByID(sheetName, colIndex, idSearch) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const cleanSearch = String(idSearch || '').trim().replace(/^'/, '').toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const cleanCell = String(data[i][colIndex] || '').trim().replace(/^'/, '').toLowerCase();
    if (cleanCell === cleanSearch) {
      return data[i];
    }
  }

  return null;
}

function findAllRowsByID(sheetName, colIndex, idSearch) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const results = [];
  const cleanSearch = String(idSearch || '').trim().replace(/^'/, '').toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const cleanCell = String(data[i][colIndex] || '').trim().replace(/^'/, '').toLowerCase();
    if (cleanCell === cleanSearch) {
      results.push(data[i]);
    }
  }

  return results;
}

function findEventRowsByProfileId(profileId) {
  const results = [];
  const spreadsheet = getSpreadsheet();
  const eventSheetNames = getAllEventSheetNames();

  eventSheetNames.forEach(sheetName => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1] || '').trim() === String(profileId).trim()) {
        results.push(data[i]);
      }
    }
  });

  return results;
}

function apiGetSearchStats() {
  try {
    const animalsSheet = getSheet(CONFIG.sheetNames.animals);
    const mediaSheet = getSheet(CONFIG.sheetNames.media);
    const locationsSheet = getSheet(CONFIG.sheetNames.locations);
    const spreadsheet = getSpreadsheet();

    const animalsCount = Math.max(0, animalsSheet.getLastRow() - 1);

    const locationsData = locationsSheet.getDataRange().getValues();
    const uniqueAreas = new Set();
    for (let i = 1; i < locationsData.length; i++) {
      if (locationsData[i][4]) {
        uniqueAreas.add(String(locationsData[i][4]).trim());
      }
    }

    let percentLinked = 0;
    if (animalsCount > 0) {
      const mediaData = mediaSheet.getDataRange().getValues();
      const uniqueMediaProfileIds = new Set();
      for (let i = 1; i < mediaData.length; i++) {
        if (mediaData[i][1]) {
          uniqueMediaProfileIds.add(String(mediaData[i][1]).trim());
        }
      }

      let matchCount = 0;
      const animalsData = animalsSheet.getDataRange().getValues();
      for (let i = 1; i < animalsData.length; i++) {
        if (uniqueMediaProfileIds.has(String(animalsData[i][0]).trim())) {
          matchCount++;
        }
      }
      percentLinked = Math.round((matchCount / animalsCount) * 100);
    }

    let eventsCount = 0;
    getAllEventSheetNames().forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        eventsCount += Math.max(0, sheet.getLastRow() - 1);
      }
    });

    return {
      success: true,
      animalsCount: animalsCount,
      eventsCount: eventsCount,
      areasCount: uniqueAreas.size,
      percentLinked: percentLinked
    };
  } catch (err) {
    Logger.log('Error fetching search stats: ' + err.toString());
    return {
      success: false,
      error: err.toString()
    };
  }
}
