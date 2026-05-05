/**
 * ============================================================
 * KisanTrack — Firestore Store (firestore-store.js)
 * Central state management and Firestore integration.
 * ============================================================
 */

const FirestoreStore = (function () {
  'use strict';

  // --- Central State ---
  const STATE = {
    farmer: null,
    animals: [],
    alerts: [],
    vitals: {}, // Latest vitals per animal: { animalId: { ...vitals } }
    kpis: {
      totalAnimals: 0,
      healthyAnimals: 0,
      activeAlerts: 0,
      criticalCases: 0
    },
    isLoading: true,
    error: null
  };

  // --- Listeners Storage (for cleanup) ---
  let listeners = {
    farmer: null,
    animals: null,
    alerts: null
  };

  // --- Mapping Helpers ---
  function mapAnimal(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      animalId: data.animalId,
      farmerId: data.farmerId,
      species: data.species,
      speciesKey: data.species.toLowerCase() + 's',
      emoji: data.species === 'Cow' ? '🐄' : data.species === 'Buffalo' ? '🐃' : '🐐',
      breed: data.breed,
      age: data.age,
      weight: data.weight,
      tagId: data.tagId,
      status: data.status,
      createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      // Base vitals for UI simulation fallback
      baseVitals: { temp: 38.5, hr: 70, activity: 50 }
    };
  }

  function mapAlert(doc) {
    const data = doc.data();
    return {
      id: doc.id,
      animalId: data.animalId,
      farmerId: data.farmerId,
      parameter: data.parameter,
      reading: data.readingValue,
      alertType: data.alertType,
      severity: data.severity,
      confidence: data.confidenceScore,
      source: data.source,
      resolved: data.resolved,
      timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
      note: data.alertType || data.parameter
    };
  }

  // --- KPI Recalculation ---
  function recalculateKPIs() {
    STATE.kpis.totalAnimals = STATE.animals.length;
    STATE.kpis.healthyAnimals = STATE.animals.filter(a => a.status === 'Healthy').length;
    STATE.kpis.activeAlerts = STATE.alerts.filter(a => !a.resolved).length;
    STATE.kpis.criticalCases = STATE.alerts.filter(a => !a.resolved && a.severity === 'Critical').length;

    // Dispatch custom event for modules to react
    document.dispatchEvent(new CustomEvent('kisanTrack:stateUpdated'));
  }

  // --- Initialization & Subscription ---
  function init(uid) {
    console.log('Initializing FirestoreStore for UID:', uid);
    STATE.isLoading = true;

    // 1. Subscribe to Farmer Profile
    listeners.farmer = db.collection('farmers').doc(uid).onSnapshot((doc) => {
      if (doc.exists) {
        STATE.farmer = doc.data();
      } else {
        console.warn('Farmer profile not found in Firestore.');
      }
      recalculateKPIs();
    }, (err) => {
      console.error('Farmer Listener Error:', err);
      STATE.error = err;
    });

    // 2. Subscribe to Animals
    listeners.animals = db.collection('animals')
      .where('farmerId', '==', uid)
      .onSnapshot((snapshot) => {
        STATE.animals = snapshot.docs.map(mapAnimal);
        console.log('Animals Updated:', STATE.animals.length);
        
        // Trigger seeding if zero animals (only if not loading anymore)
        if (STATE.animals.length === 0 && !STATE.isLoading) {
          if (window.SeedDataModule) window.SeedDataModule.seed(uid);
        }
        
        STATE.isLoading = false;
        recalculateKPIs();
      }, (err) => {
        console.error('Animals Listener Error:', err);
      });

    // 3. Subscribe to Alerts (Real-time feed)
    listeners.alerts = db.collection('alerts')
      .where('farmerId', '==', uid)
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        STATE.alerts = snapshot.docs.map(mapAlert);
        console.log('Alerts Updated:', STATE.alerts.length);
        recalculateKPIs();
      }, (err) => {
        console.error('Alerts Listener Error:', err);
      });
  }

  function unsubscribeAll() {
    if (listeners.farmer) listeners.farmer();
    if (listeners.animals) listeners.animals();
    if (listeners.alerts) listeners.alerts();
    
    listeners.farmer = null;
    listeners.animals = null;
    listeners.alerts = null;

    STATE.farmer = null;
    STATE.animals = [];
    STATE.alerts = [];
    STATE.isLoading = true;
    console.log('FirestoreStore: All listeners unsubscribed.');
  }

  // --- Public API Helpers ---
  return {
    init,
    unsubscribeAll,
    getState: () => STATE,
    getAnimalById: (id) => STATE.animals.find(a => a.id === id || a.animalId === id),
    getUnresolvedAlerts: () => STATE.alerts.filter(a => !a.resolved),
    getCriticalCount: () => STATE.kpis.criticalCases,
    getAnimalsBySpecies: (species) => STATE.animals.filter(a => a.species.toLowerCase() === species.toLowerCase()),
    
    // Add animal to Firestore
    addAnimal: async (animalData) => {
      return await db.collection('animals').add({
        ...animalData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    // Update alert status
    resolveAlert: async (alertId) => {
      return await db.collection('alerts').doc(alertId).update({
        resolved: true
      });
    }
  };

})();
