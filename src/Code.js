/**
 * CAR Platform - Main Entry Point
 * Google Apps Script Web App
 */

// Configuration - UPDATE THESE WITH YOUR ACTUAL SPREADSHEET ID
const CONFIG = {
  spreadsheetId: '1wnYt_-YthWLC79Qay3dpolWc4D7PQENC2JtXOw4jXNI',
  sheetNames: {
    contributors: 'Contributors',
    animals: 'Animals',
    locations: 'Locations',
    baselineStatus: 'BaselineStatus',
    media: 'Media',
    events: 'Events',
    uncertainMatches: 'UncertainMatches',
    auditCorrections: 'AuditCorrections'
  },
  driveFolderName: 'CAR Media'
};

/**
 * Serves the HTML interface
 */
function doGet(e) {
  const candidates = ['frontend/index', 'frontend\\index', 'index'];
  let template = null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      template = HtmlService.createTemplateFromFile(candidates[i]);
      if (template) break;
    } catch (err) {}
  }
  if (!template) {
    try {
      template = HtmlService.createHtmlOutputFromFile('index');
    } catch (err2) {
      return HtmlService.createHtmlOutput('<h3>Error: Could not load index template</h3>');
    }
  }
  return template
      .evaluate()
      .setTitle('CAR - Community Animal Records')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include other HTML files (for styles and scripts)
 */
function include(filename) {
  const cleanName = String(filename || '').replace(/\.html$/, '').trim();
  const baseName = cleanName.split(/[\/\\]/).pop();
  const variations = [
    cleanName,
    cleanName.replace(/\//g, '\\'),
    cleanName.replace(/\\/g, '/'),
    baseName,
    'frontend/' + baseName,
    'frontend\\' + baseName
  ];
  for (let i = 0; i < variations.length; i++) {
    try {
      return HtmlService.createHtmlOutputFromFile(variations[i]).getContent();
    } catch (e) {}
  }
  Logger.log('Could not include file: ' + filename);
  return '<!-- Include failed: ' + filename + ' -->';
}

/**
 * Get spreadsheet object
 */
function getSpreadsheet() {
  if (CONFIG.spreadsheetId) {
    try {
      return SpreadsheetApp.openById(CONFIG.spreadsheetId);
    } catch (err) {
      Logger.log('Configured spreadsheet could not be opened: ' + err.toString());
    }
  }

  const properties = PropertiesService.getScriptProperties();
  const savedSpreadsheetId = properties.getProperty('CAR_DATABASE_SPREADSHEET_ID');
  if (savedSpreadsheetId) {
    try {
      return SpreadsheetApp.openById(savedSpreadsheetId);
    } catch (err) {
      Logger.log('Saved spreadsheet could not be opened: ' + err.toString());
      properties.deleteProperty('CAR_DATABASE_SPREADSHEET_ID');
    }
  }

  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) return activeSpreadsheet;

  const createdSpreadsheet = SpreadsheetApp.create('CAR Database');
  properties.setProperty('CAR_DATABASE_SPREADSHEET_ID', createdSpreadsheet.getId());
  return createdSpreadsheet;
}

function getDatabaseInfo() {
  const spreadsheet = getSpreadsheet();
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    spreadsheetName: spreadsheet.getName()
  };
}

function setDatabaseSpreadsheet(spreadsheetId) {
  if (!spreadsheetId || !String(spreadsheetId).trim()) throw new Error('A Google Spreadsheet ID is required');
  const spreadsheet = SpreadsheetApp.openById(String(spreadsheetId).trim());
  PropertiesService.getScriptProperties().setProperty('CAR_DATABASE_SPREADSHEET_ID', spreadsheet.getId());
  return getDatabaseInfo();
}

/**
 * Get sheet by name
 */
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheet(sheet, sheetName);
  }

  return sheet;
}

/**
 * Initialize sheet with headers based on DATA_DICTIONARY.md
 */
function initializeSheet(sheet, sheetName) {
  const headers = getSchemaHeaders(sheetName);

  if (headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function appendRecordBySchema(sheet, sheetName, record) {
  const headers = getSchemaHeaders(sheetName);
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
    .getDisplayValues()[0].slice(0, headers.length).map(value => String(value).trim());
  if (currentHeaders.join('|') !== headers.join('|') || sheet.getLastColumn() !== headers.length) {
    migrateSheetToSchema(sheet, sheetName);
  }
  const values = headers.map(header => {
    const value = record[normalizeHeader(header)];
    return value === null || value === undefined ? '' : value;
  });
  sheet.appendRow(values);
}

function getSchemaHeaders(sheetName) {
  if (isEventSheet(sheetName)) {
    return getEventSchemaHeaders();
  }

  switch (sheetName) {
    case CONFIG.sheetNames.contributors:
      return ['ContributorID', 'Name', 'Mobile', 'Email', 'Timestamp'];
    case CONFIG.sheetNames.animals:
      return ['CARProfileID', 'AnimalName', 'AnimalType', 'BreedType', 'NativeDogType',
        'BreedOtherDetails', 'Sex', 'Age', 'CaregiverAnswer', 'CaregiverType',
        'CaregiverOtherDetails', 'CareProvided', 'CareOtherDetails', 'ContributorID',
        'LocationID', 'Timestamp', 'vaccinated_rabies', 'sterilized', 'vaccinated_rabies_initial', 'sterilized_initial'];
    case CONFIG.sheetNames.locations:
      return ['LocationID', 'UsualLocationType', 'State', 'City', 'Area', 'Landmark',
        'GPSCoordinates', 'GPSLatitude', 'GPSLongitude', 'GPSCapturedMethod', 'SeenRegularly', 'Timestamp'];
    case CONFIG.sheetNames.baselineStatus:
      return ['BaselineID', 'CARProfileID', 'HealthStatus', 'VaccinationStatus',
        'SterilisationStatus', 'Behavior', 'ABCStatus', 'ABCOutcome', 'IdentificationMarks',
        'IdentificationOtherDetails', 'AdditionalDetails', 'LastVaccinated', 'Timestamp'];
    case CONFIG.sheetNames.media:
      return ['MediaID', 'CARProfileID', 'EventID', 'AnimalType', 'MediaType', 'DriveFileID', 'DriveFileURL',
        'FileName', 'Visibility', 'Source', 'UploadTimestamp'];
    case CONFIG.sheetNames.uncertainMatches:
      return ['HoldID', 'MatchedCARProfileID', 'MatchScore', 'MatchingFieldsJSON', 'SubmittedDataJSON', 'ContributorID', 'Status', 'CreatedAt', 'AdminNotes', 'ResolvedBy', 'ResolvedAt'];
    case CONFIG.sheetNames.auditCorrections:
      return ['CorrectionID', 'TargetTable', 'TargetRecordID', 'CAR-ID', 'FieldName', 'OldValue', 'NewValue', 'CorrectionReason', 'ModifiedBy', 'Timestamp'];
    case CONFIG.sheetNames.events:
      return getEventSchemaHeaders();
    default:
      return [];
  }
}
function getEventSchemaHeaders() {
  return ['EventID', 'CAR-ID', 'DateReported', 'AnimalType', 'AnimalOtherDetails',
    'AnimalName', 'Area', 'Landmark', 'GPSLocation', 'HealthCondition',
    'HealthOtherDetails', 'Behaviour', 'BehaviourOtherDetails', 'Vaccinated',
    'Sterilised', 'IdentificationMarks', 'IdentificationOtherDetails', 'EventType',
    'EventCategory', 'EventOtherDetails', 'DateOfEvent', 'OrganisationOrPerson',
    'EventDescription', 'OutcomeCurrentStatus', 'AdditionalDetails', 'Source', 'Verification', 'Visibility', 'Timestamp',
    'DateReportedForm', 'AreaLocality', 'CurrentHealthConditionBeforeDeath', 'DeathDatetimeApproximate',
    'SuspectedCauseOfDeath', 'CauseConfirmedByVeterinarian', 'FollowUpActionTaken', 'FurtherFollowUpRequired',
    'TypeOfEvent', 'EventTypeOtherDetails', 'LastSeenDatetime', 'LastSeenLocation', 'IsAnimalStillMissing',
    'ImmediateSupportNeeded', 'ContactPerson', 'ContactNumber', 'FoundDatetimeApproximate', 'FoundLocation',
    'KnownInArea', 'CurrentStatus', 'CurrentStatusOtherDetails', 'FoundAbandonedDatetime', 'AbandonmentEvidence',
    'CurrentlySafe', 'RelocatedFrom', 'RelocatedTo', 'ReasonForRelocation', 'RelocationReasonOtherDetails',
    'OrganisationOrPersonResponsible', 'FurtherSupportNeeded', 'FurtherSupportOtherDetails',
    'TypeOfCrueltyAbuse', 'CrueltyAbuseOtherDetails', 'AnimalCurrentlySafe', 'ImmediateAssistanceRequired',
    'ImmediateAssistanceOtherDetails', 'IncidentReportedTo', 'IncidentReportedOtherDetails',
    'ReturnReleaseType', 'ReturnReleaseTypeOther', 'DateOfReturnRelease', 'ReturnedReleasedBy',
    'ReleaseReturnLocation', 'ReleaseReturnLocationOther', 'ConditionAtReturnRelease', 'ConditionAtReturnReleaseOther',
    'BiteIncidentDatetime', 'WhoWasBitten', 'BiteSeverity', 'EventsBeforeBite', 'EventsBeforeBiteOtherDetails',
    'FosterStartDate', 'FosterCaregiverName', 'FosterCaregiverContactNumber', 'FosterLocation',
    'ExpectedDuration', 'ExpectedDurationOtherDetails', 'ReasonForFosterCare', 'ReasonForFosterCareOtherDetails',
    'PickedUpBy', 'PickedUpByOtherDetails', 'ReasonForPickup', 'ReasonForPickupOtherDetails',
    'AnimalTakenTo', 'AnimalTakenToOtherDetails', 'TypeOfConflict', 'TypeOfConflictOtherDetails',
    'ReportedBy', 'ReportedByOtherDetails', 'ConflictResolved', 'FollowUpActionOtherDetails',
    'VaccinationHealthCondition', 'VaccinationHealthConditionOther', 'VaccinationBehaviour',
    'VaccinationBehaviourOther', 'VaccinationStatus', 'VaccinationSterilized',
    'VaccinationIdentificationMarks', 'VaccinationIdentificationMarksOther', 'PreventiveCareType',
    'PreventiveCareOtherDetails', 'PreventiveCareDate', 'PreventiveCareGivenBy', 'NextFollowUpDate',
    'VaccineProductName', 'SterilizationDateReported', 'SterilizationHealthCondition',
    'SterilizationBehaviour', 'SterilizationVaccinated', 'SterilizationStatus',
    'SterilizationIdentificationMarks', 'SterilizationProcedureActions', 'SterilizationProcedureDate',
    'SterilizationPerformedBy', 'SterilizationEarNotchApplied', 'SterilizationRecoveryStatus',
    'SterilizationAdditionalDetails', 'MedicalTreatmentDate', 'MedicalTreatmentHealthCondition',
    'MedicalTreatmentBehaviour', 'MedicalTreatmentReason', 'MedicalTreatmentGiven',
    'MedicalTreatmentProvidedBy', 'MedicalTreatmentSupportNeeded', 'MedicalTreatmentAdditionalDetails',
    'RabiesVaccinationStatusSnapshot', 'SterilizationStatusSnapshot'];
}

function isEventSheet(sheetName) {
  return String(sheetName || '').startsWith('Event - ');
}

function getEventSheetName(eventType) {
  const typeName = String(eventType || '').trim();
  if (!typeName) return CONFIG.sheetNames.events;
  const normalized = typeName.replace(/[^a-zA-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? 'Event - ' + normalized : CONFIG.sheetNames.events;
}

function getAllEventSheetNames() {
  const spreadsheet = getSpreadsheet();
  const names = new Set([CONFIG.sheetNames.events]);
  spreadsheet.getSheets().forEach(sheet => {
    if (isEventSheet(sheet.getName())) names.add(sheet.getName());
  });
  return Array.from(names);
}

/**
 * Test function to verify setup
 */
function testSetup() {
  const report = [];
  const eventTypes = [
    'Vaccination or Preventive Care',
    'Medical Treatment',
    'Sterilization',
    'Rescue',
    'Lost Animal',
    'Found Animal',
    'Abandonment of Animal',
    'Relocation',
    'Cruelty / Abuse',
    'Returned / Released',
    'Bite Incident Report',
    'Foster Care',
    'Picked Up by Agencies / Government Bodies',
    'Community Conflict',
    'Death',
    'Other Events Not Listed',
    'Community Observation',
    'Behaviour',
    'Accident',
    'Reunited',
    'Adoption'
  ];

  Object.values(CONFIG.sheetNames).forEach(sheetName => {
    const sheet = getSheetForSetup(sheetName);
    const result = migrateSheetToSchema(sheet, sheetName);
    report.push({ sheet: sheetName, rows: result.rows, columns: getSchemaHeaders(sheetName).length, migrated: result.migrated });
    Logger.log(sheetName + ': ' + result.rows + ' data rows, schema ' + (result.migrated ? 'updated' : 'ready'));
  });

  eventTypes.forEach(eventType => {
    const sheetName = getEventSheetName(eventType);
    const sheet = getSheetForSetup(sheetName);
    const result = migrateSheetToSchema(sheet, sheetName);
    report.push({ sheet: sheetName, rows: result.rows, columns: getSchemaHeaders(sheetName).length, migrated: result.migrated });
    Logger.log(sheetName + ': ' + result.rows + ' data rows, schema ' + (result.migrated ? 'updated' : 'ready'));
  });

  return { success: true, spreadsheet: getDatabaseInfo(), sheets: report };
}

function regenerateDatabaseHeaders() {
  return testSetup();
}

function getSheetForSetup(sheetName) {
  const spreadsheet = getSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet && sheetName === CONFIG.sheetNames.baselineStatus) {
    sheet = spreadsheet.getSheetByName('Baseline Status');
    if (sheet) sheet.setName(sheetName);
  }
  return sheet || spreadsheet.insertSheet(sheetName);
}

function migrateSheetToSchema(sheet, sheetName) {
  const newHeaders = getSchemaHeaders(sheetName);
  const values = sheet.getDataRange().getValues();
  const oldHeaders = values.length ? values[0].map(value => String(value).trim()) : [];
  const oldHeaderIndexes = {};
  oldHeaders.forEach((header, index) => { oldHeaderIndexes[normalizeHeader(header)] = index; });
  if (!oldHeaderIndexes.carid && oldHeaderIndexes.carprofileid) oldHeaderIndexes.carid = oldHeaderIndexes.carprofileid;

  const rows = values.slice(1).filter(row => row.some(value => value !== '' && value !== null));
  const migratedRows = rows.map(row => newHeaders.map((header, headerIndex) => {
    const index = findHeaderIndex(oldHeaderIndexes, header);
    const currentValue = index === -1 ? '' : row[index];
    return normalizePlainTextValue(currentValue, header, sheetName);
  }));

  addMissingEntityIds(migratedRows, newHeaders, sheetName);
  const migrated = oldHeaders.join('|') !== newHeaders.join('|') || sheet.getLastColumn() !== newHeaders.length;
  sheet.clearContents();
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
  if (migratedRows.length) sheet.getRange(2, 1, migratedRows.length, newHeaders.length).setValues(migratedRows);
  sheet.getRange(1, 1, 1, newHeaders.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return { rows: migratedRows.length, migrated: migrated };
}

function migrateAnimalsStatusSchema() {
  const sheet = getSheet(CONFIG.sheetNames.animals);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const requiredHeaders = ['vaccinated_rabies', 'sterilized', 'vaccinated_rabies_initial', 'sterilized_initial'];
  const addedHeaders = [];
  requiredHeaders.forEach(header => {
    if (headers.some(existing => normalizeHeader(existing) === normalizeHeader(header))) return;
    const column = sheet.getLastColumn() + 1;
    sheet.getRange(1, column).setValue(header).setFontWeight('bold');
    headers.push(header);
    addedHeaders.push(header);
  });
  sheet.setFrozenRows(1);
  return { success: true, sheet: CONFIG.sheetNames.animals, rows: Math.max(0, sheet.getLastRow() - 1), addedHeaders: addedHeaders };
}

function normalizePlainTextValue(value, header, sheetName) {
  if (value === null || value === undefined) return '';
  // BUG-15 FIX: Date objects should never get the apostrophe prefix. Only convert to ISO string.
  if (value instanceof Date) return value.toISOString();
  // Only prepend apostrophe for numeric values that are ID/phone fields, not all numbers.
  if (typeof value === 'number') {
    const normalizedHeader = normalizeHeader(header);
    if (normalizedHeader.includes('carprofileid') || normalizedHeader.includes('phone') || normalizedHeader.includes('mobile')) {
      return "'" + String(value);
    }
    return String(value); // Return plain string for all other numbers (e.g. scores, counts)
  }
  const text = String(value).trim();
  if (!text) return '';
  const normalizedHeader = normalizeHeader(header);
  if (sheetName === CONFIG.sheetNames.contributors && (normalizedHeader === 'mobile' || normalizedHeader === 'phone')) {
    return "'" + text.replace(/\s+/g, '');
  }
  if (normalizedHeader.includes('carprofileid') || normalizedHeader.includes('phone') || normalizedHeader.includes('mobile')) {
    return "'" + text;
  }
  return text;
}

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHeaderIndex(indexes, header) {
  const normalized = normalizeHeader(header);
  const aliases = {
    behavior: ['behaviournote', 'behaviournotes', 'behaviornotes'],
    gpscoordinates: ['gpslocation', 'googlelocationpin'],
    gpslatitude: ['latitude'],
    gpslongitude: ['longitude'],
    gpscapturedmethod: ['source', 'manualentry'],
    timestamp: ['uploaddate', 'uploadtimestamp'],
    verification: ['verificationstatus']
  };
  if (indexes[normalized] !== undefined) return indexes[normalized];
  const possibleNames = aliases[normalized] || [];
  for (const alias of possibleNames) {
    if (indexes[alias] !== undefined) return indexes[alias];
  }
  return -1;
}

function addMissingEntityIds(rows, headers, sheetName) {
  const idHeader = headers[0];
  const idIndex = headers.indexOf(idHeader);
  rows.forEach(row => {
    if (row[idIndex]) return;
    if (sheetName === CONFIG.sheetNames.contributors) row[idIndex] = generateContributorID();
    if (sheetName === CONFIG.sheetNames.animals) row[idIndex] = generateCARProfileID();
    if (sheetName === CONFIG.sheetNames.locations) row[idIndex] = generateLocationID();
    if (sheetName === CONFIG.sheetNames.baselineStatus) row[idIndex] = generateBaselineID();
    if (sheetName === CONFIG.sheetNames.media) row[idIndex] = generateMediaID();
    if (sheetName === CONFIG.sheetNames.uncertainMatches) row[idIndex] = generateHoldID();
    if (sheetName === CONFIG.sheetNames.auditCorrections) row[idIndex] = generateCorrectionID();
    if (sheetName === CONFIG.sheetNames.events) row[idIndex] = 'EVT-' + generateRandomString(8);
  });
}
