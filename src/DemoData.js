/**
 * CAR Platform - Demonstration Dataset Generator (W3.9)
 * Populates realistic multi-species community animal records:
 * - Community Dogs (5)
 * - Shelter Dogs (3, longitudinal histories)
 * - Community Cats (4)
 * - Residential Cows (2)
 * - Community Birds (2)
 * - Search-Before-Create Duplicate Hold Queue pairs (2)
 * - Admin verification workflow records (Pending, Verified, Rejected)
 * - AuditCorrections trail
 */

function apiSeedDemoData() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, error: 'Database busy. Please try again.' };
  }

  try {
    var timestamp = new Date();
    var spreadsheet = getSpreadsheet();

    // Guard: check if demo data already seeded to prevent accidental duplicate blowout
    var animalsSheet = getSheet(CONFIG.sheetNames.animals);
    var existingAnimals = animalsSheet.getDataRange().getValues().slice(1);
    var existingNames = existingAnimals.map(function(r) { return String(r[1] || '').trim().toLowerCase(); });

    var seededProfiles = [];
    var seededEvents = [];

    // ── 1. Contributors (Privacy Preserved) ─────────────────────────────────
    var demoContributors = [
      { name: 'Aarav Sharma', mobile: '9820012345', email: 'aarav.care@example.com' },
      { name: 'Priya Iyer', mobile: '9845067890', email: 'priya.vol@example.com' },
      { name: 'Rohan Deshmukh', mobile: '9821198765', email: 'rohan.rescue@example.com' },
      { name: 'Ananya Sen', mobile: '9830054321', email: 'ananya.birds@example.com' },
      { name: 'Juhu Animal Shelter Staff', mobile: '9820000111', email: 'info@juhushelter.org' }
    ];

    var contribMap = {};
    var contribSheet = getSheet(CONFIG.sheetNames.contributors);
    demoContributors.forEach(function(c) {
      var cId = findContributorByMobile(c.mobile);
      if (!cId) {
        cId = generateContributorID();
        appendRecordBySchema(contribSheet, CONFIG.sheetNames.contributors, {
          contributorid: cId,
          name: c.name,
          mobile: "'" + c.mobile,
          email: c.email,
          timestamp: timestamp
        });
      }
      contribMap[c.name] = cId;
    });

    // ── 2. Animals Dataset Specification ─────────────────────────────────────
    var demoAnimals = [
      // 🐾 Community Dogs
      {
        name: 'Tommy', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Male', age: '3 years',
        caregiver: 'Yes', caregiverType: 'Multiple people',
        area: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', landmark: 'Near Carter Road Promenade',
        gps: '19.0657, 72.8277', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Right ear-notched',
        marks: 'Brown coat, white chest patch, right ear notch', behavior: 'Friendly and calm',
        photo: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&q=80',
        contrib: 'Aarav Sharma'
      },
      {
        name: 'Shiro', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Female', age: '1.5 years',
        caregiver: 'Yes', caregiverType: 'Individual',
        area: 'Andheri East', city: 'Mumbai', state: 'Maharashtra', landmark: 'Behind Metro Station',
        gps: '19.1197, 72.8697', health: 'Under Treatment', vacc: 'No', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'White indie with light tan markings on left ear', behavior: 'Shy and gentle',
        photo: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80',
        contrib: 'Priya Iyer'
      },
      {
        name: 'Bruno', type: 'Dog', breed: 'Mixed Breed', nativeType: '', sex: 'Male', age: '5 years',
        caregiver: 'Yes', caregiverType: 'Animal care group in the community',
        area: 'Powai', city: 'Mumbai', state: 'Maharashtra', landmark: 'IIT Main Gate corner',
        gps: '19.1254, 72.9154', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Left ear-notched',
        marks: 'Black and tan, bushy tail, collar with blue tag', behavior: 'Protective and active',
        photo: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&q=80',
        contrib: 'Rohan Deshmukh'
      },
      {
        name: 'Bella', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Female', age: '2 years',
        caregiver: 'Yes', caregiverType: 'Volunteer / NGO',
        area: 'Koramangala', city: 'Bangalore', state: 'Karnataka', landmark: '4th Block Park perimeter',
        gps: '12.9352, 77.6245', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Ear-notched',
        marks: 'Fawn coat, dark muzzle, friendly demeanor', behavior: 'Friendly, plays with park walkers',
        photo: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400&q=80',
        contrib: 'Priya Iyer'
      },
      {
        name: 'Kaalu', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Male', age: '1 year',
        caregiver: 'Yes', caregiverType: 'Individual',
        area: 'Indiranagar', city: 'Bangalore', state: 'Karnataka', landmark: '100ft Road Cafe lane',
        gps: '12.9784, 77.6408', health: 'Healthy', vacc: 'No', steril: 'Yes', abc: 'Yes', abcOutcome: 'Ear-notched',
        marks: 'All-black coat, white tip on tail', behavior: 'Alert and energetic',
        photo: 'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400&q=80',
        contrib: 'Aarav Sharma'
      },

      // 🐾 Shelter Dogs (Longitudinal histories)
      {
        name: 'Buster', type: 'Dog', breed: 'Mixed Breed', nativeType: '', sex: 'Male', age: '4 years',
        caregiver: 'Yes', caregiverType: 'Volunteer / NGO',
        area: 'Juhu', city: 'Mumbai', state: 'Maharashtra', landmark: 'Juhu Animal Care Facility',
        gps: '19.1025, 72.8258', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Sterilised & Vaccinated',
        marks: 'Golden retriever cross, floppy ears, scar on left shoulder', behavior: 'Affectionate, trained',
        photo: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&q=80',
        contrib: 'Juhu Animal Shelter Staff'
      },
      {
        name: 'Luna', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Female', age: '2.5 years',
        caregiver: 'Yes', caregiverType: 'Volunteer / NGO',
        area: 'Juhu', city: 'Mumbai', state: 'Maharashtra', landmark: 'Juhu Shelter Rehabilitation Wing',
        gps: '19.1028, 72.8262', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Sterilised',
        marks: 'White with black spots, microchipped', behavior: 'Calm and socialised',
        photo: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&q=80',
        contrib: 'Juhu Animal Shelter Staff'
      },
      {
        name: 'Rocky', type: 'Dog', breed: 'Indie / Native', nativeType: 'Indian Pariah Dog (INDog)', sex: 'Male', age: '6 months',
        caregiver: 'Yes', caregiverType: 'Volunteer / NGO',
        area: 'Juhu', city: 'Mumbai', state: 'Maharashtra', landmark: 'Shelter Puppy Ward',
        gps: '19.1030, 72.8255', health: 'Under Treatment', vacc: 'Yes', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'Brindle puppy, white socks on rear paws', behavior: 'Playful and curious',
        photo: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&q=80',
        contrib: 'Juhu Animal Shelter Staff'
      },

      // 🐈 Community Cats
      {
        name: 'Whiskers', type: 'Cat', breed: 'Domestic Short Hair', nativeType: '', sex: 'Male', age: '2 years',
        caregiver: 'Yes', caregiverType: 'Multiple people',
        area: 'Colaba', city: 'Mumbai', state: 'Maharashtra', landmark: 'Near Regal Cinema Alley',
        gps: '18.9220, 72.8315', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Left ear-tipped',
        marks: 'Grey tabby with dark stripes, green eyes, left ear tip clipped', behavior: 'Independent, approachable',
        photo: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=80',
        contrib: 'Priya Iyer'
      },
      {
        name: 'Mittens', type: 'Cat', breed: 'Domestic Short Hair', nativeType: '', sex: 'Female', age: '1 year',
        caregiver: 'Yes', caregiverType: 'Individual',
        area: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', landmark: 'Pali Hill Residential Lane',
        gps: '19.0680, 72.8290', health: 'Under Treatment', vacc: 'No', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'Calico coat (white, orange, black), distinct white paws', behavior: 'Timid and watchful',
        photo: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&q=80',
        contrib: 'Aarav Sharma'
      },
      {
        name: 'Simba', type: 'Cat', breed: 'Domestic Short Hair', nativeType: '', sex: 'Male', age: '3 years',
        caregiver: 'Yes', caregiverType: 'Animal care group in the community',
        area: 'Indiranagar', city: 'Bangalore', state: 'Karnataka', landmark: '12th Main defense colony',
        gps: '12.9719, 77.6412', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Ear-tipped',
        marks: 'Ginger tabby, amber eyes, robust build', behavior: 'Very friendly, greets residents',
        photo: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&q=80',
        contrib: 'Rohan Deshmukh'
      },
      {
        name: 'Cleo', type: 'Cat', breed: 'Domestic Short Hair', nativeType: '', sex: 'Female', age: '4 years',
        caregiver: 'Yes', caregiverType: 'Individual',
        area: 'Malleshwaram', city: 'Bangalore', state: 'Karnataka', landmark: '8th Cross market complex',
        gps: '13.0031, 77.5703', health: 'Healthy', vacc: 'Yes', steril: 'Yes', abc: 'Yes', abcOutcome: 'Ear-tipped',
        marks: 'Black and white tuxedo pattern, white bib and whiskers', behavior: 'Quiet, sunbathes in courtyards',
        photo: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=400&q=80',
        contrib: 'Priya Iyer'
      },

      // 🐄 Residential Cows
      {
        name: 'Gauri', type: 'Cow', breed: 'Indigenous Zebu / Desi', nativeType: '', sex: 'Female', age: '5 years',
        caregiver: 'Yes', caregiverType: 'Multiple people',
        area: 'Jayanagar', city: 'Bangalore', state: 'Karnataka', landmark: '4th Block Temple Street',
        gps: '12.9299, 77.5833', health: 'Healthy', vacc: 'Yes', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'White cow with hump, yellow tag #4412 in right ear', behavior: 'Docile, fed by community residents',
        photo: 'https://images.unsplash.com/photo-1546445317-29f4545e9d53?w=400&q=80',
        contrib: 'Aarav Sharma'
      },
      {
        name: 'Nandini', type: 'Cow', breed: 'Hallikar / Desi', nativeType: '', sex: 'Female', age: '7 years',
        caregiver: 'Yes', caregiverType: 'Multiple people',
        area: 'Basavanagudi', city: 'Bangalore', state: 'Karnataka', landmark: 'Bull Temple Road perimeter',
        gps: '12.9421, 77.5679', health: 'Healthy', vacc: 'Yes', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'Greyish-white coat, long horns, ear notch and municipal tag #3108', behavior: 'Gentle, accustomed to traffic',
        photo: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=400&q=80',
        contrib: 'Priya Iyer'
      },

      // 🐦 Community Birds
      {
        name: 'Neelkanth', type: 'Bird', breed: 'Indian Roller (Coracias benghalensis)', nativeType: '', sex: 'Male', age: '1 year',
        caregiver: 'Yes', caregiverType: 'Volunteer / NGO',
        area: 'Cubbon Park', city: 'Bangalore', state: 'Karnataka', landmark: 'Near State Central Library gardens',
        gps: '12.9763, 77.5929', health: 'Under Treatment', vacc: 'No', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'Bright turquoise and blue wings, brown breast, temporary wing splint', behavior: 'Alert, recuperating in aviary',
        photo: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=400&q=80',
        contrib: 'Ananya Sen'
      },
      {
        name: 'Moti', type: 'Bird', breed: 'Rock Pigeon (Columba livia)', nativeType: '', sex: 'Female', age: '2 years',
        caregiver: 'Yes', caregiverType: 'Animal care group in the community',
        area: 'Dadar West', city: 'Mumbai', state: 'Maharashtra', landmark: 'Kabutarkhana traffic island',
        gps: '19.0178, 72.8424', health: 'Healthy', vacc: 'No', steril: 'No', abc: 'No', abcOutcome: '',
        marks: 'Ash grey with purple-green iridescence on neck, numbered leg ring #109', behavior: 'Flocks with local colony, easily identified by ring',
        photo: 'https://images.unsplash.com/photo-1520808663317-647b476a81b9?w=400&q=80',
        contrib: 'Ananya Sen'
      }
    ];

    // Profile lookup map for events
    var profileMap = {};

    demoAnimals.forEach(function(a) {
      // Check if animal already exists to prevent duplicate seeding
      if (existingNames.indexOf(a.name.toLowerCase()) !== -1) {
        var found = existingAnimals.find(function(r) { return String(r[1] || '').trim().toLowerCase() === a.name.toLowerCase(); });
        if (found) {
          profileMap[a.name] = String(found[0]).replace(/^'/, '');
          return;
        }
      }

      var contribId = contribMap[a.contrib] || Object.values(contribMap)[0];
      var locationId = generateLocationID();
      var carProfileId = generateCARProfileID();

      // 1. Locations
      var locationSheet = getSheet(CONFIG.sheetNames.locations);
      appendRecordBySchema(locationSheet, CONFIG.sheetNames.locations, {
        locationid: locationId,
        usuallocationtype: 'Residential area / colony',
        state: a.state,
        city: a.city,
        area: a.area,
        landmark: a.landmark,
        gpscoordinates: a.gps,
        gpslatitude: a.gps.split(',')[0].trim(),
        gpslongitude: a.gps.split(',')[1].trim(),
        gpscapturedmethod: 'HTML5 High Accuracy Geolocation',
        seenregularly: 'Yes. Seen often',
        timestamp: timestamp
      });

      // 2. Animals
      appendRecordBySchema(animalsSheet, CONFIG.sheetNames.animals, {
        carprofileid: "'" + carProfileId,
        animalname: a.name,
        animaltype: a.type,
        breedtype: a.breed,
        nativedogtype: a.nativeType,
        breedotherdetails: '',
        sex: a.sex,
        age: a.age,
        caregiveranswer: a.caregiver,
        caregivertype: a.caregiverType,
        caregiverotherdetails: '',
        careprovided: 'Food, Water, and Periodic Health Checks',
        careotherdetails: '',
        contributorid: contribId,
        locationid: locationId,
        timestamp: timestamp
      });

      // 3. BaselineStatus
      var baselineSheet = getSheet(CONFIG.sheetNames.baselineStatus);
      appendRecordBySchema(baselineSheet, CONFIG.sheetNames.baselineStatus, {
        baselineid: generateBaselineID(),
        carprofileid: "'" + carProfileId,
        healthstatus: a.health,
        vaccinationstatus: a.vacc,
        sterilisationstatus: a.steril,
        behavior: a.behavior,
        abcstatus: a.abc,
        abcoutcome: a.abcOutcome,
        identificationmarks: a.marks,
        identificationotherdetails: '',
        additionaldetails: 'Initial registration baseline created via demonstration dataset seed.',
        timestamp: timestamp
      });

      // 4. Media (Photo)
      if (a.photo) {
        var mediaSheet = getSheet(CONFIG.sheetNames.media);
        appendRecordBySchema(mediaSheet, CONFIG.sheetNames.media, {
          mediaid: generateMediaID(),
          carprofileid: "'" + carProfileId,
          eventid: '',
          animaltype: a.type,
          mediatype: 'Photo',
          drivefileid: '',
          drivefileurl: a.photo,
          filename: a.name.toLowerCase() + '_profile.jpg',
          visibility: 'Public',
          source: 'Field volunteer photograph',
          timestamp: timestamp
        });
      }

      profileMap[a.name] = carProfileId;
      seededProfiles.push({ name: a.name, carProfileId: carProfileId, type: a.type });
    });

    // ── 3. Longitudinal Care Events & Timeline Demonstrations ────────────────
    var demoEvents = [
      // Buster (Shelter Dog) — Complete 4-step Timeline
      {
        animalName: 'Buster', type: 'Rescue', date: '2026-06-10',
        desc: 'Rescued near highway with injured shoulder and dehydration. Brought to Juhu Shelter by highway patrol.',
        outcome: 'Admitted to shelter clinic for critical treatment', source: 'Agency Referral', verif: 'Verified'
      },
      {
        animalName: 'Buster', type: 'Medical Treatment', date: '2026-06-15',
        desc: 'Wound dressing, pain management, and antibiotics administered for infected shoulder laceration.',
        outcome: 'Wound healing well, pain resolved', source: 'Shelter Veterinary EMR', verif: 'Verified'
      },
      {
        animalName: 'Buster', type: 'Sterilization', date: '2026-07-02',
        desc: 'Elective castration performed under general anaesthesia following complete wound healing.',
        outcome: 'Fully Recovered, no surgical complications', source: 'Shelter Clinic', verif: 'Verified'
      },
      {
        animalName: 'Buster', type: 'Vaccination or Preventive Care', date: '2026-07-20',
        desc: 'Annual Nobivac DHPPi + Rabies booster administered prior to adoption readiness clearance.',
        outcome: 'Vaccinated and cleared for adoption placement', source: 'Shelter Veterinary EMR', verif: 'Verified'
      },

      // Luna (Shelter Dog) — 4-step Timeline ending in Adoption
      {
        animalName: 'Luna', type: 'Abandonment of Animal', date: '2026-07-05',
        desc: 'Found tied to a railing outside residential gate with a collar and leash. No owner returned.',
        outcome: 'Intake to shelter foster unit', source: 'Citizen Report', verif: 'Verified'
      },
      {
        animalName: 'Luna', type: 'Medical Treatment', date: '2026-07-12',
        desc: 'De-worming, external parasite treatment (tick fever preventive care).',
        outcome: 'Healthy and cleared', source: 'Veterinary Clinic', verif: 'Verified'
      },
      {
        animalName: 'Luna', type: 'Behaviour', date: '2026-07-28',
        desc: 'Assessed for companion temperament with children and other animals.',
        outcome: 'Extremely friendly and adaptable', source: 'Shelter Behaviourist', verif: 'Verified'
      },
      {
        animalName: 'Luna', type: 'Adoption', date: '2026-08-15',
        desc: 'Formally adopted by a vetted resident family in Bandra. Adoption agreement filed.',
        outcome: 'Placed in permanent home', source: 'Shelter Adoption Coordinator', verif: 'Verified'
      },

      // Neelkanth (Bird) — 3-step Wildlife Rescue & Rehab Timeline
      {
        animalName: 'Neelkanth', type: 'Accident', date: '2026-08-01',
        desc: 'Collision with glass facade in Cubbon park perimeter. Discovered grounded with drooping right wing.',
        outcome: 'Rescued by park visitor', source: 'Community Observation', verif: 'Verified'
      },
      {
        animalName: 'Neelkanth', type: 'Rescue', date: '2026-08-01',
        desc: 'Transported in a ventilated box to Avian Rehabilitation Centre.',
        outcome: 'Transferred to specialist veterinary care', source: 'Wildlife Volunteer', verif: 'Verified'
      },
      {
        animalName: 'Neelkanth', type: 'Medical Treatment', date: '2026-08-05',
        desc: 'Avian radiography and figure-of-eight splint applied to right metacarpus.',
        outcome: 'Splint in place, hand-fed, recuperating well', source: 'Avian Vet Clinic', verif: 'Verified'
      },

      // Gauri (Cow) — Community Welfare Observation
      {
        animalName: 'Gauri', type: 'Community Observation', date: '2026-08-20',
        desc: 'Quarterly community welfare sighting check. Healthy body score, grazing normally in 4th Block.',
        outcome: 'Healthy condition confirmed', source: 'Community Report', verif: 'Verified'
      },

      // Tommy (Community Dog) — Admin Workflow States (1 Verified, 1 Unverified, 1 Rejected)
      {
        animalName: 'Tommy', type: 'Vaccination or Preventive Care', date: '2026-08-10',
        desc: 'Anti-Rabies Vaccination (Raksharab) administered during Bandra community drive.',
        outcome: 'Vaccinated for 2026-2027 season', source: 'Municipal ABC Drive', verif: 'Verified'
      },
      {
        animalName: 'Tommy', type: 'Community Observation', date: '2026-09-02',
        desc: 'Sighted resting near promenade bench. Citizen reported slight limp on front right leg.',
        outcome: 'Observation logged, monitoring requested', source: 'Citizen Report', verif: 'Unverified'
      },
      {
        animalName: 'Tommy', type: 'Community Conflict', date: '2026-09-05',
        desc: 'Resident reported aggressive barking at delivery vehicle.',
        outcome: 'Investigated by colony feeder; reported dog was mistaken for different pack leader',
        source: 'Public Complaint', verif: 'Rejected - Mistaken animal identification'
      }
    ];

    demoEvents.forEach(function(e) {
      var carId = profileMap[e.animalName];
      if (!carId) return;

      var sheetName = getEventSheetName(e.type);
      var sheet = getSheet(sheetName);
      var eventId = generateEventID();

      var animalRow = findAnimalRowByProfileId(carId);
      var aName = animalRow ? animalRow[1] : e.animalName;
      var aType = animalRow ? animalRow[2] : 'Dog';

      appendRecordBySchema(sheet, sheetName, {
        eventid: "'" + eventId,
        carprofileid: "'" + carId,
        datereported: e.date,
        animaltype: aType,
        animalname: aName,
        area: 'Locality Registered',
        eventtype: e.type,
        eventcategory: e.type,
        dateofevent: e.date,
        organisationorperson: e.source,
        eventdescription: e.desc,
        outcomecurrentstatus: e.outcome,
        source: e.source,
        verificationstatus: e.verif,
        visibility: 'Public',
        timestamp: timestamp
      });

      seededEvents.push({ eventId: eventId, carProfileId: carId, type: e.type, status: e.verif });
    });

    // ── 4. Duplicate Search-Before-Create Hold Queue Demonstrations (W3.7) ────
    var holdSheet = getSheet(CONFIG.sheetNames.uncertainMatches);
    var existingHolds = holdSheet.getDataRange().getValues().slice(1);
    var existingHoldCarIds = existingHolds.map(function(r) { return String(r[1] || '').replace(/^'/, '').trim(); });

    var tommyCarId = profileMap['Tommy'];
    if (tommyCarId && existingHoldCarIds.indexOf(tommyCarId) === -1) {
      holdSheet.appendRow([
        generateHoldID(),
        "'" + tommyCarId,
        82, // 82% match score
        JSON.stringify({ Area: 30, Marks: 25, Sex: 15, Breed: 12 }),
        JSON.stringify({
          animal: { animalName: 'Tom / Brownie', animalType: 'Dog', sex: 'Male', age: '3 yrs', breedType: 'Indie' },
          location: { area: 'Bandra West', city: 'Mumbai', gpsCoordinates: '19.0660, 72.8280' },
          baselineStatus: { healthStatus: 'Healthy', behavior: 'Friendly', identificationMarks: 'Brown indie with white chest patch' },
          contributor: { name: 'Sunil Mehta', mobile: '9820088899' }
        }),
        contribMap['Aarav Sharma'] || '',
        'Pending Review',
        timestamp
      ]);
    }

    var whiskersCarId = profileMap['Whiskers'];
    if (whiskersCarId && existingHoldCarIds.indexOf(whiskersCarId) === -1) {
      holdSheet.appendRow([
        generateHoldID(),
        "'" + whiskersCarId,
        68, // 68% match score
        JSON.stringify({ Area: 30, Marks: 20, Sex: 10, Breed: 8 }),
        JSON.stringify({
          animal: { animalName: 'Tiger (Colaba Cat)', animalType: 'Cat', sex: 'Male', age: 'Adult', breedType: 'Domestic Short Hair' },
          location: { area: 'Colaba', city: 'Mumbai', gpsCoordinates: '18.9225, 72.8310' },
          baselineStatus: { healthStatus: 'Healthy', behavior: 'Approachable', identificationMarks: 'Grey striped tabby cat, clipped left ear' },
          contributor: { name: 'Fatima Shaikh', mobile: '9820055443' }
        }),
        contribMap['Priya Iyer'] || '',
        'Pending Review',
        timestamp
      ]);
    }

    // ── 5. AuditCorrections Trail Initialization ─────────────────────────────
    var corrSheet = getSheet(CONFIG.sheetNames.auditCorrections);
    var auditRows = corrSheet.getDataRange().getValues().slice(1);
    if (auditRows.length < 2 && seededEvents.length > 0) {
      appendRecordBySchema(corrSheet, CONFIG.sheetNames.auditCorrections, {
        correctionid: generateCorrectionID(),
        targettable: 'EventRecords',
        targetrecordid: "'" + seededEvents[0].eventId,
        carid: "'" + seededEvents[0].carProfileId,
        fieldname: 'Verification',
        oldvalue: 'Unverified',
        newvalue: 'Verified',
        correctionreason: 'Admin reviewed and confirmed shelter EMR clinical report',
        modifiedby: 'admin@car.org',
        timestamp: timestamp
      });
    }

    return {
      success: true,
      message: 'Demonstration dataset seeded successfully!',
      profilesCount: seededProfiles.length,
      eventsCount: seededEvents.length,
      profiles: seededProfiles
    };

  } catch (err) {
    Logger.log('Error in apiSeedDemoData: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}
