/**
 * CAR Platform - Media Upload Module
 * Saves uploaded digital evidence files in Google Drive folder structured by animal type
 * Renames files to: [CARProfileID]_[ContributorName].[ext]
 */

/**
 * Retrieve or create the primary folder for CAR media uploads
 * @return {Folder} Google Drive Folder object
 */
function getOrCreateMediaFolder() {
  const folders = DriveApp.getFoldersByName(CONFIG.driveFolderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    const newFolder = DriveApp.createFolder(CONFIG.driveFolderName);
    try {
      newFolder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (e) {
      Logger.log('Warning: Could not set folder sharing restriction: ' + e.toString());
    }
    return newFolder;
  }
}

/**
 * Get or create animal-type subfolder (e.g. "CAR Media/Dog")
 * @param {string} animalType - Dog, Cat, Bird, Cattle, Other
 * @return {Folder} Subfolder object
 */
function getOrCreateAnimalTypeFolder(animalType) {
  const rootFolder = getOrCreateMediaFolder();
  const safeType = sanitizeString(animalType) || 'Other';
  const validTypes = ['Dog', 'Cat', 'Bird', 'Cattle', 'Other'];
  const folderName = validTypes.includes(safeType) ? safeType : 'Other';

  const subfolders = rootFolder.getFoldersByName(folderName);
  if (subfolders.hasNext()) {
    return subfolders.next();
  } else {
    return rootFolder.createFolder(folderName);
  }
}

/**
 * Decode and save media file to Google Drive and log in Media sheet
 * Renames file to: [CARProfileID]_[ContributorName].[ext]
 * @param {string} carProfileId - CAR Profile ID to link file
 * @param {string} contributorName - Name of contributor uploading file
 * @param {string} animalType - Dog, Cat, Bird, Cattle, etc.
 * @param {Object} fileObj - Digital file object (filename, mimeType, base64Data, eventId, visibility, source)
 * @return {string} Drive file ID
 */
function saveMediaFile(carProfileId, contributorName, animalType, fileObj) {
  const targetFolder = getOrCreateAnimalTypeFolder(animalType);

  // Determine file extension
  let ext = 'jpg';
  if (fileObj.filename && fileObj.filename.includes('.')) {
    ext = fileObj.filename.split('.').pop();
  } else if (fileObj.mimeType === 'image/png') {
    ext = 'png';
  } else if (fileObj.mimeType === 'application/pdf') {
    ext = 'pdf';
  }

  // Clean contributor name for filename
  const cleanContributor = sanitizeString(contributorName || 'Contributor').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const cleanCarId = sanitizeString(carProfileId).replace(/[^a-zA-Z0-9_-]+/g, '_');
  const newFileName = `${cleanCarId}_${cleanContributor}.${ext}`;

  // Decode Base64 data to Blob
  const base64Data = fileObj.base64Data.split(',')[1] || fileObj.base64Data;
  const decodedBytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decodedBytes, fileObj.mimeType, newFileName);

  // Create file in animal-type subfolder
  const driveFile = targetFolder.createFile(blob);

  const fileId = driveFile.getId();
  const fileUrl = driveFile.getUrl();

  // BUG-11 FIX: Explicitly restrict file access after upload.
  // Without this, files inherit the folder's sharing settings and may be publicly accessible.
  // TC-W2.6 requires files to be restricted/non-public by default.
  try {
    driveFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  } catch (sharingErr) {
    Logger.log('Warning: Could not set file sharing restriction: ' + sharingErr.toString());
  }

  // Save reference in Media sheet
  const mediaId = generateMediaID();
  const mediaSheet = getSheet(CONFIG.sheetNames.media);

  appendRecordBySchema(mediaSheet, CONFIG.sheetNames.media, {
    mediaid: mediaId,
    carprofileid: "'" + carProfileId,
    eventid: fileObj.eventId ? "'" + fileObj.eventId : '',
    animaltype: animalType || 'Other',
    mediatype: fileObj.mimeType.startsWith('image/') ? 'Photo' : 'Document',
    drivefileid: fileId,
    drivefileurl: fileUrl,
    filename: newFileName,
    visibility: fileObj.visibility || 'Restricted',
    source: fileObj.source || 'Self-reported',
    uploadtimestamp: new Date()
  });

  return fileId;
}

function validateMediaFiles(files) {
  const errors = [];
  if (!files) return errors;
  if (files.length > 5) errors.push('Upload up to 5 files');
  files.forEach(file => {
    const base64Length = String(file.base64Data || '').split(',').pop().length;
    const sizeBytes = Math.floor(base64Length * 3 / 4);
    if (sizeBytes > 10 * 1024 * 1024) errors.push(file.filename + ' exceeds the 10 MB limit');
  });
  return errors;
}
