/**
 * CAR Platform - Search Module
 * Retrieves complete animal profiles by exact CAR ID matches
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

    const cleanId = carProfileID.trim();

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

    // 2. Fetch Contributor details
    const contributorRow = findRowByID(CONFIG.sheetNames.contributors, 0, animal.contributorId);
    const contributor = contributorRow ? {
      contributorId: contributorRow[0],
      name: contributorRow[1],
      mobile: contributorRow[2],
      email: contributorRow[3],
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
      seenRegularly: locationRow[7],
      timestamp: clientValue(locationRow[8])
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
      mediaType: row[2],
      driveFileId: row[3],
      driveFileURL: row[4],
      fileName: row[5],
      uploadTimestamp: clientValue(row[6])
    }));

    const eventRows = findEventRowsByProfileId(cleanId);
    const events = eventRows.map(row => ({
      eventId: row[0], dateReported: row[2], animalType: row[3], animalOtherDetails: row[4],
      animalName: row[5], area: row[6], landmark: row[7], googleLocationPin: row[8],
      healthCondition: row[9], healthOtherDetails: row[10], behaviour: row[11],
      behaviourOtherDetails: row[12], vaccinated: row[13], sterilised: row[14],
      identificationMarks: row[15], identificationOtherDetails: row[16], eventType: row[17],
      eventCategory: row[18], eventOtherDetails: row[19], dateOfEvent: row[20], organisationOrPerson: row[21],
      eventDescription: row[22], outcomeCurrentStatus: row[23], additionalDetails: row[24],
      timestamp: clientValue(row[25])
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

function clientValue(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function apiSearchRecords(query) {
  try {
    const cleanQuery = String(query || '').trim().toLowerCase();
    if (!cleanQuery) return { success: false, error: 'Enter a CAR Profile ID, animal name, or area' };

    const rows = getAnimalRows();
    const matches = rows.filter(row => {
      return String(row[0] || '').toLowerCase().includes(cleanQuery) ||
        String(row[1] || '').toLowerCase().includes(cleanQuery) ||
        String(row[2] || '').toLowerCase().includes(cleanQuery);
    });

    return {
      success: true,
      found: matches.length > 0,
      profiles: matches.map(row => ({
        carProfileId: row[0],
        animalName: row[1],
        animalType: row[2]
      }))
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
  const result = [];
  const animalsSheet = getSheet(CONFIG.sheetNames.animals);
  const animalsRows = animalsSheet.getDataRange().getValues();
  result.push(...animalsRows.slice(1));

  const firstSheet = getSpreadsheet().getSheets()[0];
  if (firstSheet.getName() !== CONFIG.sheetNames.animals) {
    const firstRows = firstSheet.getDataRange().getValues();
    if (firstRows.length > 1 && firstRows[0].some(header => String(header).toLowerCase().includes('car') && String(header).toLowerCase().includes('profile'))) {
      result.push(...firstRows.slice(1));
    }
  }
  return result;
}

function findAnimalRowByProfileId(profileId) {
  const animalsRow = findRowByID(CONFIG.sheetNames.animals, 0, profileId);
  if (animalsRow) return animalsRow;

  const firstSheet = getSpreadsheet().getSheets()[0];
  if (firstSheet.getName() === CONFIG.sheetNames.animals) return null;
  const rows = firstSheet.getDataRange().getValues();
  for (let index = 1; index < rows.length; index++) {
    if (String(rows[index][0]).trim() === profileId) return rows[index];
  }
  return null;
}

function getProfileArea(locationId) {
  const location = findRowByID(CONFIG.sheetNames.locations, 0, String(locationId));
  return location ? location[4] : '';
}

/**
 * Helper to find a specific row in a sheet matching an ID in a specific column index
 * @param {string} sheetName - Target Sheet Name
 * @param {number} colIndex - Column Index to search (0-based)
 * @param {string} idSearch - Target ID to match
 * @return {Array|null} Row values array or null
 */
function findRowByID(sheetName, colIndex, idSearch) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]).trim() === idSearch) {
      return data[i];
    }
  }

  return null;
}

/**
 * Helper to find all rows matching an ID in a specific column index
 * @param {string} sheetName - Target Sheet Name
 * @param {number} colIndex - Column Index to search (0-based)
 * @param {string} idSearch - Target ID to match
 * @return {Array[]} Array of row value arrays
 */
function findAllRowsByID(sheetName, colIndex, idSearch) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]).trim() === idSearch) {
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
      if (String(data[i][1] || '').trim() === profileId) {
        results.push(data[i]);
      }
    }
  });

  return results;
}

/**
 * Retrieve counts statistics for the home page search stats row
 * @return {Object} Statistics count values
 */
function apiGetSearchStats() {
  try {
    const animalsSheet = getSheet(CONFIG.sheetNames.animals);
    const mediaSheet = getSheet(CONFIG.sheetNames.media);
    const locationsSheet = getSheet(CONFIG.sheetNames.locations);
    const spreadsheet = getSpreadsheet();

    const animalsCount = Math.max(0, animalsSheet.getLastRow() - 1);

    // Distinct areas count
    const locationsData = locationsSheet.getDataRange().getValues();
    const uniqueAreas = new Set();
    for (let i = 1; i < locationsData.length; i++) {
      if (locationsData[i][1]) {
        uniqueAreas.add(locationsData[i][1].trim());
      }
    }

    // Evidence link percentage (animals with at least one media reference)
    let percentLinked = 0;
    if (animalsCount > 0) {
      const mediaData = mediaSheet.getDataRange().getValues();
      const uniqueMediaProfileIds = new Set();
      for (let i = 1; i < mediaData.length; i++) {
        if (mediaData[i][1]) {
          uniqueMediaProfileIds.add(mediaData[i][1].trim());
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
