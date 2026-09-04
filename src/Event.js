/**
 * CAR Platform - Event Module
 * Adds immutable event records to an existing animal profile and logs traceable history corrections.
 */

function apiSaveEvent(data) {
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
    eventSheet.appendRow([
      eventId,
      "'" + carProfileId,
      sanitizeString(resolvedEvent.dateReported),
      sanitizeString(resolvedEvent.animalType),
      sanitizeString(resolvedEvent.animalOtherDetails),
      sanitizeString(resolvedEvent.animalName),
      sanitizeString(resolvedEvent.area),
      sanitizeString(resolvedEvent.landmark),
      sanitizeString(resolvedEvent.googleLocationPin),
      sanitizeString(resolvedEvent.healthCondition),
      sanitizeString(resolvedEvent.healthOtherDetails),
      sanitizeString(resolvedEvent.behaviour),
      sanitizeString(resolvedEvent.behaviourOtherDetails),
      sanitizeString(resolvedEvent.vaccinated),
      sanitizeString(resolvedEvent.sterilised),
      sanitizeString(resolvedEvent.identificationMarks),
      sanitizeString(resolvedEvent.identificationOtherDetails),
      sanitizeString(resolvedEvent.eventType),
      sanitizeString(resolvedEvent.eventCategory),
      sanitizeString(resolvedEvent.eventOtherDetails),
      sanitizeString(resolvedEvent.dateOfEvent),
      sanitizeString(resolvedEvent.organisationOrPerson),
      sanitizeString(resolvedEvent.eventDescription),
      sanitizeString(resolvedEvent.outcomeCurrentStatus),
      sanitizeString(resolvedEvent.additionalDetails),
      resolvedEvent.source,
      resolvedEvent.verificationStatus,
      resolvedEvent.visibility,
      new Date()
    ]);

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
  }
}

/**
 * Log a traceable audit correction (W2.7)
 * Appends edit record to AuditCorrections sheet without overwriting original data
 */
function apiLogCorrection(targetTable, targetRecordId, fieldName, oldValue, newValue, reason, contributorId) {
  try {
    const correctionId = generateCorrectionID();
    const sheet = getSheet(CONFIG.sheetNames.auditCorrections);

    sheet.appendRow([
      correctionId,
      sanitizeString(targetTable),
      "'" + sanitizeString(targetRecordId),
      sanitizeString(fieldName),
      sanitizeString(oldValue),
      sanitizeString(newValue),
      sanitizeString(reason || 'Data Correction'),
      sanitizeString(contributorId || ''),
      new Date()
    ]);

    return { success: true, correctionId: correctionId };
  } catch (err) {
    Logger.log('Error logging correction: ' + err.toString());
    return { success: false, error: err.toString() };
  }
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
