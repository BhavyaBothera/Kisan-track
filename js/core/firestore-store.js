// ============================================
// KisanTrack — firestore-store.js
// Purpose: Central Firestore State Management
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================

const FirestoreStore = (function () {
  'use strict';

  // --- Central State ---
  const STATE = {
    farmer: null,
    animals: [],
    alerts: [],
    vitals: {}, // Latest vitals per animal: { docId: { ...vitals } }
    kpis: {
      totalAnimals: 0,
      healthyAnimals: 0,
      activeAlerts: 0,
      criticalCases: 0
    },
    isLoading: true,
    initializedUid: null,
    error: null
  };

  // --- Listeners Storage (for cleanup) ---
  let listeners = {
    farmer: null,
    animals: null,
    alerts: null,
    vitals: null
  };

  // --- Mapping Helpers ---
  function mapAnimal(doc) {
    const data = doc.data();
    const emojiMap = { Cow: '🐄', Buffalo: '🐃', Goat: '🐐', Sheep: '🐑' };
    return {
      id: doc.id,
      animalId: data.animalId || 'UNKNOWN',
      farmerId: data.farmerId,
      species: data.species || 'Cow',
      speciesKey: (data.species || 'Cow').toLowerCase() + 's',
      emoji: emojiMap[data.species] || '🐄',
      breed: data.breed || 'Mixed',
      age: data.age || 0,
      weight: data.weight || 0,
      tagId: data.tagId || '—',
      status: data.status || 'Healthy',
      dob: data.dob || null,
      owner: data.owner || null,
      createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
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
      severity: data.severity || 'Warning',
      confidence: data.confidenceScore || 0,
      source: data.source || 'Sensor',
      resolved: !!data.resolved,
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
    document.dispatchEvent(new CustomEvent('kisanTrack:stateUpdated', { detail: { state: STATE } }));
  }

  // --- Initialization & Subscription ---
  function init(uid) {
    if (!uid) return;
    
    // Ensure Firebase is ready
    if (typeof db === 'undefined' || !db) {
      console.error('FirestoreStore: Firebase DB not initialized.');
      return;
    }

    // Protection against duplicate init
    if (STATE.initializedUid === uid) return;
    
    // If different user, cleanup first
    if (STATE.initializedUid && STATE.initializedUid !== uid) {
      unsubscribeAll();
    }

    STATE.initializedUid = uid;
    STATE.isLoading = true;

    // 1. Subscribe to Farmer Profile
    try {
      listeners.farmer = db.collection('farmers').doc(uid).onSnapshot((doc) => {
        if (doc.exists) {
          STATE.farmer = { id: doc.id, ...doc.data() };
          // Dispatch so auth.js can update name/avatar in real time
          document.dispatchEvent(new CustomEvent('kisanTrack:farmerLoaded', {
            detail: { fullName: STATE.farmer.fullName, farmName: STATE.farmer.farmName }
          }));
        } else {
          console.warn('FirestoreStore: Farmer profile not found.');
          STATE.farmer = { fullName: 'Farmer', farmName: 'My Farm' };
        }
        recalculateKPIs();
      }, (err) => {
        console.error('FirestoreStore: Farmer Listener Error:', err);
        recalculateKPIs();
      });
    } catch (e) {
      console.error('FirestoreStore: Farmer init failed', e);
    }

    // 2. Subscribe to Animals (Limit to 100 to prevent crash)
    listeners.animals = db.collection('animals')
      .where('farmerId', '==', uid)
      .limit(100)
      .onSnapshot((snapshot) => {
        STATE.animals = snapshot.docs.map(mapAnimal);
        STATE.isLoading = false;
        recalculateKPIs();
      }, (err) => {
        console.error('FirestoreStore: Animals Listener Error:', err);
        STATE.isLoading = false;
      });

    // 3. Subscribe to Alerts (Real-time feed, Limit to 50)
    listeners.alerts = db.collection('alerts')
      .where('farmerId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .onSnapshot((snapshot) => {
        STATE.alerts = snapshot.docs.map(mapAlert);
        recalculateKPIs();
      }, (err) => {
        console.error('FirestoreStore: Alerts Listener Error:', err);
      });

    // 4. Subscribe to latest Vitals (Limit to 100)
    listeners.vitals = db.collection('vitals')
      .where('farmerId', '==', uid)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .onSnapshot((snapshot) => {
        const latestPerAnimal = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const animalDocId = data.animalId; 
          if (!latestPerAnimal[animalDocId]) {
            latestPerAnimal[animalDocId] = {
              temp: data.bodyTempCelsius,
              hr: data.heartRateBpm,
              activity: data.activityScore,
              timestamp: data.timestamp ? data.timestamp.toDate() : new Date()
            };
          }
        });
        STATE.vitals = latestPerAnimal;
        recalculateKPIs();
      }, (err) => {
        console.error('FirestoreStore: Vitals Listener Error:', err);
      });
  }

  function unsubscribeAll() {
    Object.keys(listeners).forEach(key => {
      if (listeners[key]) {
        listeners[key]();
        listeners[key] = null;
      }
    });

    STATE.farmer = null;
    STATE.animals = [];
    STATE.alerts = [];
    STATE.vitals = {};
    STATE.isLoading = true;
    STATE.initializedUid = null;
  }

  // --- Public API Helpers ---
  return {
    init,
    unsubscribeAll,
    getState: () => ({ ...STATE }), // Return clone
    getAnimalById: (id) => STATE.animals.find(a => a.id === id || a.animalId === id),
    getUnresolvedAlerts: () => STATE.alerts.filter(a => !a.resolved),
    
    addAnimal: async (animalData) => {
      if (!STATE.initializedUid) throw new Error('Store not initialized');
      const payload = {
        ...animalData,
        farmerId: STATE.initializedUid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      // Only store dob/owner if provided
      if (!payload.dob) delete payload.dob;
      if (!payload.owner) delete payload.owner;
      return await db.collection('animals').add(payload);
    },

    resolveAlert: async (alertId) => {
      return await db.collection('alerts').doc(alertId).update({
        resolved: true,
        resolvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  };

})();

// Ensure cleanup on page transition
window.addEventListener('beforeunload', () => {
  if (window.FirestoreStore) window.FirestoreStore.unsubscribeAll();
});
