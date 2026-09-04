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
        'LocationID', 'Timestamp'];
    case CONFIG.sheetNames.locations:
      return ['LocationID', 'UsualLocationType', 'State', 'City', 'Area', 'Landmark',
        'GPSCoordinates', 'GPSLatitude', 'GPSLongitude', 'GPSCapturedMethod', 'SeenRegularly', 'Timestamp'];
    case CONFIG.sheetNames.baselineStatus:
      return ['BaselineID', 'CARProfileID', 'HealthStatus', 'VaccinationStatus',
        'SterilisationStatus', 'Behavior', 'ABCStatus', 'ABCOutcome', 'IdentificationMarks',
        'IdentificationOtherDetails', 'AdditionalDetails', 'Timestamp'];
    case CONFIG.sheetNames.media:
      return ['MediaID', 'CARProfileID', 'EventID', 'AnimalType', 'MediaType', 'DriveFileID', 'DriveFileURL',
        'FileName', 'Visibility', 'Source', 'UploadTimestamp'];
    case CONFIG.sheetNames.uncertainMatches:
      return ['HoldID', 'MatchedCARProfileID', 'MatchScore', 'MatchingFieldsJSON', 'SubmittedDataJSON', 'ContributorID', 'Status', 'CreatedAt', 'AdminNotes', 'ResolvedBy', 'ResolvedAt'];
    case CONFIG.sheetNames.auditCorrections:
      return ['CorrectionID', 'TargetTable', 'TargetRecordID', 'FieldName', 'OldValue', 'NewValue', 'CorrectionReason', 'ModifiedBy', 'Timestamp'];
    case CONFIG.sheetNames.events:
      return getEventSchemaHeaders();
    default:
      return [];
  }
}

function getEventSchemaHeaders() {
  return ['EventID', 'CARProfileID', 'DateReported', 'AnimalType', 'AnimalOtherDetails',
    'AnimalName', 'Area', 'Landmark', 'GPSLocation', 'HealthCondition',
    'HealthOtherDetails', 'Behaviour', 'BehaviourOtherDetails', 'Vaccinated',
    'Sterilised', 'IdentificationMarks', 'IdentificationOtherDetails', 'EventType',
    'EventCategory', 'EventOtherDetails', 'DateOfEvent', 'OrganisationOrPerson',
    'EventDescription', 'OutcomeCurrentStatus', 'AdditionalDetails', 'Source', 'VerificationStatus', 'Visibility', 'Timestamp'];
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
    'Other Events Not Listed'
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
    timestamp: ['uploaddate', 'uploadtimestamp']
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
