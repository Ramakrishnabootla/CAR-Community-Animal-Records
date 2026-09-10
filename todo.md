new issue6:
issue is that submitted animal photo is not being populated.
i guess in search.js it is not being called properly
![alt text](image.png)
Status: ✅ RESOLVED
Fix: 

1. In `Search.js` `apiGetPendingHolds()`, added resolution for `submittedPhotoUrl` supporting `photoUrl`, `profileImageUrl`, `media` array (`base64Data`, `driveFileURL`, `driveFileId`, `url`, `photoUrl`), and animal-name fallback for seeded demo holds (`Tom / Brownie` and `Tiger`).
2. In `Search.js` `apiSaveUncertainMatch()`, added automated Google Drive saving of uploaded hold media so future user submissions have permanent Drive URLs and avoid the 50,000 character cell limit.
3. In `scripts.html` `viewHoldComparison()`, updated `subPhotoUrl` to check `hold.submittedPhotoUrl`, `submitted.photoUrl`, `submitted.profileImageUrl`, and `subMedia[0]` variants.

remove seed demo dataset from the applicaition completly i have seeded it already.
Status: ✅ RESOLVED
Fix: 
1. Removed the "🌱 Seed Demo Dataset" button from `CAR/frontend/index.html`.
2. Removed `triggerSeedDemoData()` function and its window export from `CAR/frontend/scripts.html`.
3. Updated empty state messages to reference normal record creation.
4. Deleted `CAR/src/DemoData.js` entirely from the codebase.