// ============================================
// KisanTrack — vitals.js
// Purpose: Main logic for vitals.js
// Page: Multiple
// Dependencies: Firebase
// Last Updated: 2026-05-09
// ============================================
const VitalsModule = (function () {
  'use strict';

  // --- State ---
  let selectedAnimalId = null;
  let chartTemp = null;
  let chartHR = null;
  let chartActivity = null;
  let liveInterval = null;
  let liveReadings = {
    labels: [],
    temp: [],
    hr: [],
    activity: [],
  };
  const MAX_READINGS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * 40;

  // --- State Reference ---
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  // ── Populate selector ─────────────────────────────────────
  function populateSelector() {
    const state = getState();
    const select = document.getElementById('vitals-animal-select');
    if (!select || !state) return;

    const currentSelection = select.value;
    select.innerHTML = state.animals.map(a => `
      <option value="${a.id}">${a.emoji} ${a.species} #${a.animalId} (${a.breed}) — ${a.status}</option>
    `).join('');

    if (currentSelection && state.animals.some(a => a.id === currentSelection)) {
      select.value = currentSelection;
      selectedAnimalId = currentSelection;
    } else if (state.animals.length > 0) {
      selectedAnimalId = state.animals[0].id;
      select.value = selectedAnimalId;
    }
  }

  // --- Simulation: Generate Reading ────────────────────────
  async function generateSimulatedReading() {
    const state = getState();
    if (!state || state.animals.length === 0) return;

    // Prioritize selected animal for live demo feel
    let animal = state.animals.find(a => a.id === selectedAnimalId);
    if (!animal || Math.random() > 0.7) {
        // Occasionally pick another animal to simulate fleet-wide activity
        animal = state.animals[Math.floor(Math.random() * state.animals.length)];
    }

    const temp = +(38.2 + (Math.random() * 1.8)).toFixed(1);
    const hr = Math.round(65 + (Math.random() - 0.5) * 10);
    const act = Math.round(45 + (Math.random() - 0.5) * 20);

    try {
      // 1. Log the vital reading
      await db.collection('vitals').add({
        farmerId: auth.currentUser.uid,
        animalId: animal.id, // Document ID
        sensorTagId: animal.tagId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        bodyTempCelsius: temp,
        heartRateBpm: hr,
        activityScore: act,
        healthStatus: temp > 39.5 ? 'Warning' : 'Healthy'
      });

      // 2. Threshold check for alert
      if (temp > 39.5) {
        await db.collection('alerts').add({
          farmerId: auth.currentUser.uid,
          animalId: animal.animalId, // Display ID (e.g. A01)
          parameter: 'Body Temperature',
          readingValue: temp + '°C',
          alertType: 'High Temperature',
          severity: temp > 40.5 ? 'Critical' : 'Warning',
          confidenceScore: 85 + Math.floor(Math.random() * 10),
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          resolved: false,
          source: 'Sensor'
        });
        showToast('⚠ Threshold breach detected! Alert generated.', 'error');
      }

      // If this was for the selected animal, refresh charts
      if (animal.id === selectedAnimalId) {
        fetchHistoricalVitals();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    }
  }

  // ── Fetch Last 20 Vitals ──────────────────────────────────
  async function fetchHistoricalVitals() {
    if (!selectedAnimalId) return;

    try {
      const snapshot = await db.collection('vitals')
        .where('farmerId', '==', auth.currentUser.uid)
        .where('animalId', '==', selectedAnimalId)
        .orderBy('timestamp', 'desc')
        .limit(MAX_READINGS)
        .get();

      const readings = snapshot.docs.map(doc => doc.data()).reverse();

      liveReadings = {
        labels: readings.map(r => formatTime(r.timestamp.toDate())),
        temp: readings.map(r => r.bodyTempCelsius),
        hr: readings.map(r => r.heartRateBpm),
        activity: readings.map(r => r.activityScore)
      };

      updateCharts();
      updateGauges();
    } catch (err) {
      console.error('Error fetching historical vitals:', err);
    }
  }

  // ── Gauge Update ──────────────────────────────────────────
  function updateGauge(fillEl, valueEl, value, min, max) {
    if (!fillEl || !valueEl) return;
    const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const offset = CIRCUMFERENCE * (1 - pct);
    fillEl.style.strokeDashoffset = offset;

    const inRange = value >= min && value <= max;
    fillEl.classList.remove('green', 'amber', 'red', 'blue');
    if (fillEl.id === 'gauge-act-fill') {
      fillEl.classList.add('blue');
    } else {
      fillEl.classList.add(inRange ? 'green' : (value > max ? 'red' : 'amber'));
    }
    valueEl.textContent = typeof value === 'number' ? value.toFixed(1) : value;
  }

  function updateGauges() {
    const temp = liveReadings.temp.length ? liveReadings.temp[liveReadings.temp.length - 1] : 38.5;
    const hr = liveReadings.hr.length ? liveReadings.hr[liveReadings.hr.length - 1] : 70;
    const act = liveReadings.activity.length ? liveReadings.activity[liveReadings.activity.length - 1] : 50;

    updateGauge(document.getElementById('gauge-temp-fill'), document.getElementById('gauge-temp-val'), temp, 36.5, 41.0);
    updateGauge(document.getElementById('gauge-hr-fill'), document.getElementById('gauge-hr-val'), hr, 40, 120);
    updateGauge(document.getElementById('gauge-act-fill'), document.getElementById('gauge-act-val'), act, 0, 100);

    const syncEl = document.getElementById('last-sync-time');
    if (syncEl) syncEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ── Chart factory ─────────────────────────────────────────
  function makeChart(canvasId, label, data, color, unit, minY, maxY, safeMin, safeMax) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    return new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: liveReadings.labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: color + '14',
          tension: 0.4,
          pointRadius: 3,
          fill: true,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#706860', font: { size: 9 }, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { min: minY, max: maxY, ticks: { color, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function createCharts() {
    if (chartTemp) chartTemp.destroy();
    if (chartHR) chartHR.destroy();
    if (chartActivity) chartActivity.destroy();

    chartTemp = makeChart('chart-temp', 'Temp', liveReadings.temp, '#7CB518', '°C', 36, 42, 38, 39.5);
    chartHR = makeChart('chart-hr', 'HR', liveReadings.hr, '#E5A100', 'bpm', 40, 130, 60, 80);
    chartActivity = makeChart('chart-activity', 'Act', liveReadings.activity, '#3B82F6', '%', 0, 100, 40, 80);
  }

  function updateCharts() {
    if (chartTemp) { chartTemp.data.labels = liveReadings.labels; chartTemp.data.datasets[0].data = liveReadings.temp; chartTemp.update(); }
    if (chartHR) { chartHR.data.labels = liveReadings.labels; chartHR.data.datasets[0].data = liveReadings.hr; chartHR.update(); }
    if (chartActivity) { chartActivity.data.labels = liveReadings.labels; chartActivity.data.datasets[0].data = liveReadings.activity; chartActivity.update(); }
  }

  // ── AI Summary ────────────────────────────────────────────
  function updateAISummary() {
    const animal = getState().animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;
    document.getElementById('ai-summary-text').textContent = "Real-time AI monitoring active. Vitals are steady for " + animal.animalId + ".";
    document.getElementById('confidence-pct').textContent = '95%';
    document.getElementById('confidence-fill').style.width = '95%';
  }

  // ── Utils ─────────────────────────────────────────────────
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Public API ────────────────────────────────────────────
  function init() {
    const select = document.getElementById('vitals-animal-select');
    if (select) {
      select.addEventListener('change', () => {
        selectedAnimalId = select.value;
        fetchHistoricalVitals();
        updateAISummary();
      });
    }

    populateSelector();
    createCharts();

    if (auth.currentUser) {
      fetchHistoricalVitals();
    } else {
      const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
          fetchHistoricalVitals();
          unsubscribe();
        }
      });
    }

    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(generateSimulatedReading, 10000); // Generate every 10s for demo

    document.addEventListener('kisanTrack:stateUpdated', () => {
      populateSelector();
    });

    onActivate();
  }

  function onActivate() {
    populateSelector();
    fetchHistoricalVitals();
    updateAISummary();
  }

  return { init, onActivate };
})();
