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
      const ref = db.collection('animals').doc();
      batch.set(ref, {
        ...animal,
        farmerId: uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        vitals: {
          lastTemp: 38.4 + (Math.random() * 0.5),
          lastHeartRate: 65 + Math.floor(Math.random() * 10),
          lastActivity: 'Normal'
        }
      });
    });

    try {
      await batch.commit();
      localStorage.setItem('kisanTrack_seeded_' + uid, 'true');
      console.log('Seeding successful!');
    } catch (err) {
      console.error('Seeding failed:', err);
    }
  }

  return { seed };
})();
