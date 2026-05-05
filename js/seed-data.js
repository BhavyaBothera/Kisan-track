const SeedDataModule = (function () {
  'use strict';

  // ── Large Dataset Generator ────────────────────────────────────────────────
  function generateLargeDataset(uid, count = 500) {
    const speciesPool = ['Cow', 'Buffalo', 'Goat'];
    const breedPool = {
      'Cow': ['Holstein', 'Jersey', 'Gir', 'Sahiwal'],
      'Buffalo': ['Murrah', 'Surti', 'Jaffrabadi'],
      'Goat': ['Beetal', 'Sirohi', 'Jamunapari']
    };
    
    const animals = [];
    for (let i = 1; i <= count; i++) {
      const sp = speciesPool[Math.floor(Math.random() * speciesPool.length)];
      const breeds = breedPool[sp];
      const br = breeds[Math.floor(Math.random() * breeds.length)];
      const idStr = `${sp[0]}${String(i).padStart(3, '0')}`;
      
      animals.push({
        animalId: idStr,
        species: sp,
        breed: br,
        age: 2 + Math.floor(Math.random() * 8),
        weight: sp === 'Goat' ? 30 + Math.floor(Math.random() * 20) : 350 + Math.floor(Math.random() * 300),
        tagId: `TAG-${idStr}-${Math.floor(Math.random() * 1000)}`,
        status: Math.random() > 0.9 ? 'Warning' : (Math.random() > 0.95 ? 'Critical' : 'Healthy'),
        emoji: sp === 'Cow' ? '🐄' : sp === 'Buffalo' ? '🐃' : '🐐',
        farmerId: uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        vitals: {
          lastTemp: 38.2 + (Math.random() * 1.5),
          lastHeartRate: 60 + Math.floor(Math.random() * 30),
          lastActivity: 'Normal'
        }
      });
    }
    return animals;
  }

  // ── Import Large Dataset ────────────────────────────────────────────────────
  async function importLargeDataset(uid) {
    console.log('🚀 Starting Large Dataset Import (500 animals)...');
    const animals = generateLargeDataset(uid, 500);
    
    // Firestore batches are limited to 500 operations
    // We have 500 animals + vitals. We need multiple batches.
    
    // 1. Import Animals
    const animalBatch = db.batch();
    const animalRefs = [];
    animals.forEach(a => {
      const ref = db.collection('animals').doc();
      animalBatch.set(ref, a);
      animalRefs.push({ id: ref.id, animalId: a.animalId });
    });
    await animalBatch.commit();
    console.log('✅ Animals imported.');

    // 2. Import some Vitals for the first 50 animals to avoid hitting limits
    const vitalBatch = db.batch();
    for (let i = 0; i < 50; i++) {
        const animal = animalRefs[i];
        for (let j = 0; j < 5; j++) {
            const vRef = db.collection('vitals').doc();
            vitalBatch.set(vRef, {
                farmerId: uid,
                animalId: animal.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                bodyTempCelsius: 38.5 + (Math.random() - 0.5),
                heartRateBpm: 70 + Math.floor(Math.random() * 10),
                activityScore: 50 + Math.floor(Math.random() * 20)
            });
        }
    }
    await vitalBatch.commit();
    console.log('✅ Sample vitals imported.');

    localStorage.setItem('kisanTrack_seeded_' + uid, 'true');
    return true;
  }

  // ── Legacy Seed (Small) ─────────────────────────────────────────────────────
  async function seed(uid) {
    if (localStorage.getItem('kisanTrack_seeded_' + uid)) return;
    return await importLargeDataset(uid);
  }

  return { seed, importLargeDataset };
})();
