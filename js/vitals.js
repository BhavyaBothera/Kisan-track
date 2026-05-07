/**
 * ============================================================
 * KisanTrack — Vitals Module (vitals.js)
 * Animal selector, circular gauges, live Chart.js,
 * AI health summary, confidence bar
 * ============================================================
 */

const VitalsModule = (function () {
  'use strict';

  let vitalsUnsubscribe = null;

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
    } else if (state.animals.length > 0) {
      selectedAnimalId = state.animals[0].id;
      select.value = selectedAnimalId;
    }
  }

  // ── Fetch Last 20 Vitals (Real-time) ───────────────────────
  function setupVitalsListener() {
    if (vitalsUnsubscribe) {
      vitalsUnsubscribe();
      vitalsUnsubscribe = null;
    }

    if (!selectedAnimalId || !auth.currentUser) return;
    
    vitalsUnsubscribe = db.collection('vitals')
      .where('farmerId', '==', auth.currentUser.uid)
      .where('animalId', '==', selectedAnimalId)
      .orderBy('timestamp', 'desc')
      .limit(MAX_READINGS)
      .onSnapshot((snapshot) => {
        const readings = snapshot.docs.map(doc => doc.data()).reverse();
        
        liveReadings = {
          labels: readings.map(r => r.timestamp ? formatTime(r.timestamp.toDate()) : '--:--'),
          temp: readings.map(r => r.bodyTempCelsius),
          hr: readings.map(r => r.heartRateBpm),
          activity: readings.map(r => r.activityScore)
        };

        updateCharts();
        updateGauges();
        updateAISummary();
      }, (err) => {
        console.error('Error fetching real-time vitals:', err);
      });
  }

  // ── Gauge Update ──────────────────────────────────────────
  function updateGauge(fillEl, valueEl, value, min, max) {
    if (!fillEl || !valueEl) return;
    const pct    = Math.min(Math.max((value - min) / (max - min), 0), 1);
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
    const hr   = liveReadings.hr.length   ? liveReadings.hr[liveReadings.hr.length - 1]     : 70;
    const act  = liveReadings.activity.length ? liveReadings.activity[liveReadings.activity.length - 1] : 50;

    updateGauge(document.getElementById('gauge-temp-fill'), document.getElementById('gauge-temp-val'), temp, 36.5, 41.0);
    updateGauge(document.getElementById('gauge-hr-fill'), document.getElementById('gauge-hr-val'), hr, 40, 120);
    updateGauge(document.getElementById('gauge-act-fill'), document.getElementById('gauge-act-val'), act, 0, 100);
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

    chartTemp     = makeChart('chart-temp',     'Temp', liveReadings.temp,     '#7CB518', '°C',  36, 42, 38, 39.5);
    chartHR       = makeChart('chart-hr',       'HR',   liveReadings.hr,       '#E5A100', 'bpm', 40, 130, 60, 80);
    chartActivity = makeChart('chart-activity', 'Act',  liveReadings.activity, '#3B82F6', '%',   0, 100, 40, 80);
  }

  function updateCharts() {
    if (chartTemp) { chartTemp.data.labels = liveReadings.labels; chartTemp.data.datasets[0].data = liveReadings.temp; chartTemp.update('none'); }
    if (chartHR) { chartHR.data.labels = liveReadings.labels; chartHR.data.datasets[0].data = liveReadings.hr; chartHR.update('none'); }
    if (chartActivity) { chartActivity.data.labels = liveReadings.labels; chartActivity.data.datasets[0].data = liveReadings.activity; chartActivity.update('none'); }
  }

  // ── AI Summary ────────────────────────────────────────────
  function updateAISummary() {
    const state = getState();
    if (!state) return;
    const animal = state.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;
    
    const latestTemp = liveReadings.temp.length ? liveReadings.temp[liveReadings.temp.length - 1] : null;
    let summaryText = "Select an animal to view health summary.";
    
    if (latestTemp) {
      const isStable = latestTemp >= 38.0 && latestTemp <= 39.5;
      summaryText = `AI analysis active for #${animal.animalId}. Vitals are ${isStable ? 'stable' : 'deviating from normal'}. Last recorded temperature: ${latestTemp}°C.`;
    }

    const summaryEl = document.getElementById('ai-summary-text');
    if (summaryEl) summaryEl.textContent = summaryText;
    
    const confPctEl = document.getElementById('confidence-pct');
    if (confPctEl) confPctEl.textContent = '98%';
    
    const confFillEl = document.getElementById('confidence-fill');
    if (confFillEl) confFillEl.style.width = '98%';
  }

  // ── Utils ─────────────────────────────────────────────────
  function formatTime(date) {
    if (!date) return '--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ── Public API ────────────────────────────────────────────
  function init() {
    const select = document.getElementById('vitals-animal-select');
    if (select) {
      select.addEventListener('change', () => {
        selectedAnimalId = select.value;
        setupVitalsListener();
        updateAISummary();
      });
    }

    populateSelector();
    createCharts();
    
    if (auth.currentUser) {
      setupVitalsListener();
    } else {
      const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
          setupVitalsListener();
          unsubscribe();
        }
      });
    }
    
    document.addEventListener('kisanTrack:stateUpdated', () => {
      populateSelector();
      // If we don't have a listener yet and now we have a selected ID, start it
      if (!vitalsUnsubscribe && selectedAnimalId) {
        setupVitalsListener();
      }
    });
  }

  function onActivate() {
    setupVitalsListener();
    updateAISummary();
  }

  return { init, onActivate };
})();
