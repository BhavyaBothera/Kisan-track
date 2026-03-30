/**
 * ============================================================
 * KisanTrack — Master Data Store
 * All hardcoded application data lives here.
 * ============================================================
 */

const APP_DATA = {

  // ── Farm Meta ────────────────────────────────────────────
  farm: {
    name: "KisanTrack",
    owner: "Ramesh Patel",
    village: "Anandpur, Gujarat",
    lastSync: "2 min ago",
    systemOnline: true,
  },

  // ── Farmer Profile ────────────────────────────────────────
  farmer: {
    // Personal Info
    fullName:         "Ramesh Kumar Patel",
    initials:         "RK",
    age:              42,
    phone:            "+91 98765 43210",
    village:          "Anandpur",
    district:         "Anand",
    state:            "Gujarat",
    // Farm Details
    farmName:         "Patel Dairy Farm",
    farmSize:         "12.5 acres",
    yearsOfFarming:   18,
    primaryAnimalType:"Cow & Buffalo",
    sensorSystemId:   "KT-SYS-0042",
    // Account Info (read-only)
    farmerId:         "KT-2024-001",
    registrationDate: "January 15, 2024",
    lastLogin:        "Today, 12:30 PM",
    systemVersion:    "KisanTrack v2.4.1",
  },

  // ── Animal Registry ──────────────────────────────────────
  animals: [
    {
      id: "A01", emoji: "🐄", species: "Cow", speciesKey: "cows",
      breed: "Holstein", age: 4, weight: 420, tagId: "TAG-C001",
      status: "Healthy",
      vitals: { temp: 38.5, hr: 68, activity: "Normal" },
      baseVitals: { temp: 38.5, hr: 68, activity: 55 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.3, 38.4, 38.5, 38.6, 38.4, 38.5, 38.5],
        hr:       [66, 67, 68, 70, 67, 68, 68],
        activity: [50, 52, 55, 54, 53, 56, 55],
      },
      aiSummary: "Cow #A01 is in excellent health. Body temperature and heart rate are well within safe ranges. Activity levels are normal for her age. No veterinary intervention required at this time.",
      confidence: 97.1,
    },
    {
      id: "A02", emoji: "🐄", species: "Cow", speciesKey: "cows",
      breed: "Holstein", age: 3, weight: 380, tagId: "TAG-C002",
      status: "Warning",
      statusNote: "Elevated Temperature",
      vitals: { temp: 39.8, hr: 74, activity: "Normal" },
      baseVitals: { temp: 39.8, hr: 74, activity: 52 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.6, 38.7, 38.9, 39.2, 39.5, 39.7, 39.8],
        hr:       [68, 69, 71, 73, 74, 74, 74],
        activity: [55, 54, 52, 51, 52, 53, 52],
      },
      aiSummary: "Cow #A02 is showing elevated body temperature of 39.8°C, which is above the safe range of 38.0–39.5°C. Heart rate is normal at 74 bpm. The upward trend over 6 days is a concern. Recommend veterinary check within 24 hours.",
      confidence: 94.2,
    },
    {
      id: "A03", emoji: "🐄", species: "Cow", speciesKey: "cows",
      breed: "Gir", age: 5, weight: 450, tagId: "TAG-C003",
      status: "Healthy",
      vitals: { temp: 38.7, hr: 65, activity: "Normal" },
      baseVitals: { temp: 38.7, hr: 65, activity: 60 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.6, 38.8, 38.7, 38.6, 38.7, 38.8, 38.7],
        hr:       [63, 65, 64, 65, 66, 65, 65],
        activity: [58, 60, 61, 59, 60, 61, 60],
      },
      aiSummary: "Cow #A03 (Gir breed) is in good health. All vitals are stable and within normal ranges. Activity level is slightly above average, which is typical for this breed. No concerns at this time.",
      confidence: 98.3,
    },
    {
      id: "A04", emoji: "🐄", species: "Cow", speciesKey: "cows",
      breed: "Sahiwal", age: 6, weight: 480, tagId: "TAG-C004",
      status: "Healthy",
      vitals: { temp: 38.4, hr: 70, activity: "Normal" },
      baseVitals: { temp: 38.4, hr: 70, activity: 57 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.3, 38.4, 38.4, 38.5, 38.4, 38.3, 38.4],
        hr:       [69, 70, 71, 70, 69, 70, 70],
        activity: [55, 56, 57, 58, 56, 57, 57],
      },
      aiSummary: "Cow #A04 (Sahiwal breed) has maintained consistent vitals over the past week. Temperature and heart rate are stable. No abnormalities detected. Continue routine monitoring.",
      confidence: 96.5,
    },
    {
      id: "B01", emoji: "🐃", species: "Buffalo", speciesKey: "buffaloes",
      breed: "Murrah", age: 6, weight: 600, tagId: "TAG-B001",
      status: "Healthy",
      vitals: { temp: 38.9, hr: 72, activity: "Normal" },
      baseVitals: { temp: 38.9, hr: 72, activity: 50 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.7, 38.8, 38.9, 39.0, 38.9, 38.8, 38.9],
        hr:       [70, 71, 72, 73, 72, 71, 72],
        activity: [48, 49, 50, 51, 50, 49, 50],
      },
      aiSummary: "Buffalo #B01 (Murrah breed) is healthy. Vitals are within the normal range for buffaloes. Activity is slightly lower than cows — this is breed-normal. No action required.",
      confidence: 95.8,
    },
    {
      id: "B02", emoji: "🐃", species: "Buffalo", speciesKey: "buffaloes",
      breed: "Surti", age: 4, weight: 520, tagId: "TAG-B002",
      status: "Critical",
      statusNote: "Low Activity + High HR",
      vitals: { temp: 39.3, hr: 92, activity: "Low" },
      baseVitals: { temp: 39.3, hr: 92, activity: 20 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.9, 39.0, 39.1, 39.2, 39.2, 39.3, 39.3],
        hr:       [73, 76, 80, 84, 88, 91, 92],
        activity: [45, 40, 35, 28, 23, 21, 20],
      },
      aiSummary: "CRITICAL: Buffalo #B02 is showing dangerously low activity (20%) combined with an elevated heart rate of 92 bpm — well above the safe range of 60–80 bpm. This combination may indicate severe distress, pain, or systemic illness. Immediate veterinary attention is required.",
      confidence: 91.7,
    },
    {
      id: "B03", emoji: "🐃", species: "Buffalo", speciesKey: "buffaloes",
      breed: "Nili-Ravi", age: 5, weight: 580, tagId: "TAG-B003",
      status: "Healthy",
      vitals: { temp: 38.8, hr: 69, activity: "Normal" },
      baseVitals: { temp: 38.8, hr: 69, activity: 52 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.7, 38.8, 38.7, 38.8, 38.9, 38.8, 38.8],
        hr:       [68, 69, 68, 69, 70, 69, 69],
        activity: [50, 51, 52, 53, 52, 51, 52],
      },
      aiSummary: "Buffalo #B03 (Nili-Ravi breed) is in good health. All parameters are stable. No action needed.",
      confidence: 97.4,
    },
    {
      id: "G01", emoji: "🐐", species: "Goat", speciesKey: "goats",
      breed: "Beetal", age: 2, weight: 38, tagId: "TAG-G001",
      status: "Healthy",
      vitals: { temp: 39.1, hr: 78, activity: "High" },
      baseVitals: { temp: 39.1, hr: 78, activity: 75 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [39.0, 39.1, 39.2, 39.1, 39.0, 39.1, 39.1],
        hr:       [76, 78, 79, 77, 78, 79, 78],
        activity: [72, 74, 76, 75, 73, 74, 75],
      },
      aiSummary: "Goat #G01 (Beetal breed) is active and healthy. High activity level is completely normal for this young goat breed. Vitals are within safe ranges. No concerns.",
      confidence: 98.0,
    },
    {
      id: "G02", emoji: "🐐", species: "Goat", speciesKey: "goats",
      breed: "Sirohi", age: 3, weight: 42, tagId: "TAG-G002",
      status: "Healthy",
      vitals: { temp: 39.0, hr: 75, activity: "Normal" },
      baseVitals: { temp: 39.0, hr: 75, activity: 65 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.9, 39.0, 39.1, 39.0, 38.9, 39.0, 39.0],
        hr:       [73, 74, 75, 76, 75, 74, 75],
        activity: [63, 64, 65, 66, 64, 65, 65],
      },
      aiSummary: "Goat #G02 (Sirohi breed) is healthy with stable vitals. All parameters are well within the safe range. No veterinary action required.",
      confidence: 97.8,
    },
    {
      id: "G03", emoji: "🐐", species: "Goat", speciesKey: "goats",
      breed: "Beetal", age: 1, weight: 22, tagId: "TAG-G003",
      status: "Warning",
      statusNote: "Slightly Low Activity",
      vitals: { temp: 38.8, hr: 80, activity: "Low" },
      baseVitals: { temp: 38.8, hr: 80, activity: 30 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [39.0, 38.9, 38.8, 38.8, 38.7, 38.8, 38.8],
        hr:       [77, 78, 79, 80, 80, 80, 80],
        activity: [62, 55, 48, 40, 35, 32, 30],
      },
      aiSummary: "Goat #G03 has shown a declining activity trend over the past 6 days, dropping from 62% to 30%. Although temperature and HR are borderline normal, the activity dip in a young goat warrants monitoring. Suggest observation for next 12 hours.",
      confidence: 88.5,
    },
    {
      id: "G04", emoji: "🐐", species: "Goat", speciesKey: "goats",
      breed: "Jamunapari", age: 2, weight: 35, tagId: "TAG-G004",
      status: "Healthy",
      vitals: { temp: 39.2, hr: 76, activity: "Normal" },
      baseVitals: { temp: 39.2, hr: 76, activity: 68 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [39.1, 39.2, 39.3, 39.2, 39.1, 39.2, 39.2],
        hr:       [74, 75, 76, 77, 76, 75, 76],
        activity: [66, 67, 68, 69, 67, 68, 68],
      },
      aiSummary: "Goat #G04 (Jamunapari breed) is healthy. All readings are stable and within expected ranges. No concerns at this time.",
      confidence: 96.9,
    },
    {
      id: "A05", emoji: "🐄", species: "Cow", speciesKey: "cows",
      breed: "Tharparkar", age: 7, weight: 460, tagId: "TAG-C005",
      status: "Healthy",
      vitals: { temp: 38.6, hr: 67, activity: "Normal" },
      baseVitals: { temp: 38.6, hr: 67, activity: 53 },
      history7d: {
        labels: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6","Today"],
        temp:     [38.5, 38.6, 38.5, 38.6, 38.7, 38.6, 38.6],
        hr:       [65, 66, 67, 67, 66, 67, 67],
        activity: [51, 52, 53, 54, 52, 53, 53],
      },
      aiSummary: "Cow #A05 (Tharparkar) is a senior animal in good health. Vitals are steady. Activity is appropriate for her age. Routine monitoring recommended.",
      confidence: 95.2,
    },
  ],

  // ── Alerts ────────────────────────────────────────────────
  alerts: [
    {
      id: "ALT001",
      animalId: "B02", severity: "Critical",
      parameter: "Heart Rate", value: "92 bpm",
      timestamp: "Today, 10:14 AM",
      confidence: 91.7,
      resolved: false,
      note: "Heart rate 92 bpm — above safe range (60–80 bpm)",
    },
    {
      id: "ALT002",
      animalId: "A02", severity: "Warning",
      parameter: "Temperature", value: "39.8°C",
      timestamp: "Today, 10:32 AM",
      confidence: 94.2,
      resolved: false,
      note: "Body temperature above safe range (38.0–39.5°C)",
    },
    {
      id: "ALT003",
      animalId: "B02", severity: "Critical",
      parameter: "Activity Level", value: "20% (Low)",
      timestamp: "Today, 09:58 AM",
      confidence: 91.7,
      resolved: false,
      note: "Activity critically low — possible illness or injury",
    },
    {
      id: "ALT004",
      animalId: "G03", severity: "Warning",
      parameter: "Activity Level", value: "30% (Low)",
      timestamp: "Today, 08:45 AM",
      confidence: 88.5,
      resolved: true,
      note: "Activity declining over 6 days",
    },
    {
      id: "ALT005",
      animalId: "A02", severity: "Warning",
      parameter: "Temperature", value: "39.5°C",
      timestamp: "Yesterday, 06:30 PM",
      confidence: 90.1,
      resolved: true,
      note: "Temperature at upper boundary of safe range",
    },
    {
      id: "ALT006",
      animalId: "B02", severity: "Warning",
      parameter: "Heart Rate", value: "88 bpm",
      timestamp: "Yesterday, 04:15 PM",
      confidence: 87.3,
      resolved: true,
      note: "Elevated heart rate — first detection",
    },
    {
      id: "ALT007",
      animalId: "A01", severity: "Info",
      parameter: "Temperature", value: "39.4°C",
      timestamp: "Yesterday, 11:00 AM",
      confidence: 82.0,
      resolved: true,
      note: "Minor spike — returned to normal within 2 hours",
    },
    {
      id: "ALT008",
      animalId: "G01", severity: "Info",
      parameter: "Activity Level", value: "High (90%)",
      timestamp: "2 days ago, 02:00 PM",
      confidence: 78.5,
      resolved: true,
      note: "Unusually high activity — likely due to new pen environment",
    },
  ],

  // ── Historical Data (30 days) ─────────────────────────────
  history: {
    // Labels for last 14 days shown in report
    labels: [
      "Mar 17","Mar 18","Mar 19","Mar 20","Mar 21","Mar 22","Mar 23",
      "Mar 24","Mar 25","Mar 26","Mar 27","Mar 28","Mar 29","Mar 30"
    ],
    // Daily alert counts [critical, warning, info]
    alertCounts: {
      critical: [0, 1, 0, 0, 1, 0, 2, 0, 1, 1, 2, 1, 1, 3],
      warning:  [1, 2, 1, 0, 2, 1, 1, 2, 1, 2, 1, 2, 2, 2],
      info:     [2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 1, 0, 2, 3],
    },
    // Average herd temperature per day
    avgTemp: [
      38.8, 38.7, 38.9, 38.7, 38.8, 38.9, 39.0,
      38.8, 38.9, 39.0, 39.1, 39.0, 39.2, 39.1
    ],
    // Table rows
    tableRows: [
      { date: "Mar 30", animalId: "B02", parameter: "Heart Rate",    reading: "92 bpm",   severity: "Critical", confidence: "91.7%", status: "Active"   },
      { date: "Mar 30", animalId: "A02", parameter: "Temperature",   reading: "39.8°C",   severity: "Warning",  confidence: "94.2%", status: "Active"   },
      { date: "Mar 30", animalId: "B02", parameter: "Activity",      reading: "20%",       severity: "Critical", confidence: "91.7%", status: "Active"   },
      { date: "Mar 30", animalId: "G03", parameter: "Activity",      reading: "30%",       severity: "Warning",  confidence: "88.5%", status: "Resolved" },
      { date: "Mar 29", animalId: "A02", parameter: "Temperature",   reading: "39.5°C",   severity: "Warning",  confidence: "90.1%", status: "Resolved" },
      { date: "Mar 29", animalId: "B02", parameter: "Heart Rate",    reading: "88 bpm",   severity: "Warning",  confidence: "87.3%", status: "Resolved" },
      { date: "Mar 29", animalId: "A01", parameter: "Temperature",   reading: "39.4°C",   severity: "Info",     confidence: "82.0%", status: "Resolved" },
      { date: "Mar 28", animalId: "G01", parameter: "Activity",      reading: "90%",       severity: "Info",     confidence: "78.5%", status: "Resolved" },
      { date: "Mar 28", animalId: "B02", parameter: "Heart Rate",    reading: "84 bpm",   severity: "Warning",  confidence: "85.0%", status: "Resolved" },
      { date: "Mar 27", animalId: "A02", parameter: "Temperature",   reading: "39.2°C",   severity: "Warning",  confidence: "88.0%", status: "Resolved" },
      { date: "Mar 27", animalId: "B02", parameter: "Activity",      reading: "28%",       severity: "Critical", confidence: "90.0%", status: "Resolved" },
      { date: "Mar 26", animalId: "A03", parameter: "Temperature",   reading: "39.6°C",   severity: "Warning",  confidence: "86.5%", status: "Resolved" },
      { date: "Mar 26", animalId: "G03", parameter: "Heart Rate",    reading: "84 bpm",   severity: "Info",     confidence: "79.0%", status: "Resolved" },
      { date: "Mar 25", animalId: "B01", parameter: "Activity",      reading: "35%",       severity: "Warning",  confidence: "83.2%", status: "Resolved" },
      { date: "Mar 24", animalId: "A04", parameter: "Temperature",   reading: "39.3°C",   severity: "Info",     confidence: "80.5%", status: "Resolved" },
      { date: "Mar 23", animalId: "B02", parameter: "Heart Rate",    reading: "81 bpm",   severity: "Warning",  confidence: "84.0%", status: "Resolved" },
      { date: "Mar 23", animalId: "A02", parameter: "Temperature",   reading: "39.1°C",   severity: "Warning",  confidence: "87.5%", status: "Resolved" },
      { date: "Mar 22", animalId: "G02", parameter: "Activity",      reading: "40%",       severity: "Info",     confidence: "76.0%", status: "Resolved" },
      { date: "Mar 21", animalId: "B02", parameter: "Temperature",   reading: "39.4°C",   severity: "Warning",  confidence: "85.5%", status: "Resolved" },
      { date: "Mar 20", animalId: "A05", parameter: "Heart Rate",    reading: "78 bpm",   severity: "Info",     confidence: "75.0%", status: "Resolved" },
    ],
  },

  // ── Upload Simulation Results ─────────────────────────────
  uploadResult: {
    recordsParsed: 142,
    anomaliesDetected: 3,
    animalsAffected: 2,
    anomalies: [
      { animalId: "B02", parameter: "Heart Rate", reading: "94 bpm",  severity: "Critical" },
      { animalId: "A02", parameter: "Temperature", reading: "39.9°C", severity: "Warning"  },
      { animalId: "B02", parameter: "Activity",    reading: "18%",    severity: "Critical" },
    ],
  },
};
