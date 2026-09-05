/**
 * CAR Platform - Search Module
 * Retrieves animal profiles by CAR Profile ID.
 *
 * IMPORTANT:
 * Profile retrieval does NOT load event history.
 * Events are loaded separately using apiGetProfileEvents().
 *
 * This prevents profile pages from getting stuck while scanning
 * multiple Event - ... sheets.
 */


/**
 * ============================================================
 * SEARCH PROFILE
 * ============================================================
 *
 * Searches for one exact CAR Profile ID.
 *
 * Profile loading includes:
 * - Animal
 * - Contributor
 * - Location
 * - Baseline status
 * - Profile media
 *
 * Event history is intentionally NOT loaded here.
 */
function apiSearchProfile(carProfileID) {
  try {

    if (!carProfileID) {
      return {
        success: false,
        found: false,
        error: 'Empty Profile ID search'
      };
    }

    const cleanId = String(carProfileID).trim();

    if (!cleanId) {
      return {
        success: false,
        found: false,
        error: 'Empty Profile ID search'
      };
    }


    // ========================================================
    // 1. ANIMAL
    // ========================================================

    const animalRow = findAnimalRowByProfileId(cleanId);

    if (!animalRow) {
      return {
        success: true,
        found: false,
        profile: null
      };
    }

    const animal = {
      carProfileId: animalRow[0] || '',
      animalName: animalRow[1] || '',
      animalType: animalRow[2] || '',
      breedType: animalRow[3] || '',
      nativeDogType: animalRow[4] || '',
      breedOtherDetails: animalRow[5] || '',
      sex: animalRow[6] || '',
      age: animalRow[7] || '',
      caregiverAnswer: animalRow[8] || '',
      caregiverType: animalRow[9] || '',
      caregiverOtherDetails: animalRow[10] || '',
      careProvided: animalRow[11] || '',
      careOtherDetails: animalRow[12] || '',
      contributorId: animalRow[13] || '',
      locationId: animalRow[14] || '',
      timestamp: clientValue(animalRow[15])
    };


    // ========================================================
    // 2. CONTRIBUTOR
    // ========================================================

    let contributor = null;

    if (animal.contributorId) {

      const contributorRow = findRowByID(
        CONFIG.sheetNames.contributors,
        0,
        String(animal.contributorId).trim()
      );

      if (contributorRow) {
        contributor = {
          contributorId: contributorRow[0] || '',
          name: contributorRow[1] || '',
          mobile: contributorRow[2] || '',
          email: contributorRow[3] || '',
          timestamp: clientValue(contributorRow[4])
        };
      }
    }


    // ========================================================
    // 3. LOCATION
    // ========================================================

    let location = null;

    if (animal.locationId) {

      const locationRow = findRowByID(
        CONFIG.sheetNames.locations,
        0,
        String(animal.locationId).trim()
      );

      if (locationRow) {
        location = {
          locationId: locationRow[0] || '',
          usualLocationType: locationRow[1] || '',
          state: locationRow[2] || '',
          city: locationRow[3] || '',
          area: locationRow[4] || '',
          landmark: locationRow[5] || '',
          gpsCoordinates: locationRow[6] || '',
          seenRegularly: locationRow[7] || '',
          timestamp: clientValue(locationRow[8])
        };
      }
    }


    // ========================================================
    // 4. BASELINE STATUS
    // ========================================================

    let baselineStatus = null;

    const baselineRow = findRowByID(
      CONFIG.sheetNames.baselineStatus,
      1,
      cleanId
    );

    if (baselineRow) {

      baselineStatus = {
        baselineId: baselineRow[0] || '',
        carProfileId: baselineRow[1] || '',
        healthStatus: baselineRow[2] || '',
        vaccinationStatus: baselineRow[3] || '',
        sterilisationStatus: baselineRow[4] || '',
        behavior: baselineRow[5] || '',
        abcStatus: baselineRow[6] || '',
        abcOutcome: baselineRow[7] || '',
        identificationMarks: baselineRow[8] || '',
        identificationOtherDetails: baselineRow[9] || '',
        additionalDetails: baselineRow[10] || '',
        timestamp: clientValue(baselineRow[11])
      };
    }


    // ========================================================
    // 5. PROFILE MEDIA
    // ========================================================

    let media = [];

    const mediaRows = findAllRowsByID(
      CONFIG.sheetNames.media,
      1,
      cleanId
    );

    if (mediaRows && mediaRows.length > 0) {

      media = mediaRows.map(function(row) {

        return {
          mediaId: row[0] || '',
          carProfileId: row[1] || '',
          mediaType: row[2] || '',
          driveFileId: row[3] || '',
          driveFileURL: row[4] || '',
          fileName: row[5] || '',
          uploadTimestamp: clientValue(row[6])
        };

      });
    }


    // ========================================================
    // IMPORTANT
    // ========================================================
    // DO NOT load events here.
    //
    // Old code was:
    //
    // const eventRows = findEventRowsByProfileId(cleanId);
    // const events = ...
    //
    // That caused the profile request to scan all Event sheets.
    //
    // We now return an empty array.
    // Events are loaded separately with apiGetProfileEvents().
    // ========================================================

    const events = [];


    // ========================================================
    // RETURN PROFILE
    // ========================================================

    return {
      success: true,
      found: true,

      profile: {
        animal: animal,
        contributor: contributor,
        location: location,
        baselineStatus: baselineStatus,
        media: media,
        events: events
      }
    };


  } catch (err) {

    Logger.log(
      'Error searching profile ' +
      carProfileID +
      ': ' +
      err.toString()
    );

    return {
      success: false,
      found: false,
      error: 'Server error: ' + err.toString()
    };
  }
}


/**
 * ============================================================
 * LOAD EVENTS SEPARATELY
 * ============================================================
 *
 * This function is intentionally separate from apiSearchProfile().
 *
 * The profile can open first.
 * Event history can then be loaded independently.
 */
function apiGetProfileEvents(carProfileID) {

  try {

    if (!carProfileID) {
      return {
        success: false,
        events: [],
        error: 'CAR Profile ID is required'
      };
    }

    const cleanId = String(carProfileID).trim();

    if (!cleanId) {
      return {
        success: false,
        events: [],
        error: 'CAR Profile ID is required'
      };
    }

    const eventRows = findEventRowsByProfileId(cleanId);

    const events = eventRows.map(function(row) {

      return {
        eventId: row[0] || '',
        carProfileId: row[1] || '',
        dateReported: row[2] || '',
        animalType: row[3] || '',
        animalOtherDetails: row[4] || '',
        animalName: row[5] || '',
        area: row[6] || '',
        landmark: row[7] || '',
        googleLocationPin: row[8] || '',
        healthCondition: row[9] || '',
        healthOtherDetails: row[10] || '',
        behaviour: row[11] || '',
        behaviourOtherDetails: row[12] || '',
        vaccinated: row[13] || '',
        sterilised: row[14] || '',
        identificationMarks: row[15] || '',
        identificationOtherDetails: row[16] || '',
        eventType: row[17] || '',
        eventCategory: row[18] || '',
        eventOtherDetails: row[19] || '',
        dateOfEvent: row[20] || '',
        organisationOrPerson: row[21] || '',
        eventDescription: row[22] || '',
        outcomeCurrentStatus: row[23] || '',
        additionalDetails: row[24] || '',

        // Newer event fields
        source: row[25] || '',
        verification: row[26] || '',
        visibility: row[27] || '',

        timestamp: clientValue(row[28] || row[25])
      };

    });


    return {
      success: true,
      events: events
    };


  } catch (err) {

    Logger.log(
      'Error loading events for profile ' +
      carProfileID +
      ': ' +
      err.toString()
    );

    return {
      success: false,
      events: [],
      error: 'Unable to load event history: ' + err.toString()
    };
  }
}


/**
 * ============================================================
 * GENERIC SEARCH
 * ============================================================
 */
function apiSearchRecords(query) {

  try {

    const cleanQuery = String(query || '')
      .trim()
      .toLowerCase();

    if (!cleanQuery) {
      return {
        success: false,
        error: 'Enter a CAR Profile ID, animal name, or area'
      };
    }

    const rows = getAnimalRows();

    const matches = rows.filter(function(row) {

      return (
        String(row[0] || '').toLowerCase().includes(cleanQuery) ||
        String(row[1] || '').toLowerCase().includes(cleanQuery) ||
        String(row[2] || '').toLowerCase().includes(cleanQuery)
      );

    });


    return {
      success: true,
      found: matches.length > 0,

      profiles: matches.map(function(row) {

        return {
          carProfileId: row[0] || '',
          animalName: row[1] || '',
          animalType: row[2] || ''
        };

      })
    };


  } catch (err) {

    Logger.log(
      'Error searching records: ' +
      err.toString()
    );

    return {
      success: false,
      error: 'Server error: ' + err.toString()
    };
  }
}


/**
 * ============================================================
 * DATABASE DIAGNOSTICS
 * ============================================================
 */
function apiDatabaseDiagnostics() {

  try {

    const spreadsheet = getSpreadsheet();

    return {
      success: true,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetName: spreadsheet.getName(),

      sheets: spreadsheet.getSheets().map(function(sheet) {

        return {
          name: sheet.getName(),
          rows: sheet.getLastRow(),
          columns: sheet.getLastColumn()
        };

      })
    };

  } catch (err) {

    return {
      success: false,
      error: err.toString()
    };
  }
}


/**
 * ============================================================
 * LIST PROFILES
 * ============================================================
 */
function apiListProfiles() {

  try {

    const rows = getAnimalRows();

    return {
      success: true,

      profiles: rows
        .filter(function(row) {
          return row[0];
        })
        .map(function(row) {

          return {
            carProfileId: row[0] || '',
            animalName: row[1] || '',
            animalType: row[2] || '',
            area: getProfileArea(row[14] || row[9])
          };

        })
    };


  } catch (err) {

    return {
      success: false,
      error: 'Server error: ' + err.toString()
    };
  }
}


/**
 * ============================================================
 * GET ANIMAL ROWS
 * ============================================================
 */
function getAnimalRows() {

  const result = [];

  const animalsSheet = getSheet(
    CONFIG.sheetNames.animals
  );

  const animalsRows = animalsSheet
    .getDataRange()
    .getValues();

  result.push.apply(
    result,
    animalsRows.slice(1)
  );


  // Compatibility with older database layout
  const spreadsheet = getSpreadsheet();
  const firstSheet = spreadsheet.getSheets()[0];

  if (
    firstSheet.getName() !==
    CONFIG.sheetNames.animals
  ) {

    const firstRows = firstSheet
      .getDataRange()
      .getValues();

    if (
      firstRows.length > 1 &&
      firstRows[0].some(function(header) {

        return String(header)
          .toLowerCase()
          .includes('car') &&
          String(header)
            .toLowerCase()
            .includes('profile');

      })
    ) {

      result.push.apply(
        result,
        firstRows.slice(1)
      );
    }
  }

  return result;
}


/**
 * ============================================================
 * FIND ANIMAL BY CAR PROFILE ID
 * ============================================================
 */
function findAnimalRowByProfileId(profileId) {

  const cleanId = String(profileId || '').trim();

  if (!cleanId) {
    return null;
  }

  const animalsRow = findRowByID(
    CONFIG.sheetNames.animals,
    0,
    cleanId
  );

  if (animalsRow) {
    return animalsRow;
  }


  // Compatibility with older first-sheet layout
  const spreadsheet = getSpreadsheet();
  const firstSheet = spreadsheet.getSheets()[0];

  if (
    firstSheet.getName() ===
    CONFIG.sheetNames.animals
  ) {
    return null;
  }


  const rows = firstSheet
    .getDataRange()
    .getValues();

  for (
    let index = 1;
    index < rows.length;
    index++
  ) {

    if (
      String(rows[index][0] || '').trim() ===
      cleanId
    ) {
      return rows[index];
    }
  }

  return null;
}


/**
 * ============================================================
 * GET PROFILE AREA
 * ============================================================
 */
function getProfileArea(locationId) {

  if (!locationId) {
    return '';
  }

  const location = findRowByID(
    CONFIG.sheetNames.locations,
    0,
    String(locationId).trim()
  );

  return location ? location[4] || '' : '';
}


/**
 * ============================================================
 * FIND ONE ROW BY ID
 * ============================================================
 */
function findRowByID(
  sheetName,
  colIndex,
  idSearch
) {

  const sheet = getSheet(sheetName);

  const data = sheet
    .getDataRange()
    .getValues();

  const cleanId = String(idSearch || '').trim();

  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][colIndex] || '').trim() ===
      cleanId
    ) {

      return data[i];
    }
  }

  return null;
}


/**
 * ============================================================
 * FIND ALL ROWS BY ID
 * ============================================================
 */
function findAllRowsByID(
  sheetName,
  colIndex,
  idSearch
) {

  const sheet = getSheet(sheetName);

  const data = sheet
    .getDataRange()
    .getValues();

  const results = [];

  const cleanId = String(idSearch || '').trim();

  for (
    let i = 1;
    i < data.length;
    i++
  ) {

    if (
      String(data[i][colIndex] || '').trim() ===
      cleanId
    ) {

      results.push(data[i]);
    }
  }

  return results;
}


/**
 * ============================================================
 * FIND EVENTS FOR PROFILE
 * ============================================================
 *
 * This is now used ONLY by apiGetProfileEvents().
 *
 * It is NOT used by apiSearchProfile().
 */
function findEventRowsByProfileId(profileId) {

  const results = [];

  const spreadsheet = getSpreadsheet();

  const eventSheetNames =
    getAllEventSheetNames();

  const cleanId =
    String(profileId || '').trim();


  eventSheetNames.forEach(function(sheetName) {

    const sheet =
      spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      return;
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return;
    }

    /*
     * Only read the actual used range.
     * This avoids unnecessary blank rows.
     */
    const lastColumn =
      Math.max(sheet.getLastColumn(), 2);

    const data = sheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();


    for (
      let i = 1;
      i < data.length;
      i++
    ) {

      if (
        String(data[i][1] || '').trim() ===
        cleanId
      ) {

        results.push(data[i]);
      }
    }

  });

  return results;
}


/**
 * ============================================================
 * SEARCH STATISTICS
 * ============================================================
 */
function apiGetSearchStats() {

  try {

    const animalsSheet =
      getSheet(CONFIG.sheetNames.animals);

    const mediaSheet =
      getSheet(CONFIG.sheetNames.media);

    const locationsSheet =
      getSheet(CONFIG.sheetNames.locations);

    const spreadsheet =
      getSpreadsheet();


    const animalsCount =
      Math.max(
        0,
        animalsSheet.getLastRow() - 1
      );


    // ========================================================
    // DISTINCT AREAS
    // ========================================================

    const locationsData =
      locationsSheet
        .getDataRange()
        .getValues();

    const uniqueAreas = new Set();

    for (
      let i = 1;
      i < locationsData.length;
      i++
    ) {

      if (locationsData[i][4]) {

        uniqueAreas.add(
          String(locationsData[i][4]).trim()
        );
      }
    }


    // ========================================================
    // MEDIA LINK PERCENTAGE
    // ========================================================

    let percentLinked = 0;

    if (animalsCount > 0) {

      const mediaData =
        mediaSheet
          .getDataRange()
          .getValues();

      const uniqueMediaProfileIds =
        new Set();


      for (
        let i = 1;
        i < mediaData.length;
        i++
      ) {

        if (mediaData[i][1]) {

          uniqueMediaProfileIds.add(
            String(mediaData[i][1]).trim()
          );
        }
      }


      let matchCount = 0;

      const animalsData =
        animalsSheet
          .getDataRange()
          .getValues();


      for (
        let i = 1;
        i < animalsData.length;
        i++
      ) {

        if (
          uniqueMediaProfileIds.has(
            String(animalsData[i][0]).trim()
          )
        ) {

          matchCount++;
        }
      }


      percentLinked =
        Math.round(
          (matchCount / animalsCount) * 100
        );
    }


    // ========================================================
    // EVENT COUNT
    // ========================================================

    let eventsCount = 0;

    getAllEventSheetNames()
      .forEach(function(sheetName) {

        const sheet =
          spreadsheet.getSheetByName(sheetName);

        if (sheet) {

          eventsCount +=
            Math.max(
              0,
              sheet.getLastRow() - 1
            );
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

    Logger.log(
      'Error fetching search stats: ' +
      err.toString()
    );

    return {
      success: false,
      error: err.toString()
    };
  }
}