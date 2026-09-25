/**
 * CAR Platform - Event Module
 * Adds immutable event records to an existing animal profile and logs traceable history corrections.
 */

function apiSaveEvent(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return { success: false, error: 'Server busy processing another request. Please retry in a few seconds.' };
  }

  try {
    const validation = validateEventData(data);
    if (!validation.valid) {
      return { success: false, error: 'Validation errors: ' + validation.errors.join('; ') };
    }

    const carProfileId = sanitizeString(data.carProfileId);
    if (!findRowByID(CONFIG.sheetNames.animals, 0, carProfileId)) {
      return { success: false, error: 'CAR Profile ID was not found. Search and select an existing profile first.' };
    }

    const profile = apiSearchProfile(carProfileId);
    const baseAnimal = profile && profile.success && profile.profile && profile.profile.animal ? profile.profile.animal : null;
    const baseLocation = profile && profile.success && profile.profile && profile.profile.location ? profile.profile.location : null;
    const baseBaseline = profile && profile.success && profile.profile && profile.profile.baselineStatus ? profile.profile.baselineStatus : null;

    const event = data.event || {};
    const resolvedEvent = {
      ...event,
      animalType: sanitizeString(event.animalType) || (baseAnimal ? sanitizeString(baseAnimal.animalType) : ''),
      animalName: sanitizeString(event.animalName) || (baseAnimal ? sanitizeString(baseAnimal.animalName) : ''),
      area: sanitizeString(event.area) || (baseLocation ? sanitizeString(baseLocation.area) : ''),
      landmark: sanitizeString(event.landmark) || (baseLocation ? sanitizeString(baseLocation.landmark) : ''),
      googleLocationPin: sanitizeString(event.googleLocationPin) || (baseLocation ? sanitizeString(baseLocation.gpsCoordinates) : ''),
      healthCondition: sanitizeString(event.healthCondition) || (baseBaseline ? sanitizeString(baseBaseline.healthStatus) : ''),
      behaviour: sanitizeString(event.behaviour) || (baseBaseline ? sanitizeString(baseBaseline.behavior) : ''),
      vaccinated: sanitizeString(event.vaccinated) || (baseBaseline ? sanitizeString(baseBaseline.vaccinationStatus) : ''),
      sterilised: sanitizeString(event.sterilised) || (baseBaseline ? sanitizeString(baseBaseline.sterilisationStatus) : ''),
      identificationMarks: sanitizeString(event.identificationMarks) || (baseBaseline ? sanitizeString(baseBaseline.identificationMarks) : ''),
      identificationOtherDetails: sanitizeString(event.identificationOtherDetails) || (baseBaseline ? sanitizeString(baseBaseline.identificationOtherDetails) : ''),
      dateReported: normalizeDateValue(sanitizeString(event.dateReported), 'Unknown'),
      dateOfEvent: normalizeDateValue(sanitizeString(event.dateOfEvent), 'Unknown'),
      source: sanitizeString(event.source) || 'Self-reported',
      verificationStatus: sanitizeString(event.verificationStatus) || 'Unverified',
      visibility: sanitizeString(event.visibility) || 'Restricted'
    };

    const eventId = 'EVT-' + generateRandomString(8);
    const eventSheetName = getEventSheetName(resolvedEvent.eventType);
    const eventSheet = getSheet(eventSheetName);
    appendRecordBySchema(eventSheet, eventSheetName, {
      eventid: eventId,
      carid: "'" + carProfileId,
      datereported: sanitizeString(resolvedEvent.dateReported),
      animaltype: sanitizeString(resolvedEvent.animalType),
      animalotherdetails: sanitizeString(resolvedEvent.animalOtherDetails),
      animalname: sanitizeString(resolvedEvent.animalName),
      area: sanitizeString(resolvedEvent.area),
      landmark: sanitizeString(resolvedEvent.landmark),
      gpslocation: sanitizeString(resolvedEvent.googleLocationPin),
      healthcondition: sanitizeString(resolvedEvent.healthCondition),
      healthotherdetails: sanitizeString(resolvedEvent.healthOtherDetails),
      behaviour: sanitizeString(resolvedEvent.behaviour),
      behaviourotherdetails: sanitizeString(resolvedEvent.behaviourOtherDetails),
      vaccinated: sanitizeString(resolvedEvent.vaccinated),
      sterilised: sanitizeString(resolvedEvent.sterilised),
      identificationmarks: sanitizeString(resolvedEvent.identificationMarks),
      identificationotherdetails: sanitizeString(resolvedEvent.identificationOtherDetails),
      eventtype: sanitizeString(resolvedEvent.eventType),
      eventcategory: sanitizeString(resolvedEvent.eventCategory),
      eventotherdetails: sanitizeString(resolvedEvent.eventOtherDetails),
      dateofevent: sanitizeString(resolvedEvent.dateOfEvent),
      organisationorperson: sanitizeString(resolvedEvent.organisationOrPerson),
      eventdescription: sanitizeString(resolvedEvent.eventDescription),
      outcomecurrentstatus: sanitizeString(resolvedEvent.outcomeCurrentStatus),
      additionaldetails: sanitizeString(resolvedEvent.additionalDetails),
      source: resolvedEvent.source,
      verification: resolvedEvent.verificationStatus,
      visibility: resolvedEvent.visibility,
      timestamp: new Date(),
      ...(resolvedEvent.formFields || {})
    });

    syncProfileHealthFromEvent(carProfileId, resolvedEvent);

    // Save linked media with animal-type subfolder & dual EventID linkage
    if (data.media && data.media.length > 0) {
      const contributorName = data.contributorName || 'Contributor';
      const animalType = resolvedEvent.animalType || 'Other';

      data.media.forEach(fileObj => {
        saveMediaFile(carProfileId, contributorName, animalType, {
          ...fileObj,
          eventId: eventId,
          visibility: resolvedEvent.visibility,
          source: resolvedEvent.source
        });
      });
    }

    return { success: true, eventId: eventId, carProfileId: carProfileId };
  } catch (err) {
    Logger.log('Error saving event: ' + err.toString());
    return { success: false, error: 'Server error: ' + err.toString() };
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function syncProfileHealthFromEvent(carProfileId, event) {
  const eventType = String(event.eventType || '').toLowerCase();
  const formFields = event.formFields || {};
  const dateValue = sanitizeString(event.dateOfEvent) || sanitizeString(event.dateReported);
  const baselineSheet = getSheet(CONFIG.sheetNames.baselineStatus);
  const rowNumber = findDataRowNumber(baselineSheet, 1, carProfileId);
  if (rowNumber < 2) return;

  const headers = getSchemaHeaders(CONFIG.sheetNames.baselineStatus);
  const indexOf = name => headers.findIndex(header => normalizeHeader(header) === normalizeHeader(name));
  const values = baselineSheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const sterilizationEvent = eventType.includes('steril') || !!formFields.sterilizationstatus;
  const vaccinationEvent = eventType.includes('vaccin') || eventType.includes('preventive') || !!formFields.preventivecaretype;

  if (sterilizationEvent) values[indexOf('SterilisationStatus')] = 'Sterilised';
  if (vaccinationEvent && dateValue && dateValue.toLowerCase() !== 'unknown') {
    const lastVaccinatedIndex = indexOf('LastVaccinated');
    const existingDate = String(values[lastVaccinatedIndex] || '').trim();
    const existingDateMs = new Date(existingDate).getTime();
    const newDateMs = new Date(dateValue).getTime();
    if (!existingDate || existingDate.toLowerCase() === 'unknown' || isNaN(existingDateMs) || (!isNaN(newDateMs) && newDateMs >= existingDateMs)) {
      values[lastVaccinatedIndex] = dateValue;
    }
    values[indexOf('VaccinationStatus')] = 'Vaccinated';
  }
  baselineSheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
}

/**
 * Log a traceable audit correction (W2.7)
 * Appends edit record to AuditCorrections sheet without overwriting original data
 */
function apiLogCorrection(targetTable, targetRecordId, fieldName, oldValue, newValue, reason, contributorId, carProfileId, adminToken) {
  try {
    requireAdminAccess(adminToken);
    const edit = applyRecordEdit(targetTable, targetRecordId, carProfileId, fieldName, newValue);
    if (!edit.success) return edit;
    const correctionId = generateCorrectionID();
    const sheet = getSheet(CONFIG.sheetNames.auditCorrections);

    appendRecordBySchema(sheet, CONFIG.sheetNames.auditCorrections, {
      correctionid: correctionId,
      targettable: sanitizeString(targetTable),
      targetrecordid: "'" + sanitizeString(targetRecordId),
      carid: "'" + sanitizeString(carProfileId || (String(targetTable) === 'AnimalProfiles' ? targetRecordId : '')),
      fieldname: sanitizeString(fieldName),
      oldvalue: sanitizeString(edit.oldValue),
      newvalue: sanitizeString(newValue),
      correctionreason: sanitizeString(reason || 'Data Correction'),
      modifiedby: sanitizeString(contributorId || ''),
      timestamp: new Date()
    });

    return { success: true, correctionId: correctionId, oldValue: edit.oldValue, newValue: sanitizeString(newValue) };
  } catch (err) {
    Logger.log('Error logging correction: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}

function applyRecordEdit(targetTable, targetRecordId, carProfileId, fieldName, newValue) {
  const normalizedField = normalizeHeader(fieldName);
  const target = String(targetTable || '').trim();
  let sheet = null;
  let rowNumber = -1;
  let headers = [];

  if (target === 'AnimalProfiles') {
    const animalSheet = getSheet(CONFIG.sheetNames.animals);
    const animalRowNumber = findDataRowNumber(animalSheet, 0, targetRecordId);
    if (animalRowNumber >= 2) {
      const profileFieldGroups = [
        { sheetName: CONFIG.sheetNames.animals, sheet: animalSheet, rowNumber: animalRowNumber, headers: getSchemaHeaders(CONFIG.sheetNames.animals) },
        { sheetName: CONFIG.sheetNames.baselineStatus, sheet: getSheet(CONFIG.sheetNames.baselineStatus), rowNumber: findDataRowNumber(getSheet(CONFIG.sheetNames.baselineStatus), 1, targetRecordId), headers: getSchemaHeaders(CONFIG.sheetNames.baselineStatus) }
      ];
      const locationId = animalSheet.getRange(animalRowNumber, 15).getDisplayValue();
      const locationSheet = getSheet(CONFIG.sheetNames.locations);
      profileFieldGroups.push({ sheetName: CONFIG.sheetNames.locations, sheet: locationSheet, rowNumber: findDataRowNumber(locationSheet, 0, locationId), headers: getSchemaHeaders(CONFIG.sheetNames.locations) });
      const group = profileFieldGroups.find(item => item.rowNumber >= 2 && item.headers.some(header => normalizeHeader(header) === normalizedField));
      if (group) { sheet = group.sheet; rowNumber = group.rowNumber; headers = group.headers; }
    }
  } else if (target === 'EventRecords') {
    const eventTarget = findEventSheetRow(targetRecordId);
    if (eventTarget) {
      sheet = eventTarget.sheet;
      rowNumber = eventTarget.rowNumber;
      headers = getSchemaHeaders(sheet.getName());
    }
  } else {
    return { success: false, error: 'Unsupported edit target.' };
  }

  if (!sheet || rowNumber < 2) return { success: false, error: 'The original record could not be found.' };
  const columnIndex = headers.findIndex(header => normalizeHeader(header) === normalizedField);
  if (columnIndex < 0) return { success: false, error: 'The selected field is not editable.' };

  const cell = sheet.getRange(rowNumber, columnIndex + 1);
  const oldValue = cell.getDisplayValue();
  cell.setValue(newValue === null || newValue === undefined ? '' : String(newValue));
  return { success: true, oldValue: oldValue };
}

function findDataRowNumber(sheet, idColumnIndex, idValue) {
  const rows = sheet.getDataRange().getDisplayValues();
  const cleanId = String(idValue || '').trim().replace(/^'/, '').toLowerCase();
  for (let index = 1; index < rows.length; index++) {
    if (String(rows[index][idColumnIndex] || '').trim().replace(/^'/, '').toLowerCase() === cleanId) return index + 1;
  }
  return -1;
}

function findEventSheetRow(eventId) {
  const spreadsheet = getSpreadsheet();
  const cleanId = String(eventId || '').trim().replace(/^'/, '').toLowerCase();
  for (const sheetName of getAllEventSheetNames()) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) continue;
    const rowNumber = findDataRowNumber(sheet, 0, cleanId);
    if (rowNumber >= 2) return { sheet: sheet, rowNumber: rowNumber };
  }
  return null;
}

function normalizeDateValue(value, fallback) {
  if (!value || !String(value).trim() || String(value).trim().toLowerCase() === 'unknown') {
    return fallback || 'Unknown';
  }
  return String(value).trim();
}

function validateEventData(data) {
  const errors = [];
  if (!data || !data.carProfileId || !String(data.carProfileId).trim()) errors.push('CAR Profile ID is required');
  const event = data && data.event ? data.event : {};
  if (!event.eventType || !String(event.eventType).trim()) errors.push('Type of event is required');
  return { valid: errors.length === 0, errors: errors };
}
