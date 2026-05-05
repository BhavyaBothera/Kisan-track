const SeedDataModule = (function () {
  'use strict';

  const SAMPLE_ANIMALS = [
    { animalId: "A01", species: "Cow", breed: "Holstein", age: 4, weight: 420, tagId: "TAG-C001", status: "Healthy", emoji: "🐄" },
    { animalId: "A02", species: "Cow", breed: "Holstein", age: 3, weight: 380, tagId: "TAG-C002", status: "Warning", emoji: "🐄" },
    { animalId: "B01", species: "Buffalo", breed: "Murrah", age: 6, weight: 600, tagId: "TAG-B001", status: "Healthy", emoji: "🐃" },
    { animalId: "G01", species: "Goat", breed: "Beetal", age: 2, weight: 38, tagId: "TAG-G001", status: "Healthy", emoji: "🐐" }
  ];

  async function seed(uid) {
    if (localStorage.getItem('kisanTrack_seeded_' + uid)) return;
    
    console.log('Seeding initial animal data for demo...');
    const batch = db.batch();

    SAMPLE_ANIMALS.forEach(animal => {
      const animalRef = db.collection('animals').doc();
      const animalDocId = animalRef.id;
      
      batch.set(animalRef, {
        ...animal,
        farmerId: uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        vitals: {
          lastTemp: 38.4 + (Math.random() * 0.5),
          lastHeartRate: 65 + Math.floor(Math.random() * 10),
          lastActivity: 'Normal'
        }
      });

      // Seed 10 historical vital records per animal for charts
      for (let i = 0; i < 10; i++) {
        const vitalRef = db.collection('vitals').doc();
        const timeOffset = (10 - i) * 5 * 60 * 1000; // 5 mins apart
        const time = new Date(Date.now() - timeOffset);
        
        batch.set(vitalRef, {
          farmerId: uid,
          animalId: animalDocId,
          timestamp: firebase.firestore.Timestamp.fromDate(time),
          bodyTempCelsius: 38.2 + (Math.random() * 0.8),
          heartRateBpm: 68 + Math.floor(Math.random() * 12),
          activityScore: 40 + Math.floor(Math.random() * 40)
        });
      }
    });

    try {
      await batch.commit();
      localStorage.setItem('kisanTrack_seeded_' + uid, 'true');
      console.log('Seeding successful with historical vitals!');
    } catch (err) {
      console.error('Seeding failed:', err);
    }
  }

  return { seed };
})();
