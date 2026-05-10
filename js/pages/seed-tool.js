// ============================================
// KisanTrack — seed-tool.js
// Purpose: Main logic for seed-tool.js
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================
const DataSeeder = (function () {
  'use strict';

  const SAMPLE_HERD = [
    { animalId: 'A01', species: 'Cow', breed: 'Holstein', tagId: 'TAG-C001', age: 4, weight: 520, status: 'Healthy', emoji: '🐄' },
    { animalId: 'A02', species: 'Cow', breed: 'Jersey', tagId: 'TAG-C002', age: 3, weight: 480, status: 'Healthy', emoji: '🐄' },
    { animalId: 'B01', species: 'Buffalo', breed: 'Murrah', tagId: 'TAG-B001', age: 5, weight: 650, status: 'Warning', emoji: '🐃' },
    { animalId: 'G01', species: 'Goat', breed: 'Beetal', tagId: 'TAG-G001', age: 2, weight: 45, status: 'Healthy', emoji: '🐐' },
    { animalId: 'A03', species: 'Cow', breed: 'Gir', tagId: 'TAG-C003', age: 6, weight: 510, status: 'Critical', emoji: '🐄' }
  ];

  async function seedInitialData() {
    const user = auth.currentUser;
    if (!user) return;

    const db = firebase.firestore();
    const batch = db.batch();


    // 1. Add Animals
    SAMPLE_HERD.forEach(animal => {
      const ref = db.collection('animals').doc();
      batch.set(ref, {
        ...animal,
        farmerId: user.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        vitals: {
          lastTemp: (38 + Math.random() * 1.5).toFixed(1),
          lastHeartRate: Math.round(60 + Math.random() * 20),
          lastActivity: Math.round(40 + Math.random() * 30)
        }
      });
    });

    // 2. Add an Alert for the Critical animal
    const alertRef = db.collection('alerts').doc();
    batch.set(alertRef, {
      animalId: 'A03',
      farmerId: user.uid,
      parameter: 'Body Temperature',
      readingValue: '40.2°C',
      severity: 'Critical',
      alertType: 'High Fever Detected',
      confidenceScore: 92,
      source: 'AI Sensor Node',
      resolved: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    try {
      await batch.commit();
      if (window.showToast) window.showToast('Farm initialized successfully!', 'success');
    } catch (err) {
      console.error('Seeding failed:', err);
      if (window.showToast) window.showToast('Initialization failed. Please try again.', 'error');
    }
  }

  return { seedInitialData };
})();
