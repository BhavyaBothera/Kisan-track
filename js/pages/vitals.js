// ============================================
// KisanTrack — vitals.js
// Purpose: Live Vitals Monitor Page Logic
// Page: vitals.html
// Dependencies: FirestoreStore, Chart.js, Firebase
// Last Updated: 2026-05-17
// ============================================
const VitalsModule = (function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let selectedAnimalId = null;
  let chartTemp = null, chartHR = null, chartActivity = null;
  let liveInterval = null;
  let liveReadings = { labels: [], temp: [], hr: [], activity: [] };
  let _initialized = false;

  const MAX_READINGS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * 40; // r=40

  // ── Per-species safe ranges ───────────────────────────────
  // Source: standard livestock veterinary reference values
  const SPECIES_RANGES = {
    Cow:     { tempMin: 38.0, tempMax: 39.5, hrMin: 48,  hrMax: 84,  actMin: 35, actMax: 75, tempLabel: '38.0 – 39.5°C', hrLabel: '48 – 84 bpm' },
    Buffalo: { tempMin: 37.5, tempMax: 39.0, hrMin: 40,  hrMax: 80,  actMin: 30, actMax: 70, tempLabel: '37.5 – 39.0°C', hrLabel: '40 – 80 bpm' },
    Goat:    { tempMin: 38.5, tempMax: 40.5, hrMin: 70,  hrMax: 135, actMin: 40, actMax: 85, tempLabel: '38.5 – 40.5°C', hrLabel: '70 – 135 bpm' },
    Sheep:   { tempMin: 38.5, tempMax: 40.0, hrMin: 60,  hrMax: 120, actMin: 35, actMax: 80, tempLabel: '38.5 – 40.0°C', hrLabel: '60 – 120 bpm' },
  };

  function getRanges(species) {
    return SPECIES_RANGES[species] || SPECIES_RANGES.Cow;
  }

  // ── Helpers ───────────────────────────────────────────────
  function getState() {
    return window.FirestoreStore ? window.FirestoreStore.getState() : null;
  }

  function formatTime(date) {
    return date instanceof Date
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '--:--';
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── Selector Population ───────────────────────────────────
  function populateSelector() {
    const state = getState();
    const select = document.getElementById('vitals-animal-select');
    if (!select) return;

    if (!state || state.animals.length === 0) {
      select.innerHTML = '<option value="">No animals registered yet</option>';
      return;
    }

    const prevValue = select.value || selectedAnimalId;

    select.innerHTML = state.animals.map(a =>
      `<option value="${a.id}">${a.emoji || '🐄'} ${a.species} #${a.animalId} (${a.breed}) — ${a.status}</option>`
    ).join('');

    // Restore previous selection if still valid
    const stillExists = prevValue && state.animals.some(a => a.id === prevValue);
    if (stillExists) {
      select.value = prevValue;
      selectedAnimalId = prevValue;
    } else {
      selectedAnimalId = state.animals[0].id;
      select.value = selectedAnimalId;
    }

    // Trigger a full refresh for the newly selected animal
    onAnimalSelected();
  }

  // ── Called whenever selected animal changes ───────────────
  function onAnimalSelected() {
    const state = getState();
    if (!state || !selectedAnimalId) return;

    const animal = state.animals.find(a => a.id === selectedAnimalId);
    if (!animal) return;

    updateSafeRanges(animal);
    updateAnimalStrip(animal);
    updateAISummary(animal, state);
    fetchHistoricalVitals();
  }

  // ── Update safe range labels for selected species ─────────
  function updateSafeRanges(animal) {
    const r = getRanges(animal.species);

    setEl('gauge-temp-range',  `Safe: ${r.tempLabel}`);
    setEl('gauge-hr-range',    `Safe: ${r.hrLabel}`);
    setEl('gauge-act-range',   `Normal: ${r.actMin} – ${r.actMax}%`);
    setEl('chart-temp-range',  `Safe: ${r.tempLabel} · Unit: °C`);
    setEl('chart-hr-range',    `Safe: ${r.hrLabel} · Unit: bpm`);
    setEl('chart-act-range',   `Normal: ${r.actMin} – ${r.actMax}% · Unit: %`);
  }

  // ── Animal info strip below selector ─────────────────────
  function updateAnimalStrip(animal) {
    const strip = document.getElementById('selected-animal-strip');
    if (!strip) return;
    strip.style.display = 'flex';

    setEl('strip-emoji', animal.emoji || '🐄');
    setEl('strip-label', `${animal.species} #${animal.animalId} · ${animal.breed} · ${animal.age ? animal.age + ' yrs' : ''} · Tag: ${animal.tagId || '—'}`);

    const statusSpan = document.getElementById('strip-status');
    if (statusSpan) {
      const colour = animal.status === 'Healthy' ? '#7CB518' : animal.status === 'Warning' ? '#E5A100' : '#EF4444';
      statusSpan.innerHTML = `<span style="background:${colour}20;color:${colour};padding:3px 10px;border-radius:20px;font-size:0.78rem;font-weight:600;">${animal.status || 'Healthy'}</span>`;
    }
  }

  // ── Simulated live reading for demo mode ─────────────────
  async function generateSimulatedReading() {
    const state = getState();
    if (!state || state.animals.length === 0 || !auth.currentUser) return;

    // Always simulate for the selected animal so charts stay relevant
    const animal = state.animals.find(a => a.id === selectedAnimalId) || state.animals[0];
    const r = getRanges(animal.species);

    // Simulate near-normal readings with occasional spikes
    const spike = Math.random() < 0.1; // 10% chance of a spike
    const temp = +(r.tempMin + (Math.random() * (r.tempMax - r.tempMin)) + (spike ? 1.2 : 0)).toFixed(1);
    const hr   = Math.round(r.hrMin + Math.random() * (r.hrMax - r.hrMin) + (spike ? 15 : 0));
    const act  = Math.round(r.actMin + Math.random() * (r.actMax - r.actMin));

    try {
      await db.collection('vitals').add({
        farmerId: auth.currentUser.uid,
        animalId: animal.id,
        sensorTagId: animal.tagId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        bodyTempCelsius: temp,
        heartRateBpm: hr,
        activityScore: act,
        healthStatus: temp > r.tempMax ? 'Warning' : 'Healthy'
      });

      if (temp > r.tempMax + 0.5) {
        await db.collection('alerts').add({
          farmerId: auth.currentUser.uid,
          animalId: animal.animalId,
          parameter: 'Body Temperature',
          readingValue: temp + '°C',
          alertType: 'High Temperature',
          severity: temp > r.tempMax + 1.5 ? 'Critical' : 'Warning',
          confidenceScore: 85 + Math.floor(Math.random() * 10),
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          resolved: false,
          source: 'Sensor'
        });
        if (window.showToast) window.showToast(`⚠ High temp detected on ${animal.species} #${animal.animalId}!`, 'error');
      }

      // Push to in-memory buffer immediately (don't wait for Firestore round-trip)
      const now = new Date();
      liveReadings.labels.push(formatTime(now));
      liveReadings.temp.push(temp);
      liveReadings.hr.push(hr);
      liveReadings.activity.push(act);
      if (liveReadings.labels.length > MAX_READINGS) {
        ['labels','temp','hr','activity'].forEach(k => liveReadings[k].shift());
      }
      updateCharts();
      updateGauges(animal.species);
      updateAISummary(animal, state);

    } catch (err) {
      console.error('VitalsModule: Simulation error:', err);
    }
  }

  // ── Fetch last 20 vitals from Firestore ───────────────────
  async function fetchHistoricalVitals() {
    if (!selectedAnimalId || !auth.currentUser) return;

    try {
      const snapshot = await db.collection('vitals')
        .where('farmerId', '==', auth.currentUser.uid)
        .where('animalId', '==', selectedAnimalId)
        .orderBy('timestamp', 'desc')
        .limit(MAX_READINGS)
        .get();

      if (snapshot.empty) {
        // No history yet — seed with realistic demo values based on species
        const state = getState();
        const animal = state && state.animals.find(a => a.id === selectedAnimalId);
        const r = getRanges(animal ? animal.species : 'Cow');
        const now = Date.now();

        liveReadings = {
          labels:   Array.from({ length: 8 }, (_, i) => formatTime(new Date(now - (7 - i) * 60000))),
          temp:     Array.from({ length: 8 }, () => +(r.tempMin + Math.random() * (r.tempMax - r.tempMin)).toFixed(1)),
          hr:       Array.from({ length: 8 }, () => Math.round(r.hrMin + Math.random() * (r.hrMax - r.hrMin))),
          activity: Array.from({ length: 8 }, () => Math.round(r.actMin + Math.random() * (r.actMax - r.actMin))),
        };
      } else {
        const readings = snapshot.docs.map(d => d.data()).reverse();
        liveReadings = {
          labels:   readings.map(r => r.timestamp ? formatTime(r.timestamp.toDate()) : '--'),
          temp:     readings.map(r => r.bodyTempCelsius),
          hr:       readings.map(r => r.heartRateBpm),
          activity: readings.map(r => r.activityScore),
        };
      }

      updateCharts();
      const state = getState();
      const animal = state && state.animals.find(a => a.id === selectedAnimalId);
      updateGauges(animal ? animal.species : 'Cow');

    } catch (err) {
      console.error('VitalsModule: Fetch error:', err);
    }
  }

  // ── Gauges ────────────────────────────────────────────────
  function updateGauge(fillId, valueId, value, min, max, isActivity) {
    const fill  = document.getElementById(fillId);
    const valEl = document.getElementById(valueId);
    if (!fill || !valEl) return;

    const pct    = Math.min(Math.max((value - min) / (max - min), 0), 1);
    fill.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct);

    fill.classList.remove('green', 'amber', 'red', 'blue');
    if (isActivity) {
      fill.classList.add('blue');
    } else {
      const inRange = value >= min && value <= max;
      fill.classList.add(inRange ? 'green' : value > max ? 'red' : 'amber');
    }

    valEl.textContent = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : value;
  }

  function updateGauges(species) {
    const r = getRanges(species || 'Cow');
    const lastTemp = liveReadings.temp.at(-1) ?? r.tempMin + 0.5;
    const lastHR   = liveReadings.hr.at(-1)   ?? r.hrMin + 5;
    const lastAct  = liveReadings.activity.at(-1) ?? r.actMin + 10;

    updateGauge('gauge-temp-fill', 'gauge-temp-val', lastTemp, r.tempMin - 2, r.tempMax + 2, false);
    updateGauge('gauge-hr-fill',   'gauge-hr-val',   lastHR,   r.hrMin - 10,  r.hrMax + 20,  false);
    updateGauge('gauge-act-fill',  'gauge-act-val',  lastAct,  0,             100,            true);

    const syncEl = document.getElementById('last-sync-time');
    if (syncEl) syncEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // ── Charts ────────────────────────────────────────────────
  function makeChart(canvasId, label, data, color, minY, maxY) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: liveReadings.labels,
        datasets: [{ label, data, borderColor: color, backgroundColor: color + '18', tension: 0.4, pointRadius: 3, fill: true, borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#706860', font: { size: 9 }, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { min: minY, max: maxY, ticks: { color, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  function createCharts(species) {
    const r = getRanges(species || 'Cow');
    if (chartTemp)     chartTemp.destroy();
    if (chartHR)       chartHR.destroy();
    if (chartActivity) chartActivity.destroy();

    chartTemp     = makeChart('chart-temp',     'Temp', liveReadings.temp,     '#7CB518', r.tempMin - 2, r.tempMax + 2);
    chartHR       = makeChart('chart-hr',       'HR',   liveReadings.hr,       '#E5A100', r.hrMin - 10,  r.hrMax + 20);
    chartActivity = makeChart('chart-activity', 'Act',  liveReadings.activity, '#3B82F6', 0,             100);
  }

  function updateCharts() {
    if (!chartTemp || !chartHR || !chartActivity) { createCharts(); return; }
    [
      [chartTemp,     liveReadings.temp],
      [chartHR,       liveReadings.hr],
      [chartActivity, liveReadings.activity],
    ].forEach(([chart, data]) => {
      chart.data.labels = liveReadings.labels;
      chart.data.datasets[0].data = data;
      chart.update('none'); // no animation for smooth live feel
    });
  }

  // ── AI Summary ────────────────────────────────────────────
  function updateAISummary(animal, state) {
    const summaryEl = document.getElementById('ai-summary-text');
    const pctEl     = document.getElementById('confidence-pct');
    const fillEl    = document.getElementById('confidence-fill');
    if (!summaryEl || !animal) return;

    const r       = getRanges(animal.species);
    const lastTemp = liveReadings.temp.at(-1);
    const lastHR   = liveReadings.hr.at(-1);
    const lastAct  = liveReadings.activity.at(-1);

    let confidence = 92;
    let statusNote = '';

    if (lastTemp !== undefined) {
      const tempOk = lastTemp >= r.tempMin && lastTemp <= r.tempMax;
      const hrOk   = lastHR !== undefined && lastHR >= r.hrMin && lastHR <= r.hrMax;

      if (!tempOk) {
        confidence = lastTemp > r.tempMax + 1 ? 97 : 88;
        statusNote = lastTemp > r.tempMax
          ? `⚠ Elevated temperature (${lastTemp}°C) detected — above safe range for ${animal.species} (${r.tempLabel}). Recommend veterinary check.`
          : `❄ Low temperature (${lastTemp}°C) — below normal range. Monitor closely.`;
      } else if (!hrOk) {
        confidence = 85;
        statusNote = `⚠ Heart rate (${lastHR} bpm) outside normal range for ${animal.species} (${r.hrLabel}).`;
      } else {
        const actNote = lastAct < r.actMin ? ` Activity appears low (${lastAct}%) — animal may be resting.` : '';
        statusNote = `✅ All vitals within normal range for ${animal.species}. ${animal.species} #${animal.animalId} is healthy.${actNote}`;
      }
    } else {
      statusNote = `Monitoring ${animal.species} #${animal.animalId} (${animal.breed}). Awaiting sensor data — live readings will appear shortly.`;
      confidence = 78;
    }

    summaryEl.textContent = statusNote;
    if (pctEl)  pctEl.textContent  = confidence + '%';
    if (fillEl) fillEl.style.width = confidence + '%';

    // Colour the confidence bar
    if (fillEl) {
      fillEl.style.background = confidence >= 90 ? 'var(--accent-green)' : confidence >= 75 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Listen for Firestore data — populate selector as soon as animals load
    document.addEventListener('kisanTrack:stateUpdated', () => {
      populateSelector();
    });

    // Selector change handler
    const select = document.getElementById('vitals-animal-select');
    if (select) {
      select.addEventListener('change', () => {
        selectedAnimalId = select.value;
        onAnimalSelected();
      });
    }

    // Try populating now (may already have data)
    populateSelector();

    // Build empty charts immediately so canvases aren't blank
    createCharts('Cow');

    // Start live simulation interval
    if (liveInterval) clearInterval(liveInterval);
    liveInterval = setInterval(generateSimulatedReading, 10000);

    // Clean up on page leave
    window.addEventListener('beforeunload', () => {
      if (liveInterval) clearInterval(liveInterval);
    });
  }

  return { init };
})();

window.VitalsModule = VitalsModule;
