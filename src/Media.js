/**
 * CAR Platform - Media Upload Module
 * Saves uploaded digital evidence files in Google Drive folder
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
    newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return newFolder;
  }
}

/**
 * Decode and save media file to Google Drive and log in Media sheet
 * @param {string} carProfileId - CAR Profile ID to link file
 * @param {string} parentFolderId - Folder ID where to save
 * @param {Object} fileObj - Digital file object containing filename, mimeType, base64Data
 * @return {string} Drive file ID
 */
function saveMediaFile(carProfileId, parentFolderId, fileObj) {
  const parentFolder = DriveApp.getFolderById(parentFolderId);

  // Decode Base64 data to Blob
  const base64Data = fileObj.base64Data.split(',')[1] || fileObj.base64Data;
  const decodedBytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decodedBytes, fileObj.mimeType, fileObj.filename);

  // Create file in folder
  const driveFile = parentFolder.createFile(blob);

  // Set file details
  const fileId = driveFile.getId();
  const fileUrl = driveFile.getUrl();

  // Save reference in Media sheet
  const mediaId = generateMediaID();
  const mediaSheet = getSheet(CONFIG.sheetNames.media);

  mediaSheet.appendRow([
    mediaId,
    carProfileId,
    fileObj.mimeType.startsWith('image/') ? 'Photo' : 'Document',
    fileId,
    fileUrl,
    fileObj.filename,
    new Date()
  ]);

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
